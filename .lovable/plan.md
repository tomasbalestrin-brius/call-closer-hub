

# Otimizacao de Performance de Carregamento

## Resumo

Tres ajustes cirurgicos para eliminar redundancias que impactam o tempo de carregamento inicial da aplicacao, sem alterar design ou funcionalidade.

---

## 1. Remover double lazy-load do Dashboard

**Problema:** `App.tsx` carrega `Index.tsx` via lazy, que por sua vez faz outro `lazy()` para carregar `Dashboard.tsx`. Isso cria uma cadeia desnecessaria: JS parse -> Index.tsx -> novo chunk request -> Dashboard.tsx.

**Solucao:** Importar `Dashboard` diretamente no `Index.tsx` em vez de usar `lazy()` novamente, ja que `Index.tsx` ja e lazy-loaded pelo `App.tsx`.

**Arquivo:** `src/pages/Index.tsx`
- Remover `lazy` e `Suspense` imports
- Importar `Dashboard` com import estatico
- Renderizar `<Dashboard />` diretamente

---

## 2. Remover query duplicada no CacheWarmer

**Problema:** O componente `CacheWarmer` em `App.tsx` faz `prefetchQuery` para `['user-role', user.id]`, mas o `UserRoleContext` ja faz exatamente essa mesma query (`user_roles` com `eq('user_id', user.id)`). Isso gera uma requisicao duplicada ao banco na inicializacao.

**Solucao:** Remover o prefetch de `user-role` do `CacheWarmer`, mantendo apenas o prefetch de `daily-verse` que nao e duplicado.

**Arquivo:** `src/App.tsx`
- Remover o bloco `prefetchQuery` de `user-role`
- Manter o prefetch de `daily-verse`

---

## 3. Unificar caminho da imagem do logo

**Problema:** O Sidebar e Auth importam o logo via `import logo from '@/assets/logo-bethel-closer.png'`, o que inclui a imagem no bundle JS (base64 ou hash separado). A mesma imagem ja existe em `/public/logo-bethel-closer.png` e e pre-carregada pelo HTML.

**Solucao:** Usar o caminho publico `/logo-bethel-closer.png` diretamente, evitando que o bundler processe a imagem novamente.

**Arquivos:**
- `src/components/layout/Sidebar.tsx` - Remover `import logo` e usar `"/logo-bethel-closer.png"` no `src`
- `src/pages/Auth.tsx` - Mesmo ajuste

---

## Impacto Esperado

- Elimina 1 request extra na cadeia de carregamento (double lazy)
- Elimina 1 query duplicada ao banco de dados no login
- Reduz o tamanho do bundle JS removendo a imagem do pipeline de assets

