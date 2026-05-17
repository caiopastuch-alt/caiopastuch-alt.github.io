// ── Auto-status refresh ───────────────────────────────────────────
// Re-check every minute: plantões that just ended get status "Realizado"
function startAutoStatusTimer(){
  setInterval(()=>{
    if(!currentUser)return;
    const changed=applyAutoStatusAll();
    if(changed){
      saveLocal();
      // Sync changed plantoes to cloud
      plantoes.forEach(p=>{if(!MANUAL_STATUSES.includes(p.status))upsertPlantao(p);});
      render();renderResumo();renderNextShift();
    }
  },60000);
}

// ── Sort ─────────────────────────────────────────────────────────
function setSort(col){
  if(sortCol===col)sortDir=sortDir==='asc'?'desc':'asc';
  else{sortCol=col;sortDir='asc';}
  render();
}

// ── Undo ─────────────────────────────────────────────────────────
function pushUndo(){
  if(_isUndoing)return; // don't push during restore
  undoStack.push(JSON.stringify(plantoes));
  if(undoStack.length>MAX_UNDO)undoStack.shift();
  const btn=document.getElementById('undo-btn');
  if(btn)btn.style.display='inline-flex';
}
let _isUndoing=false;
function undoLast(){
  if(!undoStack.length){showToast('Nada para desfazer.');return;}
  _isUndoing=true;
  const prev=JSON.parse(undoStack.pop());
  const oldIds=new Set(prev.map(p=>p.id));
  prev.forEach(p=>upsertPlantao(p));
  plantoes.forEach(p=>{if(!oldIds.has(p.id))deletePlantao(p.id);});
  plantoes=prev;
  saveLocal();
  render();renderResumo();renderNextShift();
  const btn=document.getElementById('undo-btn');
  if(btn)btn.style.display=undoStack.length?'inline-flex':'none';
  showToast('↩ Edição desfeita.');
  _isUndoing=false;
}
// ── Notifications ─────────────────────────────────────────────────
let notifTimer=null;
async function requestNotifPermission(){
  if(!('Notification' in window))return false;
  if(Notification.permission==='granted')return true;
  const p=await Notification.requestPermission();
  return p==='granted';
}
function checkNotifications(){
  const now=new Date();
  const in2h=new Date(now.getTime()+2*3600*1000);
  const in2hMinus5=new Date(in2h.getTime()-5*60*1000); // 5 min window
  plantoes.forEach(p=>{
    if(!p.data||!p.ini)return;
    const[h,m]=p.ini.split(':').map(Number);
    const start=new Date(p.data+'T00:00:00');start.setHours(h,m,0,0);
    // Fire if plantão starts within 2h ± 5min
    if(start>=in2hMinus5&&start<=in2h){
      const key=`notif_${p.id}_${p.data}`;
      if(!sessionStorage.getItem(key)){
        sessionStorage.setItem(key,'1');
        new Notification('🏥 Plantão em 2 horas!',{
          body:`${p.local} · ${p.tipo} · ${p.ini} → ${p.fim}`,
          icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="20" font-size="20">🏥</text></svg>',
          tag:`plantao_${p.id}`
        });
      }
    }
  });
}
async function initNotifications(){
  if(!('Notification' in window))return;
  if(Notification.permission==='granted'){
    scheduleNotifications();
  }else if(Notification.permission!=='denied'){
    // Ask after a short delay so it doesn't pop up immediately on login
    setTimeout(async()=>{
      const granted=await requestNotifPermission();
      if(granted){scheduleNotifications();showToast('🔔 Notificações ativadas!');}
    },3000);
  }
}

// ── Home Page ─────────────────────────────────────────────────────
function updateTaskBadge(){
  const pending=tarefas.filter(t=>!t.done).length;
  const overdue=tarefas.filter(t=>{if(t.done||!t.prazo)return false;return new Date(t.prazo+'T12:00:00')<new Date();}).length;
  const navBtn=document.querySelector('.nav-item[onclick*="tarefas"]');
  if(!navBtn)return;
  const existing=navBtn.querySelector('.task-badge');if(existing)existing.remove();
  if(pending>0){
    const badge=document.createElement('span');
    badge.className='task-badge';
    badge.style.cssText=`display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;border-radius:8px;font-size:10px;font-weight:700;padding:0 4px;margin-left:auto;background:${overdue?'var(--red)':'var(--accent)'};color:#fff`;
    badge.textContent=pending;
    navBtn.appendChild(badge);
  }
}

