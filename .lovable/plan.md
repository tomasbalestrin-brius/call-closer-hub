
# Fases Pendentes de Performance Excepcional (7, 10, 11)

## Fase 7: CSS Virtualization nos Cards

Adicionar `content-visibility: auto` e `contain-intrinsic-size` nos componentes de card para que o browser pule a renderizacao de cards fora da viewport.

**Arquivos**:
- `src/components/calls/CallCard.tsx` - adicionar style no Card raiz
- `src/components/clients/ClientCard.tsx` - adicionar style no Card raiz
- `src/components/portfolio/StudentCard.tsx` - adicionar style no Card raiz
- `src/components/intensivo/IntensiveLeadCard.tsx` - adicionar style no Card raiz

Cada Card recebe: `style={{ contentVisibility: 'auto', containIntrinsicSize: '0 280px' }}`

---

## Fase 10: Paginacao no Calls

Atualmente `Calls.tsx` busca TODAS as calls sem limite. Com uso prolongado isso fica pesado.

**Mudancas em `src/pages/Calls.tsx`**:
- Adicionar estado `pageSize = 50` e `page = 0`
- Adicionar `.range(page * pageSize, (page + 1) * pageSize - 1)` na query
- Adicionar botao "Carregar mais" no final da lista que incrementa o range
- Usar `keepPreviousData: true` no useQuery para transicao suave

---

## Fase 11: Otimizacao do Kanban (CRM Clients)

Atualmente `Clients.tsx` faz 2 queries sequenciais: primeiro busca clientes, depois busca calls para extrair `lastCallDate`. Isso e ineficiente.

**Mudancas em `src/pages/Clients.tsx`**:
- Usar `Promise.all` para disparar ambas as queries em paralelo (clientes + calls) em vez de sequencialmente
- Limitar a query de calls a apenas `client_id, call_date` com `limit` otimizado

---

## Detalhes Tecnicos

### Fase 7 - Exemplo de mudanca por card:
```tsx
<Card 
  className={cn("cursor-pointer ...")}
  style={{ contentVisibility: 'auto', containIntrinsicSize: '0 280px' }}
>
```
Zero dependencias, nativo do browser. Reduz trabalho de rendering em 60-80% para listas longas.

### Fase 10 - Paginacao incremental:
```tsx
const [limit, setLimit] = useState(50);

// Na query:
.order('call_date', { ascending: false })
.limit(limit);

// No JSX:
{calls.length >= limit && (
  <Button onClick={() => setLimit(prev => prev + 50)}>
    Carregar mais
  </Button>
)}
```

### Fase 11 - Queries paralelas:
```tsx
const [clientsResult, callsResult] = await Promise.all([
  supabase.from('clients').select(CLIENTS_SELECT).eq('closer_id', targetCloserId),
  supabase.from('calls').select('client_id, call_date').eq('closer_id', targetCloserId).is('deleted_at', null).order('call_date', { ascending: false })
]);
```

### Arquivos modificados:
- `src/components/calls/CallCard.tsx`
- `src/components/clients/ClientCard.tsx`
- `src/components/portfolio/StudentCard.tsx`
- `src/components/intensivo/IntensiveLeadCard.tsx`
- `src/pages/Calls.tsx`
- `src/pages/Clients.tsx`
