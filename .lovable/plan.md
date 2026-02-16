

# Telefone clicavel nos cards de Calls (WhatsApp)

## O que muda

Os cards de calls no CRM de Calls passarao a exibir o telefone do cliente vinculado (quando houver), como um link clicavel que abre o WhatsApp -- igual ja funciona no CRM de clientes e no CRM Intensivo.

## Como funciona

- O telefone vem do cliente vinculado a call (campo `client_id` -> tabela `clients.phone`)
- A query de calls sera ajustada para buscar o telefone do cliente via join (`clients(phone)`)
- O CallCard exibira o telefone abaixo das informacoes existentes, com icone de telefone e link para `wa.me`
- Se a call nao tiver cliente vinculado ou o cliente nao tiver telefone, nada e exibido

## Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Calls.tsx` | Alterar a query para incluir join com clients: `select(CALLS_SELECT + ', clients(phone)')` e mapear o phone para cada call |
| `src/components/calls/CallCard.tsx` | Adicionar prop `clientPhone`, exibir link WhatsApp clicavel com icone Phone |
| `src/pages/SquadView.tsx` | Mesma alteracao na query de calls para incluir o telefone do cliente |
| `src/pages/ClientDetail.tsx` | Mesma alteracao na query de calls (se aplicavel) |
| `src/components/layout/Sidebar.tsx` | Mesma alteracao na query de calls para manter consistencia |

### Query ajustada

A query de calls sera alterada para fazer join com a tabela clients:

```
.select('..., clients(phone)')
```

O resultado tera um campo `clients: { phone: string | null }` que sera mapeado para `clientPhone` antes de passar ao CallCard.

### CallCard.tsx

- Nova prop opcional: `clientPhone?: string | null`
- Quando houver telefone, exibir abaixo da data/hora:

```tsx
{clientPhone && (
  <div className="flex items-center gap-2 text-muted-foreground">
    <Phone className="w-4 h-4 flex-shrink-0" />
    <a
      href={`https://wa.me/${clientPhone.replace(/\D/g, '')}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="truncate text-primary hover:underline"
    >
      {clientPhone}
    </a>
  </div>
)}
```

- `e.stopPropagation()` para nao abrir o dialog de detalhe ao clicar no link
- O icone Phone ja esta importado no arquivo

### Locais de query a atualizar

1. **Calls.tsx** (CALLS_SELECT) - query principal
2. **SquadView.tsx** - query de calls do time
3. **Sidebar.tsx** - query de calls recentes
4. **ClientDetail.tsx** - ja tem acesso ao cliente, pode passar o phone diretamente

