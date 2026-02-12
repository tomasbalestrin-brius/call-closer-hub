
# Adicionar botao "Reanalisar" nos erros do sistema

## Resumo

Adicionar um botao de reanalise em cada linha de erro do tipo `import_failed` no painel de Erros do Sistema, e tambem um botao para reanalisar todos os erros de uma vez. Ao clicar, o sistema reseta o status do arquivo correspondente na tabela `imported_files` de `error` para `pending`, fazendo com que o pipeline de processamento automatico o reprocesse.

---

## Mudancas

### `src/components/admin/ErrorLogsPanel.tsx`

1. **Extrair `fileId` do metadata** - Adicionar helper `getMetadataFileId` similar aos existentes (`getMetadataFileName`, etc.)

2. **Funcao `handleReanalyze(fileId)`** - Para cada erro individual:
   - Buscar o registro em `imported_files` pelo `drive_file_id`
   - Atualizar o `status` de `error` para `pending` e limpar `error_message`
   - Mostrar toast de sucesso/erro

3. **Funcao `handleReanalyzeAll()`** - Para todos os erros visiveis que tem `fileId` no metadata:
   - Coletar todos os `fileId` unicos dos logs filtrados
   - Resetar todos de uma vez para `pending`
   - Mostrar toast com quantidade

4. **UI - Botao individual** - Adicionar coluna "Acoes" na tabela de erros com botao de reanalise (icone RefreshCw) em cada linha que tenha `fileId` no metadata

5. **UI - Botao "Reanalisar Todos"** - Adicionar botao no header do card de erros, ao lado do titulo, para resetar todos os arquivos com erro de uma vez

---

## Detalhes tecnicos

### Helper para extrair fileId:
```text
const getMetadataFileId = (metadata: Json | null): string | null => {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return (metadata as Record<string, unknown>).fileId as string || null;
  }
  return null;
};
```

### Funcao de reanalise individual:
```text
const handleReanalyze = async (driveFileId: string) => {
  // Update imported_files: set status = 'pending', clear error
  const { error } = await supabase
    .from('imported_files')
    .update({ status: 'pending', error_message: null })
    .eq('drive_file_id', driveFileId)
    .eq('status', 'error');

  if (error) toast.error('Erro ao agendar reanalise');
  else toast.success('Arquivo agendado para reanalise');
};
```

### Funcao de reanalise em lote:
```text
const handleReanalyzeAll = async () => {
  const fileIds = [...new Set(otherErrors.map(l => getMetadataFileId(l.metadata)).filter(Boolean))];
  // Reset all matching files
  const { error, count } = await supabase
    .from('imported_files')
    .update({ status: 'pending', error_message: null })
    .in('drive_file_id', fileIds)
    .eq('status', 'error');
  // Toast with count
};
```

### Nova coluna na tabela de erros:
- Adicionar `<TableHead>Acoes</TableHead>` no header
- Em cada row, botao com icone RefreshCw que chama `handleReanalyze(fileId)` quando o log tem `fileId` no metadata

### Botao no header do card:
- Ao lado do titulo "Erros do Sistema (N)", adicionar botao "Reanalisar Todos" que chama `handleReanalyzeAll()`

---

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/components/admin/ErrorLogsPanel.tsx` | Adicionar helpers, funcoes de reanalise, coluna de acoes e botao em lote |
