

# Forcar atualizacao automatica do PWA

## Problema

Usuarios ficam presos em versoes antigas do app por causa do cache do Service Worker do PWA. Isso causa tela branca e erros mesmo apos publicar correcoes.

## Solucao

Criar um componente `PWAUpdatePrompt` que detecta quando existe uma nova versao do Service Worker e forca o reload automaticamente. Tambem ajustar a configuracao do Workbox para garantir que o `skipWaiting` seja chamado imediatamente.

## Alteracoes

### 1. Atualizar `vite.config.ts` - Configuracao do Workbox

Adicionar `skipWaiting: true` e `clientsClaim: true` na configuracao do Workbox. Isso faz com que o novo Service Worker tome controle imediatamente sem esperar o usuario fechar todas as abas.

### 2. Criar `src/components/PWAUpdatePrompt.tsx`

Componente que:
- Escuta o evento `controllerchange` do Service Worker (indica que um novo SW assumiu controle)
- Quando detecta uma atualizacao, faz `window.location.reload()` automaticamente
- Exibe um toast rapido avisando "Atualizando..." antes do reload

### 3. Adicionar o componente no `App.tsx`

Montar o `PWAUpdatePrompt` no nivel raiz do app para que esteja sempre ativo.

## Detalhes tecnicos

```text
Fluxo de atualizacao:
  1. Deploy novo publicado
  2. Service Worker detecta nova versao
  3. skipWaiting: true -> novo SW ativa imediatamente
  4. Evento "controllerchange" dispara
  5. PWAUpdatePrompt detecta e faz reload
  6. Usuario ve a versao atualizada
```

### Codigo do componente (resumo)

```tsx
// PWAUpdatePrompt.tsx
useEffect(() => {
  let refreshing = false;
  const onControllerChange = () => {
    if (refreshing) return;
    refreshing = true;
    toast.info('Atualizando para nova versão...');
    setTimeout(() => window.location.reload(), 500);
  };
  navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange);
  return () => navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange);
}, []);
```

### Workbox config (resumo)

```ts
workbox: {
  skipWaiting: true,
  clientsClaim: true,
  // ... existing config
}
```

## Resultado

Nenhum usuario ficara mais preso em uma versao antiga. Toda vez que uma nova versao for publicada, o app recarrega automaticamente em segundos.
