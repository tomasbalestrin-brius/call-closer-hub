
# Plano de Correção - Erros de Build Restantes

## Diagnóstico

O código do GitHub está sincronizado, mas há 2 pendências que impedem o build:

### Problema 1: Schema do Banco Desalinhado
A interface `Call` em `src/types/index.ts` espera 3 colunas que **não existem** na tabela `calls`:
- `analysis_quality_score`
- `deleted_at` 
- `deleted_by`

Isso causa erros de cast em 5 arquivos porque o tipo gerado pelo Supabase (`types.ts`) não inclui essas colunas.

### Problema 2: Tipagem TypeScript na Edge Function
O arquivo `analyze-call/index.ts` tem 23 erros de tipagem:
- Variável `match` sem tipo explícito (linha 992)
- `globalThis.apiUsageStats` sem declaração de tipo global
- Propriedade `__metadata` não declarada na interface `AnalysisData`

---

## Fase 1: Adicionar Colunas Faltantes no Banco

Executar migration SQL para alinhar o banco com a interface:

```sql
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS analysis_quality_score NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL;

COMMENT ON COLUMN calls.analysis_quality_score IS 'Score de qualidade da análise AI (0-100)';
COMMENT ON COLUMN calls.deleted_at IS 'Soft delete timestamp';
COMMENT ON COLUMN calls.deleted_by IS 'ID do usuário que deletou a call';

CREATE INDEX IF NOT EXISTS idx_calls_deleted_at 
ON calls(deleted_at) WHERE deleted_at IS NULL;
```

**Resultado esperado**: O arquivo `src/integrations/supabase/types.ts` será regenerado automaticamente com as novas colunas, corrigindo os 5 erros de cast.

---

## Fase 2: Corrigir Tipagem na Edge Function

### 2.1 Declarar interface global para API Usage Stats

Adicionar após os imports (linha ~8):

```typescript
interface ApiUsageStat {
  service: string;
  model: string;
  operation: string;
  tokensInput: number;
  tokensOutput: number;
}

declare global {
  var apiUsageStats: ApiUsageStat[] | undefined;
}
```

### 2.2 Tipar variável `match`

Alterar linha 992:

```typescript
// DE:
let match;

// PARA:
let match: RegExpExecArray | null;
```

### 2.3 Adicionar `__metadata` à interface AnalysisData

Localizar a interface `AnalysisData` no arquivo e adicionar:

```typescript
__metadata?: {
  is_partial_analysis?: boolean;
  chunks_analyzed?: number;
  chunks_total?: number;
  confidence_level?: 'low' | 'high';
  analysis_method?: 'chunked' | 'direct';
  timeout_occurred?: boolean;
};
```

### 2.4 Tipar os reduces

Alterar linhas 1974-1975:

```typescript
// DE:
const totalInput = globalThis.apiUsageStats.reduce((sum, s) => sum + s.tokensInput, 0);
const totalOutput = globalThis.apiUsageStats.reduce((sum, s) => sum + s.tokensOutput, 0);

// PARA:
const totalInput = globalThis.apiUsageStats.reduce((sum: number, s: ApiUsageStat) => sum + s.tokensInput, 0);
const totalOutput = globalThis.apiUsageStats.reduce((sum: number, s: ApiUsageStat) => sum + s.tokensOutput, 0);
```

---

## Sequência de Execução

```text
┌─────────────────────────────────────────────────────┐
│  PASSO 1: Executar migration SQL                    │
│  → Adicionar 3 colunas à tabela calls               │
│  → Criar índice para soft delete                    │
├─────────────────────────────────────────────────────┤
│  PASSO 2: Aguardar regeneração de types.ts          │
│  → Lovable Cloud regenera automaticamente           │
│  → 5 erros de cast resolvidos                       │
├─────────────────────────────────────────────────────┤
│  PASSO 3: Corrigir analyze-call/index.ts            │
│  → Adicionar interface ApiUsageStat                 │
│  → Declarar global var                              │
│  → Tipar variável match                             │
│  → Adicionar __metadata à AnalysisData              │
│  → Tipar parâmetros dos reduces                     │
├─────────────────────────────────────────────────────┤
│  PASSO 4: Deploy automático                         │
│  → Edge function redeployada                        │
│  → Build completo sem erros                         │
└─────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

Após as correções:
- ✅ 23 erros de TypeScript na Edge Function resolvidos
- ✅ 5 erros de cast nos componentes frontend resolvidos
- ✅ Suporte a soft delete com `deleted_at` / `deleted_by`
- ✅ Métrica `analysis_quality_score` disponível
- ✅ Metadata de análise parcial funcionando

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| Schema SQL (migration) | +3 colunas, +1 índice |
| `supabase/functions/analyze-call/index.ts` | Adicionar tipagens TypeScript |

## Arquivos Corrigidos Automaticamente

| Arquivo | Como |
|---------|------|
| `src/integrations/supabase/types.ts` | Regenerado após migration |
| `src/components/calls/MergeCallDialog.tsx` | Erro de cast some automaticamente |
| `src/hooks/usePortfolio.ts` | Erro de cast some automaticamente |
| `src/pages/Calls.tsx` | Erro de cast some automaticamente |
| `src/pages/ClientDetail.tsx` | Erro de cast some automaticamente |
| `src/pages/SquadView.tsx` | Erro de cast some automaticamente |

---

## Detalhes Técnicos

### Por que os erros de cast acontecem?

O Supabase gera `types.ts` baseado no schema real do banco. Como `analysis_quality_score`, `deleted_at` e `deleted_by` não existem no banco, o tipo gerado não tem essas propriedades. Quando o código faz cast para `Call[]` (que tem essas propriedades), o TypeScript reclama.

### Por que globalThis precisa de declaração?

TypeScript strict mode não permite propriedades arbitrárias em `globalThis`. Precisamos declarar explicitamente usando `declare global { var ... }`.
