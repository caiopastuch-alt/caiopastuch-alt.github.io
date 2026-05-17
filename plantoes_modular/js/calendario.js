// ═══════════════════════════════════════════════════════════
//  SINCRONIZADOR DE PLANTÕES → GOOGLE AGENDA
//  Perfil: ${uname}
//  Cole em script.google.com → Novo projeto
// ═══════════════════════════════════════════════════════════

const SUPABASE_URL = '${SUPABASE_URL}';
const SUPABASE_KEY = '${SUPABASE_KEY}';
const USER_ID      = ${uid};  // Perfil: ${uname}
const TIMEZONE     = 'America/Sao_Paulo';
const TAXAS        = { 'MP':90,'MP*':90,'PR':90,'PR*':90 };
const PR_BONUS     = 5;

function sincronizarTodos(){
  Logger.log('▶ Sincronizando plantões de ${uname}…');
  const plantoes = buscarPlantoes();
  if(!plantoes||!plantoes.length){Logger.log('⚠ Nenhum plantão.');return;}
  const cal = CalendarApp.getDefaultCalendar();
  let criados=0,atualizados=0;
  plantoes.forEach(p=>{
    try{const r=sincronizarUm(cal,p);if(r==='criado')criados++;else if(r==='atualizado')atualizados++;}
    catch(e){Logger.log('Erro '+p.id+': '+e.message);}
  });
  Logger.log('✅ Criados:'+criados+' Atualizados:'+atualizados);
}

function sincronizarUm(cal,p){
  const{startTime,endTime}=parsearHorarios(p);
  const titulo='🏥 Plantão '+p.tipo+' — '+p.local;
  const desc=montarDescricao(p);
  const tag='plantao_id_'+p.id;
  const inicio=new Date(startTime);inicio.setDate(inicio.getDate()-1);
  const fim=new Date(endTime);fim.setDate(fim.getDate()+2);
  const existentes=cal.getEvents(inicio,fim).filter(e=>e.getTag('plantao_id')===String(p.id));
  if(existentes.length>0){
    const ev=existentes[0];
    if(ev.getTitle()===titulo&&ev.getDescription()===desc)return'ignorado';
    ev.setTitle(titulo);ev.setDescription(desc);ev.setTime(startTime,endTime);ev.setLocation(p.local);
    return'atualizado';
  }
  const ev=cal.createEvent(titulo,startTime,endTime,{description:desc,location:p.local});
  ev.setTag('plantao_id',String(p.id));
  return'criado';
}

function removerDeletados(){
  const plantoes=buscarPlantoes();
  const ids=new Set((plantoes||[]).map(p=>String(p.id)));
  const cal=CalendarApp.getDefaultCalendar();
  const ini=new Date();ini.setFullYear(ini.getFullYear()-2);
  const fim=new Date();fim.setFullYear(fim.getFullYear()+2);
  let removidos=0;
  cal.getEvents(ini,fim).forEach(e=>{
    const pid=e.getTag('plantao_id');
    if(pid&&!ids.has(pid)){e.deleteEvent();removidos++;}
  });
  Logger.log('🗑 Removidos:'+removidos);
}

function sincronizacaoCompleta(){sincronizarTodos();removerDeletados();}

function buscarPlantoes(){
  const url=SUPABASE_URL+'/rest/v1/plantoes?select=*&user_id=eq.'+USER_ID+'&order=data.asc';
  const r=UrlFetchApp.fetch(url,{headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY},muteHttpExceptions:true});
  if(r.getResponseCode()!==200){Logger.log('Erro HTTP '+r.getResponseCode());return null;}
  return JSON.parse(r.getContentText());
}

function parsearHorarios(p){
  const[y,mo,d]=p.data.split('-').map(Number);
  const[sh,sm]=p.ini.split(':').map(Number);
  const[eh,em]=p.fim.split(':').map(Number);
  const s=new Date(y,mo-1,d,sh,sm,0);
  const e=new Date(y,mo-1,d,eh,em,0);
  if(eh<sh||(eh===sh&&em<sm))e.setDate(e.getDate()+1);
  return{startTime:s,endTime:e};
}

function calcularValor(p){
  const[sh,sm]=p.ini.split(':').map(Number);
  const[eh,em]=p.fim.split(':').map(Number);
  let m=(eh*60+em)-(sh*60+sm);if(m<=0)m+=1440;
  const h=m/60;const base=TAXAS[p.tipo]||90;
  const d=new Date(p.data+'T12:00:00').getDay();
  const bonus=(p.tipo.startsWith('PR')&&(d===0||d===6||(p.obs||'').toLowerCase().includes('feriado')))?PR_BONUS:0;
  return Math.round(h*(base+bonus));
}

function montarDescricao(p){
  const[sh,sm]=p.ini.split(':').map(Number);const[eh,em]=p.fim.split(':').map(Number);
  let m=(eh*60+em)-(sh*60+sm);if(m<=0)m+=1440;
  const h=Math.floor(m/60),min=m%60;
  const dur=min?h+'h'+String(min).padStart(2,'0'):h+'h';
  const val=calcularValor(p);
  return ['🏥 Tipo: '+p.tipo,'⏱ Duração: '+dur,val?'💰 Valor: R$ '+val.toLocaleString('pt-BR'):'',p.obs?'📝 Obs: '+p.obs:'','📋 Status: '+p.status,'','Sincronizado via Plantões App'].filter(Boolean).join('\\n');
}

function configurarGatilho(){
  ScriptApp.getProjectTriggers().forEach(g=>{if(g.getHandlerFunction()==='sincronizacaoCompleta')ScriptApp.deleteTrigger(g);});
  ScriptApp.newTrigger('sincronizacaoCompleta').timeBased().everyHours(1).create();
  Logger.log('✅ Gatilho configurado! Sincronização automática a cada 1 hora.');
}`;
}

function openGcalTutorial(){
  const code = buildGcalScript();
  document.getElementById('tut-script-code').textContent = code;
  document.getElementById('gcal-tutorial-overlay').classList.add('open');
}
function closeGcalTutorial(){
  document.getElementById('gcal-tutorial-overlay').classList.remove('open');
}
function copyScript(){
  const code = document.getElementById('tut-script-code').textContent;
  navigator.clipboard.writeText(code).then(()=>{
    const btn=document.querySelector('.tut-copy-btn');
    btn.textContent='Copiado!';
    setTimeout(()=>btn.textContent='Copiar',2000);
  }).catch(()=>showToast('Selecione e copie o código manualmente.'));
}

function showChartTip(e,text){
  const tip=document.getElementById('chart-tooltip');
  if(!tip)return;
  tip.textContent=text;
  tip.style.display='block';
  posChartTip(e);
}
function showChartTipHtml(e,encoded){
  const tip=document.getElementById('chart-tooltip');
  if(!tip)return;
  tip.innerHTML=decodeURIComponent(encoded);
  tip.style.display='block';
  posChartTip(e);
}
function posChartTip(e){
  const tip=document.getElementById('chart-tooltip');
  if(!tip||tip.style.display==='none')return;
  const margin=10;
  let x=e.clientX+margin;
  let y=e.clientY-tip.offsetHeight-margin;
  // Clamp to viewport
  if(x+tip.offsetWidth>window.innerWidth-margin)x=e.clientX-tip.offsetWidth-margin;
  if(y<margin)y=e.clientY+margin;
  tip.style.left=x+'px';
  tip.style.top=y+'px';
}
function hideChartTip(){
  const tip=document.getElementById('chart-tooltip');
  if(tip)tip.style.display='none';
}
document.addEventListener('mousemove',e=>{posChartTip(e);});

// ── Calendar Event Edit Panel ─────────────────────────────────────
let _calEditId = null;

function calEditOpen(id){
  const p = plantoes.find(x => String(x.id) === String(id));
  if(!p) return;
  _calEditId = p.id;

  // Populate selects
  const stSel = document.getElementById('ce-status');
  stSel.innerHTML = cfg.statuses.map(s=>`<option value="${s}"${s===p.status?' selected':''}>${s}</option>`).join('');
  const locSel = document.getElementById('ce-local');
  locSel.innerHTML = cfg.locais.map(l=>`<option value="${l}"${l===p.local?' selected':''}>${l}</option>`).join('');
  const tipSel = document.getElementById('ce-tipo');
  tipSel.innerHTML = cfg.tipos.map(t=>`<option value="${t}"${t===p.tipo?' selected':''}>${t}</option>`).join('');

  // Fill fields
  document.getElementById('ce-data').value = fmtData(p.data);
  document.getElementById('ce-ini').value  = p.ini || '';
  document.getElementById('ce-fim').value  = p.fim || '';
  document.getElementById('ce-obs').value  = p.obs || '';

  // Header
  const c = getTipoColor(p.tipo);
  document.getElementById('cal-edit-title').innerHTML =
    `<span style="display:inline-flex;align-items:center;gap:8px">${tipoPill(p.tipo)} ${p.local}</span>`;
  document.getElementById('cal-edit-sub').textContent =
    `${getDowFull(p.data)}, ${fmtData(p.data)} · ${p.ini}→${p.fim} · ${durFmt(p.ini,p.fim)}`;

  // Preview
  _ceUpdatePreview();

  // Live preview on change
  ['ce-ini','ce-fim'].forEach(id => {
    document.getElementById(id).oninput = _ceUpdatePreview;
  });
  document.getElementById('ce-tipo').onchange = _ceUpdatePreview;

  document.getElementById('cal-edit-overlay').classList.add('open');
}

function _ceUpdatePreview(){
  const ini = document.getElementById('ce-ini').value;
  const fim = document.getElementById('ce-fim').value;
  const tipo = document.getElementById('ce-tipo').value;
  const obs  = document.getElementById('ce-obs').value;
  const dataRaw = document.getElementById('ce-data').value;
  const p = plantoes.find(x => x.id === _calEditId) || {};
  const data = p.data || '';
  const h = durH(ini, fim);
  const box = document.getElementById('ce-preview');
  if(h && ini && fim){
    const v = calcValor({tipo, data, obs, ini, fim});
    box.innerHTML = `<span class="pv-dur">${durFmt(ini,fim)}</span><span style="color:var(--text3)">·</span><span class="pv-val">${fmtVal(v)}</span>`;
  } else {
    box.innerHTML = '<span style="color:var(--text3);font-size:12px">—</span>';
  }
}

function closeCalEdit(){
  document.getElementById('cal-edit-overlay').classList.remove('open');
  _calEditId = null;
}

function calEditSave(){
  const p = plantoes.find(x => x.id === _calEditId);
  if(!p){ closeCalEdit(); return; }

  // Parse date from text input
  const dataRaw = document.getElementById('ce-data').value.trim();
  const parsed = parseSmartDate(dataRaw, parseInt(p.data.split('-')[0]));
  if(dataRaw && parsed){ p.data = parsed; p.mes = MESES[parseInt(parsed.split('-')[1])-1]; }
  else if(dataRaw && !parsed){ showToast('Data não reconhecida — use: 16/03, 16 mar ou 16/03/2026'); return; }

  p.ini    = document.getElementById('ce-ini').value;
  p.fim    = document.getElementById('ce-fim').value;
  p.local  = document.getElementById('ce-local').value;
  p.tipo   = document.getElementById('ce-tipo').value;
  p.status = document.getElementById('ce-status').value;
  p.obs    = document.getElementById('ce-obs').value.trim();
  // Re-apply auto status if not manually managed
  if(!MANUAL_STATUSES.includes(p.status))p.status=autoStatus(p);

  savePlantao(p);
  closeCalEdit();
  render(); renderResumo(); renderNextShift(); renderCalendar();
  showToast('✅ Plantão atualizado!');
}

function calEditDelete(){
  if(!_calEditId) return;
  if(!confirm('Remover este plantão?')) return;
  const id = _calEditId;
  plantoes = plantoes.filter(x => x.id !== id);
  removePlantao(id);
  closeCalEdit();
  render(); renderResumo(); renderNextShift(); renderCalendar();
  showToast('Plantão removido.');
}

