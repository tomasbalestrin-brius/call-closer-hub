

# Melhoria no Drag-and-Drop dos Kanbans

## Problema Atual

O drag-and-drop nos Kanbans (CRM Calls e Intensivo) usa a API nativa do HTML5 que tem limitacoes:
- No CRM Calls (`ClientKanban`): nao ha feedback visual de qual coluna esta sendo sobrevoada
- No Intensivo (`IntensiveKanban`): o `handleDragLeave` reseta o highlight prematuramente ao passar sobre cards filhos dentro da coluna (event bubbling)
- Em ambos: se o usuario soltar o card fora de qualquer coluna, o estado `draggedClient`/`draggedLead` pode ficar preso

## Solucao

### 1. ClientKanban - Adicionar feedback visual e `onDragEnd`

- Adicionar estado `dragOverColumn` para destacar a coluna alvo (igual ao IntensiveKanban)
- Adicionar handler `onDragEnd` no elemento draggable para limpar estado quando o drag e cancelado (soltar fora, pressionar ESC)
- Adicionar `onDragLeave` na coluna para remover highlight

### 2. IntensiveKanban - Corrigir bug do `onDragLeave`

- O `onDragLeave` dispara ao entrar em elementos filhos dentro da coluna (cards, textos), removendo o highlight incorretamente
- Corrigir verificando `e.currentTarget.contains(e.relatedTarget)` para ignorar transicoes internas
- Adicionar `onDragEnd` no card para limpar estado em caso de cancelamento

### 3. Ambos os Kanbans - Garantir drag livre

- Adicionar `onDragEnd` nos elementos draggable para resetar todo o estado (draggedItem, dragOverColumn, stopScroll)
- Isso garante que ao soltar em qualquer lugar ou cancelar, o sistema volta ao estado limpo

## Detalhes Tecnicos

### Arquivos modificados:

**`src/components/clients/ClientKanban.tsx`**
- Novo estado: `const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)`
- `handleDragOver` recebe `columnId` e seta `setDragOverColumn(columnId)`
- Novo `handleDragEnd`: limpa `draggedClient`, `dragOverColumn`, chama `stopScroll()`
- `handleDrop`: limpa `dragOverColumn`
- Visual: borda/fundo destacado na coluna ativa (`isDragOver ? 'border-primary bg-primary/5' : ''`)
- Atributo `onDragEnd={handleDragEnd}` no div draggable

**`src/components/intensivo/IntensiveKanban.tsx`**
- Corrigir `handleDragLeave`: verificar se `e.relatedTarget` ainda esta dentro do `e.currentTarget`
- Novo `handleDragEnd`: limpa `draggedLead`, `dragOverColumn`, chama `stopScroll()`
- Atributo `onDragEnd={handleDragEnd}` no `IntensiveLeadCard` (via prop ou wrapper)

**`src/components/intensivo/IntensiveLeadCard.tsx`**
- Adicionar prop `onDragEnd` e passar ao elemento `Card`

### Logica do `handleDragLeave` corrigido:
```tsx
const handleDragLeave = (e: React.DragEvent) => {
  // Ignorar se o mouse ainda esta dentro da coluna (transitou para um filho)
  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
  setDragOverColumn(null);
};
```

### Logica do `handleDragEnd`:
```tsx
const handleDragEnd = () => {
  setDraggedClient(null);
  setDragOverColumn(null);
  stopScroll();
};
```

