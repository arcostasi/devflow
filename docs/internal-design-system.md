# Design System Interno

## Objetivo

Este documento registra as utilidades visuais e convenções operacionais usadas no DevFlow após o ciclo de refinamento de dark mode, light mode e hardening visual.

Ele deve servir como referência para:

- novas telas;
- refactors visuais;
- revisão de consistência entre áreas de produto;
- redução de classes ad hoc repetidas em componentes.

## Princípios do sistema

- Trabalhar com superfícies semânticas, não com combinações soltas de `bg-*`, `border-*` e `dark:*`.
- Dar prioridade para hierarquia de leitura: shell, header operacional, bloco executivo, bloco denso, empty state.
- Manter a UI profissional, compacta e previsível.
- Usar o tema claro e escuro a partir da mesma utilidade sempre que possível.
- Evitar duplicar estilos locais quando já existe uma classe utilitária em `index.css`.

## Estrutura base de página

### Shell e composição

- `page-shell`
  - container principal da tela.
  - aplicar nas páginas operacionais e executivas.
- `page-container` e `page-container-narrow`
  - largura de conteúdo para telas amplas.
- `page-stack`
  - espaçamento vertical padrão entre blocos.
- `page-header-block`
  - topo com título, descrição e ações.
- `page-title`
  - título principal da tela.
- `page-subtitle`
  - copy auxiliar do topo.
- `page-actions`
  - grupo de CTAs do cabeçalho.
- `page-toolbar`
  - barra de filtros, seleção, busca e ações secundárias.
- `page-toolbar-item`
  - item de toolbar com crescimento controlado.
- `page-tabs`
  - navegação local entre seções da mesma tela.
- `page-panel-grid`
  - grid padrão entre painéis principais da página.
  - usar como substituto de `grid ... gap-6` quando o objetivo for separar blocos estruturais.

### Regra de composição

Para novas telas, preferir esta ordem:

1. `page-shell`
2. header executivo com `page-header-block`
3. bloco principal em `surface-card`
4. toolbar ou tabs quando houver operação
5. grids densos, listas ou painéis
6. empty state dentro de `surface-empty`

## Espaçamento padrão

O sistema passou a usar utilidades semânticas para espaçamento entre painéis e dentro deles. A regra é simples: separar estrutura, conteúdo e áreas densas com o mesmo ritmo visual.

### Espaçamento estrutural

- `page-stack`
  - ritmo vertical entre blocos principais da página.
  - valor base: `1.5rem`.
- `page-panel-grid`
  - distância entre painéis principais lado a lado ou empilhados.
  - valor base: `1.5rem`.
- `panel-stack`
  - pilha vertical padrão dentro de um painel.
  - valor base: `1.5rem`.
- `panel-stack-tight`
  - pilha vertical compacta para blocos auxiliares ou métricas laterais.
  - valor base: `1rem`.

### Espaçamento interno de painel

- `panel-header-block`
  - header padrão de painéis principais.
  - padding base: `1.25rem 1.5rem`.
- `panel-header-compact`
  - header para listas, feeds e blocos laterais.
  - padding base: `1rem 1.25rem`.
- `panel-body-block`
  - corpo padrão de painéis principais.
  - padding base: `1.5rem`.
- `panel-body-compact`
  - corpo compacto de listas, drawers e áreas secundárias.
  - padding base: `1rem 1.25rem`.
- `panel-list-body`
  - corpo de listas operacionais com rolagem.
  - padding base: `1rem`.
- `panel-list-row`
  - linha padrão de listas técnicas e operacionais.
  - padding base: `0.625rem 0.75rem`.

### Regra prática

- Entre painéis principais da tela: usar `page-panel-grid`.
- Dentro de um painel com seções independentes: usar `panel-stack`.
- Em colunas laterais pequenas ou grupos de KPI: usar `panel-stack-tight`.
- Em listas operacionais com seleção, stage, arquivos ou linhas técnicas: usar `panel-list-body` e `panel-list-row`.
- Evitar alternar aleatoriamente entre `gap-4`, `gap-6`, `p-6`, `px-6 py-5` e `px-5 py-4` quando a utilidade semântica já existe.
- Em `density-compact`, essas utilidades já reduzem o respiro automaticamente; não duplicar override no componente.

## Superfícies

As superfícies devem representar profundidade e função.

- `surface-card`
  - container principal de painéis, cards executivos, listas e modais.
  - já inclui fundo, borda e sombra semânticos.
- `surface-muted`
  - toolbar, blocos auxiliares, painéis de leitura rápida.
- `surface-subtle`
  - separações leves ou áreas sem destaque estrutural.
- `surface-inset`
  - regiões internas mais densas, como blocos encaixados.
- `surface-header`
  - cabeçalhos internos de cards e tabelas.
- `surface-empty`
  - estado vazio, placeholder e callout neutro.

### Regra prática

- `surface-card` para o primeiro nível de leitura.
- `surface-muted` para contexto operacional de segundo nível.
- `surface-empty` para ausência de dados, nunca um `div` neutro sem tratamento.
- Evitar repetir `border-slate-200/75 bg-white/88 dark:border-white/10 dark:bg-transparent` quando a superfície já cobre essa intenção.

## Formulários e ações

### Inputs

- `app-input`
  - classe base para `input`, `textarea` e `select`.
  - já resolve fundo, borda, texto, placeholder e `focus-visible`.

Usar junto com classes de geometria apenas quando necessário:

- `rounded-xl`
- `px-*`
- `py-*`
- `font-mono` quando o conteúdo for técnico

### Botões principais

- `app-button-primary`
  - CTA principal da tela ou modal.
- `app-button-secondary`
  - ação secundária relevante.
- `app-button-danger`
  - ação destrutiva.

### Ações suaves

- `app-soft-button`
  - ações secundárias de apoio, filtros leves e atalhos.
- `app-soft-icon-button`
  - ações pontuais com ícone.

Essas classes já cobrem:

- `hover`
- `pressed`
- `focus-visible`
- diferenças entre light e dark mode

## Tipografia e metadados

- `app-section-label`
  - eyebrow de seção, labels executivos e pequenos títulos operacionais.
- `app-metric-label`
  - labels de KPI, status e blocos de métrica.
- `app-copy`
  - texto secundário principal, mais espaçado.
- `app-copy-compact`
  - texto técnico ou operacional mais denso.
- `app-meta-row`
  - linha de metadados com data, branch, autor, tags e status.
- `app-soft-badge`
  - badge suave para contexto complementar, sem parecer CTA.

### Regra de hierarquia

- Título da seção: texto nativo do componente com `font-semibold` ou `font-bold`.
- Label superior: `app-section-label`.
- Descrição: `app-copy` ou `app-copy-compact`.
- Metadados: `app-meta-row`.
- Selo auxiliar: `app-soft-badge`.

## Branding e chrome global

- `app-brand-badge`
  - base visual da marca em login, sidebar e header.
- `app-brand-badge-sm`
- `app-brand-badge-md`
- `app-brand-badge-lg`
  - escalas da marca.
- `app-header-brand`
  - agrupamento da marca no topo.
- `app-flyout`
  - menus, overlays e superfícies flutuantes do chrome.
- `app-user-chip`
  - identidade do usuário no header.

## Padrões de tela recomendados

### 1. Tela executiva

Usar em dashboard, backlog e resumo de ambientes.

Estrutura:

1. hero executivo em `surface-card`
2. resumo lateral em `surface-card` ou `surface-muted`
3. blocos operacionais abaixo
4. cards internos com mesmas utilidades tipográficas

### 2. Tela técnica densa

Usar em repositórios, repo detail e controle de fonte.

Estrutura:

1. topo com leitura rápida
2. toolbar ou tabs em `page-toolbar` ou `page-tabs`
3. painel principal em `surface-card`
4. painel lateral em `surface-card` ou `surface-muted`
5. estados vazios em `surface-empty`

### 3. Modal operacional

Usar em criação de tarefa, repositório, sprint, deploy e ambiente.

Estrutura:

1. bloco introdutório curto
2. campos agrupados por função
3. `app-input` em todos os controles
4. CTA principal com `app-button-primary`
5. CTA de apoio com `app-button-secondary` ou `app-soft-button`

## Regras de light e dark mode

- Sempre começar pela utilidade semântica existente.
- Só escrever variações `dark:*` locais quando o componente tiver uma exceção real.
- Não reintroduzir padrões antigos como:
  - `dark:bg-white/[0.03]`
  - `dark:border-white/10`
  - `bg-white/90 dark:bg-transparent`
  - `text-slate-500 dark:text-slate-400`
  quando a utilidade já resolve esse papel.
- Em light mode, evitar branco puro em excesso quando a tela estiver dentro de `page-shell`.
- Em dark mode, garantir contraste sem transformar tudo no mesmo nível de preto/cinza.

## Microinterações

- Elementos interativos importantes precisam de `focus-visible` claro.
- `hover` deve reforçar intenção, não redesenhar o componente.
- `pressed` deve reduzir elevação e não alterar drasticamente a cor.
- Ações secundárias devem preferir `app-soft-button` ou `app-soft-icon-button`.
- Estados `disabled` precisam reduzir contraste e sombra de forma previsível.

## Do e Don’t

### Fazer

```tsx
<section className="surface-card panel-body-block rounded-[1.6rem]">
  <p className="app-section-label">Leitura Operacional</p>
  <h2 className="mt-3 text-xl font-semibold text-slate-900 dark:text-white">
    Repositórios críticos
  </h2>
  <p className="app-copy mt-2">
    Acompanhe status, branch ativa e gargalos sem competir com o restante da tela.
  </p>
</section>
```

```tsx
<div className="page-panel-grid xl:grid-cols-[minmax(0,2fr)_22rem]">
  <section className="surface-card overflow-hidden rounded-[1.6rem]">
    <div className="panel-header-block surface-header">
      <h3 className="text-lg font-semibold">Resumo</h3>
    </div>
    <div className="panel-body-block">
      ...
    </div>
  </section>
</div>
```

```tsx
<div className="page-toolbar">
  <input className="app-input rounded-xl px-3 py-2.5" />
  <button className="app-soft-button rounded-xl px-4 py-2.5">
    Filtrar
  </button>
</div>
```

### Evitar

```tsx
<section className="rounded-2xl border border-slate-200/75 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-transparent">
  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
    Leitura Operacional
  </p>
</section>
```

Esse padrão duplica decisões já centralizadas em `surface-card`, `app-section-label` e nas utilidades de espaçamento semântico.

## Checklist para novas telas

- A tela usa `page-shell` e uma composição previsível.
- Cards principais usam `surface-card`.
- O espaçamento entre painéis principais usa `page-panel-grid`.
- Headers e corpos de painéis usam `panel-header-block`, `panel-header-compact`, `panel-body-block` ou `panel-body-compact`.
- Toolbars e tabs usam as utilidades próprias.
- Inputs usam `app-input`.
- CTAs principais usam `app-button-primary`.
- Ações secundárias usam `app-button-secondary`, `app-soft-button` ou `app-soft-icon-button`.
- Labels e copy usam `app-section-label`, `app-copy`, `app-copy-compact` ou `app-metric-label`.
- Empty states usam `surface-empty`.
- O resultado em light mode não depende de branco puro em excesso.
- O resultado em dark mode não depende de classes ad hoc repetidas.
- Foco de teclado continua visível.

## Áreas de referência no código

Usar estas telas como referência antes de criar uma nova:

- `components/Dashboard.tsx`
- `components/Backlog.tsx`
- `components/Kanban.tsx`
- `components/RepositoryList.tsx`
- `components/RepoDetail.tsx`
- `components/GitIntegration.tsx`
- `components/Environments.tsx`
- `components/Settings.tsx`

## Regra final

Se uma nova tela exigir mais de duas combinações repetidas de `bg`, `border`, `text` e `dark:*`, a decisão correta provavelmente é promover esse padrão para `index.css` em vez de replicá-lo no componente.
