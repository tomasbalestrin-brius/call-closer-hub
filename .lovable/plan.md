

# Limpar importação do Deyvison — apenas arquivos de 17/03 em diante

## Situação atual
- Deyvison (user_id: `94e25a6d-8016-4b4c-b842-e8fefe0435f9`) tem **92 arquivos pendentes** na fila de importação
- Muitos são de fevereiro e início de março (antes de 17/03)
- Nenhuma call foi processada ainda (todos com status `pending`)

## Plano de ação

### 1. Remover arquivos antigos da fila (migration SQL)
Deletar da tabela `imported_files` todos os registros pendentes do Deyvison cujo nome contenha datas anteriores a 17/03/2026. Os nomes seguem o padrão `(2026-MM-DD ...)`, então filtraremos por:
- Arquivos com `2026-02-` no nome (fevereiro)
- Arquivos com datas de março antes do dia 17 (`2026-03-0`, `2026-03-1` seguido de 0-6)

```sql
DELETE FROM imported_files
WHERE user_id = '94e25a6d-8016-4b4c-b842-e8fefe0435f9'
  AND status = 'pending'
  AND (
    file_name LIKE '%(2026-02-%'
    OR file_name LIKE '%(2026-03-01%'
    OR file_name LIKE '%(2026-03-02%'
    OR file_name LIKE '%(2026-03-03%'
    OR file_name LIKE '%(2026-03-04%'
    OR file_name LIKE '%(2026-03-05%'
    OR file_name LIKE '%(2026-03-06%'
    OR file_name LIKE '%(2026-03-07%'
    OR file_name LIKE '%(2026-03-08%'
    OR file_name LIKE '%(2026-03-09%'
    OR file_name LIKE '%(2026-03-10%'
    OR file_name LIKE '%(2026-03-11%'
    OR file_name LIKE '%(2026-03-12%'
    OR file_name LIKE '%(2026-03-13%'
    OR file_name LIKE '%(2026-03-14%'
    OR file_name LIKE '%(2026-03-15%'
    OR file_name LIKE '%(2026-03-16%'
  );
```

### 2. Atualizar `drive_last_sync` do Deyvison
Setar a data de última sincronização para `2026-03-17T00:00:00.000Z`, garantindo que futuras sincronizações automáticas não puxem arquivos anteriores:

```sql
UPDATE profiles
SET drive_last_sync = '2026-03-17T00:00:00.000Z'
WHERE user_id = '94e25a6d-8016-4b4c-b842-e8fefe0435f9';
```

### Resultado esperado
- Apenas arquivos de 17/03 em diante permanecerão na fila pendente
- Sincronizações futuras respeitarão a data mínima de 17/03
- Nenhuma alteração de código necessária — apenas dados

