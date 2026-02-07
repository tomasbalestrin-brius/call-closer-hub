

# Plano de Otimizacao Completa de Performance

## Resumo das Mudancas

Organizadas em 4 etapas para aplicar de forma incremental.

---

## Etapa 1 - Eliminar payloads pesados (maior impacto)

### 1.1 Dashboard - Selecionar apenas colunas necessarias

**Arquivo**: `src/pages/Dashboard.tsx`

Trocar os 3 `select('*')` por selects especificos:

- `calls`: `select('id, score, status, client_id, call_date, sale_value, entry_value, product')`
- `clients` (vendidos): `select('id, sale_value, entry_value, product_offered, funnel_source, sold_at')`
- `clients` (ofertas): `select('id, product_offered')` - ja otimizado

### 1.2 Calls - Selecionar apenas colunas necessarias

**Arquivo**: `src/pages/Calls.tsx`

Trocar `select('*')` por select com todas as colunas exceto `transcription` (mesmo padrao da correcao do SquadView).

### 1.3 Clients - Selecionar apenas colunas necessarias

**Arquivo**: `src/pages/Clients.tsx`

Trocar `select('*')` por select com todas as colunas necessarias para o Kanban (excluir campos grandes como `notes` se nao exibidos).

### 1.4 Portfolio - Selecionar apenas colunas necessarias

**Arquivo**: `src/hooks/usePortfolio.ts`

- `useAllClients`: trocar `select('*')` por `select('id, is_sold, sale_value, closer_id')`
- `useAllClientActivities`: trocar `select('*')` por `select('id, client_id, activity_type')`
- `useAllIndications`: trocar `select('*')` por `select('id, client_id, indication_type, status')`

---

## Etapa 2 - Cache global e React Query

### 2.1 Configurar QueryClient com staleTime global

**Arquivo**: `src/App.tsx`

```
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // 30s antes de re-fetch
      gcTime: 5 * 60 * 1000,   // 5min no cache
      refetchOnWindowFocus: false,
    },
  },
});
```

Isso evita re-fetches automaticos toda vez que o usuario troca de aba do navegador e volta.

### 2.2 Migrar Calls para React Query

**Arquivo**: `src/pages/Calls.tsx`

Trocar o `useState` + `useEffect` + `fetchCalls` manual por `useQuery` com queryKey baseada nos filtros. Beneficios:
- Cache automatico
- Dados mantidos ao voltar para a pagina
- Loading state e error state gerenciados

### 2.3 Migrar Clients para React Query

**Arquivo**: `src/pages/Clients.tsx`

Mesmo padrao do Calls. Trocar `fetchClients` manual por `useQuery`.

---

## Etapa 3 - Paralelizar queries restantes

### 3.1 Calls/Clients: fetchClosers para Leaders

**Arquivos**: `src/pages/Calls.tsx`, `src/pages/Clients.tsx`

Na funcao `fetchClosers` para leaders, as 2 queries (squad_members, depois profiles) podem ser parcialmente paralelizadas.

### 3.2 Clients: buscar clientes e last calls em paralelo

**Arquivo**: `src/pages/Clients.tsx`

Atualmente a query de `calls` (lastCallDate) so roda APOS os clientes carregarem. Essas queries podem rodar em paralelo se passarmos o `closer_id` em vez de depender dos `clientIds`.

---

## Etapa 4 - Paginacao e carregamento em etapas

### 4.1 Limitar calls e clients por pagina

Adicionar `.limit(50)` nas queries de Calls e Clients com um botao "Carregar mais" ou scroll infinito. Isso evita buscar centenas de registros de uma vez.

### 4.2 Lazy load do Dashboard via Index

**Arquivo**: `src/pages/Index.tsx`

Trocar a importacao direta de Dashboard por lazy:

```
const Dashboard = lazy(() => import('./Dashboard'));
```

Ou tornar o proprio Index lazy-loaded em App.tsx (ja e a rota principal, entao precisa ficar fora do lazy).

---

## Impacto Estimado

| Etapa | Reducao de Payload | Reducao de Tempo |
|-------|-------------------|-----------------|
| Etapa 1 - Selects otimizados | ~90-95% menos dados | ~50-70% mais rapido |
| Etapa 2 - Cache global | N/A | Navegacao instantanea entre paginas |
| Etapa 3 - Paralelizacao | N/A | ~30-40% mais rapido no load inicial |
| Etapa 4 - Paginacao | Proporcional ao volume | Escalavel com crescimento |

## Arquivos Modificados

- `src/App.tsx` (cache global)
- `src/pages/Dashboard.tsx` (selects otimizados)
- `src/pages/Calls.tsx` (selects + React Query)
- `src/pages/Clients.tsx` (selects + React Query + paralelo)
- `src/hooks/usePortfolio.ts` (selects otimizados)
- `src/pages/Index.tsx` (lazy load)

## Sugestao de Implementacao

Recomendo implementar por etapa. A Etapa 1 (selects) ja traz o maior ganho com menor risco. Depois a Etapa 2 (cache) para experiencia de navegacao. Etapas 3 e 4 sao incrementais.

