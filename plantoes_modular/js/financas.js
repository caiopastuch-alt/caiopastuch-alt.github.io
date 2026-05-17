// ── Finanças ────────────────────────────────────────────────────────
function finKey(k){return `fin4_u${currentUser?.id||0}_${k}`;}
const _syncDebounceTimers={}; // must be before finS
const finS={
  g:k=>{try{return JSON.parse(localStorage.getItem(finKey(k)));}catch{return null;}},
  s:(k,v)=>{
    localStorage.setItem(finKey(k),JSON.stringify(v));
    // Auto-sync finance data to cloud
    const finCloudKey=k==='txs'?'fin_txs':k==='gf'?'fin_gf':k==='meta'?'fin_meta':k==='saldo'?'fin_meta':k==='rv_overrides'?'fin_rv':null;
    if(finCloudKey){
      if(finCloudKey==='fin_meta'){cloudAutoSave('fin_meta',()=>({meta:finMETA,saldo:finSALDO}));}
      else{cloudAutoSave(finCloudKey,()=>JSON.parse(localStorage.getItem(finKey(k))||'null'));}
    }
  }
};
let finTXS=[]; // loaded in enterApp
let finGF={fixo:[],semifixo:[],variavel:[]}; // loaded in enterApp after currentUser is set
let finMETA=10000; // loaded in enterApp via loadFinLocal()
let finSALDO=0; // loaded in enterApp
let finSbPlantoes=[];
let finSbLoaded=false;
let finSbDb=null;
const finMN=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const finMN_FULL=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const FIN_CAT_DEFAULTS=[
  {id:'fatura',name:'Fatura Nubank',icon:'💳',builtin:true},
  {id:'alimentacao',name:'Alimentação',icon:'🍽',builtin:true},
  {id:'transporte',name:'Transporte / Combustível',icon:'🚗',builtin:true},
  {id:'saude',name:'Saúde / Farmácia',icon:'💊',builtin:true},
  {id:'educacao',name:'Educação / Cursos',icon:'📚',builtin:true},
  {id:'compras',name:'Compras online',icon:'🛍',builtin:true},
  {id:'assinatura',name:'Assinaturas / Serviços',icon:'📱',builtin:true},
  {id:'lazer',name:'Lazer / Viagem',icon:'✈️',builtin:true},
  {id:'moradia',name:'Moradia',icon:'🏠',builtin:true},
  {id:'outros_e',name:'Outros',icon:'📦',builtin:true},
];
function finCatKey(){return `fin4_u${currentUser?.id||0}_cats`;}
function finLoadCats(){
  const saved=JSON.parse(localStorage.getItem(finCatKey())||'null');
  if(saved&&saved.length) return saved;
  return FIN_CAT_DEFAULTS.map(c=>({...c}));
}
function finSaveCats(){localStorage.setItem(finCatKey(),JSON.stringify(finCAT_E));cloudAutoSave('fin_cats',()=>finCAT_E);}
let finCAT_E=FIN_CAT_DEFAULTS.map(c=>({...c})); // reloaded in loadFinLocal
const finGetcat=id=>finCAT_E.find(c=>c.id===id)||{name:id,icon:'📦'};
const finFmt=v=>'R$ '+(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const finFmtK=v=>{const n=v||0;return n>=1000?'R$ '+(n/1000).toFixed(1).replace('.',',')+'k':finFmt(n);};
const finFmtD=d=>{if(!d)return'';const[y,m,dd]=d.split('-');return`${dd}/${m}/${y}`;};

function finDurH(ini,fim){if(!ini||!fim)return 0;const[ih,im]=ini.split(':').map(Number),[fh,fm]=fim.split(':').map(Number);let m=(fh*60+fm)-(ih*60+im);if(m<=0)m+=1440;return m/60;}
function finIsWeekend(p){if(!p.data)return false;const d=new Date(p.data+'T12:00:00').getDay();return d===0||d===6||(p.obs||'').toLowerCase().includes('feriado');}
function finCalcValor(p){const h=finDurH(p.ini,p.fim);if(!h)return 0;const r=cfg.tipoRates[p.tipo]??90;const b=finIsWeekend(p)?(cfg.tipoBonus?.[p.tipo]??0):0;return Math.round(h*(r+b));}

async function finLoadSupabase(){
  if(!db)return;
  finSbDb=db;
  try{
    // Use the currently logged-in user's plantoes, not hardcoded Caio
    const uid=currentUser?.id||1;
    const{data,error}=await finSbDb.from('plantoes').select('*').eq('user_id',uid).order('data');
    if(error)throw error;
    finSbPlantoes=data||[];finSbLoaded=true;
    finRefreshAll();showToast(`✓ ${finSbPlantoes.length} plantões carregados`);
  }catch(e){console.error('finLoadSupabase:',e);showToast('Erro ao carregar dados financeiros.');}
}

function togglePlantoes(btn){
  const subnav=document.getElementById('plantoes-subnav');
  const isOpen=subnav.style.display!=='none';
  const onPlantoesPages=['page-inicio','page-plantoes','page-resumo'].some(id=>document.getElementById(id)?.classList.contains('active'));
  if(isOpen&&onPlantoesPages){
    subnav.style.display='none';
    btn.classList.remove('active');
  } else {
    subnav.style.display='block';
    btn.classList.add('active');
    // Navigate to Plantões subpage by default
    const subBtn=document.querySelector('#plantoes-subnav .fin-sub[onclick*="plantoes"]');
    showPage('plantoes',subBtn);
  }
}
function toggleMateriais(btn){
  const subnav=document.getElementById('mat-subnav');
  const isOpen=subnav.style.display!=='none';
  const isActive=document.getElementById('page-materiais').classList.contains('active');
  if(isOpen&&isActive){
    // Second click = close
    subnav.style.display='none';
    btn.classList.remove('active');
  } else {
    // Close fin-subnav
    const finSub=document.getElementById('fin-subnav');
    if(finSub)finSub.style.display='none';
    showPage('materiais',btn);
    matNavTo('index');
  }
}
function matNavTo(section){
  // Highlight sidebar subnav
  document.querySelectorAll('.fin-sub').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.fin-sub').forEach(b=>{if(b.getAttribute('onclick')&&b.getAttribute('onclick').includes(`'${section}'`))b.classList.add('active');});
  // Show appropriate mat sub-section
  matGoIndex(); // reset to index view
  if(section==='arquivos'){matGoFiles();return;}
  if(section==='index'){matGoIndex();return;}
  // For protocolos, prescricoes, anatomia, exames: filter index by system category
  const categoryMap={
    'protocolos':['Cardiovascular','Respiratório','Neurológico','Infeccioso','Metabólico','Gastrointestinal','Urológico','Hematológico'],
    'prescricoes':['Geral'],
    'anatomia':['Musculoesquelético','Dermatológico','Oftalmológico','Ginecológico'],
    'exames':['Metabólico','Hematológico'],
  };
  // Set a filter hint
  const cats=categoryMap[section];
  if(cats){
    const searchEl=document.getElementById('mat-search');
    if(searchEl){searchEl.value='';} // clear search, show all but visually indicate filter
  }
  // Show topbar sub text
  const subEl=document.getElementById('mat-topbar-sub');
  const labels={'protocolos':'Protocolos clínicos','prescricoes':'Prescrições e drogas','anatomia':'Anatomia e sistemas','exames':'Exames e diagnóstico','index':'Base de conhecimento médico','arquivos':'Arquivos e documentos'};
  if(subEl)subEl.textContent=labels[section]||'Materiais';
}
function toggleFinancas(btn){
  const subnav=document.getElementById('fin-subnav');
  const isOpen=subnav.style.display!=='none';
  if(isOpen&&document.getElementById('page-financas').classList.contains('active')){
    // Already on financas page and open → collapse and go elsewhere
    subnav.style.display='none';
    btn.classList.remove('active');
  } else {
    // Open financas
    showPage('financas',btn);
    finGoTo('gastos');
  }
}
function finGoTo(page,btn){
  finInitModal();
  document.querySelectorAll('.fin-page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.fin-tab').forEach(b=>b.classList.remove('active'));
  const el=document.getElementById('fin-page-'+page);if(el)el.classList.add('active');
  if(btn)btn.classList.add('active');
  else{document.querySelectorAll('.fin-tab').forEach(b=>{if(b.getAttribute('onclick')&&b.getAttribute('onclick').includes(`'${page}'`))b.classList.add('active');});}
  // Also highlight sidebar subnav
  document.querySelectorAll('.fin-sub').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.fin-sub').forEach(b=>{if(b.getAttribute('onclick')&&b.getAttribute('onclick').includes(`'${page}'`))b.classList.add('active');});
  const R={'gastos':finRenderGastos,'anual':finRenderAnual,'receitas':finRenderReceitas,'reserva':finRenderReserva,'impostos':impRender};
  if(R[page])R[page]();
}

function finOpenModal(id){document.getElementById(id).classList.add('open');}
function finCloseModal(id){document.getElementById(id).classList.remove('open');}

function finMonthsInData(){
  const s=new Set([...finTXS.map(t=>t.date?.slice(0,7)),...finSbPlantoes.map(p=>p.data?.slice(0,7))].filter(Boolean));
  return[...s].sort();
}
function finFillMonthSel(id,all=false){
  const sel=document.getElementById(id);if(!sel)return;
  const ms=finMonthsInData();
  sel.innerHTML=(all?'<option value="">Todos os meses</option>':'')+ms.map(m=>{const[y,mo]=m.split('-');return`<option value="${m}">${finMN[+mo-1]} ${y}</option>`;}).join('');
  if(!all&&ms.length)sel.value=ms[ms.length-1];
}
function finCalcMonth(ym){
  // "Recebido" is the current status label (previously "Pago")
  const RECEBIDO_STATUS=['recebido','pago']; // accept both for legacy
  const income=finSbPlantoes.filter(p=>p.data?.slice(0,7)===ym&&RECEBIDO_STATUS.includes((p.status||'').toLowerCase())).reduce((s,p)=>s+finCalcValor(p),0);
  const expense=finTXS.filter(t=>t.date?.slice(0,7)===ym).reduce((s,t)=>s+(t.amount||0),0);
  const gfTotal=['fixo','semifixo','variavel'].reduce((s,t)=>s+finGF[t].reduce((ss,i)=>ss+(i.value||0),0),0);
  const totalExpense=expense; // gastos registrados
  const reserved=Math.min(income,finMETA);
  const available=Math.max(0,income-reserved);
  const remaining=available-totalExpense;
  return{income,expense:totalExpense,gfTotal,reserved,available,remaining};
}

// ── Render: Dashboard ──

// ── Render: Anual ──
let finChart=null;
function finRenderAnual(){
  const RECEBIDO=['recebido','pago'];
  const allYMs=new Set([
    ...finSbPlantoes.map(p=>p.data?.slice(0,7)),
    ...finTXS.map(t=>t.date?.slice(0,7))
  ].filter(Boolean));
  const yms=[...allYMs].sort();
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};

  if(!yms.length){
    const el=document.getElementById('fin-an-table');
    if(el)el.innerHTML='<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3);font-family:var(--font)">Nenhum dado ainda.</td></tr>';
    return;
  }

  const monthData=yms.map(ym=>{
    const income=finSbPlantoes.filter(p=>p.data?.slice(0,7)===ym&&RECEBIDO.includes((p.status||'').toLowerCase())).reduce((s,p)=>s+finCalcValor(p),0);
    const allIncome=finSbPlantoes.filter(p=>p.data?.slice(0,7)===ym).reduce((s,p)=>s+finCalcValor(p),0);
    const expense=finTXS.filter(t=>t.date?.slice(0,7)===ym).reduce((s,t)=>s+(t.amount||0),0);
    const recs=loadRecs().filter(r=>r.date?.slice(0,7)===ym).reduce((s,r)=>s+(r.val||0),0);
    const totalIncome=income+recs;
    const saldo=totalIncome-expense;
    return{ym,income,allIncome,expense,recs,totalIncome,saldo};
  }).filter(d=>d.income>0||d.allIncome>0||d.expense>0);

  if(!monthData.length)return;

  const totInc=monthData.reduce((s,d)=>s+d.totalIncome,0);
  const totExp=monthData.reduce((s,d)=>s+d.expense,0);
  const totSaldo=totInc-totExp;
  const avgInc=totInc/monthData.length;
  const avgExp=totExp/monthData.length;
  const taxaMedia=totInc>0?totExp/totInc*100:0;

  // Update KPIs
  set('fin-an-inc',finFmt(totInc));
  set('fin-an-inc-sub','Média: '+finFmt(avgInc)+'/mês');
  set('fin-an-exp',finFmt(totExp));
  set('fin-an-exp-sub','Média: '+finFmt(avgExp)+'/mês');
  const balEl=document.getElementById('fin-an-bal');
  if(balEl){balEl.textContent=finFmt(totSaldo);balEl.className='kpi-val '+(totSaldo>=0?'green':'red');}
  set('fin-an-avg-inc',finFmt(avgInc));
  set('fin-an-avg-exp',finFmt(avgExp));

  // Line Chart — receita e despesa mês a mês
  const canvas=document.getElementById('fin-c-anual');
  if(canvas){
    if(finChart)finChart.destroy();
    const isLight=document.body.classList.contains('light');
    const textColor=isLight?'#5a6478':'#8892a4';
    const gridColor=isLight?'rgba(0,0,0,.05)':'rgba(255,255,255,.04)';
    const labels=monthData.map(d=>{const[y,mo]=d.ym.split('-');return finMN[+mo-1].slice(0,3)+' '+y.slice(2);});

    // Saldo acumulado progressivo
    let acum=0;
    const saldoAcum=monthData.map(d=>{acum+=d.saldo;return acum;});

    finChart=new Chart(canvas,{
      type:'line',
      data:{
        labels,
        datasets:[
          {label:'Receita',data:monthData.map(d=>d.totalIncome),
            borderColor:'rgba(62,207,142,1)',backgroundColor:'rgba(62,207,142,0.08)',
            borderWidth:2.5,pointRadius:4,pointBackgroundColor:'rgba(62,207,142,1)',
            fill:true,tension:0.3},
          {label:'Despesas',data:monthData.map(d=>d.expense),
            borderColor:'rgba(242,95,92,1)',backgroundColor:'rgba(242,95,92,0.06)',
            borderWidth:2.5,pointRadius:4,pointBackgroundColor:'rgba(242,95,92,1)',
            fill:true,tension:0.3},
          {label:'Saldo acumulado',data:saldoAcum,
            borderColor:'rgba(79,142,247,0.9)',backgroundColor:'transparent',
            borderWidth:2,borderDash:[5,3],pointRadius:3,
            pointBackgroundColor:'rgba(79,142,247,1)',tension:0.3,
            yAxisID:'y2'},
        ]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        interaction:{mode:'index',intersect:false},
        plugins:{
          legend:{labels:{color:textColor,font:{family:'DM Sans',size:11},boxWidth:12}},
          tooltip:{callbacks:{
            label:ctx=>`${ctx.dataset.label}: ${finFmt(ctx.raw||0)}`
          }}
        },
        scales:{
          x:{ticks:{color:textColor,font:{family:'DM Mono',size:10},maxRotation:30},grid:{color:gridColor}},
          y:{position:'left',ticks:{color:textColor,font:{family:'DM Mono',size:10},callback:v=>v>=1000?'R$'+(v/1000).toFixed(0)+'k':'R$'+v},grid:{color:gridColor}},
          y2:{position:'right',ticks:{color:'rgba(79,142,247,0.7)',font:{family:'DM Mono',size:10},callback:v=>v>=1000?'R$'+(v/1000).toFixed(0)+'k':'R$'+v},grid:{display:false}}
        }
      }
    });
  }

  // Analysis section — replaces best/worst/cat cards
  const bestEl=document.getElementById('fin-an-best');
  const worstEl=document.getElementById('fin-an-worst');
  const catEl=document.getElementById('fin-an-cat');

  // Best saldo month
  const best=monthData.reduce((a,b)=>b.saldo>a.saldo?b:a);
  const worst=monthData.reduce((a,b)=>b.saldo<a.saldo?b:a);
  if(bestEl){
    const[y,mo]=best.ym.split('-');
    bestEl.innerHTML=`<div style="font-size:13px;font-weight:700;font-family:var(--mono);color:var(--green)">${finMN[+mo-1]} ${y}</div>
      <div style="font-size:11px;color:var(--text2);font-family:var(--font);margin-top:4px">Receita ${finFmt(best.totalIncome)}</div>
      <div style="font-size:11px;color:var(--text2);font-family:var(--font)">Despesa ${finFmt(best.expense)}</div>
      <div style="font-size:12px;font-weight:700;color:var(--green);font-family:var(--mono);margin-top:3px">Saldo ${finFmt(best.saldo)}</div>`;
  }
  if(worstEl){
    const[y,mo]=worst.ym.split('-');
    worstEl.innerHTML=`<div style="font-size:13px;font-weight:700;font-family:var(--mono);color:var(--red)">${finMN[+mo-1]} ${y}</div>
      <div style="font-size:11px;color:var(--text2);font-family:var(--font);margin-top:4px">Receita ${finFmt(worst.totalIncome)}</div>
      <div style="font-size:11px;color:var(--text2);font-family:var(--font)">Despesa ${finFmt(worst.expense)}</div>
      <div style="font-size:12px;font-weight:700;color:var(--red);font-family:var(--mono);margin-top:3px">Saldo ${finFmt(worst.saldo)}</div>`;
  }

  // Category breakdown
  const byCat={};
  finTXS.forEach(t=>{byCat[t.cat]=(byCat[t.cat]||0)+(t.amount||0);});
  const topCats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,4);
  if(catEl){
    catEl.innerHTML=topCats.length?topCats.map(([cat,val])=>{
      const cc=finGetcat(cat);
      const pct=totExp>0?Math.round(val/totExp*100):0;
      return`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:16px;flex-shrink:0">${cc.icon}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;font-family:var(--font);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${cc.name}</div>
          <div style="height:3px;background:var(--bg4);border-radius:2px;margin-top:3px"><div style="height:100%;width:${pct}%;background:var(--amber);border-radius:2px"></div></div>
        </div>
        <span style="font-family:var(--mono);font-size:11px;font-weight:600;flex-shrink:0">${finFmt(val)}</span>
        <span style="font-size:10px;color:var(--text3);font-family:var(--font);flex-shrink:0">${pct}%</span>
      </div>`;
    }).join(''):'<div style="color:var(--text3);font-family:var(--font);font-size:12px">Nenhuma despesa.</div>';
  }

  // Comprehensive per-month table
  const tb=document.getElementById('fin-an-table');
  if(tb){
    let runSaldo=0;
    tb.innerHTML=monthData.map(d=>{
      const[y,mo]=d.ym.split('-');
      const pct=d.totalIncome>0?Math.round(d.expense/d.totalIncome*100):0;
      const saldoColor=d.saldo>=0?'var(--green)':'var(--red)';
      const pctColor=pct>80?'var(--red)':pct>50?'var(--amber)':'var(--green)';
      runSaldo+=d.saldo;
      return`<tr>
        <td style="font-family:var(--font);font-weight:500">${finMN[+mo-1]} ${y}</td>
        <td style="font-family:var(--mono);color:var(--green)">${finFmt(d.totalIncome)}</td>
        <td style="font-family:var(--mono);color:var(--red)">${finFmt(d.expense)}</td>
        <td style="font-family:var(--mono);color:${saldoColor};font-weight:600">${finFmt(d.saldo)}</td>
        <td style="font-family:var(--mono);color:var(--accent)">${finFmt(runSaldo)}</td>
        <td><div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden">
            <div style="height:100%;width:${Math.min(100,pct)}%;background:${pctColor};border-radius:2px;transition:width .4s"></div>
          </div>
          <span style="font-family:var(--mono);font-size:10px;color:${pctColor};min-width:30px">${pct}%</span>
        </div></td>
      </tr>`;
    }).join('');
  }
}

// ── Render: Receitas ──
// ── Custom Receitas ─────────────────────────────────────────────
function recKey(){return `fin4_recs_u${currentUser?.id||0}`;}
function loadRecs(){return JSON.parse(localStorage.getItem(recKey())||'[]');}
function saveRecs(recs){localStorage.setItem(recKey(),JSON.stringify(recs));cloudAutoSave('fin_recs',()=>recs);}
let _recEditId=null;
function finOpenRecModal(id){
  _recEditId=id||null;
  const recs=loadRecs();const item=id?recs.find(r=>r.id===id):null;
  document.getElementById('fin-rec-modal-title').textContent=id?'Editar receita':'Nova receita';
  document.getElementById('fin-rec-del-btn').style.display=id?'inline-flex':'none';
  document.getElementById('fin-rec-m-desc').value=item?item.desc:'';
  document.getElementById('fin-rec-m-val').value=item?item.val:'';
  document.getElementById('fin-rec-m-date').value=item?item.date:new Date().toISOString().slice(0,10);
  document.getElementById('fin-rec-m-tipo').value=item?item.tipo:'Outros';
  document.getElementById('fin-rec-m-obs').value=item?item.obs:'';
  finOpenModal('fin-modal-rec');
  setTimeout(()=>document.getElementById('fin-rec-m-desc')?.focus(),80);
}
function finSaveRec(){
  const desc=document.getElementById('fin-rec-m-desc').value.trim();
  const val=parseFloat(document.getElementById('fin-rec-m-val').value);
  const date=document.getElementById('fin-rec-m-date').value;
  if(!desc||!val||!date){showToast('Preencha descrição, valor e data.');return;}
  const recs=loadRecs();
  const entry={id:_recEditId||'rec'+Date.now(),desc,val,date,tipo:document.getElementById('fin-rec-m-tipo').value,obs:document.getElementById('fin-rec-m-obs').value.trim()};
  if(_recEditId){const i=recs.findIndex(r=>r.id===_recEditId);if(i>=0)recs[i]=entry;}
  else recs.push(entry);
  saveRecs(recs);finCloseModal('fin-modal-rec');finRenderReceitas();
  showToast(_recEditId?'Receita atualizada!':'Receita adicionada!');
}
function finDeleteRec(){
  if(!_recEditId||!confirm('Remover esta receita?'))return;
  saveRecs(loadRecs().filter(r=>r.id!==_recEditId));
  finCloseModal('fin-modal-rec');finRenderReceitas();showToast('Receita removida.');
}
function finRenderReceitas(){
  const yr=parseInt(document.getElementById('fin-rec-ano')?.value||new Date().getFullYear());
  const RECEBIDO=['recebido','pago'];
  const pls=finSbPlantoes.filter(p=>p.data?.startsWith(String(yr)));
  const pago=pls.filter(p=>RECEBIDO.includes((p.status||'').toLowerCase())).reduce((s,p)=>s+finCalcValor(p),0);
  const pend=pls.filter(p=>!RECEBIDO.includes((p.status||'').toLowerCase())).reduce((s,p)=>s+finCalcValor(p),0);
  const recs=loadRecs().filter(r=>r.date?.startsWith(String(yr)));
  const outrasTotal=recs.reduce((s,r)=>s+(r.val||0),0);
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('fin-rec-anual-pago',finFmt(pago));set('fin-rec-anual-pend',finFmt(pend));
  set('fin-rec-anual-outras',finFmt(outrasTotal));
  set('fin-rec-anual-total',finFmt(pago+outrasTotal));
  set('fin-rec-anual-count','');
  const byMonth={};
  pls.forEach(p=>{
    const ym=p.data.slice(0,7);if(!byMonth[ym])byMonth[ym]={pago:0,pend:0,recs:[],plsCount:0};
    const v=finCalcValor(p);
    if(RECEBIDO.includes((p.status||'').toLowerCase()))byMonth[ym].pago+=v;else byMonth[ym].pend+=v;
    byMonth[ym].plsCount++;
  });
  recs.forEach(r=>{
    const ym=r.date?.slice(0,7);if(!ym)return;
    if(!byMonth[ym])byMonth[ym]={pago:0,pend:0,recs:[],plsCount:0};
    byMonth[ym].recs.push(r);
  });
  const el=document.getElementById('fin-rec-content');if(!el)return;
  if(!Object.keys(byMonth).length){el.innerHTML='<div class="empty">Nenhum dado disponível.</div>';return;}
  el.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">'+
  Object.keys(byMonth).sort().reverse().map(ym=>{
    const[y,mo]=ym.split('-');const d=byMonth[ym];
    const totM=d.pago+d.pend+(d.recs||[]).reduce((s,r)=>s+(r.val||0),0);
    const pgPct=Math.round(totM>0?d.pago/totM*100:0);
    const hasRecs=d.recs&&d.recs.length>0;
    return`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px 16px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px">
        <span style="font-size:14px;font-weight:600;font-family:var(--font)">${finMN[+mo-1]} ${y}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
        <div style="background:rgba(62,207,142,.08);border-radius:var(--radius);padding:8px 10px">
          <div style="font-size:10px;color:var(--green);text-transform:uppercase;letter-spacing:.5px;font-family:var(--font);margin-bottom:2px">Recebido</div>
          <div style="font-family:var(--mono);font-size:14px;font-weight:700;color:var(--green)">${finFmt(d.pago)}</div>
        </div>
        <div style="background:rgba(245,166,35,.08);border-radius:var(--radius);padding:8px 10px">
          <div style="font-size:10px;color:var(--amber);text-transform:uppercase;letter-spacing:.5px;font-family:var(--font);margin-bottom:2px">Pendente</div>
          <div style="font-family:var(--mono);font-size:14px;font-weight:700;color:var(--amber)">${finFmt(d.pend)}</div>
        </div>
      </div>
      ${hasRecs?`<div style="border-top:1px solid var(--border);padding-top:8px;margin-bottom:8px">
        <div style="font-size:10px;font-weight:600;color:var(--accent);text-transform:uppercase;letter-spacing:.5px;font-family:var(--font);margin-bottom:6px">+ Outras receitas</div>
        ${d.recs.map(r=>`<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border)">
          <span style="flex:1;font-size:12px;font-family:var(--font);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.desc}</span>
          <span style="font-size:10px;padding:1px 6px;border-radius:6px;background:rgba(79,142,247,.1);color:var(--accent);font-family:var(--font);flex-shrink:0">${r.tipo}</span>
          <span style="font-family:var(--mono);font-size:12px;color:var(--accent);font-weight:600;flex-shrink:0">${finFmt(r.val)}</span>
          <button onclick="finOpenRecModal('${r.id}')" style="background:none;border:none;cursor:pointer;color:var(--text3)" title="Editar"><svg viewBox="0 0 24 24" fill="currentColor" style="width:11px;height:11px"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/></svg></button>
        </div>`).join('')}
      </div>`:''}
      <div style="height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;margin-bottom:6px">
        <div style="height:100%;width:${pgPct}%;background:var(--green);border-radius:2px;transition:width .4s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);font-family:var(--font)">
        <span>${pgPct}% recebido plantões</span><span>Total: <strong style="font-family:var(--mono)">${finFmt(totM)}</strong></span>
      </div>
    </div>`;
  }).join('')+'</div>';
}

// ── Render: Gastos Fixos ──
let finGfSort='nome';
function finRenderGastos(){
  // Sync sort dropdown
  const sortSel=document.getElementById('fin-gf-sort');
  if(sortSel)finGfSort=sortSel.value||'nome';
  // Sort function for gf items
  function gfSortFn(a,b){
    if(finGfSort==='nome') return a.name.localeCompare(b.name,'pt');
    if(finGfSort==='valor-desc') return (b.value||0)-(a.value||0);
    if(finGfSort==='valor-asc') return (a.value||0)-(b.value||0);
    if(finGfSort==='venc'){
      if(!a.venc&&!b.venc) return 0;
      if(!a.venc) return 1;
      if(!b.venc) return -1;
      return a.venc-b.venc;
    }
    return 0;
  }
  const COLORS={fixo:'var(--red)',semifixo:'var(--amber)',variavel:'var(--purple)'};
  const renderList=(tipo,listId,totalId)=>{
    const items=[...(finGF[tipo]||[])].sort(gfSortFn);
    const total=items.reduce((s,i)=>s+(i.value||0),0);
    const el=document.getElementById(listId);if(!el)return;
    el.innerHTML=items.map(item=>`<div class="gf-item" style="display:flex;align-items:center;gap:8px;padding:7px 8px;border-bottom:1px solid var(--border)">
      <div style="width:6px;height:6px;border-radius:50%;background:${COLORS[tipo]};flex-shrink:0"></div>
      <div style="flex:1;min-width:0">
        <div class="gf-item-name">${item.name}</div>
        <div style="font-size:10px;color:var(--text3);font-family:var(--font)">${item.cat}${item.note?' · '+item.note:''}${item.venc?` · vence dia <strong>${item.venc}</strong>`:''}</div>
      </div>
      <span class="gf-item-val">${finFmt(item.value)}</span>
      <button class="btn-icon edit" onclick="finEditGf('${tipo}','${item.id}')" title="Editar"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
      <button class="btn-icon" onclick="finDeleteGf('${tipo}','${item.id}')" title="Remover"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
    </div>`).join('');
    const tEl=document.getElementById(totalId);if(tEl)tEl.textContent=finFmt(total);
  };
  renderList('fixo','fin-gf-fixo-list','fin-gf-fixo-total');
  renderList('semifixo','fin-gf-semi-list','fin-gf-semi-total');
  renderList('variavel','fin-gf-var-list','fin-gf-var-total');
  // Apply collapsed state directly after render
  ['fixo','semifixo','variavel'].forEach(tipo=>{
    const listId={'fixo':'fin-gf-fixo-list','semifixo':'fin-gf-semi-list','variavel':'fin-gf-var-list'}[tipo];
    const addId={'fixo':'fin-gf-fixo-add','semifixo':'fin-gf-semi-add','variavel':'fin-gf-var-add'}[tipo];
    const collapsed=finGfCollapsed[tipo];
    const list=document.getElementById(listId);
    const add=document.getElementById(addId);
    const chev=document.getElementById('gf-chev-'+tipo);
    if(list){list.style.display=collapsed?'none':'block';list.style.padding=collapsed?'0':'4px 8px';}
    if(add)add.style.display=collapsed?'none':'block';
    if(chev)chev.classList.toggle('open',!collapsed);
  });
  const totalAll=['fixo','semifixo','variavel'].reduce((s,t)=>s+finGF[t].reduce((ss,i)=>ss+(i.value||0),0),0);
  const sumEl=document.getElementById('fin-gf-summary');
  if(sumEl)sumEl.innerHTML=`<div class="gs-item"><div class="gs-label">Fixos</div><div class="gs-val" style="color:var(--red)">${finFmt(finGF.fixo.reduce((s,i)=>s+(i.value||0),0))}</div></div><div style="width:1px;height:34px;background:var(--border2)"></div><div class="gs-item"><div class="gs-label">Total mensal est.</div><div class="gs-val">${finFmt(totalAll)}</div></div>`;
  // Also render editor section
  finFillMonthSel('fin-ed-month',true);
  const filter=document.getElementById('fin-ed-month')?.value||'';
  const txs=finTXS.filter(t=>!filter||t.date?.startsWith(filter)).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const byMonth={};txs.forEach(t=>{const ym=t.date?.slice(0,7)||'';if(!byMonth[ym])byMonth[ym]=[];byMonth[ym].push(t);});
  const edEl=document.getElementById('fin-ed-list');if(!edEl)return;
  if(!txs.length){edEl.innerHTML='<div class="empty">Nenhum lançamento registrado.</div>';return;}
  const months=Object.keys(byMonth).sort(); // ascending: oldest → newest (left → right)
  edEl.innerHTML='<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px">'+
  months.map(ym=>{
    const[y,mo]=ym.split('-');const items=byMonth[ym];const total=items.reduce((s,t)=>s+(t.amount||0),0);
    const faturas=items.filter(t=>t.cat==='fatura');
    const outros=items.filter(t=>t.cat!=='fatura');
    const faturasHtml=faturas.map(t=>{
      const subs=(t.subs||[]);
      return`<tr id="fin-ed-row-${t.id}">
        <td><span class="cell-view" onclick="finEdEdit('${t.id}','desc')">${t.desc}</span></td>
        <td style="white-space:nowrap"><span class="cell-view" onclick="finEdEdit('${t.id}','amount')" style="color:var(--red);font-family:var(--mono);white-space:nowrap">${finFmt(t.amount)}</span></td>
        <td><span class="cell-view" onclick="finEdEdit('${t.id}','date')">${finFmtD(t.date)}</span></td>
        <td><span style="font-size:11px;color:var(--text3);padding:7px 9px;display:block">💳 Nubank</span></td>
        <td style="text-align:center;white-space:nowrap">
          <button class="btn-icon" onclick="finAddNubankSub('${t.id}')" title="+ item" style="color:var(--accent)"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></button>
          <button class="btn-icon" onclick="finDeleteTx('${t.id}')"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
        </td>
      </tr>`+
      (subs.length?subs.map((sub,si)=>`<tr style="background:var(--bg4)">
        <td style="padding-left:22px"><span style="font-size:11px;color:var(--text2);padding:5px 4px;display:block">↳ ${sub.desc}</span></td>
        <td><span style="font-size:11px;color:var(--red);font-family:var(--mono);padding:5px 9px;display:block">${finFmt(sub.amount)}</span></td>
        <td colspan="2"></td>
        <td style="text-align:center"><button class="btn-icon" onclick="finDeleteNubankSub('${t.id}',${si})"><svg viewBox="0 0 24 24" fill="currentColor" style="width:12px;height:12px"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button></td>
      </tr>`).join(''):'');
    }).join('');
    const outrosHtml=outros.map(t=>`<tr id="fin-ed-row-${t.id}">
      <td><span class="cell-view" onclick="finEdEdit('${t.id}','desc')">${t.desc}</span></td>
      <td style="white-space:nowrap"><span class="cell-view" onclick="finEdEdit('${t.id}','amount')" style="color:var(--red);font-family:var(--mono);white-space:nowrap">${finFmt(t.amount)}</span></td>
      <td><span class="cell-view" onclick="finEdEdit('${t.id}','date')">${finFmtD(t.date)}</span></td>
      <td><span class="cell-view" onclick="finEdEdit('${t.id}','cat')">${finGetcat(t.cat).icon} ${finGetcat(t.cat).name}</span></td>
      <td style="text-align:center"><button class="btn-icon" onclick="finDeleteTx('${t.id}')"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></td>
    </tr>`).join('');
    return`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg3);border-bottom:1px solid var(--border)">
        <span style="font-size:13px;font-weight:600;font-family:var(--font)">${finMN[+mo-1]} ${y}</span>
        <span style="font-family:var(--mono);font-size:12px;color:var(--red);font-weight:600">${finFmt(total)}</span>
      </div>
      <div class="table-scroll"><table class="editor-table" style="table-layout:fixed;width:100%"><colgroup><col style="width:35%"><col style="width:18%"><col style="width:16%"><col style="width:22%"><col style="width:9%"></colgroup><thead><tr><th>Descrição</th><th>Valor</th><th>Data</th><th>Categoria</th><th></th></tr></thead><tbody>
      ${faturasHtml}${outrosHtml}
      <tr class="qa-row-trigger"><td colspan="5"><div class="qa-trigger" id="fin-qa-trigger-${ym}" onclick="finEdQaOpenMonth('${ym}')"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>Adicionar linha</div>
      <div id="fin-qa-form-${ym}" style="display:none"><table style="width:100%"><tr>
        <td style="width:35%"><input class="qa-input" id="fin-qa-desc-${ym}" placeholder="Descrição…" onkeydown="finEdQaKey(event,'${ym}')"></td>
        <td style="width:15%"><input class="qa-input" id="fin-qa-amt-${ym}" type="number" placeholder="R$" onkeydown="finEdQaKey(event,'${ym}')"></td>
        <td style="width:18%"><input class="qa-input" id="fin-qa-date-${ym}" type="date" onkeydown="finEdQaKey(event,'${ym}')"></td>
        <td><select class="qa-select" id="fin-qa-cat-${ym}">${finCAT_E.map(cc=>`<option value="${cc.id}">${cc.icon} ${cc.name}</option>`).join('')}</select></td>
        <td style="width:80px;padding:4px"><button class="btn btn-ghost btn-sm" onclick="finEdQaSave('${ym}')">Salvar</button></td>
      </tr></table></div></td></tr>
      </tbody></table></div></div>`;
  }).join('')+'</div>';
}
// Keep backward compat aliases
function finRenderGastosFixos(){finRenderGastos();}
function finRenderEditor(){finRenderGastos();}

const finGfCollapsed={fixo:true,semifixo:true,variavel:true};
function toggleGfSection(tipo){
  finGfCollapsed[tipo]=!finGfCollapsed[tipo];
  const list=document.getElementById('fin-gf-'+({'fixo':'fixo','semifixo':'semi','variavel':'var'}[tipo])+'-list');
  const add=document.getElementById('fin-gf-'+({'fixo':'fixo','semifixo':'semi','variavel':'var'}[tipo])+'-add');
  const chev=document.getElementById('gf-chev-'+tipo);
  const collapsed=finGfCollapsed[tipo];
  if(list){list.style.display=collapsed?'none':'block';list.style.padding=collapsed?'0':'4px 8px';}
  if(add)add.style.display=collapsed?'none':'block';
  if(chev)chev.classList.toggle('open',!collapsed);
}

// ── GF Modal functions ─────────────────────────────────────────────
let _finGfEditId=null;
function finOpenGfModal(tipo,id){
  document.getElementById('fin-gf-m-tipo').value=tipo;
  document.getElementById('fin-gf-m-id').value=id||'';
  _finGfEditId=id||null;
  const isEdit=!!id;
  const item=isEdit?finGF[tipo]?.find(i=>i.id===id):null;
  document.getElementById('fin-gf-m-title').textContent=isEdit?'Editar gasto':'Novo gasto '+tipo;
  document.getElementById('fin-gf-m-name').value=item?item.name:'';
  document.getElementById('fin-gf-m-val').value=item?item.value:'';
  document.getElementById('fin-gf-m-venc').value=item&&item.venc?item.venc:'';
  document.getElementById('fin-gf-m-note').value=item?item.note:'';
  document.getElementById('fin-gf-m-cat').value=item?item.cat:'Outros';
  const delBtn=document.getElementById('fin-gf-del-btn');
  if(delBtn)delBtn.style.display=isEdit?'inline-flex':'none';
  finOpenModal('fin-modal-gf');
  setTimeout(()=>document.getElementById('fin-gf-m-name')?.focus(),80);
}
function finEditGf(tipo,id){finOpenGfModal(tipo,id);}
function finSaveGf(){
  const tipo=document.getElementById('fin-gf-m-tipo').value;
  const id=document.getElementById('fin-gf-m-id').value;
  const name=document.getElementById('fin-gf-m-name').value.trim();
  const value=parseFloat(document.getElementById('fin-gf-m-val').value);
  if(!name||!value){showToast('Preencha nome e valor.');return;}
  const cat=document.getElementById('fin-gf-m-cat').value;
  const note=document.getElementById('fin-gf-m-note').value.trim();
  const venc=parseInt(document.getElementById('fin-gf-m-venc')?.value)||null;
  if(id){
    const item=finGF[tipo]?.find(i=>i.id===id);
    if(item){item.name=name;item.value=value;item.cat=cat;item.note=note;item.venc=venc;}
    finS.s('gf',finGF);finCloseModal('fin-modal-gf');finRenderGastos();showToast('Gasto atualizado!');
  }else{
    finGF[tipo].push({id:'gf'+Date.now(),name,value,cat,note,venc});
    finS.s('gf',finGF);finCloseModal('fin-modal-gf');finRenderGastos();showToast('Gasto adicionado!');
  }
}
function finDeleteGf(tipo,id){
  if(!confirm('Remover?'))return;
  finGF[tipo]=finGF[tipo].filter(i=>i.id!==id);
  finS.s('gf',finGF);finRenderGastos();
}
function finDeleteGfFromModal(){
  const tipo=document.getElementById('fin-gf-m-tipo').value;
  const id=document.getElementById('fin-gf-m-id').value;
  if(!id||!confirm('Remover?'))return;
  finGF[tipo]=finGF[tipo].filter(i=>i.id!==id);
  finS.s('gf',finGF);finCloseModal('fin-modal-gf');finRenderGastos();showToast('Removido.');
}

// 9: Add nubank sub-item
function finAddNubankSub(txId){
  const desc=prompt('Descrição do item:');if(!desc)return;
  const amount=parseFloat(prompt('Valor (R$):'));if(!amount||isNaN(amount))return;
  const t=finTXS.find(x=>String(x.id)===String(txId));if(!t)return;
  if(!t.subs)t.subs=[];
  t.subs.push({desc,amount});
  finS.s('txs',finTXS);finRenderEditor();showToast('Item adicionado!');
}
function finDeleteNubankSub(txId,idx){
  const t=finTXS.find(x=>String(x.id)===String(txId));if(!t||!t.subs)return;
  t.subs.splice(idx,1);finS.s('txs',finTXS);finRenderEditor();
}
function finEdEdit(id,field){
  const t=finTXS.find(x=>String(x.id)===String(id));if(!t)return;
  const row=document.getElementById('fin-ed-row-'+id);if(!row)return;
  const fi={desc:0,amount:1,date:2,cat:3};
  const td=row.cells[fi[field]];if(!td)return;
  const origHTML=td.innerHTML;let input;
  if(field==='cat'){input=document.createElement('select');input.className='cell-select';input.innerHTML=finCAT_E.map(c=>`<option value="${c.id}"${c.id===t.cat?' selected':''}>${c.icon} ${c.name}</option>`).join('');}
  else{input=document.createElement('input');input.className='cell-input';if(field==='amount'){input.type='number';input.step='0.01';input.value=t.amount;}else if(field==='date'){input.type='date';input.value=t.date;}else{input.type='text';input.value=t.desc;}}
  const wrap=document.createElement('div');wrap.className='cell-edit-wrap';wrap.appendChild(input);td.innerHTML='';td.style.position='relative';td.appendChild(wrap);
  input.focus();if(input.select)input.select();
  finEdActive={id,field,td,origHTML};
  const save=()=>{if(field==='amount'){const v=parseFloat(input.value);if(!isNaN(v)&&v>0)t.amount=v;}else if(field==='date'){if(input.value)t.date=input.value;}else if(field==='cat'){t.cat=input.value;}else{if(input.value.trim())t.desc=input.value.trim();}finS.s('txs',finTXS);finEdActive=null;finRenderEditor();showToast('Salvo ✓');};
  input.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();save();}if(e.key==='Escape'){td.innerHTML=origHTML;finEdActive=null;}});
  input.addEventListener('blur',()=>setTimeout(()=>{if(finEdActive&&String(finEdActive.id)===String(id)&&finEdActive.field===field)save();},120));
}
function finDeleteTx(id){if(!confirm('Remover este gasto?'))return;finTXS=finTXS.filter(t=>String(t.id)!==String(id));finS.s('txs',finTXS);finRenderEditor();}
function finOpenNewTx(){
  // Pre-fill date with today
  const today=new Date().toISOString().slice(0,10);
  const dateEl=document.getElementById('fin-f-date');
  if(dateEl)dateEl.value=today;
  const descEl=document.getElementById('fin-f-desc');
  if(descEl)descEl.value='';
  const amtEl=document.getElementById('fin-f-amt');
  if(amtEl)amtEl.value='';
  finInitModal();
  finOpenModal('fin-modal-add');
  setTimeout(()=>document.getElementById('fin-f-desc')?.focus(),80);
}
function finEdQaOpen(){
  const ym=document.getElementById('fin-ed-month')?.value||new Date().toISOString().slice(0,7);
  // Ensure the gastos page is rendered first
  finRenderGastos();
  // Then open the quick-add for that month
  setTimeout(()=>finEdQaOpenMonth(ym),50);
}
function finEdQaOpenMonth(m){
  const f=document.getElementById('fin-qa-form-'+m);
  if(!f){finRenderGastos();setTimeout(()=>finEdQaOpenMonth(m),120);return;}
  f.style.display='';
  const trig=document.getElementById('fin-qa-trigger-'+m);
  if(trig)trig.style.display='none';
  const d=document.getElementById('fin-qa-date-'+m);
  if(d&&!d.value)d.value=m+'-01';
  document.getElementById('fin-qa-desc-'+m)?.focus();
}
function finEdQaKey(e,m){if(e.key==='Enter')finEdQaSave(m);if(e.key==='Escape'){const f=document.getElementById('fin-qa-form-'+m);if(f)f.style.display='none';const t=document.getElementById('fin-qa-trigger-'+m);if(t)t.style.display='';}}
function finEdQaSave(m){const desc=document.getElementById('fin-qa-desc-'+m)?.value.trim();const amt=parseFloat(document.getElementById('fin-qa-amt-'+m)?.value);const date=document.getElementById('fin-qa-date-'+m)?.value||m+'-01';const cat=document.getElementById('fin-qa-cat-'+m)?.value||'outros_e';if(!desc||!amt||isNaN(amt)){showToast('Preencha descrição e valor.');return;}finTXS.push({id:Date.now()+Math.random(),desc,amount:amt,date,cat,note:'',type:'expense'});finS.s('txs',finTXS);finRenderEditor();showToast('Adicionado ✓');}

function finSaveTx(){
  const desc=document.getElementById('fin-f-desc')?.value.trim();
  const amt=parseFloat(document.getElementById('fin-f-amt')?.value);
  const date=document.getElementById('fin-f-date')?.value;
  const cat=document.getElementById('fin-f-cat')?.value||'outros_e';
  const note=document.getElementById('fin-f-note')?.value.trim();
  if(!desc||!amt){showToast('Preencha descrição e valor.');return;}
  finTXS.push({id:Date.now(),desc,amount:amt,date,cat,note,type:'expense'});
  finS.s('txs',finTXS);
  finCloseModal('fin-modal-add');
  // Clear month filter so the new entry's month is visible
  const sel=document.getElementById('fin-ed-month');
  if(sel)sel.value='';
  finRenderGastos();
  // Scroll to the lançamentos section
  setTimeout(()=>{
    const edList=document.getElementById('fin-ed-list');
    if(edList)edList.scrollIntoView({behavior:'smooth',block:'start'});
  },150);
  showToast('Lançamento adicionado!');
}
function finImportFatura(){const m=document.getElementById('fin-fat-m')?.value;const y=document.getElementById('fin-fat-y')?.value;const v=parseFloat(document.getElementById('fin-fat-v')?.value);const n=document.getElementById('fin-fat-n')?.value.trim();if(!v){showToast('Informe o valor da fatura.');return;}const mm=String(m).padStart(2,'0');finTXS.push({id:Date.now(),desc:`Fatura Nubank ${finMN[+m-1]}/${y}`,amount:v,date:`${y}-${mm}-23`,cat:'fatura',note:n||'Importada',type:'expense'});finS.s('txs',finTXS);finCloseModal('fin-modal-fatura');finRenderEditor();showToast('Fatura importada!');}

// ── Reserva ──
function finRenderReserva(){
  document.getElementById('fin-rv-meta').textContent=finFmt(finMETA);
  document.getElementById('fin-rv-saldo').textContent=finFmt(finSALDO);
  const ms=finMonthsInData();const totalCalc=ms.reduce((s,m)=>s+finCalcMonth(m).reserved,0);
  document.getElementById('fin-rv-calc').textContent=finFmt(totalCalc);
  // Load per-month overrides
  const overrides=finS.g('rv_overrides')||{};
  const el=document.getElementById('fin-rv-months');if(!el)return;
  if(!ms.length){el.innerHTML='<div class="empty">Nenhum dado ainda.</div>';return;}
  el.innerHTML=ms.slice().reverse().map(m=>{
    const[y,mo]=m.split('-');const d=finCalcMonth(m);
    const ovr=overrides[m];
    const effReserved=ovr!=null?ovr:d.reserved;
    const pct=finMETA>0?Math.min(100,Math.round(effReserved/finMETA*100)):0;
    return`<div data-rv-ym="${m}" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px 18px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:13px;font-weight:600;font-family:var(--font)">${finMN[+mo-1]} ${y}</span>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:11px;color:var(--text3);font-family:var(--font)">Reservado:</span>
          <input type="number" step="100" value="${effReserved}"
            style="width:90px;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);color:var(--amber);font-family:var(--mono);font-size:13px;font-weight:600;padding:3px 8px;text-align:right"
            onchange="finSetReservaOverride('${m}',this.value)">
          <span class="rv-pct" style="font-size:11px;color:var(--text3);font-family:var(--font)">/ ${finFmt(finMETA)} (${pct}%)</span>
          <button onclick="finDeleteReservaMes('${m}')" style="background:none;border:none;cursor:pointer;color:var(--text3);padding:2px;border-radius:4px" title="Excluir mês"><svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
        </div>
      </div>
      <div style="height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;margin-bottom:6px"><div class="rv-bar" style="height:100%;border-radius:3px;background:${pct>=100?'var(--green)':'var(--amber)'};width:${pct}%;transition:width .4s"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);font-family:var(--font)"><span>Receita: ${finFmt(d.income)} · Gasto: ${finFmt(d.expense)}</span><span class="rv-pill pill ${pct>=100?'pill-green':'pill-amber'}">${pct>=100?'✅ Meta atingida':'⚠️ Parcial'}</span></div>
    </div>`;
  }).join('');
}
function finDeleteReservaMes(ym){
  if(!confirm(`Excluir o mês ${ym} da reserva? Isso remove os dados de gastos registrados neste mês.`))return;
  finTXS=finTXS.filter(t=>!t.date?.startsWith(ym));
  finS.s('txs',finTXS);
  const overrides=finS.g('rv_overrides')||{};
  delete overrides[ym];
  finS.s('rv_overrides',overrides);
  finRenderReserva();showToast('Mês removido.');
}
function finSetReservaOverride(ym,val){
  const overrides=finS.g('rv_overrides')||{};
  overrides[ym]=parseFloat(val)||0;
  finS.s('rv_overrides',overrides);
  // Update bar immediately without full re-render
  const pct=finMETA>0?Math.min(100,Math.round((parseFloat(val)||0)/finMETA*100)):0;
  const card=document.querySelector(`[data-rv-ym="${ym}"]`);
  if(card){
    const bar=card.querySelector('.rv-bar');
    const pctEl=card.querySelector('.rv-pct');
    const pill=card.querySelector('.rv-pill');
    if(bar)bar.style.width=pct+'%';
    if(bar)bar.style.background=pct>=100?'var(--green)':'var(--amber)';
    if(pctEl)pctEl.textContent='/ '+finFmt(finMETA)+' ('+pct+'%)';
    if(pill){pill.textContent=pct>=100?'✅ Meta atingida':'⚠️ Parcial';pill.className='pill '+(pct>=100?'pill-green':'pill-amber');}
  }
  showToast('Reserva atualizada!');
}
function finSaveMeta(){const v=parseFloat(document.getElementById('fin-meta-v')?.value);if(!v){showToast('Informe o valor.');return;}finMETA=v;finS.s('meta',finMETA);finCloseModal('fin-modal-meta');finRenderReserva();showToast('Meta salva!');}
function finSaveSaldo(){const v=parseFloat(document.getElementById('fin-saldo-v')?.value)||0;finSALDO=v;finS.s('saldo',finSALDO);finCloseModal('fin-modal-saldo');finRenderReserva();showToast('Saldo salvo!');}

// ── Impostos Simples Nacional ────────────────────────────────────
const IMP_KEY=()=>`imp_cfg_u${currentUser?.id||0}`;
let impCfg={
  faturamento12:0,   // receita bruta acumulada 12 meses (RBT12)
  faturamentoMes:0,  // receita bruta do mês atual
  prolabore_pct:28,  // % do faturamento como pró-labore
  anexo:'3',         // Anexo 3 ou 5
  inss_socio_pct:11, // alíquota INSS sócio (sobre pró-labore)
};
// Tabelas Simples Nacional 2024
const IMP_ANEXO3=[
  {ate:180000,   aliq:6.0,  deduz:0},
  {ate:360000,   aliq:11.2, deduz:9360},
  {ate:720000,   aliq:13.5, deduz:17640},
  {ate:1800000,  aliq:16.0, deduz:35640},
  {ate:3600000,  aliq:21.0, deduz:125640},
  {ate:4800000,  aliq:33.0, deduz:648000},
];
const IMP_ANEXO5=[
  {ate:180000,   aliq:15.5, deduz:0},
  {ate:360000,   aliq:18.0, deduz:4500},
  {ate:720000,   aliq:19.5, deduz:9900},
  {ate:1800000,  aliq:20.5, deduz:17100},
  {ate:3600000,  aliq:23.0, deduz:62100},
  {ate:4800000,  aliq:30.5, deduz:540000},
];
// CPP (Contribuição Patronal) está embutida no Simples — Anexo 3 inclui CPP
// No Anexo 5, se Fator R >= 28%, aplica-se Anexo 3 (mais favorável)
function impFatorR(prolabore_val, rbt12){return rbt12>0?prolabore_val/rbt12:0;}
function impAliquotaEfetiva(rbt12, tabela){
  if(rbt12<=0)return 0;
  const faixa=tabela.find(f=>rbt12<=f.ate)||tabela[tabela.length-1];
  return((rbt12*faixa.aliq/100)-faixa.deduz)/rbt12;
}
function impCalcDAS(rbt12, faturamentoMes, tabela){
  const aliqEf=impAliquotaEfetiva(rbt12,tabela);
  return faturamentoMes*aliqEf;
}

function impLoadCfg(){try{const s=localStorage.getItem(IMP_KEY());if(s)Object.assign(impCfg,JSON.parse(s));}catch(e){}}
function impSaveCfg(){localStorage.setItem(IMP_KEY(),JSON.stringify(impCfg));}

// Tooltip CSS injected once
function impInjectTooltipStyle(){
  if(document.getElementById('imp-tooltip-style'))return;
  const s=document.createElement('style');s.id='imp-tooltip-style';
  s.textContent=`.imp-tt{position:relative;display:inline-flex;align-items:center;gap:4px;cursor:help}
.imp-tt .imp-tip{visibility:hidden;opacity:0;position:absolute;left:50%;transform:translateX(-50%);bottom:calc(100% + 8px);
  background:#1e2533;color:#e0e6f0;font-family:var(--font);font-size:11px;line-height:1.6;
  border-radius:8px;padding:10px 14px;width:280px;box-shadow:0 4px 20px rgba(0,0,0,.4);
  border:1px solid rgba(255,255,255,.08);z-index:9999;white-space:normal;text-align:left;
  transition:opacity .15s,visibility .15s;pointer-events:none}
.imp-tt:hover .imp-tip{visibility:visible;opacity:1}
.imp-tt-icon{width:14px;height:14px;border-radius:50%;background:rgba(79,142,247,.2);color:var(--accent);
  display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0}`;
  document.head.appendChild(s);
}

function impTT(label, tip, color){
  return`<span class="imp-tt">
    <span style="font-size:10px;color:var(--text3);font-family:var(--font);text-transform:uppercase;letter-spacing:.4px">${label}</span>
    <span class="imp-tt-icon">?</span>
    <span class="imp-tip">${tip}</span>
  </span>`;
}

// ── Impostos — helpers ──────────────────────────────────────────
function impGetFaturamentoByMonth(){
  // Statuses considerados como faturamento realizado/emitido
  const FATURADO_STATUS=['nf emitida','recebido'];
  const byMonth={};
  plantoes.forEach(p=>{
    const st=(p.status||'').toLowerCase().trim();
    if(!FATURADO_STATUS.includes(st))return;
    const ym=getYM(p.data);
    if(!ym)return;
    if(!byMonth[ym])byMonth[ym]={fat:0,plantoes:[]};
    byMonth[ym].fat+=calcValor(p);
    byMonth[ym].plantoes.push(p);
  });
  return byMonth;
}

function impCalcRBT12(byMonth, upToYM){
  // Soma os 12 meses anteriores a upToYM (exclusive)
  const all=Object.keys(byMonth).sort();
  const idx=all.indexOf(upToYM);
  const window12=idx<0?all:all.slice(Math.max(0,idx-12),idx);
  return window12.reduce((s,ym)=>s+(byMonth[ym]?.fat||0),0);
}

function impCalcMes(fat, rbt12, pl_pct, inss_pct, anexo){
  const TETO_INSS=908.86;
  const SALARIO_MIN=1518.00; // Salário mínimo 2025
  // Pró-labore mínimo = salário mínimo; pró-labore calculado = % do faturamento
  const prolabore_calc=fat*pl_pct/100;
  const prolabore=Math.max(prolabore_calc, SALARIO_MIN);
  const inss_socio=Math.min(prolabore*inss_pct/100, TETO_INSS*inss_pct/100);
  // Fator R: usa pró-labore acumulado (simplificado: pró-labore mensal × % / RBT12)
  const fatorR=rbt12>0?prolabore/rbt12:0;

  // Tabela efetiva
  let tabela,tabelaNome,migrou=false;
  if(anexo==='5'&&fatorR>=0.28){tabela=IMP_ANEXO3;tabelaNome='Anexo 3 (via Fator R)';migrou=true;}
  else if(anexo==='5'){tabela=IMP_ANEXO5;tabelaNome='Anexo 5';}
  else{tabela=IMP_ANEXO3;tabelaNome='Anexo 3';}

  const aliqEf=impAliquotaEfetiva(rbt12||fat,tabela);
  const das=fat*aliqEf;

  // Distribuição real do DAS Anexo 3 (baseada no DAS real de abril/2026)
  // IRPJ 25%, CSLL 15%, COFINS 14.07%, PIS 3.05%, CPP 28.85%, ISS 14.03%
  const pct_irpj=0.25,pct_csll=0.15,pct_cof=0.1407,pct_pis=0.0305,pct_cpp=0.2885;
  const das_irpj=das*pct_irpj,das_csll=das*pct_csll,das_cofins=das*pct_cof,das_pis=das*pct_pis;
  const das_cpp=das*pct_cpp,das_iss=das*(1-pct_irpj-pct_csll-pct_cof-pct_pis-pct_cpp);

  // IRPF tabela progressiva 2025
  const base_irpf=prolabore-inss_socio;
  let irpf=0,faixa_irpf='Isento';
  if(base_irpf>4664.68){irpf=Math.max(0,base_irpf*0.275-896.00);faixa_irpf='27,5%';}
  else if(base_irpf>3751.05){irpf=Math.max(0,base_irpf*0.225-662.77);faixa_irpf='22,5%';}
  else if(base_irpf>2826.65){irpf=Math.max(0,base_irpf*0.15-381.44);faixa_irpf='15%';}
  else if(base_irpf>2259.20){irpf=Math.max(0,base_irpf*0.075-169.44);faixa_irpf='7,5%';}

  const total=das+inss_socio+irpf;
  const lucro_dist=Math.max(0,fat-prolabore-das);
  const liquido=fat-total;
  const pl_minimo=prolabore_calc<SALARIO_MIN; // flag: pró-labore foi elevado ao mínimo

  return{fat,rbt12,prolabore,prolabore_calc,pl_minimo,inss_socio,das,das_irpj,das_csll,das_cofins,das_pis,das_cpp,das_iss,irpf,total,lucro_dist,liquido,fatorR,aliqEf,tabelaNome,migrou,faixa_irpf,base_irpf,SALARIO_MIN};
}

function impRender(){
  impLoadCfg();
  impInjectTooltipStyle();
  const el=document.getElementById('imp-content');if(!el)return;

  // Detectar meses com faturamento dos plantões
  const byMonth=impGetFaturamentoByMonth();
  const mesesComFat=Object.keys(byMonth).sort().reverse();
  const temHistorico=mesesComFat.length>0;

  // Faturamento acumulado 12 meses (para RBT12 manual)
  const totalAcum=Object.values(byMonth).reduce((s,m)=>s+m.fat,0);

  el.innerHTML=`
  <!-- Banner -->
  <div style="background:rgba(79,142,247,.06);border:1px solid rgba(79,142,247,.18);border-radius:var(--radius-lg);padding:12px 16px;margin-bottom:16px;font-size:12px;font-family:var(--font);color:var(--text2);line-height:1.6">
    <strong style="color:var(--accent)">👤 Caio Santos Pastuch Serviços Médicos LTDA — Sócio único</strong><br>
    Todos os impostos incidem sobre você diretamente: o DAS e a CPP são da <em>empresa</em>, o INSS-1099 e o IRPF são <em>seus como pessoa física</em>.
    O histórico abaixo é calculado automaticamente a partir dos plantões com status <strong>NF Emitida</strong> ou <strong>Recebido</strong>.
    Passe o mouse sobre <span style="background:rgba(79,142,247,.2);color:var(--accent);border-radius:3px;padding:0 4px;font-size:10px;font-weight:700">?</span> para entender cada imposto.
  </div>

  <!-- Tabs -->
  <div style="display:flex;gap:4px;margin-bottom:20px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:5px;font-family:var(--font)">
    <button id="imp-tab-hist" onclick="impShowTab('hist')" class="fin-tab active" style="flex:1">📅 Histórico mensal</button>
    <button id="imp-tab-calc" onclick="impShowTab('calc')" class="fin-tab" style="flex:1">🧮 Calculadora</button>
    <button id="imp-tab-otim" onclick="impShowTab('otim')" class="fin-tab" style="flex:1">💡 Otimizar</button>
  </div>

  <!-- HISTÓRICO -->
  <div id="imp-panel-hist">
    ${temHistorico?`
    <!-- Config fixa do histórico -->
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:12px 16px">
      <span style="font-size:12px;font-weight:600;font-family:var(--font);color:var(--text3)">Parâmetros fixos:</span>
      <label style="font-size:12px;font-family:var(--font);color:var(--text2);display:flex;align-items:center;gap:6px">
        Pró-labore
        <input type="number" id="imp-h-pl" value="${impCfg.prolabore_pct}" min="0" max="100" step="1"
          onchange="impRenderHistorico()"
          style="width:56px;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);color:var(--text);font-family:var(--mono);font-size:13px;padding:4px 6px;outline:none">%
      </label>
      <label style="font-size:12px;font-family:var(--font);color:var(--text2);display:flex;align-items:center;gap:6px">
        INSS
        <input type="number" id="imp-h-inss" value="${impCfg.inss_socio_pct}" min="0" max="14" step="0.5"
          onchange="impRenderHistorico()"
          style="width:48px;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);color:var(--text);font-family:var(--mono);font-size:13px;padding:4px 6px;outline:none">%
      </label>
      <label style="font-size:12px;font-family:var(--font);color:var(--text2);display:flex;align-items:center;gap:6px">
        Anexo
        <select id="imp-h-anexo" onchange="impRenderHistorico()"
          style="background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);color:var(--text);font-family:var(--font);font-size:12px;padding:4px 6px;outline:none">
          <option value="3" ${impCfg.anexo==='3'?'selected':''}>3</option>
          <option value="5" ${impCfg.anexo==='5'?'selected':''}>5</option>
        </select>
      </label>
      <span style="font-size:11px;color:var(--text3);font-family:var(--font);margin-left:auto">${mesesComFat.length} mês(es) · RBT12 acumulado: <strong>${fmtVal(totalAcum)}</strong></span>
    </div>
    <div id="imp-hist-content"></div>`
    :`<div style="text-align:center;padding:40px;color:var(--text3);font-family:var(--font)">
      <div style="font-size:36px;margin-bottom:12px">📭</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:6px">Nenhum plantão faturado ainda</div>
      <div style="font-size:12px">Marque plantões como <strong>NF Emitida</strong> ou <strong>Recebido</strong> para ver o histórico tributário automaticamente.</div>
    </div>`}
  </div>

  <!-- CALCULADORA -->
  <div id="imp-panel-calc" style="display:none">
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-bottom:20px">
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px 20px">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);font-family:var(--font);margin-bottom:14px">Dados para cálculo</div>
        <div style="margin-bottom:12px">
          <label style="font-family:var(--font);font-size:12px;color:var(--text3);display:block;margin-bottom:4px">RBT12 — Receita Bruta 12 meses (R$)</label>
          <input type="number" id="imp-rbt12" value="${impCfg.faturamento12||totalAcum}" placeholder="ex: 30000"
            style="width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);color:var(--text);font-family:var(--font);font-size:14px;padding:8px 10px;outline:none;box-sizing:border-box">
          <div style="font-size:10px;color:var(--text3);font-family:var(--font);margin-top:3px">Soma dos últimos 12 meses · Calculado dos plantões: <strong>${fmtVal(totalAcum)}</strong></div>
        </div>
        <div style="margin-bottom:12px">
          <label style="font-family:var(--font);font-size:12px;color:var(--text3);display:block;margin-bottom:4px">Faturamento deste mês (R$)</label>
          <input type="number" id="imp-mes" value="${impCfg.faturamentoMes}" placeholder="ex: 13900"
            style="width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);color:var(--text);font-family:var(--font);font-size:14px;padding:8px 10px;outline:none;box-sizing:border-box">
        </div>
        <div style="margin-bottom:12px">
          <label style="font-family:var(--font);font-size:12px;color:var(--text3);display:block;margin-bottom:4px">Pró-labore (% do faturamento)</label>
          <div style="display:flex;align-items:center;gap:8px">
            <input type="range" id="imp-pl-range" min="0" max="100" step="1" value="${impCfg.prolabore_pct}"
              oninput="document.getElementById('imp-pl-val').textContent=this.value+'%';impCfg.prolabore_pct=+this.value;"
              style="flex:1">
            <span id="imp-pl-val" style="font-size:16px;font-weight:700;font-family:var(--mono);min-width:44px;color:var(--accent)">${impCfg.prolabore_pct}%</span>
          </div>
          <div style="font-size:10px;color:var(--text3);font-family:var(--font);margin-top:3px">Valor retirado como pró-labore (sobre o qual incidem INSS e IRPF). Restante = lucro isento de IR.</div>
        </div>
        <div style="margin-bottom:12px">
          <label style="font-family:var(--font);font-size:12px;color:var(--text3);display:block;margin-bottom:4px">INSS sobre pró-labore (%)</label>
          <input type="number" id="imp-inss" value="${impCfg.inss_socio_pct}" min="0" max="14"
            style="width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);color:var(--text);font-family:var(--font);font-size:14px;padding:8px 10px;outline:none;box-sizing:border-box">
          <div style="font-size:10px;color:var(--text3);font-family:var(--font);margin-top:3px">11% (contribuinte individual) · Teto: R$ 908,86/mês</div>
        </div>
        <div>
          <label style="font-family:var(--font);font-size:12px;color:var(--text3);display:block;margin-bottom:4px">Anexo do Simples Nacional</label>
          <select id="imp-anexo"
            style="width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);color:var(--text);font-family:var(--font);font-size:13px;padding:8px 10px;outline:none">
            <option value="3" ${impCfg.anexo==='3'?'selected':''}>Anexo 3 — CPP embutida · Fator R automático</option>
            <option value="5" ${impCfg.anexo==='5'?'selected':''}>Anexo 5 — CPP separada · migra p/ Anexo 3 se Fator R ≥ 28%</option>
          </select>
        </div>
      </div>
      <div id="imp-resultado" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px 20px">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);font-family:var(--font);margin-bottom:14px">Resultado</div>
        <div style="color:var(--text3);font-family:var(--font);font-size:13px;padding:30px 0;text-align:center">Preencha os dados e clique em <strong>Calcular</strong></div>
      </div>
    </div>
    <details style="margin-bottom:8px">
      <summary style="cursor:pointer;font-size:12px;font-weight:600;font-family:var(--font);color:var(--text3);padding:8px 0;user-select:none">📊 Tabelas de referência — Simples Nacional 2024</summary>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
        ${impRenderTabela('Anexo 3',IMP_ANEXO3)}
        ${impRenderTabela('Anexo 5',IMP_ANEXO5)}
      </div>
    </details>
  </div>

  <!-- OTIMIZAÇÃO -->
  <div id="imp-panel-otim" style="display:none">
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px 20px;margin-bottom:16px">
      <div style="font-size:12px;font-weight:600;font-family:var(--font);color:var(--text3);margin-bottom:12px">Configure os parâmetros e clique em Otimizar:</div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <label style="font-size:12px;font-family:var(--font);color:var(--text2);display:flex;align-items:center;gap:6px">RBT12 <input type="number" id="imp-o-rbt12" value="${impCfg.faturamento12||totalAcum}" style="width:90px;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);color:var(--text);font-family:var(--mono);font-size:13px;padding:5px 8px;outline:none"></label>
        <label style="font-size:12px;font-family:var(--font);color:var(--text2);display:flex;align-items:center;gap:6px">Faturamento mês <input type="number" id="imp-o-mes" value="${impCfg.faturamentoMes}" style="width:90px;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);color:var(--text);font-family:var(--mono);font-size:13px;padding:5px 8px;outline:none"></label>
        <label style="font-size:12px;font-family:var(--font);color:var(--text2);display:flex;align-items:center;gap:6px">INSS % <input type="number" id="imp-o-inss" value="${impCfg.inss_socio_pct}" min="0" max="14" style="width:52px;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);color:var(--text);font-family:var(--mono);font-size:13px;padding:5px 8px;outline:none"></label>
        <label style="font-size:12px;font-family:var(--font);color:var(--text2);display:flex;align-items:center;gap:6px">Pró-labore atual % <input type="number" id="imp-o-pl" value="${impCfg.prolabore_pct}" min="0" max="100" style="width:52px;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);color:var(--text);font-family:var(--mono);font-size:13px;padding:5px 8px;outline:none"></label>
      </div>
    </div>
    <div id="imp-otimo" style="display:none"></div>
  </div>`;

  // Render histórico automático se houver dados
  if(temHistorico) setTimeout(()=>impRenderHistorico(),0);
}

function impShowTab(tab){
  ['hist','calc','otim'].forEach(t=>{
    document.getElementById(`imp-panel-${t}`).style.display=t===tab?'block':'none';
    document.getElementById(`imp-tab-${t}`)?.classList.toggle('active',t===tab);
  });
}

function impRenderHistorico(){
  const el=document.getElementById('imp-hist-content');if(!el)return;
  const pl_pct=+document.getElementById('imp-h-pl')?.value||impCfg.prolabore_pct;
  const inss_pct=+document.getElementById('imp-h-inss')?.value||impCfg.inss_socio_pct;
  const anexo=document.getElementById('imp-h-anexo')?.value||impCfg.anexo;

  // Salvar configs
  impCfg.prolabore_pct=pl_pct;impCfg.inss_socio_pct=inss_pct;impCfg.anexo=anexo;impSaveCfg();

  const byMonth=impGetFaturamentoByMonth();
  const meses=Object.keys(byMonth).sort().reverse();
  if(!meses.length){el.innerHTML='';return;}

  // Totais acumulados para sumário
  let totFat=0,totDAS=0,totINSS=0,totIRPF=0,totTotal=0,totLiquido=0;

  const rows=meses.map(ym=>{
    const fat=byMonth[ym].fat;
    const rbt12=impCalcRBT12(byMonth,ym);
    const r=impCalcMes(fat,rbt12,pl_pct,inss_pct,anexo);
    totFat+=fat;totDAS+=r.das;totINSS+=r.inss_socio;totIRPF+=r.irpf;totTotal+=r.total;totLiquido+=r.liquido;

    const badge=(txt,color)=>`<span style="font-size:10px;background:${color}22;color:${color};border-radius:3px;padding:1px 5px;font-family:var(--mono);font-weight:600">${txt}</span>`;
    const cargaPct=(r.total/fat*100).toFixed(1);

    return`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);margin-bottom:10px;overflow:hidden">
      <!-- Header do mês -->
      <div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.querySelector('.imp-chev').style.transform=this.nextElementSibling.style.display==='none'?'rotate(-90deg)':'rotate(0deg)'"
        style="display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;user-select:none;flex-wrap:wrap">
        <span style="font-size:13px;font-weight:700;font-family:var(--font);min-width:130px">${ymLabel(ym)}</span>
        <span style="font-size:12px;color:var(--text3);font-family:var(--font)">${byMonth[ym].plantoes.length} plantão(ões)</span>
        ${badge(r.tabelaNome,'#4f8ef7')}
        ${r.migrou?badge('Fator R ≥ 28%','#22c55e'):''}
        ${r.pl_minimo?badge('PL ajustado p/ salário mín.','#f59e0b'):''}
        <div style="margin-left:auto;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <span style="font-size:11px;color:var(--text3);font-family:var(--font)">Fat. <strong>${fmtVal(fat)}</strong></span>
          <span style="font-size:11px;color:var(--red);font-family:var(--font)">Impostos <strong>${fmtVal(r.total)}</strong></span>
          <span style="font-size:11px;color:var(--green);font-family:var(--font)">Líquido <strong>${fmtVal(r.liquido)}</strong></span>
          <span style="font-size:11px;font-family:var(--mono);color:var(--text3)">${cargaPct}% carga</span>
        </div>
        <svg class="imp-chev" viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px;color:var(--text3);transition:transform .2s;flex-shrink:0"><path d="M7 10l5 5 5-5z"/></svg>
      </div>
      <!-- Detalhe expansível -->
      <div style="display:none;border-top:1px solid var(--border);padding:16px">
        <!-- Fluxo de caixa -->
        <div style="background:var(--bg3);border-radius:var(--radius);padding:12px 14px;margin-bottom:14px;font-size:12px;font-family:var(--font)">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);margin-bottom:8px">Fluxo de caixa</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--text3)">Faturamento bruto</span><span style="font-weight:600">${fmtVal(fat)}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--text3)">Pró-labore ${r.pl_minimo?`(mín. R$ ${r.SALARIO_MIN.toFixed(2)})`:(`(${pl_pct}%)`)}</span><span style="color:var(--accent)">${fmtVal(r.prolabore)}${r.pl_minimo?` <span style="font-size:10px;color:#f59e0b">↑ salário mín.</span>`:''}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--text3)">Lucro distribuível (isento IR)</span><span style="color:var(--green)">${fmtVal(r.lucro_dist)}</span></div>
          <div style="height:1px;background:var(--border);margin:6px 0"></div>
          <div style="display:flex;justify-content:space-between"><span style="font-weight:600">Líquido após impostos</span><span style="font-weight:700;color:var(--green)">${fmtVal(r.liquido)}</span></div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <!-- DAS -->
          <div style="background:var(--bg3);border-radius:var(--radius);padding:12px 14px;border-left:3px solid var(--red)">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--red);margin-bottom:8px">
              <span class="imp-tt">DAS — Simples Nacional <span class="imp-tt-icon">?</span>
                <span class="imp-tip">Imposto único da empresa, reúne 6 tributos. Pago pela PJ até dia 20.<br>Alíquota efetiva: ${(r.aliqEf*100).toFixed(2)}% · Tabela: ${r.tabelaNome}<br>Fator R: ${(r.fatorR*100).toFixed(1)}%</span>
              </span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;font-family:var(--font);margin-bottom:3px"><span style="color:var(--text3)">IRPJ</span><span>${fmtVal(r.das_irpj)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:11px;font-family:var(--font);margin-bottom:3px"><span style="color:var(--text3)">CSLL</span><span>${fmtVal(r.das_csll)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:11px;font-family:var(--font);margin-bottom:3px"><span style="color:var(--text3)">COFINS</span><span>${fmtVal(r.das_cofins)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:11px;font-family:var(--font);margin-bottom:3px"><span style="color:var(--text3)">PIS</span><span>${fmtVal(r.das_pis)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:11px;font-family:var(--font);margin-bottom:3px"><span style="color:var(--text3)">CPP (INSS empresa)</span><span>${fmtVal(r.das_cpp)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:11px;font-family:var(--font);margin-bottom:6px"><span style="color:var(--text3)">ISS</span><span>${fmtVal(r.das_iss)}</span></div>
            <div style="height:1px;background:var(--border);margin-bottom:6px"></div>
            <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;font-family:var(--mono)"><span style="color:var(--red)">DAS Total</span><span style="color:var(--red)">${fmtVal(r.das)}</span></div>
          </div>
          <!-- Pessoal -->
          <div style="background:var(--bg3);border-radius:var(--radius);padding:12px 14px;border-left:3px solid var(--amber)">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--amber);margin-bottom:8px">Encargos pessoais (você)</div>
            <div style="font-size:11px;font-family:var(--font);margin-bottom:6px">
              <span class="imp-tt" style="color:var(--text3)">INSS-1099 (DARF) <span class="imp-tt-icon">?</span>
                <span class="imp-tip">Contribuição previdenciária do sócio como pessoa física (código 1099).<br>11% sobre pró-labore de ${fmtVal(r.prolabore)}, limitado ao teto de R$ 908,86.<br>Conta para aposentadoria e benefícios.</span>
              </span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;font-family:var(--font);margin-bottom:8px"><span style="color:var(--text3)">${inss_pct}% s/ ${fmtVal(r.prolabore)}</span><span style="font-weight:600">${fmtVal(r.inss_socio)}</span></div>
            <div style="font-size:11px;font-family:var(--font);margin-bottom:6px">
              <span class="imp-tt" style="color:var(--text3)">IRPF sobre pró-labore <span class="imp-tt-icon">?</span>
                <span class="imp-tip">Imposto de renda pessoal sobre o pró-labore. Tabela progressiva 2024.<br>Base: ${fmtVal(r.base_irpf)} (pró-labore − INSS)<br>Faixa: ${r.faixa_irpf}<br>Lucro distribuído (${fmtVal(r.lucro_dist)}) é totalmente isento de IRPF.</span>
              </span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;font-family:var(--font);margin-bottom:6px"><span style="color:var(--text3)">Faixa ${r.faixa_irpf} s/ ${fmtVal(r.base_irpf)}</span><span style="font-weight:600;color:${r.irpf>0?'var(--red)':'var(--green)'}">${r.irpf>0?fmtVal(r.irpf):'Isento'}</span></div>
            <div style="height:1px;background:var(--border);margin-bottom:6px"></div>
            <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;font-family:var(--mono)"><span style="color:var(--amber)">Pessoal</span><span style="color:var(--amber)">${fmtVal(r.inss_socio+r.irpf)}</span></div>
          </div>
        </div>

        <!-- Total do mês -->
        <div style="background:var(--bg2);border:2px solid var(--red);border-radius:var(--radius);padding:12px 16px;margin-top:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div style="font-family:var(--font)">
            <div style="font-size:12px;font-weight:700">Total que você paga em ${ymLabel(ym)}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">DAS ${fmtVal(r.das)} + INSS ${fmtVal(r.inss_socio)} + IRPF ${fmtVal(r.irpf)} · Carga: ${cargaPct}%</div>
          </div>
          <span style="font-size:20px;font-weight:700;font-family:var(--mono);color:var(--red)">${fmtVal(r.total)}</span>
        </div>

        <!-- Plantões do mês -->
        <details style="margin-top:10px">
          <summary style="cursor:pointer;font-size:11px;color:var(--text3);font-family:var(--font);user-select:none">Ver plantões computados (${byMonth[ym].plantoes.length})</summary>
          <div style="margin-top:6px;font-size:11px;font-family:var(--font)">
            ${byMonth[ym].plantoes.map(p=>`<div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid var(--border)">
              <span style="color:var(--text3);min-width:80px">${p.data}</span>
              <span style="color:var(--text2);flex:1">${p.local}</span>
              <span style="color:var(--text3)">${p.status}</span>
              <span style="font-family:var(--mono);font-weight:600">${fmtVal(calcValor(p))}</span>
            </div>`).join('')}
          </div>
        </details>
      </div>
    </div>`;
  }).join('');

  // Sumário anual
  const sumario=`<div style="background:var(--bg2);border:2px solid var(--accent);border-radius:var(--radius-lg);padding:16px 20px;margin-top:16px">
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--accent);font-family:var(--font);margin-bottom:12px">📊 Consolidado — ${meses.length} mês(es) registrados</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px">
      ${[['Faturamento total',fmtVal(totFat),'var(--text)'],['DAS total',fmtVal(totDAS),'var(--red)'],['INSS total',fmtVal(totINSS),'var(--amber)'],['IRPF total',fmtVal(totIRPF),totIRPF>0?'var(--red)':'var(--green)'],['Total impostos',fmtVal(totTotal),'var(--red)'],['Total líquido',fmtVal(totLiquido),'var(--green)'],['Carga média',(totFat>0?(totTotal/totFat*100).toFixed(1)+'%':'—'),'var(--text3)']].map(([l,v,c])=>`
        <div style="background:var(--bg3);border-radius:var(--radius);padding:10px 12px">
          <div style="font-size:10px;color:var(--text3);font-family:var(--font);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px">${l}</div>
          <div style="font-size:14px;font-weight:700;font-family:var(--mono);color:${c}">${v}</div>
        </div>`).join('')}
    </div>
  </div>`;

  el.innerHTML=sumario+'<div style="margin-top:16px">'+rows+'</div>';
}

function impRenderTabela(label, tab){
  return`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px 16px">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);font-family:var(--font);margin-bottom:10px">${label}</div>
    <table style="width:100%;border-collapse:collapse;font-family:var(--font);font-size:11px">
      <tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:4px 6px;color:var(--text3)">Até RBT12</th><th style="text-align:right;padding:4px 6px;color:var(--text3)">Alíq.</th><th style="text-align:right;padding:4px 6px;color:var(--text3)">Dedução</th></tr>
      ${tab.map(f=>`<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 6px;color:var(--text2)">${fmtVal(f.ate)}</td><td style="text-align:right;padding:4px 6px;color:var(--text2)">${f.aliq}%</td><td style="text-align:right;padding:4px 6px;color:var(--text2)">${fmtVal(f.deduz)}</td></tr>`).join('')}
    </table>
  </div>`;
}

function impGetInputs(){
  return{
    rbt12:+document.getElementById('imp-rbt12')?.value||impCfg.faturamento12||0,
    mes:+document.getElementById('imp-mes')?.value||impCfg.faturamentoMes||0,
    pl_pct:+document.getElementById('imp-pl-range')?.value||impCfg.prolabore_pct,
    inss_pct:+document.getElementById('imp-inss')?.value||impCfg.inss_socio_pct,
    anexo:document.getElementById('imp-anexo')?.value||impCfg.anexo||'3',
  };
}
function impGetOtimInputs(){
  return{
    rbt12:+document.getElementById('imp-o-rbt12')?.value||0,
    mes:+document.getElementById('imp-o-mes')?.value||0,
    pl_pct:+document.getElementById('imp-o-pl')?.value||impCfg.prolabore_pct,
    inss_pct:+document.getElementById('imp-o-inss')?.value||impCfg.inss_socio_pct,
    anexo:impCfg.anexo||'3',
  };
}

function impCalc(){
  const v=impGetInputs();
  if(!v.mes){showToast('Preencha o faturamento do mês.');return;}
  if(!v.rbt12){showToast('Preencha o RBT12 (receita dos últimos 12 meses).');return;}
  impCfg={faturamento12:v.rbt12,faturamentoMes:v.mes,prolabore_pct:v.pl_pct,inss_socio_pct:v.inss_pct,anexo:v.anexo};
  impSaveCfg();
  impInjectTooltipStyle();

  const r=impCalcMes(v.mes,v.rbt12,v.pl_pct,v.inss_pct,v.anexo);
  const carga_pct=(r.total/v.mes*100).toFixed(1);
  const faixaInfo=(r.tabelaNome.includes('3')?IMP_ANEXO3:IMP_ANEXO5).find(f=>v.rbt12<=f.ate)||(r.tabelaNome.includes('3')?IMP_ANEXO3:IMP_ANEXO5).at(-1);

  const row=(label,val,color,tip)=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:var(--bg3);border-radius:var(--radius);margin-bottom:6px;border-left:3px solid ${color}">
    <span class="imp-tt" style="font-size:12px;font-family:var(--font);color:var(--text2);cursor:help">${label} <span class="imp-tt-icon">?</span><span class="imp-tip">${tip}</span></span>
    <span style="font-size:14px;font-weight:700;font-family:var(--mono);color:${color}">${val}</span>
  </div>`;
  const sec=(label,color)=>`<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:${color};font-family:var(--font);margin:12px 0 6px;padding-top:8px;border-top:1px solid var(--border)">${label}</div>`;

  document.getElementById('imp-resultado').innerHTML=`
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);font-family:var(--font);margin-bottom:12px">
      ${r.tabelaNome} · Fator R ${(r.fatorR*100).toFixed(1)}%
      ${r.migrou?'<span style="font-size:10px;color:var(--green);margin-left:6px">✓ Fator R ≥ 28% → Anexo 3</span>':''}
    </div>
    <div style="background:var(--bg3);border-radius:var(--radius);padding:10px 12px;margin-bottom:14px;font-size:12px;font-family:var(--font)">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="color:var(--text3)">Faturamento</span><span style="font-weight:600">${fmtVal(v.mes)}</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="color:var(--text3)">Pró-labore (${v.pl_pct}%)</span><span style="color:var(--accent)">${fmtVal(r.prolabore)}</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="color:var(--text3)">Lucro distribuível (isento IR)</span><span style="color:var(--green)">${fmtVal(r.lucro_dist)}</span></div>
      <div style="height:1px;background:var(--border);margin:6px 0"></div>
      <div style="display:flex;justify-content:space-between"><span style="font-weight:600">Líquido após impostos</span><span style="font-weight:700;color:var(--green)">${fmtVal(r.liquido)}</span></div>
    </div>
    ${sec('📋 DAS — Simples Nacional (empresa paga)','var(--red)')}
    ${row(`DAS total — alíquota efetiva ${(r.aliqEf*100).toFixed(2)}%`,fmtVal(r.das),'var(--red)',
      `<strong>DAS — Simples Nacional</strong><br>Imposto único da empresa reunindo 6 tributos. Pago até dia 20.<br>
      Alíquota nominal: ${faixaInfo.aliq}% · Dedução: ${fmtVal(faixaInfo.deduz)}<br>
      Distribuição estimada:<br>
      IRPJ ${fmtVal(r.das_irpj)} · CSLL ${fmtVal(r.das_csll)} · COFINS ${fmtVal(r.das_cofins)}<br>
      PIS ${fmtVal(r.das_pis)} · CPP ${fmtVal(r.das_cpp)} · ISS ${fmtVal(r.das_iss)}`)}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:8px;font-size:10px;font-family:var(--font)">
      ${[['IRPJ',r.das_irpj],['CSLL',r.das_csll],['COFINS',r.das_cofins],['PIS',r.das_pis],['CPP',r.das_cpp],['ISS',r.das_iss]].map(([n,v2])=>`<div style="background:var(--bg3);border-radius:var(--radius);padding:4px 6px"><div style="color:var(--text3)">${n}</div><div style="font-weight:600;font-family:var(--mono)">${fmtVal(v2)}</div></div>`).join('')}
    </div>
    ${sec('👤 Encargos pessoais — você como sócio (DARF)','var(--amber)')}
    ${row(`INSS — código 1099 (${v.inss_pct}% sobre pró-labore)`,fmtVal(r.inss_socio),'var(--amber)',
      `<strong>INSS do sócio-administrador — DARF código 1099</strong><br>
      Contribuição previdenciária pessoal (aposentadoria, auxílio-doença).<br>
      ${v.inss_pct}% sobre pró-labore de ${fmtVal(r.prolabore)} · Teto R$ 908,86/mês<br>
      ⚠️ Diferente do CPP dentro do DAS — são dois INSSs distintos.`)}
    ${row(`IRPF sobre pró-labore — faixa ${r.faixa_irpf}`,fmtVal(r.irpf),r.irpf>0?'var(--red)':'var(--green)',
      `<strong>Imposto de Renda Pessoa Física — tabela progressiva 2024</strong><br>
      Base: ${fmtVal(r.base_irpf)} (pró-labore − INSS)<br>
      Faixa aplicada: ${r.faixa_irpf}<br>
      ✅ Lucro distribuído (${fmtVal(r.lucro_dist)}) é 100% isento de IRPF — vantagem do Simples.`)}
    ${sec('📊 Total — tudo que sai do seu bolso','var(--text2)')}
    <div style="background:var(--bg3);border:2px solid var(--red);border-radius:var(--radius);padding:12px 14px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="imp-tt" style="font-size:13px;font-weight:600;font-family:var(--font);cursor:help">
          Total de impostos <span class="imp-tt-icon">?</span>
          <span class="imp-tip">DAS ${fmtVal(r.das)} (empresa) + INSS ${fmtVal(r.inss_socio)} (DARF 1099) + IRPF ${fmtVal(r.irpf)}<br>Carga efetiva sobre faturamento: ${carga_pct}%</span>
        </span>
        <span style="font-size:20px;font-weight:700;font-family:var(--mono);color:var(--red)">${fmtVal(r.total)}</span>
      </div>
      <div style="margin-top:6px;display:flex;gap:12px;font-size:11px;font-family:var(--font);color:var(--text3);flex-wrap:wrap">
        <span>Carga: <strong style="color:var(--red)">${carga_pct}%</strong></span>
        <span>Líquido: <strong style="color:var(--green)">${fmtVal(r.liquido)}</strong></span>
        <span>Faturamento: ${fmtVal(v.mes)}</span>
      </div>
    </div>`;
}

function impCalcOtimo(){
  const v=impGetOtimInputs();
  if(!v.rbt12||!v.mes){showToast('Preencha RBT12 e faturamento do mês na aba Otimizar.');return;}
  impCfg={...impCfg,faturamento12:v.rbt12,faturamentoMes:v.mes,inss_socio_pct:v.inss_pct};
  impSaveCfg();
  impInjectTooltipStyle();

  const results=[];
  for(let pct=0;pct<=100;pct+=1){
    const r3=impCalcMes(v.mes,v.rbt12,pct,v.inss_pct,'3');
    const r5=impCalcMes(v.mes,v.rbt12,pct,v.inss_pct,'5');
    results.push({pct,r3,r5});
  }
  const opt3=results.reduce((a,b)=>b.r3.total<a.r3.total?b:a);
  const opt5=results.reduce((a,b)=>b.r5.total<a.r5.total?b:a);
  const bestAnexo3=opt3.r3.total<=opt5.r5.total;
  const bestR=bestAnexo3?opt3.r3:opt5.r5;
  const bestPct=bestAnexo3?opt3.pct:opt5.pct;
  const currentR=impCalcMes(v.mes,v.rbt12,v.pl_pct,v.inss_pct,impCfg.anexo||'3');
  const economia=currentR.total-bestR.total;

  const el=document.getElementById('imp-otimo');
  el.style.display='block';
  el.style.cssText='display:block;background:rgba(79,142,247,.05);border:1px solid rgba(79,142,247,.2);border-radius:var(--radius-lg);padding:18px 20px';
  el.innerHTML=`
    <div style="font-size:13px;font-weight:700;font-family:var(--font);margin-bottom:14px;color:var(--accent)">💡 Otimização tributária — simulação completa</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:14px">
      ${[
        ['Situação atual',fmtVal(currentR.total),'var(--red)',`PL ${v.pl_pct}% · ${impCfg.anexo==='3'?'Anexo 3':'Anexo 5'}`],
        ['✓ Configuração ótima',fmtVal(bestR.total),'var(--green)',`PL ${bestPct}% · ${bestAnexo3?'Anexo 3':bestR.tabelaNome}`],
        ['Economia mensal',economia>0?'+ '+fmtVal(economia):'Já ótimo',economia>0?'var(--green)':'var(--text3)',economia*12>0?fmtVal(economia*12)+'/ano':''],
        ['Lucro isento IR',fmtVal(bestR.lucro_dist),'var(--green)','Distribuição isenta de IRPF'],
        ['Líquido ótimo',fmtVal(bestR.liquido),'var(--green)',`Carga: ${(bestR.total/v.mes*100).toFixed(1)}%`],
      ].map(([l,v2,c,s])=>`<div style="background:var(--bg2);border-radius:var(--radius);padding:10px 14px${l.startsWith('✓')?';border:1px solid var(--green)':''}">
        <div style="font-size:10px;color:var(--text3);font-family:var(--font);text-transform:uppercase;margin-bottom:3px">${l}</div>
        <div style="font-size:15px;font-weight:700;font-family:var(--mono);color:${c}">${v2}</div>
        ${s?`<div style="font-size:11px;color:var(--text3);font-family:var(--font)">${s}</div>`:''}
      </div>`).join('')}
    </div>
    <div style="background:var(--bg2);border-radius:var(--radius);padding:12px 14px;font-size:12px;font-family:var(--font);color:var(--text2);line-height:1.8">
      <strong>Recomendação:</strong> Pró-labore de <strong>${bestPct}%</strong> (${fmtVal(bestR.prolabore)}/mês) no <strong>${bestAnexo3?'Anexo 3':bestR.tabelaNome}</strong><br>
      DAS: ${fmtVal(bestR.das)} · INSS: ${fmtVal(bestR.inss_socio)} · IRPF: ${fmtVal(bestR.irpf)} · Fator R: ${(bestR.fatorR*100).toFixed(1)}%<br>
      O lucro de <strong>${fmtVal(bestR.lucro_dist)}</strong> pode ser distribuído a você como sócio — <strong>100% isento de IRPF</strong>.<br>
      <span style="font-size:11px;color:var(--text3)">⚠️ Simulação educacional. Não considera deduções pessoais do IRPF, 13° ou variações mensais. Consulte seu contador.</span>
    </div>`;
  el.scrollIntoView({behavior:'smooth',block:'nearest'});
}


function finRefreshAll(){finFillMonthSel('fin-ed-month',true);const active=document.querySelector('.fin-page.active');if(!active)return;const id=active.id.replace('fin-page-','');({anual:finRenderAnual,receitas:finRenderReceitas,reserva:finRenderReserva,impostos:impRender})[id]?.();}

function loadFinLocal(){
  finCAT_E=finLoadCats();
  finGF=finS.g('gf')||{fixo:[],semifixo:[],variavel:[]};
  finTXS=finS.g('txs')||[];
  finMETA=finS.g('meta')||10000;
  finSALDO=finS.g('saldo')||0;
  // Ensure finGF has all required keys
  finGF.fixo=finGF.fixo||[];finGF.semifixo=finGF.semifixo||[];finGF.variavel=finGF.variavel||[];
}
function finSeedGf(){if(finGF.fixo.length||finGF.semifixo.length||finGF.variavel.length)return;finGF.fixo=[{id:'gf1',name:'Amazon Prime',value:19.90,cat:'Assinaturas',note:'Todo mês'},{id:'gf2',name:'Conta Vivo',value:59.70,cat:'Assinaturas',note:'Celular'},{id:'gf3',name:'Google One',value:9.99,cat:'Assinaturas',note:'Armazenamento'},{id:'gf4',name:'Lucid Software',value:59.89,cat:'Assinaturas',note:'USD 11'},{id:'gf5',name:'Pac Drako',value:129.90,cat:'Outros',note:'Parcela'},{id:'gf6',name:'Samsung Shopee',value:128.25,cat:'Outros',note:'12x parcela'}];finGF.semifixo=[{id:'gf7',name:'Combustível',value:200.00,cat:'Transporte',note:'Estimativa'},{id:'gf8',name:'Farmácia',value:80.00,cat:'Saúde',note:'Estimativa'},{id:'gf9',name:'Restaurantes',value:150.00,cat:'Alimentação',note:'Estimativa'}];finGF.variavel=[{id:'gfA',name:'Compras online',value:200.00,cat:'Compras online',note:'Amazon/Shopee'},{id:'gfB',name:'Lazer / Saídas',value:150.00,cat:'Lazer',note:'Orçamento'},{id:'gfC',name:'Vestuário',value:100.00,cat:'Vestuário',note:'Orçamento'}];finS.s('gf',finGF);}
function finSeedTxs(){if(finTXS.length>0)return;finTXS=[{id:1,desc:'Fatura Nubank Jan/2026',amount:2213.97,date:'2026-01-23',cat:'fatura',note:'Importada',type:'expense'},{id:2,desc:'Fatura Nubank Fev/2026',amount:3092.64,date:'2026-02-23',cat:'fatura',note:'Importada',type:'expense'},{id:3,desc:'Fatura Nubank Mar/2026',amount:3071.94,date:'2026-03-23',cat:'fatura',note:'Importada',type:'expense'},{id:4,desc:'Fatura Nubank Abr/2026',amount:4556.01,date:'2026-04-23',cat:'fatura',note:'Importada',type:'expense'}];finS.s('txs',finTXS);}

// Init cat select in modal
// These run after DOM is ready (called from finGoTo on first use)
function finInitModal(){
  const catSel=document.getElementById('fin-f-cat');
  if(catSel&&!catSel.hasChildNodes())
    catSel.innerHTML=finCAT_E.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  const finNow=new Date();
  const mEl=document.getElementById('fin-fat-m');
  const yEl=document.getElementById('fin-fat-y');
  if(mEl&&!mEl.value)mEl.value=String(finNow.getMonth()+1).padStart(2,'0');
  if(yEl&&!yEl.value)yEl.value=finNow.getFullYear();
}
finSeedGf();finSeedTxs();

