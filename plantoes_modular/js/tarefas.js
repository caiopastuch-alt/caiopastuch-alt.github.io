// ── Tarefas ────────────────────────────────────────────────────────
let categorias = [];   // {id, nome, cor}
let tarefas    = [];   // {id, catId, titulo, prio, prazo, notas, done}
let _tfEditId  = null;
let _catCollapsed = {};
let tarefaSort = 'prio'; // 'prio' | 'prazo' | 'alfa' | 'criacao'

function setTarefaSort(v){tarefaSort=v;renderTarefas();}

function tfStorageKey(){return currentUser?`tarefas_u${currentUser.id}`:'tarefas_guest';}
function saveTarefas(){
  localStorage.setItem(tfStorageKey(),JSON.stringify({categorias,tarefas,_catCollapsed}));
  cloudAutoSave('tarefas',()=>({categorias,tarefas,_catCollapsed}));
}
function loadTarefas(){
  try{
    const r=localStorage.getItem(tfStorageKey());
    if(r){const d=JSON.parse(r);categorias=d.categorias||[];tarefas=d.tarefas||[];_catCollapsed=d._catCollapsed||{};}
    else{categorias=[];tarefas=[];_catCollapsed={};}
  }catch(e){categorias=[];tarefas=[];_catCollapsed={};}
}

const CAT_SWATCHES=['#4f8ef7','#3ecf8e','#f5a623','#9567ff','#f25f5c','#38bdf8','#fb7185','#a3e635','#e879f9','#fbbf24'];
let _catEditId=null;
let _catSelectedColor='#4f8ef7';

function catSelectColor(color){
  _catSelectedColor=color;
  document.getElementById('cat-cor-custom').value=color;
  document.querySelectorAll('.cat-swatch').forEach(s=>{
    s.style.outline=s.dataset.color===color?'2px solid var(--text)':'none';
  });
}
function openCatModal(id){
  _catEditId=id||null;
  const isEdit=!!id;
  const cat=isEdit?categorias.find(c=>c.id===id):null;
  document.getElementById('cat-modal-title').textContent=isEdit?'Editar categoria':'Nova categoria';
  document.getElementById('cat-save-btn').textContent=isEdit?'Salvar':'Criar';
  document.getElementById('cat-del-btn').style.display=isEdit?'inline-flex':'none';
  document.getElementById('cat-nome').value=cat?cat.nome:'';
  _catSelectedColor=cat?cat.cor:'#4f8ef7';
  document.getElementById('cat-cor-custom').value=_catSelectedColor;
  // Render swatches
  document.getElementById('cat-cor-swatches').innerHTML=CAT_SWATCHES.map(c=>`
    <div class="cat-swatch" data-color="${c}"
      style="width:22px;height:22px;border-radius:50%;background:${c};cursor:pointer;outline:${c===_catSelectedColor?'2px solid var(--text)':'none'};outline-offset:2px"
      onclick="catSelectColor('${c}')"></div>`).join('');
  document.getElementById('cat-overlay').classList.add('open');
  setTimeout(()=>document.getElementById('cat-nome').focus(),80);
}
function closeCatModal(){document.getElementById('cat-overlay').classList.remove('open');_catEditId=null;}
function saveCategoria(){
  const nome=document.getElementById('cat-nome').value.trim();
  if(!nome){showToast('Informe o nome da categoria.');return;}
  if(_catEditId){
    const cat=categorias.find(c=>c.id===_catEditId);
    if(cat){cat.nome=nome;cat.cor=_catSelectedColor;}
    saveTarefas();closeCatModal();renderTarefas();showToast('Categoria atualizada!');
  }else{
    categorias.push({id:Date.now(),nome,cor:_catSelectedColor});
    saveTarefas();closeCatModal();renderTarefas();showToast(`Categoria "${nome}" criada!`);
  }
}
function deleteCategoriaFromModal(){
  if(!_catEditId||!confirm('Remover esta categoria e todas as tarefas dela?'))return;
  categorias=categorias.filter(c=>c.id!==_catEditId);
  tarefas=tarefas.filter(t=>t.catId!==_catEditId);
  saveTarefas();closeCatModal();renderTarefas();showToast('Categoria removida.');
}
function deleteCategoria(id){
  if(!confirm('Remover esta categoria e todas as tarefas dela?'))return;
  categorias=categorias.filter(c=>c.id!==id);
  tarefas=tarefas.filter(t=>t.catId!==id);
  saveTarefas();renderTarefas();
}
let _dragCatId=null;
function catDragStart(e,id){
  _dragCatId=id;
  const sec=document.getElementById('cat-sec-'+id);
  if(sec)sec.classList.add('dragging');
  e.dataTransfer.effectAllowed='move';
}
function catDragOver(e){e.preventDefault();e.dataTransfer.dropEffect='move';}
function catDragEnter(e){
  const el=e.currentTarget;
  if(parseInt(el.dataset.catId)!==_dragCatId)el.classList.add('drag-over');
}
function catDragLeave(e){e.currentTarget.classList.remove('drag-over');}
function catDrop(e,targetId){
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if(_dragCatId===null||_dragCatId===targetId)return;
  const fromIdx=categorias.findIndex(c=>c.id===_dragCatId);
  const toIdx=categorias.findIndex(c=>c.id===targetId);
  if(fromIdx<0||toIdx<0)return;
  const [moved]=categorias.splice(fromIdx,1);
  categorias.splice(toIdx,0,moved);
  saveTarefas();renderTarefas();
}
function catDragEnd(e){
  document.querySelectorAll('.cat-section').forEach(el=>el.classList.remove('dragging','drag-over'));
  _dragCatId=null;
}

function openTarefaModal(id, catId){
  _tfEditId=id||null;
  const isEdit=!!id;
  document.getElementById('tarefa-modal-title').textContent=isEdit?'Editar tarefa':'Nova tarefa';
  document.getElementById('tf-del-btn').style.display=isEdit?'inline-flex':'none';
  // Populate cat select
  const sel=document.getElementById('tf-cat');
  sel.innerHTML=categorias.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('');
  const tf=isEdit?tarefas.find(t=>t.id===id):null;
  document.getElementById('tf-titulo').value=tf?tf.titulo:'';
  if(tf)sel.value=tf.catId; else if(catId)sel.value=catId;
  document.getElementById('tf-prio').value=tf?tf.prio:'media';
  document.getElementById('tf-prazo').value=tf&&tf.prazo?fmtData(tf.prazo):'';
  document.getElementById('tf-notas').value=tf?tf.notas:'';
  document.getElementById('tarefa-overlay').classList.add('open');
  setTimeout(()=>document.getElementById('tf-titulo').focus(),80);
}
function closeTarefaModal(){document.getElementById('tarefa-overlay').classList.remove('open');_tfEditId=null;}
function quickAddTarefa(catId,cor){
  const row=document.getElementById('add-row-'+catId);
  if(!row)return;
  const borderColor=cor||'var(--accent-border)';
  row.outerHTML=`
    <div class="quick-add-wrap" id="quick-wrap-${catId}" style="border-left:3px solid ${borderColor}">
      <input class="quick-add-input" id="quick-inp-${catId}" placeholder="Nome da tarefa…" autocomplete="off"
        onkeydown="quickAddKeydown(event,${catId},'${borderColor}')">
      <select class="quick-add-prio" id="quick-prio-${catId}">
        <option value="baixa">↓ Baixa</option>
        <option value="media" selected>→ Média</option>
        <option value="alta">↑ Alta</option>
      </select>
      <span class="quick-add-hint">Enter salva · Esc cancela</span>
    </div>`;
  const inp=document.getElementById('quick-inp-'+catId);
  if(inp)inp.focus();
}
function quickAddKeydown(e,catId,cor){
  if(e.key==='Escape'){renderTarefas();return;}
  if(e.key!=='Enter')return;
  e.preventDefault();
  const inp=document.getElementById('quick-inp-'+catId);
  const prio=document.getElementById('quick-prio-'+catId);
  const titulo=(inp?inp.value:'').trim();
  if(!titulo){renderTarefas();return;}
  tarefas.push({id:Date.now(),catId,titulo,prio:prio?prio.value:'media',prazo:'',notas:'',done:false});
  saveTarefas();renderTarefas();
  setTimeout(()=>quickAddTarefa(catId,cor),50);
}
function saveTarefa(){
  const titulo=document.getElementById('tf-titulo').value.trim();
  if(!titulo){showToast('Informe o título da tarefa.');return;}
  const catId=parseInt(document.getElementById('tf-cat').value);
  if(!catId||!categorias.find(c=>c.id===catId)){showToast('Selecione uma categoria.');return;}
  const prazoRaw=document.getElementById('tf-prazo').value.trim();
  const prazo=prazoRaw?parseSmartDate(prazoRaw,new Date().getFullYear()):'';
  if(prazoRaw&&!prazo){showToast('Prazo não reconhecido — use: 16/03 ou 16 mar.');return;}
  const tf={
    id:_tfEditId||(Date.now()),catId,titulo,
    prio:document.getElementById('tf-prio').value,
    prazo,notas:document.getElementById('tf-notas').value.trim(),
    done:_tfEditId?(tarefas.find(t=>t.id===_tfEditId)||{}).done||false:false
  };
  if(_tfEditId){const i=tarefas.findIndex(t=>t.id===_tfEditId);if(i>=0)tarefas[i]=tf;}
  else tarefas.push(tf);
  saveTarefas();closeTarefaModal();renderTarefas();showToast(_tfEditId?'Tarefa atualizada!':'Tarefa adicionada!');
}
function deleteTarefa(){
  if(!_tfEditId||!confirm('Remover esta tarefa?'))return;
  tarefas=tarefas.filter(t=>t.id!==_tfEditId);
  saveTarefas();closeTarefaModal();renderTarefas();showToast('Tarefa removida.');
}
function cyclePrio(id,el){
  // Remove any existing prio popup
  document.querySelectorAll('.prio-popup').forEach(p=>p.remove());
  const tf=tarefas.find(t=>t.id===id);if(!tf)return;
  const popup=document.createElement('div');
  popup.className='prio-popup';
  const options=[
    {val:'alta', label:'↑ Alta',  cls:'prio-alta'},
    {val:'media',label:'→ Média', cls:'prio-media'},
    {val:'baixa',label:'↓ Baixa', cls:'prio-baixa'},
  ];
  popup.innerHTML=options.map(o=>`
    <div class="prio-popup-item ${o.cls}${tf.prio===o.val?' active':''}"
      onclick="setPrio(${id},'${o.val}')">${o.label}</div>`).join('');
  // Position near the badge
  const rect=el.getBoundingClientRect();
  popup.style.cssText=`position:fixed;top:${rect.bottom+4}px;left:${rect.left}px;z-index:9999`;
  document.body.appendChild(popup);
  // Close on outside click
  setTimeout(()=>{
    document.addEventListener('click',function closePop(e){
      if(!popup.contains(e.target)){popup.remove();document.removeEventListener('click',closePop);}
    });
  },10);
}
function setPrio(id,prio){
  document.querySelectorAll('.prio-popup').forEach(p=>p.remove());
  const tf=tarefas.find(t=>t.id===id);if(!tf)return;
  tf.prio=prio;saveTarefas();renderTarefas();
}
function quickDeleteTarefa(id){
  if(!confirm('Remover esta tarefa?'))return;
  tarefas=tarefas.filter(t=>t.id!==id);
  saveTarefas();renderTarefas();updateTaskBadge();
}
function toggleTarefa(id){
  const tf=tarefas.find(t=>t.id===id);if(!tf)return;
  tf.done=!tf.done;saveTarefas();renderTarefas();updateTaskBadge();
}
function toggleCat(id){
  _catCollapsed[id]=!_catCollapsed[id];saveTarefas();renderTarefas();
}
function renderTarefas(){
  const el=document.getElementById('tarefas-list');if(!el)return;
  if(!categorias.length){
    el.innerHTML='<div class="empty"><p>Nenhuma categoria ainda.</p><p>Crie uma categoria para começar.</p></div>';return;
  }
  // Sync dropdown
  const sel=document.getElementById('tarefa-sort');
  if(sel)sel.value=tarefaSort;

  const prioOrder={alta:0,media:1,baixa:2};
  function sortFn(a,b){
    // Concluídas sempre por último
    if(a.done!==b.done)return a.done?1:-1;
    if(tarefaSort==='prio') return prioOrder[a.prio]-prioOrder[b.prio];
    if(tarefaSort==='prazo'){
      if(!a.prazo&&!b.prazo)return 0;
      if(!a.prazo)return 1;
      if(!b.prazo)return -1;
      return a.prazo.localeCompare(b.prazo);
    }
    if(tarefaSort==='alfa') return a.titulo.localeCompare(b.titulo,'pt');
    if(tarefaSort==='criacao') return a.id-b.id; // id = Date.now() at creation
    return 0;
  }
  el.innerHTML=categorias.map(cat=>{
    const catTarefas=tarefas.filter(t=>t.catId===cat.id).sort(sortFn);
    const done=catTarefas.filter(t=>t.done).length;
    const total=catTarefas.length;
    const collapsed=_catCollapsed[cat.id];
    const today=new Date();today.setHours(0,0,0,0);
    const tarefasHtml=catTarefas.map(tf=>{
      const isOverdue=tf.prazo&&!tf.done&&new Date(tf.prazo+'T12:00:00')<today;
      return`<div class="tarefa-item${tf.done?' done':''}">
        <div class="tarefa-check${tf.done?' checked':''}" onclick="event.stopPropagation();toggleTarefa(${tf.id})">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        </div>
        <div class="tarefa-body" onclick="openTarefaModal(${tf.id})">
          <div class="tarefa-titulo">${tf.titulo}</div>
          <div class="tarefa-meta">
            <span class="tarefa-prio prio-${tf.prio}" style="cursor:pointer" title="Clique para alterar prioridade"
              onclick="event.stopPropagation();cyclePrio(${tf.id},this)">${tf.prio.charAt(0).toUpperCase()+tf.prio.slice(1)}</span>
            ${tf.prazo?`<span class="tarefa-prazo${isOverdue?' overdue':''}">${isOverdue?'⚠ ':''} ${fmtData(tf.prazo)}</span>`:''}
          </div>
          ${tf.notas?`<div class="tarefa-notas">${tf.notas}</div>`:''}
        </div>
        <button class="tarefa-del-btn" onclick="event.stopPropagation();quickDeleteTarefa(${tf.id})" title="Remover tarefa">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>`;
    }).join('');
    const r=parseInt(cat.cor.slice(1,3),16),g=parseInt(cat.cor.slice(3,5),16),b=parseInt(cat.cor.slice(5,7),16);
    const corBg=`rgba(${r},${g},${b},0.10)`;
    const corBgHover=`rgba(${r},${g},${b},0.16)`;
    const corBorder=`rgba(${r},${g},${b},0.35)`;
    return`<div class="cat-section" id="cat-sec-${cat.id}"
      data-cat-id="${cat.id}"
      ondragover="catDragOver(event)"
      ondragenter="catDragEnter(event)"
      ondragleave="catDragLeave(event)"
      ondrop="catDrop(event,${cat.id})"
      ondragend="catDragEnd(event)">
      <div class="cat-header" style="background:${corBg};border-color:${corBorder}" onclick="toggleCat(${cat.id})">
        <div class="cat-dot" style="background:${cat.cor}"></div>
        <div class="cat-name cat-drag-handle"
          draggable="true"
          ondragstart="catDragStart(event,${cat.id})"
          title="Arraste para reorganizar">${cat.nome}</div>
        <div class="cat-count">${done}/${total} concluídas</div>
        <button class="cat-del" onclick="event.stopPropagation();openCatModal(${cat.id})" title="Editar categoria">✏</button>
        <svg class="month-chevron${collapsed?'':' open'}" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
      </div>
      ${collapsed?'':`<div style="border:1px solid ${corBorder};border-top:none;border-radius:0 0 var(--radius-lg) var(--radius-lg);overflow:hidden">
        ${total?tarefasHtml.replace(/border-left:3px solid var\(--border2\)/g,`border-left:3px solid ${cat.cor}`):'<div class="cat-empty">Nenhuma tarefa nesta categoria.</div>'}
        <div class="add-tarefa-row" id="add-row-${cat.id}" style="border-left:3px solid ${cat.cor}" onclick="quickAddTarefa(${cat.id},'${cat.cor}')">+ Adicionar tarefa</div>
      </div>`}
    </div>`;
  }).join('');
}

