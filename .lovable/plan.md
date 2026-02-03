

# Plano: Ocultar Módulos de Closer para Usuário Admin

## Objetivo

Remover os módulos **Calls**, **CRM Calls** e **CRM Intensivo** do menu lateral para usuários com role `admin`. Estes módulos são específicos para closers e líderes que realizam operações de vendas.

## Lógica Atual

O sidebar atualmente funciona assim:

```
baseNavigation (todos os usuários)
+ leaderNavigation (líderes e admins)
+ adminNavigation (apenas admins)
```

## Nova Lógica

Será reestruturado para:

```
Se admin:
  → Navegação administrativa (sem Calls, CRM Calls, CRM Intensivo)
Senão:
  → Navegação base completa
  → + leaderNavigation se for líder ou admin
```

## Itens do Menu por Role

| Item | Admin | Líder | Closer |
|------|-------|-------|--------|
| Dashboard | Sim | Sim | Sim |
| Calls | **Não** | Sim | Sim |
| CRM Calls | **Não** | Sim | Sim |
| CRM Intensivo | **Não** | Sim | Sim |
| Carteira | Sim | Sim | Sim |
| Notificações | Sim | Sim | Sim |
| Configurações | Sim | Sim | Sim |
| Relatórios | Sim | Sim | Não |
| Ver Time | Sim | Sim | Não |
| Admin | Sim | Não | Não |

## Seção Técnica

### Alteração no Arquivo `src/components/layout/Sidebar.tsx`

Modificar a construção do array `navigation` para filtrar itens baseado no role:

```tsx
// Itens que admin NÃO deve ver (específicos de operação de closer)
const closerOnlyItems = ['/calls', '/clients', '/intensivo-crm'];

// Navegação base filtrada para admin
const getBaseNavigation = (isAdmin: boolean) => {
  if (isAdmin) {
    return baseNavigation.filter(item => !closerOnlyItems.includes(item.href));
  }
  return baseNavigation;
};

// Construir navegação final
const navigation = [
  ...getBaseNavigation(isAdmin),
  ...(isAdmin || isLeader ? leaderNavigation : []),
  ...(isAdmin ? adminNavigation : []),
];
```

## Resultado Esperado

Para usuário **admin**, o menu lateral mostrará:
- Dashboard
- Carteira
- Notificações
- Configurações
- Relatórios
- Ver Time
- Admin

**Não aparecerão:** Calls, CRM Calls, CRM Intensivo

## Impacto

| Item | Impacto |
|------|---------|
| Funcionalidade | Apenas visual - rotas continuam acessíveis via URL |
| Segurança | Mantida (RLS protege dados) |
| Outros usuários | Sem alteração |

