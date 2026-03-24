# Backlog Técnico: IA Auto Complete Compacta e Contextual

Data de referência: 23 de março de 2026

## Objetivo

Transformar o auto complete com IA do DevFlow em uma experiência:

- mais compacta em inputs, textareas, modais e painéis;
- mais coerente com o contexto de cada janela;
- menos propensa a texto genérico, robótico ou inventado;
- mais consistente entre frontend, API e prompts do backend.

## Escopo afetado

- frontend base do assistente:
  - `components/AIFieldAssist.tsx`
  - `index.css`
- contrato e integração:
  - `types.ts`
  - `services/api.ts`
  - `server/routes/ai.js`
- inteligência e validação:
  - `server/services/ollama.js`
- telas consumidoras:
  - `components/NewTaskModal.tsx`
  - `components/Kanban.tsx`
  - `components/Environments.tsx`
  - `components/NewRepoModal.tsx`
  - `components/ManageSprintsModal.tsx`
  - `components/Settings.tsx`
  - `components/GitIntegration.tsx`

## Estratégia de entrega

- Fase 1:
  - estabelecer contrato técnico e base visual reutilizável.
- Fase 2:
  - reestruturar backend de contexto e qualidade de geração.
- Fase 3:
  - migrar fluxos críticos com maior impacto operacional.
- Fase 4:
  - migrar fluxos complementares e alinhar consistência visual.
- Fase 5:
  - validar, medir e endurecer o comportamento final.

## Estimativa macro

- Fase 1: 0,5 a 1 dia
- Fase 2: 1 a 1,5 dia
- Fase 3: 1 a 1,5 dia
- Fase 4: 0,5 a 1 dia
- Fase 5: 0,5 dia

Estimativa total:

- 3,5 a 5,5 dias úteis

## Dependências principais

- A Fase 1 precisa ser concluída antes da migração de telas.
- A Fase 2 precisa existir antes do rollout completo, senão a UI melhora mas a qualidade textual continua inconsistente.
- `AIFieldAssist.tsx` e `index.css` devem estabilizar antes da migração em massa dos componentes.
- `server/services/ollama.js` deve estabilizar antes de validar qualidade final por campo.

## Fase 1: Contrato e Base Visual

Objetivo:

- padronizar payload, intenções e variantes visuais do assistente.

Estimativa:

- 4 a 8 horas

### Tarefa 1.1

- Título:
  - criar tipagens centrais de superfície, intenção e variante
- Arquivos:
  - `types.ts`
- Subtarefas:
  - adicionar `AISurface`
  - adicionar `AIIntent`
  - adicionar `AIFieldAssistVariant`
  - adicionar tipo estruturado para contexto enviado ao backend
  - expandir `AIFillFieldResponse` com metadados opcionais
- Dependências:
  - nenhuma
- Estimativa:
  - 1 hora
- Critério de aceite:
  - frontend e backend conseguem compartilhar um contrato explícito sem objetos soltos por tela

### Tarefa 1.2

- Título:
  - padronizar chamada de API do preenchimento com IA
- Arquivos:
  - `services/api.ts`
- Subtarefas:
  - expandir `fillAIField`
  - suportar `surface`, `intent`, `currentValue`, `relatedEntities`, `constraints`
  - manter compatibilidade de erro e resposta
- Dependências:
  - Tarefa 1.1
- Estimativa:
  - 1 hora
- Critério de aceite:
  - qualquer tela pode chamar IA via payload único e previsível

### Tarefa 1.3

- Título:
  - refatorar `AIFieldAssist` para variantes compactas
- Arquivos:
  - `components/AIFieldAssist.tsx`
- Subtarefas:
  - introduzir variantes `inline`, `compact` e `expanded`
  - trocar o label fixo por ação contextual
  - esconder orientação extra atrás de ação secundária
  - reduzir ou remover painel informativo no modo padrão
  - manter feedback de loading e erro sem expandir demais o layout
- Dependências:
  - Tarefa 1.1
- Estimativa:
  - 2 a 3 horas
- Critério de aceite:
  - o assistente pode ser usado sem criar um bloco alto abaixo de cada campo

### Tarefa 1.4

- Título:
  - consolidar utilidades CSS para IA compacta
- Arquivos:
  - `index.css`
- Subtarefas:
  - criar classes utilitárias para trigger inline
  - criar classes para linha compacta de ação
  - criar estilos de popover leve
  - padronizar estados de loading, erro e sucesso
- Dependências:
  - Tarefa 1.3
- Estimativa:
  - 1 a 2 horas
- Critério de aceite:
  - as telas não precisam repetir classes ad hoc para encaixar IA em campos pequenos

## Fase 2: Backend de Contexto, Prompt e Validação

Objetivo:

- fazer a IA responder com mais contexto real e menos texto genérico.

Estimativa:

- 8 a 12 horas

### Tarefa 2.1

- Título:
  - normalizar o payload de IA na rota
- Arquivos:
  - `server/routes/ai.js`
- Subtarefas:
  - validar campos novos do payload
  - garantir defaults seguros
  - repassar objeto já normalizado para o serviço
- Dependências:
  - Tarefa 1.1
  - Tarefa 1.2
- Estimativa:
  - 1 hora
- Critério de aceite:
  - a rota rejeita payload quebrado e aceita o contrato novo

### Tarefa 2.2

- Título:
  - criar builder de contexto normalizado por superfície
- Arquivos:
  - `server/services/ollama.js`
- Subtarefas:
  - separar contexto bruto do frontend de contexto normalizado
  - incluir `surface`, `intent`, `currentValue`, entidades relacionadas e constraints
  - criar utilitários para preencher ausências com fallback conservador
- Dependências:
  - Tarefa 2.1
- Estimativa:
  - 2 a 3 horas
- Critério de aceite:
  - o serviço deixa de depender apenas de `context` solto por `fieldType`

### Tarefa 2.3

- Título:
  - refatorar prompts por campo com instruções anti-genérico
- Arquivos:
  - `server/services/ollama.js`
- Subtarefas:
  - revisar todos os `FIELD_DEFINITIONS`
  - introduzir regras de uso explícito do contexto real
  - proibir invenção de fatos
  - diferenciar geração, refinamento, sugestão, resumo e reescrita
  - ajustar linguagem e tom para respostas mais naturais
- Dependências:
  - Tarefa 2.2
- Estimativa:
  - 3 a 4 horas
- Critério de aceite:
  - os prompts refletem intenção e superfície, não apenas o tipo do campo

### Tarefa 2.4

- Título:
  - implementar validação pós-geração e retry corretivo
- Arquivos:
  - `server/services/ollama.js`
- Subtarefas:
  - detectar saídas vagas ou excessivamente padrão
  - validar presença de entidades do contexto quando aplicável
  - disparar segunda tentativa com prompt mais restritivo
  - devolver warning quando o conteúdo for conservador por falta de contexto
- Dependências:
  - Tarefa 2.3
- Estimativa:
  - 2 a 3 horas
- Critério de aceite:
  - respostas genéricas demais deixam de ser aplicadas diretamente

### Tarefa 2.5

- Título:
  - preparar pontos mínimos de observabilidade
- Arquivos:
  - `server/services/ollama.js`
  - `server/routes/ai.js`
- Subtarefas:
  - logar `surface`, `fieldType`, fallback, retry e erro
  - evitar logar conteúdo sensível completo
- Dependências:
  - Tarefa 2.4
- Estimativa:
  - 1 hora
- Critério de aceite:
  - falhas e campos problemáticos ficam rastreáveis por categoria

## Fase 3: Migração dos Fluxos Críticos

Objetivo:

- atacar primeiro os pontos com maior uso e maior percepção de problema.

Estimativa:

- 8 a 12 horas

### Tarefa 3.1

- Título:
  - migrar IA do modal de nova tarefa
- Arquivos:
  - `components/NewTaskModal.tsx`
- Subtarefas:
  - aplicar variante compacta em título, descrição e tags
  - ajustar intenção por estado do campo
  - enriquecer contexto com status legível, responsável, repositório e tags
  - reduzir espaçamento gerado pelo assistente
- Dependências:
  - Fase 1 concluída
  - Fase 2 até Tarefa 2.3
- Estimativa:
  - 2 a 3 horas
- Critério de aceite:
  - o modal continua compacto e as sugestões ficam específicas ao contexto da tarefa

### Tarefa 3.2

- Título:
  - migrar IA do drawer de tarefa no kanban
- Arquivos:
  - `components/Kanban.tsx`
- Subtarefas:
  - aplicar variante compacta em descrição, branch e comentário
  - manter checklist em modo expandido só se necessário
  - incluir contexto de tarefa, repo, estado atual e conteúdo existente
  - para comentário, incluir thread recente quando disponível
- Dependências:
  - Tarefa 3.1
- Estimativa:
  - 3 a 4 horas
- Critério de aceite:
  - o drawer perde blocos grandes de IA e ganha respostas mais alinhadas ao momento da tarefa

### Tarefa 3.3

- Título:
  - migrar IA da tela de ambientes
- Arquivos:
  - `components/Environments.tsx`
- Subtarefas:
  - aplicar variante compacta em descrição, notas internas e notas de deploy
  - usar contexto operacional mais rico
  - reduzir altura em edição inline, modal de criação e modal de edição
- Dependências:
  - Fase 1 concluída
  - Fase 2 até Tarefa 2.4
- Estimativa:
  - 3 a 4 horas
- Critério de aceite:
  - a IA não polui os cards e modais e o texto gerado reflete o papel real do ambiente

## Fase 4: Migração dos Fluxos Complementares

Objetivo:

- fechar consistência visual e contextual nas demais telas com IA.

Estimativa:

- 4 a 8 horas

### Tarefa 4.1

- Título:
  - migrar IA do modal de repositório
- Arquivos:
  - `components/NewRepoModal.tsx`
- Subtarefas:
  - aplicar modo compacto
  - diferenciar fortemente `create` e `link`
  - usar `localPath`, branch e descrição atual como contexto real
- Dependências:
  - Fase 1 concluída
  - Fase 2 até Tarefa 2.3
- Estimativa:
  - 1 a 2 horas
- Critério de aceite:
  - nome e descrição deixam de soar genéricos e o modal permanece enxuto

### Tarefa 4.2

- Título:
  - migrar IA de sprints
- Arquivos:
  - `components/ManageSprintsModal.tsx`
- Subtarefas:
  - aplicar modo compacto em nome e meta
  - incluir datas e sinais do backlog de sprints
  - usar nomes existentes para reduzir duplicação
- Dependências:
  - Fase 1 concluída
  - Fase 2 até Tarefa 2.3
- Estimativa:
  - 1 a 2 horas
- Critério de aceite:
  - formulário de sprint fica mais leve e com saídas menos repetitivas

### Tarefa 4.3

- Título:
  - migrar IA de bio do perfil
- Arquivos:
  - `components/Settings.tsx`
- Subtarefas:
  - aplicar variante compacta ou inline
  - revisar contexto de nome, papel e bio atual
  - alinhar prompt para evitar bio corporativa padrão
- Dependências:
  - Fase 1 concluída
  - Fase 2 até Tarefa 2.4
- Estimativa:
  - 1 a 2 horas
- Critério de aceite:
  - o campo de bio usa menos espaço e o texto fica menos institucional e mais pessoal

### Tarefa 4.4

- Título:
  - alinhar o fluxo de commit message ao mesmo contrato de IA
- Arquivos:
  - `components/GitIntegration.tsx`
  - `services/api.ts`
  - `server/services/ollama.js`
- Subtarefas:
  - manter o botão inline atual como referência visual
  - alinhar payload e tratamento ao contrato novo
  - garantir consistência de mensagens e feedback
- Dependências:
  - Fase 1 concluída
  - Fase 2 concluída
- Estimativa:
  - 1 a 2 horas
- Critério de aceite:
  - o fluxo de commit continua discreto e passa a obedecer o mesmo modelo técnico do restante do app

## Fase 5: QA, Hardening e Medição

Objetivo:

- validar resultado visual e textual antes de considerar o ciclo encerrado.

Estimativa:

- 3 a 5 horas

### Tarefa 5.1

- Título:
  - revisão visual cruzada dos pontos com IA
- Arquivos:
  - sem arquivo único
- Subtarefas:
  - validar modais em desktop e mobile
  - validar campos com valor vazio e preenchido
  - confirmar que a IA não cria saltos de layout desnecessários
- Dependências:
  - Fases 3 e 4 concluídas
- Estimativa:
  - 1 a 2 horas
- Critério de aceite:
  - nenhuma tela crítica perde densidade útil por causa do assistente

### Tarefa 5.2

- Título:
  - revisão funcional da qualidade contextual
- Arquivos:
  - sem arquivo único
- Subtarefas:
  - testar por `fieldType`
  - verificar respostas com pouco contexto
  - verificar respostas em refinamento e reescrita
  - validar que textos genéricos foram reduzidos
- Dependências:
  - Fase 2 concluída
  - Fases 3 e 4 concluídas
- Estimativa:
  - 1 a 2 horas
- Critério de aceite:
  - respostas usam entidades e sinais reais da tela atual

### Tarefa 5.3

- Título:
  - checklist final de rollout
- Arquivos:
  - opcionalmente criar checklist dedicada depois
- Subtarefas:
  - validar erros do Ollama
  - validar retry corretivo
  - validar comportamento sem contexto suficiente
  - validar regressão visual em dark mode
- Dependências:
  - Tarefa 5.1
  - Tarefa 5.2
- Estimativa:
  - 1 hora
- Critério de aceite:
  - o fluxo falha de forma elegante e não degrada a usabilidade

## Ordem recomendada de execução

1. Tarefa 1.1
2. Tarefa 1.2
3. Tarefa 1.3
4. Tarefa 1.4
5. Tarefa 2.1
6. Tarefa 2.2
7. Tarefa 2.3
8. Tarefa 2.4
9. Tarefa 2.5
10. Tarefa 3.1
11. Tarefa 3.2
12. Tarefa 3.3
13. Tarefa 4.1
14. Tarefa 4.2
15. Tarefa 4.3
16. Tarefa 4.4
17. Tarefa 5.1
18. Tarefa 5.2
19. Tarefa 5.3

## Priorização se o tempo ficar curto

Executar primeiro:

1. Fase 1 completa
2. Fase 2 até Tarefa 2.4
3. Tarefa 3.1
4. Tarefa 3.2
5. Tarefa 3.3

Pode ficar para um segundo ciclo:

- Tarefa 4.2
- Tarefa 4.3
- Tarefa 4.4
- refinamentos de observabilidade mais detalhada

## Riscos conhecidos

- A UI pode ficar compacta demais e perder clareza se o modo inline for usado indiscriminadamente.
- O backend pode continuar aceitando textos genéricos se a validação pós-geração ficar permissiva.
- Alguns campos têm contexto insuficiente por natureza; nesses casos a IA deve ser breve e conservadora.
- A migração em massa sem consolidar primeiro o padrão visual pode gerar inconsistência entre telas.

## Critério de encerramento do ciclo

O ciclo pode ser considerado concluído quando:

- o `AIFieldAssist` deixa de introduzir blocos grandes por padrão;
- os principais fluxos usam payload de contexto padronizado;
- o backend diferencia intenção e superfície;
- os textos gerados ficam mais ancorados no estado real de cada janela;
- os fluxos críticos de tarefa, kanban e ambientes passam na revisão visual e funcional.
