## Diagnóstico

As 3 calls da Kauana mostradas no print foram **importadas e analisadas**, mas o resultado da IA voltou praticamente vazio:

| Campo | Valor retornado pela IA |
|---|---|
| `nome_lead` | `"nao_informado"` → vira `"Lead - 2026-05-19"` |
| `nota_geral` | `0` → mostra `0/10` e classifica como `Iniciante` |
| `nome_closer` | `"nao_informado"` |
| `houve_venda` | `"nao_informado"` |
| `analise_por_etapa` | vazio → preenchido com defaults |
| `framework_selecionado` | OK (`Mentoria Julia Ottoni` / `Lentes Dentais`) |
| `ai_summary` | uma frase curta tipo "Tomador de decisão ausente..." |

Ou seja, a IA "saiu cedo" — devolveu um JSON com framework + uma justificativa e nada mais. O código aceitou esse retorno como sucesso (`analyzed_at` preenchido, `imported_files.status = 'success'`), salvou no banco e marcou o card como analisado (100%).

As outras calls da plataforma (Rusalen, Jose, Giovanna, Pamella, Lucas) vieram corretas — confirmando que o bug não é do prompt em si, mas da **falta de validação** do retorno da IA antes de persistir.

## Causa raiz

`supabase/functions/analyze-call/index.ts` aceita qualquer JSON parseável, mesmo quando:
- `identificacao.nome_lead === "nao_informado"` E
- `nota_geral === 0` E
- `analise_por_etapa` vem vazio

`supabase/functions/import-and-analyze/index.ts` então salva e marca como sucesso, escondendo o problema do usuário.

## Plano de correção

### 1. Validação de qualidade no `analyze-call` (servidor)
Após o parse, calcular um `analysis_quality_score` simples:
- nome_lead informado: +1
- nome_closer informado: +1
- houve_venda definido (sim/nao): +1
- nota_geral entre 1 e 10: +2
- pelo menos 4 etapas com `aconteceu=sim`: +2
- dados_extraidos com nicho OU faturamento: +1

Se score < 3 → tratar como **falha de análise** e:
- Retornar HTTP 422 com `{ error: "low_quality_analysis", raw: data }` (ou)
- Tentar uma única reanálise automática com prompt reforçado ("seu retorno anterior veio vazio, refaça extraindo nome do lead, nota e etapas")

### 2. Tratamento no `import-and-analyze`
- Ao receber 422 da análise: marcar `imported_files.status = 'error'` com `error_message = "Análise retornou vazia — clique em Reanalisar"` e **não** criar a call (ou criar com flag `needs_reanalysis`).
- Manter o file_id ligado ao registro de erro para permitir retry sem reimportar.

### 3. Limpar as 3 calls quebradas atuais (Kauana)
Opções (a escolher):
- **a.** Apagar as 3 e marcar `imported_files` correspondentes como `pending` para reimportar.
- **b.** Apenas disparar reanálise (`reanalyze-call`) nas 3 — mantém histórico de import.

### 4. UI — feedback visível
No `CallCard`, quando `score === 0 && client_name LIKE 'Lead -%'`:
- Mostrar badge laranja "Análise incompleta" no topo
- Adicionar item "Reanalisar" no menu (já existe `reanalyze-call`, só plugar)

### 5. Botão "Reanalisar" no menu da call (`CallCardMenu.tsx`)
Item visível para Admin/Leader/dono da call. Chama `supabase.functions.invoke('reanalyze-call', { body: { callId } })` e invalida a query.

## Perguntas antes de implementar

1. **Para as 3 calls já quebradas da Kauana**: prefere (a) apagar e reimportar do Drive ou (b) só rodar reanálise mantendo o registro?
2. **Quando a IA retornar análise pobre**: prefere (a) retry automático 1x e se falhar marcar como erro, ou (b) já marcar como erro direto e deixar reanálise manual?
3. **Botão Reanalisar no card**: ok adicionar para todos os admins/leaders e para o próprio closer dono da call?
