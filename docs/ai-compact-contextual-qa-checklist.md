# Checklist de QA: IA Compacta e Contextual

Data de referência: 24 de março de 2026

## Objetivo

Validar que o assistente de preenchimento com IA:

- ocupa menos espaço visual em campos, modais e painéis;
- responde de forma coerente com a janela atual;
- evita texto genérico, institucional ou inventado;
- mantém feedback claro de loading, erro e aviso sem poluir a interface.

## Escopo prioritário

- `Configurações > Meu Perfil`
- `Nova Tarefa`
- `Kanban > detalhes da tarefa`
- `Kanban > comentários`
- `Kanban > branch`
- `Repositórios > Novo Repositório`
- `Sprints > criar sprint`
- `Ambientes > criação`
- `Ambientes > edição`
- `Ambientes > notas de deploy`

## Checklist visual

- O modo `compact` aparece como linha curta de ação, sem caixa alta adicional por padrão.
- O botão principal da IA usa rótulo curto por intenção, como `Gerar`, `Refinar` ou `Sugerir`.
- O botão de ajuste no modo `compact` aparece como controle secundário discreto.
- O modo `inline` não aumenta a altura do campo de forma perceptível.
- O modo `expanded` continua legível e só aparece onde o fluxo realmente precisa de contexto maior.
- O loading da IA não desloca o layout de forma brusca.
- Erros e warnings aparecem abaixo do assistente sem quebrar alinhamento do formulário.
- Em mobile, a linha da IA quebra de forma limpa e não estoura a largura do modal.

## Checklist de contexto

- Em `Nova Tarefa`, o texto cita status, prioridade, responsável, repositório ou tags quando isso estiver disponível.
- Em `Comentários`, a resposta conversa com a thread atual e não soa como resumo formal.
- Em `Branch`, o nome proposto reflete o trabalho técnico real da tarefa.
- Em `Novo Repositório`, a IA diferencia criação nova de vínculo existente.
- Em `Sprint`, nome e meta respeitam datas e evitam duplicar sprints já existentes.
- Em `Ambientes`, descrição e notas refletem tipo, versão, status, risco e histórico recente quando houver.
- Em `Perfil`, a bio se ancora no papel e nas responsabilidades reais do usuário.

## Checklist de qualidade textual

- O texto não usa clichês como `garantir qualidade`, `melhorar performance` ou `solução escalável` sem evidência contextual.
- O texto não inventa pessoas, entregas, riscos ou dependências ausentes.
- O texto não soa como tradução literal ou IA genérica.
- Em `pt-BR`, evitar construções artificiais como `produção intermédio` ou `testes aguçados`.
- Quando o contexto for fraco, a resposta deve ser curta e conservadora em vez de preencher lacunas com suposições.
- Quando o campo já tiver valor, `Refinar` ou `Reescrever` preserva os fatos centrais.
- Listas como tags e checklist não trazem duplicatas nem itens vagos.

## Checklist funcional

- Clicar em `Gerar` preenche o campo correto.
- Clicar em `Ajustar` expande a orientação extra sem afetar outros campos da mesma tela.
- Enviar orientação extra altera o resultado de forma perceptível e coerente.
- Em caso de resposta genérica, o backend tenta segunda geração automaticamente.
- Quando o contexto for fraco, o warning conservador é exibido sem bloquear uso.
- O retorno de erro da IA continua tratável sem travar o modal ou drawer.

## Checklist de regressão

- `npm run build` conclui sem erro.
- Fluxos sem IA continuam funcionando normalmente.
- Fechar e reabrir modais não mantém estado visual indevido do ajuste da IA.
- A densidade `compacta` do sistema não quebra o posicionamento do assistente.
- Tema claro e escuro mantêm contraste suficiente nos botões e avisos da IA.

## Cenários mínimos de validação manual

1. Abrir `Configurações`, gerar bio e validar se a frase cita papel real do usuário sem clichê corporativo.
2. Abrir `Nova Tarefa`, preencher prioridade, responsável e repositório, gerar título e descrição e validar ancoragem nesses dados.
3. Abrir uma tarefa no `Kanban`, testar geração de comentário com thread recente e validar tom natural.
4. Abrir `Novo Repositório`, alternar entre `Criar Novo` e `Vincular Existente` e comparar o comportamento da IA.
5. Abrir `Ambientes`, testar descrição, notas internas e notas de deploy com contexto real de status e versão.
6. Revisar o layout em largura desktop e em viewport estreita.

## Critério de encerramento

- Os fluxos prioritários passam na checklist visual e contextual.
- Nenhum caso prioritário produz texto obviamente genérico em dois testes seguidos.
- O assistente não cria blocos grandes por padrão nos formulários compactos.
