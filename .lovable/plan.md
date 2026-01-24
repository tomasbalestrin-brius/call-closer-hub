
# Plano: Corrigir Salvamento de Dados de Clientes

## Diagnóstico do Problema

O salvamento de informações de clientes está falhando devido a uma **incompatibilidade de tipo de dados** entre as tabelas `clients` e `clients_backup`.

### Causa Raiz Identificada

| Tabela | Coluna | Tipo Atual |
|--------|--------|------------|
| `clients` | `contract_validity` | `TEXT` |
| `clients_backup` | `contract_validity` | `DATE` |

Quando um usuário tenta salvar um cliente (ex: via `SaleFormDialog`), o seguinte acontece:

1. O frontend envia dados como `contract_validity: "12 meses"` (texto)
2. O trigger `backup_client_trigger` é executado ANTES do UPDATE
3. O trigger tenta inserir na tabela `clients_backup` onde `contract_validity` espera um `DATE`
4. O banco de dados retorna erro: **"column 'contract_validity' is of type date but expression is of type text"**
5. Toda a transação é revertida - nenhum dado é salvo!

Este problema afeta **qualquer atualização de cliente** que tenha um valor em `contract_validity`.

## Solução Proposta

### Opção Escolhida: Alinhar tipos de dados (TEXT em ambas as tabelas)

Como a UI permite entrada livre ("12 meses", "1 ano", etc.), o tipo `TEXT` é mais apropriado.

### Passos da Implementação

**1. Corrigir a coluna na tabela de backup**

Executar uma migração SQL para alterar o tipo da coluna `contract_validity` na tabela `clients_backup` de `DATE` para `TEXT`:

```sql
ALTER TABLE clients_backup 
ALTER COLUMN contract_validity TYPE TEXT 
USING contract_validity::TEXT;
```

**2. Verificar se há dados existentes na tabela de backup**

Se houver datas formatadas como `DATE`, elas serão convertidas automaticamente para texto no formato ISO (YYYY-MM-DD).

## Resultado Esperado

- Todas as atualizações de clientes funcionarão normalmente
- O trigger de backup continuará operando sem erros
- Os usuários poderão salvar dados como "12 meses", "1 ano", ou qualquer texto livre

## Impacto

| Item | Impacto |
|------|---------|
| Downtime | Zero - migração é instantânea |
| Dados existentes | Preservados (conversão automática) |
| Funcionalidade | Restaurada imediatamente |

## Seção Técnica

### SQL de Migração

```sql
-- Corrigir tipo da coluna contract_validity na tabela de backup
ALTER TABLE clients_backup 
ALTER COLUMN contract_validity TYPE TEXT 
USING contract_validity::TEXT;

-- Comentário explicativo para documentação
COMMENT ON COLUMN clients_backup.contract_validity IS 'Vigência do contrato em formato texto livre (ex: 12 meses, 1 ano)';
```

### Arquivos Que Não Precisam de Alteração

O código do frontend (`SaleFormDialog.tsx`) já está correto - ele envia texto para um campo que deveria ser texto. O problema era apenas a inconsistência no banco de dados.
