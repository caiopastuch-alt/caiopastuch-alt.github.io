// ── Cálculos ──────────────────────────────────────────────────────
function durMins(ini,fim){if(!ini||!fim)return 0;const[ih,im]=ini.split(':').map(Number);const[fh,fm]=fim.split(':').map(Number);let m=(fh*60+fm)-(ih*60+im);if(m<=0)m+=1440;return m;}
function durH(ini,fim){return durMins(ini,fim)/60;}
function durFmt(ini,fim){const m=durMins(ini,fim);if(!m)return'0h';const h=Math.floor(m/60),min=m%60;return min?`${h}h${String(min).padStart(2,'0')}`:`${h}h`;}
function hFmt(hD){if(!hD)return'0h';const h=Math.floor(hD),m=Math.round((hD-h)*60);return m?`${h}h${String(m).padStart(2,'0')}`:`${h}h`;}
function fmtVal(v){if(!v)return'';return'R$ '+Math.round(v).toLocaleString('pt-BR');}
function fmtValTip(v){if(!v)return'R$ 0';return'R$ '+Math.round(v).toLocaleString('pt-BR');}
function isWeekendOrFeriado(p){if(!p.data)return false;const dow=new Date(p.data+'T12:00:00').getDay();if(dow===0||dow===6)return true;return(p.obs||'').toLowerCase().includes('feriado');}
function calcValor(p){const h=durH(p.ini,p.fim);if(!h)return 0;const base=cfg.tipoRates[p.tipo]??90;const bonus=isWeekendOrFeriado(p)?(cfg.tipoBonus?.[p.tipo]??0):0;return Math.round(h*(base+bonus));}
// Returns true if the plantão has fully ended (using data + fim time)
function isPast(data,fim){
  if(!data)return true;
  const now=new Date();
  if(fim){
    const[fh,fm]=fim.split(':').map(Number);
    const[dY,dM,dD]=data.split('-').map(Number);
    let end=new Date(dY,dM-1,dD,fh,fm,0);
    // Overnight: if fim < typical start (e.g. before noon), it's next day
    // Use: if fimMin <= 720 (noon), assume next day
    const fimMin=fh*60+fm;
    if(fimMin<=720)end.setDate(end.getDate()+1);
    return end<now;
  }
  // fallback: compare dates only
  const t=new Date();t.setHours(0,0,0,0);
  return new Date(data+'T00:00:00')<t;
}
// Returns true if plantão is "paid" (Pago) or NF issued
function isReceived(p){return(p.status||'').toLowerCase()==='recebido'||p.status.toLowerCase()==='nf emitida';}
function isNFEmitida(p){return(p.status||'').toLowerCase()==='nf emitida';}
// Status labels that are manually managed (not auto-assigned)
const MANUAL_STATUSES=['Recebido','NF Emitida'];
// Auto-assign status based on timing (only if not manually set)
function autoStatus(p){
  const sl=(p.status||'').toLowerCase();
  if(MANUAL_STATUSES.map(s=>s.toLowerCase()).includes(sl))return p.status; // keep manual
  return isPast(p.data,p.fim)?'Realizado':'A Realizar';
}
function applyAutoStatus(p){
  const auto=autoStatus(p);
  if(auto!==p.status){p.status=auto;return true;}
  return false;
}
function applyAutoStatusAll(){
  let changed=false;
  plantoes.forEach(p=>{if(applyAutoStatus(p))changed=true;});
  return changed;
}
function fmtData(d){if(!d)return'';const[y,mo,da]=d.split('-');return`${da}/${mo}/${y.slice(2)}`;}
function getDow(data){if(!data)return'';return DIAS[new Date(data+'T12:00:00').getDay()];}
function getDowFull(data){if(!data)return'';return DIAS_FULL[new Date(data+'T12:00:00').getDay()];}
function statusHtml(s){
  const sl=(s||'').toLowerCase();
  const customColor=cfg.statusColors&&cfg.statusColors[s];
  if(customColor){
    return`<span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:${customColor}"><span class="dot" style="background:${customColor}"></span>${s}</span>`;
  }
  if(sl==='recebido')return`<span class="status-pago"><span class="dot"></span>Recebido</span>`;
  if(sl==='nf emitida')return`<span class="status-obs"><span class="dot"></span>NF Emitida</span>`;
  if(sl==='realizado')return`<span class="status-pend" style="color:var(--accent)"><span class="dot" style="background:var(--accent)"></span>Realizado</span>`;
  if(sl==='a realizar')return`<span class="status-pend"><span class="dot"></span>A Realizar</span>`;
  return`<span class="status-pend"><span class="dot"></span>${s||'A Realizar'}</span>`;
}
function getYM(data){return data?data.substring(0,7):'';}
function ymLabel(ym){if(!ym)return'?';const[y,m]=ym.split('-');return`${MESES[parseInt(m)-1]} · ${y}`;}

