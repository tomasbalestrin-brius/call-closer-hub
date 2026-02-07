
# Corrigir Persistencia de Cargos/Niveis

## Problema Identificado

A atualizacao de **nivel do closer** (Assessor, Executivo, Pro, etc.) nao persiste porque falta uma **politica de UPDATE para admins** na tabela `profiles`.

Politicas atuais na tabela `profiles`:
- Admin pode apenas **visualizar** (SELECT) todos os perfis
- Usuarios podem atualizar **apenas o proprio** perfil
- Lideres podem atualizar perfis dos **membros do squad**

Quando o admin altera o nivel, o codigo atualiza o estado local (parece funcionar), mas o banco rejeita silenciosamente a escrita via RLS. Ao recarregar a pagina, o valor antigo retorna.

## Solucao

### Parte 1 - Migration: Adicionar politica de UPDATE para admins

Criar uma nova politica RLS na tabela `profiles`:

```sql
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));
```

Isso permite que admins atualizem qualquer perfil (nivel, status, telefone, etc.).

### Parte 2 - Validacao no codigo (Admin.tsx)

Atualmente, `updateCloserLevel` e `onRoleChange` atualizam o estado local **antes** de confirmar o sucesso no banco. Ajustar para que:
- O `updateCloserLevel` ja funciona corretamente (atualiza local so apos o update sem erro)
- O `UserRoleSelect` tambem ja funciona corretamente (atualiza via `onRoleChange` callback so apos sucesso)

Na verdade, revisando o codigo, ambos ja atualizam o estado local **apos** sucesso. O problema e exclusivamente a falta da politica RLS. A migration resolve o problema.

### Resultado

Apos a migration, o admin podera atualizar niveis e os valores persistirao entre recarregamentos.
