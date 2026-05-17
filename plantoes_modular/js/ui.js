// ── Theme Toggle ─────────────────────────────────────────────────
// ── Theme System ─────────────────────────────────────────────────
const THEMES={
  dark:   {id:'dark',   name:'Padrão Escuro',  icon:'🌑', swatches:['#0f1117','#161b27','#4f8ef7','#3ecf8e'], desc:'Tema padrão do app'},
  light:  {id:'light',  name:'Padrão Claro',   icon:'☀️', swatches:['#f0f2f7','#ffffff','#3b7ef0','#1fa872'], desc:'Tema claro padrão'},
  ocean:  {id:'ocean',  name:'Ocean Depths',   icon:'🌊', swatches:['#0d1520','#1a2332','#2d8b8b','#a8dadc'], desc:'Marítimo profissional'},
  forest: {id:'forest', name:'Forest Canopy',  icon:'🌿', swatches:['#0e1a0d','#162315','#7d8471','#a4ac86'], desc:'Terra e natureza'},
  golden: {id:'golden', name:'Golden Hour',    icon:'🌅', swatches:['#1c1208','#2a1c0c','#f4a900','#d4b896'], desc:'Âmbar e terracota'},
  galaxy: {id:'galaxy', name:'Midnight Galaxy',icon:'🔮', swatches:['#100a1e','#18102c','#a490c2','#4a4e8f'], desc:'Cósmico dramático'},
  minimal:{id:'minimal',name:'Modern Minimalist',icon:'⬜',swatches:['#1a1f24','#232a30','#708090','#a0aab4'], desc:'Minimalista neutro'},
};
const THEME_MODE_KEY='plantoes_theme_mode'; // 'light' | 'dark'
const THEME_ACCENT_KEY='plantoes_theme_accent'; // theme id

function getThemeMode(){return localStorage.getItem(THEME_MODE_KEY)||'dark';}
function getThemeAccent(){return localStorage.getItem(THEME_ACCENT_KEY)||'dark';}

function applyThemeMode(mode){
  localStorage.setItem(THEME_MODE_KEY,mode);
  _applyFullTheme(getThemeAccent(),mode);
  _updateModeButtons(mode);
}

function _updateModeButtons(mode){
  const d=document.getElementById('mode-dark-btn');
  const l=document.getElementById('mode-light-btn');
  if(d)d.style.background=mode==='dark'?'var(--accent-bg)':'';
  if(l)l.style.background=mode==='light'?'var(--accent-bg)':'';
}

function _applyFullTheme(accent, mode){
  // Remove all theme classes
  const cls=['light','theme-ocean','theme-forest','theme-golden','theme-galaxy','theme-minimal'];
  document.body.classList.remove(...cls);
  // Apply mode
  if(mode==='light')document.body.classList.add('light');
  // Apply accent theme (skip for 'dark'/'light' which are base themes)
  const classMap={ocean:'theme-ocean',forest:'theme-forest',golden:'theme-golden',galaxy:'theme-galaxy',minimal:'theme-minimal'};
  if(classMap[accent])document.body.classList.add(classMap[accent]);
  // Update label in sidebar
  const lbl=document.getElementById('theme-label');
  if(lbl){const t=THEMES[accent]||THEMES.dark;lbl.textContent=`${t.name} · ${mode==='light'?'Claro':'Escuro'}`;}
  // Rebuild chart
  if(document.getElementById('fin-page-anual')?.classList.contains('active'))finRenderAnual();
}

function applyTheme(accentOrMode){
  // Legacy support: 'light'/'dark' used to be the only options
  if(accentOrMode==='light'||accentOrMode==='dark'){
    applyThemeMode(accentOrMode);return;
  }
  // New: set accent theme
  localStorage.setItem(THEME_ACCENT_KEY,accentOrMode);
  _applyFullTheme(accentOrMode,getThemeMode());
  renderThemeSelector();
}

function toggleTheme(){
  applyThemeMode(getThemeMode()==='light'?'dark':'light');
}

function initTheme(){
  const accent=getThemeAccent();
  const mode=getThemeMode();
  _applyFullTheme(accent,mode);
}

function renderThemeSelector(){
  const el=document.getElementById('theme-selector');if(!el)return;
  const current=getThemeAccent();
  const mode=getThemeMode();
  _updateModeButtons(mode);
  el.innerHTML=Object.values(THEMES).filter(t=>t.id!=='light'&&t.id!=='dark').concat(
    Object.values(THEMES).filter(t=>t.id==='dark')
  ).map(t=>`
    <div class="theme-card${current===t.id?' selected':''}" onclick="applyTheme('${t.id}')"
      style="background:${t.swatches[1]};border-color:${current===t.id?t.swatches[2]:'rgba(255,255,255,0.1)'}">
      <div class="tc-check"><svg viewBox="0 0 24 24" fill="white" style="width:12px;height:12px"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>
      <div class="theme-swatch">
        ${t.swatches.map(c=>`<div style="flex:1;background:${c}"></div>`).join('')}
      </div>
      <div style="font-size:12px;font-weight:600;color:${t.swatches[3]};font-family:var(--font);margin-bottom:2px">${t.icon} ${t.name}</div>
      <div style="font-size:10px;color:${t.swatches[2]};font-family:var(--font);opacity:.8">${t.desc}</div>
    </div>`).join('');
}

// ── Chart ────────────────────────────────────────────────────────
let chartMode='valor';
function setChartMode(mode,el){
  chartMode=mode;
  document.querySelectorAll('.chart-tab').forEach(t=>t.classList.remove('active'));
  if(el)el.classList.add('active');
  renderChart();
}

function renderChart(){
  const el=document.getElementById('chart-bars');
  if(!el)return;
  const yms=[...new Set(plantoes.map(p=>getYM(p.data)).filter(Boolean))].sort();
  if(!yms.length){el.innerHTML='<div style="color:var(--text3);font-size:12px;padding:20px">Nenhum dado para exibir.</div>';return;}

  const isSt=(p,s)=>(p.status||'').toLowerCase()===s.toLowerCase();

  const data=yms.map(ym=>{
    const ps=plantoes.filter(p=>getYM(p.data)===ym);
    // Values
    const valor       = ps.reduce((a,p)=>a+calcValor(p),0);
    const horas       = ps.reduce((a,p)=>a+durH(p.ini,p.fim),0);
    const count       = ps.length;
    // Layer 2: Realizado = status Realizado (concluído, sem NF/pagamento)
    const psReal      = ps.filter(p=>isSt(p,'Realizado'));
    const valReal     = psReal.reduce((a,p)=>a+calcValor(p),0);
    const hReal       = psReal.reduce((a,p)=>a+durH(p.ini,p.fim),0);
    const cReal       = psReal.length;
    // Layer 3: NF Emitida
    const psNF        = ps.filter(p=>isSt(p,'NF Emitida'));
    const valNF       = psNF.reduce((a,p)=>a+calcValor(p),0);
    const hNF         = psNF.reduce((a,p)=>a+durH(p.ini,p.fim),0);
    const cNF         = psNF.length;
    // Layer 4: Pago
    const psPago      = ps.filter(p=>isSt(p,'Recebido'));
    const valPago     = psPago.reduce((a,p)=>a+calcValor(p),0);
    const hPago       = psPago.reduce((a,p)=>a+durH(p.ini,p.fim),0);
    const cPago       = psPago.length;
    // A Realizar (pendente)
    const psAReal     = ps.filter(p=>isSt(p,'A Realizar'));
    const valAReal    = psAReal.reduce((a,p)=>a+calcValor(p),0);
    return{ym,valor,horas,count,valReal,hReal,cReal,valNF,hNF,cNF,valPago,hPago,cPago,valAReal,cAReal:psAReal.length};
  });

  const vals=data.map(d=>chartMode==='valor'?d.valor:chartMode==='horas'?d.horas:d.count);
  const maxVal=Math.max(...vals,1);
  const chartH=140;
  const nowYm=`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;

  el.innerHTML=data.map(d=>{
    // Semantic color
    let color,border;
    if(d.valPago>0||d.cPago>0){
      color='#3ecf8e';border='rgba(62,207,142,0.8)';
    } else if(d.ym===nowYm){
      color='#f5a623';border='rgba(245,166,35,0.8)';
    } else if(d.ym<nowYm){
      color='#4f8ef7';border='rgba(79,142,247,0.8)';
    } else {
      color='#8892a4';border='rgba(136,146,164,0.6)';
    }

    const[,mo]=d.ym.split('-');
    const shortLabel=MESES[parseInt(mo)-1].slice(0,3);

    let totalVal,realVal,nfVal,pagoVal,dispVal;
    let tipLines=[];

    if(chartMode==='valor'){
      totalVal=d.valor;realVal=d.valReal;nfVal=d.valNF;pagoVal=d.valPago;
      dispVal=d.valor>=1000?'R$'+(d.valor/1000).toFixed(1)+'k':fmtValTip(d.valor);
      tipLines.push({label:'Total',     val:fmtValTip(d.valor),   op:.45});
      tipLines.push({label:'Realizado', val:fmtValTip(d.valReal), op:.72});
      tipLines.push({label:'NF Emitida',val:fmtValTip(d.valNF),   op:.86});
      tipLines.push({label:'Recebido',  val:fmtValTip(d.valPago), op:1});
    } else if(chartMode==='horas'){
      totalVal=d.horas;realVal=d.hReal;nfVal=d.hNF;pagoVal=d.hPago;
      dispVal=hFmt(d.horas);
      tipLines.push({label:'Total',     val:hFmt(d.horas), op:.45});
      tipLines.push({label:'Realizado', val:hFmt(d.hReal), op:1});
    } else {
      totalVal=d.count;realVal=d.cReal;nfVal=d.cNF;pagoVal=d.cPago;
      dispVal=String(d.count);
      tipLines.push({label:'Total',     val:`${d.count} plantões`, op:.45});
      tipLines.push({label:'Realizado', val:String(d.cReal)||'0',  op:1});
    }

    const h1=Math.max(4,Math.round((totalVal/maxVal)*chartH));
    const h2=realVal? Math.max(3,Math.round((realVal/maxVal)*chartH)):0;
    // NF and Pago layers only for valor mode
    const h3=chartMode==='valor'&&nfVal?  Math.max(3,Math.round((nfVal/maxVal)*chartH)):0;
    const h4=chartMode==='valor'&&pagoVal?Math.max(2,Math.round((pagoVal/maxVal)*chartH)):0;

    const tipHtml=encodeURIComponent(
      `<div style="font-weight:600;margin-bottom:4px;color:var(--text)">${ymLabel(d.ym)}</div>`+
      tipLines.map(l=>`<div class="chart-tip-row"><div class="chart-tip-dot" style="background:${color};opacity:${l.op}"></div><span class="chart-tip-label">${l.label}</span><span class="chart-tip-val">${l.val}</span></div>`).join('')
    );

    return`<div class="chart-col">
      <div class="chart-val">${dispVal}</div>
      <div class="chart-bar-wrap" style="height:${chartH}px"
        onmouseenter="showChartTipHtml(event,'${tipHtml}')"
        onmouseleave="hideChartTip()">
        <div class="chart-bar-layer total"    style="height:${h1}px;background:${color};border:1px solid ${border}"></div>
        ${h2?`<div class="chart-bar-layer realizado" style="height:${h2}px;background:${color}"></div>`:''}
        ${h3?`<div class="chart-bar-layer nf"        style="height:${h3}px;background:${color}"></div>`:''}
        ${h4?`<div class="chart-bar-layer pago"      style="height:${h4}px;background:${color}"></div>`:''}
      </div>
      <div class="chart-label">${shortLabel}</div>
    </div>`;
  }).join('');
}
function exportCSV(){
  const cols=['Período','Data','Dia','Início','Fim','Duração','Local','Tipo','Observação','Valor (R$)','Status','Realizado'];
  const rows=plantoes.sort((a,b)=>a.data.localeCompare(b.data)||a.ini.localeCompare(b.ini)).map(p=>[ymLabel(getYM(p.data)),fmtData(p.data),getDowFull(p.data),p.ini,p.fim,durFmt(p.ini,p.fim),p.local,p.tipo,p.obs,calcValor(p),p.status,isPast(p.data,p.fim)?'Sim':'Não'].map(v=>`"${v}"`).join(','));
  const csv=[cols.join(','),...rows].join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='plantoes.csv';a.click();URL.revokeObjectURL(url);showToast('CSV exportado!');
}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800);}

document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!e.shiftKey){e.preventDefault();undoLast();return;}
  const tag=document.activeElement?.tagName?.toLowerCase();
  const inInput=['input','textarea','select'].includes(tag);
  // Fix 5: N key opens new plantão when on Plantões page and no input focused
  if(e.key==='n'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!inInput){
    if(document.getElementById('page-plantoes').classList.contains('active')){
      e.preventDefault();openModal();return;
    }
  }
  // 7. Global keyboard shortcuts (no modifier, no input focused)
  if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&!inInput){
    const shortcuts={
      'i':()=>showPage('inicio',document.querySelector('.nav-item[onclick*=inicio]')),
      'p':()=>{const b=document.querySelector('.nav-item[onclick*=togglePlantoes]');if(b)togglePlantoes(b);},
      'c':()=>showPage('calendario',document.querySelector('.nav-item[onclick*=calendario]')),
      't':()=>showPage('tarefas',document.querySelector('.nav-item[onclick*=tarefas]')),
      'f':()=>{const b=document.querySelector('.nav-item[onclick*=toggleFinancas]');if(b)toggleFinancas(b);},
      'g':()=>{if(document.getElementById('page-financas').classList.contains('active'))finGoTo('gastos');},
      'r':()=>{if(document.getElementById('page-financas').classList.contains('active'))finGoTo('receitas');},
      '/':()=>{e.preventDefault();const s=document.getElementById('search')||document.getElementById('global-search');if(s){s.focus();s.select();}},
    };
    if(shortcuts[e.key]){shortcuts[e.key]();return;}
  }
  if(e.key==='Escape'){
    if(document.getElementById('modal-overlay').classList.contains('open'))closeModal();
    else if(document.getElementById('settings-overlay').classList.contains('open'))closeSettings();
    else if(document.getElementById('profiles-overlay').classList.contains('open'))closeManageProfiles();
    else if(document.getElementById('gcal-tutorial-overlay').classList.contains('open'))closeGcalTutorial();
    else if(document.getElementById('cal-edit-overlay').classList.contains('open'))closeCalEdit();
    else if(document.getElementById('evento-overlay').classList.contains('open'))closeEventoModal();
    else if(document.getElementById('cat-overlay').classList.contains('open'))closeCatModal();
    else if(document.getElementById('tarefa-overlay').classList.contains('open'))closeTarefaModal();
    else closeActiveEditor();
  }
});
document.addEventListener('click',e=>{if(!e.target.closest('td')&&!e.target.closest('.modal'))closeActiveEditor();});

