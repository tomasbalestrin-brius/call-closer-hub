
# Reanalisar Calls com Analise Incompleta - Botao Admin

## Contexto
Existem **50 calls** com analises incompletas (nota geral > 0 mas etapas zeradas) distribuidas entre os closers:
- Gisele: 14 calls
- Tainara: 12 calls
- Hannah: 8 calls
- Carlos: 7 calls
- Leandro: 6 calls
- Deyvid Joner: 3 calls

Ja existe a edge function `batch-reanalyze` com suporte a `reanalyzeAll: true`.

## Solucao

Adicionar um botao **"Reanalisar Calls Incompletas"** na aba de Importacoes da pagina Admin que chama a funcao `batch-reanalyze` com `reanalyzeAll: true`.

### Alteracao

**Arquivo**: `src/pages/Admin.tsx`

1. Adicionar estado para controlar loading do botao (`isReanalyzing`)
2. Adicionar import do icone `RefreshCw` do lucide-react
3. Na aba "Importacoes" (ou na aba "Closers"), adicionar um card/botao:
   - Titulo: "Reanalisar Calls Incompletas"
   - Descricao: "Reanalisa todas as calls que tiveram timeout na analise original"
   - Botao com loading state que chama `supabase.functions.invoke('batch-reanalyze', { body: { reanalyzeAll: true } })`
   - Toast de sucesso informando quantas calls entraram na fila
   - Toast de erro em caso de falha

O processamento ja e fire-and-forget (a funcao retorna imediatamente e processa em background), entao a UI nao precisa esperar.
