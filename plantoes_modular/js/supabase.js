// ── Supabase init ─────────────────────────────────────────────────
function initSupabase(){
  if(SUPABASE_URL.includes('COLE'))return false;
  try{db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);return true;}
  catch(e){console.error('Supabase init:',e);return false;}
}

// ── Sync status indicator ─────────────────────────────────────────
function setSyncStatus(s){
  const dot=document.getElementById('sync-dot');
  const txt=document.getElementById('sync-text');
  if(!dot||!txt)return;
  const map={connecting:['#f5a623','Conectando…'],syncing:['#4f8ef7','Salvando…'],synced:['#3ecf8e','Sincronizado ✓'],error:['#f25f5c','Erro de conexão'],offline:['#4d5669','Local']};
  const[c,t]=map[s]||map.offline;
  dot.style.background=c;txt.textContent=t;
  // Auto-hide after showing synced/offline
  if(s==='synced'){setTimeout(()=>{if(txt)txt.textContent='';if(dot)dot.style.background='transparent';},3000);}
}

// ── Local storage — chave por usuário para evitar vazamento entre perfis ──
function skUser(){return currentUser?`plantoes_u${currentUser.id}`:'plantoes_guest';}
function loadLocal(){
  try{
    const r=localStorage.getItem(skUser());
    if(r){const d=JSON.parse(r);plantoes=d.plantoes||[];nextId=d.nextId||1;
      if(d.cfg){const lc=d.cfg;cfg={...defaultCfg,...lc,tipoRates:{...defaultCfg.tipoRates,...(lc.tipoRates||{})},tipoBonus:{...defaultCfg.tipoBonus,...(lc.tipoBonus||{})}};}
    }else{plantoes=[];nextId=1;cfg=JSON.parse(JSON.stringify(defaultCfg));}
    migrateLegacyStatus();
  }catch(e){plantoes=[];nextId=1;cfg=JSON.parse(JSON.stringify(defaultCfg));}
}
function saveLocal(){if(currentUser)localStorage.setItem(skUser(),JSON.stringify({plantoes,nextId,cfg}));}
function migrateLegacyStatus(){
  const sm={'pendente':'A Realizar','pago':'Recebido','obs':'NF Emitida','ver obs':'NF Emitida','pendente':'A Realizar','realizado':'Realizado','a realizar':'A Realizar','nf emitida':'NF Emitida'};
  plantoes.forEach(p=>{
    const sl=(p.status||'').toLowerCase();
    if(sm[sl])p.status=sm[sl];
  });
  applyAutoStatusAll();
}

// ── Cloud sync ─────────────────────────────────────────────────────

// Salva cfg no Supabase com user_id como chave única
async function saveCfgToCloud(){
  if(!db||!currentUser)return;
  try{
    // Tenta update primeiro; se não existir, faz insert
    const{data:existing}=await db.from('config').select('user_id').eq('user_id',currentUser.id).maybeSingle();
    if(existing){
      await db.from('config').update({data:cfg}).eq('user_id',currentUser.id);
    }else{
      await db.from('config').insert({user_id:currentUser.id,data:cfg});
    }
  }catch(e){console.error('saveCfg:',e);}
}

// Upsert de um único plantão no Supabase
async function upsertPlantao(p){
  if(!db||!currentUser)return;
  setSyncStatus('syncing');
  try{
    const row={...p,user_id:currentUser.id};
    const{error}=await db.from('plantoes').upsert(row,{onConflict:'id'});
    if(error)throw error;
    setSyncStatus('synced');
  }catch(e){console.error('upsertPlantao:',e);setSyncStatus('error');}
}

// Deleta um plantão do Supabase por id
async function deletePlantao(id){
  if(!db)return;
  setSyncStatus('syncing');
  try{
    const{error}=await db.from('plantoes').delete().eq('id',id);
    if(error)throw error;
    setSyncStatus('synced');
  }catch(e){console.error('deletePlantao:',e);setSyncStatus('error');}
}

// save() geral — usado para config e operações em lote
function save(){
  saveLocal();
  if(!db)return;
  saveCfgToCloud();
}

// savePlantao(p) — chamado após editar/criar um plantão
function savePlantao(p){
  pushUndo();
  saveLocal();
  if(!db)return;
  upsertPlantao(p);
}

// removePlantao(id) — chamado ao deletar
function removePlantao(id){
  pushUndo();
  saveLocal();
  if(!db)return;
  deletePlantao(id);
}

async function loadFromCloud(){
  if(!currentUser||!db)return;
  // Reset state to avoid leaking data between profiles
  plantoes=[];
  cfg=JSON.parse(JSON.stringify(defaultCfg));
  setSyncStatus('connecting');
  try{
    const uid=currentUser.id;
    const[{data:rows,error:rowsErr},{data:cfgRow}]=await Promise.all([
      db.from('plantoes').select('*').eq('user_id',uid).order('data'),
      db.from('config').select('*').eq('user_id',uid).maybeSingle()
    ]);
    if(rowsErr)throw rowsErr;
    if(cfgRow?.data){
      const loaded=cfgRow.data;
      cfg={...defaultCfg,...loaded,
        tipoRates:{...defaultCfg.tipoRates,...(loaded.tipoRates||{})},
        tipoBonus:{...defaultCfg.tipoBonus,...(loaded.tipoBonus||{})},
        tipoColors:{...defaultCfg.tipoColors,...(loaded.tipoColors||{})},
        localColors:{...defaultCfg.localColors,...(loaded.localColors||{})},
        statusColors:{...defaultCfg.statusColors,...(loaded.statusColors||{})}
      };
    }
    plantoes=rows||[];
    nextId=plantoes.length>0?Math.max(...plantoes.map(r=>r.id))+1:1;
    migrateLegacyStatus();
    saveLocal();
    await syncFromCloud(); // load tarefas, eventos, finanças, treino from user_data
    setSyncStatus('synced');
  }catch(e){
    console.error('Cloud load error:',e);
    loadLocal();
    setSyncStatus('error');
    showToast('Sem conexão — usando dados salvos localmente.');
  }
}

// ── Setup banner ──────────────────────────────────────────────────
function renderSetupBanner(){
  const el=document.getElementById('setup-banner-wrap');
  if(SUPABASE_URL.includes('COLE')){
    el.innerHTML=`<div class="setup-banner"><div class="setup-banner-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></div><div><h4>Configure a sincronização em nuvem</h4><p>Adicione suas credenciais do Supabase no topo do arquivo HTML para sincronizar entre dispositivos.</p></div></div>`;
  }else{el.innerHTML='';}
}

