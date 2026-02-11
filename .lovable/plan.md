

# Paginacao, Select Especifico e PlaceholderData

## Resumo

Aplicar o padrao de paginacao "Carregar mais" (ja usado em Calls) no Portfolio e CRM Clients, trocar `select('*')` por campos especificos no CRM Intensivo, e adicionar `placeholderData: (prev) => prev` em todas as queries principais para eliminar flash de loading ao re-fetchar.

---

## 1. Paginacao no Portfolio

**Arquivo:** `src/hooks/usePortfolio.ts` - `usePortfolioStudents()`
- Adicionar parametro `limit` na query key e na chamada `.limit(limit)`
- Retornar tambem o `limit` para o componente pai saber quando mostrar "Carregar mais"
- Adicionar `placeholderData: (prev) => prev`

**Arquivo:** `src/pages/Portfolio.tsx`
- Adicionar state `const [limit, setLimit] = useState(50)`
- Passar `limit` para `usePortfolioStudents(limit)`
- Apos a `StudentList`, renderizar botao "Carregar mais" quando `students.length >= limit`
- Botao incrementa limit em 50: `setLimit(prev => prev + 50)`

**Arquivo:** `src/components/portfolio/StudentList.tsx`
- Nenhuma alteracao necessaria (ja recebe array filtrado)

---

## 2. Paginacao no CRM Clients

**Arquivo:** `src/pages/Clients.tsx`
- Adicionar state `const [limit, setLimit] = useState(50)`
- Adicionar `limit` na query key: `['clients', targetCloserId, limit]`
- Adicionar `.limit(limit)` na query de clients
- Adicionar `placeholderData: (prev) => prev` na query
- Apos o `ClientKanban`, renderizar botao "Carregar mais" quando `clients.length >= limit`
- Substituir "Carregando..." por skeleton (mesmo padrao do Calls)

---

## 3. Select especifico no CRM Intensivo

**Arquivo:** `src/hooks/useIntensivoCRM.ts`
- Na query de leads (linha 37), substituir `.select('*')` por select com campos especificos:
  ```
  id, edition_id, closer_id, name, phone, email, company, niche, status, status_changed_at, source, source_client_id, source_student_id, indication_id, confirmed_at, ticket_retrieved_at, attended_at, lead_temperature, notes, created_at, updated_at
  ```
- Na query de editions (linha 17), substituir `.select('*')` por:
  ```
  id, name, event_date, location, description, is_active, created_by, created_at, updated_at
  ```
- Adicionar `placeholderData: (prev) => prev` em ambas as queries

---

## 4. PlaceholderData nas queries restantes

Adicionar `placeholderData: (prev) => prev` nas seguintes queries que ainda nao possuem:

| Arquivo | Hook/Query |
|---------|-----------|
| `src/hooks/usePortfolio.ts` | `usePortfolioStudents` |
| `src/hooks/usePortfolio.ts` | `useTicketUpgrades` |
| `src/hooks/usePortfolio.ts` | `useStudentActivities` |
| `src/hooks/usePortfolio.ts` | `useStudentIndications` |
| `src/hooks/usePortfolio.ts` | `useAllPortfolioData` |
| `src/hooks/useDashboardData.ts` | `useDashboardData` |
| `src/hooks/useIntensivoCRM.ts` | editions query |
| `src/hooks/useIntensivoCRM.ts` | leads query |
| `src/pages/Clients.tsx` | clients query |

O Calls (`src/pages/Calls.tsx` linha 83) ja possui `placeholderData: (prev) => prev`.

---

## Detalhes tecnicos

### Padrao de paginacao (identico ao Calls)

```text
// State
const [limit, setLimit] = useState(50);

// Na query
.limit(limit)

// No JSX, apos a lista
{data.length >= limit && (
  <div className="flex justify-center pt-4">
    <Button variant="outline" onClick={() => setLimit(prev => prev + 50)}>
      Carregar mais
    </Button>
  </div>
)}
```

### PlaceholderData

Adicionar em cada `useQuery`:
```typescript
placeholderData: (prev) => prev,
```

Isso mantem os dados anteriores visiveis enquanto o refetch ocorre, eliminando o flash de loading/skeleton quando os dados ja foram carregados uma vez.

### Select especifico do Intensivo

Todos os 21 campos da interface `IntensiveLead` serao listados explicitamente, e os 9 campos de `IntensiveEdition`. Isso evita trazer colunas futuras desnecessarias e reduz payload.

---

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/usePortfolio.ts` | placeholderData em 4 queries, limit param em usePortfolioStudents |
| `src/hooks/useDashboardData.ts` | placeholderData |
| `src/hooks/useIntensivoCRM.ts` | select especifico + placeholderData em 2 queries |
| `src/pages/Portfolio.tsx` | State limit + botao "Carregar mais" |
| `src/pages/Clients.tsx` | State limit + .limit() + placeholderData + botao "Carregar mais" + skeleton |

