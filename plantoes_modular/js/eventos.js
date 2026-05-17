// ── PDF Export ────────────────────────────────────────────────────
function exportPDF(){
  showToast('Abrindo janela de impressão…');
  setTimeout(()=>window.print(),300);
}

// ── Eventos ────────────────────────────────────────────────────────
let eventos = [];       // {id, titulo, data, hora, desc}
let _evEditId = null;

function evStorageKey(){return currentUser?`eventos_u${currentUser.id}`:'eventos_guest';}
function saveEventos(){localStorage.setItem(evStorageKey(),JSON.stringify(eventos));cloudAutoSave('eventos',()=>eventos);}
function loadEventos(){
  try{const r=localStorage.getItem(evStorageKey());eventos=r?JSON.parse(r):[];}
  catch(e){eventos=[];}
}

function openEventoModal(id, preDate){
  _evEditId=id||null;
  const isEdit=!!id;
  document.getElementById('evento-modal-title').textContent=isEdit?'Editar evento':'Novo evento';
  document.getElementById('ev-del-btn').style.display=isEdit?'inline-flex':'none';
  const ev=isEdit?eventos.find(e=>e.id===id):null;
  document.getElementById('ev-titulo').value=ev?ev.titulo:'';
  document.getElementById('ev-data').value=ev?fmtData(ev.data):(preDate?fmtData(preDate):'');
  document.getElementById('ev-hora').value=ev?ev.hora:'';
  document.getElementById('ev-desc').value=ev?ev.desc:'';
  document.getElementById('evento-overlay').classList.add('open');
  setTimeout(()=>document.getElementById('ev-titulo').focus(),80);
}
function closeEventoModal(){document.getElementById('evento-overlay').classList.remove('open');_evEditId=null;}
function saveEvento(){
  const titulo=document.getElementById('ev-titulo').value.trim();
  if(!titulo){showToast('Informe um título.');return;}
  const dataRaw=document.getElementById('ev-data').value.trim();
  const data=dataRaw?parseSmartDate(dataRaw,new Date().getFullYear()):'';
  if(dataRaw&&!data){showToast('Data não reconhecida.');return;}
  const ev={
    id:_evEditId||(Date.now()),
    titulo,data,
    hora:document.getElementById('ev-hora').value,
    desc:document.getElementById('ev-desc').value.trim()
  };
  if(_evEditId){const i=eventos.findIndex(e=>e.id===_evEditId);if(i>=0)eventos[i]=ev;}
  else eventos.push(ev);
  eventos.sort((a,b)=>(a.data||'9999')>(b.data||'9999')?1:-1);
  saveEventos();closeEventoModal();
  // Re-render calendar if active
  if(document.getElementById('page-calendario').classList.contains('active'))renderCalendar();
  showToast(_evEditId?'Evento atualizado!':'Evento adicionado!');
}
function deleteEvento(){
  if(!_evEditId||!confirm('Remover este evento?'))return;
  eventos=eventos.filter(e=>e.id!==_evEditId);
  saveEventos();closeEventoModal();
  if(document.getElementById('page-calendario').classList.contains('active'))renderCalendar();
  showToast('Evento removido.');
}

