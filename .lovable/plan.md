
# Auto-scroll ao Arrastar Cards no Kanban

## Problema

Ao arrastar um card de uma coluna distante (ex: "Repitch") para outra (ex: "Venda Realizada"), o usuario precisa soltar o card, rolar manualmente a tela, e arrastar novamente. A area de scroll nao acompanha o arraste.

## Solucao

Adicionar auto-scroll horizontal durante o drag em ambos os kanbans. Quando o usuario arrasta um card proximo a borda esquerda ou direita da area visivel, o scroll se move automaticamente nessa direcao.

### Comportamento

- Zona de ativacao: 80px das bordas esquerda/direita
- Velocidade progressiva: quanto mais proximo da borda, mais rapido o scroll
- Funciona durante todo o drag, sem precisar soltar o card

## Arquivos a Alterar

### 1. Criar hook reutilizavel: `src/hooks/useDragAutoScroll.ts`

Hook que encapsula a logica de auto-scroll para ser usado nos dois kanbans:

- Recebe uma `ref` do container de scroll
- No `dragover`, calcula a posicao do cursor relativa ao container
- Se estiver dentro da zona de 80px da borda, inicia um `requestAnimationFrame` loop que faz `scrollLeft += velocidade`
- Velocidade proporcional a proximidade da borda (mais perto = mais rapido, max ~15px/frame)
- Para o scroll quando o cursor sai da zona ou o drag termina

### 2. `src/components/clients/ClientKanban.tsx`

- Adicionar `useRef` no container de scroll (o `div` que contem as colunas)
- Usar o hook `useDragAutoScroll` passando a ref
- Conectar os eventos `onDragOver` do container ao hook

### 3. `src/components/intensivo/IntensiveKanban.tsx`

- Mesmo ajuste: `useRef` + `useDragAutoScroll`

## Detalhes Tecnicos

```text
|<-- 80px -->|          area visivel          |<-- 80px -->|
|  scroll <  |                                |  scroll >  |
|  auto-left |                                | auto-right |
```

O hook usara `requestAnimationFrame` para scroll suave e cancelara o loop em `dragend` ou quando o cursor sair da zona de borda. A ref apontara para o elemento DOM interno do `ScrollArea` (o `[data-radix-scroll-area-viewport]`) para ter acesso direto ao `scrollLeft`.
