// ══════════════════════════════════════════════════════════════════
// 8. COMPACT TABLE MODE
// ══════════════════════════════════════════════════════════════════
let compactMode=JSON.parse(localStorage.getItem('compactMode')||'false');
function toggleCompact(){
  compactMode=!compactMode;
  localStorage.setItem('compactMode',JSON.stringify(compactMode));
  applyCompact();
}
function applyCompact(){
  const tbl=document.querySelector('#page-plantoes .table-wrap');
  if(tbl)tbl.classList.toggle('compact-mode',compactMode);
  const btn=document.getElementById('compact-btn');
  if(btn){btn.style.color=compactMode?'var(--accent)':'';btn.title=compactMode?'Modo normal':'Modo compacto';}
}
document.addEventListener('keydown',e=>{
  if(e.altKey&&e.key==='c'){e.preventDefault();toggleCompact();}
});

// ══════════════════════════════════════════════════════════════════
// 6. GLOBAL SEARCH
// ══════════════════════════════════════════════════════════════════
let gsSelectedIdx=-1;
function openGlobalSearch(){
  document.getElementById('global-search-overlay').style.display='flex';
  setTimeout(()=>document.getElementById('global-search-input')?.focus(),50);
  gsSelectedIdx=-1;
  globalSearchRender();
}
function closeGlobalSearch(){
  document.getElementById('global-search-overlay').style.display='none';
  document.getElementById('global-search-input').value='';
}
function globalSearchRender(){
  const q=(document.getElementById('global-search-input')?.value||'').toLowerCase().trim();
  const el=document.getElementById('global-search-results');if(!el)return;
  if(!q){el.innerHTML='<div style="padding:14px 20px;font-size:12px;color:var(--text3);font-family:var(--font)">Digite para buscar em tudo…</div>';return;}
  const results=[];
  // Plantões
  plantoes.filter(p=>[p.data,p.local,p.tipo,p.obs,p.status,p.ini,p.fim].join(' ').toLowerCase().includes(q)).slice(0,5).forEach(p=>{
    results.push({icon:'🏥',bg:'var(--accent-bg)',title:`${fmtData(p.data)} · ${p.local}`,sub:`${p.tipo} · ${p.ini}–${p.fim} · ${p.status}`,action:()=>{closeGlobalSearch();showPage('plantoes',document.querySelector('.nav-item[onclick*=plantoes]'));setTimeout(()=>{const s=document.getElementById('search');if(s){s.value=p.local;render();}},100);}});
  });
  // Tarefas
  tarefas.filter(t=>`${t.titulo} ${t.notas||''}`.toLowerCase().includes(q)).slice(0,4).forEach(t=>{
    const cat=categorias.find(c=>c.id===t.catId);
    results.push({icon:'✅',bg:'var(--green-bg)',title:t.titulo,sub:`${cat?cat.nome:''} · ${t.prio}${t.prazo?' · '+fmtData(t.prazo):''}`,action:()=>{closeGlobalSearch();showPage('tarefas',document.querySelector('.nav-item[onclick*=tarefas]'));setTimeout(()=>openTarefaModal(t.id),200);}});
  });
  // Eventos
  (eventos||[]).filter(ev=>`${ev.titulo} ${ev.desc||''}`.toLowerCase().includes(q)).slice(0,3).forEach(ev=>{
    results.push({icon:'📅',bg:'var(--amber-bg)',title:ev.titulo,sub:`${fmtData(ev.data)}${ev.hora?' · '+ev.hora:''}`,action:()=>{closeGlobalSearch();showPage('calendario',document.querySelector('.nav-item[onclick*=calendario]'));setTimeout(()=>openEventoModal(ev.id),200);}});
  });
  // Gastos financeiros
  finTXS.filter(t=>`${t.desc} ${t.note||''}`.toLowerCase().includes(q)).slice(0,3).forEach(t=>{
    results.push({icon:'💰',bg:'rgba(242,95,92,.08)',title:t.desc,sub:`${finFmtD(t.date)} · ${finFmt(t.amount)}`,action:()=>{closeGlobalSearch();toggleFinancas(document.querySelector('.nav-item[onclick*=toggleFinancas]'));finGoTo('gastos');}});
  });
  gsSelectedIdx=-1;
  if(!results.length){el.innerHTML='<div style="padding:14px 20px;font-size:12px;color:var(--text3);font-family:var(--font)">Nenhum resultado para "'+q+'"</div>';return;}
  el.innerHTML=results.map((r,i)=>`<div class="gs-result" id="gsr-${i}" onclick="gsResults[${i}].action()">
    <div class="gs-result-icon" style="background:${r.bg}">${r.icon}</div>
    <div class="gs-result-body"><div class="gs-result-title">${r.title}</div><div class="gs-result-sub">${r.sub}</div></div>
  </div>`).join('');
  window.gsResults=results;
}
function globalSearchKey(e){
  const items=document.querySelectorAll('.gs-result');
  if(e.key==='ArrowDown'){e.preventDefault();gsSelectedIdx=Math.min(gsSelectedIdx+1,items.length-1);items.forEach((el,i)=>el.classList.toggle('selected',i===gsSelectedIdx));}
  else if(e.key==='ArrowUp'){e.preventDefault();gsSelectedIdx=Math.max(gsSelectedIdx-1,0);items.forEach((el,i)=>el.classList.toggle('selected',i===gsSelectedIdx));}
  else if(e.key==='Enter'&&gsSelectedIdx>=0&&window.gsResults){window.gsResults[gsSelectedIdx].action();}
  else if(e.key==='Escape'){closeGlobalSearch();}
}
// Hook / key to open global search
document.addEventListener('keydown',e=>{
  if(e.key==='/'&&!e.ctrlKey&&!e.metaKey){
    const tag=document.activeElement?.tagName?.toLowerCase();
    if(['input','textarea','select'].includes(tag))return;
    e.preventDefault();openGlobalSearch();
  }
  if(e.key==='?'&&!e.ctrlKey&&!e.metaKey){
    const tag=document.activeElement?.tagName?.toLowerCase();
    if(['input','textarea','select'].includes(tag))return;
    const hint=document.getElementById('kb-hint');
    if(hint)hint.classList.toggle('show');
  }
});

// ══════════════════════════════════════════════════════════════════
// 2. STRONGER PIN HASH (SHA-256 via SubtleCrypto)
// ══════════════════════════════════════════════════════════════════
async function pinHashAsync(pin){
  // Use SHA-256 via SubtleCrypto (falls back to simple hash for older browsers)
  if(typeof crypto?.subtle?.digest==='function'){
    const enc=new TextEncoder();
    const data=enc.encode('plantoes_salt_v2_'+pin);
    const hash=await crypto.subtle.digest('SHA-256',data);
    return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  return String(pinHash(pin)); // fallback to existing simple hash
}

