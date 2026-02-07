
# Corrigir Meta Mensal para Admin

## Problema

O `useEffect` no `MonthlyGoalBar` tem `[user]` como dependencia, mas usa `isAdmin` dentro do `fetchGoal`. Quando o componente monta, `isAdmin` pode ainda ser `false` (carregando), entao a query roda com `.eq('closer_id', user.id)` -- o admin nao tem meta propria, retorna vazio, e mostra "Meta nao definida pelo lider".

Como `isAdmin` nao esta na lista de dependencias, o `useEffect` nunca re-executa quando `isAdmin` muda para `true`.

## Solucao

**Arquivo**: `src/components/dashboard/MonthlyGoalBar.tsx`

1. Adicionar `isAdmin` como dependencia do `useEffect` (linha 23):
   - De: `[user]`
   - Para: `[user, isAdmin]`

2. Resetar `goalValue` para `null` antes de cada fetch para evitar mostrar dados stale durante a troca de estado.

Isso garante que quando `isAdmin` resolver para `true`, o fetch re-executa e busca a soma de todas as metas (R$1.200.000 no caso atual).

## Resultado

O admin vera a barra de progresso com a meta total (soma de todos os closers) em vez de "Meta nao definida pelo lider".
