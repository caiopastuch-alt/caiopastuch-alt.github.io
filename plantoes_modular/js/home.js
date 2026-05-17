// ── Bell Widget (vencimentos) ──────────────────────────────────────
function renderBellWidget(upcoming){
  const countEl=document.getElementById('bell-count');
  const listEl=document.getElementById('bell-list');
  if(countEl){
    if(upcoming.length){countEl.style.display='inline-block';countEl.textContent=upcoming.length;}
    else countEl.style.display='none';
  }
  if(listEl){
    if(!upcoming.length){listEl.innerHTML='<div style="padding:14px;font-size:12px;color:var(--text3);font-family:var(--font)">Nenhum vencimento nos próximos 10 dias.</div>';return;}
    listEl.innerHTML=upcoming.map(item=>{
      const isToday=item.daysLeft===0,isTomorrow=item.daysLeft===1;
      const badgeColor=isToday?'var(--red)':isTomorrow?'var(--amber)':'var(--text3)';
      const badgeText=isToday?'Hoje!':isTomorrow?'Amanhã':'dia '+item.venc+' ('+item.daysLeft+'d)';
      return`<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 14px;border-bottom:1px solid var(--border);font-family:var(--font)">
        <div><div style="font-size:12px;color:var(--text)">💳 ${item.name}</div><div style="font-size:10px;color:var(--text3)">${item.cat}</div></div>
        <div style="text-align:right"><div style="font-family:var(--mono);font-size:12px;font-weight:600;color:var(--amber)">${finFmt(item.value)}</div>
          <div style="font-size:11px;font-weight:700;color:${badgeColor};background:${isToday?'rgba(242,95,92,.15)':isTomorrow?'rgba(245,166,35,.12)':'rgba(136,146,164,.08)'};padding:2px 7px;border-radius:8px;margin-top:2px;font-family:var(--mono)">📅 dia ${item.venc} — ${badgeText}</div>
        </div>
      </div>`;
    }).join('');
  }
}
function toggleBell(){
  const dd=document.getElementById('bell-dropdown');
  if(!dd)return;
  const isOpen=dd.style.display!=='none';
  dd.style.display=isOpen?'none':'block';
  if(!isOpen){
    // Recompute on open
    const today2=new Date();today2.setHours(0,0,0,0);
    const all=[...finGF.fixo,...finGF.semifixo,...finGF.variavel].filter(i=>i.venc);
    const up=all.map(item=>{
      let vDate=new Date(today2.getFullYear(),today2.getMonth(),item.venc);
      if(vDate<today2)vDate=new Date(today2.getFullYear(),today2.getMonth()+1,item.venc);
      return{...item,daysLeft:Math.round((vDate-today2)/(1000*60*60*24))};
    }).filter(i=>i.daysLeft<=10).sort((a,b)=>a.daysLeft-b.daysLeft);
    renderBellWidget(up);
    setTimeout(()=>document.addEventListener('click',function closeBell(e){if(!document.getElementById('bell-widget')?.contains(e.target)){dd.style.display='none';document.removeEventListener('click',closeBell);}},10));
  }
}

function renderEventos(){} // events rendered inline in calendar
function goTarefas(){showPage('tarefas',document.querySelector('.nav-item[onclick*=tarefas]'));}
function renderHome(){
  const el=document.getElementById('home-content');if(!el)return;
  try{
    _renderHomeInner(el);
    renderNextShift();
    renderHomeTreino();
  }catch(e){console.error('renderHome error:',e);el.innerHTML='<div style="padding:40px;color:var(--text2);font-family:var(--font)"><p>Erro ao carregar tela inicial.</p><pre style="font-size:11px;color:var(--red)">'+e.message+'</pre></div>';}
}
function renderHomeTreino(){
  const el=document.getElementById('home-treino-wrap');if(!el)return;
  if(!fichas||!fichas.length){el.innerHTML='';return;}
  const inFicha=new Set(fichas.flatMap(f=>f.exerciciosIds||[]));
  const fichaCards=fichas.map(f=>{
    const exs=(f.exerciciosIds||[]).map(id=>exercicios.find(e=>e.id===id)).filter(Boolean);
    const hasColor=f.bgColorHex&&f.bgColorHex!=='#1e2433';
    const cardBg=f.bgColor||'var(--bg2)';
    const borderColor=hasColor?`rgba(${f._rgb||'79,142,247'},.3)`:'var(--border)';
    return`<div onclick="showPage('treino-atual',document.querySelector('#treino-subnav .fin-sub[onclick*=treino-atual]'))"
      style="background:${cardBg};border:1px solid ${borderColor};border-radius:10px;padding:12px 14px;cursor:pointer;transition:opacity .15s"
      onmouseenter="this.style.opacity='.85'" onmouseleave="this.style.opacity='1'">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:13px;font-weight:700;font-family:var(--font)">💪 ${f.nome}</span>
        <span style="font-size:10px;color:var(--text3);font-family:var(--font)">${exs.length} ex.</span>
      </div>
      ${exs.slice(0,5).map(ex=>{
        const gc=GRUPO_COLORS[ex.grupo]||{bg:'var(--bg3)',color:'var(--text2)'};
        return`<div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:11px;color:var(--text);font-family:var(--font);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ex.nome}</span>
          <span style="font-size:10px;font-family:var(--mono);color:var(--text3)">${ex.carga}kg · ${ex.series}×${ex.reps}</span>
        </div>`;
      }).join('')}
      ${exs.length>5?`<div style="font-size:10px;color:var(--text3);font-family:var(--font);padding-top:4px">+${exs.length-5} exercícios</div>`:''}
    </div>`;
  }).join('');
  el.innerHTML=`<div class="home-section-title" style="display:flex;align-items:center;gap:8px">
    Treino atual
    <button onclick="event.stopPropagation();showPage('treino-atual',document.querySelector('#treino-subnav .fin-sub[onclick*=treino-atual]'))"
      style="background:none;border:none;cursor:pointer;font-size:10px;color:var(--accent);font-family:var(--font);padding:0">ver tudo →</button>
  </div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:8px">${fichaCards}</div>`;
}
function _renderHomeInner(el){
  const now=new Date();
  const DAYS=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const MONS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const h=now.getHours();
  const greet=h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';
  const greetEl=document.getElementById('home-greeting');
  if(greetEl)greetEl.textContent=`${greet}${currentUser?', '+currentUser.username.charAt(0).toUpperCase()+currentUser.username.slice(1):''}!`;
  const dateEl=document.getElementById('home-date');
  if(dateEl)dateEl.textContent=`${DAYS[now.getDay()]}, ${now.getDate()} de ${MONS[now.getMonth()]} de ${now.getFullYear()}`;
  const nowYm=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const mesPs=plantoes.filter(p=>getYM(p.data)===nowYm);
  const vMes=mesPs.reduce((a,p)=>a+calcValor(p),0);
  const hMes=mesPs.reduce((a,p)=>a+durH(p.ini,p.fim),0);
  const aRealizar=plantoes.filter(p=>p.status==='A Realizar').length;
  const recebido=plantoes.filter(p=>p.status==='Recebido').reduce((a,p)=>a+calcValor(p),0);
  const upcoming=plantoes.filter(p=>!isPast(p.data,p.fim)).sort((a,b)=>a.data.localeCompare(b.data)||a.ini.localeCompare(b.ini)).slice(0,3);
  const todayStr=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const upcomingEvs=(eventos||[]).filter(ev=>ev.data>=todayStr).sort((a,b)=>a.data.localeCompare(b.data)).slice(0,3);
  const today2=new Date();today2.setHours(0,0,0,0);
  const overdueTarefas=tarefas.filter(t=>!t.done&&t.prazo&&new Date(t.prazo+'T12:00:00')<today2);
  // 5: ALL pending tasks by category, 4 columns
  const _pendByCat=[...categorias].map(cat=>tarefas.filter(t=>!t.done&&t.catId===cat.id).sort((a,b)=>({alta:0,media:1,baixa:2}[a.prio])-({alta:0,media:1,baixa:2}[b.prio]))).flat();
  const _pendNoCat=tarefas.filter(t=>!t.done&&!categorias.find(c=>c.id===t.catId)).sort((a,b)=>({alta:0,media:1,baixa:2}[a.prio])-({alta:0,media:1,baixa:2}[b.prio]));
  const allPendTarefas=[..._pendByCat,..._pendNoCat].filter(t=>!overdueTarefas.includes(t));
  updateTaskBadge();
  const pendHtml=allPendTarefas.length?'<div class="home-section-title">Tarefas</div><div style="display:grid;grid-template-columns:repeat(4,1fr);grid-auto-flow:column;grid-template-rows:repeat('+Math.ceil(allPendTarefas.length/4)+',auto);gap:5px;margin-bottom:16px">'+allPendTarefas.map(tf=>{const cat=categorias.find(c=>c.id===tf.catId);return'<div class="home-task-item" onclick="goTarefas()" style="flex-direction:column;align-items:flex-start;gap:2px;padding:7px 10px"><div style="display:flex;align-items:center;gap:5px;width:100%"><div class="home-task-dot" style="background:'+(cat?cat.cor:'var(--text3)')+';"></div><span class="home-task-label" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">'+tf.titulo+'</span><span class="home-task-prio prio-'+tf.prio+'" style="flex-shrink:0;font-size:9px">'+tf.prio.charAt(0).toUpperCase()+'</span></div><div style="font-size:10px;color:var(--text3);padding-left:12px;font-family:var(--font);opacity:.7">'+(cat?cat.nome:'')+(tf.prazo?' · '+fmtData(tf.prazo):'')+'</div></div>';}).join('')+'</div>':'';
  // Compute vencimentos for bell widget (rendered in topbar)
  const allGfItems=[...finGF.fixo,...finGF.semifixo,...finGF.variavel].filter(i=>i.venc);
  const upcoming10=allGfItems.map(item=>{
    let vDate=new Date(today2.getFullYear(),today2.getMonth(),item.venc);
    if(vDate<today2)vDate=new Date(today2.getFullYear(),today2.getMonth()+1,item.venc);
    const daysLeft=Math.round((vDate-today2)/(1000*60*60*24));
    return{...item,daysLeft};
  }).filter(i=>i.daysLeft<=10).sort((a,b)=>a.daysLeft-b.daysLeft);
  renderBellWidget(upcoming10);
  el.innerHTML=`
    <div class="home-grid">
      <div class="home-card" onclick="showPage('plantoes',document.querySelector('[onclick*=plantoes]'))">
        <div class="home-card-header">
          <div class="home-card-icon" style="background:var(--accent-bg)"><svg viewBox="0 0 24 24" fill="var(--accent)"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg></div>
          <div class="home-card-title">Plantões</div>
        </div>
        <div class="home-card-rows">
          <div class="home-card-row"><span class="home-card-row-label">Este mês</span><span class="home-card-row-val accent">${mesPs.length} plantões · ${hFmt(hMes)}</span></div>
          <div class="home-card-row"><span class="home-card-row-label">A realizar</span><span class="home-card-row-val">${aRealizar}</span></div>
          <div class="home-card-row"><span class="home-card-row-label">Valor do mês</span><span class="home-card-row-val green">${fmtVal(vMes)||'—'}</span></div>
          <div class="home-card-row"><span class="home-card-row-label">Total recebido</span><span class="home-card-row-val green">${fmtVal(recebido)||'—'}</span></div>
        </div>
      </div>
      <div class="home-card" onclick="showPage('calendario',document.querySelector('[onclick*=calendario]'))">
        <div class="home-card-header">
          <div class="home-card-icon" style="background:var(--purple-bg)"><svg viewBox="0 0 24 24" fill="var(--purple)"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg></div>
          <div class="home-card-title">Calendário</div>
        </div>
        <div class="home-card-rows">
          ${upcoming.length?upcoming.map(p=>{const c=getTipoColor(p.tipo);return'<div class="home-card-row"><span class="home-card-row-label">'+fmtData(p.data)+' '+p.ini+'</span><span class="home-card-row-val"><span class="tipo" style="background:'+c.bg+';color:'+c.color+';border-color:'+c.border+';font-size:10px;padding:1px 5px">'+p.tipo+'</span> '+p.local+'</span></div>';}).join(''):'<div class="home-card-row"><span class="home-card-row-label" style="color:var(--text3)">Nenhum plantão próximo</span></div>'}
          ${upcomingEvs.length?upcomingEvs.map(ev=>'<div class="home-card-row"><span class="home-card-row-label">'+fmtData(ev.data)+(ev.hora?' '+ev.hora:'')+'</span><span class="home-card-row-val amber">📅 '+ev.titulo+'</span></div>').join(''):''}
        </div>
      </div>
      <div class="home-card" onclick="showPage('tarefas',document.querySelector('[onclick*=tarefas]'))">
        <div class="home-card-header">
          <div class="home-card-icon" style="background:var(--green-bg)"><svg viewBox="0 0 24 24" fill="var(--green)"><path d="M19 3H14.82C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg></div>
          <div class="home-card-title">Tarefas${overdueTarefas.length?' <span style="color:var(--red);font-size:11px">· '+overdueTarefas.length+' vencida'+(overdueTarefas.length>1?'s':'')+'!</span>':''}</div>
        </div>
        <div class="home-card-rows">
          <div class="home-card-row"><span class="home-card-row-label">Pendentes</span><span class="home-card-row-val">${tarefas.filter(t=>!t.done).length} de ${tarefas.length}</span></div>
          <div class="home-card-row"><span class="home-card-row-label">Alta prioridade</span><span class="home-card-row-val" style="color:var(--red)">${tarefas.filter(t=>!t.done&&t.prio==='alta').length}</span></div>
          ${overdueTarefas.length?'<div class="home-card-row"><span class="home-card-row-label" style="color:var(--red)">⚠ Vencidas</span><span class="home-card-row-val" style="color:var(--red)">'+overdueTarefas.length+'</span></div>':''}
        </div>
      </div>
      <div class="home-card" onclick="showPage('resumo',document.querySelector('[onclick*=resumo]'))">
        <div class="home-card-header">
          <div class="home-card-icon" style="background:var(--amber-bg)"><svg viewBox="0 0 24 24" fill="var(--amber)"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg></div>
          <div class="home-card-title">Resumo mensal</div>
        </div>
        <div class="home-card-rows">
          ${[...new Set(plantoes.map(p=>getYM(p.data)).filter(Boolean))].sort().slice(-3).reverse().map(ym=>{const ps=plantoes.filter(p=>getYM(p.data)===ym);const v=ps.reduce((a,p)=>a+calcValor(p),0);return'<div class="home-card-row"><span class="home-card-row-label">'+ymLabel(ym)+'</span><span class="home-card-row-val">'+ps.length+' plantões'+(v?' · '+fmtVal(v):'')+'</span></div>';}).join('')}
        </div>
      </div>
    </div>
    ${overdueTarefas.length?'<div class="home-section-title" style="color:var(--red)">⚠ Tarefas vencidas</div><div class="home-tasks-preview" style="margin-bottom:16px">'+overdueTarefas.map(tf=>{const cat=categorias.find(c=>c.id===tf.catId);return'<div class="home-task-item" style="border-left:3px solid var(--red)" onclick="goTarefas()"><div class="home-task-dot" style="background:'+(cat?cat.cor:'var(--red)')+'"></div><span class="home-task-label">'+tf.titulo+'</span><span style="font-size:10px;color:var(--red);font-family:var(--mono)">⚠ '+fmtData(tf.prazo)+'</span></div>';}).join('')+'</div>':''}
    <!-- Next shift inline in home -->
    <div id="home-next-shift-wrap" style="margin-bottom:12px"></div>
    <div id="home-upcoming-wrap" style="margin-bottom:16px"></div>
    <div id="home-treino-wrap" style="margin-bottom:16px"></div>
    ${pendHtml}
  `;
}
let calYear=new Date().getFullYear();
let calMonth=new Date().getMonth();
let calView='mes'; // 'mes' | 'semana'
let calWeekStart=null; // Date of Sunday of current week

function setCalView(v){
  calView=v;
  const btnMes=document.getElementById('cal-tab-mes');
  const btnSem=document.getElementById('cal-tab-sem');
  if(btnMes)btnMes.style.cssText='padding:4px 12px;font-size:12px;border-radius:7px;border:none;background:'+(v==='mes'?'var(--accent);color:#fff':'transparent;color:var(--text2)');
  if(btnSem)btnSem.style.cssText='padding:4px 12px;font-size:12px;border-radius:7px;border:none;background:'+(v==='semana'?'var(--accent);color:#fff':'transparent;color:var(--text2)');
  renderCalendar();
}
function calNavToday(){
  calYear=new Date().getFullYear();calMonth=new Date().getMonth();
  calWeekStart=getWeekStart(new Date());
  renderCalendar();
}
function calNav(dir){
  if(calView==='mes'){
    calMonth+=dir;
    if(calMonth<0){calMonth=11;calYear--;}
    if(calMonth>11){calMonth=0;calYear++;}
  } else {
    calWeekStart=calWeekStart||getWeekStart(new Date());
    calWeekStart=new Date(calWeekStart);
    calWeekStart.setDate(calWeekStart.getDate()+dir*7);
  }
  renderCalendar();
}
function getWeekStart(d){
  const s=new Date(d);s.setHours(0,0,0,0);s.setDate(s.getDate()-s.getDay());return s;
}
function renderCalendar(){
  const today=new Date();today.setHours(0,0,0,0);
  if(calView==='mes')renderCalMonth(today);
  else renderCalWeek(today);
}
function openModalForDate(dateStr, iniTime){
  openModal();
  setTimeout(()=>{
    const inp=document.getElementById('f-data');
    if(inp&&dateStr){inp.value=dateStr;onModalDataChange();}
    if(iniTime){
      const iniInp=document.getElementById('f-ini');
      if(iniInp){iniInp.value=iniTime;calcModalPreview();}
    }
  },100);
}

function renderCalMonth(today){
  const titleEl=document.getElementById('cal-title');
  const subEl=document.getElementById('cal-sub');
  if(titleEl)titleEl.textContent=`${MESES[calMonth]} · ${calYear}`;
  if(subEl)subEl.textContent='Visão mensal · clique em um dia para adicionar';
  const el=document.getElementById('cal-grid');if(!el)return;
  const firstDay=new Date(calYear,calMonth,1).getDay();
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const daysInPrev=new Date(calYear,calMonth,0).getDate();
  const ym=`${calYear}-${String(calMonth+1).padStart(2,'0')}`;
  const byDay={};
  // Direct plantoes in this month
  plantoes.filter(p=>p.data&&p.data.startsWith(ym)).forEach(p=>{
    const d=parseInt(p.data.split('-')[2]);
    if(!byDay[d])byDay[d]=[];byDay[d].push(p);
  });
  // Helper: is this plantão overnight (fim < ini)?
  function isOvernight(p){
    if(!p.ini||!p.fim)return false;
    const[ih,im]=p.ini.split(':').map(Number);
    const[fh,fm]=p.fim.split(':').map(Number);
    return(fh*60+fm)<=(ih*60+im);
  }
  // Add overnight plantoes to the NEXT day they bleed into
  plantoes.filter(p=>p.data&&isOvernight(p)).forEach(p=>{
    // Calculate the next calendar day
    const startDate=new Date(p.data+'T12:00:00');
    const nextDate=new Date(startDate);nextDate.setDate(nextDate.getDate()+1);
    const nextYm=`${nextDate.getFullYear()}-${String(nextDate.getMonth()+1).padStart(2,'0')}`;
    if(nextYm!==ym)return; // bleeds into a different month — skip
    const d=nextDate.getDate();
    if(!byDay[d])byDay[d]=[];
    if(!byDay[d].find(x=>x.id===p.id))byDay[d].push({...p,_overflow:true});
  });
  const DOWS=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  let html=DOWS.map(d=>`<div class="cal-dow">${d}</div>`).join('');
  for(let i=firstDay-1;i>=0;i--){
    html+=`<div class="cal-day other-month"><div class="cal-day-num">${daysInPrev-i}</div></div>`;
  }
  for(let d=1;d<=daysInMonth;d++){
    const dt=new Date(calYear,calMonth,d);dt.setHours(0,0,0,0);
    const isToday=dt.getTime()===today.getTime();
    const ps=byDay[d]||[];
    // Sort: overflow (grey/continuation) first, then by ini time
    const sorted=[...ps].sort((a,b)=>{
      if(a._overflow&&!b._overflow)return -1;
      if(!a._overflow&&b._overflow)return 1;
      return a.ini.localeCompare(b.ini);
    });
    const shown=sorted.slice(0,3);const extra=sorted.length-shown.length;
    const dateStr=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const events=shown.map(p=>{
      const c=getTipoColor(p.tipo);
      const dd=durFmt(p.ini,p.fim);
      const dh=durH(p.ini,p.fim);
      const badgeColor=dh>=12?'var(--amber)':'var(--accent)';
      const isOverflow=!!p._overflow;
      const evStyle=isOverflow
        ?`background:var(--bg3);color:var(--text3);border-left:2px solid var(--text3)`
        :`background:${c.bg};color:${c.color};border-left:2px solid ${c.color}`;
      const badgeStyle=isOverflow
        ?`margin-left:auto;background:var(--text3);color:var(--bg);border-radius:3px;padding:0 3px;font-size:9px;flex-shrink:0`
        :`margin-left:auto;background:${badgeColor};color:#fff;border-radius:3px;padding:0 3px;font-size:9px;flex-shrink:0`;
      return`<div class="cal-event" style="${evStyle}"
        title="${isOverflow?'Continuação: ':''}${p.ini}→${p.fim} · ${p.local} · ${dd}"
        onclick="event.stopPropagation();calEditOpen('${p.id}')">
        <span style="overflow:hidden;text-overflow:ellipsis;min-width:0">${isOverflow?'↩ ':''}${p.ini}→${p.fim} ${p.tipo} ${p.local}</span>
        <span style="${badgeStyle}">${dd}</span>
      </div>`;
    }).join('');
    const moreHtml=extra>0?`<div class="cal-more">+${extra} mais</div>`:'';
    const addHtml=`<div class="cal-add cal-add-plantao" onclick="event.stopPropagation();openModalForDate('${dateStr}')">+ plantão</div><div class="cal-add cal-add-evento" onclick="event.stopPropagation();openEventoModal(null,'${dateStr}')">+ evento</div>`;
    // Eventos on this day
    const dayEvs=(eventos||[]).filter(ev=>ev.data===dateStr);
    const evHtml=dayEvs.map(ev=>`<div class="cal-event"
        style="background:rgba(245,166,35,0.12);color:var(--amber);border-left:2px solid var(--amber)"
        title="${ev.hora?ev.hora+' · ':''}${ev.titulo}"
        onclick="event.stopPropagation();openEventoModal(${ev.id})">
        <span style="overflow:hidden;text-overflow:ellipsis;min-width:0">📅 ${ev.hora?ev.hora+' ':''}${ev.titulo}</span>
      </div>`).join('');

    html+=`<div class="cal-day${isToday?' today':''}" onclick="openModalForDate('${dateStr}')">
      <div class="cal-day-num">${d}</div>
      ${events}${moreHtml}${evHtml}${addHtml}
    </div>`;
  }
  const total=firstDay+daysInMonth;const trailing=(7-total%7)%7;
  for(let d=1;d<=trailing;d++){html+=`<div class="cal-day other-month"><div class="cal-day-num">${d}</div></div>`;}
  el.className='cal-grid';el.innerHTML=html;
}

function renderCalWeek(today){
  if(!calWeekStart)calWeekStart=getWeekStart(today);
  const ws=calWeekStart;
  const we=new Date(ws);we.setDate(we.getDate()+6);
  const titleEl=document.getElementById('cal-title');
  const subEl=document.getElementById('cal-sub');
  if(titleEl)titleEl.textContent=`${String(ws.getDate()).padStart(2,'0')}/${String(ws.getMonth()+1).padStart(2,'0')} – ${String(we.getDate()).padStart(2,'0')}/${String(we.getMonth()+1).padStart(2,'0')}/${we.getFullYear()}`;
  if(subEl)subEl.textContent='Visão semanal · clique em uma célula para adicionar';
  const el=document.getElementById('cal-grid');if(!el)return;
  const DOWS=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  // Fix 3: slot ini times for pre-filling modal
  const SLOTS=['01h–07h','07h–13h','13h–19h','19h–01h'];
  const SLOT_INI=['01:00','07:00','13:00','19:00'];
  // Fix 1: Define slot boundaries in minutes from midnight
  // slot 0: 01:00-07:00, slot 1: 07:00-13:00, slot 2: 13:00-19:00, slot 3: 19:00-01:00(+1)
  const SLOT_START=[60,420,780,1140]; // minutes from midnight
  const SLOT_END=[420,780,1140,1500]; // 01:00 next = 1500min for slot 3

  const days=Array.from({length:7},(_,i)=>{const d=new Date(ws);d.setDate(d.getDate()+i);return d;});

  // For each day, get plantoes that occur on that day OR overflow from previous day
  function getPlantoesDoCia(dateStr){
    const direct=plantoes.filter(p=>p.data===dateStr);
    // Overnight from exactly the previous calendar day
    const prev=new Date(dateStr+'T12:00:00');prev.setDate(prev.getDate()-1);
    const prevStr=`${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}-${String(prev.getDate()).padStart(2,'0')}`;
    const overnight=plantoes.filter(p=>{
      if(p.data!==prevStr||!p.ini||!p.fim)return false;
      const[ih,im]=p.ini.split(':').map(Number);
      const[fh,fm]=p.fim.split(':').map(Number);
      return(fh*60+fm)<=(ih*60+im); // fim <= ini means overnight
    });
    return{direct,overnight};
  }

  // Map plantoes to ALL slots they occupy, including cross-day plantoes
  const byDaySlot={};
  days.forEach(d=>{
    const dateStr=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    byDaySlot[dateStr]=[[],[],[],[]];
    const{direct,overnight}=getPlantoesDoCia(dateStr);

    // For direct plantoes: check which slots they overlap within THIS day
    direct.forEach(p=>{
      const[ih,im]=p.ini.split(':').map(Number);
      const[fh,fm]=p.fim.split(':').map(Number);
      let iniMin=ih*60+im;
      let fimMin=fh*60+fm;
      if(fimMin<=iniMin)fimMin+=1440; // overnight
      SLOT_START.forEach((slotS,si)=>{
        const slotE=SLOT_END[si];
        if(iniMin<slotE&&fimMin>slotS)byDaySlot[dateStr][si].push(p);
      });
    });

    // For overnight plantoes from previous day: mark as overflow and add to early slots
    overnight.forEach(p=>{
      const[fh,fm]=p.fim.split(':').map(Number);
      const fimMin=fh*60+fm;
      const overflowP={...p,_overflow:true};
      SLOT_START.forEach((slotS,si)=>{
        const slotE=SLOT_END[si];
        if(0<slotE&&fimMin>slotS)byDaySlot[dateStr][si].push(overflowP);
      });
    });
  });

  let html='<div class="week-grid">';
  html+='<div class="week-header" style="border-bottom:1px solid var(--border);border-right:1px solid var(--border)"></div>';
  days.forEach(d=>{
    const isToday=d.getTime()===today.getTime();
    const dayNumHtml=isToday
      ?`<div class="week-header-date today-num">${d.getDate()}</div>`
      :`<div class="week-header-date" style="margin:2px auto 0;width:32px;height:32px;display:flex;align-items:center;justify-content:center">${d.getDate()}</div>`;
    html+=`<div class="week-header${isToday?' today-col':''}">
      <div class="week-header-dow">${DOWS[d.getDay()]}</div>${dayNumHtml}
    </div>`;
  });
  SLOTS.forEach((slotLabel,si)=>{
    html+=`<div class="week-time-label">${slotLabel}</div>`;
    days.forEach(d=>{
      const dateStr=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const isToday=d.getTime()===today.getTime();
      const ps=(byDaySlot[dateStr]||[[],[],[],[]])[si]||[];
      // Sort: overflow (grey) first, then direct by ini time
      const sorted=[...ps].sort((a,b)=>{
        if(a._overflow&&!b._overflow)return -1;
        if(!a._overflow&&b._overflow)return 1;
        return a.ini.localeCompare(b.ini);
      });
      const events=sorted.map(p=>{
        const isOv=!!p._overflow;
        const c=getTipoColor(p.tipo);
        const dd=durFmt(p.ini,p.fim);
        const dh=durH(p.ini,p.fim);
        const badgeColor=dh>=12?'var(--amber)':'var(--accent)';
        const evStyle=isOv
          ?`background:var(--bg3);color:var(--text3);border-left-color:var(--text3)`
          :`background:${c.bg};color:${c.color};border-left-color:${c.color}`;
        const badgeStyle=isOv
          ?`margin-left:4px;background:var(--text3);color:var(--bg);border-radius:3px;padding:0 3px;font-size:9px`
          :`margin-left:4px;background:${badgeColor};color:#fff;border-radius:3px;padding:0 3px;font-size:9px`;
        return`<div class="week-event" style="${evStyle}"
          onclick="event.stopPropagation();calEditOpen('${p.id}')">
          <span style="font-weight:600">${isOv?'↩ ':''}${p.ini}→${p.fim}</span>
          <span style="${badgeStyle}">${dd}</span>
          <br><span style="font-size:10px;opacity:.8">${p.tipo} · ${p.local}</span>
        </div>`;
      }).join('');
      // Fix 3: pass slot ini time when clicking cell
      const addHtml=`<div class="cal-add cal-add-plantao" onclick="event.stopPropagation();openModalForDate('${dateStr}','${SLOT_INI[si]}')">+ plantão</div><div class="cal-add cal-add-evento" onclick="event.stopPropagation();openEventoModal(null,'${dateStr}')">+ evento</div>`;
      // Eventos on this day (show in first slot only to avoid duplication)
      const evHtml=si===0?(eventos||[]).filter(ev=>ev.data===dateStr).map(ev=>`
        <div class="week-event" style="background:rgba(245,166,35,0.12);color:var(--amber);border-left-color:var(--amber)"
          onclick="event.stopPropagation();openEventoModal(${ev.id})">
          <span style="font-weight:600">${ev.hora||'📅'}</span> ${ev.titulo}
        </div>`).join(''):'';
      html+=`<div class="week-cell${isToday?' today-col':''}" onclick="openModalForDate('${dateStr}','${SLOT_INI[si]}')">${events}${evHtml}${addHtml}</div>`;
    });
  });
  html+='</div>';
  el.className='';el.innerHTML=html;
}

function jumpToPlantao(id){
  // Switch to plantoes page and scroll to that month
  const p=plantoes.find(x=>String(x.id)===String(id));
  if(!p)return;
  const navBtn=document.querySelector('.nav-item[onclick*="plantoes"]');
  if(navBtn)showPage('plantoes',navBtn);
  const ym=getYM(p.data);
  collapsed[ym]=false;
  render();
  setTimeout(()=>{
    const el=document.getElementById('list');
    if(el){const sec=el.querySelector('.month-section');if(sec)sec.scrollIntoView({behavior:'smooth'});}
  },200);
}

