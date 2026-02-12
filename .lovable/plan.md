

# Adicionar tags de Temperatura (Quente/Morno/Frio) no CRM de Calls

## Resumo

Reutilizar o sistema de temperatura de leads do CRM Intensivo (quente, morno, frio) no CRM de Calls. O usuario podera controlar a temperatura manualmente no painel de detalhes da call, e a tag aparecera no card da call.

---

## Mudancas

### 1. Migracao de banco de dados

Adicionar coluna `lead_temperature` na tabela `calls`:

```text
ALTER TABLE public.calls 
ADD COLUMN lead_temperature text DEFAULT 'morno';
```

Sem trigger de validacao (seguindo o mesmo padrao do intensivo onde o campo e `text` sem constraint).

### 2. `src/types/index.ts`

- Importar `LeadTemperature` de `@/types/intensivo` ou adicionar o tipo inline
- Adicionar `lead_temperature: LeadTemperature | null` na interface `Call`

### 3. `src/components/calls/CallCard.tsx`

- Importar `Flame`, `Thermometer`, `Snowflake` do lucide-react
- Adicionar config de temperatura (reutilizar o mesmo mapeamento do IntensiveLeadCard)
- Exibir badge de temperatura ao lado dos badges existentes (status e lead_classification)

### 4. `src/components/calls/CallDetailDialog.tsx`

- Adicionar um seletor de temperatura (Select) no painel de detalhes, similar ao IntensiveLeadDetailDialog
- Ao mudar o valor, fazer update direto na tabela `calls` via supabase
- Opcoes: Quente, Morno, Frio com emojis

### 5. `src/pages/Calls.tsx`

- Adicionar `lead_temperature` no `CALLS_SELECT` para que o campo seja carregado nas queries

---

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| Migracao SQL | Adicionar coluna `lead_temperature` na tabela `calls` |
| `src/types/index.ts` | Adicionar campo `lead_temperature` na interface `Call` |
| `src/pages/Calls.tsx` | Adicionar `lead_temperature` ao CALLS_SELECT |
| `src/components/calls/CallCard.tsx` | Exibir badge de temperatura no card |
| `src/components/calls/CallDetailDialog.tsx` | Adicionar seletor de temperatura |

