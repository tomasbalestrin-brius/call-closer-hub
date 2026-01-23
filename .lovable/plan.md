
# Plano: Reset e Disparo de Processamento Turbo

## Situação Atual
- **120** arquivos completed
- **108** arquivos travados em `processing`
- **14** arquivos com erro

## Ações a Executar

### Passo 1: Reset dos Arquivos Travados
Executar SQL para resetar os 108 arquivos de `processing` para `pending`:

```sql
UPDATE imported_files 
SET status = 'pending', 
    started_processing_at = NULL, 
    error_message = NULL
WHERE status = 'processing';
```

### Passo 2: Reset das Sessões Órfãs
Marcar sessões `running` antigas como `error`:

```sql
UPDATE user_import_sessions 
SET status = 'error', 
    completed_at = NOW(),
    current_file_name = 'Reset para reprocessamento'
WHERE status = 'running';
```

### Passo 3: Confirmar Estado Limpo
Verificar que todos os arquivos estão em `pending` para processamento.

### Passo 4: Instruções para Disparo Manual
Após o reset, você precisará:
1. Ir ao painel Admin > Importações
2. Clicar no botão **"Turbo (3x)"** para iniciar o processamento paralelo
3. Monitorar o progresso em tempo real no painel

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| 108 arquivos em processing | 108 arquivos em pending |
| Processamento bloqueado | Pronto para Turbo (3x) |

## Tempo Estimado
Com as correções aplicadas (timeout 140s, delay 500ms):
- **108 arquivos** ÷ 3 workers paralelos = ~36 arquivos/worker
- ~36 arquivos × 2 segundos = **~1-2 minutos** em modo Turbo
