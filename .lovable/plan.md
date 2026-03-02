

# Reanálise da call Nathalia Gadelha como "Impl. IA"

## Problema

A call `40584ecf` (Hannah, 110K chars) foi analisada como "Mentoria Julia Ottoni". O usuário quer forçar a reanálise como "Implementação de IA (NextTrack)".

O sistema atual não tem um parâmetro para forçar um framework específico — a IA decide com base na transcrição + regras de prioridade do closer. Para transcrições grandes (>30K), o `reanalyze-call` delega para `analyze-call`, que também não aceita framework forçado.

## Plano

### Adicionar parâmetro `forceFramework` em `reanalyze-call/index.ts`

1. Aceitar campo opcional `forceFramework` no body da requisição
2. Quando presente, adicionar instrução explícita ao prompt: _"OBRIGATÓRIO: Classifique esta call como [framework]. Analise todas as etapas sob a perspectiva deste framework."_
3. Essa instrução é adicionada **após** as `frameworkPriorityInstructions`, sobrescrevendo qualquer prioridade
4. Para transcrições grandes (delegadas ao `analyze-call`), passar o `forceFramework` no body do fetch interno — precisará também adicionar suporte em `analyze-call/index.ts`

### Adicionar suporte em `analyze-call/index.ts`

1. Aceitar campo opcional `forceFramework` no body
2. Quando presente, injetar a mesma instrução obrigatória no prompt de análise de cada chunk

### Após deploy

Chamar `reanalyze-call` com `{ callId: "40584ecf-...", forceFramework: "Implementação de IA (NextTrack)" }` para processar a call.

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/reanalyze-call/index.ts` | Aceitar `forceFramework`, injetar no prompt e passar para `analyze-call` |
| `supabase/functions/analyze-call/index.ts` | Aceitar `forceFramework`, injetar no prompt dos chunks |

