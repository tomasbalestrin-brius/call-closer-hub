

# Simplificar Dialog de Mentoria Extra

## O que muda

No arquivo `src/components/clients/MentoriaExtraDialog.tsx`, as opcoes do dropdown serao reduzidas de 9 opcoes para apenas 2:

**Antes (atual):**
- Mentoria Comercial, Marketing, Mindset, Vendas, Lideranca, Especial, Grupo, Individual, Outro

**Depois:**
- Mentoria Cleiton
- Mentoria Julia

## Campos do formulario

1. **Selecione a Mentoria** (dropdown) - apenas "Mentoria Cleiton" ou "Mentoria Julia"
2. **Data de Participacao** - campo de data (mantido)
3. **Observacoes** - campo de texto opcional (mantido)

O campo "Outro" com input customizado sera removido, pois nao e mais necessario.

## Detalhes tecnicos

**Arquivo**: `src/components/clients/MentoriaExtraDialog.tsx`

- Alterar o array `MENTORIA_OPTIONS` para conter apenas `['Mentoria Cleiton', 'Mentoria Julia']`
- Remover o bloco condicional `selectedMentoria === 'Outro'` e o estado `customMentoria`
- Simplificar a logica de submit removendo a verificacao de "Outro"

