

# Correcao: Tela branca no Dashboard do Deyvid

## Problema

O usuario Deyvid tem `closer_level = 'lider'` no banco de dados, mas o componente `DashboardHeader.tsx` so reconhece 7 niveis no mapa `LEVEL_CONFIG`:

- assessor, executivo, pro, elite, especialista, especialista_pro, especialista_elite

Como `'lider'` nao existe nesse mapa, `LEVEL_CONFIG['lider']` retorna `undefined`, e ao tentar acessar `.color`, o React lanca um `TypeError` e a pagina inteira fica branca.

## Solucao

### Arquivo: `src/components/dashboard/DashboardHeader.tsx`

1. Adicionar `'lider'` ao tipo `CloserLevel` e ao mapa `LEVEL_CONFIG` com um label e cor apropriados (ex: "Lider", cor azul-indigo)

2. Adicionar fallback defensivo para niveis desconhecidos, evitando que qualquer valor inesperado cause crash:

```tsx
const levelConfig = LEVEL_CONFIG[closerLevel] || { label: closerLevel, color: 'bg-gray-500' };
```

Isso resolve o crash imediato do Deyvid e previne que qualquer novo nivel nao mapeado quebre a pagina no futuro.

## Detalhes Tecnicos

- O tipo `CloserLevel` sera expandido para incluir `'lider'`
- O `LEVEL_CONFIG` recebera a entrada: `lider: { label: 'Lider', color: 'bg-indigo-500' }`
- A linha que acessa `LEVEL_CONFIG[closerLevel]` tera um fallback com `||` para nunca retornar `undefined`
- Nenhuma alteracao de banco de dados necessaria

