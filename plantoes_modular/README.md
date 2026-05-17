# Área de Trabalho — Estrutura Modular

Refatoração de `plantoes_cloud_76.html` (~7800 linhas) em uma estrutura modular.

---

## Como usar

### Opção A — Arquivo único (recomendado para uso imediato)
Abra `bundle.html` — idêntico funcionalmente ao original, mas com o código
organizado em seções nomeadas. Funciona offline, em `file://`, em Netlify, etc.

### Opção B — Estrutura modular com servidor
Sirva a pasta com qualquer servidor HTTP (ex: `npx serve .` ou Live Server no VS Code)
e abra `index.html`. Cada módulo é um arquivo separado.

---

## Estrutura de arquivos

```
plantoes_modular/
├── bundle.html          ← Arquivo único autocontido (substituto direto do original)
├── index.html           ← Ponto de entrada da estrutura modular (requer servidor HTTP)
│
├── css/                 ← Estilos divididos por domínio
│   ├── variables.css    — Variáveis CSS, temas claro/escuro, reset global
│   ├── layout.css       — Sidebar, main, topbar, botões, KPIs, próximo plantão
│   ├── components.css   — Tabela, células inline, modais, formulários, tags
│   ├── cards.css        — Resumo cards, empty state, toast, setup banner, animações
│   ├── auth.css         — Tela PIN, seletor de usuário, keypad, sidebar-user
│   ├── themes.css       — Sistema de temas, variantes light, seletor de temas
│   ├── calendar.css     — Calendário mensal, semana, colunas ordenáveis
│   ├── financas.css     — Módulo de finanças: tabs, gastos, impostos, reserva
│   ├── tarefas.css      — Tarefas, categorias, prioridades, drag & drop
│   ├── treino.css       — Módulo de treino, exercícios, modo compacto
│   └── search.css       — Busca global, atalhos de teclado, impressão (@print)
│
├── js/                  ← JavaScript dividido por domínio funcional
│   ├── config.js        — Constantes, SUPABASE_URL/KEY, paleta de cores, defaultCfg
│   ├── supabase.js      — initSupabase, setSyncStatus, loadLocal/saveLocal, cloud sync
│   ├── calculos.js      — durMins, calcValor, isPast, autoStatus, formatadores
│   ├── plantoes.js      — Edição inline, quick-add, buildRow, render, modal, settings
│   ├── ui.js            — Tema, toggle, chart bars, showPage, navegação
│   ├── auth.js          — PIN, perfis, login, logout, sessão, Google Calendar tutorial
│   ├── calendario.js    — renderCalendar, vista mensal/semanal, calEdit
│   ├── misc.js          — Auto-status timer, sort, undo stack, notificações
│   ├── home.js          — Tela inicial, bell widget (vencimentos), search global
│   ├── eventos.js       — PDF export, CRUD de eventos do calendário
│   ├── tarefas.js       — CRUD de tarefas e categorias, sort, renderTarefas
│   ├── financas.js      — Despesas, receitas, gastos fixos, reserva, impostos SN
│   ├── cloud_sync.js    — syncToCloud, syncFromCloud, export/import JSON, service worker
│   └── treino.js        — Exercícios, fichas, registros, crônometro + Materiais + init()
│
└── pages/               ← Fragmentos HTML (referência / para builds futuros)
    ├── pin_auth.html
    ├── sidebar.html
    ├── page_inicio.html
    ├── page_calendario.html
    ├── page_tarefas.html
    ├── page_financas.html
    └── page_materiais.html
```

---

## Verificação de integridade

| Métrica | Original | Bundle |
|---|---|---|
| Funções JS | 395 | 395 ✅ |
| IDs HTML | 325 | 325 ✅ |
| Config Supabase | ✅ | ✅ |
| Diferença de tamanho | 489 KB | +3 KB (cabeçalhos de módulo) |

---

## Módulos JS — responsabilidades

| Módulo | Responsabilidade principal |
|---|---|
| `config` | Credenciais Supabase, constantes globais, paleta de cores, `defaultCfg` |
| `supabase` | Inicialização do cliente, indicador de sync, localStorage por usuário, upsert/delete cloud |
| `calculos` | Cálculos puros: duração, valor, datas, formatadores (sem efeitos colaterais) |
| `plantoes` | CRUD de plantões: tabela, edição inline, quick-add, modal, filtros, settings |
| `ui` | Tema visual, chart de barras, navegação de páginas |
| `auth` | PIN, seleção de perfil, login/logout, sessão, Google Calendar script |
| `calendario` | Renderização mensal e semanal, edição rápida de plantão via calendário |
| `misc` | Timer de auto-status, undo stack, notificações push, sort de colunas |
| `home` | Tela inicial, cards de resumo, bell widget de vencimentos, busca global |
| `eventos` | Exportar PDF, CRUD de eventos do calendário pessoal |
| `tarefas` | CRUD de tarefas e categorias, renderização kanban, drag & drop |
| `financas` | Despesas, receitas avulsas, gastos fixos/semifixos/variáveis, reserva, impostos Simples Nacional |
| `cloud_sync` | Sincronização bidirecional Supabase, exportar/importar JSON, service worker |
| `treino` | Exercícios, fichas de treino, registros de sessão, crônometro · Módulo Materiais · `init()` |

---

## Próximos passos sugeridos

1. **Converter para ES Modules** (`import`/`export`) para eliminar variáveis globais
2. **Extrair `pages/`** para carregamento dinâmico via `fetch()` (reduz HTML inicial)
3. **TypeScript** — adicionar tipos às funções de cálculo e storage
4. **Testes** — funções puras em `calculos.js` são facilmente testáveis com Vitest
