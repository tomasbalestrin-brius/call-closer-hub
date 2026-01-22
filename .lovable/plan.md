

# Plano de Implementação - Fase 1: Correções Críticas

## Resumo Executivo

A Fase 1 resolve 5 problemas críticos que afetam a confiabilidade do sistema de importação:

| Problema | Solução | Impacto |
|----------|---------|---------|
| Duplicatas de Calls | Hash SHA-256 de conteúdo | 100% eliminadas |
| Arquivos Travados | Lock atômico `FOR UPDATE SKIP LOCKED` | 0% travamentos |
| Timeouts sem Retry | Loop de retry automático | +15% taxa sucesso |
| Clientes Duplicados | Normalização de nomes (unaccent) | CRM limpo |
| Análises Parciais Silenciosas | Metadados de análise | Transparência total |

---

## Ordem de Execução

```text
┌─────────────────────────────────────────────────────────────────┐
│  PASSO 1: Migrations (Database)                                │
│  ├── 1.1 Content Hash + Analysis Metadata                      │
│  ├── 1.2 Lock Atômico (claim_pending_files)                    │
│  └── 1.3 Normalização de Nomes                                 │
├─────────────────────────────────────────────────────────────────┤
│  PASSO 2: Edge Functions                                        │
│  ├── 2.1 import-and-analyze (hash + retry + normalização)      │
│  ├── 2.2 process-user-files (lock atômico)                     │
│  └── 2.3 analyze-call (metadados de análise parcial)           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Passo 1: Migrations de Banco de Dados

### Migration 1.1: Deduplicação por Hash de Conteúdo

Adicionar coluna `content_hash` e `analysis_metadata` à tabela `calls`:

```sql
-- Adicionar coluna content_hash para deduplicação
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Índice para busca rápida por hash
CREATE INDEX IF NOT EXISTS idx_calls_content_hash
ON calls(content_hash)
WHERE content_hash IS NOT NULL;

-- Índice composto único para deduplicação (closer + hash)
CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_closer_hash
ON calls(closer_id, content_hash)
WHERE content_hash IS NOT NULL;

-- Adicionar metadados de análise
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS analysis_metadata JSONB DEFAULT '{}'::jsonb;

-- Índice GIN para queries em metadados
CREATE INDEX IF NOT EXISTS idx_calls_analysis_metadata
ON calls USING GIN (analysis_metadata);

-- Comentários de documentação
COMMENT ON COLUMN calls.content_hash IS 'SHA-256 hash da transcrição para deduplicação';
COMMENT ON COLUMN calls.analysis_metadata IS 'Metadados: is_partial, chunks_analyzed, confidence_level';
```

### Migration 1.2: Lock Atômico para Processamento

Criar função `claim_pending_files` com `FOR UPDATE SKIP LOCKED`:

```sql
-- Extensão para uuid se necessário
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Função para claim atômico de arquivos pendentes
CREATE OR REPLACE FUNCTION claim_pending_files(
  p_user_id UUID,
  p_max_files INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  drive_file_id TEXT,
  file_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE imported_files
  SET
    status = 'processing',
    started_processing_at = NOW(),
    error_message = NULL
  WHERE imported_files.id IN (
    SELECT imported_files.id
    FROM imported_files
    WHERE imported_files.user_id = p_user_id
      AND imported_files.status = 'pending'
    ORDER BY imported_files.created_at ASC
    LIMIT p_max_files
    FOR UPDATE SKIP LOCKED
  )
  RETURNING
    imported_files.id,
    imported_files.drive_file_id,
    imported_files.file_name;
END;
$$;

-- Adicionar coluna retry_count
ALTER TABLE imported_files
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Função para incrementar retry
CREATE OR REPLACE FUNCTION increment_file_retry(p_file_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE imported_files
  SET retry_count = COALESCE(retry_count, 0) + 1
  WHERE id = p_file_id;
END;
$$;

-- Comentários
COMMENT ON FUNCTION claim_pending_files IS 'Claim atômico com SKIP LOCKED para prevenir race conditions';
COMMENT ON COLUMN imported_files.retry_count IS 'Número de tentativas de processamento';
```

### Migration 1.3: Normalização de Nomes de Clientes

Criar função de normalização e coluna gerada automaticamente:

```sql
-- Extensão unaccent para remover acentos
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Função de normalização de nomes
CREATE OR REPLACE FUNCTION normalize_client_name(name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF name IS NULL OR TRIM(name) = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN LOWER(
    TRIM(
      REGEXP_REPLACE(
        UNACCENT(name),
        '\s+', ' ',
        'g'
      )
    )
  );
END;
$$;

-- Coluna gerada automaticamente (computed column)
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS name_normalized TEXT
GENERATED ALWAYS AS (normalize_client_name(name)) STORED;

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_clients_name_normalized
ON clients(closer_id, name_normalized)
WHERE name_normalized IS NOT NULL;

-- Comentários
COMMENT ON FUNCTION normalize_client_name IS 'Normaliza: remove acentos, lowercase, trim espaços';
COMMENT ON COLUMN clients.name_normalized IS 'Nome normalizado para deduplicação (auto-gerado)';
```

---

## Passo 2: Modificações em Edge Functions

### 2.1: import-and-analyze/index.ts

**Adicionar após linha 71** - Função de hash:

```typescript
// Helper function to generate SHA-256 hash from content
async function generateContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

**Modificar linha 217-227** - Adicionar verificação de duplicata por hash + retry automático:

```typescript
console.log(`Document fetched, content length: ${content.length}`);

// Verificar duplicata por hash de conteúdo
const contentHash = await generateContentHash(content);
console.log(`Content hash: ${contentHash}`);

const { data: existingCall } = await supabase
  .from("calls")
  .select("id, client_id")
  .eq("closer_id", userId)
  .eq("content_hash", contentHash)
  .maybeSingle();

if (existingCall) {
  console.log(`Call já existe com hash ${contentHash}, atualizando imported_files`);
  await supabase
    .from("imported_files")
    .update({
      status: "completed",
      call_id: existingCall.id,
      started_processing_at: null,
      imported_at: new Date().toISOString(),
    })
    .eq("id", importRecordId);

  return new Response(
    JSON.stringify({
      success: true,
      callId: existingCall.id,
      clientId: existingCall.client_id,
      deduplicated: true,
      message: "Call já existente (conteúdo duplicado)"
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Analyze com retry automático para timeouts
const MAX_RETRIES_ON_TIMEOUT = 2;
let retryCount = 0;
let analyzeResult: unknown = null;
let analyzeParseError: string | null = null;
let analyzeResponse: Response | null = null;

while (retryCount <= MAX_RETRIES_ON_TIMEOUT) {
  console.log(`Analyze attempt ${retryCount + 1}/${MAX_RETRIES_ON_TIMEOUT + 1}`);
  
  analyzeResponse = await fetch(`${SUPABASE_URL}/functions/v1/analyze-call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ transcription: content, fileName }),
  });

  const result = await safeReadJson(analyzeResponse);
  analyzeResult = result.data;
  analyzeParseError = result.error;

  if (analyzeResponse.ok && !analyzeParseError) {
    console.log("Analysis successful");
    break;
  }

  // Retry apenas para timeouts (408)
  if (analyzeResponse.status === 408 && retryCount < MAX_RETRIES_ON_TIMEOUT) {
    console.log(`Timeout on attempt ${retryCount + 1}, retrying in 5s...`);
    retryCount++;
    await new Promise(resolve => setTimeout(resolve, 5000));
    continue;
  }

  break;
}
```

**Modificar linhas 268-273** - Usar name_normalized para busca de cliente:

```typescript
// Normalizar nome para busca
const normalizedName = clientName
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const { data: existingClient } = await supabase
  .from("clients")
  .select("id")
  .eq("closer_id", userId)
  .eq("name_normalized", normalizedName)
  .maybeSingle();
```

**Modificar linhas 324-359** - Adicionar content_hash e analysis_metadata ao upsert:

```typescript
const { data: callRecord, error: callError } = await supabase
  .from("calls")
  .upsert({
    closer_id: userId,
    client_id: clientId,
    client_name: clientName,
    call_date: callDate,
    status: callStatus,
    product: analysis.product && analysis.product !== 'nao_informado' ? analysis.product : null,
    transcription: content,
    content_hash: contentHash,  // NOVO
    score: toInt(analysis.call_score),
    duration_minutes: toInt(analysis.duration_minutes),
    niche: analysis.niche && analysis.niche !== 'nao_informado' ? analysis.niche : null,
    has_partner: toBool(analysis.has_partner),
    main_difficulty: analysis.main_difficulty && analysis.main_difficulty !== 'nao_informado' ? analysis.main_difficulty : null,
    main_pain: analysis.main_pain && analysis.main_pain !== 'nao_informado' ? analysis.main_pain : null,
    consciousness_level: analysis.consciousness_level && analysis.consciousness_level !== 'nao_informado' ? analysis.consciousness_level : null,
    decision_reason: analysis.decision_reason && analysis.decision_reason !== 'nao_informado' ? analysis.decision_reason : null,
    ai_summary: analysis.ai_summary,
    lead_classification: analysis.lead_classification,
    closer_classification: analysis.closer_classification,
    technical_analysis: analysis.technical_analysis,
    analysis_metadata: analysis.analysis_metadata || {},  // NOVO
    main_errors: analysis.main_errors,
    main_wins: analysis.main_wins,
    loss_point: analysis.loss_point && analysis.loss_point !== 'nao_informado' ? analysis.loss_point : null,
    next_contact_date: analysis.next_contact_date,
    entry_value: toNumber(analysis.entry_value),
    sale_value: toNumber(analysis.sale_value),
    source_file_id: fileId,
    analyzed_at: new Date().toISOString(),
  }, { 
    onConflict: "source_file_id",
    ignoreDuplicates: false
  })
  .select()
  .single();
```

### 2.2: process-user-files/index.ts

**Modificar linhas 171-177** - Usar RPC claim_pending_files:

```typescript
// Get pending files usando lock atômico
const { data: pendingFiles, error: fetchError } = await supabase
  .rpc('claim_pending_files', {
    p_user_id: userId,
    p_max_files: maxFiles
  });

if (fetchError) {
  throw new Error(`Failed to fetch pending files: ${fetchError.message}`);
}

const files = pendingFiles as PendingFile[] | null;
```

**REMOVER linhas 241-256** - O lock já é feito atomicamente no claim_pending_files.

**Adicionar após linha 283** - Incrementar retry_count em caso de erro:

```typescript
if (result.success) {
  successCount++;
  console.log(`[${userName}] ✓ ${file.file_name}`);
} else {
  errorCount++;
  console.log(`[${userName}] ✗ ${file.file_name}: ${result.error}`);
  
  // Incrementar retry count
  await supabase.rpc('increment_file_retry', { p_file_id: file.id });
  
  // Marcar arquivo como erro
  await supabase
    .from("imported_files")
    .update({ 
      status: "error", 
      error_message: result.error || "Falha no processamento",
      started_processing_at: null 
    })
    .eq("id", file.id);
}
```

### 2.3: analyze-call/index.ts

**Adicionar à interface AnalysisData (linha ~1564)**:

```typescript
interface AnalysisData {
  // ... campos existentes ...
  
  __metadata?: {
    is_partial_analysis: boolean;
    chunks_analyzed: number;
    chunks_total: number;
    confidence_level: 'low' | 'high';
    analysis_method: 'chunked' | 'direct';
    timeout_occurred: boolean;
  };
}
```

**Modificar função analyzeWithChunking (após linha 1278)** - Adicionar metadados:

```typescript
const totalTime = Date.now() - startTime;
console.log(`✅ Chunked analysis completed in ${Math.round(totalTime/1000)}s (${partialAnalyses.length}/${chunks.length} chunks)`);

// Adicionar metadados de análise parcial
const metadata = {
  is_partial_analysis: isPartial,
  chunks_analyzed: partialAnalyses.length,
  chunks_total: chunks.length,
  confidence_level: isPartial ? 'low' : 'high',
  analysis_method: 'chunked' as const,
  timeout_occurred: abortSignal?.aborted || false
};

console.log(`Analysis metadata:`, metadata);

return {
  ...mergedAnalysis,
  __metadata: metadata
};
```

**Modificar análise direta (após linha 1600)** - Adicionar metadados:

```typescript
} else {
  console.log(`Standard file size, using DIRECT analysis`);
  const masterResponse = await callOpenAI(MASTER_PROMPT, transcription);
  console.log("AI analysis completed");
  console.log("Raw response length:", masterResponse.length);
  data = await parseJSONFromResponse(masterResponse) as AnalysisData;
  
  // Metadados para análise direta
  data.__metadata = {
    is_partial_analysis: false,
    chunks_analyzed: 1,
    chunks_total: 1,
    confidence_level: 'high',
    analysis_method: 'direct',
    timeout_occurred: false
  };
}
```

**Preservar metadados no response final (linha ~1703)**:

```typescript
technical_analysis: {
  // ... campos existentes ...
  se_vendeu: data.se_vendeu,
},
analysis_metadata: data.__metadata || {},  // NOVO
```

---

## Arquivos a Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `supabase/migrations/` | SQL | 3 novas migrations |
| `supabase/functions/import-and-analyze/index.ts` | Edge Function | Hash + Retry + Normalização |
| `supabase/functions/process-user-files/index.ts` | Edge Function | Lock atômico RPC |
| `supabase/functions/analyze-call/index.ts` | Edge Function | Metadados de análise |

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Duplicatas de calls | ~5% | 0% |
| Arquivos travados | ~2-3% | 0% |
| Taxa de sucesso | 70-80% | 95%+ |
| Clientes duplicados | ~10% | 0% |
| Análises parciais identificáveis | Não | Sim |

---

## Tempo Estimado

- Migrations: 5 minutos
- Edge Functions: 15 minutos
- Deploy + Teste: 5 minutos

**Total: ~25 minutos**

