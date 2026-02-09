

# Recuperar call com erro "Failed to export document"

## Situacao Atual

- 2 das 3 calls com erro ja foram recuperadas automaticamente pelo sistema (kjq-tcvt-xtr e pvc-ngnk-qbh)
- Apenas 1 call permanece com erro: `zwq-yqae-gbj` (Hannah) - "Failed to export document"
- ID do registro: `08448731-8c08-42e5-aa26-d9224282de74`
- Drive file ID: `1Q77vxVNfzKv_9CCx3C7U2RrUN7VMkU6QuIBqMvsdCP0`

## Causa

Erro temporario do Google Drive ao tentar exportar o documento como texto. Isso geralmente e um problema transitorio (permissao temporaria, arquivo ainda sendo processado pelo Google, etc).

## Solucao

### Passo unico: Resetar o arquivo para "pending" via SQL

Executar uma migracao que reseta o status do arquivo com erro para `pending`, limpando a mensagem de erro. O proximo ciclo do cron `auto-sync-drive` (a cada 30 min) ou um disparo manual ira reprocessa-lo automaticamente.

```sql
UPDATE imported_files 
SET status = 'pending', 
    error_message = NULL, 
    started_processing_at = NULL
WHERE id = '08448731-8c08-42e5-aa26-d9224282de74';
```

### Nenhuma alteracao de codigo necessaria

O sistema ja possui toda a logica de retry e reprocessamento. Basta resetar o status do registro.

