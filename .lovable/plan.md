
# Corrigir Analises de Emergencia - Auto-Reanalise

## Problema
Quando uma call longa sofre timeout no merge, o sistema cria uma "sintese de emergencia" (`buildPartialAnalysisFromChunks`) que:
- Calcula uma nota geral (ex: 8) a partir da media dos chunks
- Mas retorna `analise_por_etapa: {}` (vazio)
- O fallback preenche todas as 12 etapas com `aconteceu: "nao"` e `nota: 0`
- Resultado: nota 8 mas todos os pontos zerados (caso da Mayra Feliciano)

## Solucao em 3 partes

### Parte 1 - Melhorar a sintese de emergencia (analyze-call)
No `buildPartialAnalysisFromChunks`, ao inves de retornar `analise_por_etapa: {}`, construir as etapas a partir dos dados dos chunks que ja foram analisados. Cada chunk retorna `etapas_identificadas` com notas e evidencias -- basta consolida-las.

**Arquivo**: `supabase/functions/analyze-call/index.ts`
- Na funcao `buildPartialAnalysisFromChunks` (linha ~1298):
  - Iterar por `chunks.flatMap(c => c.etapas_identificadas)` 
  - Agrupar por `nome_etapa`
  - Para cada etapa: usar a maior nota, combinar pontos fortes/fracos e evidencias
  - Retornar um `analise_por_etapa` preenchido com dados reais dos chunks

### Parte 2 - Auto-reanalise apos emergencia (import-and-analyze)
Apos salvar a call no banco, verificar se `analysis_metadata.is_emergency_synthesis === true`. Se sim, agendar uma reanalise automatica em background.

**Arquivo**: `supabase/functions/import-and-analyze/index.ts`
- Apos a linha ~766 (update completed), adicionar verificacao:
  - Se `analysis_metadata.is_emergency_synthesis`, chamar `reanalyze-call` em background via `EdgeRuntime.waitUntil()`
  - A reanalise usa o modelo gpt-4o completo com a transcricao ja salva
  - Se a reanalise funcionar, sobrescreve a analise de emergencia
  - Se falhar, a analise de emergencia (agora melhorada) permanece como fallback

### Parte 3 - Botao "Reanalisar" no aviso de analise parcial (UI)
No `CallDetailDialog.tsx`, junto ao aviso de analise parcial, adicionar um botao para o usuario reanalisar manualmente.

**Arquivo**: `src/components/calls/CallDetailDialog.tsx`
- Dentro do Alert de `is_partial_analysis` (linha ~170):
  - Adicionar botao "Reanalisar" que chama a edge function `reanalyze-call`
  - Mostrar loading durante a reanalise
  - Recarregar os dados da call apos sucesso

## Resultado esperado
- Calls com emergencia agora terao etapas preenchidas (mesmo que parciais) ao inves de tudo zerado
- Auto-reanalise em background garante que a maioria das calls sera corrigida automaticamente
- Botao manual como fallback para casos onde a auto-reanalise tambem falhar
