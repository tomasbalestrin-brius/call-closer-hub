

# Impacto da Integração WhatsApp na Estrutura Atual

## Resumo

A integração é **aditiva** — não altera funcionalidades existentes, apenas adiciona novos módulos. O impacto no código atual é mínimo.

## O que NÃO muda

- Dashboard, Calls, CRM, Portfolio, Intensivo — permanecem intactos
- Autenticação, roles, RLS existentes — sem alteração
- Edge functions atuais — sem modificação
- Tipos existentes em `src/types/index.ts` — sem quebra

## O que é ADICIONADO (novo)

| Camada | Itens novos |
|--------|------------|
| **Banco de dados** | 2 tabelas novas (`whatsapp_conversations`, `whatsapp_messages`) + Realtime habilitado nelas |
| **Edge Functions** | 2 novas (`whatsapp-send`, `whatsapp-webhook`) |
| **Secrets** | 3 novos (`NEXTTRACK_JWT_TOKEN`, `NEXTTRACK_INSTANCE_ID`, `NEXTTRACK_API_BASE`) |
| **Páginas** | 1 nova rota `/chat` com componente `Chat.tsx` |
| **Componentes** | ~5 novos em `src/components/chat/` (layout, lista, mensagens, input, header) |
| **Hooks** | 1-2 novos (`useWhatsAppMessages`, `useConversations`) |
| **Types** | Novos tipos de WhatsApp (podem ficar em `src/types/whatsapp.ts`) |

## O que é MODIFICADO (pequenas alterações)

Apenas **3 arquivos existentes** precisam de edição mínima:

1. **`src/App.tsx`** — Adicionar 1 rota: `<Route path="/chat" element={<Chat />} />`
2. **`src/components/layout/Sidebar.tsx`** — Adicionar 1 item no menu de navegação (ícone MessageCircle, link `/chat`) + badge de não lidas
3. **`src/components/clients/ClientCardMenu.tsx`** — Trocar o link `wa.me/...` por navegação interna para `/chat?phone=...` (opcional, pode ser feito na Fase 3)

## Riscos

- **Nenhum risco de quebra** — são adições isoladas
- **Performance**: o Realtime adiciona 2 subscriptions, mas é leve
- **Bundle size**: a nova página é lazy-loaded, não impacta carregamento inicial

## Dependências externas

- API NextTrack precisa estar acessível e com webhook configurado
- Tokens da NextTrack precisam ser mantidos válidos

