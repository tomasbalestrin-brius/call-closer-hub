

# Permitir Admin Mestre Alterar Email/Login de Usuarios

## Resumo

Criar funcionalidade para que o admin mestre (tomasbalestrin@gmail.com) possa alterar o email de login de qualquer usuario diretamente pelo painel administrativo.

---

## Mudancas

### 1. Nova Edge Function: `admin-update-email`

Criar `supabase/functions/admin-update-email/index.ts`:

- Recebe `user_id` e `new_email` no body
- Verifica que o chamador e admin
- Verifica que o chamador e o admin mestre (tomasbalestrin@gmail.com) como camada extra de seguranca
- Usa `supabaseAdmin.auth.admin.updateUserById(user_id, { email: new_email })` para alterar o email
- Retorna sucesso ou erro

Adicionar em `supabase/config.toml`:
```text
[functions.admin-update-email]
verify_jwt = false
```

### 2. Novo Componente: `src/components/admin/ChangeEmailDialog.tsx`

Dialog similar ao `ResetPasswordDialog`:
- Campo para novo email com validacao (formato email valido)
- Campo de confirmacao do novo email
- Botao de salvar que chama a edge function
- Mostra nome do usuario sendo editado

### 3. `src/pages/Admin.tsx`

- Importar `ChangeEmailDialog`
- Adicionar estado para controlar o dialog (`changeEmailDialogOpen`, `selectedCloserForEmail`)
- Adicionar botao "Email" (icone `Mail`) ao lado do botao "Senha" na lista de closers
- Visivel apenas para o admin mestre (verificar se o email do usuario logado e `tomasbalestrin@gmail.com`)

---

## Arquivos modificados/criados

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/admin-update-email/index.ts` | Nova edge function para alterar email |
| `supabase/config.toml` | Adicionar config da nova function |
| `src/components/admin/ChangeEmailDialog.tsx` | Novo dialog para alterar email |
| `src/pages/Admin.tsx` | Adicionar botao e dialog de alterar email |

