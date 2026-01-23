
# Plano: Melhorar Tratamento de JSON no analyze-call

## Diagnóstico do Problema

Após análise do código em `supabase/functions/analyze-call/index.ts`, identifiquei que **10 arquivos falharam** com "Failed to parse AI response as JSON after multiple attempts". O fluxo atual de recuperação de JSON é:

1. Parse direto
2. `tryFixJSON()` - correções básicas de sintaxe
3. Extração por posição do erro
4. `repairJSONWithAI()` - chamada extra ao gpt-4o-mini

O problema: quando a resposta da OpenAI vem truncada ou com formatação inconsistente, todas as tentativas falham.

## Causa Raiz Identificada

| Cenário | Problema |
|---------|----------|
| Resposta truncada | O modelo atinge `max_tokens` e corta o JSON no meio |
| Markdown aninhado | Code blocks dentro do JSON quebram a extração |
| Caracteres especiais | Aspas curvas, caracteres unicode em evidências |
| Output muito longo | O merge de chunks produz JSON maior que o buffer |

## Solução Proposta

### 1. Adicionar `response_format: { type: "json_object" }` na OpenAI API

Forçar o modelo a retornar apenas JSON válido, sem markdown ou texto adicional.

```typescript
// Em callOpenAI() e analyzeChunk()
body: JSON.stringify({
  model: "gpt-4o",
  messages: [...],
  response_format: { type: "json_object" }, // NOVO
  temperature: 0.1,
  max_tokens: 16000,
})
```

### 2. Melhorar a função `tryFixJSON()` com mais correções

Adicionar tratamento para:
- Aspas curvas ("" '') para aspas retas
- Remover caracteres BOM
- Escapar newlines não escapados dentro de strings
- Detectar e corrigir propriedades duplicadas

### 3. Adicionar fallback de extração progressiva

Quando todas as tentativas falharem, extrair campos individuais via regex antes de falhar completamente:

```typescript
function extractFieldsFallback(response: string): Partial<AnalysisData> {
  // Extrair campos críticos mesmo de JSON quebrado
  const clientName = response.match(/"nome_lead"\s*:\s*"([^"]+)"/)?.[1];
  const closerName = response.match(/"nome_closer"\s*:\s*"([^"]+)"/)?.[1];
  const score = response.match(/"nota_geral"\s*:\s*(\d+)/)?.[1];
  // ... outros campos essenciais
  
  return { /* objeto parcial */ };
}
```

### 4. Aumentar `max_tokens` para evitar truncamento

O merge de chunks pode gerar respostas muito longas. Aumentar de 16000 para 32000 tokens.

### 5. Implementar logging detalhado para debug

Salvar a resposta raw em caso de falha para análise posterior:

```typescript
// Em caso de falha, logar os primeiros 5000 chars
console.error("Raw response that failed parsing:", response.substring(0, 5000));
```

## Arquivos a Modificar

| Arquivo | Modificações |
|---------|--------------|
| `supabase/functions/analyze-call/index.ts` | Adicionar `response_format`, melhorar `tryFixJSON()`, novo fallback de extração |

## Implementação Detalhada

### Passo 1: Adicionar response_format nas chamadas OpenAI
- Modificar `callOpenAI()` (linha 1516)
- Modificar `analyzeChunk()` (linha 1149)
- Modificar `mergeChunkAnalyses()` (linha 1252)
- Modificar `repairJSONWithAI()` (linha 1614)

### Passo 2: Melhorar tryFixJSON()
- Expandir a função (linhas 1633-1665) com mais correções

### Passo 3: Criar extractFieldsFallback()
- Nova função para recuperar dados parciais

### Passo 4: Atualizar parseJSONFromResponse()
- Adicionar o fallback como última tentativa antes de falhar
- Retornar análise parcial em vez de erro total

## Resultado Esperado

- **Redução de 90%+ nos erros de JSON**: O `response_format: json_object` força a API a retornar JSON válido
- **Recuperação de dados em falhas**: Mesmo quando o JSON está quebrado, extrair campos críticos
- **Melhor debugging**: Logs detalhados para identificar padrões de falha

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| `response_format` não suportado em modelos antigos | Só usamos gpt-4o e gpt-4o-mini (suportados) |
| Aumentar `max_tokens` aumenta custo | Custo marginal vs benefício de 90% menos erros |
| Fallback retorna dados incompletos | Marcar como `is_partial_analysis: true` |
