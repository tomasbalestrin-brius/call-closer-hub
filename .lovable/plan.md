
# Correção: Dois bugs impedindo salvar a análise manual

## Problemas identificados nos logs

### Bug 1 — Timeout (erro atual, 18:01:21)
```
analyze-call error: 408 {"error":"Analysis timeout on direct mode"}
```
A transcrição de "Emerson - Elite Premium" tem 25.229 caracteres. A análise leva ~113s, mas o timeout da `analyze-call` é de 110s. A OpenAI responde com sucesso ("✅ OpenAI response received"), mas já após o timeout ter disparado. A `manual-analyze` recebe 408 e falha.

### Bug 2 — Status enum inválido (erro 17:59:00 e 17:54:20)
```
invalid input value for enum call_status: "follow"
```
A IA retorna `"follow"` mas o enum no banco só aceita: `pos_venda`, `follow_up`, `perdido`, `agendamento`, `sem_perfil`, etc. A `manual-analyze` mapeava `sold = "nao"` para `"follow"` sem verificar o enum real.

## O que será corrigido

### 1. Corrigir mapeamento de status em `manual-analyze/index.ts`

**Antes (bugado):**
```typescript
let callStatus = "follow";
if (analysis.sold === "sim") callStatus = "pos_venda";
else if (analysis.sold === "nao") callStatus = "follow";
else callStatus = "follow";
```

**Depois (corrigido):**
```typescript
let callStatus = "follow_up";
if (analysis.sold === "sim") callStatus = "pos_venda";
else callStatus = "follow_up";
```
E também validar o `lead_classification` com os valores corretos do enum.

### 2. Aumentar timeout de análise direta em `analyze-call/index.ts`

Aumentar `ANALYSIS_TIMEOUT` de 110s para 130s e `FUNCTION_TIMEOUT` de 120s para 145s, dando margem para transcrições longas como a do "Emerson" que levou 113s.

Também aumentar `MAX_SIZE_FOR_DIRECT` de 60.000 para 30.000 caracteres — forçando transcrições longas (>30k chars) a usar o modo chunked (mais robusto) em vez de tentar análise direta que pode sofrer timeout.

### 3. Tratar 408 em `manual-analyze` com mensagem clara

Em vez de retornar erro genérico no 408, informar ao usuário para tentar novamente com transcrição menor, ou tentar automaticamente de novo via modo chunked.

## Arquivos a editar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/manual-analyze/index.ts` | Corrigir status "follow" → "follow_up", melhorar tratamento do 408 |
| `supabase/functions/analyze-call/index.ts` | Reduzir MAX_SIZE_FOR_DIRECT para forçar chunked em transcrições longas |

## Impacto esperado

- Transcrições curtas/médias: análise direta continua funcionando normalmente
- Transcrições longas (>30k chars como a do Emerson): usa modo chunked automaticamente, sem risco de timeout
- Status "follow_up" correto no banco para todas as calls não-vendidas
