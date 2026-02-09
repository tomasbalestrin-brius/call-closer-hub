

# Fix: Drag-and-Drop no CRM Calls

## Problemas Identificados

1. **`setData()` ausente no `dragstart`**: Alguns navegadores exigem que `e.dataTransfer.setData()` seja chamado para iniciar o drag corretamente. Sem isso, o drag pode falhar silenciosamente.

2. **Conflito click vs drag**: O `ClientCard` tem `onClick` que navega para `/clients/${client.id}`. Quando o drag e muito curto ou cancelado, o `click` dispara e leva o usuario para outra pagina, dando a impressao de que o drag nao funciona. No `IntensiveKanban`, o `onClick` abre um dialog (permanece na mesma pagina), entao esse problema nao aparece la.

## Solucao

### Arquivo: `src/components/clients/ClientKanban.tsx`

1. Adicionar `e.dataTransfer.setData('text/plain', client.id)` no `handleDragStart` para garantir compatibilidade com todos os navegadores
2. Usar um `useRef` para rastrear se um drag esta em progresso
3. No wrapper draggable, interceptar o `onClick` e prevenir a navegacao se um drag acabou de ocorrer

### Arquivo: `src/components/intensivo/IntensiveKanban.tsx`

1. Adicionar `e.dataTransfer.setData('text/plain', lead.id)` no `handleDragStart` para consistencia

## Detalhes Tecnicos

### Logica do flag de drag (ClientKanban):

```typescript
const isDraggingRef = useRef(false);

const handleDragStart = (e: React.DragEvent, client: ClientWithLastCall) => {
  isDraggingRef.current = true;
  setDraggedClient(client);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', client.id);
};

const handleDragEnd = () => {
  // Usar setTimeout para que o flag persista durante o evento click
  setTimeout(() => { isDraggingRef.current = false; }, 0);
  setDraggedClient(null);
  setDragOverColumn(null);
  stopScroll();
};
```

### Interceptacao do click no wrapper draggable:

```tsx
<div
  draggable
  onDragStart={(e) => handleDragStart(e, client)}
  onDragEnd={handleDragEnd}
  onClick={(e) => {
    if (isDraggingRef.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  }}
  className={cn(
    "cursor-grab active:cursor-grabbing transition-opacity",
    draggedClient?.id === client.id && "opacity-50"
  )}
>
  <ClientCard client={client} lastCallDate={client.lastCallDate} onUpdate={onRefresh} />
</div>
```

### setData no IntensiveKanban (para consistencia):

```typescript
const handleDragStart = (e: React.DragEvent, lead: IntensiveLead) => {
  setDraggedLead(lead);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', lead.id);
};
```

### Arquivos modificados:
- `src/components/clients/ClientKanban.tsx` - Flag de drag + setData
- `src/components/intensivo/IntensiveKanban.tsx` - setData para compatibilidade

