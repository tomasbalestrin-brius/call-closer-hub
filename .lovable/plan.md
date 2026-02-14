

# Adicionar edicao completa de leads no CRM Intensivo

## O que muda

Cada card de lead no Kanban do Intensivo ganhara um botao de edicao (icone de lapis) ao lado do botao de excluir, no canto superior direito. Ao clicar, abre um dialog com todos os campos editaveis do lead.

## Campos editaveis no dialog

- Nome
- Telefone
- Email
- Empresa
- Nicho
- Temperatura do lead (quente/morno/frio)
- Origem (source)
- Observacoes (notes)

## Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `src/components/intensivo/IntensiveLeadCard.tsx` | Adicionar prop `onEdit`, botao com icone `Pencil` ao lado do `Trash2`, com `stopPropagation` |
| `src/components/intensivo/EditIntensiveLeadDialog.tsx` | **Novo arquivo** - Dialog com formulario para editar todos os campos do lead, usando o `updateLead` do hook |
| `src/components/intensivo/IntensiveKanban.tsx` | Passar callback `onEdit` para o card, e gerenciar estado do dialog de edicao |

### IntensiveLeadCard.tsx

- Nova prop: `onEdit?: (lead: IntensiveLead) => void`
- Botao `Pencil` (ghost, icon, 6x6) entre o badge de temperatura e o botao de excluir
- `e.stopPropagation()` para nao abrir o detalhe

### EditIntensiveLeadDialog.tsx (novo)

- Recebe `lead`, `open`, `onOpenChange`, `editionId`
- Formulario com `Input` para nome, telefone, email, empresa, nicho
- `Select` para temperatura (quente/morno/frio)
- `Input` para origem
- `Textarea` para observacoes
- Botoes Cancelar e Salvar
- Usa `updateLead.mutateAsync` do `useIntensivoCRM`
- Estado local inicializado com os valores atuais do lead

### IntensiveKanban.tsx

- Novo estado: `editingLead` para controlar qual lead esta sendo editado
- Passa `onEdit={(lead) => setEditingLead(lead)}` para cada `IntensiveLeadCard`
- Renderiza `EditIntensiveLeadDialog` com o lead selecionado

