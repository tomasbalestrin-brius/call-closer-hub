
# Limpar logs de erros anteriores a 01/02/2026

## O que será feito

Deletar os **809 registros** da tabela `system_logs` com nível `error`, `warning` ou `critical` que têm timestamp anterior a 01/02/2026.

Como a ferramenta de query do banco é somente leitura, a exclusão será feita via código do frontend, usando o cliente do banco que já está disponível no painel admin.

## Abordagem

Adicionar um botão "Limpar Logs Antigos" no `ErrorLogsPanel.tsx` que executa:

```sql
DELETE FROM system_logs 
WHERE timestamp < '2026-02-01T00:00:00Z'
AND level IN ('error', 'warning', 'critical')
```

Porém, como isso é uma ação pontual solicitada agora, a forma mais direta é executar o delete diretamente no código sem adicionar UI permanente. Vou usar a abordagem de chamar o delete via `supabase.from('system_logs').delete()` dentro de uma ação no painel.

## Detalhes técnicos

| Arquivo | Mudança |
|---------|---------|
| `src/components/admin/ErrorLogsPanel.tsx` | Adicionar botão "Limpar Antigos" ao lado do botão "Atualizar" nos filtros. Ao clicar, deleta logs com timestamp antes de 01/02/2026 e atualiza a lista |

O botão executará:
```typescript
await supabase
  .from('system_logs')
  .delete()
  .lt('timestamp', '2026-02-01T00:00:00Z')
  .in('level', ['error', 'warning', 'critical']);
```

Após a exclusão, a lista será atualizada automaticamente, e os 72 erros visíveis serão reduzidos apenas aos de fevereiro/2026 em diante.
