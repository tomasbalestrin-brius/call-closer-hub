
# Problema identificado: As calls estão sendo salvas corretamente

## Diagnóstico real

As calls analisadas manualmente **existem no banco de dados** e estão corretas:
- Rodrigo → Leandro (19/02)
- Marcos → Julia (19/02)
- Dayane → Julia (19/02)
- Carolina → Julia (19/02)

O problema é de **experiência de uso, não de bug técnico**. A tela de Calls mostra por padrão as calls do usuário logado (o admin). Calls criadas para outros closers exigem que o admin selecione o closer no dropdown "Selecione um closer".

Após fechar o diálogo de análise manual, o admin continua vendo suas próprias calls (vazias, pois o admin não faz calls), sem nenhuma indicação de onde ver a call criada.

## O que será corrigido

### 1. Feedback pós-análise no `ManualAnalysisDialog`

Após a análise ser concluída com sucesso, exibir:
- Nome do closer selecionado no toast de sucesso
- Instrução clara: "Para ver a call, selecione [Nome do Closer] no filtro de closers na tela de Calls"

### 2. Auto-seleção do closer na tela de Calls

Após o `onAnalysisComplete()` ser chamado, o sistema passará o `closerId` do closer selecionado para que a tela de Calls mude automaticamente o filtro e mostre as calls daquele closer — sem o admin precisar selecionar manualmente.

Para isso:
- `ManualAnalysisDialog` receberá um novo callback `onAnalysisComplete(closerId: string)`
- A tela `Calls.tsx` usará esse `closerId` para setar o `selectedCloserId` automaticamente

## Arquivos a editar

| Arquivo | Mudança |
|---------|---------|
| `src/components/admin/ManualAnalysisDialog.tsx` | Callback `onAnalysisComplete(closerId)` + toast com nome do closer |
| `src/pages/Calls.tsx` | Receber `closerId` no callback e setar `selectedCloserId` automaticamente |

## Impacto esperado

Após analisar uma call do closer "Leandro", a tela de Calls vai automaticamente mostrar as calls do Leandro — sem o admin precisar usar o dropdown manualmente.
