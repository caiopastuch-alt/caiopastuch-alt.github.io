
// ══════════════════════════════════════════════════════════════════
//  ⚙️  CONFIGURAÇÃO SUPABASE — cole seus dados aqui
// ══════════════════════════════════════════════════════════════════
const SUPABASE_URL = 'https://cnswsdnchojcgysohhey.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuc3dzZG5jaG9qY2d5c29oaGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0OTk4OTgsImV4cCI6MjA5MzA3NTg5OH0.3SM9XNujzWWu8v7j-yBe_fLVEP6nzFd4CPaY2kE9M2o';
// ══════════════════════════════════════════════════════════════════

const MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_FULL=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const DIAS=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
// localStorage key por usuário — evita vazamento entre perfis

// Paleta de cores para tipos de plantão (ciclica)
const TIPO_PALETTE=[
  {color:'#4f8ef7',bg:'rgba(79,142,247,0.12)',border:'rgba(79,142,247,0.3)'},   // azul
  {color:'#3ecf8e',bg:'rgba(62,207,142,0.10)',border:'rgba(62,207,142,0.25)'},  // verde
  {color:'#f5a623',bg:'rgba(245,166,35,0.12)',border:'rgba(245,166,35,0.32)'},  // laranja
  {color:'#9567ff',bg:'rgba(149,103,255,0.11)',border:'rgba(149,103,255,0.28)'},// roxo
  {color:'#f25f5c',bg:'rgba(242,95,92,0.10)',border:'rgba(242,95,92,0.25)'},    // vermelho
  {color:'#38bdf8',bg:'rgba(56,189,248,0.10)',border:'rgba(56,189,248,0.28)'},  // ciano
  {color:'#fb7185',bg:'rgba(251,113,133,0.10)',border:'rgba(251,113,133,0.28)'},// rosa
  {color:'#a3e635',bg:'rgba(163,230,53,0.10)',border:'rgba(163,230,53,0.25)'},  // lima
];
function hexToComponents(hex){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return{color:hex,bg:`rgba(${r},${g},${b},0.13)`,border:`rgba(${r},${g},${b},0.35)`};
}
function getTipoColor(tipo){
  if(cfg.tipoColors&&cfg.tipoColors[tipo])return hexToComponents(cfg.tipoColors[tipo]);
  const idx=cfg.tipos.indexOf(tipo);
  return TIPO_PALETTE[idx>=0?idx%TIPO_PALETTE.length:0];
}
function getItemColor(key,item){
  // key = 'tipoColors'|'localColors'|'statusColors'
  const map=cfg[key]||{};
  if(map[item])return hexToComponents(map[item]);
  return null;
}
function tipoPill(t){
  const c=getTipoColor(t);
  return`<span class="tipo" style="background:${c.bg};color:${c.color};border-color:${c.border}">${t}</span>`;
}

const defaultCfg={
  tipos:['MP','MP*','PR','PR*'],
  locais:['UPA CO','UPA Ibiporã','UPA Cambé','UPA Sabará','PA MC','PA Leonor','PA UV','24h Cambé'],
  statuses:['A Realizar','Realizado','NF Emitida','Recebido'],
  tipoRates:{'MP':90,'MP*':90,'PR':90,'PR*':90},
  tipoBonus:{'MP':0,'MP*':0,'PR':5,'PR*':5},
  prBonus:5,
  tipoColors:{},
  localColors:{},
  statusColors:{}
};

let cfg=JSON.parse(JSON.stringify(defaultCfg));
let plantoes=[];
let nextId=1;
let collapsed={};
let activeEditor=null;
const monthTotalRefs={};
let db=null;
let sortCol='data';
let sortDir='asc';
// Undo stack — stores snapshots before each edit
let undoStack=[];
const MAX_UNDO=20;

