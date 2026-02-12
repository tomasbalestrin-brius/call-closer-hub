

# Adicionar Instagram no card de Contato (ClientDetail)

## Mudanca

Adicionar o campo Instagram logo abaixo do e-mail no card "Contato" da pagina de detalhe do cliente (`src/pages/ClientDetail.tsx`).

## Detalhe tecnico

### `src/pages/ClientDetail.tsx`

1. Importar o icone `AtSign` do lucide-react (ja importado no arquivo)
2. Apos a linha do e-mail (linha 554), adicionar um novo bloco para o Instagram:

```text
{/* Apos o e-mail */}
<div className="flex items-center gap-2 text-muted-foreground">
  <AtSign className="w-4 h-4 flex-shrink-0" />
  {client.instagram ? (
    <a
      href={`https://instagram.com/${client.instagram.replace(/^@/, '')}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline"
    >
      @{client.instagram.replace(/^@/, '')}
    </a>
  ) : (
    <span className="text-muted-foreground/50 italic">Instagram nao informado</span>
  )}
</div>
```

O icone `AtSign` ja esta importado no arquivo. O padrao de link segue o mesmo usado no `ClientCard.tsx`.

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/ClientDetail.tsx` | Adicionar campo Instagram abaixo do e-mail no card Contato |

