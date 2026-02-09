

# Corrigir Impossibilidade de Logout com Sessao Corrompida

## Problema

Quando o refresh token de um usuario expira ou e invalidado, o fluxo atual:
1. `onAuthStateChange` nao dispara `SIGNED_OUT`
2. `getSession` retorna sessao `null` mas os tokens invalidos permanecem no localStorage
3. O app redireciona para `/auth` mas os tokens corrompidos persistem
4. Na proxima visita, o ciclo se repete — tela branca ou loop infinito

O botao "Sair" esta no Sidebar, que so aparece para usuarios autenticados (`MainLayout`), entao o usuario nao consegue clicar nele.

## Solucao

### 1. Tratar token invalido no AuthContext

**Arquivo:** `src/contexts/AuthContext.tsx`

Adicionar tratamento no listener `onAuthStateChange` para o evento `TOKEN_REFRESHED` com erro, e tambem no fallback `getSession`:

- Quando `onAuthStateChange` dispara com evento `SIGNED_OUT` ou quando `getSession` retorna sessao `null`, chamar `supabase.auth.signOut()` para limpar tokens do localStorage
- Isso garante que tokens corrompidos sejam removidos e o usuario veja a tela de login limpa

### 2. Adicionar botao de logout na pagina de Auth (fallback)

**Arquivo:** `src/pages/Auth.tsx`

Adicionar uma verificacao: se o usuario chegou na pagina `/auth` mas ainda existem tokens no localStorage (sessao corrompida), mostrar um botao "Limpar sessao" ou fazer a limpeza automatica chamando `signOut()` ao montar o componente.

## Detalhes Tecnicos

No `AuthContext.tsx`, dentro do `useEffect`:

```
// Dentro do callback de onAuthStateChange
if (event === 'TOKEN_REFRESHED' && !session) {
  // Token refresh falhou - limpar estado corrompido
  supabase.auth.signOut();
}

// No fallback getSession
if (!session) {
  // Garantir limpeza de tokens invalidos
  supabase.auth.signOut();
}
```

No `Auth.tsx`, adicionar um `useEffect`:

```
// Limpar sessao corrompida ao chegar na pagina de login
useEffect(() => {
  supabase.auth.signOut();
}, []);
```

Isso e seguro porque se o usuario tem sessao valida, o redirect para `/` ja acontece antes.

## Impacto

- Resolve o problema do Deyvid imediatamente (ao abrir `/auth`, a sessao corrompida sera limpa)
- Previne que o mesmo problema aconteca com outros usuarios no futuro
- Nenhuma mudanca visual — apenas comportamento interno

