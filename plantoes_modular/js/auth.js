// ── PIN / Auth System ─────────────────────────────────────────────
let currentUser = null; // { id, username, pin_hash }
let usuarios = [];
let pinBuffer = '';
let pinMode = 'login'; // 'login' | 'set'

async function loadUsuarios(){
  if(!db) return;
  const{data,error}=await db.from('usuarios').select('*').order('id');
  if(!error && data) usuarios=data;
}

function pinHash(pin){
  // Simple hash — XOR + sum for 4-digit PIN (not cryptographic but sufficient for this use)
  let h=0;
  for(let i=0;i<pin.length;i++) h=(h*31+pin.charCodeAt(i))>>>0;
  return String(h);
}

const ADMIN_USER = 'caio';

function isAdmin(){
  return !!(currentUser && currentUser.username.toLowerCase() === ADMIN_USER);
}

function updateAdminUI(){
  const nav=document.getElementById('nav-profiles');
  if(!nav) return;
  const admin=!!(currentUser && currentUser.username && currentUser.username.toLowerCase()==='caio');
  console.log('[admin check] currentUser=',currentUser?.username,'isAdmin=',admin);
  if(admin){
    nav.removeAttribute('style');
    nav.style.cssText='display:flex!important';
  } else {
    nav.style.cssText='display:none!important';
  }
}

function renderUserGrid(){
  const grid=document.getElementById('user-grid');
  if(!grid) return;
  grid.innerHTML=usuarios.map(u=>`
    <button class="user-btn" onclick="selectUser(${u.id})" id="ubtn-${u.id}">
      <div class="user-avatar">${u.username.charAt(0).toUpperCase()}</div>
      <span class="user-name">${u.username}</span>
    </button>`).join('')+`
    <button class="user-add-btn" onclick="showNewProfile()">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
      <span>Novo perfil</span>
    </button>`;
}

// ── Manage Profiles Modal (admin only) ───────────────────────────
function openManageProfiles(){
  renderProfilesList();
  document.getElementById('new-profile-input').value='';
  document.getElementById('profiles-overlay').classList.add('open');
}
function closeManageProfiles(){document.getElementById('profiles-overlay').classList.remove('open');}

function renderProfilesList(){
  const el=document.getElementById('profiles-list');
  if(!el) return;
  if(!usuarios.length){el.innerHTML='<p style="color:var(--text3);font-size:13px">Nenhum perfil cadastrado.</p>';return;}
  el.innerHTML=usuarios.map(u=>`
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#6b4ef7);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:#fff;flex-shrink:0">${u.username.charAt(0).toUpperCase()}</div>
      <span style="flex:1;font-size:13px;font-weight:500">${u.username}</span>
      <span style="font-size:11px;color:var(--text3)">${u.pin_hash?'PIN definido':'Sem PIN'}</span>
      ${u.username.toLowerCase()!==ADMIN_USER?`<button onclick="deleteProfileAdmin(${u.id})" style="background:var(--red-bg);border:1px solid rgba(242,95,92,.3);color:var(--red);border-radius:var(--radius);padding:4px 10px;font-size:12px;cursor:pointer;font-family:var(--font)">Remover</button>`:'<span style="font-size:11px;color:var(--accent)">Admin</span>'}
    </div>`).join('');
}

async function addProfileFromModal(){
  const inp=document.getElementById('new-profile-input');
  const name=inp.value.trim();
  if(!name){showToast('Digite um nome para o perfil.');return;}
  if(usuarios.some(u=>u.username.toLowerCase()===name.toLowerCase())){showToast('Já existe um perfil com esse nome.');return;}
  const{data,error}=await db.from('usuarios').insert({username:name}).select().single();
  if(error){showToast('Erro ao criar perfil.');return;}
  usuarios.push(data);
  inp.value='';
  renderProfilesList();
  renderUserGrid();
  showToast(`Perfil "${name}" criado!`);
}

async function deleteProfileAdmin(id){
  const u=usuarios.find(x=>x.id===id);
  if(!u) return;
  if(!confirm(`Remover o perfil "${u.username}"?\n\nTodos os plantões desse perfil serão apagados permanentemente.`)) return;
  await Promise.all([
    db.from('plantoes').delete().eq('user_id',id),
    db.from('config').delete().eq('user_id',id),
    db.from('usuarios').delete().eq('id',id)
  ]);
  usuarios=usuarios.filter(x=>x.id!==id);
  renderProfilesList();
  renderUserGrid();
  showToast(`Perfil "${u.username}" removido.`);
}

function showNewProfile(){
  document.getElementById('new-profile-form').classList.add('open');
  document.getElementById('pin-sub').textContent='Como quer chamar o perfil?';
  document.getElementById('pin-keypad').style.display='none';
  document.getElementById('pin-dots').style.display='none';
  document.getElementById('pin-msg').textContent='';
  setTimeout(()=>document.getElementById('new-profile-name').focus(),50);
}

function cancelNewProfile(){
  document.getElementById('new-profile-form').classList.remove('open');
  document.getElementById('new-profile-name').value='';
  document.getElementById('pin-sub').textContent='Selecione seu perfil';
  currentUser=null;
}

async function createProfile(){
  const name=document.getElementById('new-profile-name').value.trim();
  if(!name){setPinMsg('Digite um nome para o perfil.','error');return;}
  if(usuarios.some(u=>u.username.toLowerCase()===name.toLowerCase())){
    setPinMsg('Já existe um perfil com esse nome.','error');return;
  }
  const{data,error}=await db.from('usuarios').insert({username:name}).select().single();
  if(error){setPinMsg('Erro ao criar perfil.','error');return;}
  usuarios.push(data);
  cancelNewProfile();
  renderUserGrid();
  // Auto-select the new profile
  selectUser(data.id);
  setPinMsg(`Perfil "${name}" criado! Defina seu PIN.`,'success');
}

async function deleteProfile(e,id){
  e.stopPropagation();
  const u=usuarios.find(x=>x.id===id);
  if(!u) return;
  if(!confirm(`Remover o perfil "${u.username}"?\n\nTodos os plantões desse perfil serão apagados permanentemente.`)) return;
  // Delete plantoes and config
  await db.from('plantoes').delete().eq('user_id',id);
  await db.from('config').delete().eq('user_id',id);
  await db.from('usuarios').delete().eq('id',id);
  usuarios=usuarios.filter(x=>x.id!==id);
  if(currentUser?.id===id){currentUser=null;}
  renderUserGrid();
  setPinMsg('Perfil removido.','');
  document.getElementById('pin-keypad').style.display='none';
  document.getElementById('pin-dots').style.display='none';
  document.getElementById('pin-sub').textContent='Selecione seu perfil';
}

function selectUser(id){
  currentUser=usuarios.find(u=>u.id===id)||null;
  if(!currentUser) return;
  // Highlight selected
  document.querySelectorAll('.user-btn').forEach(b=>b.classList.remove('selected'));
  const btn=document.getElementById('ubtn-'+id);
  if(btn) btn.classList.add('selected');
  // Determine mode
  pinBuffer='';
  updatePinDots();
  setPinMsg('');
  if(!currentUser.pin_hash){
    pinMode='set';
    document.getElementById('pin-sub').textContent=`Olá, ${currentUser.username}! Crie seu PIN de 4 dígitos`;
  } else {
    pinMode='login';
    document.getElementById('pin-sub').textContent=`Digite seu PIN, ${currentUser.username}`;
  }
  document.getElementById('pin-keypad').style.display='grid';
  document.getElementById('pin-dots').style.display='flex';
}

function pinKey(digit){
  if(!currentUser){setPinMsg('Selecione um perfil primeiro.','error');return;}
  if(pinBuffer.length>=4) return;
  pinBuffer+=digit;
  updatePinDots();
  if(pinBuffer.length===4) setTimeout(submitPin,150);
}

function pinDel(){
  if(pinBuffer.length>0){pinBuffer=pinBuffer.slice(0,-1);updatePinDots();}
}

function updatePinDots(){
  for(let i=0;i<4;i++){
    const d=document.getElementById('d'+i);
    if(!d) continue;
    d.classList.remove('filled','error');
    if(i<pinBuffer.length) d.classList.add('filled');
  }
}

function setPinMsg(msg,type=''){
  const el=document.getElementById('pin-msg');
  if(!el) return;
  el.textContent=msg;
  el.className='pin-msg'+(type?' '+type:'');
}

function showPinError(){
  for(let i=0;i<4;i++){const d=document.getElementById('d'+i);if(d){d.classList.remove('filled');d.classList.add('error');}}
  setTimeout(()=>{pinBuffer='';updatePinDots();},700);
}

let pinSetFirst=''; // stores first PIN entry during set flow
async function submitPin(){
  if(pinMode==='set'){
    if(!pinSetFirst){
      pinSetFirst=pinBuffer;
      pinBuffer='';
      updatePinDots();
      setPinMsg('Confirme seu PIN');
      return;
    }
    // Confirm
    if(pinBuffer!==pinSetFirst){
      pinSetFirst='';pinBuffer='';updatePinDots();
      setPinMsg('PINs diferentes. Tente novamente.','error');
      showPinError();return;
    }
    // Save PIN
    const h=pinHash(pinBuffer);
    const{error}=await db.from('usuarios').update({pin_hash:h}).eq('id',currentUser.id);
    if(error){setPinMsg('Erro ao salvar PIN.','error');return;}
    currentUser.pin_hash=h;
    // Update local list
    const idx=usuarios.findIndex(u=>u.id===currentUser.id);
    if(idx>=0) usuarios[idx].pin_hash=h;
    pinSetFirst='';
    setPinMsg('PIN criado!','success');
    setTimeout(enterApp,600);
  } else {
    // Login
    if(pinHash(pinBuffer)===currentUser.pin_hash){
      setPinMsg('','success');
      setTimeout(enterApp,200);
    } else {
      showPinError();
      setPinMsg('PIN incorreto. Tente novamente.','error');
      pinBuffer='';
    }
  }
}

function showAppShell(){
  const main=document.querySelector('.main');
  if(main)main.style.visibility='visible';
  document.querySelector('.sidebar').style.visibility='visible';
}
function enterApp(){
  showAppShell();
  document.getElementById('pin-screen').classList.add('hidden');
  const su=document.getElementById('sidebar-user');
  const sa=document.getElementById('sidebar-avatar');
  const sn=document.getElementById('sidebar-name');
  if(su){su.style.display='flex';}
  if(sa) sa.textContent=currentUser.username.charAt(0).toUpperCase();
  if(sn) sn.textContent=currentUser.username;
  // Show/hide admin nav item
  updateAdminUI();
  sessionStorage.setItem('plantoes_user',JSON.stringify({id:currentUser.id,username:currentUser.username}));
  // Load this user's data
  // plantoes-subnav starts collapsed; opens when user navigates to plantoes/resumo
  loadFromCloud().then(()=>{
    updateAdminUI();
    loadFinLocal(); // finance data already in localStorage from syncFromCloud
    loadEventos();loadTarefas();loadTreino(); // read localStorage populated by syncFromCloud
    updateFilterOptions();render();
    renderHome();renderTarefas();updateTaskBadge();
    initNotifications();
    startAutoStatusTimer();
    setInterval(()=>{if(notifPermission==='granted')scheduleNotifications();},5*60*1000);
    applyCompact();
    addSyncBtn();
    registerServiceWorker();
    if(document.getElementById('page-resumo').classList.contains('active'))renderChart();
  });
}

function logout(){
  if(nextShiftTimer){clearInterval(nextShiftTimer);nextShiftTimer=null;}
  // Clear all in-memory user data
  plantoes=[];cfg=JSON.parse(JSON.stringify(defaultCfg));nextId=1;collapsed={};
  eventos=[];categorias=[];tarefas=[];_catCollapsed={};
  fichas=[];exercicios=[];
  finTXS=[];finGF={fixo:[],semifixo:[],variavel:[]};finMETA=0;finSALDO=0;finCAT_E=[];
  finSbPlantoes=[];
  // Clear user-scoped localStorage (keep only shared keys: exercicios-global, etc.)
  if(currentUser){
    const uid=currentUser.id;
    const sharedPrefixes=['mat_sources','mat_notes']; // shared across devices for same user, NOT shared between users
    const keysToRemove=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(!k)continue;
      // Remove any key scoped to this user ID
      if(k.includes(`_u${uid}`)||k.includes(`u${uid}_`))keysToRemove.push(k);
    }
    // Also clear generic keys that might bleed between profiles
    ['plantoes_guest','eventos_guest','fin4_guest'].forEach(k=>keysToRemove.push(k));
    keysToRemove.forEach(k=>localStorage.removeItem(k));
  }
  const lw=document.getElementById('list');if(lw)lw.innerHTML='';
  sessionStorage.removeItem('plantoes_user');
  currentUser=null;
  updateAdminUI();
  pinBuffer='';pinSetFirst='';
  document.getElementById('pin-screen').classList.remove('hidden');
  document.getElementById('sidebar-user').style.display='none';
  document.getElementById('pin-sub').textContent='Selecione seu perfil';
  document.getElementById('pin-keypad').style.display='none';
  document.getElementById('pin-dots').style.display='none';
  document.getElementById('new-profile-form').classList.remove('open');
  // Close subnav menus
  ['fin-subnav','mat-subnav','plantoes-subnav','treino-subnav'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.style.display='none';
  });
  renderUserGrid();
  ['kpi-total','kpi-horas','kpi-valor-real','kpi-valor-pend'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.textContent='—';
  });
  ['kpi-count-bd','kpi-horas-bd','kpi-valor-real-bd','kpi-valor-pend-bd'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.innerHTML='';
  });
}

function checkSession(){
  const sess=sessionStorage.getItem('plantoes_user');
  if(sess){
    try{
      const u=JSON.parse(sess);
      currentUser=usuarios.find(x=>x.id===u.id)||null;
      if(currentUser){enterApp();return true;}
    }catch(e){}
  }
  return false;
}

// ── Google Agenda Tutorial ─────────────────────────────────────────
function buildGcalScript(){
  const uid = currentUser ? currentUser.id : 'SEU_USER_ID';
  const uname = currentUser ? currentUser.username : 'Usuário';
  return `