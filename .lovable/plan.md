
# Reanalisar Calls de Deyvid e Leandro com Framework Incorreto

## Problema Identificado

Foram encontradas **8 calls** de Deyvid e Leandro que foram analisadas usando o framework "Mentoria Julia Ottoni", o que viola a regra de negocio (esses closers NUNCA devem usar esse framework).

| Data | Cliente | Closer |
|------|---------|--------|
| 12/02 | Heverton Santos | Leandro |
| 11/02 | Anselmo Pereira Lemos | Leandro |
| 10/02 | Alana Schapach | Leandro |
| 10/02 | Joao Vitor Oselame | Leandro |
| 09/02 | VERDE PHARMA | Leandro |
| 07/02 | Felicita Nathalia | Deyvid |
| 07/02 | Rodrigo Facundes Dantas | Leandro |
| 03/02 | Beatriz Lorraine | Deyvid |

## Solucao

Chamar a edge function `batch-reanalyze` (ou `reanalyze-call` individualmente) para reanalisar essas 8 calls. Como as regras de prioridade ja foram implementadas no `analyze-call`, a reanalise vai automaticamente aplicar o framework correto (Elite Premium, Impl. Comercial ou Impl. IA) e bloquear Mentoria Julia Ottoni.

### Passo a passo

1. Invocar `reanalyze-call` para cada uma das 8 calls identificadas
2. A edge function `analyze-call` ja contem as regras de prioridade que impedem o uso de "Mentoria Julia Ottoni" para Deyvid e Leandro
3. Cada call sera reanalisada com o framework correto baseado na transcricao

### Detalhes tecnicos

- Nenhuma mudanca de codigo necessaria (as regras ja estao implementadas)
- Apenas execucao das reanalises via chamada a edge function existente
- IDs das calls a reanalisar:
  - `65dc9225-b2a1-47dd-85b3-bf91de67360f`
  - `168f274d-a6fd-4264-b61f-97f13f82000b`
  - `6d024612-edb7-4890-b3e7-a0bd8103f9a5`
  - `0bf12bf4-bd73-4bbf-868b-e690aeca93a7`
  - `615f97c3-a793-4f1a-8369-00ef319cc443`
  - `9423b59f-cf5b-46b9-9289-437033e1aa72`
  - `1470fd56-4e54-42ab-b667-bdc25c012233`
  - `700c32a0-f019-41b3-bafc-04302ab8d5dc`
