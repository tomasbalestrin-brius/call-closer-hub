

# Plano: Role "Intensivo" + Fluxo Carlos (Revisado)

## Resumo

Criar role `intensivo`, usuario `carlos@bethel.com`, e um fluxo onde closers encaminham leads via coluna "Intensivo Carlos" no kanban. O lead e movido livremente pelo closer apos o encaminhamento -- o card do Carlos ja foi criado. O card no CRM do Carlos tera uma tag com o nome do closer de origem.

## Banco de Dados

### 1. Adicionar `intensivo` ao enum `user_role`
```sql
ALTER TYPE user_role ADD VALUE 'intensivo';
```

### 2. Adicionar novos status ao campo `status` da tabela `clients`
Novos valores (campo text, sem enum): `intensivo_carlos`, `enviar_convite_intensivo`, `formulario_preenchido`, `retirado_ingresso`, `confirmado_intensivo`.

### 3. Adicionar coluna `origin_closer_name` na tabela `clients`
Campo `text nullable` para guardar o nome do closer que encaminhou o lead. Aparecera como tag no card do Carlos.

### 4. Criar usuario `carlos@bethel.com` via Edge Function `admin-reset-password` ou criar nova Edge Function
- Senha: `12345678`
- Role: `intensivo`
- Profile: `full_name = 'Carlos'`

### 5. Trigger: copiar lead quando status muda para `intensivo_carlos`
```sql
CREATE FUNCTION copy_client_to_intensivo_carlos()
RETURNS trigger ...
```
- Quando `status` muda para `intensivo_carlos`, copia o registro para um novo `client` com:
  - `closer_id` = user_id do Carlos (busca por role `intensivo`)
  - `status` = `enviar_convite_intensivo`
  - `origin_closer_name` = nome do closer original (via join com `profiles`)
- O closer original mantem o lead na coluna que quiser (sem restricao)

### 6. RLS para role `intensivo`
Carlos precisa ver/editar seus proprios clients (ja coberto pela policy `closer_id = auth.uid()`).

## Frontend

### 7. `src/types/index.ts`
- `UserRole`: adicionar `'intensivo'`

### 8. `src/contexts/UserRoleContext.tsx`
- Adicionar `isIntensivo` ao contexto

### 9. `src/hooks/useUserPermissions.ts`
- Expor `isIntensivo`

### 10. `src/components/layout/Sidebar.tsx`
- Se role = `intensivo`: mostrar apenas Dashboard, CRM Calls, Chat

### 11. `src/components/clients/ClientKanban.tsx`
- Para closers normais: adicionar coluna "Intensivo Carlos" (id: `intensivo_carlos`) apos RePitch
- Para role `intensivo`: mostrar apenas 4 colunas:
  1. Enviar convite para o intensivo (`enviar_convite_intensivo`)
  2. Formulario preenchido (`formulario_preenchido`)
  3. Retirado o ingresso (`retirado_ingresso`)
  4. Confirmado (`confirmado_intensivo`)

### 12. `src/components/clients/ClientCard.tsx`
- Exibir badge/tag com `origin_closer_name` quando presente (visivel no CRM do Carlos)

### 13. `src/pages/Clients.tsx`
- Para role `intensivo`: nao mostrar seletor de closer, carregar apenas seus proprios clients

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| Migration SQL | Enum + coluna + trigger |
| `src/types/index.ts` | UserRole + intensivo |
| `src/contexts/UserRoleContext.tsx` | isIntensivo |
| `src/hooks/useUserPermissions.ts` | isIntensivo |
| `src/components/layout/Sidebar.tsx` | Nav condicional |
| `src/components/clients/ClientKanban.tsx` | Coluna nova + kanban alternativo |
| `src/components/clients/ClientCard.tsx` | Tag closer origem |
| `src/pages/Clients.tsx` | Condicional para intensivo |

## Fluxo resumido

```text
Closer move lead → coluna "Intensivo Carlos"
         ↓
  Trigger no banco copia lead
  closer_id = Carlos, status = enviar_convite_intensivo
  origin_closer_name = "Nome do Closer"
         ↓
  Closer continua movendo o lead livremente no seu kanban
         ↓
  Carlos ve o card no seu CRM com tag "Closer: João"
  e trabalha nas 4 colunas exclusivas
```

