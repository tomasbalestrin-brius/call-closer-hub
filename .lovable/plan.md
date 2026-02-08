
# Plano de Performance Excepcional - Bethel Closer

Objetivo: transformar o sistema de "bom" para **excepcional**. Cada milissegundo importa.

---

## Fase 5: Eliminacao de Queries Redundantes no Dashboard

**Problema**: `useMonthlySales` e a query principal do Dashboard buscam os mesmos dados de `clients` com `is_sold=true` no mes atual. O `MonthlyGoalBar` faz outra query separada para `monthly_goals`.

**Solucao**: Criar um hook `useDashboardData` que faz UMA unica chamada consolidada retornando stats, vendas mensais, contagem de closers e meta mensal. Isso elimina 3-4 requests paralelos e os substitui por 1 `Promise.all` unificado.

**Impacto**: Dashboard passa de ~6-7 requests para ~3-4.

---

## Fase 6: Prefetch Inteligente de Rotas

**Problema**: Ao navegar do Dashboard para Calls, Clients ou Portfolio, o usuario ve "Carregando..." enquanto os dados sao buscados do zero.

**Solucao**: Implementar prefetch no `Sidebar.tsx` com `onMouseEnter` nos links de navegacao. Ao passar o mouse sobre "Calls", ja dispara `queryClient.prefetchQuery` com os dados daquela pagina. Quando o usuario clica, os dados ja estao no cache.

**Impacto**: Navegacao percebida como instantanea (0ms de loading visivel).

---

## Fase 7: Virtualizacao de Listas Longas

**Problema**: A pagina de Calls renderiza TODOS os cards de uma vez (`filteredCalls.map`). Com 50-100+ calls, isso gera centenas de componentes DOM simultaneamente, causando lag no scroll e no carregamento inicial.

**Solucao**: Implementar virtualizacao com CSS `content-visibility: auto` nos cards. Isso e nativo do browser, sem dependencias extras. Os cards fora da viewport nao sao renderizados pelo browser ate serem necessarios.

**Impacto**: Renderizacao inicial reduzida em 60-80% para listas grandes.

---

## Fase 8: Memoizacao Agressiva de Componentes

**Problema**: Cada mudanca de estado (filtro, busca) re-renderiza TODOS os cards na pagina de Calls, Clients e Portfolio, mesmo os que nao mudaram.

**Solucao**: Envolver `CallCard`, `ClientCard` e `StudentCard` com `React.memo` e comparacao customizada. Memoizar tambem funcoes de callback com `useCallback` para evitar re-renders cascata.

**Impacto**: Re-renders reduzidos em 70-90% durante interacoes de filtro/busca.

---

## Fase 9: Otimizacao do Portfolio (4 queries para 1)

**Problema**: A pagina Portfolio dispara 4 queries separadas: `usePortfolioStudents`, `useStudentActivities`, `useStudentIndications`, e `useClientsMetrics` (que por sua vez dispara mais 3: `useAllClients`, `useAllClientActivities`, `useAllIndications`). Total: ~7 queries.

**Solucao**: Consolidar em 2 queries: uma para `portfolio_students` + `student_activities` + `indications` (via Promise.all) e outra para metricas de clientes. Adicionar `staleTime` adequado a todas.

**Impacto**: Portfolio passa de ~7 requests para ~2.

---

## Fase 10: Paginacao no Calls

**Problema**: A query de Calls busca TODAS as calls do closer sem limite. Com meses de uso, isso pode ser centenas de registros transferidos de uma vez.

**Solucao**: Implementar paginacao com limite de 50 calls por pagina + botao "Carregar mais". Manter o filtro de data como alternativa para buscar periodos especificos.

**Impacto**: Reducao de 50-90% no payload inicial da pagina de Calls.

---

## Fase 11: Otimizacao do Kanban (CRM)

**Problema**: A query de Clients busca todos os clientes e depois faz uma segunda query para `calls` para obter `lastCallDate`. Alem disso, o Kanban renderiza 10 colunas com todos os cards simultaneamente.

**Solucao**: 
1. Usar uma database view ou RPC que retorne `lastCallDate` junto com o cliente em uma unica query.
2. Aplicar `content-visibility: auto` nas colunas do Kanban para virtualizar colunas fora da tela.

**Impacto**: CRM passa de 2 queries para 1 + scroll mais suave.

---

## Fase 12: Cache Warming no Login

**Problema**: Apos o login, o usuario chega ao Dashboard e todas as queries disparam do zero.

**Solucao**: No `AuthContext`, apos autenticacao bem-sucedida, iniciar prefetch dos dados criticos (profile, user_role, daily_verse, dashboard stats) antes mesmo da navegacao. Quando o Dashboard renderizar, os dados ja estarao prontos.

**Impacto**: First Meaningful Paint do Dashboard reduzido em 40-60%.

---

## Resumo de Impacto

```text
+---------------------------+--------+---------+
| Area                      | Antes  | Depois  |
+---------------------------+--------+---------+
| Dashboard requests        | 6-7    | 3-4     |
| Portfolio requests        | 7      | 2       |
| CRM requests              | 2      | 1       |
| Navegacao entre paginas   | 1-3s   | ~0ms    |
| Calls com 100+ registros  | Lento  | Paginado|
| Re-renders em filtros     | 100%   | 10-30%  |
| Login -> Dashboard pronto | 3-5s   | 1-2s    |
+---------------------------+--------+---------+
```

## Detalhes Tecnicos

### Prioridade de Implementacao

1. **Fase 5** - Consolidacao Dashboard (maior ROI, menos risco)
2. **Fase 8** - React.memo nos cards (rapido de implementar)
3. **Fase 6** - Prefetch no Sidebar (impacto perceptivo alto)
4. **Fase 12** - Cache warming no login
5. **Fase 7** - content-visibility nos cards
6. **Fase 9** - Consolidacao Portfolio
7. **Fase 11** - Otimizacao Kanban
8. **Fase 10** - Paginacao Calls (ultimo pois depende de volume de dados)

### Arquivos Modificados

- `src/hooks/useDashboardData.ts` (novo - hook consolidado)
- `src/pages/Dashboard.tsx` (usar novo hook)
- `src/components/dashboard/QuotaProgressBar.tsx` (consumir dados consolidados)
- `src/components/dashboard/MonthlyGoalBar.tsx` (consumir dados consolidados)
- `src/components/layout/Sidebar.tsx` (prefetch com onMouseEnter)
- `src/components/calls/CallCard.tsx` (React.memo)
- `src/components/clients/ClientCard.tsx` (React.memo + content-visibility)
- `src/components/portfolio/StudentCard.tsx` (React.memo)
- `src/hooks/usePortfolio.ts` (consolidar queries)
- `src/pages/Calls.tsx` (paginacao + content-visibility)
- `src/pages/Clients.tsx` (consolidar query com lastCallDate)
- `src/contexts/AuthContext.tsx` (cache warming pos-login)
