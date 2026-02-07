
# Logs de Erros + Auto-limpeza de "Call Muito Curta"

## O que sera feito

### 1. Nova aba "Logs de Erros" ao lado de Observabilidade

Adicionar uma nova aba no painel Admin que mostra os erros recentes de importacao, buscando da tabela `system_logs` (ja existente) e da tabela `imported_files` (erros ativos). Permite ao admin ver rapidamente quais arquivos falharam, de qual usuario, e o motivo.

### 2. Auto-limpeza de erros "Call muito curta"

No `import-and-analyze`, quando um arquivo for rejeitado por ser curto demais:
- Registrar o evento na tabela `system_logs` com o nome do arquivo, usuario, e tamanho
- Deletar o registro da tabela `imported_files` (em vez de deixar como `error`)

Assim, o erro fica apenas como registro historico nos logs, sem poluir os contadores de erro do painel de importacao.

---

## Alteracoes tecnicas

### Arquivo 1: `supabase/functions/import-and-analyze/index.ts` (linhas 309-329)

Apos marcar o erro de "call muito curta", adicionar:
1. Chamar `log_event` RPC para registrar o erro no `system_logs` com metadata contendo `file_name` e `content_length`
2. Deletar o registro de `imported_files` em vez de deixar como `error`

```typescript
// Antes: marca como error e retorna
// Depois: loga no system_logs + deleta o imported_file

await supabase.rpc('log_event', {
  p_level: 'warn',
  p_service: 'import-and-analyze',
  p_user_id: userId,
  p_operation: 'quality_rejection',
  p_metadata: {
    file_name: fileName,
    drive_file_id: fileId,
    content_length: content.length,
    minimum_length: MIN_CONTENT_LENGTH,
    reason: 'call_muito_curta'
  },
  p_error_message: errorMsg
});

// Deletar o registro para nao poluir contadores
await supabase
  .from("imported_files")
  .delete()
  .eq("id", importRecordId);
```

### Arquivo 2: `src/components/admin/ErrorLogsPanel.tsx` (novo componente)

Componente que exibe:
- Lista de erros recentes do `system_logs` (level = 'error' ou 'warn')
- Filtro por servico e nivel
- Para cada erro: timestamp, servico, usuario, mensagem, e metadata (nome do arquivo)
- Secao separada para "Calls rejeitadas" (operation = 'quality_rejection') com nome do arquivo e tamanho

### Arquivo 3: `src/pages/Admin.tsx` (linhas 441-444)

Adicionar nova aba apos "Observabilidade":

```typescript
<TabsTrigger value="error-logs" className="flex items-center gap-2">
  <AlertTriangle className="w-4 h-4" />
  Logs de Erros
</TabsTrigger>
```

E o conteudo correspondente:

```typescript
<TabsContent value="error-logs">
  <ErrorLogsPanel />
</TabsContent>
```

### Arquivo 4: Migracao SQL

Resetar os 4 registros existentes de "call muito curta":
1. Inserir logs no `system_logs` para cada um (preservar historico)
2. Deletar os registros de `imported_files`

```sql
-- Registrar no system_logs antes de deletar
INSERT INTO system_logs (level, service, user_id, operation, error_message, metadata)
SELECT 
  'warn', 
  'import-and-analyze', 
  user_id, 
  'quality_rejection',
  error_message,
  jsonb_build_object(
    'file_name', file_name,
    'reason', 'call_muito_curta',
    'migrated', true
  )
FROM imported_files
WHERE error_message LIKE '%Call muito curta%';

-- Deletar registros de erro
DELETE FROM imported_files
WHERE error_message LIKE '%Call muito curta%';
```

### Tambem aplicar para conteudo invalido/corrompido

O mesmo tratamento sera aplicado ao erro de "Conteudo invalido ou corrompido" (linhas 336-355 do import-and-analyze): logar + deletar.

---

## Resumo

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/import-and-analyze/index.ts` | Logar + deletar imported_file para calls curtas e conteudo corrompido |
| `src/components/admin/ErrorLogsPanel.tsx` | Novo componente com lista de erros do system_logs |
| `src/pages/Admin.tsx` | Nova aba "Logs de Erros" ao lado de Observabilidade |
| Migracao SQL | Migrar 4 erros existentes para system_logs e deletar de imported_files |

## Resultado

- Erros de "call curta" nao aparecem mais como erro no painel de importacao
- Historico completo de rejeicoes fica nos logs (com nome do arquivo)
- Nova aba permite ao admin ver todos os erros e rejeicoes em um so lugar
