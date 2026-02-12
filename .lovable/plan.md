

# Mostrar lideres no seletor de Closer (visao admin)

## Resumo

No dropdown "Selecionar Closer" da pagina SquadView, atualmente so aparecem usuarios com role `closer`. Para o admin, todos os usuarios que nao sao admin devem aparecer (closers e lideres).

## Mudanca

**Arquivo:** `src/pages/SquadView.tsx` (linha 117)

Alterar o filtro final da query de membros:

**Antes:**
```text
.filter(m => m.role === 'closer');
```

**Depois:**
```text
.filter(m => m.role !== 'admin');
```

Isso inclui tanto closers quanto lideres no dropdown, excluindo apenas outros admins.

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/SquadView.tsx` | Alterar filtro de `=== 'closer'` para `!== 'admin'` na linha 117 |
