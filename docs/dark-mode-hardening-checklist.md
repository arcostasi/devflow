# Dark Mode Hardening Checklist

Data de referência: 21 de março de 2026

## Pré-requisitos

- Subir o app com `npm run dev`.
- Garantir que os fixtures locais estejam presentes em `d:\Code\js\devflow\.qa-fixtures`.
- Validar com a base `d:\Code\js\devflow\devflow.db` contendo:
  - `qa-20260321-repo-backend`
  - `qa-20260321-repo-frontend`
  - `qa-20260321-sprint-active`
  - `qa-20260321-user-pending`
  - `qa-20260321-user-dev`

## Telas críticas

### Login

- Abrir a tela autenticada e não autenticada em dark mode.
- Confirmar contraste suficiente entre shell, card, campos, mensagens de erro/sucesso e CTA primário.
- Navegar só com teclado:
  - `Tab` deve percorrer nome, email, senha, CTA e link secundário.
  - o foco precisa ficar visível sem depender da cor do browser.

### Dashboard

- Verificar cards principais, atividade recente e portfólio técnico.
- Confirmar que textos auxiliares continuam legíveis em superfícies `surface-card` e `surface-muted`.

### Sprint Ativa

- Confirmar que o filtro de pessoas mostra apenas usuários ativos.
- Abrir `Nova Tarefa` e verificar que a lista de responsáveis não inclui usuários `pending` ou `inactive`.
- Testar `Tab`, `Shift+Tab` e `Escape` no modal.

### Repo Detail

- Abrir `QA Backend Service`.
- Confirmar que `README.md` carrega com conteúdo real.
- Abrir um arquivo da árvore e verificar contraste entre editor, metadados e ações.

### Ambientes

- Confirmar no topo:
  - `Saudaveis = 1`
  - `Em alerta = 1`
  - `Criticos = 0`
- Verificar se os blocos agrupam por nome de repositório, não por `repoId`.

### Configurações

- Abrir a tela e confirmar:
  - `Integrações = 1`
  - `Governança = 1` antes de entrar na aba `Usuários`.
- Validar foco em tabs, toggles e botões administrativos.

### Command Palette

- Abrir com `Ctrl+K` ou `Cmd+K`.
- Confirmar:
  - contraste do painel e dos itens selecionados;
  - `ArrowDown`, `ArrowUp`, `Enter` e `Escape`;
  - estado vazio com mensagem legível.

### Toasts

- Disparar toasts de `success`, `error` e `info`.
- Confirmar que título, descrição, borda tonal e botão de fechar mantêm contraste suficiente.

## Critérios de aceite

- Nenhum fluxo principal depende de texto abaixo do contraste esperado para dark mode.
- Todo elemento interativo importante tem foco visível.
- Estados carregados continuam legíveis em dados reais, não só em empty states.
- Componentes globais reutilizados fora da shell principal seguem a mesma linguagem visual.
