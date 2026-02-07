

# Otimizar Performance da Pagina Squad View

## Problemas Identificados

### 1. CRITICO: Busca de transcricoes completas desnecessariamente
A query `select=*` na tabela `calls` traz o campo `transcription` (100.000+ caracteres por call) apenas para listar cards. Isso e o principal causador da lentidao - transferir megabytes de texto que nao sao exibidos na lista.

### 2. Queries sequenciais no carregamento
`fetchSquadMembers` faz 3 queries sequenciais (squads -> members -> profiles + roles). `fetchCloserData` faz mais 3 queries sequenciais (calls -> monthly_goals -> repitch clients). Total: 6 queries em cascata.

### 3. Sem cache (React Query nao utilizado)
A pagina usa `useState` + `useEffect` manual em vez de React Query, que ja esta instalado e configurado no projeto. Isso significa zero cache, zero deduplicacao, e re-fetch completo a cada interacao.

### 4. Bug adicional: INSERT em `clients` retornando 403
Os logs de rede mostram erro RLS na insercao de clientes (`new row violates row-level security policy for table "clients"`). Isso indica que admins tambem nao podem criar clientes em nome de closers - mesmo problema corrigido para `profiles`.

---

## Solucao

### Parte 1 - Selecionar apenas colunas necessarias na query de calls

No `fetchCloserData`, trocar:
```
.select('*')
```
por:
```
.select('id, closer_id, client_id, client_name, call_date, call_time, duration_minutes, status, score, product, sale_value, entry_value, main_errors, main_wins, loss_point, niche, main_pain, main_difficulty, ai_summary, call_conclusion, technical_analysis, merged_with_call_id, created_at, updated_at, analyzed_at')
```

Isso exclui o campo `transcription` da listagem, reduzindo o payload de megabytes para kilobytes.

### Parte 2 - Paralelizar queries em fetchCloserData

Trocar as 3 queries sequenciais por `Promise.all`:
```typescript
const [callsResult, goalResult, repitchResult] = await Promise.all([
  supabase.from('calls').select('...colunas...').eq('closer_id', closerId)...,
  supabase.from('monthly_goals').select('goal_value').eq('closer_id', closerId)...,
  supabase.from('clients').select('id').eq('closer_id', closerId).eq('status', 'repitch')
]);
```

### Parte 3 - Paralelizar queries em fetchSquadMembers

Apos obter os `userIds`, buscar `profiles` e `roles` em paralelo:
```typescript
const [profilesResult, rolesResult] = await Promise.all([
  supabase.from('profiles').select('user_id, full_name').in('user_id', userIds),
  supabase.from('user_roles').select('user_id, role').in('user_id', userIds)
]);
```

### Parte 4 - Corrigir RLS para INSERT de clientes por admin

Adicionar migration para permitir que admins criem clientes:
```sql
CREATE POLICY "Admins can insert clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));
```

---

## Impacto esperado

- **Payload de calls**: Reducao de ~95% (de MBs para KBs ao excluir transcricoes)
- **Tempo de carregamento**: Reducao de ~50% com paralelizacao de queries
- **Bug de criacao**: Admins poderao criar clientes em nome de closers

## Arquivos modificados

- `src/pages/SquadView.tsx` (otimizar queries)
- Nova migration SQL (RLS para INSERT em clients)
