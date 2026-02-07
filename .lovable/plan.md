

# Links Clicaveis no Card do Cliente (WhatsApp + Instagram)

## O que muda

### 1. Telefone vira link do WhatsApp
No card do cliente, o numero de telefone sera clicavel e abrira diretamente o WhatsApp Web/App para iniciar conversa.

### 2. Novo campo: Instagram
Adicionar o campo `instagram` na base de dados e exibi-lo no card do cliente como link clicavel que abre o perfil no Instagram.

---

## Detalhes tecnicos

### Parte 1 - Migration: Adicionar coluna `instagram` na tabela `clients`

```sql
ALTER TABLE public.clients ADD COLUMN instagram text;
```

### Parte 2 - Atualizar o tipo `Client` (automatico)

O arquivo `types.ts` do banco e gerado automaticamente. Porem, o tipo manual em `src/types/index.ts` precisa receber o campo `instagram: string | null`.

### Parte 3 - Atualizar `ClientCard.tsx`

- **Telefone**: Trocar o `<span>` do telefone por um `<a href="https://wa.me/NUMERO">` que abre o WhatsApp. Adicionar `onClick stopPropagation` para nao navegar ao detalhe do cliente.
- **Instagram**: Adicionar uma nova linha com icone do Instagram (usar icone generico do Lucide, como `AtSign`) e um link `<a href="https://instagram.com/USUARIO">` clicavel. Tambem com `stopPropagation`.

### Parte 4 - Atualizar formularios de criacao/edicao

- `NewClientDialog.tsx` - Adicionar campo "Instagram (@)" no formulario
- `ClientEditDialog.tsx` - Adicionar campo "Instagram (@)" no formulario de edicao

### Resultado

- Telefone no card do cliente abre WhatsApp direto ao clicar
- Instagram no card do cliente abre o perfil no Instagram ao clicar
- Ambos os campos podem ser preenchidos na criacao e edicao do cliente
