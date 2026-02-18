
# Agrupar erros duplicados no painel de logs

## O que muda

Na secao "Erros do Sistema", em vez de mostrar uma linha para cada ocorrencia do mesmo erro, os logs serao agrupados por chave unica (combinacao de `fileId` + `error_message` + `user_id` + `service`). Cada linha agrupada mostrara:

- **Data**: data e horario da ultima ocorrencia
- **Ocorrencias**: badge com o numero de vezes que o erro aconteceu (ex: "x3")
- Os demais campos (nivel, servico, usuario, mensagem, acoes) permanecem iguais

Erros de calls diferentes continuam aparecendo como linhas separadas. Apenas erros repetidos da mesma call/arquivo sao agrupados.

## Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `src/components/admin/ErrorLogsPanel.tsx` | Adicionar logica de agrupamento e exibir contagem |

### Logica de agrupamento

Apos filtrar `unresolvedErrors`, agrupar por uma chave composta:

```
chave = `${fileId || 'no-file'}_${error_message}_${user_id}_${service}`
```

Para cada grupo:
- Manter o log mais recente (maior timestamp) como representante
- Contar o numero total de ocorrencias
- Guardar o `fileId` do representante para a acao de reanalisar

### Mudancas na tabela

- Nova coluna "Qtd" entre "Data" e "Nivel"
- Quando a contagem for maior que 1, exibir um badge com "x{count}" (ex: "x5")
- Quando for 1, exibir apenas "-" ou nada
- A contagem total no titulo "Erros do Sistema" passara a mostrar o numero de grupos unicos, nao o total de logs

### Mesma logica para "Calls Rejeitadas por Qualidade"

Aplicar o mesmo agrupamento na secao de quality rejections, usando `fileId` como chave, mostrando contagem e data da ultima ocorrencia.
