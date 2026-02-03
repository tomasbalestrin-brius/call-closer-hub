

# Plano: Limpar Calls Antigas (Anteriores a 01/02/2026)

## Resumo do Escopo

Serão removidos os seguintes dados de **todos os usuários**:

| Tipo de Dado | Quantidade | Ação |
|--------------|------------|------|
| Calls | 144 | Deletar todas (nenhuma é >= 01/02/2026) |
| Arquivos Importados | 370 | Deletar todos os registros |
| Clientes Google Drive | 134 | Deletar (são vinculados às calls importadas) |
| Clientes Manuais | 11 | **MANTER** (criados manualmente) |

### Distribuição de Calls por Usuário

| Closer ID | Total de Calls | Período |
|-----------|----------------|---------|
| db049238-... | 34 | 06/01 - 22/01 |
| 5dda698b-... | 27 | 05/01 - 22/01 |
| e6aa380a-... | 22 | 05/01 - 23/01 |
| 6582d39f-... | 20 | 07/01 - 22/01 |
| 03874296-... | 17 | 05/01 - 23/01 |
| 9c93a63f-... | 15 | 08/01 - 22/01 |
| eec82ac3-... | 9 | 13/01 - 22/01 |

## Passos da Implementação

### 1. Deletar Calls Antigas (com backup automático via trigger)

O trigger `backup_call_before_change` já existe e fará backup automático de cada call antes de deletar.

```sql
DELETE FROM calls 
WHERE call_date < '2026-02-01';
```

### 2. Limpar Arquivos Importados

Resetar todos os registros de arquivos importados para permitir reimportação futura:

```sql
DELETE FROM imported_files;
```

### 3. Limpar Sessões de Importação

```sql
DELETE FROM user_import_sessions;
```

### 4. Deletar Clientes Importados do Google Drive

Mantendo apenas clientes criados manualmente:

```sql
DELETE FROM clients 
WHERE source = 'google_drive';
```

### 5. Limpar Notas de Clientes Órfãs

```sql
DELETE FROM client_notes 
WHERE client_id NOT IN (SELECT id FROM clients);
```

### 6. Limpar Indicações Órfãs

```sql
DELETE FROM indications 
WHERE client_id NOT IN (SELECT id FROM clients);
```

## Resultado Esperado

Após a limpeza:
- **0 calls** anteriores a 01/02/2026
- Sistema pronto para novas importações
- **11 clientes manuais** preservados
- Backups das calls deletadas disponíveis na tabela `calls_backup`

## Impacto

| Item | Impacto |
|------|---------|
| Downtime | Zero |
| Dados Manuais | Preservados |
| Backups | Automáticos via trigger |
| Reimportação | Habilitada (arquivos limpos) |

## Seção Técnica

### SQL Completo de Limpeza

```sql
-- 1. Deletar calls antigas (backup automático via trigger)
DELETE FROM calls WHERE call_date < '2026-02-01';

-- 2. Limpar arquivos importados
DELETE FROM imported_files;

-- 3. Limpar sessões de importação
DELETE FROM user_import_sessions;

-- 4. Deletar clientes importados do Google Drive
DELETE FROM clients WHERE source = 'google_drive';

-- 5. Limpar notas de clientes órfãs
DELETE FROM client_notes 
WHERE client_id NOT IN (SELECT id FROM clients);

-- 6. Limpar indicações órfãs
DELETE FROM indications 
WHERE client_id NOT IN (SELECT id FROM clients);

-- 7. Limpar atividades de clientes órfãs
DELETE FROM client_activities 
WHERE client_id NOT IN (SELECT id FROM clients);
```

### Verificação Pós-Limpeza

```sql
SELECT 
  (SELECT COUNT(*) FROM calls) as remaining_calls,
  (SELECT COUNT(*) FROM imported_files) as remaining_imports,
  (SELECT COUNT(*) FROM clients) as remaining_clients,
  (SELECT COUNT(*) FROM calls_backup) as backup_count;
```

