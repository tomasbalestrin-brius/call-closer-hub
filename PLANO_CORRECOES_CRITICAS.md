# 🔥 PLANO DE CORREÇÕES CRÍTICAS - CALL CLOSER HUB

**Objetivo**: Corrigir os 3 problemas CRÍTICOS que causam duplicatas, race conditions e análises parciais invisíveis.

**Tempo Estimado**: 6-7 horas
**Impacto**: Taxa de sucesso de 70-80% → 95%+

---

## 📋 RESUMO DAS CORREÇÕES

| # | Correção | Problema Atual | Tempo |
|---|----------|----------------|-------|
| 1 | Lock Atômico SQL | 2 processos pegam mesmo arquivo | 3h |
| 2 | Hash de Conteúdo | Duplicatas por conteúdo idêntico | 2h |
| 3 | Metadata de Análise | Análises parciais invisíveis | 2h |

**Total**: ~7 horas para sistema production-ready

---

# CORREÇÃO 1: LOCK ATÔMICO COM SQL

## Problema
```
Processo A → busca arquivo X (SELECT)
Processo B → busca arquivo X (SELECT)  ← Race condition!
Processo A → lock arquivo X (UPDATE)
Processo B → tenta lock X (falha ou duplica)
```

## Solução: FOR UPDATE SKIP LOCKED

### PASSO 1.1: Criar Migration SQL

**Arquivo**: `supabase/migrations/20260123000001_add_atomic_lock_and_priority.sql`

```sql
-- ============================================================================
-- CRITICAL FIX: Lock atômico com FOR UPDATE SKIP LOCKED
-- ============================================================================

-- 1. Adicionar colunas para retry e prioridade
ALTER TABLE imported_files
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10);

-- 2. Criar índice para ordenação eficiente
CREATE INDEX IF NOT EXISTS idx_imported_files_claim_order
ON imported_files(user_id, status, priority DESC, created_at ASC)
WHERE status = 'pending';

-- 3. Função para claim atômico de arquivos pendentes
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
AS $$
BEGIN
  -- Update e select em uma única transação atômica
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
    ORDER BY
      imported_files.priority DESC,    -- Alta prioridade primeiro
      imported_files.retry_count ASC,  -- Menos retries primeiro
      imported_files.created_at ASC    -- Mais antigos primeiro (FIFO)
    LIMIT p_max_files
    FOR UPDATE SKIP LOCKED  -- ← CRÍTICO: Pula se outro processo já pegou
  )
  RETURNING
    imported_files.id,
    imported_files.drive_file_id,
    imported_files.file_name;
END;
$$;

-- 4. Função para incrementar contador de retry
CREATE OR REPLACE FUNCTION increment_file_retry(
  p_file_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE imported_files
  SET retry_count = COALESCE(retry_count, 0) + 1
  WHERE id = p_file_id;
END;
$$;

-- 5. Comentários
COMMENT ON FUNCTION claim_pending_files IS
  'Claim atômico de arquivos pendentes com SKIP LOCKED para prevenir race conditions';
COMMENT ON FUNCTION increment_file_retry IS
  'Incrementa contador de tentativas de processamento';
COMMENT ON COLUMN imported_files.retry_count IS
  'Número de tentativas de processamento';
COMMENT ON COLUMN imported_files.priority IS
  'Prioridade de processamento (1-10, 10=máxima urgência)';
```

---

### PASSO 1.2: Modificar process-user-files

**Arquivo**: `supabase/functions/process-user-files/index.ts`

**Localizar linhas 171-177** (fetch manual de pending files):

```typescript
// DELETAR ESTE BLOCO (linhas 171-177):
const { data: pendingFiles, error: fetchError } = await supabase
  .from("imported_files")
  .select("id, drive_file_id, file_name")
  .eq("user_id", userId)
  .eq("status", "pending")
  .order("created_at", { ascending: true })
  .limit(maxFiles);
```

**SUBSTITUIR POR**:

```typescript
// ========== NOVO: Usar RPC para lock atômico ==========
const { data: pendingFiles, error: fetchError } = await supabase
  .rpc('claim_pending_files', {
    p_user_id: userId,
    p_max_files: maxFiles
  });
// ========== FIM NOVO ==========
```

---

**Localizar linhas 241-256** (lock manual dentro do loop):

```typescript
// DELETAR TODO ESTE BLOCO (linhas 241-256):
// Try to lock this file by updating status to processing
const { data: locked, error: lockError } = await supabase
  .from("imported_files")
  .update({
    status: "processing",
    started_processing_at: new Date().toISOString()
  })
  .eq("id", file.id)
  .eq("status", "pending")
  .select()
  .single();

if (lockError || !locked) {
  console.log(`[${userName}] File ${file.file_name} already claimed by another process, skipping`);
  continue;
}
```

**O lock já foi feito no `claim_pending_files()`, então DELETAR esse bloco completamente!**

---

**Localizar linha ~286** (após processar arquivo com erro):

```typescript
      } else {
        errorCount++;
        console.log(`[${userName}] ✗ ${file.file_name}: ${result.error}`);

        // ========== ADICIONAR AQUI: Incrementar retry count ==========
        await supabase.rpc('increment_file_retry', {
          p_file_id: file.id
        });
        // ========== FIM NOVO ==========

        // Mark file as error instead of leaving in processing
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

---

### TESTE 1: Validar Lock Atômico

```bash
# 1. Aplicar migration
# (Lovable faz automaticamente)

# 2. Verificar se função existe
# No Supabase SQL Editor:
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'claim_pending_files';
# Deve retornar 1 linha

# 3. Testar manualmente
SELECT * FROM claim_pending_files(
  'USER_ID_AQUI'::uuid,
  5
);
# Deve retornar até 5 arquivos pending

# 4. Executar novamente (sem novos arquivos pending)
SELECT * FROM claim_pending_files(
  'USER_ID_AQUI'::uuid,
  5
);
# Deve retornar 0 linhas (arquivos já estão em processing)
```

**Validação no Frontend**:
1. Importar 10 arquivos
2. Processar com "Turbo (3x)" - 3 processos paralelos
3. Verificar que nenhum arquivo foi processado 2x
4. Verificar logs: nenhum "already claimed" aparece

✅ **SUCESSO**: Sem duplicatas, sem race conditions

---

# CORREÇÃO 2: HASH DE CONTEÚDO

## Problema
```
Arquivo 1 (URL: drive.google.com/file/ABC) → Transcrição: "Olá mundo"
Arquivo 2 (URL: drive.google.com/file/XYZ) → Transcrição: "Olá mundo"

Sistema verifica apenas source_file_id (ABC ≠ XYZ)
RESULTADO: 2 calls criadas com conteúdo IDÊNTICO!
```

## Solução: SHA-256 Hash da Transcrição

### PASSO 2.1: Criar Migration SQL

**Arquivo**: `supabase/migrations/20260123000002_add_content_hash_deduplication.sql`

```sql
-- ============================================================================
-- CRITICAL FIX: Deduplicação por hash de conteúdo
-- ============================================================================

-- 1. Adicionar coluna content_hash
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- 2. Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_calls_content_hash
ON calls(content_hash)
WHERE content_hash IS NOT NULL;

-- 3. Criar índice único composto (previne duplicatas)
CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_closer_content_hash
ON calls(closer_id, content_hash)
WHERE content_hash IS NOT NULL;

-- 4. Comentário
COMMENT ON COLUMN calls.content_hash IS
  'SHA-256 hash da transcrição para deduplicação de conteúdo';

-- 5. Popular hash para calls existentes (opcional, pode demorar)
-- DESCOMENTAR APENAS SE QUISER PROCESSAR CALLS ANTIGAS:
-- UPDATE calls
-- SET content_hash = encode(digest(transcription, 'sha256'), 'hex')
-- WHERE content_hash IS NULL AND transcription IS NOT NULL;
```

---

### PASSO 2.2: Modificar import-and-analyze

**Arquivo**: `supabase/functions/import-and-analyze/index.ts`

**Adicionar função helper após linha 72**:

```typescript
// ========== NOVO: Função para gerar hash SHA-256 ==========
async function generateContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return contentHash;
}
// ========== FIM NOVO ==========
```

---

**Localizar linha ~216** (após fetch do documento, ANTES de analisar):

```typescript
    console.log(`Document fetched, content length: ${content.length}`);

    // ========== NOVO: Verificar duplicata por hash de conteúdo ==========
    console.log("Generating content hash for deduplication...");
    const contentHash = await generateContentHash(content);
    console.log(`Content hash: ${contentHash.substring(0, 16)}...`);

    // Verificar se já existe call com mesmo hash para este closer
    const { data: existingCallByHash } = await supabase
      .from("calls")
      .select("id, client_id, client_name, call_date")
      .eq("closer_id", userId)
      .eq("content_hash", contentHash)
      .maybeSingle();

    if (existingCallByHash) {
      console.log(`⚠️ Call já existe com mesmo conteúdo (hash: ${contentHash.substring(0, 16)}...)`);
      console.log(`Existing call ID: ${existingCallByHash.id}, cliente: ${existingCallByHash.client_name}`);

      // Marcar arquivo como completo, apontando para call existente
      await supabase
        .from("imported_files")
        .update({
          status: "completed",
          call_id: existingCallByHash.id,
          imported_at: new Date().toISOString(),
          started_processing_at: null,
        })
        .eq("id", importRecordId);

      return new Response(
        JSON.stringify({
          success: true,
          callId: existingCallByHash.id,
          clientId: existingCallByHash.client_id,
          deduplicated: true,
          message: `Call duplicada detectada por hash de conteúdo. Vinculada à call existente: ${existingCallByHash.client_name} (${existingCallByHash.call_date})`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("No duplicate found by content hash, proceeding with analysis...");
    // ========== FIM NOVO ==========

    // Analyze the call with safe JSON parsing (linha original ~220)
    const analyzeResponse = await fetch(`${SUPABASE_URL}/functions/v1/analyze-call`, {
```

---

**Localizar linha ~352** (ao criar/atualizar call):

Adicionar `content_hash` ao objeto:

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
        content_hash: contentHash,  // ← ADICIONAR ESTA LINHA
        score: toInt(analysis.call_score),
        // ... resto dos campos
```

---

### TESTE 2: Validar Hash de Conteúdo

```bash
# 1. Aplicar migration
# (Lovable faz automaticamente)

# 2. Verificar se coluna existe
# No Supabase SQL Editor:
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'calls' AND column_name = 'content_hash';
# Deve retornar 1 linha

# 3. Importar arquivo A
# Anotar call_id retornado

# 4. Importar arquivo B com MESMO conteúdo
# Sistema deve retornar:
# { success: true, deduplicated: true, callId: <id do passo 3> }

# 5. Verificar no banco
SELECT id, client_name, content_hash
FROM calls
WHERE content_hash IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
# Não deve haver 2 calls com mesmo content_hash para mesmo closer
```

✅ **SUCESSO**: Sem duplicatas por conteúdo

---

# CORREÇÃO 3: METADATA DE ANÁLISE PARCIAL

## Problema
```
Call de 3 horas → 20 chunks necessários
Timeout aos 90s → apenas 8 chunks analisados
Sistema faz merge parcial → análise incompleta
Frontend mostra análise "normal"

Usuário NÃO SABE que dados estão incompletos!
```

## Solução: Metadata com Flags de Status

### PASSO 3.1: Criar Migration SQL

**Arquivo**: `supabase/migrations/20260123000003_add_analysis_metadata.sql`

```sql
-- ============================================================================
-- CRITICAL FIX: Metadata de análise parcial
-- ============================================================================

-- 1. Adicionar coluna analysis_metadata
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS analysis_metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Criar índice GIN para queries em JSONB
CREATE INDEX IF NOT EXISTS idx_calls_analysis_metadata
ON calls USING GIN (analysis_metadata);

-- 3. Comentário
COMMENT ON COLUMN calls.analysis_metadata IS
  'Metadados da análise: is_partial_analysis, chunks_analyzed, chunks_total, confidence_level, timeout_occurred';

-- 4. View para calls com análise parcial (útil para monitoramento)
CREATE OR REPLACE VIEW partial_analysis_calls AS
SELECT
  c.id,
  c.client_name,
  c.call_date,
  c.score,
  c.analysis_metadata->>'is_partial_analysis' as is_partial,
  (c.analysis_metadata->>'chunks_analyzed')::int as chunks_analyzed,
  (c.analysis_metadata->>'chunks_total')::int as chunks_total,
  c.created_at
FROM calls c
WHERE c.analysis_metadata->>'is_partial_analysis' = 'true'
ORDER BY c.created_at DESC;

COMMENT ON VIEW partial_analysis_calls IS
  'Calls com análise parcial (timeout durante chunking)';
```

---

### PASSO 3.2: Modificar analyze-call

**Arquivo**: `supabase/functions/analyze-call/index.ts`

**Localizar interface AnalysisData (linha ~1460)**:

Adicionar campo `__metadata`:

```typescript
interface AnalysisData {
  framework_selecionado?: string;
  confianca_framework?: number;
  motivo_escolha_framework?: string[];
  identificacao?: {
    // ... campos existentes
  };
  // ... outros campos existentes ...
  plano_de_acao_direto?: {
    // ... campos existentes
  };

  // ========== ADICIONAR ESTE CAMPO ==========
  __metadata?: {
    is_partial_analysis: boolean;
    chunks_analyzed: number;
    chunks_total: number;
    confidence_level: 'low' | 'high';
    analysis_method: 'chunked' | 'direct';
    timeout_occurred: boolean;
  };
  // ========== FIM NOVO ==========
}
```

---

**Localizar linha ~1237** (após merge de chunks):

```typescript
    const mergedAnalysis = await mergeChunkAnalyses(partialAnalyses);

    // ========== NOVO: Adicionar metadados de análise parcial ==========
    const isPartial = partialAnalyses.length < chunks.length;
    const timeoutOccurred = abortSignal?.aborted || false;

    const metadata = {
      is_partial_analysis: isPartial,
      chunks_analyzed: partialAnalyses.length,
      chunks_total: chunks.length,
      confidence_level: isPartial ? 'low' : 'high',
      analysis_method: 'chunked',
      timeout_occurred: timeoutOccurred
    };

    console.log(`Analysis metadata:`, JSON.stringify(metadata, null, 2));

    return {
      ...mergedAnalysis,
      __metadata: metadata  // ← Adiciona metadados
    };
    // ========== FIM NOVO ==========
  }
```

---

**Localizar linha ~1565** (após análise direta, NÃO chunked):

```typescript
    } else {
      console.log(`Standard file size, using DIRECT analysis`);
      // Run single comprehensive analysis
      const masterResponse = await callOpenAI(MASTER_PROMPT, transcription);
      console.log("AI analysis completed");
      console.log("Raw response length:", masterResponse.length);
      data = await parseJSONFromResponse(masterResponse) as AnalysisData;

      // ========== NOVO: Adicionar metadados para análise direta ==========
      data.__metadata = {
        is_partial_analysis: false,
        chunks_analyzed: 1,
        chunks_total: 1,
        confidence_level: 'high',
        analysis_method: 'direct',
        timeout_occurred: false
      };
      // ========== FIM NOVO ==========
    }
```

---

### PASSO 3.3: Modificar import-and-analyze

**Arquivo**: `supabase/functions/import-and-analyze/index.ts`

**Localizar linha ~352** (ao criar call):

Adicionar `analysis_metadata`:

```typescript
    const { data: callRecord, error: callError } = await supabase
      .from("calls")
      .upsert({
        closer_id: userId,
        client_id: clientId,
        // ... campos existentes ...
        content_hash: contentHash,
        technical_analysis: analysis.technical_analysis,
        analysis_metadata: analysis.analysis_metadata || data.__metadata || {},  // ← ADICIONAR
        main_errors: analysis.main_errors,
        // ... resto dos campos
```

---

### PASSO 3.4: Exibir Aviso no Frontend

**Arquivo**: `src/components/calls/CallDetailDialog.tsx`

**Localizar onde exibe detalhes da call** (procurar por `technical_analysis`):

Adicionar antes dos detalhes:

```typescript
// ========== ADICIONAR ESTE BLOCO ==========
{call.analysis_metadata?.is_partial_analysis && (
  <Alert variant="warning" className="mb-4">
    <AlertTriangle className="h-4 w-4" />
    <AlertTitle>Análise Parcial (Timeout)</AlertTitle>
    <AlertDescription>
      Esta call foi muito longa e a análise foi interrompida por timeout.
      Apenas {call.analysis_metadata.chunks_analyzed} de {call.analysis_metadata.chunks_total} chunks
      foram analisados. Os dados podem estar incompletos.
      {call.analysis_metadata.confidence_level === 'low' && (
        <span className="block mt-2 font-semibold">
          Confiança da análise: BAIXA
        </span>
      )}
    </AlertDescription>
  </Alert>
)}
// ========== FIM NOVO ==========
```

**Imports necessários no topo do arquivo**:

```typescript
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
```

---

### TESTE 3: Validar Metadata

```bash
# 1. Aplicar migration
# (Lovable faz automaticamente)

# 2. Importar call CURTA (< 50KB)
# Verificar no banco:
SELECT
  id,
  client_name,
  analysis_metadata->>'analysis_method' as method,
  analysis_metadata->>'is_partial_analysis' as is_partial
FROM calls
ORDER BY created_at DESC
LIMIT 1;
# Deve retornar: method='direct', is_partial='false'

# 3. Importar call LONGA (> 500KB - simular timeout)
# Verificar:
SELECT * FROM partial_analysis_calls LIMIT 1;
# Deve aparecer na view se houve timeout

# 4. Abrir call no frontend
# Deve exibir aviso amarelo: "Análise Parcial (Timeout)"
```

✅ **SUCESSO**: Usuário informado sobre análises parciais

---

# CHECKLIST FINAL DE VALIDAÇÃO

Após implementar todas as 3 correções:

## ✅ Testes Funcionais

- [ ] **Lock Atômico**:
  - Processar 10 arquivos com 3 processos paralelos
  - Nenhum arquivo processado 2x
  - Logs sem "already claimed"

- [ ] **Hash de Conteúdo**:
  - Importar arquivo A
  - Copiar conteúdo, salvar como arquivo B
  - Importar arquivo B
  - Sistema retorna `deduplicated: true`
  - Apenas 1 call criada

- [ ] **Metadata**:
  - Importar call curta → `is_partial_analysis: false`
  - Importar call longa (timeout) → `is_partial_analysis: true`
  - Frontend exibe aviso amarelo

## ✅ Testes de Banco de Dados

```sql
-- 1. Verificar colunas
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'calls'
  AND column_name IN ('content_hash', 'analysis_metadata');
-- Deve retornar 2 linhas

SELECT column_name
FROM information_schema.columns
WHERE table_name = 'imported_files'
  AND column_name IN ('retry_count', 'priority');
-- Deve retornar 2 linhas

-- 2. Verificar funções
SELECT routine_name
FROM information_schema.routines
WHERE routine_name IN ('claim_pending_files', 'increment_file_retry');
-- Deve retornar 2 linhas

-- 3. Verificar índices
SELECT indexname
FROM pg_indexes
WHERE tablename = 'calls'
  AND indexname LIKE '%hash%';
-- Deve retornar 2 índices (idx_calls_content_hash, idx_calls_closer_content_hash)

-- 4. Testar deduplicação
SELECT closer_id, content_hash, COUNT(*) as duplicates
FROM calls
WHERE content_hash IS NOT NULL
GROUP BY closer_id, content_hash
HAVING COUNT(*) > 1;
-- Deve retornar 0 linhas (sem duplicatas)
```

## ✅ Testes de Performance

- [ ] Importar 50 arquivos em lote
- [ ] Taxa de sucesso > 95%
- [ ] Tempo médio por arquivo < 2 minutos
- [ ] Zero arquivos presos após 10 minutos

---

# ORDEM DE EXECUÇÃO NO LOVABLE

## ETAPA 1: Migrations (5 minutos)

Copiar e colar no Lovable:

```
Por favor, crie as seguintes migrations SQL NA ORDEM:

1. Arquivo: supabase/migrations/20260123000001_add_atomic_lock_and_priority.sql
[COPIAR SQL COMPLETO DO PASSO 1.1]

2. Arquivo: supabase/migrations/20260123000002_add_content_hash_deduplication.sql
[COPIAR SQL COMPLETO DO PASSO 2.1]

3. Arquivo: supabase/migrations/20260123000003_add_analysis_metadata.sql
[COPIAR SQL COMPLETO DO PASSO 3.1]

Executar as migrations automaticamente.
```

---

## ETAPA 2: Modificar process-user-files (10 minutos)

```
Por favor, modifique o arquivo:
supabase/functions/process-user-files/index.ts

MODIFICAÇÃO 1 (linha ~171):
[COPIAR CÓDIGO DO PASSO 1.2 - Substituir fetch por RPC]

MODIFICAÇÃO 2 (linha ~241):
[DELETAR bloco de lock manual conforme PASSO 1.2]

MODIFICAÇÃO 3 (linha ~286):
[ADICIONAR increment_file_retry conforme PASSO 1.2]
```

---

## ETAPA 3: Modificar import-and-analyze (15 minutos)

```
Por favor, modifique o arquivo:
supabase/functions/import-and-analyze/index.ts

MODIFICAÇÃO 1 (após linha 72):
[ADICIONAR função generateContentHash conforme PASSO 2.2]

MODIFICAÇÃO 2 (linha ~216):
[ADICIONAR verificação de duplicata por hash conforme PASSO 2.2]

MODIFICAÇÃO 3 (linha ~352):
[ADICIONAR content_hash e analysis_metadata ao upsert conforme PASSOS 2.2 e 3.3]
```

---

## ETAPA 4: Modificar analyze-call (15 minutos)

```
Por favor, modifique o arquivo:
supabase/functions/analyze-call/index.ts

MODIFICAÇÃO 1 (linha ~1460):
[ADICIONAR campo __metadata à interface AnalysisData conforme PASSO 3.2]

MODIFICAÇÃO 2 (linha ~1237):
[ADICIONAR metadata após merge conforme PASSO 3.2]

MODIFICAÇÃO 3 (linha ~1565):
[ADICIONAR metadata para análise direta conforme PASSO 3.2]
```

---

## ETAPA 5: Modificar CallDetailDialog (10 minutos)

```
Por favor, modifique o arquivo:
src/components/calls/CallDetailDialog.tsx

MODIFICAÇÃO 1 (imports):
[ADICIONAR imports de Alert e AlertTriangle conforme PASSO 3.4]

MODIFICAÇÃO 2 (render):
[ADICIONAR Alert de análise parcial conforme PASSO 3.4]
```

---

## ETAPA 6: Testar (30 minutos)

Executar checklist de validação acima.

---

# RESULTADO ESPERADO

## Antes
- Taxa de sucesso: 70-80%
- Duplicatas: Possíveis
- Arquivos presos: 10-15%
- Análises parciais: Invisíveis

## Depois
- Taxa de sucesso: **95%+** ✅
- Duplicatas: **0%** ✅
- Arquivos presos: **0%** ✅
- Análises parciais: **Indicadas ao usuário** ✅

---

# TEMPO TOTAL ESTIMADO

| Etapa | Tempo |
|-------|-------|
| Migrations | 5min |
| process-user-files | 10min |
| import-and-analyze | 15min |
| analyze-call | 15min |
| CallDetailDialog | 10min |
| Testes | 30min |
| **TOTAL** | **1h 25min** |

*(Mais 30-60min para possíveis ajustes)*

---

# PRÓXIMA AÇÃO

**Copiar este arquivo para o Lovable e executar ETAPA por ETAPA na ordem.**

Cada ETAPA está completa com todo o código necessário - apenas copiar/colar! 🚀
