

# Plano: Atualizar Data Mínima para 01/02/2026

## Problema Identificado

As funções de importação estão configuradas para importar a partir de **01/01/2026**, mas o correto é **01/02/2026**.

## Alterações Necessárias

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/initial-import/index.ts` | Alterar linha 185 |
| `supabase/functions/sync-drive-files/index.ts` | Alterar linha 69 |

### Código Atual vs Novo

```text
// ATUAL (incorreto)
const MIN_IMPORT_DATE = '2026-01-01T00:00:00.000Z';

// NOVO (correto)
const MIN_IMPORT_DATE = '2026-02-01T00:00:00.000Z';
```

## Sobre Sincronização Automática

O sistema já possui sync automático configurado:

1. **Cron Job**: A cada 10 minutos, o `sync-drive-files` verifica novas calls
2. **Requisito**: O usuário deve ter `drive_auto_import = true` no perfil
3. **Comportamento**: Busca arquivos desde o último sync, respeitando a data mínima

## Resultado Esperado

Após a alteração:
- Importação manual via botão: só arquivos >= 01/02/2026
- Sync automático: só arquivos >= 01/02/2026
- Arquivos de janeiro serão ignorados permanentemente

## Seção Técnica

### Alteração 1: `initial-import/index.ts` (linha 185)

```typescript
// De:
const MIN_IMPORT_DATE = '2026-01-01T00:00:00.000Z';

// Para:
const MIN_IMPORT_DATE = '2026-02-01T00:00:00.000Z';
```

### Alteração 2: `sync-drive-files/index.ts` (linha 69)

```typescript
// De:
const MIN_IMPORT_DATE = '2026-01-01T00:00:00.000Z';

// Para:
const MIN_IMPORT_DATE = '2026-02-01T00:00:00.000Z';
```

