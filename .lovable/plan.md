

# Adicionar botao de excluir lead no card do CRM Intensivo

## O que muda

Cada card de lead no CRM Intensivo ganhara um botao "X" (ou lixeira) no canto superior direito. Ao clicar, aparece um dialogo de confirmacao antes de excluir o lead permanentemente daquela edicao.

## Como funciona

- O botao fica posicionado no canto superior direito do card, ao lado do badge de temperatura
- Clicar no botao abre um `AlertDialog` perguntando "Tem certeza que deseja excluir este lead?"
- Confirmar chama o `deleteLead` que ja existe no hook `useIntensivoCRM`
- O clique no botao nao abre o detalhe do lead (usa `stopPropagation`)

## Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `src/components/intensivo/IntensiveLeadCard.tsx` | Adicionar prop `onDelete`, botao com icone `Trash2` no canto, e `AlertDialog` de confirmacao |
| `src/components/intensivo/IntensiveKanban.tsx` | Passar callback `onDelete` para o `IntensiveLeadCard`, chamando `deleteLead.mutateAsync(lead.id)` |

### IntensiveLeadCard.tsx

1. Adicionar props: `onDelete?: (id: string) => void`
2. Importar `Trash2` do lucide-react, e `AlertDialog` components
3. Estado local `confirmOpen` para o dialogo
4. Botao pequeno (ghost, icon) no header do card, ao lado do badge de temperatura
5. AlertDialog com titulo "Excluir Lead", descricao "Tem certeza? Esta acao nao pode ser desfeita.", botoes Cancelar/Excluir

### IntensiveKanban.tsx

1. Extrair `deleteLead` do hook `useIntensivoCRM`
2. Passar `onDelete={(id) => deleteLead.mutateAsync(id)}` para cada `IntensiveLeadCard`

