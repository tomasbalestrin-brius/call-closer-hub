## Objetivo

Tornar o badge de status da call (Pendente / Follow-up / Propostas / Vendidas / Perdidas) **clicável e editável** diretamente no card, com os mesmos valores dos filtros da barra superior.

## Comportamento

- Hoje o badge de status é apenas visual em `CallCard.tsx`.
- Vou trocá-lo por um **dropdown (Select)** com as opções:
  - Pendente (`pendente`)
  - Em andamento (`em_andamento`)
  - Follow-up (`follow_up`)
  - Proposta enviada (`proposta_enviada`)
  - Vendido (`vendido`)
  - Perdido (`perdido`)
- Ao selecionar, faz `UPDATE` em `calls.status` via Supabase e atualiza a UI (invalidate da query de calls).
- Mantém as cores atuais de cada status no trigger do select.
- `stopPropagation` no clique para não abrir o `CallDetailDialog`.
- Caso o usuário escolha **Vendido**, abrir o `MarkAsSoldDialog` já existente (para capturar valor/entrada), em vez de marcar direto — mantém a coerência com o fluxo atual de venda.

## Permissões

- Closer pode alterar status das próprias calls (já coberto pelas RLS atuais de `calls`).
- Admin / Líder / Financeiro podem alterar qualquer call (idem RLS).
- Nenhuma mudança de RLS necessária.

## Arquivos afetados

- `src/components/calls/CallCard.tsx` — substituir o `<Badge>` de status por um `<Select>` estilizado com a mesma aparência, lidar com update e abrir `MarkAsSoldDialog` quando "Vendido".

Sem mudanças em banco, hooks ou tipos.
