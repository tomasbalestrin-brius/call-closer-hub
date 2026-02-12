
# Mostrar nome do closer na lista de vendas (visao admin)

## Resumo

Quando o admin visualiza o dialog "Vendas Fechadas", cada card deve exibir o nome do closer responsavel pela venda, para que o admin saiba quem vendeu para cada cliente.

---

## Mudanca

**Arquivo:** `src/components/dashboard/SalesListDialog.tsx`

1. **Query** - Adicionar `closer_id` no select e fazer um join com a tabela `profiles` para trazer o nome do closer:
   ```
   .select('id, name, niche, sale_value, entry_value, product_offered, sold_at, closer_id, profiles!closer_id(full_name)')
   ```

2. **UI** - Quando `isAdmin` for true, exibir o nome do closer abaixo do nicho do cliente, com uma badge ou texto pequeno indicando quem fechou a venda. Exemplo:
   - Abaixo do nome/nicho, adicionar uma linha com texto tipo: `Closer: Nome do Closer` em `text-xs text-blue-600`

3. Nenhuma mudanca de schema necessaria - a relacao `clients.closer_id -> profiles.user_id` ja existe.

---

## Detalhe tecnico

Na renderizacao de cada card, quando `isAdmin`:
```text
{isAdmin && sale.profiles?.full_name && (
  <p className="text-xs text-blue-600 truncate">Closer: {sale.profiles.full_name}</p>
)}
```

Isso aparecera logo abaixo do nicho, dentro do bloco de info do cliente.

---

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/components/dashboard/SalesListDialog.tsx` | Adicionar join com profiles no select + exibir nome do closer para admin |
