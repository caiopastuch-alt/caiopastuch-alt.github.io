// ── Inline editing ────────────────────────────────────────────────
function closeActiveEditor(){if(activeEditor){activeEditor();activeEditor=null;}}

function makeCell(td,html,editFn){
  const v=document.createElement('span');v.className='cell-view';v.innerHTML=html;
  v.onclick=e=>{e.stopPropagation();closeActiveEditor();editFn(td,v);};td.appendChild(v);
}

function textEditor(td,v,getVal,setVal,type,fmtV,after,plantaoRef){
  const w=document.createElement('div');w.className='cell-edit-wrap';
  const i=document.createElement('input');i.type=type||'text';i.className='cell-input';i.value=getVal();
  w.appendChild(i);td.appendChild(w);i.focus();i.select();
  let done=false;
  function commit(){
    if(done)return;done=true;
    let val=i.value.trim();if(type==='number')val=parseFloat(val)||0;
    setVal(val);
    if(plantaoRef)savePlantao(plantaoRef);else save();
    if(w.parentNode===td)td.removeChild(w);
    v.innerHTML=fmtV?fmtV():(val||'<span style="color:var(--text3);font-size:11px">—</span>');
    if(after)after();updateKpis(getFiltered());renderResumo();renderNextShift();activeEditor=null;
  }
  i.onkeydown=e=>{if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();commit();}if(e.key==='Escape'){done=true;if(w.parentNode===td)td.removeChild(w);activeEditor=null;}};
  i.onblur=()=>setTimeout(()=>{if(!done)commit();},120);
  activeEditor=()=>{if(!done)commit();};
}

function selectEditor(td,v,options,getVal,setVal,fmtV,after,plantaoRef){
  const w=document.createElement('div');w.className='cell-edit-wrap';
  const s=document.createElement('select');s.className='cell-select';
  options.forEach(o=>{const op=document.createElement('option');op.value=o;op.textContent=o;if(o===getVal())op.selected=true;s.appendChild(op);});
  w.appendChild(s);td.appendChild(w);s.focus();
  let done=false;
  function commit(){
    if(done)return;done=true;
    setVal(s.value);
    if(plantaoRef)savePlantao(plantaoRef);else save();
    if(w.parentNode===td)td.removeChild(w);
    v.innerHTML=fmtV?fmtV():s.value;
    if(after)after();updateKpis(getFiltered());renderResumo();renderNextShift();activeEditor=null;
  }
  s.onchange=commit;
  s.onblur=()=>setTimeout(()=>{if(!done)commit();},120);
  s.onkeydown=e=>{if(e.key==='Escape'){done=true;if(w.parentNode===td)td.removeChild(w);activeEditor=null;}};
  activeEditor=()=>{if(!done)commit();};
}

// ── Smart date parser ────────────────────────────────────────────
// Accepts: "16/03", "16/03/26", "16/03/2026", "16 mar", "16 março", "16-03-2026"
function parseSmartDate(str, fallbackYear){
  if(!str)return null;
  str=str.trim().toLowerCase();
  const yr=fallbackYear||new Date().getFullYear();
  const MESES_MAP={
    'jan':1,'fev':2,'mar':3,'abr':4,'mai':5,'jun':6,
    'jul':7,'ago':8,'set':9,'out':10,'nov':11,'dez':12,
    'janeiro':1,'fevereiro':2,'março':3,'abril':4,'maio':5,'junho':6,
    'julho':7,'agosto':8,'setembro':9,'outubro':10,'novembro':11,'dezembro':12
  };
  let d,m,y=yr;
  // "16 mar" or "16 março" or "16 março 2026"
  const wordMatch=str.match(/^(\d{1,2})\s+([a-záêçõ]+)(?:\s+(\d{2,4}))?$/);
  if(wordMatch){
    d=parseInt(wordMatch[1]);
    m=MESES_MAP[wordMatch[2]];
    if(wordMatch[3])y=wordMatch[3].length===2?2000+parseInt(wordMatch[3]):parseInt(wordMatch[3]);
    if(!m)return null;
  } else {
    // "16/03", "16/03/26", "16/03/2026", "16-03-2026"
    const numMatch=str.match(/^(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?$/);
    if(!numMatch)return null;
    d=parseInt(numMatch[1]);m=parseInt(numMatch[2]);
    if(numMatch[3])y=numMatch[3].length===2?2000+parseInt(numMatch[3]):parseInt(numMatch[3]);
  }
  if(!d||!m||d<1||d>31||m<1||m>12)return null;
  const date=new Date(y,m-1,d);
  if(date.getMonth()!==m-1)return null; // invalid day for month
  return`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function dateEditor(td,v,p,after){
  const w=document.createElement('div');w.className='cell-edit-wrap';
  const i=document.createElement('input');
  i.type='text';i.className='cell-input';
  // Show current date in friendly format
  i.value=p.data?fmtData(p.data):'';
  i.placeholder='ex: 16/03 ou 16 mar';
  i.style.fontFamily='var(--mono)';
  i.style.fontSize='12px';
  w.appendChild(i);td.appendChild(w);
  // Show hint below
  const hint=document.createElement('div');
  hint.style.cssText='position:absolute;top:100%;left:0;background:var(--bg4);border:1px solid var(--accent-border);border-radius:0 0 6px 6px;padding:3px 9px;font-size:10px;color:var(--text3);white-space:nowrap;z-index:20;pointer-events:none';
  hint.textContent='16/03 · 16 mar · 16/03/2026 · Enter confirma';
  td.appendChild(hint);
  setTimeout(()=>i.focus(),30);
  let done=false;
  // Live feedback: turn green if parseable, red if not
  i.oninput=()=>{
    const parsed=parseSmartDate(i.value, p.data?parseInt(p.data.split('-')[0]):null);
    i.style.color=i.value.trim()?(parsed?'var(--green)':'var(--red)'):'var(--text)';
    if(parsed){
      const[,mo,dd]=parsed.split('-');
      hint.textContent=`→ ${dd}/${mo}/${parsed.split('-')[0]} (${getDowFull(parsed)})`;
      hint.style.color='var(--green)';
    } else if(i.value.trim()){
      hint.textContent='Formato não reconhecido';
      hint.style.color='var(--red)';
    } else {
      hint.textContent='16/03 · 16 mar · 16/03/2026 · Enter confirma';
      hint.style.color='var(--text3)';
    }
  };
  function commit(){
    if(done)return;done=true;
    if(hint.parentNode===td)td.removeChild(hint);
    const raw=i.value.trim();
    if(raw){
      const yr=p.data?parseInt(p.data.split('-')[0]):null;
      const parsed=parseSmartDate(raw,yr);
      if(parsed&&parsed!==p.data){
        p.data=parsed;
        p.mes=MESES[parseInt(parsed.split('-')[1])-1];
        savePlantao(p);
      } else if(!parsed){
        showToast('Data não reconhecida — use: 16/03, 16 mar ou 16/03/2026');
      }
    }
    if(w.parentNode===td)td.removeChild(w);
    v.innerHTML=`<span class="data-txt">${fmtData(p.data)}</span>`;
    if(after)after();updateKpis(getFiltered());renderResumo();renderNextShift();activeEditor=null;
  }
  i.onkeydown=e=>{
    if(e.key==='Enter'){e.preventDefault();commit();}
    if(e.key==='Escape'){done=true;if(hint.parentNode===td)td.removeChild(hint);if(w.parentNode===td)td.removeChild(w);activeEditor=null;}
  };
  i.onblur=()=>setTimeout(()=>{if(!done)commit();},200);
  activeEditor=()=>{if(!done)commit();};
}

function timeEditor(td,v,p,field,after){
  const w=document.createElement('div');w.className='cell-edit-wrap';
  const i=document.createElement('input');i.type='time';i.step='60';i.className='cell-input';i.value=p[field]||'';
  w.appendChild(i);td.appendChild(w);
  // Focus and select all after a tick so browser doesn't auto-advance
  setTimeout(()=>{i.focus();try{i.select();}catch(e){}},30);
  let done=false;
  function commit(){
    if(done)return;done=true;
    p[field]=i.value;
    savePlantao(p);
    if(w.parentNode===td)td.removeChild(w);
    v.innerHTML=`<span class="time-txt">${p[field]||'—'}</span>`;
    if(after)after();updateKpis(getFiltered());renderResumo();renderNextShift();activeEditor=null;
  }
  i.onkeydown=e=>{
    if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();commit();}
    if(e.key==='Escape'){done=true;if(w.parentNode===td)td.removeChild(w);activeEditor=null;}
  };
  // Only commit on blur after user is done — delay longer to allow typing full time
  i.onblur=()=>setTimeout(()=>{if(!done)commit();},300);
  activeEditor=()=>{if(!done)commit();};
}

// ── Build data row ────────────────────────────────────────────────
function buildRow(p,tbody,ym){
  const tr=document.createElement('tr');
  const dataTd=document.createElement('td');
  const dataV=document.createElement('span');dataV.className='cell-view';dataV.innerHTML=`<span class="data-txt">${fmtData(p.data)}</span>`;
  dataV.onclick=e=>{e.stopPropagation();closeActiveEditor();dateEditor(dataTd,dataV,p,()=>refreshRow());};
  dataTd.appendChild(dataV);tr.appendChild(dataTd);
  const dowTd=document.createElement('td');
  const dowSpan=document.createElement('span');dowSpan.className='cell-ro dow-txt';dowSpan.textContent=getDow(p.data);dowSpan.title=getDowFull(p.data);
  dowTd.appendChild(dowSpan);tr.appendChild(dowTd);
  const iniTd=document.createElement('td');
  const iniV=document.createElement('span');iniV.className='cell-view';iniV.innerHTML=`<span class="time-txt">${p.ini||'—'}</span>`;
  iniV.onclick=e=>{e.stopPropagation();closeActiveEditor();timeEditor(iniTd,iniV,p,'ini',()=>refreshRow());};
  iniTd.appendChild(iniV);tr.appendChild(iniTd);
  const fimTd=document.createElement('td');
  const fimV=document.createElement('span');fimV.className='cell-view';fimV.innerHTML=`<span class="time-txt">${p.fim||'—'}</span>`;
  fimV.onclick=e=>{e.stopPropagation();closeActiveEditor();timeEditor(fimTd,fimV,p,'fim',()=>refreshRow());};
  fimTd.appendChild(fimV);tr.appendChild(fimTd);
  const durTd=document.createElement('td');
  const valTd=document.createElement('td');
  function refreshRow(){
    dowSpan.textContent=getDow(p.data);dowSpan.title=getDowFull(p.data);
    const dd=durFmt(p.ini,p.fim);const dh=durH(p.ini,p.fim);
    const dc=dh>=12?'var(--amber)':dh>=6?'var(--accent)':'var(--text2)';
    durTd.innerHTML=`<span class="cell-ro dur" style="color:${dc}">${dd}</span>`;
    const val=calcValor(p);const past=isPast(p.data,p.fim);
    valTd.innerHTML=`<span class="cell-ro ${past?'val-past':'val-future'}">${val?fmtVal(val):'—'}</span>`;
    refreshMonthTotal(ym);
    
  }
  refreshRow();tr.appendChild(durTd);
  const localTd=document.createElement('td');
  makeCell(localTd,`<span style="white-space:nowrap">${p.local}</span>`,(td,v)=>selectEditor(td,v,cfg.locais,()=>p.local,val=>p.local=val,()=>p.local,undefined,p));
  tr.appendChild(localTd);
  const tipoTd=document.createElement('td');
  makeCell(tipoTd,tipoPill(p.tipo),(td,v)=>selectEditor(td,v,cfg.tipos,()=>p.tipo,val=>{p.tipo=val;refreshRow();},()=>tipoPill(p.tipo),()=>refreshRow(),p));
  tr.appendChild(tipoTd);
  const obsTd=document.createElement('td');
  makeCell(obsTd,`<span class="obs-txt" title="${p.obs||''}">${p.obs||''}</span>`,(td,v)=>textEditor(td,v,()=>p.obs,val=>{p.obs=val;refreshRow();},'text',()=>`<span class="obs-txt" title="${p.obs||''}">${p.obs||''}</span>`,()=>refreshRow(),p));
  tr.appendChild(obsTd);
  tr.appendChild(valTd);
  const stTd=document.createElement('td');
  makeCell(stTd,statusHtml(p.status),(td,v)=>selectEditor(td,v,cfg.statuses,()=>p.status,val=>p.status=val,()=>statusHtml(p.status),undefined,p));
  tr.appendChild(stTd);
  const actTd=document.createElement('td');
  const actDiv=document.createElement('div');actDiv.className='actions-cell';
  const dupBtn=document.createElement('button');dupBtn.className='btn-icon dup';dupBtn.title='Duplicar';
  dupBtn.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
  dupBtn.onclick=()=>{const clone={...p,id:nextId++};clone.status=autoStatus(clone);plantoes.push(clone);plantoes.sort((a,b)=>a.data.localeCompare(b.data)||a.ini.localeCompare(b.ini));savePlantao(clone);render();renderResumo();showToast('Plantão duplicado!');};
  const delBtn=document.createElement('button');delBtn.className='btn-icon';delBtn.title='Remover';
  delBtn.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
  delBtn.onclick=()=>{if(confirm('Remover este plantão?')){const pid=p.id;plantoes=plantoes.filter(x=>x.id!==p.id);removePlantao(pid);render();renderResumo();renderNextShift();showToast('Plantão removido.');}};
  actDiv.appendChild(dupBtn);actDiv.appendChild(delBtn);actTd.appendChild(actDiv);tr.appendChild(actTd);
  tbody.appendChild(tr);
}

function refreshMonthTotal(ym){
  const ref=monthTotalRefs[ym];if(!ref)return;
  const ps=plantoes.filter(p=>getYM(p.data)===ym);
  const hT=ps.reduce((a,p)=>a+durH(p.ini,p.fim),0);
  const vR=ps.filter(p=>isPast(p.data,p.fim)).reduce((a,p)=>a+calcValor(p),0);
  const vP=ps.filter(p=>!isPast(p.data,p.fim)).reduce((a,p)=>a+calcValor(p),0);
  if(ref.hEl)ref.hEl.textContent=hFmt(hT);
  if(ref.vREl)ref.vREl.textContent=vR?fmtVal(vR):'';
  if(ref.vPEl)ref.vPEl.textContent=vP?fmtVal(vP):'';
  updateKpis(getFiltered());
}

function buildQuickRow(ym,tbody){
  const tr=document.createElement('tr');tr.className='quick-add-row';
  const[yr,mo]=ym.split('-').map(Number);
  const lastDay=new Date(yr,mo,0).getDate();const moS=String(mo).padStart(2,'0');
  const trigTd=document.createElement('td');trigTd.setAttribute('colspan','2');
  const trig=document.createElement('div');trig.className='qa-trigger';
  trig.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>Adicionar plantão';
  trigTd.appendChild(trig);tr.appendChild(trigTd);
  // Separate dow td (hidden until open, then shows day of week)
  const dowTd=document.createElement('td');
  const dowSpanQA=document.createElement('span');dowSpanQA.className='cell-ro dow-txt';
  dowTd.appendChild(dowSpanQA);tr.appendChild(dowTd);

  function mkTd(){const td=document.createElement('td');tr.appendChild(td);return td;}
  function mkInp(td,type,ph,step){const i=document.createElement('input');i.type=type;i.className='qa-input';if(ph)i.placeholder=ph;if(step)i.step=step;if(type==='date'){i.min=`${yr}-${moS}-01`;i.max=`${yr}-${moS}-${String(lastDay).padStart(2,'0')}`;}td.appendChild(i);return i;}
  function mkSel(td,opts){const s=document.createElement('select');s.className='qa-select';opts.forEach(o=>{const op=document.createElement('option');op.value=o;op.textContent=o;s.appendChild(op);});td.appendChild(s);return s;}
  const iniTd=mkTd();const fimTd=mkTd();const durTd=mkTd();const localTd=mkTd();const tipoTd=mkTd();const obsTd=mkTd();const valTd=mkTd();const stTd=mkTd();const saveTd=mkTd();
  const iniI=mkInp(iniTd,'time','Início','900');const fimI=mkInp(fimTd,'time','Fim','900');
  const localS=mkSel(localTd,cfg.locais.length?cfg.locais:['PA']);
  const tipoS=mkSel(tipoTd,cfg.tipos.length?cfg.tipos:['Plantão']);
  const obsI=mkInp(obsTd,'text','Observação');
  const stS=mkSel(stTd,cfg.statuses.length?cfg.statuses:['A Realizar','Realizado','NF Emitida','Recebido']);
  function doSave(){
    if(!dataI||!dataI.value||!iniI.value||!fimI.value){showToast('Preencha data, início e fim!');return;}
    const p={id:nextId++,mes:MESES[parseInt(dataI.value.split('-')[1])-1],data:dataI.value,ini:iniI.value,fim:fimI.value,local:localS.value,tipo:tipoS.value,obs:obsI.value.trim(),status:stS.value};
    plantoes.push(p);
    plantoes.sort((a,b)=>a.data.localeCompare(b.data)||a.ini.localeCompare(b.ini));
    savePlantao(p);updateFilterOptions();render();renderResumo();renderNextShift();
    showToast('Plantão adicionado!');
  }
  let open=false;
  let dataI=null;
  function upDur(){const dd=durFmt(iniI.value,fimI.value);durTd.innerHTML=`<span style="padding:7px 9px;display:block;color:var(--text3);font-size:12px;font-family:var(--mono)">${dd!=='0h'?dd:''}</span>`;}
  iniI.oninput=upDur;fimI.oninput=upDur;
  // Quick add: trigger spans both data + dow cols; on open, shrinks to data only
  function autoStatus(){
    if(!dataI||!dataI.value)return;
    const today=new Date();today.setHours(0,0,0,0);
    const d=new Date(dataI.value+'T12:00:00');
    const auto=d<today?'Realizado':'A Realizar';
    stS.value=auto;
  }
  function openQA(){
    if(open)return;open=true;
    trig.style.display='none';
    trigTd.setAttribute('colspan','1');
    dataI=document.createElement('input');dataI.type='date';dataI.className='qa-input';
    dataI.min=`${yr}-${moS}-01`;dataI.max=`${yr}-${moS}-${String(lastDay).padStart(2,'0')}`;
    dataI.onchange=()=>{if(dataI.value){dowSpanQA.textContent=getDow(dataI.value);autoStatus();}};
    trigTd.appendChild(dataI);
    dowSpanQA.style.padding='7px 9px';dowSpanQA.style.display='block';
    [iniTd,fimTd,durTd,localTd,tipoTd,obsTd,valTd,stTd,saveTd].forEach(td=>{td.style.display='';td.style.minWidth='60px';});
    const sb=document.createElement('button');sb.className='btn-icon';sb.style.color='var(--green)';sb.title='Salvar';
    sb.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
    sb.onclick=doSave;obsI.onkeydown=e=>{if(e.key==='Enter')doSave();};saveTd.appendChild(sb);
    setTimeout(()=>dataI.focus(),50);
  }
  function doSave(){
    if(!dataI||!dataI.value||!iniI.value||!fimI.value){showToast('Preencha data, início e fim!');return;}
    const p={id:nextId++,mes:MESES[parseInt(dataI.value.split('-')[1])-1],data:dataI.value,ini:iniI.value,fim:fimI.value,local:localS.value,tipo:tipoS.value,obs:obsI.value.trim(),status:stS.value};
    plantoes.push(p);plantoes.sort((a,b)=>a.data.localeCompare(b.data)||a.ini.localeCompare(b.ini));
    savePlantao(p);updateFilterOptions();render();renderResumo();renderNextShift();
    
    showToast('Plantão adicionado!');
  }
  [iniTd,fimTd,durTd,localTd,tipoTd,obsTd,valTd,stTd,saveTd].forEach(td=>td.style.display='none');
  trig.onclick=openQA;tbody.appendChild(tr);
}

function getFiltered(){
  const fym=document.getElementById('filter-ym').value;
  const ft=document.getElementById('filter-tipo').value;
  const fl=document.getElementById('filter-local').value;
  const fs=document.getElementById('search').value.toLowerCase();
  return plantoes.filter(p=>(!fym||getYM(p.data)===fym)&&(!ft||p.tipo===ft)&&(!fl||p.local===fl)&&(!fs||(p.local+p.obs+p.mes).toLowerCase().includes(fs)));
}

function updateKpis(list){
  const total=list.length;
  const horasD=list.reduce((a,p)=>a+durH(p.ini,p.fim),0);
  const vReal=list.filter(p=>isPast(p.data,p.fim)).reduce((a,p)=>a+calcValor(p),0);
  const vPend=list.filter(p=>!isPast(p.data,p.fim)).reduce((a,p)=>a+calcValor(p),0);
  const yms=[...new Set(list.map(p=>getYM(p.data)).filter(Boolean))].sort();
  document.getElementById('kpi-total').textContent=total;
  document.getElementById('kpi-horas').textContent=hFmt(horasD);
  document.getElementById('kpi-valor-real').textContent=fmtVal(vReal)||'R$ 0';
  document.getElementById('kpi-valor-pend').textContent=fmtVal(vPend)||'R$ 0';
  document.getElementById('topbar-sub').textContent=plantoes.length+' plantões · '+[...new Set(plantoes.map(p=>getYM(p.data)))].length+' períodos';
  function bd(id,rows){const el=document.getElementById(id);if(el)el.innerHTML=rows;}
  bd('kpi-count-bd',yms.map(ym=>{const c=list.filter(p=>getYM(p.data)===ym).length;return`<div class="kpi-bd-row"><span class="kpi-bd-mes">${ymLabel(ym)}</span><span class="kpi-bd-val blue">${c}</span></div>`}).join(''));
  bd('kpi-horas-bd',yms.map(ym=>{const h=list.filter(p=>getYM(p.data)===ym).reduce((a,p)=>a+durH(p.ini,p.fim),0);return`<div class="kpi-bd-row"><span class="kpi-bd-mes">${ymLabel(ym)}</span><span class="kpi-bd-val purple">${hFmt(h)}</span></div>`}).join(''));
  bd('kpi-valor-real-bd',yms.map(ym=>{const vr=list.filter(p=>getYM(p.data)===ym&&isPast(p.data,p.fim)).reduce((a,p)=>a+calcValor(p),0);return`<div class="kpi-bd-row"><span class="kpi-bd-mes">${ymLabel(ym)}</span><span class="kpi-bd-val green">${vr?fmtVal(vr):'—'}</span></div>`}).join(''));
  bd('kpi-valor-pend-bd',yms.map(ym=>{const vp=list.filter(p=>getYM(p.data)===ym&&!isPast(p.data,p.fim)).reduce((a,p)=>a+calcValor(p),0);return`<div class="kpi-bd-row"><span class="kpi-bd-mes">${ymLabel(ym)}</span><span class="kpi-bd-val amber">${vp?fmtVal(vp):'—'}</span></div>`}).join(''));
}

let nextShiftTimer=null;
function renderNextShift(){
  if(nextShiftTimer){clearInterval(nextShiftTimer);nextShiftTimer=null;}
  const el=document.getElementById('next-shift-wrap'); // may be null (removed from plantoes)
  const homeEl=document.getElementById('home-next-shift-wrap');
  const homeUpEl=document.getElementById('home-upcoming-wrap');
  const now=new Date();
  const future=plantoes.filter(p=>p.data&&p.ini).map(p=>{
    const[h,m]=p.ini.split(':').map(Number);
    const dt=new Date(p.data+'T00:00:00');dt.setHours(h,m,0,0);return{p,dt};
  }).filter(x=>x.dt>now).sort((a,b)=>a.dt-b.dt);

  if(!future.length){
    const msg=`<div class="no-future"><svg viewBox="0 0 24 24" fill="currentColor" style="width:15px;height:15px;flex-shrink:0"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>Nenhum plantão futuro cadastrado.</div>`;
    if(el)el.innerHTML=msg;
    if(homeEl)homeEl.innerHTML='';
    if(homeUpEl)homeUpEl.innerHTML='';
    return;
  }

  const{p,dt}=future[0];
  const v=calcValor(p);

  function tick(){
    const diffMs=dt-new Date();
    if(diffMs<=0){renderNextShift();return;}
    const totalMins=Math.floor(diffMs/60000);
    const dias=Math.floor(totalMins/1440);
    const horas=Math.floor((totalMins%1440)/60);
    const mins=totalMins%60;
    const countdownEl=document.getElementById('ns-countdown-inner');
    if(countdownEl){
      if(dias>0){
        countdownEl.innerHTML=`<div class="ns-cd-block"><span class="ns-cd-num">${dias}</span><span class="ns-cd-lbl">dia${dias!==1?'s':''}</span></div><div class="ns-cd-sep">:</div><div class="ns-cd-block"><span class="ns-cd-num">${String(horas).padStart(2,'0')}</span><span class="ns-cd-lbl">h</span></div>`;
      } else {
        countdownEl.innerHTML=`<div class="ns-cd-block"><span class="ns-cd-num">${String(horas).padStart(2,'0')}</span><span class="ns-cd-lbl">h</span></div><div class="ns-cd-sep">:</div><div class="ns-cd-block"><span class="ns-cd-num">${String(mins).padStart(2,'0')}</span><span class="ns-cd-lbl">min</span></div>`;
      }
    }
  }

  const _nsHtml=`<div class="next-shift-red">
    <div class="ns-icon-red"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg></div>
    <div style="flex:1;min-width:0">
      <div class="ns-label-red">Próximo plantão</div>
      <div class="ns-main-line">${fmtData(p.data)} &nbsp;·&nbsp; ${p.ini} → ${p.fim} &nbsp;<span class="ns-local">${p.local}</span></div>
      <div class="ns-detail-line">
        <span>${getDowFull(p.data)}</span>
        <span class="ns-dot-sep">·</span>
        ${tipoPill(p.tipo)}
        <span class="ns-dot-sep">·</span>
        <span>${durFmt(p.ini,p.fim)}</span>
        ${p.obs?`<span class="ns-dot-sep">·</span><span style="color:var(--text3)">${p.obs}</span>`:''}
      </div>
    </div>
    <div class="ns-right">
      <div class="ns-cd-wrap"><div id="ns-countdown-inner" style="display:flex;align-items:center;gap:6px"></div></div>
      ${v?`<div class="ns-val-red"><div class="ns-val-num-red">${fmtVal(v)}</div><div class="ns-val-sub-red">valor estimado</div></div>`:''}
    </div>
  </div>`;
  if(el)el.innerHTML=_nsHtml;
  if(homeEl)homeEl.innerHTML=_nsHtml;
  tick();
  nextShiftTimer=setInterval(tick,60000);

  // Upcoming: next 3 after the first
  const upcoming=future.slice(1,4);
  const upWrap=document.getElementById('upcoming-shifts-wrap'); // may be null
  const upHtml=upcoming.length?`<div class="upcoming-shifts">${upcoming.map(({p:up},i)=>`
    <div class="upcoming-item">
      <span class="upcoming-num">${i+2}</span>
      <span class="upcoming-date">${fmtData(up.data)}</span>
      <span class="upcoming-time">${up.ini}→${up.fim}</span>
      <span class="upcoming-local">${up.local}</span>
      ${tipoPill(up.tipo)}
      <span class="upcoming-dur">${durFmt(up.ini,up.fim)}</span>
    </div>`).join('')}
  </div>`:'';
  if(upWrap)upWrap.innerHTML=upHtml;
  if(homeUpEl)homeUpEl.innerHTML=upHtml;
}

function render(){
  const list=getFiltered();updateKpis(list);renderNextShift();
  const byYM={};list.forEach(p=>{const ym=getYM(p.data);if(ym){if(!byYM[ym])byYM[ym]=[];byYM[ym].push(p);}});
  const ymsDesc=Object.keys(byYM).sort().reverse();
  const el=document.getElementById('list');el.innerHTML='';
  if(!ymsDesc.length){el.innerHTML='<div class="empty"><p>Nenhum plantão encontrado.</p></div>';return;}
  ymsDesc.forEach(ym=>{
    const ps=byYM[ym].sort((a,b)=>{
      let va,vb;
      if(sortCol==='data'){va=a.data;vb=b.data;}
      else if(sortCol==='ini'){va=a.ini;vb=b.ini;}
      else if(sortCol==='dur'){va=durMins(a.ini,a.fim);vb=durMins(b.ini,b.fim);}
      else if(sortCol==='local'){va=a.local;vb=b.local;}
      else if(sortCol==='tipo'){va=a.tipo;vb=b.tipo;}
      else if(sortCol==='valor'){va=calcValor(a);vb=calcValor(b);}
      else if(sortCol==='status'){va=a.status;vb=b.status;}
      else{va=a.data;vb=b.data;}
      if(va<vb)return sortDir==='asc'?-1:1;
      if(va>vb)return sortDir==='asc'?1:-1;
      // Tiebreaker: sort by ini time when primary values are equal
      if(sortCol==='data'||sortCol==='ini'||(va===vb)){
        const ia=a.ini||'';const ib=b.ini||'';
        if(ia<ib)return sortDir==='asc'?-1:1;
        if(ia>ib)return sortDir==='asc'?1:-1;
      }
      return 0;
    });
    const hT=ps.reduce((a,p)=>a+durH(p.ini,p.fim),0);
    const vR=ps.filter(p=>isPast(p.data,p.fim)).reduce((a,p)=>a+calcValor(p),0);
    const vP=ps.filter(p=>!isPast(p.data,p.fim)).reduce((a,p)=>a+calcValor(p),0);
    const nowYM=new Date().toISOString().substring(0,7);
    const isOpen=collapsed[ym]===undefined?(ym===nowYM):collapsed[ym]!==true;
    const sec=document.createElement('div');sec.className='month-section';
    const hdr=document.createElement('div');hdr.className='month-header'+(isOpen?' open':'');
    let pills=`<span class="pill pill-blue">${ps.length===1?'1 plantão':`${ps.length} plantões`}</span><span class="pill pill-purple">${hFmt(hT)}</span>`;
    if(vR)pills+=`<span class="pill pill-green">${fmtVal(vR)} realizado</span>`;
    if(vP)pills+=`<span class="pill pill-amber">${fmtVal(vP)} pendente</span>`;
    hdr.innerHTML=`<div class="month-left"><span class="month-name">${ymLabel(ym)}</span><div class="month-pills">${pills}</div></div><svg class="month-chevron${isOpen?' open':''}" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>`;
    hdr.onclick=()=>{collapsed[ym]=collapsed[ym]!==true;render();};sec.appendChild(hdr);
    if(isOpen){
      const wrap=document.createElement('div');wrap.className='table-wrap';
      const scroll=document.createElement('div');scroll.className='table-scroll';
      const tbl=document.createElement('table');
      tbl.innerHTML=`<colgroup>
        <col style="width:88px"><col style="width:40px"><col style="width:66px"><col style="width:66px">
        <col style="width:56px"><col style="width:130px"><col style="width:70px">
        <col style="width:150px"><col style="width:96px"><col style="width:108px"><col style="width:40px">
      </colgroup>
      <thead><tr>
        <th class="sortable" onclick="setSort('data')">Data</th>
        <th>Dia</th>
        <th class="sortable" onclick="setSort('ini')">Início</th>
        <th>Fim</th>
        <th class="sortable" onclick="setSort('dur')">Dur.</th>
        <th class="sortable" onclick="setSort('local')">Local</th>
        <th class="sortable" onclick="setSort('tipo')">Tipo</th>
        <th>Observação</th>
        <th class="sortable" onclick="setSort('valor')">Valor</th>
        <th class="sortable" onclick="setSort('status')">Status</th>
        <th></th>
      </tr></thead>`;
      // Apply sort indicators
      tbl.querySelectorAll('th.sortable').forEach(th=>{
        th.classList.remove('sort-asc','sort-desc');
        const col=th.getAttribute('onclick').match(/setSort\('(\w+)'\)/)?.[1];
        if(col===sortCol)th.classList.add(sortDir==='asc'?'sort-asc':'sort-desc');
      });
      const tbody=document.createElement('tbody');
      ps.forEach(p=>buildRow(p,tbody,ym));
      const tot=document.createElement('tr');tot.className='total-row';
      const hEl=document.createElement('td');hEl.textContent=hFmt(hT);hEl.style.color='var(--purple)';
      const vREl=document.createElement('span');vREl.style.cssText='color:var(--green);display:block;font-family:var(--mono);font-size:11px;font-weight:500';vREl.textContent=vR?fmtVal(vR):'';
      const vPEl=document.createElement('span');vPEl.style.cssText='color:var(--amber);display:block;font-family:var(--mono);font-size:11px;font-weight:500';vPEl.textContent=vP?fmtVal(vP):'';
      tot.innerHTML=`<td colspan="4" style="text-align:right;color:var(--text3)">Total</td>`;
      tot.appendChild(hEl);
      const e1=document.createElement('td');e1.setAttribute('colspan','2');tot.appendChild(e1);
      const vc=document.createElement('td');const vi=document.createElement('div');vi.style.cssText='display:flex;flex-direction:column;gap:1px;padding:7px 9px';vi.appendChild(vREl);if(vP)vi.appendChild(vPEl);vc.appendChild(vi);tot.appendChild(vc);
      const e2=document.createElement('td');e2.setAttribute('colspan','2');tot.appendChild(e2);
      tbody.appendChild(tot);
      monthTotalRefs[ym]={hEl,vREl,vPEl};
      buildQuickRow(ym,tbody);
      tbl.appendChild(tbody);scroll.appendChild(tbl);wrap.appendChild(scroll);sec.appendChild(wrap);
    }
    el.appendChild(sec);
  });
}

function renderResumo(){
  const yms=[...new Set(plantoes.map(p=>getYM(p.data)).filter(Boolean))].sort();
  const el=document.getElementById('resumo-grid');
  if(!yms.length){el.innerHTML='<div class="empty"><p>Nenhum dado registrado.</p></div>';return;}

  const isSt=(p,s)=>(p.status||'').toLowerCase()===s.toLowerCase();
  const nowYm=`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;

  el.innerHTML=yms.map(ym=>{
    const ps=plantoes.filter(p=>getYM(p.data)===ym);
    const hD   = ps.reduce((a,p)=>a+durH(p.ini,p.fim),0);
    const media = ps.length?hD/ps.length:0;
    const vTot = ps.reduce((a,p)=>a+calcValor(p),0);
    // 4 status groups
    const psAR  = ps.filter(p=>isSt(p,'A Realizar'));
    const psRe  = ps.filter(p=>isSt(p,'Realizado'));
    const psNF  = ps.filter(p=>isSt(p,'NF Emitida'));
    const psPg  = ps.filter(p=>isSt(p,'Recebido'));
    const vAR   = psAR.reduce((a,p)=>a+calcValor(p),0);
    const vRe   = psRe.reduce((a,p)=>a+calcValor(p),0);
    const vNF   = psNF.reduce((a,p)=>a+calcValor(p),0);
    const vPg   = psPg.reduce((a,p)=>a+calcValor(p),0);
    // Color by month state
    let color;
    if(psPg.length>0)        color='#3ecf8e';
    else if(ym===nowYm)      color='#f5a623';
    else if(ym<nowYm)        color='#4f8ef7';
    else                     color='#8892a4';
    // Tipo rows — show ALL tipos so cards align, dash if zero
    const tipoRows=cfg.tipos.map(t=>{
      const count=ps.filter(p=>p.tipo===t).length;
      const c=getTipoColor(t);
      if(!count)return`<div class="resumo-stat"><span class="resumo-stat-label"><span class="tipo" style="background:${c.bg};color:${c.color};border-color:${c.border};font-size:10px;padding:1px 5px">${t}</span></span><span class="resumo-stat-val" style="color:var(--text3)">—</span></div>`;
      return`<div class="resumo-stat"><span class="resumo-stat-label"><span class="tipo" style="background:${c.bg};color:${c.color};border-color:${c.border};font-size:10px;padding:1px 5px">${t}</span></span><span class="resumo-stat-val">${count===1?'1 plantão':`${count} plantões`}</span></div>`;
    }).join('');

    // Always render all 4 status rows so cards align horizontally
    const stRow=(label,count,val,opacity)=>{
      if(!count)return`<div class="resumo-stat"><span class="resumo-stat-label"><span class="resumo-dot" style="background:${color};opacity:${opacity}"></span>${label}</span><span class="resumo-stat-val" style="color:var(--text3)">—</span></div>`;
      return`<div class="resumo-stat"><span class="resumo-stat-label"><span class="resumo-dot" style="background:${color};opacity:${opacity}"></span>${label}</span><span class="resumo-stat-val">${count}× ${val?fmtVal(val):''}</span></div>`;
    };

    // Mini progress bar showing 4 layers proportionally
    const barTotal=vTot||1;
    const w1=100;
    const w2=vRe?Math.round((vRe/barTotal)*100):0;
    const w3=vNF?Math.round(((vNF)/barTotal)*100):0;  // NF cumulative = Re+NF
    const w4=vPg?Math.round((vPg/barTotal)*100):0;
    // Stack: Re+NF+Pg cumulative from bottom
    const cumRe  = Math.round(((vRe+vNF+vPg)/barTotal)*100);
    const cumNF  = Math.round(((vNF+vPg)/barTotal)*100);
    const cumPg  = Math.round((vPg/barTotal)*100);

    return`<div class="resumo-card">
      <div class="resumo-card-header">
        <span class="resumo-card-title">${ymLabel(ym)}</span>
        <span class="resumo-card-count">${ps.length} plantões</span>
      </div>
      <div class="resumo-stat"><span class="resumo-stat-label">Total de horas</span><span class="resumo-stat-val purple">${hFmt(hD)}</span></div>
      <div class="resumo-stat"><span class="resumo-stat-label">Média por plantão</span><span class="resumo-stat-val">${hFmt(media)}</span></div>
      ${tipoRows}
      <div style="border-top:1px solid var(--border);margin:6px 0 2px"></div>
      <div class="resumo-stat"><span class="resumo-stat-label"><span class="resumo-dot" style="background:${color};opacity:.25"></span>Total</span><span class="resumo-stat-val">${ps.length}× ${vTot?fmtVal(vTot):''}</span></div>
      ${stRow('A Realizar', psAR.length, vAR, .25)}
      ${stRow('Realizado',  psRe.length, vRe, .5)}
      ${stRow('NF Emitida', psNF.length, vNF, .75)}
      ${stRow('Recebido',       psPg.length, vPg, 1)}
      <div class="resumo-val-bar" style="margin-top:8px">
        <div class="resumo-val-layer" style="width:${w1}%;background:${color};opacity:.25"></div>
        <div class="resumo-val-layer" style="width:${cumRe}%;background:${color};opacity:.5"></div>
        <div class="resumo-val-layer" style="width:${cumNF}%;background:${color};opacity:.75"></div>
        <div class="resumo-val-layer" style="width:${cumPg}%;background:${color};opacity:1"></div>
      </div>
    </div>`;
  }).join('');
}

function updateFilterOptions(){
  const yms=[...new Set(plantoes.map(p=>getYM(p.data)).filter(Boolean))].sort().reverse();
  const locais=[...new Set(plantoes.map(p=>p.local))].sort();
  const fym=document.getElementById('filter-ym');const cym=fym.value;
  fym.innerHTML='<option value="">Todos os meses</option>'+yms.map(ym=>`<option value="${ym}">${ymLabel(ym)}</option>`).join('');fym.value=cym;
  const ft=document.getElementById('filter-tipo');const ct=ft.value;
  ft.innerHTML='<option value="">Todos os tipos</option>'+cfg.tipos.map(t=>`<option value="${t}">${t}</option>`).join('');ft.value=ct;
  const fl=document.getElementById('filter-local');const cl=fl.value;
  fl.innerHTML='<option value="">Todos os locais</option>'+locais.map(l=>`<option value="${l}">${l}</option>`).join('');fl.value=cl;
}

function populateModalSelects(){
  document.getElementById('f-mes').innerHTML=MESES.map((m,i)=>`<option value="${i}">${m}</option>`).join('');
  document.getElementById('f-local').innerHTML=cfg.locais.map(l=>`<option value="${l}">${l}</option>`).join('');
  document.getElementById('f-tipo').innerHTML=cfg.tipos.map(t=>`<option value="${t}">${t}</option>`).join('');
  document.getElementById('f-status').innerHTML=cfg.statuses.map(s=>`<option value="${s}">${s}</option>`).join('');
}
function openModal(){
  populateModalSelects();
  const t=new Date();const y=t.getFullYear(),m=String(t.getMonth()+1).padStart(2,'0'),d=String(t.getDate()).padStart(2,'0');
  document.getElementById('f-data').value=`${y}-${m}-${d}`;
  document.getElementById('f-mes').value=t.getMonth();
  ['f-ini','f-fim','f-obs'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('preview-box').innerHTML='<span style="color:var(--text3);font-size:12px">Preencha início e fim para ver o resumo</span>';
  syncModalMes();
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(()=>document.getElementById('f-data').focus(),100);
}
function closeModal(){document.getElementById('modal-overlay').classList.remove('open');}
function syncModalMes(){
  const mi=parseInt(document.getElementById('f-mes').value);
  const yr=new Date().getFullYear();const mo=String(mi+1).padStart(2,'0');
  const lastDay=new Date(yr,mi+1,0).getDate();
  const inp=document.getElementById('f-data');
  inp.min=`${yr}-${mo}-01`;inp.max=`${yr}-${mo}-${String(lastDay).padStart(2,'0')}`;
  if(inp.value){const dm=parseInt(inp.value.split('-')[1])-1;if(dm!==mi)inp.value=`${yr}-${mo}-01`;}
  calcModalPreview();
}
function onModalDataChange(){const d=document.getElementById('f-data').value;if(d)document.getElementById('f-mes').value=parseInt(d.split('-')[1])-1;calcModalPreview();}
function calcModalPreview(){
  const ini=document.getElementById('f-ini').value,fim=document.getElementById('f-fim').value;
  const tipo=document.getElementById('f-tipo').value,data=document.getElementById('f-data').value,obs=document.getElementById('f-obs').value;
  const h=durH(ini,fim);const pb=document.getElementById('preview-box');
  if(h){const v=calcValor({tipo,data,obs,ini,fim});const special=isWeekendOrFeriado({tipo,data,obs});pb.innerHTML=`<span class="pv-dur">${durFmt(ini,fim)}</span><span style="color:var(--text3)">·</span><span class="pv-val">${fmtVal(v)}</span><span style="color:var(--text3);font-size:11px">${getDowFull(data)||''}${special?' · taxa especial':''}</span>`;}
  else pb.innerHTML='<span style="color:var(--text3);font-size:12px">Preencha início e fim para ver o resumo</span>';
}
function salvar(){
  const mi=parseInt(document.getElementById('f-mes').value);
  const data=document.getElementById('f-data').value,ini=document.getElementById('f-ini').value,fim=document.getElementById('f-fim').value;
  if(!ini||!fim||!data){showToast('⚠️ Preencha data, início e fim!');return;}
  const novo={id:nextId++,mes:MESES[mi],data,ini,fim,local:document.getElementById('f-local').value,tipo:document.getElementById('f-tipo').value,obs:document.getElementById('f-obs').value.trim(),status:document.getElementById('f-status').value};
  // Override status with auto if not manually set to Pago/NF Emitida
  if(!MANUAL_STATUSES.includes(novo.status))novo.status=autoStatus(novo);
  plantoes.push(novo);
  plantoes.sort((a,b)=>a.data.localeCompare(b.data)||a.ini.localeCompare(b.ini));
  savePlantao(novo);
  closeModal();updateFilterOptions();render();renderResumo();
  
  showToast('Plantão adicionado!');
}

function openSettings(){
  renderRatesTable();renderTagList('tipos');renderTagList('locais');renderTagList('statuses');
  renderThemeSelector();
  document.getElementById('settings-overlay').classList.add('open');
}
function closeSettings(){document.getElementById('settings-overlay').classList.remove('open');}
function renderTagList(key){
  const colorKey=key==='tipos'?'tipoColors':key==='locais'?'localColors':'statusColors';
  if(!cfg[colorKey])cfg[colorKey]={};
  const items=cfg[key];
  document.getElementById('cfg-'+key).innerHTML=items.map((v,i)=>{
    // Get current color: custom > auto palette (only for tipos)
    let currentColor='';
    if(cfg[colorKey][v])currentColor=cfg[colorKey][v];
    else if(key==='tipos'){const idx=items.indexOf(v);currentColor=TIPO_PALETTE[idx%TIPO_PALETTE.length].color;}
    else currentColor='#8892a4';
    return`<span class="tag" style="display:inline-flex;align-items:center;gap:5px">
      <input type="color" value="${currentColor}" title="Cor do ${v}"
        style="width:18px;height:18px;border:none;border-radius:50%;cursor:pointer;padding:0;background:none;flex-shrink:0"
        onchange="setTagColor('${colorKey}','${v.replace(/'/g,"\\'")}',this.value)">
      <span>${v}</span>
      <button class="tag-del" onclick="removeTag('${key}',${i})" title="Remover">×</button>
    </span>`;
  }).join('');
  if(key==='tipos')renderRatesTable();
}
function setTagColor(colorKey,item,color){
  if(!cfg[colorKey])cfg[colorKey]={};
  cfg[colorKey][item]=color;
}
function removeTag(key,i){
  const rm=cfg[key][i];cfg[key].splice(i,1);
  if(key==='tipos'){delete cfg.tipoRates[rm];if(cfg.tipoBonus)delete cfg.tipoBonus[rm];if(cfg.tipoColors)delete cfg.tipoColors[rm];}
  if(key==='locais'&&cfg.localColors)delete cfg.localColors[rm];
  if(key==='statuses'&&cfg.statusColors)delete cfg.statusColors[rm];
  renderTagList(key);
}
function addTag(key,inputId){
  const inp=document.getElementById(inputId);if(!inp)return;
  const v=inp.value.trim();
  if(!v){showToast('Digite um valor antes de adicionar.');return;}
  if(cfg[key].includes(v)){showToast(`"${v}" já existe na lista.`);inp.value='';return;}
  cfg[key].push(v);
  if(key==='tipos'){cfg.tipoRates[v]=90;if(!cfg.tipoBonus)cfg.tipoBonus={};cfg.tipoBonus[v]=0;}
  inp.value='';renderTagList(key);showToast(`"${v}" adicionado!`);
}
function saveSettings(){
  if(!cfg.tipoBonus)cfg.tipoBonus={};
  if(!cfg.tipoColors)cfg.tipoColors={};
  if(!cfg.localColors)cfg.localColors={};
  if(!cfg.statusColors)cfg.statusColors={};
  document.querySelectorAll('#rates-tbody input[data-kind="base"]').forEach(inp=>{const t=inp.getAttribute('data-tipo');if(t)cfg.tipoRates[t]=parseFloat(inp.value)||0;});
  document.querySelectorAll('#rates-tbody input[data-kind="bonus"]').forEach(inp=>{const t=inp.getAttribute('data-tipo');if(t)cfg.tipoBonus[t]=parseFloat(inp.value)||0;});
  cfg.prBonus=Math.max(...Object.values(cfg.tipoBonus),0);
  setSyncStatus('syncing');
  save();closeSettings();updateFilterOptions();render();renderResumo();showToast('✅ Configurações salvas!');
}
function renderRatesTable(){
  const tb=document.getElementById('rates-tbody');tb.innerHTML='';
  if(!cfg.tipoBonus)cfg.tipoBonus={};
  cfg.tipos.forEach(t=>{
    const base=cfg.tipoRates[t]??90;
    const bonus=cfg.tipoBonus[t]??0;
    const c=getTipoColor(t);
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><span class="tipo" style="background:${c.bg};color:${c.color};border-color:${c.border}">${t}</span></td>
      <td><input type="number" min="0" step="1" value="${base}" data-tipo="${t}" data-kind="base" style="width:72px"> R$/h</td>
      <td style="display:flex;align-items:center;gap:6px;padding:6px 6px">
        <input type="number" min="0" step="1" value="${bonus}" data-tipo="${t}" data-kind="bonus" style="width:60px"> R$/h
        <span style="font-size:10px;color:var(--text3)">em fim/feriado</span>
      </td>`;
    tb.appendChild(tr);
  });
}

function showPage(page,el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>{
    if(!n.closest('#plantoes-subnav')&&!n.closest('#fin-subnav')&&!n.closest('#treino-subnav')&&!n.closest('#mat-subnav'))n.classList.remove('active');
  });
  document.getElementById('page-'+page).classList.add('active');
  if(el)el.classList.add('active');
  // Manage plantoes sub-nav
  const plantoesPages=['plantoes','resumo'];
  const plantoesBtn=document.querySelector('.nav-item[onclick*="togglePlantoes"]');
  const plantoesSubnav=document.getElementById('plantoes-subnav');
  if(plantoesPages.includes(page)){
    if(plantoesSubnav)plantoesSubnav.style.display='block';
    if(plantoesBtn)plantoesBtn.classList.add('active');
    document.querySelectorAll('#plantoes-subnav .fin-sub').forEach(b=>b.classList.remove('active'));
    const subBtn=document.querySelector('#plantoes-subnav .fin-sub[onclick*="'+page+'"]');
    if(subBtn)subBtn.classList.add('active');
  } else {
    if(plantoesSubnav)plantoesSubnav.style.display='none';
    if(plantoesBtn)plantoesBtn.classList.remove('active');
  }
  // Manage financas sub-nav
  if(page==='financas'){
    document.getElementById('fin-subnav').style.display='block';
    finSeedGf();finSeedTxs();finRefreshAll();
    if(!finSbLoaded)finLoadSupabase();
  } else {
    document.getElementById('fin-subnav').style.display='none';
  }
  if(page==='resumo'){renderResumo();renderChart();}
  if(page==='inicio'){renderHome();}
  if(page==='calendario'){calYear=new Date().getFullYear();calMonth=new Date().getMonth();calWeekStart=getWeekStart(new Date());renderCalendar();}
    if(page==='tarefas'){renderTarefas();}
  // Treino pages
  if(page==='treino-exercicios'){renderExercicios();}
  if(page==='treino-atual'){renderTreinoAtual();}
  if(page==='treino-registros'){renderTreinoRegistros();}
  if(page==='materiais'){renderMateriais();document.getElementById('mat-subnav').style.display='block';}
  else {
    // Close mat-subnav when leaving materiais (same behaviour as fin-subnav)
    const matSub=document.getElementById('mat-subnav');
    if(matSub)matSub.style.display='none';
    const matBtn=document.querySelector('.nav-item[onclick*="toggleMateriais"]');
    if(matBtn&&page!=='materiais')matBtn.classList.remove('active');
  }
  const treinoPages=['treino-atual','treino-exercicios','treino-registros'];
  const treinoBtn=document.querySelector('.nav-item[onclick*="toggleTreino"]');
  const treinoSubnav=document.getElementById('treino-subnav');
  if(treinoPages.includes(page)){
    if(treinoSubnav)treinoSubnav.style.display='block';
    if(treinoBtn)treinoBtn.classList.add('active');
    document.querySelectorAll('#treino-subnav .fin-sub').forEach(b=>b.classList.remove('active'));
    const subBtn=document.querySelector(`#treino-subnav .fin-sub[onclick*="${page}"]`);
    if(subBtn)subBtn.classList.add('active');
  } else {
    if(treinoSubnav)treinoSubnav.style.display='none';
    if(treinoBtn)treinoBtn.classList.remove('active');
  }
}

