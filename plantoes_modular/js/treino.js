// ══════════════════════════════════════════════════════════════════
// 3. PUSH NOTIFICATIONS (Web Notifications API)
// ══════════════════════════════════════════════════════════════════
let notifPermission=localStorage.getItem('notif_perm')||'default';
function initNotifications(){
  if('Notification' in window){
    notifPermission=Notification.permission;
    if(notifPermission==='default'){
      // Ask after 3 seconds on first load
      setTimeout(()=>requestNotifPermission(),3000);
    }
    if(notifPermission==='granted') scheduleNotifications();
  }
}
async function requestNotifPermission(){
  if(!('Notification' in window))return;
  const p=await Notification.requestPermission();
  notifPermission=p;
  localStorage.setItem('notif_perm',p);
  if(p==='granted'){showToast('✅ Notificações ativadas!');scheduleNotifications();}
}

// ══════════════════════════════════════════════════════════════════
// 1. SUPABASE SYNC FOR EVENTOS, TAREFAS, FINANÇAS
// ══════════════════════════════════════════════════════════════════
const CLOUD_TABLES={eventos:'eventos_cloud',tarefas:'tarefas_cloud',financas:'financas_cloud'};
// ══════════════════════════════════════════════════════════════════
// CLOUD SYNC — full auto-sync for all data
// ══════════════════════════════════════════════════════════════════
// Debounced save — waits 1.5s after last call before writing to Supabase
function cloudAutoSave(key, getData){
  clearTimeout(_syncDebounceTimers[key]);
  _syncDebounceTimers[key]=setTimeout(async()=>{
    if(!db||!currentUser)return;
    try{
      const data=typeof getData==='function'?getData():getData;
      await db.from('user_data').upsert(
        {user_id:currentUser.id,key,data:JSON.stringify(data),updated_at:new Date().toISOString()},
        {onConflict:'user_id,key'}
      );
    }catch(e){/* silently fail — localStorage is always the source of truth */}
  },1500);
}

async function cloudSave(key,data){
  if(!db||!currentUser)return;
  try{
    await db.from('user_data').upsert(
      {user_id:currentUser.id,key,data:JSON.stringify(data),updated_at:new Date().toISOString()},
      {onConflict:'user_id,key'}
    );
  }catch(e){}
}

async function cloudLoad(key){
  if(!db||!currentUser)return null;
  try{
    const{data,error}=await db.from('user_data').select('data').eq('user_id',currentUser.id).eq('key',key).maybeSingle();
    if(error)return null;
    return data?JSON.parse(data.data):null;
  }catch(e){return null;}
}

async function syncToCloud(){
  if(!db||!currentUser){
    // Offline: offer export instead
    if(confirm('Sem conexão com a nuvem.\n\nDeseja exportar seus dados locais para um arquivo JSON?\nVocê poderá importar no site publicado.'))
      exportLocalData();
    return;
  }
  setSyncStatus('syncing');
  try{
    const payload=[
      {user_id:currentUser.id,key:'eventos',data:JSON.stringify(eventos),updated_at:new Date().toISOString()},
      {user_id:currentUser.id,key:'tarefas',data:JSON.stringify({categorias,tarefas,_catCollapsed}),updated_at:new Date().toISOString()},
      {user_id:currentUser.id,key:'fin_cats',data:JSON.stringify(finCAT_E),updated_at:new Date().toISOString()},
      {user_id:currentUser.id,key:'fin_txs',data:JSON.stringify(finTXS),updated_at:new Date().toISOString()},
      {user_id:currentUser.id,key:'fin_gf',data:JSON.stringify(finGF),updated_at:new Date().toISOString()},
      {user_id:currentUser.id,key:'fin_meta',data:JSON.stringify({meta:finMETA,saldo:finSALDO}),updated_at:new Date().toISOString()},
      {user_id:currentUser.id,key:'fin_rv',data:JSON.stringify(JSON.parse(localStorage.getItem(finKey('rv_overrides'))||'{}')),updated_at:new Date().toISOString()},
      {user_id:currentUser.id,key:'fin_recs',data:JSON.stringify(loadRecs()),updated_at:new Date().toISOString()},
      {user_id:currentUser.id,key:'treino',data:JSON.stringify({exercicios,fichas}),updated_at:new Date().toISOString()},
      {user_id:currentUser.id,key:'treino_reg',data:JSON.stringify(JSON.parse(localStorage.getItem(treinoStorageKey()+'_reg')||'[]')),updated_at:new Date().toISOString()},
      {user_id:currentUser.id,key:'treino_ch',data:JSON.stringify(JSON.parse(localStorage.getItem(treinoStorageKey()+'_ch')||'{}')),updated_at:new Date().toISOString()},
    ];
    await db.from('user_data').upsert(payload,{onConflict:'user_id,key'});
    setSyncStatus('synced');showToast('☁ Tudo sincronizado!');
  }catch(e){setSyncStatus('error');showToast('Erro ao sincronizar.');}
}

async function syncFromCloud(){
  if(!db||!currentUser)return;
  try{setSyncStatus('syncing');}catch(e){}
  try{
    const{data:rows,error}=await db.from('user_data').select('key,data').eq('user_id',currentUser.id);
    if(error||!rows||!rows.length){setSyncStatus('offline');return;}
    const byKey={};rows.forEach(r=>{try{byKey[r.key]=JSON.parse(r.data);}catch(e){}});

    if(byKey.eventos){eventos=byKey.eventos;saveEventosLocal();}
    if(byKey.tarefas){const d=byKey.tarefas;categorias=d.categorias||[];tarefas=d.tarefas||[];_catCollapsed=d._catCollapsed||{};saveTarefasLocal();}
    if(byKey.fin_cats){finCAT_E=byKey.fin_cats;localStorage.setItem(finCatKey(),JSON.stringify(finCAT_E));}
    if(byKey.fin_txs){finTXS=byKey.fin_txs;localStorage.setItem(finKey('txs'),JSON.stringify(finTXS));}
    if(byKey.fin_gf){finGF=byKey.fin_gf;finGF.fixo=finGF.fixo||[];finGF.semifixo=finGF.semifixo||[];finGF.variavel=finGF.variavel||[];localStorage.setItem(finKey('gf'),JSON.stringify(finGF));}
    if(byKey.fin_meta){finMETA=byKey.fin_meta.meta||finMETA;finSALDO=byKey.fin_meta.saldo||0;localStorage.setItem(finKey('meta'),JSON.stringify(finMETA));localStorage.setItem(finKey('saldo'),JSON.stringify(finSALDO));}
    if(byKey.fin_rv){localStorage.setItem(finKey('rv_overrides'),JSON.stringify(byKey.fin_rv));}
    if(byKey.fin_recs){localStorage.setItem(recKey(),JSON.stringify(byKey.fin_recs));}
    if(byKey.treino){const d=byKey.treino;exercicios=d.exercicios||exercicios;fichas=d.fichas||fichas;saveTreinoLocal();}
    if(byKey.treino_reg){localStorage.setItem(treinoStorageKey()+'_reg',JSON.stringify(byKey.treino_reg));}
    if(byKey.treino_ch){localStorage.setItem(treinoStorageKey()+'_ch',JSON.stringify(byKey.treino_ch));}
    setSyncStatus('synced');
    // Re-render if app is already showing (e.g. called after login on new device)
    if(currentUser&&document.getElementById('home-content')){
      loadFinLocal();loadEventos();loadTarefas();loadTreino();
      render();renderHome();renderTarefas();updateTaskBadge();
    }
  }catch(e){setSyncStatus('error');console.error('syncFromCloud error:',e);}
}

// Local-only saves (no cloud — used by syncFromCloud to avoid loops)
function saveEventosLocal(){localStorage.setItem(evStorageKey(),JSON.stringify(eventos));}
function saveTarefasLocal(){localStorage.setItem(tfStorageKey(),JSON.stringify({categorias,tarefas,_catCollapsed}));}
function saveTreinoLocal(){localStorage.setItem(treinoStorageKey(),JSON.stringify({exercicios,fichas}));}


// ══════════════════════════════════════════════════════════════════
// 4. EXPORT EXCEL (CSV enhanced + SheetJS when available)
// ══════════════════════════════════════════════════════════════════
function exportExcel(){
  // Build rich CSV with all financial data
  const rows=[['Data','Local','Tipo','Início','Fim','Horas','Valor R$','Status','Observação']];
  plantoes.forEach(p=>{
    rows.push([p.data,p.local,p.tipo,p.ini,p.fim,durH(p.ini,p.fim).toFixed(1),calcValor(p),p.status,p.obs||'']);
  });
  // Add blank line then financial summary
  rows.push([]);
  rows.push(['=== GASTOS ===']);
  rows.push(['Descrição','Valor','Data','Categoria']);
  finTXS.forEach(t=>rows.push([t.desc,t.amount,t.date,finGetcat(t.cat).name]));
  const csv=rows.map(r=>r.map(v=>'"'+String(v||'').replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`plantoes_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();URL.revokeObjectURL(a.href);
  showToast('✅ Excel (CSV) exportado!');
}

// ══════════════════════════════════════════════════════════════════
// 5. SERVICE WORKER / OFFLINE MODE
// ══════════════════════════════════════════════════════════════════
function registerServiceWorker(){
  if(!('serviceWorker' in navigator))return;
  // Inline SW as blob — caches all app assets
  const swCode=`
const CACHE='plantoes-v1';
const ASSETS=['/'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('fetch',e=>{
  e.respondWith(caches.match(e.request).then(cached=>{
    const fresh=fetch(e.request).then(r=>{
      if(r.ok){caches.open(CACHE).then(c=>c.put(e.request,r.clone()));}
      return r;
    }).catch(()=>cached);
    return cached||fresh;
  }));
});
self.addEventListener('message',e=>{if(e.data==='skipWaiting')self.skipWaiting();});
`;
  const blob=new Blob([swCode],{type:'application/javascript'});
  const url=URL.createObjectURL(blob);
  navigator.serviceWorker.register(url).then(reg=>{
    reg.addEventListener('updatefound',()=>{showToast('🔄 App atualizado! Recarregue para ver.');});
    console.log('SW registered');
  }).catch(()=>{/* SW requires HTTPS - silently fail on HTTP */});
}

// Add sync button to sidebar footer
function addSyncBtn(){
  const footer=document.querySelector('.sidebar-footer p');
  if(!footer)return;
  // Remove existing buttons first to prevent duplication on re-login
  ['cloud-sync-btn','cloud-export-import-row'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.remove();
  });
  const isLocal=!db||window.location.protocol==='file:';
  if(!isLocal){
    const btn=document.createElement('button');
    btn.id='cloud-sync-btn';
    btn.className='btn btn-ghost btn-sm';
    btn.style.cssText='width:100%;margin-bottom:4px;font-family:var(--font);font-size:11px';
    btn.innerHTML='☁ Sincronizar dados';
    btn.onclick=syncToCloud;
    footer.parentNode.insertBefore(btn,footer.nextSibling);
  }
  const row=document.createElement('div');
  row.id='cloud-export-import-row';
  row.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:4px';
  const exp=document.createElement('button');
  exp.id='cloud-export-btn';exp.className='btn btn-ghost btn-sm';
  exp.style.cssText='font-family:var(--font);font-size:11px;opacity:.7';
  exp.innerHTML='📤 Exportar';exp.onclick=exportLocalData;
  const imp=document.createElement('button');
  imp.id='cloud-import-btn';imp.className='btn btn-ghost btn-sm';
  imp.style.cssText='font-family:var(--font);font-size:11px;opacity:.7';
  imp.innerHTML='📥 Importar';imp.onclick=importLocalData;
  row.appendChild(exp);row.appendChild(imp);
  const syncBtn=document.getElementById('cloud-sync-btn');
  footer.parentNode.insertBefore(row, syncBtn?syncBtn.nextSibling:footer.nextSibling);
}

// ══════════════════════════════════════════════════════════════════
// KEYBOARD SHORTCUT HINT (? key already handled above)
// Add ? shortcut to existing handler
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// TREINO
// ══════════════════════════════════════════════════════════════════
const GRUPO_COLORS={
  'Bíceps':   {bg:'rgba(79,142,247,.12)',  color:'var(--accent)'},
  'Tríceps':  {bg:'rgba(155,103,255,.12)', color:'var(--purple)'},
  'Costas':   {bg:'rgba(62,207,142,.12)',  color:'var(--green)'},
  'Ombros':   {bg:'rgba(245,166,35,.12)',  color:'var(--amber)'},
  'Peito':    {bg:'rgba(242,95,92,.12)',   color:'var(--red)'},
  'Pernas':   {bg:'rgba(56,189,248,.12)',  color:'#38bdf8'},
  'Abdome':   {bg:'rgba(251,191,36,.12)',  color:'#fbbf24'},
  'Panturrilha':{bg:'rgba(163,230,53,.12)','color':'#a3e635'},
  'Trapézio': {bg:'rgba(136,146,164,.15)', color:'var(--text2)'},
};

// Default exercise database - all 56 from the list
const EXERCICIOS_DEFAULT=[
  // BÍCEPS
  {id:'e01',nome:'Rosca de Punho',grupo:'Bíceps',carga:10,series:3,reps:'15-20',obs:''},
  {id:'e02',nome:'Rosca Pronada Barra',grupo:'Bíceps',carga:20,series:3,reps:'12',obs:''},
  {id:'e03',nome:'Rosca Direta Barra W',grupo:'Bíceps',carga:30,series:3,reps:'10-12',obs:'Barra W'},
  {id:'e04',nome:'Rosca Alternada',grupo:'Bíceps',carga:14,series:3,reps:'10-12',obs:'Halteres'},
  {id:'e05',nome:'Rosca Máquina',grupo:'Bíceps',carga:40,series:3,reps:'12',obs:''},
  {id:'e06',nome:'Rosca Martelo',grupo:'Bíceps',carga:14,series:3,reps:'12',obs:'Neutro'},
  {id:'e07',nome:'Rosca Banco Inclinado',grupo:'Bíceps',carga:12,series:3,reps:'10-12',obs:''},
  {id:'e08',nome:'Rosca Scott Unilateral',grupo:'Bíceps',carga:12,series:3,reps:'12',obs:''},
  {id:'e09',nome:'Rosca Scott Barra W',grupo:'Bíceps',carga:25,series:3,reps:'10-12',obs:''},
  // TRÍCEPS
  {id:'e10',nome:'Tríceps Francês',grupo:'Tríceps',carga:20,series:3,reps:'12',obs:''},
  {id:'e11',nome:'Tríceps Testa',grupo:'Tríceps',carga:25,series:3,reps:'12',obs:''},
  {id:'e12',nome:'Tríceps Corda',grupo:'Tríceps',carga:35,series:3,reps:'12-15',obs:'Polia'},
  {id:'e13',nome:'Tríceps Barra V Polia',grupo:'Tríceps',carga:35,series:3,reps:'12',obs:''},
  {id:'e14',nome:'Paralelas',grupo:'Tríceps',carga:0,series:3,reps:'10-15',obs:'Peso corporal'},
  {id:'e15',nome:'Flexões',grupo:'Tríceps',carga:0,series:3,reps:'15-20',obs:'Peso corporal'},
  // COSTAS
  {id:'e16',nome:'Barra Fixa',grupo:'Costas',carga:0,series:3,reps:'6-10',obs:'Pegada supina'},
  {id:'e17',nome:'Puxada Alta Barra',grupo:'Costas',carga:60,series:3,reps:'10-12',obs:''},
  {id:'e18',nome:'Puxada Alta Triângulo',grupo:'Costas',carga:55,series:3,reps:'10-12',obs:''},
  {id:'e19',nome:'Remada Baixa Máquina',grupo:'Costas',carga:60,series:3,reps:'10-12',obs:''},
  {id:'e20',nome:'Puxada Alta Máquina',grupo:'Costas',carga:60,series:3,reps:'12',obs:''},
  {id:'e21',nome:'Remada Curvada',grupo:'Costas',carga:50,series:3,reps:'10-12',obs:''},
  {id:'e22',nome:'Remada Cavalinho',grupo:'Costas',carga:50,series:3,reps:'10-12',obs:''},
  {id:'e23',nome:'Pullover Halter',grupo:'Costas',carga:20,series:3,reps:'12-15',obs:''},
  {id:'e24',nome:'Remada Unilateral',grupo:'Costas',carga:24,series:3,reps:'10-12',obs:'Halteres'},
  // OMBROS
  {id:'e25',nome:'Elevação Frontal',grupo:'Ombros',carga:10,series:3,reps:'12-15',obs:''},
  {id:'e26',nome:'Elevação Lateral',grupo:'Ombros',carga:10,series:3,reps:'12-15',obs:''},
  {id:'e27',nome:'Desenvolvimento',grupo:'Ombros',carga:30,series:3,reps:'10-12',obs:'Barra'},
  {id:'e28',nome:'Remada Alta Polia',grupo:'Ombros',carga:30,series:3,reps:'12',obs:''},
  {id:'e29',nome:'Desenvolvimento Máquina',grupo:'Ombros',carga:50,series:3,reps:'10-12',obs:''},
  {id:'e30',nome:'Crucifixo Invertido',grupo:'Ombros',carga:12,series:3,reps:'12-15',obs:'Faz posteriores'},
  // TRAPÉZIO
  {id:'e31',nome:'Encolhimento Smith',grupo:'Trapézio',carga:80,series:3,reps:'12-15',obs:''},
  {id:'e32',nome:'Encolhimento Halter',grupo:'Trapézio',carga:30,series:3,reps:'12-15',obs:''},
  // PEITO
  {id:'e33',nome:'Supino Reto Halter',grupo:'Peito',carga:22,series:3,reps:'10-12',obs:''},
  {id:'e34',nome:'Supino Máquina',grupo:'Peito',carga:70,series:3,reps:'10-12',obs:''},
  {id:'e35',nome:'Crucifixo Máquina',grupo:'Peito',carga:50,series:3,reps:'12-15',obs:''},
  {id:'e36',nome:'Miolo Anilha',grupo:'Peito',carga:20,series:3,reps:'12-15',obs:''},
  {id:'e37',nome:'Supino Incl. Barra',grupo:'Peito',carga:50,series:3,reps:'10-12',obs:'Inclinado 30°'},
  {id:'e38',nome:'Supino Declinado',grupo:'Peito',carga:50,series:3,reps:'10-12',obs:''},
  // PERNAS
  {id:'e39',nome:'Cadeira Adutora',grupo:'Pernas',carga:60,series:3,reps:'15',obs:''},
  {id:'e40',nome:'Cadeira Abdutora',grupo:'Pernas',carga:60,series:3,reps:'15',obs:''},
  {id:'e41',nome:'Elevação Pélvica',grupo:'Pernas',carga:60,series:3,reps:'15',obs:'Glúteo'},
  {id:'e42',nome:'Leg Press Reto',grupo:'Pernas',carga:150,series:3,reps:'12',obs:''},
  {id:'e43',nome:'Hiperextensão Máquina',grupo:'Pernas',carga:50,series:3,reps:'15',obs:'Posterior'},
  {id:'e44',nome:'Levantamento Terra',grupo:'Pernas',carga:80,series:3,reps:'8-10',obs:''},
  {id:'e45',nome:'Cadeira Flexora',grupo:'Pernas',carga:40,series:3,reps:'12-15',obs:'Femoral'},
  {id:'e46',nome:'Mesa Flexora',grupo:'Pernas',carga:45,series:3,reps:'12',obs:'Femoral'},
  {id:'e47',nome:'Cadeira Extensora',grupo:'Pernas',carga:50,series:3,reps:'12-15',obs:'Quadríceps'},
  {id:'e48',nome:'Leg Press 45',grupo:'Pernas',carga:160,series:3,reps:'12',obs:''},
  {id:'e49',nome:'Afundo Smith',grupo:'Pernas',carga:50,series:3,reps:'10-12',obs:'Unilateral'},
  {id:'e50',nome:'Agachamento Sumo',grupo:'Pernas',carga:60,series:3,reps:'12',obs:''},
  {id:'e51',nome:'Agachamento',grupo:'Pernas',carga:70,series:3,reps:'10-12',obs:''},
  // ABDOME
  {id:'e52',nome:'Oblíquo Kettlebell',grupo:'Abdome',carga:16,series:3,reps:'15',obs:''},
  {id:'e53',nome:'Ab Declinado',grupo:'Abdome',carga:0,series:3,reps:'15-20',obs:''},
  {id:'e54',nome:'Ab Reto Máquina',grupo:'Abdome',carga:40,series:3,reps:'15',obs:''},
  // PANTURRILHA
  {id:'e55',nome:'Panturrilha Sentado',grupo:'Panturrilha',carga:50,series:4,reps:'20',obs:''},
  {id:'e56',nome:'Panturrilha em Pé',grupo:'Panturrilha',carga:80,series:4,reps:'20',obs:''},
];

let exercicios=[];
let _exEditId=null;
let fichas=[];  // [{id, nome, exercicios:[{exId, series:[{reps,carga,done}]}]}]
let sessaoAtiva=null;

function treinoStorageKey(){return currentUser?`treino_u${currentUser.id}`:'treino_guest';}
function saveTreino(){localStorage.setItem(treinoStorageKey(),JSON.stringify({exercicios,fichas}));cloudAutoSave('treino',()=>({exercicios,fichas}));}
function loadTreino(){
  try{
    const r=localStorage.getItem(treinoStorageKey());
    if(r){const d=JSON.parse(r);exercicios=d.exercicios||[];fichas=d.fichas||[];}
    else{exercicios=[...EXERCICIOS_DEFAULT];fichas=[];}
  }catch(e){exercicios=[...EXERCICIOS_DEFAULT];fichas=[];}
  if(!exercicios.length)exercicios=[...EXERCICIOS_DEFAULT];
}

// ── Exercícios ──
function openExercicioModal(id){
  _exEditId=id||null;
  const isEdit=!!id;
  const ex=isEdit?exercicios.find(e=>e.id===id):null;
  document.getElementById('ex-modal-title').textContent=isEdit?'Editar exercício':'Novo exercício';
  document.getElementById('ex-del-btn').style.display=isEdit?'inline-flex':'none';
  document.getElementById('ex-nome').value=ex?ex.nome:'';
  document.getElementById('ex-grupo').value=ex?ex.grupo:'Bíceps';
  document.getElementById('ex-carga').value=ex?ex.carga:'';
  document.getElementById('ex-series').value=ex?ex.series:3;
  document.getElementById('ex-reps').value=ex?ex.reps:'12';
  document.getElementById('ex-obs').value=ex?ex.obs:'';
  document.getElementById('exercicio-overlay').classList.add('open');
  setTimeout(()=>document.getElementById('ex-nome').focus(),80);
}
function closeExercicioModal(){document.getElementById('exercicio-overlay').classList.remove('open');_exEditId=null;}
function saveExercicio(){
  const nome=document.getElementById('ex-nome').value.trim();
  if(!nome){showToast('Informe o nome do exercício.');return;}
  const ex={
    id:_exEditId||('e'+Date.now()),
    nome,
    grupo:document.getElementById('ex-grupo').value,
    carga:parseFloat(document.getElementById('ex-carga').value)||0,
    series:parseInt(document.getElementById('ex-series').value)||3,
    reps:document.getElementById('ex-reps').value.trim()||'12',
    obs:document.getElementById('ex-obs').value.trim(),
  };
  if(_exEditId){const i=exercicios.findIndex(e=>e.id===_exEditId);if(i>=0)exercicios[i]=ex;}
  else exercicios.push(ex);
  saveTreino();closeExercicioModal();renderExercicios();showToast(_exEditId?'Exercício atualizado!':'Exercício adicionado!');
}
function deleteExercicio(){
  if(!_exEditId||!confirm('Remover este exercício?'))return;
  exercicios=exercicios.filter(e=>e.id!==_exEditId);
  saveTreino();closeExercicioModal();renderExercicios();showToast('Exercício removido.');
}
const exGrCollapsed={}; // all start collapsed (undefined = collapsed)
function toggleExGrupo(grupo){
  exGrCollapsed[grupo]=!exGrCollapsed[grupo];
  renderExercicios();
}
function renderExercicios(){
  const el=document.getElementById('exercicios-grid');if(!el)return;
  const q=(document.getElementById('ex-search')?.value||'').toLowerCase();
  const gFilter=document.getElementById('ex-grupo-filter')?.value||'';
  const inFicha=new Set(fichas.flatMap(f=>f.exerciciosIds||[]));

  let filtered=exercicios.filter(ex=>{
    const matchQ=!q||ex.nome.toLowerCase().includes(q)||ex.grupo.toLowerCase().includes(q)||(ex.obs||'').toLowerCase().includes(q);
    const matchG=!gFilter||ex.grupo===gFilter;
    return matchQ&&matchG;
  });
  if(!filtered.length){el.innerHTML='<div class="empty"><p>Nenhum exercício encontrado.</p></div>';return;}

  // Sort: active (in ficha) first within each group
  const byGroup={};
  filtered.forEach(ex=>{if(!byGroup[ex.grupo])byGroup[ex.grupo]=[];byGroup[ex.grupo].push(ex);});
  // Sort within each group: active first, then alphabetically
  Object.keys(byGroup).forEach(g=>{
    byGroup[g].sort((a,b)=>{
      const aA=inFicha.has(a.id)?0:1, bA=inFicha.has(b.id)?0:1;
      if(aA!==bA)return aA-bA;
      return a.nome.localeCompare(b.nome,'pt');
    });
  });

  const groupOrder=['Peito','Costas','Ombros','Bíceps','Tríceps','Pernas','Abdome','Panturrilha','Trapézio'];
  const sortedGroups=groupOrder.filter(g=>byGroup[g]).concat(Object.keys(byGroup).filter(g=>!groupOrder.includes(g)));
  const gcRgbMap={'var(--accent)':'79,142,247','var(--green)':'62,207,142','var(--amber)':'245,166,35','var(--red)':'242,95,92','var(--purple)':'155,103,255'};
  const grupoRgb={'Bíceps':'79,142,247','Tríceps':'155,103,255','Costas':'62,207,142','Ombros':'245,166,35','Peito':'242,95,92','Pernas':'56,189,248','Abdome':'251,191,36','Panturrilha':'163,230,53','Trapézio':'136,146,164'};

  // Build HTML: each group header spans all 3 cols, items are draggable
  let html='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;align-items:start">';
  sortedGroups.forEach(grupo=>{
    const gc=GRUPO_COLORS[grupo]||{bg:'var(--bg3)',color:'var(--text2)'};
    const gcRgb=grupoRgb[grupo]||gcRgbMap[gc.color]||'136,146,164';
    const isOpen=exGrCollapsed[grupo]===true; // default collapsed (undefined=false)
    // Clickable header spanning all 3 columns
    html+=`<div style="grid-column:1/-1;display:flex;align-items:center;gap:8px;margin-top:12px;cursor:pointer;user-select:none;padding:6px 10px;border-radius:var(--radius-lg);background:${gc.bg};border:1px solid rgba(${gcRgb},.2)" onclick="exGrCollapsed['${grupo}']=!exGrCollapsed['${grupo}'];renderExercicios()">
      <div style="width:10px;height:10px;border-radius:50%;background:${gc.color};flex-shrink:0"></div>
      <span style="font-size:13px;font-weight:700;color:${gc.color};font-family:var(--font);flex:1">${grupo}</span>
      <span style="font-size:11px;color:${gc.color};opacity:.7;font-family:var(--font)">${byGroup[grupo].length} ex.</span>
      <svg viewBox="0 0 24 24" fill="${gc.color}" style="width:18px;height:18px;opacity:.8;transition:transform .2s;transform:${isOpen?'rotate(0deg)':'rotate(-90deg)'}"><path d="M7 10l5 5 5-5z"/></svg>
    </div>`;
    if(!isOpen) return; // collapsed: skip rendering cards
    // Exercise cards
    byGroup[grupo].forEach(ex=>{
      const active=inFicha.has(ex.id);
      const rowBg=active?`rgba(${gcRgb},.07)`:'var(--bg2)';
      const rowBorder=active?`1px solid rgba(${gcRgb},.2)`:'1px solid var(--border)';
      const activeBadge=active?`<span style="font-size:9px;color:var(--green);opacity:.8">✓</span>`:'';
      html+=`<div draggable="true"
        data-exid="${ex.id}" data-grupo="${grupo}"
        ondragstart="exDragStart(event,this)"
        ondragover="exDragOver(event,this)"
        ondrop="exDrop(event,this)"
        ondragend="exDragEnd()"
        style="background:${rowBg};border:${rowBorder};border-radius:var(--radius-lg);padding:10px 12px;display:flex;flex-direction:column;gap:7px;cursor:grab;transition:opacity .15s,box-shadow .15s">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="color:var(--text3);font-size:12px;cursor:grab;flex-shrink:0" title="Arrastar">⠿</span>
          <span style="flex:1;font-size:12px;font-weight:${active?600:400};color:var(--text);font-family:var(--font);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ex.nome}${active?'<span style="font-size:9px;margin-left:4px;opacity:.5;color:var(--green)">✓</span>':''}</span>
          ${activeBadge}
          <button class="btn-icon" onclick="openCargaHist('${ex.id}')" title="Histórico" style="color:var(--text3);flex-shrink:0"><svg viewBox="0 0 24 24" fill="currentColor" style="width:12px;height:12px"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/></svg></button>
          <button class="btn-icon" onclick="openExercicioModal('${ex.id}')" title="Editar" style="color:var(--text3);flex-shrink:0"><svg viewBox="0 0 24 24" fill="currentColor" style="width:12px;height:12px"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px">
          <div><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.4px;font-family:var(--font);margin-bottom:2px">Carga</div>
            <input type="number" value="${ex.carga}" step="0.5" min="0" style="background:var(--bg3);border:1px solid var(--border2);border-radius:4px;color:var(--text);font-family:var(--mono);font-size:12px;padding:3px 0;text-align:center;width:100%" onchange="exInlineUpdate('${ex.id}','carga',this.value)"></div>
          <div><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.4px;font-family:var(--font);margin-bottom:2px">Séries</div>
            <input type="number" value="${ex.series}" min="1" max="10" style="background:var(--bg3);border:1px solid var(--border2);border-radius:4px;color:var(--text);font-family:var(--mono);font-size:12px;padding:3px 0;text-align:center;width:100%" onchange="exInlineUpdate('${ex.id}','series',this.value)"></div>
          <div><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.4px;font-family:var(--font);margin-bottom:2px">Reps</div>
            <input type="text" value="${ex.reps}" style="background:var(--bg3);border:1px solid var(--border2);border-radius:4px;color:var(--text);font-family:var(--mono);font-size:12px;padding:3px 0;text-align:center;width:100%" onchange="exInlineUpdate('${ex.id}','reps',this.value)"></div>
        </div>
        ${ex.obs?`<div style="font-size:10px;color:var(--text3);font-family:var(--font)">💡 ${ex.obs}</div>`:''}
      </div>`;
    });
  });
  html+='</div>';
  el.innerHTML=html;
}
// Drag-and-drop for exercises
let exDragSrc=null;
function exDragStart(e,el){
  exDragSrc=el;
  e.dataTransfer.effectAllowed='move';
  setTimeout(()=>el.style.opacity='.4',0);
}
function exDragOver(e,el){
  e.preventDefault();
  if(el===exDragSrc||el.dataset.grupo!==exDragSrc?.dataset.grupo)return;
  el.style.boxShadow='0 0 0 2px var(--accent)';
}
function exDragEnd(){
  document.querySelectorAll('[data-exid]').forEach(el=>{el.style.opacity='';el.style.boxShadow='';});
  exDragSrc=null;
}
function exDrop(e,el){
  e.preventDefault();
  if(!exDragSrc||el===exDragSrc||el.dataset.grupo!==exDragSrc.dataset.grupo)return;
  const fromId=exDragSrc.dataset.exid, toId=el.dataset.exid;
  const fi=exercicios.findIndex(x=>x.id===fromId), ti=exercicios.findIndex(x=>x.id===toId);
  if(fi<0||ti<0)return;
  const [moved]=exercicios.splice(fi,1);
  exercicios.splice(ti,0,moved);
  saveTreino();renderExercicios();
}

function exInlineUpdate(id,field,val){
  const ex=exercicios.find(e=>e.id===id);if(!ex)return;
  if(field==='carga'){
    const newVal=parseFloat(val)||0;
    if(newVal!==ex.carga) recordCargaHistory(id, ex.carga, newVal);
    ex.carga=newVal;
  } else if(field==='series') ex.series=parseInt(val)||1;
  else if(field==='reps') ex.reps=val.trim();
  saveTreino();
}
function recordCargaHistory(exId, oldVal, newVal){
  const key=treinoStorageKey()+'_ch';
  const hist=JSON.parse(localStorage.getItem(key)||'{}');
  if(!hist[exId]) hist[exId]=[];
  hist[exId].push({date:new Date().toISOString().slice(0,10), val:newVal, prev:oldVal});
  hist[exId]=hist[exId].slice(-60); // keep last 60 entries
  localStorage.setItem(key, JSON.stringify(hist));
  cloudAutoSave('treino_ch',()=>JSON.parse(localStorage.getItem(key)||'{}'));
}
function getCargaHistory(exId){
  const key=treinoStorageKey()+'_ch';
  const hist=JSON.parse(localStorage.getItem(key)||'{}');
  return hist[exId]||[];
}

// ── Treino Atual ──
function renderTreinoAtual(){
  const el=document.getElementById('treino-atual-content');if(!el)return;
  if(!fichas.length){
    el.innerHTML=`<div class="empty" style="padding:60px 20px;text-align:center">
      <div style="font-size:52px;margin-bottom:14px">🏋</div>
      <p style="font-size:16px;font-weight:600;font-family:var(--font);margin-bottom:6px">Nenhuma ficha criada</p>
      <p style="color:var(--text3);font-family:var(--font);margin-bottom:20px">Organize seus treinos por dia ou grupo muscular</p>
      <button class="btn btn-primary" onclick="treinoNovaFicha()" style="font-family:var(--font)">+ Criar primeira ficha</button>
    </div>`;return;
  }

  const inp=(val,type,title,onChange,extra='')=>
    `<input type="${type}" value="${val}" title="${title}" ${extra}
      style="background:var(--bg4);border:1px solid var(--border);border-radius:5px;color:var(--text);font-family:var(--mono);font-size:12px;padding:4px 5px;text-align:center;width:100%;outline:none;min-width:0"
      onchange="${onChange}">`;

  el.innerHTML='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;align-items:start">'+
  fichas.map(f=>{
    const exs=(f.exerciciosIds||[]).map(id=>exercicios.find(e=>e.id===id)).filter(Boolean);
    const hasColor=f.bgColorHex&&f.bgColorHex!=='#1e2433';
    const cardBg=f.bgColor||'var(--bg2)';
    const borderColor=hasColor?`rgba(${f._rgb||'79,142,247'},.35)`:'var(--border)';

    // Grid: 12px handle | 1fr name | 1fr kg+series+reps
    const header=`<div style="display:grid;grid-template-columns:12px 1fr 1fr;gap:8px;padding:4px 0 6px;border-bottom:1px solid var(--border2);margin-bottom:1px">
      <span></span>
      <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);font-family:var(--font)">Exercício</span>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px">
        <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);font-family:var(--font);text-align:center">kg</span>
        <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);font-family:var(--font);text-align:center">Sér</span>
        <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);font-family:var(--font);text-align:center">Rep</span>
      </div>
    </div>`;

    const tableRows=exs.map((ex,idx)=>`
      <div draggable="true" data-fichaid="${f.id}" data-exidx="${idx}"
        ondragstart="fichaDragStart(event,this)"
        ondragover="fichaDragOver(event,this)"
        ondrop="fichaDrop(event,this)"
        ondragend="fichaDragEnd()"
        style="display:grid;grid-template-columns:12px 1fr 1fr;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid var(--border);cursor:grab;min-width:0">
        <span style="color:var(--text3);font-size:11px;cursor:grab;user-select:none;flex-shrink:0">⠿</span>
        <span style="font-size:12px;color:var(--text);font-family:var(--font);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">${ex.nome}</span>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;min-width:0">
          ${inp(ex.carga,'number','Carga kg',`treinoUpdateCarga('${ex.id}',this.value)`,'step="0.5" min="0"')}
          ${inp(ex.series,'number','Séries',`treinoUpdateSeries('${ex.id}',this.value)`,'min="1" max="20"')}
          ${inp(ex.reps,'text','Repetições',`treinoUpdateReps('${ex.id}',this.value)`)}
        </div>
      </div>`).join('');

    return`<div style="background:${cardBg};border:1px solid ${borderColor};border-radius:12px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:5px;padding:10px 14px;border-bottom:1px solid var(--border);background:rgba(0,0,0,.12)">
        <span style="font-size:13px;font-weight:700;font-family:var(--font);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">💪 ${f.nome}</span>
        <input type="color" value="${f.bgColorHex||'#1e2433'}" title="Cor de fundo"
          style="width:18px;height:18px;border:none;border-radius:50%;cursor:pointer;padding:0;background:none;flex-shrink:0;opacity:.7"
          onchange="treinoSetFichaColor('${f.id}',this.value)">
        <button onclick="treinoIniciarFicha('${f.id}')" style="background:rgba(62,207,142,.15);border:1px solid rgba(62,207,142,.3);border-radius:6px;cursor:pointer;color:var(--green);padding:3px 8px;font-size:11px;font-family:var(--font);font-weight:600">▶</button>
        <button onclick="treinoEditarFicha('${f.id}')" style="background:none;border:none;cursor:pointer;color:var(--text3);padding:3px 5px;font-size:12px">✏</button>
        <button onclick="treinoDeleteFicha('${f.id}')" style="background:none;border:none;cursor:pointer;color:var(--red);opacity:.6;padding:3px 5px;font-size:13px">×</button>
      </div>
      <div style="padding:6px 14px ${exs.length?'2px':'10px'}">
        ${exs.length?header+tableRows:'<p style="font-size:12px;color:var(--text3);font-family:var(--font);padding:8px 0;margin:0">Nenhum exercício. Clique em ✏.</p>'}
      </div>
      <div style="padding:4px 14px 12px">
        <textarea placeholder="Observações…" rows="2"
          style="width:100%;background:var(--bg4);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:var(--font);font-size:11px;padding:6px 8px;resize:none;outline:none"
          onchange="treinoUpdateObs('${f.id}',this.value)">${f.obs||''}</textarea>
      </div>
    </div>`;
  }).join('')+'</div>';
}
function treinoUpdateSeries(exId,val){
  const ex=exercicios.find(e=>e.id===exId);if(!ex)return;
  ex.series=parseInt(val)||1;saveTreino();
}
function treinoSetFichaColor(fichaId,hex){
  const f=fichas.find(x=>x.id===fichaId);if(!f)return;
  f.bgColorHex=hex;
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  f._rgb=`${r},${g},${b}`;
  f.bgColor=`rgba(${r},${g},${b},.18)`;
  saveTreino();renderTreinoAtual();
}
// Drag-and-drop for exercises inside a ficha
let fichaDragSrcEl=null, fichaDragSrcFicha=null, fichaDragSrcIdx=null;
function fichaDragStart(e,el){
  fichaDragSrcEl=el;fichaDragSrcFicha=el.dataset.fichaid;fichaDragSrcIdx=parseInt(el.dataset.exidx);
  e.dataTransfer.effectAllowed='move';
  setTimeout(()=>el.style.opacity='.4',0);
}
function fichaDragOver(e,el){
  e.preventDefault();
  if(el===fichaDragSrcEl||el.dataset.fichaid!==fichaDragSrcFicha)return;
  el.style.boxShadow='0 -2px 0 var(--accent)';
}
function fichaDragEnd(){
  document.querySelectorAll('[data-fichaid]').forEach(el=>{el.style.opacity='';el.style.boxShadow='';});
  fichaDragSrcEl=null;
}
function fichaDrop(e,el){
  e.preventDefault();
  if(!fichaDragSrcEl||el===fichaDragSrcEl||el.dataset.fichaid!==fichaDragSrcFicha)return;
  const toIdx=parseInt(el.dataset.exidx);
  const f=fichas.find(x=>x.id===fichaDragSrcFicha);if(!f)return;
  const [moved]=f.exerciciosIds.splice(fichaDragSrcIdx,1);
  f.exerciciosIds.splice(toIdx,0,moved);
  saveTreino();renderTreinoAtual();
}

function treinoUpdateCarga(exId,val){
  const ex=exercicios.find(e=>e.id===exId);if(!ex)return;
  const newVal=parseFloat(val)||0;
  if(newVal!==ex.carga) recordCargaHistory(exId, ex.carga, newVal);
  ex.carga=newVal;saveTreino();
}
function treinoUpdateObs(fichaId,val){
  const f=fichas.find(x=>x.id===fichaId);if(!f)return;
  f.obs=val;saveTreino();
}
function treinoNovaFicha(){
  const nome=prompt('Nome da ficha (ex: Treino A, Treino B, Peito/Tríceps…):');
  if(!nome)return;
  fichas.push({id:'f'+Date.now(),nome,exerciciosIds:[]});
  saveTreino();renderTreinoAtual();showToast(`Ficha "${nome}" criada!`);
}
function treinoDeleteFicha(id){
  if(!confirm('Remover esta ficha?'))return;
  fichas=fichas.filter(f=>f.id!==id);
  saveTreino();renderTreinoAtual();
}
function treinoEditarFicha(id){
  const f=fichas.find(x=>x.id===id);if(!f)return;
  // Simple: let user pick exercises from a prompt-like checkbox interface
  const allGroups=['Peito','Costas','Ombros','Bíceps','Tríceps','Pernas','Abdome','Panturrilha','Trapézio'];
  const grouped={};
  exercicios.forEach(ex=>{if(!grouped[ex.grupo])grouped[ex.grupo]=[];grouped[ex.grupo].push(ex);});
  const overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
  overlay.innerHTML=`<div style="background:var(--bg2);border:1px solid var(--border2);border-radius:var(--radius-lg);width:580px;max-width:95vw;max-height:85vh;overflow:hidden;display:flex;flex-direction:column">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border)">
      <div style="font-size:15px;font-weight:600;font-family:var(--font)">Editar ficha: ${f.nome}</div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;cursor:pointer;color:var(--text2);font-size:20px">×</button>
    </div>
    <div style="overflow-y:auto;padding:16px 20px;flex:1">
      ${allGroups.filter(g=>grouped[g]).map(g=>`
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text3);margin:10px 0 6px;font-family:var(--font)">${g}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px">
          ${(grouped[g]||[]).map(ex=>{const checked=f.exerciciosIds?.includes(ex.id);const gc=GRUPO_COLORS[g]||{bg:'var(--bg3)',color:'var(--text2)'};return`<label style="display:flex;align-items:center;gap:5px;cursor:pointer;padding:4px 9px;border-radius:8px;background:${checked?gc.bg:'var(--bg3)'};border:1px solid ${checked?gc.color:'transparent'};transition:all .15s;font-family:var(--font);font-size:12px"><input type="checkbox" value="${ex.id}" ${checked?'checked':''} style="display:none" onchange="this.closest('label').style.background=this.checked?'${gc.bg}':'var(--bg3)';this.closest('label').style.borderColor=this.checked?'${gc.color}':'transparent'"> ${ex.nome}</label>`;}).join('')}
        </div>`).join('')}
    </div>
    <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
      <button class="btn btn-ghost" onclick="this.closest('[style*=fixed]').remove()" style="font-family:var(--font)">Cancelar</button>
      <button class="btn btn-primary" onclick="
        const ids=[...this.closest('[style*=fixed]').querySelectorAll('input:checked')].map(i=>i.value);
        const f2=fichas.find(x=>x.id==='${f.id}');if(f2)f2.exerciciosIds=ids;
        saveTreino();renderTreinoAtual();this.closest('[style*=fixed]').remove();showToast('Ficha atualizada!');
      " style="font-family:var(--font)">Salvar</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
}
function treinoIniciarFicha(fichaId){
  const f=fichas.find(x=>x.id===fichaId);if(!f)return;
  const exs=(f.exerciciosIds||[]).map(id=>exercicios.find(e=>e.id===id)).filter(Boolean);
  if(!exs.length){showToast('Adicione exercícios a esta ficha primeiro.');treinoEditarFicha(fichaId);return;}
  cronometroStart(f.id, f.nome);
  const el=document.getElementById('treino-atual-content');if(!el)return;
  el.innerHTML=`<div style="background:var(--bg2);border:1px solid var(--green-border);border-radius:var(--radius-lg);padding:16px 20px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-size:15px;font-weight:600;font-family:var(--font);color:var(--green)">▶ ${f.nome}</div>
      <button class="btn btn-ghost btn-sm" onclick="renderTreinoAtual()" style="font-family:var(--font)">✕ Encerrar</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
    ${exs.map(ex=>{const gc=GRUPO_COLORS[ex.grupo]||{};return`
      <div style="background:var(--bg3);border-radius:var(--radius-lg);padding:12px 14px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:13px;font-weight:600;font-family:var(--font)">${ex.nome}</span>
          <span style="font-size:10px;padding:2px 8px;border-radius:8px;background:${gc.bg||'var(--bg4)'};color:${gc.color||'var(--text3)'};font-family:var(--font)">${ex.grupo}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
          <label style="font-size:11px;color:var(--text3);font-family:var(--font)">Carga:</label>
          <input type="number" value="${ex.carga}" step="0.5" min="0"
            style="width:64px;background:var(--bg2);border:1px solid var(--border2);border-radius:4px;color:var(--text);font-family:var(--mono);font-size:13px;font-weight:600;padding:3px 7px;text-align:center"
            onchange="treinoUpdateCarga('${ex.id}',this.value)">
          <span style="font-size:11px;color:var(--text3)">kg</span>
          <label style="font-size:11px;color:var(--text3);font-family:var(--font);margin-left:8px">Reps:</label>
          <input type="text" value="${ex.reps}"
            style="width:56px;background:var(--bg2);border:1px solid var(--border2);border-radius:4px;color:var(--text);font-family:var(--mono);font-size:13px;font-weight:600;padding:3px 7px;text-align:center"
            onchange="treinoUpdateReps('${ex.id}',this.value)">
        </div>
        <div style="display:grid;grid-template-columns:repeat(${ex.series},1fr);gap:5px">
          ${Array.from({length:ex.series},(_,i)=>`
            <div style="background:var(--bg2);border:2px solid var(--border);border-radius:var(--radius);padding:8px 4px;text-align:center;cursor:pointer;transition:all .15s;user-select:none"
              onclick="this.dataset.done=this.dataset.done?'':'1';this.style.background=this.dataset.done?'var(--green-bg)':'var(--bg2)';this.style.borderColor=this.dataset.done?'var(--green)':'var(--border)';this.style.color=this.dataset.done?'var(--green)':'inherit'">
              <div style="font-size:9px;color:inherit;opacity:.7;font-family:var(--font);margin-bottom:2px">Série ${i+1}</div>
              <div style="font-family:var(--mono);font-size:12px;font-weight:600">${ex.reps}</div>
            </div>`).join('')}
        </div>
      </div>`}).join('')}
    </div>
  </div>`;
}
function treinoUpdateReps(exId,val){
  const ex=exercicios.find(e=>e.id===exId);if(!ex)return;
  ex.reps=val.trim();saveTreino();
}
function treinoIniciarSessao(){
  if(!fichas.length){showToast('Crie uma ficha primeiro.');return;}
  // Let user pick a ficha
  treinoIniciarFicha(fichas[0].id);
}

// ── Toggle Treino subnav ──
function toggleTreino(btn){
  const subnav=document.getElementById('treino-subnav');
  const isOpen=subnav.style.display!=='none';
  const onTreinoPages=['treino-atual','treino-exercicios'].some(id=>document.getElementById('page-'+id)?.classList.contains('active'));
  if(isOpen&&onTreinoPages){
    subnav.style.display='none';btn.classList.remove('active');
  } else {
    subnav.style.display='block';btn.classList.add('active');
    showPage('treino-atual',document.querySelector('#treino-subnav .fin-sub[onclick*=treino-atual]'));
  }
}

// ── Cronômetro ──────────────────────────────────────────────────
let cronoInterval=null;
let cronoStart=null;
let cronoPaused=false;
let cronoPausedAt=0;
let cronoTotalPaused=0;
let cronoFichaId=null;
let cronoFichaNome='';

function cronometroStart(fichaId,fichaNome){
  // Clear any existing timer
  if(cronoInterval)clearInterval(cronoInterval);
  cronoStart=Date.now();
  cronoPaused=false;cronoPausedAt=0;cronoTotalPaused=0;
  cronoFichaId=fichaId;cronoFichaNome=fichaNome;
  const overlay=document.getElementById('cronometro-overlay');
  if(overlay)overlay.style.display='block';
  const nameEl=document.getElementById('crono-ficha-name');
  if(nameEl)nameEl.textContent=fichaNome;
  const pauseBtn=document.getElementById('crono-pause-btn');
  if(pauseBtn)pauseBtn.textContent='⏸ Pausar';
  cronoInterval=setInterval(()=>{
    if(cronoPaused)return;
    const elapsed=Date.now()-cronoStart-cronoTotalPaused;
    const h=Math.floor(elapsed/3600000),m=Math.floor((elapsed%3600000)/60000),s=Math.floor((elapsed%60000)/1000);
    const disp=document.getElementById('crono-display');
    if(disp)disp.textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  },500);
}
function cronometroTogglePause(){
  cronoPaused=!cronoPaused;
  if(cronoPaused){cronoPausedAt=Date.now();}
  else{cronoTotalPaused+=Date.now()-cronoPausedAt;}
  const btn=document.getElementById('crono-pause-btn');
  if(btn)btn.textContent=cronoPaused?'▶ Retomar':'⏸ Pausar';
}
function cronometroStop(){
  if(cronoInterval)clearInterval(cronoInterval);
  cronoInterval=null;
  const overlay=document.getElementById('cronometro-overlay');
  if(overlay)overlay.style.display='none';
}
function cronometroFinish(){
  if(!cronoStart)return;
  const elapsed=Date.now()-cronoStart-cronoTotalPaused;
  const mins=Math.round(elapsed/60000);
  const h=Math.floor(mins/60),m=mins%60;
  const durStr=h>0?`${h}h${String(m).padStart(2,'0')}min`:`${m}min`;
  const reg={
    id:'reg'+Date.now(),
    fichaId:cronoFichaId,
    fichaNome:cronoFichaNome,
    data:new Date().toISOString().slice(0,10),
    hora:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),
    duracao:durStr,
    duracaoMs:elapsed,
  };
  const registros=JSON.parse(localStorage.getItem(treinoStorageKey()+'_reg')||'[]');
  registros.unshift(reg);
  localStorage.setItem(treinoStorageKey()+'_reg',JSON.stringify(registros.slice(0,100)));
  cloudAutoSave('treino_reg',()=>registros.slice(0,100));
  cronometroStop();
  showToast(`✅ Treino finalizado! Duração: ${durStr}`);
  // Refresh registros page if active
  if(document.getElementById('page-treino-registros')?.classList.contains('active'))renderTreinoRegistros();
}

// ── Registros ──────────────────────────────────────────────────
function renderTreinoRegistros(){
  const el=document.getElementById('treino-registros-content');if(!el)return;
  const registros=JSON.parse(localStorage.getItem(treinoStorageKey()+'_reg')||'[]');
  if(!registros.length){
    el.innerHTML=`<div class="empty" style="padding:40px;text-align:center">
      <div style="font-size:48px;margin-bottom:12px">📈</div>
      <p style="font-size:15px;font-weight:600;font-family:var(--font)">Nenhum registro ainda</p>
      <p style="color:var(--text3);font-family:var(--font)">Inicie um treino e finalize para registrar aqui.</p>
    </div>`;return;
  }
  const totalSessoes=registros.length;
  const totalMs=registros.reduce((s,r)=>s+(r.duracaoMs||0),0);
  const avgMs=totalMs/totalSessoes;
  const fmtMs=ms=>{const m=Math.round(ms/60000);const h=Math.floor(m/60);return h>0?`${h}h${String(m%60).padStart(2,'0')}min`:`${m}min`;};
  el.innerHTML=`
    <div class="kpis" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
      <div class="kpi"><div class="kpi-top"><div class="kpi-icon green"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2.05v2.02c3.95.49 7 3.85 7 7.93 0 3.21-1.81 6-4.72 7.28L13 17v5h5l-1.22-1.22C19.91 19.07 22 15.76 22 12c0-5.18-3.95-9.45-9-9.95zM11 2.05C5.95 2.55 2 6.82 2 12c0 3.76 2.09 7.07 5.22 8.78L6 22h5V2.05z"/></svg></div><div class="kpi-label" style="font-family:var(--font)">Sessões</div></div><div class="kpi-val green" style="font-family:var(--mono)">${totalSessoes}</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-icon amber"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg></div><div class="kpi-label" style="font-family:var(--font)">Tempo total</div></div><div class="kpi-val amber" style="font-family:var(--mono)">${fmtMs(totalMs)}</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-icon blue"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg></div><div class="kpi-label" style="font-family:var(--font)">Média por sessão</div></div><div class="kpi-val" style="font-family:var(--mono)">${fmtMs(avgMs)}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px">
      ${registros.map(r=>`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px 16px;display:flex;align-items:center;gap:10px">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;font-family:var(--font);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">💪 ${r.fichaNome}</div>
          <div style="font-size:11px;color:var(--text3);font-family:var(--font);margin-top:2px">${fmtData(r.data)} · ${r.hora}</div>
        </div>
        <span style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--green);white-space:nowrap">${r.duracao}</span>
        <button onclick="treinoDeleteRegistro('${r.id}')"
          style="background:none;border:none;cursor:pointer;color:var(--text3);padding:2px;border-radius:4px;flex-shrink:0;transition:color var(--tr)"
          onmouseenter="this.style.color='var(--red)'" onmouseleave="this.style.color='var(--text3)'"
          title="Excluir registro">
          <svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>`).join('')}
    </div>`;
}
function treinoDeleteRegistro(id){
  let registros=JSON.parse(localStorage.getItem(treinoStorageKey()+'_reg')||'[]');
  registros=registros.filter(r=>r.id!==id);
  localStorage.setItem(treinoStorageKey()+'_reg',JSON.stringify(registros));
  renderTreinoRegistros();
}
function treinoClearRegistros(){
  if(!confirm('Limpar todo o histórico de treinos?'))return;
  localStorage.removeItem(treinoStorageKey()+'_reg');
  renderTreinoRegistros();showToast('Histórico limpo.');
}

// ── Histórico de carga ──────────────────────────────────────────
let _cargaHistChart=null;
window._cargaHistId=null;
function openCargaHist(exId){
  const ex=exercicios.find(e=>e.id===exId);if(!ex)return;
  window._cargaHistId=exId;
  const hist=getCargaHistory(exId);
  document.getElementById('carga-hist-title').textContent=ex.nome;
  const sub=document.getElementById('carga-hist-sub');
  const gain=hist.length>=2?hist[hist.length-1].val-hist[0].val:0;
  sub.textContent=hist.length?`${hist.length} registro${hist.length!==1?'s':''} · Carga atual: ${ex.carga}kg${gain!==0?' · Evolução: '+(gain>0?'+':'')+gain+'kg':''}`:'Sem histórico ainda — edite a carga para registrar';
  document.getElementById('carga-hist-overlay').classList.add('open');
  // Draw chart
  const canvas=document.getElementById('carga-hist-chart');
  if(_cargaHistChart){_cargaHistChart.destroy();_cargaHistChart=null;}
  if(hist.length<2){
    canvas.style.display='none';
  } else {
    canvas.style.display='block';
    const isLight=document.body.classList.contains('light');
    const textColor=isLight?'#5a6478':'#8892a4';
    const gridColor=isLight?'rgba(0,0,0,.06)':'rgba(255,255,255,.05)';
    _cargaHistChart=new Chart(canvas,{type:'line',
      data:{
        labels:hist.map(h=>h.date.slice(5)), // MM-DD
        datasets:[{
          label:'Carga (kg)',
          data:hist.map(h=>h.val),
          borderColor:'rgba(79,142,247,.9)',
          backgroundColor:'rgba(79,142,247,.1)',
          borderWidth:2,pointRadius:4,pointBackgroundColor:'rgba(79,142,247,1)',
          tension:0.3,fill:true
        }]
      },
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},
          tooltip:{callbacks:{label:ctx=>`${ctx.raw}kg`}}},
        scales:{
          x:{ticks:{color:textColor,font:{family:'DM Mono',size:10}},grid:{color:gridColor}},
          y:{ticks:{color:textColor,font:{family:'DM Mono',size:10},callback:v=>v+'kg'},grid:{color:gridColor}}
        }
      }
    });
  }
  // List
  const listEl=document.getElementById('carga-hist-list');
  if(!hist.length){
    listEl.innerHTML='<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;font-family:var(--font)">Nenhum registro. Altere a carga para criar o primeiro.</div>';
    return;
  }
  listEl.innerHTML=hist.slice().reverse().map(h=>{
    const delta=h.val-h.prev;
    const color=delta>0?'var(--green)':delta<0?'var(--red)':'var(--text3)';
    const arrow=delta>0?'↑':delta<0?'↓':'→';
    return`<div style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-bottom:1px solid var(--border);font-size:12px">
      <span style="font-family:var(--mono);color:var(--text3);width:68px;flex-shrink:0">${h.date}</span>
      <span style="font-family:var(--mono);font-weight:600;color:var(--text)">${h.val}kg</span>
      <span style="font-size:11px;font-family:var(--mono);color:${color}">${arrow} ${Math.abs(delta)}kg ${delta>0?'▲':'▼'}</span>
      <span style="font-size:10px;color:var(--text3);font-family:var(--font)">anterior: ${h.prev}kg</span>
    </div>`;
  }).join('');
}
function closeCargaHist(){
  document.getElementById('carga-hist-overlay').classList.remove('open');
  if(_cargaHistChart){_cargaHistChart.destroy();_cargaHistChart=null;}
  window._cargaHistId=null;
}
function clearCargaHist(exId){
  if(!exId||!confirm('Limpar histórico de carga deste exercício?'))return;
  const key=treinoStorageKey()+'_ch';
  const hist=JSON.parse(localStorage.getItem(key)||'{}');
  delete hist[exId];
  localStorage.setItem(key,JSON.stringify(hist));
  openCargaHist(exId);showToast('Histórico limpo.');
}

// ── Notificação 2h antes do plantão ──────────────────────────────
function scheduleNotifications(){
  if(notifPermission!=='granted')return;
  const now=new Date();
  const in2h=new Date(now.getTime()+2*3600*1000);
  const in2hMinus5=new Date(in2h.getTime()-5*60*1000);
  plantoes.forEach(p=>{
    if(!p.data||!p.ini)return;
    const[h,m]=p.ini.split(':').map(Number);
    const start=new Date(p.data+'T00:00:00');start.setHours(h,m,0,0);
    // Fire if plantão starts within the next 2h window (±5min)
    if(start>=in2hMinus5&&start<=in2h){
      const diff=Math.round((start-now)/60000);
      new Notification(`🏥 Plantão em ${diff} minutos!`,{
        body:`${p.local} · ${p.ini}–${p.fim} · ${p.tipo}`,
        icon:'/favicon.ico',
        tag:'plantao-2h-'+p.id,
        requireInteraction:true
      });
    }
    // Also notify for today's plantões starting soon (< 30min)
    if(start>now&&start<=new Date(now.getTime()+30*60*1000)){
      const diff=Math.round((start-now)/60000);
      new Notification(`⏰ Plantão em ${diff} min!`,{
        body:`${p.local} · ${p.ini}–${p.fim}`,
        icon:'/favicon.ico',
        tag:'plantao-30m-'+p.id
      });
    }
  });
  // Vencimentos urgentes
  const today2=new Date();today2.setHours(0,0,0,0);
  const allGfVenc=[...finGF.fixo,...finGF.semifixo,...finGF.variavel].filter(i=>i.venc);
  const urgent=allGfVenc.filter(item=>{
    let vDate=new Date(today2.getFullYear(),today2.getMonth(),item.venc);
    if(vDate<today2)vDate=new Date(today2.getFullYear(),today2.getMonth()+1,item.venc);
    return Math.round((vDate-today2)/(1000*60*60*24))<=1;
  });
  if(urgent.length){
    new Notification('💳 Vencimento(s) urgente(s)',{
      body:urgent.map(i=>`${i.name}: R$ ${i.value}`).join(', '),
      icon:'/favicon.ico',tag:'vencimento'
    });
  }
}

// ── Gerenciar Categorias de Lançamento ─────────────────────────
function finOpenCatsModal(){
  finRenderCatsList();
  finOpenModal('fin-modal-cats');
}
function finRenderCatsList(){
  const el=document.getElementById('fin-cats-list');if(!el)return;
  el.innerHTML=finCAT_E.map(cat=>`
    <div style="display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px solid var(--border)">
      <span style="font-size:16px;flex-shrink:0">${cat.icon}</span>
      <span style="flex:1;font-size:13px;font-family:var(--font);color:var(--text)">${cat.name}</span>
      ${cat.builtin?'<span style="font-size:10px;color:var(--text3);font-family:var(--font)">padrão</span>':
        `<button onclick="finDeleteCat('${cat.id}')" style="background:none;border:none;cursor:pointer;color:var(--text3);padding:2px" onmouseenter="this.style.color='var(--red)'" onmouseleave="this.style.color='var(--text3)'" title="Remover">
          <svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>`}
    </div>`).join('');
}
function finAddCat(){
  const icon=document.getElementById('fin-cat-icon').value.trim()||'📌';
  const name=document.getElementById('fin-cat-name').value.trim();
  if(!name){showToast('Informe o nome da categoria.');return;}
  const id='cat_'+Date.now();
  finCAT_E.push({id,name,icon});
  finSaveCats();finRenderCatsList();
  document.getElementById('fin-cat-icon').value='';
  document.getElementById('fin-cat-name').value='';
  // Refresh dropdowns
  finRenderGastos();showToast('Categoria adicionada!');
}
function finDeleteCat(id){
  const inUse=finTXS.some(t=>t.cat===id);
  if(inUse&&!confirm('Esta categoria está em uso em alguns lançamentos. Remover mesmo assim?'))return;
  finCAT_E=finCAT_E.filter(c=>c.id!==id);
  finSaveCats();finRenderCatsList();finRenderGastos();showToast('Categoria removida.');
}

// ── Export / Import local data ──────────────────────────────────
function exportLocalData(){
  if(!currentUser){showToast('Faça login primeiro.');return;}
  const uid=currentUser.id;
  const snapshot={
    _version:1,
    _user:currentUser.username,
    _date:new Date().toISOString(),
    eventos:JSON.parse(localStorage.getItem(`eventos_u${uid}`)||'[]'),
    tarefas:JSON.parse(localStorage.getItem(`tarefas_u${uid}`)||'{}'),
    treino:JSON.parse(localStorage.getItem(`treino_u${uid}`)||'{}'),
    treino_reg:JSON.parse(localStorage.getItem(`treino_u${uid}_reg`)||'[]'),
    treino_ch:JSON.parse(localStorage.getItem(`treino_u${uid}_ch`)||'{}'),
    fin_gf:JSON.parse(localStorage.getItem(`fin4_u${uid}_gf`)||'null'),
    fin_txs:JSON.parse(localStorage.getItem(`fin4_u${uid}_txs`)||'[]'),
    fin_meta:JSON.parse(localStorage.getItem(`fin4_u${uid}_meta`)||'0'),
    fin_saldo:JSON.parse(localStorage.getItem(`fin4_u${uid}_saldo`)||'0'),
    fin_rv:JSON.parse(localStorage.getItem(`fin4_u${uid}_rv_overrides`)||'{}'),
    fin_recs:JSON.parse(localStorage.getItem(`fin4_recs_u${uid}`)||'[]'),
    fin_cats:JSON.parse(localStorage.getItem(`fin4_u${uid}_cats`)||'null'),
  };
  const blob=new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`plantoes_backup_${currentUser.username}_${new Date().toISOString().slice(0,10)}.json`;
  a.click();URL.revokeObjectURL(a.href);
  showToast('📦 Dados exportados! Importe no site publicado.');
}

async function importLocalData(){
  if(!db||!currentUser){showToast('Conecte ao site publicado para importar.');return;}
  const input=document.createElement('input');
  input.type='file';input.accept='.json';
  input.onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    try{
      const text=await file.text();
      const d=JSON.parse(text);
      if(!d._version){showToast('Arquivo inválido.');return;}
      setSyncStatus('syncing');
      // Write to localStorage with current user's keys
      const uid=currentUser.id;
      if(d.eventos?.length) localStorage.setItem(`eventos_u${uid}`,JSON.stringify(d.eventos));
      if(d.tarefas?.categorias) localStorage.setItem(`tarefas_u${uid}`,JSON.stringify(d.tarefas));
      if(d.treino?.exercicios) localStorage.setItem(`treino_u${uid}`,JSON.stringify(d.treino));
      if(d.treino_reg?.length) localStorage.setItem(`treino_u${uid}_reg`,JSON.stringify(d.treino_reg));
      if(d.treino_ch && Object.keys(d.treino_ch).length) localStorage.setItem(`treino_u${uid}_ch`,JSON.stringify(d.treino_ch));
      if(d.fin_gf) localStorage.setItem(`fin4_u${uid}_gf`,JSON.stringify(d.fin_gf));
      if(d.fin_txs?.length) localStorage.setItem(`fin4_u${uid}_txs`,JSON.stringify(d.fin_txs));
      if(d.fin_meta) localStorage.setItem(`fin4_u${uid}_meta`,JSON.stringify(d.fin_meta));
      if(d.fin_saldo) localStorage.setItem(`fin4_u${uid}_saldo`,JSON.stringify(d.fin_saldo));
      if(d.fin_rv && Object.keys(d.fin_rv).length) localStorage.setItem(`fin4_u${uid}_rv_overrides`,JSON.stringify(d.fin_rv));
      if(d.fin_recs?.length) localStorage.setItem(`fin4_recs_u${uid}`,JSON.stringify(d.fin_recs));
      if(d.fin_cats?.length) localStorage.setItem(`fin4_u${uid}_cats`,JSON.stringify(d.fin_cats));
      // Reload JS vars from localStorage
      loadEventos();loadTarefas();loadTreino();loadFinLocal();
      // Push everything to cloud
      await syncToCloud();
      render();renderHome();renderTarefas();updateTaskBadge();
      showToast('✅ Dados importados e sincronizados com a nuvem!');
    }catch(err){setSyncStatus('error');showToast('Erro ao importar: '+err.message);}
  };
  input.click();
}

// ══════════════════════════════════════════════════════════════════
// MATERIAIS — Índice + Busca (sem IA no app)
// ══════════════════════════════════════════════════════════════════
let matSources=[];

// ── Storage ────────────────────────────────────────────────────
function matSourcesKey(){return `mat_sources_u${currentUser?.id||0}`;}

async function matLoadSources(){
  if(db&&currentUser){
    const{data,error}=await db.from('user_data').select('data')
      .eq('user_id',currentUser.id).eq('key','mat_sources').maybeSingle();
    if(!error&&data){
      try{matSources=JSON.parse(data.data)||[];}catch(e){matSources=[];}
      localStorage.setItem(matSourcesKey(),JSON.stringify(matSources));
      return;
    }
  }
  matSources=JSON.parse(localStorage.getItem(matSourcesKey())||'[]');
}

async function matSaveSources(){
  localStorage.setItem(matSourcesKey(),JSON.stringify(matSources));
  if(db&&currentUser){
    try{
      await db.from('user_data').upsert(
        {user_id:currentUser.id,key:'mat_sources',data:JSON.stringify(matSources),updated_at:new Date().toISOString()},
        {onConflict:'user_id,key'}
      );
    }catch(e){console.warn('matSaveSources:',e);}
  }
}

// ── Import JSON ─────────────────────────────────────────────────
function matShowUpload(){finOpenModal('mat-upload-modal');}
function matShowSources(){matRenderSourcesList();finOpenModal('mat-sources-modal');}

async function matHandleJson(file){
  if(!file)return;
  const status=document.getElementById('mat-upload-status');
  status.style.display='block';
  status.innerHTML='<span style="color:var(--accent)">⏳ Lendo JSON...</span>';
  try{
    const text=await file.text();
    const parsed=JSON.parse(text);
    if(!parsed.topics&&!Array.isArray(parsed.topics)){
      status.innerHTML='<span style="color:var(--red)">❌ Formato inválido. Use o conversor do Claude.ai.</span>';
      return;
    }
    const source={
      id:'src_'+Date.now(),
      title:parsed.title||file.name.replace('.json',''),
      specialty:parsed.specialty||'Geral',
      addedAt:new Date().toISOString(),
      filename:file.name,
      topics:parsed.topics||[]
    };
    // Merge or add
    const ei=matSources.findIndex(s=>s.title===source.title);
    if(ei>=0){
      source.topics.forEach(nt=>{
        const ti=matSources[ei].topics.findIndex(t=>t.name===nt.name);
        if(ti>=0){
          const old=matSources[ei].topics[ti];
          if(old.conduct&&old.conduct!==nt.conduct)
            nt.pearls=(nt.pearls||'')+`
⚠️ Versão anterior indicava: ${old.conduct}`;
          matSources[ei].topics[ti]=nt;
        } else matSources[ei].topics.push(nt);
      });
      matSources[ei].addedAt=source.addedAt;
    } else {
      matSources.push(source);
    }
    await matSaveSources();
    matRenderIndex();matUpdateSourcesBtn();
    status.innerHTML=`<span style="color:var(--green)">✅ ${source.topics.length} tópicos incorporados — <strong>${source.title}</strong></span>`;
    document.getElementById('mat-json-input').value='';
    setTimeout(()=>finCloseModal('mat-upload-modal'),2000);
  }catch(err){
    status.innerHTML=`<span style="color:var(--red)">❌ Erro: ${err.message}</span>`;
  }
}

async function matDeleteSource(id){
  if(!confirm('Remover esta fonte e todos os seus tópicos?'))return;
  matSources=matSources.filter(s=>s.id!==id);
  await matSaveSources();
  matRenderIndex();matRenderSourcesList();matUpdateSourcesBtn();
  showToast('Fonte removida.');
}

function matUpdateSourcesBtn(){
  const btn=document.getElementById('mat-sources-btn');
  if(btn)btn.textContent=`📚 Fontes (${matSources.length})`;
}

// ── Index ───────────────────────────────────────────────────────
const MAT_SYS_ICONS={
  'Respiratório':'🫁','Cardiovascular':'❤️','Neurológico':'🧠',
  'Infeccioso':'🦠','Metabólico':'🧪','Nefrológico':'🧪',
  'Gastrointestinal':'🫃','Hematológico':'🩸','Oncológico':'🩸',
  'Dermatológico':'🩹','Musculoesquelético':'🦴','Ginecológico':'🌸',
  'Urológico':'🚿','Oftalmológico':'👁️','Psiquiátrico':'🧠','Geral':'📋'
};

function matRenderIndex(){
  const el=document.getElementById('mat-index-content');if(!el)return;
  if(!matSources.length){
    el.innerHTML=`<div style="text-align:center;padding:60px 20px;color:var(--text3);font-family:var(--font)">
      <div style="font-size:48px;margin-bottom:12px">📭</div>
      <div style="font-size:15px;font-weight:600;margin-bottom:6px">Nenhuma fonte adicionada</div>
      <div style="font-size:12px">Converta um PDF em JSON no conversor e importe aqui</div>
    </div>`;return;
  }

  // Get custom group order from localStorage
  const groupOrderKey=`mat_groups_u${currentUser?.id||0}`;
  let groupOrder=[];try{groupOrder=JSON.parse(localStorage.getItem(groupOrderKey)||'[]');}catch(e){}

  // Group by system across all sources
  const bySystem={};
  matSources.forEach(src=>{
    src.topics.forEach(t=>{
      const sys=t.system||'Geral';
      if(!bySystem[sys])bySystem[sys]=[];
      bySystem[sys].push({...t,_src:src.title,_srcId:src.id});
    });
  });

  // Sort systems: custom order first, then alphabetical
  const allSystems=Object.keys(bySystem);
  const systems=[...groupOrder.filter(g=>allSystems.includes(g)),
    ...allSystems.filter(g=>!groupOrder.includes(g)).sort()];
  const total=systems.reduce((s,sys)=>s+bySystem[sys].length,0);

  // Store collapsed state per group
  if(!window.matGroupCollapsed)window.matGroupCollapsed={};

  el.innerHTML=`
  <!-- Search bar in index -->
  <div style="margin-bottom:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
    <input id="mat-search" type="text" placeholder="🔍 Buscar patologia, droga, conduta, CID…"
      style="flex:1;min-width:200px;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius-lg);color:var(--text);font-family:var(--font);font-size:13px;padding:9px 16px;outline:none"
      oninput="matSearch(this.value)">
    <button onclick="matOpenGroupManager()" class="btn btn-ghost btn-sm" style="font-family:var(--font)">🗂 Organizar grupos</button>
    <span style="font-size:12px;color:var(--text3);font-family:var(--font)">${total} tópicos · ${systems.length} grupos · ${matSources.length} fonte${matSources.length!==1?'s':''}</span>
  </div>`+
  systems.map(sys=>{
    const topics=bySystem[sys].sort((a,b)=>a.name.localeCompare(b.name,'pt'));
    const icon=MAT_SYS_ICONS[sys]||'📋';
    const isOpen=window.matGroupCollapsed[sys]!==true;
    const rows=topics.map(t=>`
      <div onclick="matShowTopic('${(t.id||t.name).replace(/'/g,"\\'").replace(/"/g,'&quot;')}','${t._srcId}')"
        style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:var(--radius);cursor:pointer;transition:background var(--tr)"
        onmouseenter="this.style.background='var(--bg3)'" onmouseleave="this.style.background='transparent'">
        <span style="width:5px;height:5px;border-radius:50%;background:var(--accent);flex-shrink:0"></span>
        <span style="font-size:12px;color:var(--text);font-family:var(--font);flex:1">${t.name}</span>
        ${t.cid?`<span style="font-size:10px;color:var(--text3);font-family:var(--mono)">${t.cid}</span>`:''}
        ${matGetNotes(t.id||t.name)?'<span title="Com anotações" style="font-size:10px">📝</span>':''}
        <span style="font-size:10px;color:var(--text3);font-family:var(--font)">${t._src}</span>
      </div>`).join('');

    return`<div class="mat-group-item" data-group="${sys}" draggable="true"
      ondragstart="matGroupDragStart(event,'${sys}')"
      ondragover="matGroupDragOver(event)"
      ondrop="matGroupDrop(event,'${sys}')"
      ondragend="matGroupDragEnd(event)"
      style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:10px;margin-bottom:8px;transition:opacity .2s">
      <div onclick="matToggleGroup('${sys}')"
        style="display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;padding:2px 0">
        <span style="font-size:14px">${icon}</span>
        <span style="font-size:12px;font-weight:700;font-family:var(--font);flex:1">${sys}</span>
        <span style="font-size:10px;color:var(--text3);font-family:var(--font)">${topics.length} tópico${topics.length!==1?'s':''}</span>
        <svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px;color:var(--text3);transition:transform .2s;transform:rotate(${isOpen?0:-90}deg)"><path d="M7 10l5 5 5-5z"/></svg>
      </div>
      <div id="mat-grp-${sys.replace(/\s/g,'-')}" style="display:${isOpen?'block':'none'};border-top:1px solid var(--border);margin-top:6px;padding-top:4px">${rows}</div>
    </div>`;
  }).join('');
}

// ── Topic panel ─────────────────────────────────────────────────
let _matCurrentTopic=null;
function matNotesKey(topicIdOrName){return `mat_notes_u${currentUser?.id||0}_${topicIdOrName}`;}
function matGetNotes(topicIdOrName){return localStorage.getItem(matNotesKey(topicIdOrName))||'';}
function matSaveNotes(val){if(_matCurrentTopic)localStorage.setItem(matNotesKey(_matCurrentTopic.id||_matCurrentTopic.name),val);}

function matShowTopic(topicIdOrName, srcId){
  let found=null;let foundSrc=null;
  matSources.forEach(src=>{
    if(srcId&&src.id!==srcId)return;
    const t=src.topics.find(t=>(t.id||t.name)===topicIdOrName||t.name===topicIdOrName);
    if(t){found={...t,_src:src.title,_srcId:src.id,_srcObj:src};foundSrc=src;}
  });
  if(!found)return;
  _matCurrentTopic=found;

  const panel=document.getElementById('mat-topic-panel');
  document.getElementById('mat-panel-title').textContent=found.name;
  document.getElementById('mat-panel-source').textContent=`Fonte: ${found._src}`;
  document.getElementById('mat-index-content').style.display='none';
  document.getElementById('mat-search-results').style.display='none';
  document.getElementById('mat-edit-panel').style.display='none';

  const presc=found.prescriptions?.length?
    `<div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--accent);font-family:var(--font);margin-bottom:8px">💊 Prescrições</div>
      ${found.prescriptions.map(p=>`<div style="background:var(--bg3);border-left:3px solid var(--accent);border-radius:0 var(--radius) var(--radius) 0;padding:8px 12px;margin-bottom:6px">
        <div style="font-size:12px;font-weight:600;font-family:var(--font);color:var(--text);margin-bottom:2px">${p.name}</div>
        <div style="font-size:12px;font-family:var(--font);color:var(--text2);line-height:1.5">${p.details}</div>
      </div>`).join('')}
    </div>`:'';

  const section=(label,color,icon,content)=>content?`
    <div style="margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${color};font-family:var(--font);margin-bottom:6px">${icon} ${label}</div>
      <div style="font-size:13px;font-family:var(--font);color:var(--text2);line-height:1.6;white-space:pre-wrap">${content}</div>
    </div>`:'';

  document.getElementById('mat-panel-content').innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-bottom:16px">
      ${found.cid?`<div style="background:var(--bg3);border-radius:var(--radius);padding:8px 10px"><div style="font-size:9px;color:var(--text3);font-family:var(--font);text-transform:uppercase;letter-spacing:.4px">CID-10</div><div style="font-size:12px;font-weight:600;font-family:var(--mono)">${found.cid}</div></div>`:''}
      ${found.classification?`<div style="background:var(--bg3);border-radius:var(--radius);padding:8px 10px"><div style="font-size:9px;color:var(--text3);font-family:var(--font);text-transform:uppercase;letter-spacing:.4px">Classificação</div><div style="font-size:12px;font-weight:600;font-family:var(--font)">${found.classification}</div></div>`:''}
      ${found.system?`<div style="background:var(--bg3);border-radius:var(--radius);padding:8px 10px"><div style="font-size:9px;color:var(--text3);font-family:var(--font);text-transform:uppercase;letter-spacing:.4px">Sistema</div><div style="font-size:12px;font-weight:600;font-family:var(--font)">${found.system}</div></div>`:''}
    </div>
    ${section('Diagnóstico','var(--text2)','🔍',found.diagnosis)}
    ${section('Conduta','var(--green)','✅',found.conduct)}
    ${presc}
    ${section('Pontos críticos','var(--red)','⚠️',found.pearls)}
    ${section('Critérios de internação','var(--amber)','🏥',found.hospitalization)}
  `;

  // Load notes
  document.getElementById('mat-panel-notes').value=matGetNotes(found.id||found.name);
  panel.style.display='block';
  panel.scrollIntoView({behavior:'smooth',block:'start'});
}

function matClosePanel(){
  document.getElementById('mat-topic-panel').style.display='none';
  document.getElementById('mat-edit-panel').style.display='none';
  document.getElementById('mat-index-content').style.display='block';
  _matCurrentTopic=null;
  const sr=document.getElementById('mat-search-results');
  if(document.getElementById('mat-search')?.value) sr.style.display='block';
}

// ── Edit topic ───────────────────────────────────────────────────
function matOpenEditTopic(){
  if(!_matCurrentTopic)return;
  const t=_matCurrentTopic;
  const panel=document.getElementById('mat-edit-panel');
  const fields=document.getElementById('mat-edit-fields');
  const field=(label,key,multi=false)=>`<div style="margin-bottom:12px">
    <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--text3);font-family:var(--font);display:block;margin-bottom:4px">${label}</label>
    ${multi
      ?`<textarea data-key="${key}" rows="4" style="width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);color:var(--text);font-family:var(--font);font-size:13px;padding:8px 10px;resize:vertical;outline:none;box-sizing:border-box;line-height:1.5">${t[key]||''}</textarea>`
      :`<input type="text" data-key="${key}" value="${(t[key]||'').replace(/"/g,'&quot;')}" style="width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);color:var(--text);font-family:var(--font);font-size:13px;padding:8px 10px;outline:none;box-sizing:border-box">`
    }
  </div>`;
  // Prescriptions as JSON textarea
  const prescJson=JSON.stringify(t.prescriptions||[],null,2);
  fields.innerHTML=
    field('Nome','name')+
    field('Sistema','system')+
    field('CID-10','cid')+
    field('Classificação','classification',true)+
    field('Diagnóstico','diagnosis',true)+
    field('Conduta','conduct',true)+
    `<div style="margin-bottom:12px">
      <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--text3);font-family:var(--font);display:block;margin-bottom:4px">Prescrições (JSON)</label>
      <textarea data-key="prescriptions" rows="8" style="width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);color:var(--text);font-family:var(--mono);font-size:12px;padding:8px 10px;resize:vertical;outline:none;box-sizing:border-box;line-height:1.5">${prescJson}</textarea>
    </div>`+
    field('Pontos críticos','pearls',true)+
    field('Critérios de internação','hospitalization',true);
  document.getElementById('mat-topic-panel').style.display='none';
  panel.style.display='block';
  panel.scrollIntoView({behavior:'smooth',block:'start'});
}

function matCloseEdit(){
  document.getElementById('mat-edit-panel').style.display='none';
  document.getElementById('mat-topic-panel').style.display='block';
}

async function matSaveEdit(){
  if(!_matCurrentTopic)return;
  const fields=document.querySelectorAll('#mat-edit-fields [data-key]');
  const updates={};
  fields.forEach(f=>{
    const k=f.dataset.key;
    if(k==='prescriptions'){try{updates[k]=JSON.parse(f.value);}catch(e){showToast('JSON de prescrições inválido.');return;}}
    else updates[k]=f.value;
  });
  // Apply to source
  let saved=false;
  matSources.forEach(src=>{
    const idx=src.topics.findIndex(t=>(t.id||t.name)===(_matCurrentTopic.id||_matCurrentTopic.name));
    if(idx>=0){Object.assign(src.topics[idx],updates);saved=true;_matCurrentTopic={...src.topics[idx],_src:src.title,_srcId:src.id};}
  });
  if(saved){await matSaveSources();matRenderIndex();matCloseEdit();matShowTopic(_matCurrentTopic.id||_matCurrentTopic.name,_matCurrentTopic._srcId);showToast('Tópico atualizado!');}
}

// ── Group management ─────────────────────────────────────────────
function matToggleGroup(sys){
  if(!window.matGroupCollapsed)window.matGroupCollapsed={};
  window.matGroupCollapsed[sys]=!window.matGroupCollapsed[sys];
  const el=document.getElementById(`mat-grp-${sys.replace(/\s/g,'-')}`);
  if(el){
    el.style.display=window.matGroupCollapsed[sys]?'none':'block';
    const svg=el.previousElementSibling?.querySelector('svg');
    if(svg)svg.style.transform=window.matGroupCollapsed[sys]?'rotate(-90deg)':'rotate(0deg)';
  }
}

let matDragGroup=null;
function matGroupDragStart(e,sys){matDragGroup=sys;e.currentTarget.style.opacity='.5';}
function matGroupDragEnd(e){e.currentTarget.style.opacity='1';matDragGroup=null;}
function matGroupDragOver(e){e.preventDefault();}
function matGroupDrop(e,targetSys){
  e.preventDefault();
  if(!matDragGroup||matDragGroup===targetSys)return;
  const groupOrderKey=`mat_groups_u${currentUser?.id||0}`;
  let groupOrder=[];try{groupOrder=JSON.parse(localStorage.getItem(groupOrderKey)||'[]');}catch(e){}
  // Get all systems
  const bySystem={};
  matSources.forEach(src=>src.topics.forEach(t=>{const s=t.system||'Geral';if(!bySystem[s])bySystem[s]=[];bySystem[s].push(t);}));
  const allSystems=Object.keys(bySystem);
  const orderedFull=[...groupOrder.filter(g=>allSystems.includes(g)),...allSystems.filter(g=>!groupOrder.includes(g)).sort()];
  // Reorder
  const fromIdx=orderedFull.indexOf(matDragGroup);const toIdx=orderedFull.indexOf(targetSys);
  if(fromIdx<0||toIdx<0)return;
  orderedFull.splice(fromIdx,1);orderedFull.splice(toIdx,0,matDragGroup);
  localStorage.setItem(groupOrderKey,JSON.stringify(orderedFull));
  matRenderIndex();
}

function matOpenGroupManager(){
  const groupOrderKey=`mat_groups_u${currentUser?.id||0}`;
  let groupOrder=[];try{groupOrder=JSON.parse(localStorage.getItem(groupOrderKey)||'[]');}catch(e){}
  const bySystem={};
  matSources.forEach(src=>src.topics.forEach(t=>{const s=t.system||'Geral';if(!bySystem[s])bySystem[s]=[];}));
  const allSystems=Object.keys(bySystem);
  const systems=[...groupOrder.filter(g=>allSystems.includes(g)),...allSystems.filter(g=>!groupOrder.includes(g)).sort()];
  const el=document.getElementById('mat-group-list');
  el.innerHTML=systems.map(sys=>`
    <div data-sys="${sys}" style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg3);border-radius:var(--radius);margin-bottom:6px;cursor:grab"
      draggable="true"
      ondragstart="matGroupDragStart(event,'${sys}')"
      ondragover="matGroupDragOver(event)"
      ondrop="matGroupDrop(event,'${sys}')"
      ondragend="matGroupDragEnd(event)">
      <span style="color:var(--text3)">⠿</span>
      <input type="text" value="${sys}" onchange="matRenameGroup('${sys}',this.value)"
        style="flex:1;background:transparent;border:none;border-bottom:1px solid var(--border2);color:var(--text);font-family:var(--font);font-size:13px;padding:2px 4px;outline:none">
      <span style="font-size:11px;color:var(--text3);font-family:var(--font)">${bySystem[sys]?.length||0} tópicos</span>
    </div>`).join('');
  document.getElementById('mat-group-manager').style.display='block';
  document.getElementById('mat-index-content').style.display='none';
}
function matCloseGroupManager(){
  document.getElementById('mat-group-manager').style.display='none';
  document.getElementById('mat-index-content').style.display='block';
}
function matAddGroup(){
  const name=document.getElementById('mat-new-group-name')?.value?.trim();
  if(!name)return;
  // Group is just a system classification — we don't create empty groups, but we can rename existing ones
  showToast('Para criar um grupo, reclassifique tópicos existentes para este nome de sistema ao editá-los.');
  document.getElementById('mat-new-group-name').value='';
}
function matRenameGroup(oldName, newName){
  if(!newName||newName===oldName)return;
  matSources.forEach(src=>src.topics.forEach(t=>{if((t.system||'Geral')===oldName)t.system=newName;}));
  const groupOrderKey=`mat_groups_u${currentUser?.id||0}`;
  try{const o=JSON.parse(localStorage.getItem(groupOrderKey)||'[]');const i=o.indexOf(oldName);if(i>=0){o[i]=newName;localStorage.setItem(groupOrderKey,JSON.stringify(o));}}catch(e){}
  matSaveSources();matRenderIndex();showToast(`Grupo renomeado para "${newName}"`);
}

// ── Navigation helpers ───────────────────────────────────────────
function matGoIndex(){
  matCloseFiles();matCloseConverter();
  document.getElementById('mat-group-manager').style.display='none';
  document.getElementById('mat-index-content').style.display='block';
  document.getElementById('mat-topic-panel').style.display='none';
  document.getElementById('mat-edit-panel').style.display='none';
  document.getElementById('mat-search-results').style.display='none';
}

// ── Files hosting ────────────────────────────────────────────────
function matFilesKey(){return `mat_files_u${currentUser?.id||0}`;}
let matFiles=[];
const MAT_FILE_MAX_MB=5; // 5MB per file limit (localStorage friendly)
const MAT_FILE_MAX_BYTES=MAT_FILE_MAX_MB*1024*1024;

async function matLoadFiles(){
  // Try Supabase first
  if(db&&currentUser){
    try{
      const{data,error}=await db.from('user_data').select('data')
        .eq('user_id',currentUser.id).eq('key','mat_files').maybeSingle();
      if(!error&&data){
        matFiles=JSON.parse(data.data)||[];
        localStorage.setItem(matFilesKey(),JSON.stringify(matFiles));
        return;
      }
    }catch(e){}
  }
  try{matFiles=JSON.parse(localStorage.getItem(matFilesKey())||'[]');}catch(e){matFiles=[];}
}
async function matSaveFiles(){
  localStorage.setItem(matFilesKey(),JSON.stringify(matFiles));
  if(db&&currentUser){
    try{
      await db.from('user_data').upsert(
        {user_id:currentUser.id,key:'mat_files',data:JSON.stringify(matFiles),updated_at:new Date().toISOString()},
        {onConflict:'user_id,key'}
      );
    }catch(e){console.warn('matSaveFiles cloud:',e);}
  }
}

async function matGoFiles(){
  const listEl=document.getElementById('mat-files-list');
  if(listEl)listEl.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3);font-family:var(--font)">Carregando…</div>';
  await matLoadFiles();
  document.getElementById('mat-index-content').style.display='none';
  document.getElementById('mat-topic-panel').style.display='none';
  document.getElementById('mat-edit-panel').style.display='none';
  document.getElementById('mat-converter').style.display='none';
  document.getElementById('mat-group-manager').style.display='none';
  document.getElementById('mat-search-results').style.display='none';
  document.getElementById('mat-files-panel').style.display='block';
  matRenderFiles();
}
function matCloseFiles(){
  document.getElementById('mat-files-panel').style.display='none';
  document.getElementById('mat-index-content').style.display='block';
}

async function matHandleFileUpload(fileList){
  const input=document.getElementById('mat-file-upload-input');
  let added=0,skipped=0,skipNames=[];
  for(const file of fileList){
    if(file.size>MAT_FILE_MAX_BYTES){
      skipped++;skipNames.push(`${file.name} (${(file.size/1048576).toFixed(1)}MB)`);
      continue;
    }
    try{
      const b64=await new Promise((res,rej)=>{
        const r=new FileReader();
        r.onload=()=>res(r.result);
        r.onerror=()=>rej(new Error('Falha ao ler arquivo'));
        r.readAsDataURL(file);
      });
      matFiles.push({id:'f_'+Date.now()+'_'+Math.random().toString(36).slice(2),name:file.name,type:file.type,size:file.size,data:b64,addedAt:new Date().toISOString()});
      added++;
    }catch(e){skipped++;skipNames.push(file.name);}
  }
  if(input)input.value=''; // reset so same file can be re-uploaded
  if(added>0){await matSaveFiles();matRenderFiles();}
  if(added>0&&skipped===0)showToast(`✅ ${added} arquivo${added!==1?'s':''} adicionado${added!==1?'s':''}!`);
  else if(added>0&&skipped>0)showToast(`✅ ${added} adicionado${added!==1?'s':''}. ⚠️ ${skipped} ignorado${skipped!==1?'s':''} (limite ${MAT_FILE_MAX_MB}MB)`);
  else if(skipped>0){
    const listEl=document.getElementById('mat-files-list');
    const warn=document.createElement('div');
    warn.style.cssText='background:rgba(255,100,50,.1);border:1px solid rgba(255,100,50,.3);border-radius:var(--radius);padding:10px 14px;margin-bottom:10px;font-family:var(--font);font-size:12px;color:var(--text2)';
    warn.innerHTML=`⚠️ <strong>Arquivo${skipped!==1?'s':''} não adicionado${skipped!==1?'s':''}:</strong> limite de ${MAT_FILE_MAX_MB}MB por arquivo.<br>
    <span style="color:var(--text3)">${skipNames.join(', ')}</span><br>
    <span style="font-size:11px;color:var(--text3)">Para arquivos maiores, faça upload no Google Drive e cole o link nas anotações do tópico.</span>`;
    if(listEl)listEl.prepend(warn);
  }
}

async function matDeleteFile(id){
  matFiles=matFiles.filter(f=>f.id!==id);
  await matSaveFiles();matRenderFiles();showToast('Arquivo removido.');
}

function matDownloadFile(id){
  const f=matFiles.find(f=>f.id===id);if(!f)return;
  const a=document.createElement('a');a.href=f.data;a.download=f.name;a.click();
}

function matOpenFile(id){
  const f=matFiles.find(f=>f.id===id);if(!f)return;
  if(f.type.includes('image')||f.type.includes('pdf')){
    const w=window.open();w.document.write(`<html><body style="margin:0;background:#000"><img src="${f.data}" style="max-width:100%;display:block;margin:0 auto" onerror="this.style.display='none'"><embed src="${f.data}" style="width:100vw;height:100vh" onerror=""></body></html>`);
  } else {matDownloadFile(id);}
}

function matRenderFiles(){
  const el=document.getElementById('mat-files-list');if(!el)return;
  // Update header info
  const totalSize=matFiles.reduce((a,f)=>a+f.size,0);
  const fmt=n=>{if(n<1024)return n+'B';if(n<1048576)return(n/1024).toFixed(1)+'KB';return(n/1048576).toFixed(1)+'MB';};
  const icon=t=>{if(t.includes('pdf'))return'📄';if(t.includes('image'))return'🖼';if(t.includes('word')||t.includes('document'))return'📝';if(t.includes('spreadsheet')||t.includes('excel'))return'📊';if(t.includes('video'))return'🎬';if(t.includes('audio'))return'🎵';return'📎';};
  const notice=`<div style="background:var(--bg3);border-radius:var(--radius);padding:8px 12px;margin-bottom:12px;font-size:11px;font-family:var(--font);color:var(--text3);display:flex;align-items:center;gap:6px">
    <span>📁 ${matFiles.length} arquivo${matFiles.length!==1?'s':''} · ${fmt(totalSize)} total</span>
    <span style="margin-left:auto">Limite: ${MAT_FILE_MAX_MB}MB por arquivo · Salvo em nuvem e localmente</span>
  </div>`;
  if(!matFiles.length){
    el.innerHTML=notice+`<div style="text-align:center;padding:30px;color:var(--text3);font-family:var(--font)">
      <div style="font-size:36px;margin-bottom:8px">📂</div>
      <div style="font-size:13px">Nenhum arquivo ainda. Clique em <strong>+ Upload</strong> para adicionar.</div>
      <div style="font-size:11px;margin-top:6px;color:var(--text3)">Suportado: PDFs, imagens, documentos até ${MAT_FILE_MAX_MB}MB cada.</div>
    </div>`;return;
  }
  el.innerHTML=notice+matFiles.map(f=>`
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:24px;cursor:pointer" onclick="matOpenFile('${f.id}')" title="Abrir">${icon(f.type)}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;font-family:var(--font);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer" onclick="matOpenFile('${f.id}')">${f.name}</div>
        <div style="font-size:11px;color:var(--text3);font-family:var(--font)">${fmt(f.size)} · ${fmtData(f.addedAt.slice(0,10))}</div>
      </div>
      <button onclick="matOpenFile('${f.id}')" class="btn btn-ghost btn-sm" style="font-family:var(--font)">Abrir</button>
      <button onclick="matDownloadFile('${f.id}')" class="btn btn-ghost btn-sm" style="font-family:var(--font)">⬇</button>
      <button onclick="matDeleteFile('${f.id}')"
        style="background:none;border:none;cursor:pointer;color:var(--text3);padding:4px"
        onmouseenter="this.style.color='var(--red)'" onmouseleave="this.style.color='var(--text3)'">
        <svg viewBox="0 0 24 24" fill="currentColor" style="width:15px;height:15px"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </button>
    </div>`).join('');
}

// ── Search ──────────────────────────────────────────────────────
function matSearch(q){
  const sr=document.getElementById('mat-search-results');
  document.getElementById('mat-topic-panel').style.display='none';
  document.getElementById('mat-index-content').style.display=q?'none':'block';
  if(!q){sr.style.display='none';return;}

  const ql=q.toLowerCase();
  const results=[];
  matSources.forEach(src=>{
    src.topics.forEach(t=>{
      const score=[t.name,t.diagnosis,t.conduct,t.pearls,t.cid,
        t.prescriptions?.map(p=>p.name+' '+p.details).join(' ')]
        .filter(Boolean).join(' ').toLowerCase();
      if(score.includes(ql))results.push({...t,_src:src.title,_srcId:src.id});
    });
  });

  if(!results.length){
    sr.style.display='block';
    sr.innerHTML=`<div style="padding:20px;text-align:center;color:var(--text3);font-family:var(--font);font-size:13px">Nenhum resultado para "<strong>${q}</strong>"</div>`;
    return;
  }

  sr.style.display='block';
  sr.innerHTML=`<div style="font-size:12px;color:var(--text3);font-family:var(--font);margin-bottom:10px">${results.length} resultado${results.length!==1?'s':''} para "<strong>${q}</strong>"</div>`+
  results.map(t=>`
    <div onclick="matShowTopic('${(t.id||t.name).replace(/'/g,"\'")}','${t._srcId}')"
      style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:12px 14px;margin-bottom:6px;cursor:pointer;transition:border-color var(--tr)"
      onmouseenter="this.style.borderColor='var(--accent)'" onmouseleave="this.style.borderColor='var(--border)'">
      <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px">
        <span style="font-size:13px;font-weight:600;font-family:var(--font)">${t.name}</span>
        ${t.cid?`<span style="font-size:10px;color:var(--text3);font-family:var(--mono)">${t.cid}</span>`:''}
        <span style="margin-left:auto;font-size:10px;color:var(--text3);font-family:var(--font)">${t.system||''} · ${t._src}</span>
      </div>
      ${t.conduct?`<div style="font-size:12px;color:var(--text2);font-family:var(--font);line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${t.conduct}</div>`:''}
    </div>`).join('');
}

// ── Sources list ────────────────────────────────────────────────
function matRenderSourcesList(){
  const el=document.getElementById('mat-sources-list');if(!el)return;
  if(!matSources.length){
    el.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3);font-family:var(--font)">Nenhuma fonte adicionada.</div>';return;
  }
  el.innerHTML=matSources.map(src=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 4px;border-bottom:1px solid var(--border)">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;font-family:var(--font)">${src.title}</div>
        <div style="font-size:11px;color:var(--text3);font-family:var(--font)">${src.topics.length} tópicos · ${fmtData(src.addedAt?.slice(0,10))}</div>
      </div>
      <button onclick="matDeleteSource('${src.id}')" title="Remover"
        style="background:none;border:none;cursor:pointer;color:var(--text3)"
        onmouseenter="this.style.color='var(--red)'" onmouseleave="this.style.color='var(--text3)'">
        <svg viewBox="0 0 24 24" fill="currentColor" style="width:15px;height:15px"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </button>
    </div>`).join('');
}

// ── PDF Converter ───────────────────────────────────────────────
let _convFile=null;

function matShowConverter(){
  document.getElementById('mat-converter').style.display='block';
  document.getElementById('mat-search-results').style.display='none';
  document.getElementById('mat-topic-panel').style.display='none';
  document.getElementById('mat-index-content').style.display='none';
  document.getElementById('mat-search').value='';
}
function matCloseConverter(){
  document.getElementById('mat-converter').style.display='none';
  document.getElementById('mat-index-content').style.display='block';
  matConvReset();
}
function matConvHandleFile(file){
  if(!file||!file.name.toLowerCase().endsWith('.pdf')){showToast('Selecione um arquivo PDF.');return;}
  _convFile=file;
  document.getElementById('mat-conv-info').style.display='flex';
  document.getElementById('mat-conv-name').textContent=file.name;
  document.getElementById('mat-conv-size').textContent=(file.size/1024/1024).toFixed(1)+' MB';
  document.getElementById('mat-conv-zone').style.display='none';
}
function matConvReset(){
  _convFile=null;
  document.getElementById('mat-conv-zone').style.display='block';
  document.getElementById('mat-conv-info').style.display='none';
  document.getElementById('mat-conv-progress').style.display='none';
  document.getElementById('mat-conv-log').style.display='none';
  document.getElementById('mat-conv-log').innerHTML='';
  document.getElementById('mat-conv-bar').style.width='0%';
  document.getElementById('mat-conv-file').value='';
}
function matConvLog(msg,type=''){
  const el=document.getElementById('mat-conv-log');
  el.style.display='block';
  const color=type==='ok'?'var(--green)':type==='err'?'var(--red)':type==='info'?'var(--accent)':'var(--text2)';
  el.innerHTML+=`<div style="color:${color}">${msg}</div>`;
  el.scrollTop=el.scrollHeight;
}
function matConvProg(pct,step){
  document.getElementById('mat-conv-bar').style.width=pct+'%';
  document.getElementById('mat-conv-step').textContent=step;
}

async function matConvProcess(){
  if(!_convFile)return;
  const btn=document.getElementById('mat-conv-btn');
  btn.disabled=true;btn.textContent='Processando…';
  document.getElementById('mat-conv-progress').style.display='block';

  try{
    matConvLog(`📄 Lendo ${_convFile.name}…`,'info');
    matConvProg(10,'Lendo arquivo…');

    // Read as base64
    const base64Full=await new Promise((res,rej)=>{
      const r=new FileReader();
      r.onload=()=>res(r.result.split(',')[1]);
      r.onerror=rej;
      r.readAsDataURL(_convFile);
    });

    const CHUNK=24*1024*1024; // ~18MB file per chunk
    const parts=[];
    for(let i=0;i<base64Full.length;i+=CHUNK) parts.push(base64Full.slice(i,i+CHUNK));
    matConvLog(`✓ Arquivo lido · ${parts.length} parte(s)`,'ok');
    matConvProg(20,'Enviando para IA…');

    const SYSTEM=`Você é um assistente médico especializado em urgência e emergência no Brasil.
Analise o PDF médico e extraia TODAS as condutas, prescrições e protocolos clínicos de forma estruturada.
Responda APENAS com JSON válido, sem markdown, sem texto antes ou depois.
Formato obrigatório:
{"title":"título do material","specialty":"área","topics":[{"id":"id_sem_espacos","name":"nome da patologia ou tema","system":"sistema (Respiratório|Cardiovascular|Neurológico|Infeccioso|Metabólico|Gastrointestinal|Dermatológico|Musculoesquelético|Ginecológico|Urológico|Psiquiátrico|Hematológico|Geral)","cid":"CID-10 se disponível","classification":"classificação ou gravidade","diagnosis":"critérios diagnósticos resumidos","conduct":"conduta principal completa e detalhada","prescriptions":[{"name":"nome do medicamento","details":"dose completa, diluição se necessário, via de administração, frequência e duração"}],"pearls":"pontos críticos, armadilhas e o que não pode passar","hospitalization":"critérios de internação ou alta"}]}`;

    let allTopics=[];
    let titleFound='';

    for(let pi=0;pi<parts.length;pi++){
      matConvLog(`🧠 Processando parte ${pi+1}/${parts.length}…`,'info');
      matConvProg(20+Math.round((pi/parts.length)*65),`Parte ${pi+1} de ${parts.length}…`);
      try{
        // Try proxy first, then direct API
        let data=null;
        const payload={
          model:'claude-sonnet-4-20250514',
          max_tokens:8000,
          system:SYSTEM,
          messages:[{role:'user',content:[
            {type:'document',source:{type:'base64',media_type:'application/pdf',data:parts[pi]}},
            {type:'text',text:parts.length>1?`Parte ${pi+1} de ${parts.length}. Extraia todos os tópicos clínicos presentes nesta parte.`:'Extraia todos os tópicos clínicos deste PDF médico.'}
          ]}]
        };
        try{
          const r=await fetch('/.netlify/functions/claude-proxy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
          if(r.ok){const d=await r.json();if(!d.error)data=d;}
        }catch(e){}
        if(!data){
          const r2=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
          data=await r2.json();
        }
        if(data.error)throw new Error(data.error.message||JSON.stringify(data.error));
        const text=data.content?.find(b=>b.type==='text')?.text||'{}';
        const parsed=JSON.parse(text.replace(/```json|```/g,'').trim());
        if(parsed.title&&!titleFound)titleFound=parsed.title;
        if(parsed.topics?.length){
          allTopics=[...allTopics,...parsed.topics];
          matConvLog(`✓ Parte ${pi+1}: ${parsed.topics.length} tópicos extraídos`,'ok');
        } else {
          matConvLog(`Parte ${pi+1}: sem tópicos novos`);
        }
      }catch(e){
        matConvLog(`⚠ Parte ${pi+1} falhou: ${e.message}`,'err');
      }
    }

    if(!allTopics.length) throw new Error('Nenhum tópico extraído. O PDF pode estar protegido ou ser um scan sem texto.');

    // Deduplicate
    const seen=new Set();
    allTopics=allTopics.filter(t=>{if(seen.has(t.name))return false;seen.add(t.name);return true;});

    matConvProg(90,'Incorporando à base de conhecimento…');
    matConvLog(`🔄 Incorporando ${allTopics.length} tópicos…`,'info');

    // Import directly into matSources
    const source={
      id:'src_'+Date.now(),
      title:titleFound||_convFile.name.replace('.pdf',''),
      specialty:'Urgência e Emergência',
      addedAt:new Date().toISOString(),
      filename:_convFile.name,
      topics:allTopics
    };
    const ei=matSources.findIndex(s=>s.title===source.title);
    if(ei>=0){
      source.topics.forEach(nt=>{
        const ti=matSources[ei].topics.findIndex(t=>t.name===nt.name);
        if(ti>=0)matSources[ei].topics[ti]=nt;
        else matSources[ei].topics.push(nt);
      });
      matSources[ei].addedAt=source.addedAt;
    } else matSources.push(source);

    await matSaveSources();
    matRenderIndex();matUpdateSourcesBtn();
    matConvProg(100,'Concluído!');
    matConvLog(`✅ ${allTopics.length} tópicos incorporados com sucesso! <strong>${source.title}</strong>`,'ok');
    showToast(`✅ ${allTopics.length} tópicos incorporados!`);
    // Show download button as backup
    const dlBtn=document.createElement('button');
    dlBtn.className='btn btn-ghost btn-sm';
    dlBtn.style.cssText='font-family:var(--font);margin-top:8px';
    dlBtn.innerHTML='⬇ Baixar JSON de backup';
    dlBtn.onclick=()=>{
      const blob=new Blob([JSON.stringify({title:source.title,specialty:source.specialty,generatedAt:source.addedAt,topics:source.topics},null,2)],{type:'application/json'});
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);
      a.download=source.title.replace(/[^a-z0-9]/gi,'_').toLowerCase()+'.json';
      a.click();URL.revokeObjectURL(a.href);
    };
    document.getElementById('mat-conv-log').appendChild(dlBtn);
    btn.disabled=false;btn.textContent='🧠 Processar PDF';
    setTimeout(()=>matCloseConverter(),3000);

  }catch(err){
    const isCors=err.message.includes('fetch')||err.message.includes('Failed');
    matConvLog(`❌ Erro: ${err.message}`,'err');
    if(isCors){
      matConvLog(`ℹ️ Erro de conexão com a API. Possíveis soluções:<br>
        1. Configure a Netlify Function com <code>ANTHROPIC_API_KEY</code><br>
        2. Use o botão <strong>"+ Importar JSON"</strong> com um JSON gerado no Claude.ai`,'info');
    }
    btn.disabled=false;btn.textContent='🧠 Processar PDF';
  }
}


async function renderMateriais(){
  await matLoadSources();
  matRenderIndex();
  matUpdateSourcesBtn();
  // Clear search on page open
  const si=document.getElementById('mat-search');
  if(si)si.value='';
  document.getElementById('mat-search-results').style.display='none';
  document.getElementById('mat-topic-panel').style.display='none';
  document.getElementById('mat-index-content').style.display='block';
}

// ── Init ──────────────────────────────────────────────────────────
async function init(){
  console.log('[init] start');
  initTheme();
  renderSetupBanner();
  console.log('[init] theme+banner done');
  const hasCloud=initSupabase();
  console.log('[init] hasCloud:', hasCloud);
  if(hasCloud){
    try{
      await loadUsuarios();
      renderUserGrid();
      document.getElementById('pin-keypad').style.display='none';
      document.getElementById('pin-dots').style.display='none';
      const sessionActive=checkSession();
      if(!sessionActive){
        showAppShell();
        document.getElementById('pin-screen').classList.remove('hidden');
      }
    }catch(e){
      console.warn('[init] Cloud failed, falling back to local:', e);
      showAppShell();
      loadLocal();
      setSyncStatus('offline');
      updateFilterOptions();render();
    }
  }else{
    showAppShell();
    loadLocal();
    setSyncStatus('offline');
    updateFilterOptions();render();
  }
}

init();
