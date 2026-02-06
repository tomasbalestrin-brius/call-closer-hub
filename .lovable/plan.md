

# Implementar PWA (Progressive Web App) no Bethel Closer

## O que vai mudar

O sistema poderá ser **instalado no celular** (ou desktop) como um aplicativo nativo, com ícone na tela inicial, carregamento rápido e funcionamento offline parcial.

## Etapas

### 1. Instalar o plugin `vite-plugin-pwa`
Adicionar a dependência que cuida automaticamente do service worker e do manifest.

### 2. Configurar o `vite.config.ts`
Integrar o plugin PWA com as seguintes configurações:
- Nome: "Bethel Closer"
- Tema escuro (cores do sistema atual)
- Ícones baseados no logo existente (`logo-bethel-closer.png`)
- Estratégia de cache "NetworkFirst" para APIs e "CacheFirst" para assets estáticos
- Registro automático do service worker

### 3. Adicionar meta tags PWA no `index.html`
- `theme-color` para a cor do sistema
- `apple-mobile-web-app-capable` e `apple-mobile-web-app-status-bar-style` para iOS
- Link para o ícone Apple Touch

### 4. Criar ícones PWA
Gerar os tamanhos necessários (192x192 e 512x512) a partir do logo existente, usando o próprio `logo-bethel-closer.png` como base.

### 5. Criar página `/install` 
Uma página dedicada com:
- Instruções visuais de como instalar o app
- Botão "Instalar" que dispara o prompt nativo do navegador (quando disponível)
- Instruções específicas para iOS (Compartilhar > Adicionar a Tela de Início)
- Instruções para Android (menu do navegador)
- Detecção automática se o app já está instalado

### 6. Adicionar rota `/install` no `App.tsx`
Registrar a nova página no roteador.

## Resultado Final

- O app aparecerá com a opção "Instalar" no navegador
- No celular, terá ícone na tela inicial como um app nativo
- Carregamento mais rápido com cache de assets
- Página `/install` com guia visual para instalação

---

## Detalhes Técnicos

### `vite.config.ts` - Configuracao do plugin

```typescript
import { VitePWA } from 'vite-plugin-pwa';

// Adicionado ao array de plugins:
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['logo-bethel-closer.png', 'favicon.ico'],
  manifest: {
    name: 'Bethel Closer',
    short_name: 'Bethel',
    description: 'Sistema de gestao de calls e clientes para closers',
    theme_color: '#1a1a2e',
    background_color: '#1a1a2e',
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/',
    icons: [
      { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*supabase.*\/rest\/v1\/.*/i,
        handler: 'NetworkFirst',
        options: { cacheName: 'api-cache', expiration: { maxEntries: 50, maxAgeSeconds: 300 } }
      }
    ]
  }
})
```

### `index.html` - Meta tags adicionais

```html
<meta name="theme-color" content="#1a1a2e" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<link rel="apple-touch-icon" href="/logo-bethel-closer.png" />
```

### Nova pagina: `src/pages/Install.tsx`

Componente React com:
- Hook `useEffect` para capturar o evento `beforeinstallprompt`
- Botao que chama `prompt()` no evento capturado
- Deteccao de plataforma (iOS vs Android vs Desktop)
- Instrucoes visuais com icones do Lucide
- Verificacao se ja esta no modo standalone

### Arquivos criados/modificados

| Arquivo | Acao |
|---------|------|
| `package.json` | Adicionar `vite-plugin-pwa` |
| `vite.config.ts` | Configurar plugin PWA |
| `index.html` | Adicionar meta tags PWA |
| `public/pwa-192x192.png` | Icone PWA 192x192 (copia do logo) |
| `public/pwa-512x512.png` | Icone PWA 512x512 (copia do logo) |
| `src/pages/Install.tsx` | Pagina de instalacao |
| `src/App.tsx` | Adicionar rota `/install` |
