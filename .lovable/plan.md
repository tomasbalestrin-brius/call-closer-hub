
# Simplificar Cards de Ofertas por Produto

## O que sera feito

Alterar o subtitle dos 4 cards de produto para mostrar apenas:
- **Calls**: numero de ofertas (que ja e o valor principal do card)
- **Vendas**: numero de vendas daquele produto
- **Taxa de conversao**: vendas / ofertas em percentual

## Alteracao

**Arquivo**: `src/pages/Dashboard.tsx` (linhas 244-272)

Trocar o subtitle complexo atual por um formato limpo:

```
"X calls | Y vendas | Z% conversão"
```

Onde:
- X = `offersByProduct.{produto}` (ofertas/calls daquele produto)
- Y = `salesByProduct.{produto}` (vendas daquele produto)  
- Z = `(salesByProduct / offersByProduct) * 100`

Exemplo para Elite Premium:
```typescript
subtitle={`${stats.offersByProduct.elitePremium} calls | ${stats.salesByProduct.elitePremium} vendas | ${stats.offersByProduct.elitePremium > 0 ? Math.round((stats.salesByProduct.elitePremium / stats.offersByProduct.elitePremium) * 100) : 0}% conversão`}
```

Mesma logica para os outros 3 cards (Implementacao Comercial, Mentoria Premium Julia, Implementacao de IA).
