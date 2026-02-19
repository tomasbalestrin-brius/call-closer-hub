
# Correção Crítica: Enum call_status incorreto

## Problema identificado

O erro nos logs é claro:
```
invalid input value for enum call_status: "pos_venda"
```

O banco de dados tem o seguinte enum `call_status`:
- `pendente`
- `em_andamento`
- `follow_up`
- `proposta_enviada`
- `vendido`
- `perdido`

O código em `manual-analyze/index.ts` tenta inserir `"pos_venda"` quando a venda foi realizada (`analysis.sold === "sim"`), mas o valor correto no banco é **`"vendido"`**.

## Correção

### Arquivo: `supabase/functions/manual-analyze/index.ts`

Linha 114-116, trocar o mapeamento de status:

**Antes (errado):**
```typescript
let callStatus = "follow_up";
if (analysis.sold === "sim") callStatus = "pos_venda"; // ❌ não existe no enum
else callStatus = "follow_up";
```

**Depois (correto):**
```typescript
let callStatus = "follow_up";
if (analysis.sold === "sim") callStatus = "vendido"; // ✅ valor real no enum
else callStatus = "follow_up";
```

## Por que isso ocorreu

O enum `call_status` do banco usa `"vendido"`, mas em outras partes do sistema (como o lead_classification) existe o valor `"pos_venda"`. Houve uma confusão entre os dois enums diferentes.

## Impacto

- Calls com venda (`sold = "sim"`) estavam sempre falhando com erro de enum
- Calls sem venda (`sold = "nao"`) já funcionavam corretamente com `"follow_up"`
- Após a correção, todas as análises manuais serão salvas corretamente

## Arquivo a editar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/manual-analyze/index.ts` | `"pos_venda"` → `"vendido"` na linha 115 |
