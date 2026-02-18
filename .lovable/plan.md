

# Nova aba "Calls Muito Curtas" no painel de logs

## O que muda

O painel de logs passara a ter 3 abas em vez de 2:

1. **Erros Pendentes** - erros do sistema (sem as calls muito curtas com menos de 300 chars)
2. **Calls Muito Curtas** (nova) - logs de quality_rejection onde `content_length < 300`
3. **Arquivos Resolvidos** - mantido como esta

## Logica de separacao

- Logs com `operation === 'quality_rejection'` e `content_length < 300` vao para a nova aba "Calls Muito Curtas"
- Logs com `operation === 'quality_rejection'` e `content_length >= 300` permanecem em "Erros Pendentes" (na secao de Calls Rejeitadas por Qualidade)
- Demais erros continuam em "Erros Pendentes"

## Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `src/components/admin/ErrorLogsPanel.tsx` | Adicionar nova aba, ajustar filtros de logs |

### Mudancas no ErrorLogsPanel.tsx

1. Criar filtro `shortCalls` a partir dos `unresolvedLogs`:
   - `operation === 'quality_rejection'` E `content_length < 300`

2. Ajustar `unresolvedQuality` para mostrar apenas os que tem `content_length >= 300`

3. Adicionar nova `TabsTrigger` com icone `FileX` e contagem de calls muito curtas

4. Adicionar nova `TabsContent` com tabela mostrando: Data, Arquivo, Usuario, Chars (atual / minimo)

5. Atualizar contagem de "Erros Pendentes" para excluir as calls muito curtas

