

# Virtualizacao da StudentList com @tanstack/react-virtual

## Resumo

Substituir a renderizacao completa de todos os cards na StudentList por uma lista virtualizada usando `@tanstack/react-virtual`. Apenas os cards visiveis no viewport serao montados no DOM, reduzindo drasticamente o trabalho do browser quando a lista tem dezenas ou centenas de alunos.

---

## Mudancas

### 1. Instalar dependencia

- Adicionar `@tanstack/react-virtual` ao projeto

### 2. Modificar `src/components/portfolio/StudentList.tsx`

- Importar `useVirtualizer` de `@tanstack/react-virtual`
- Criar um `ref` para o container scrollavel com altura fixa (ex: `calc(100vh - 400px)` via `max-h` + `overflow-y-auto`)
- Configurar o virtualizer:
  - `count`: `students.length`
  - `getScrollElement`: retorna o container ref
  - `estimateSize`: `() => 108` (altura estimada de cada card ~96px + 12px gap)
  - `overscan`: 3 (renderiza 3 cards extras acima/abaixo do viewport para scroll suave)
- Renderizar um div interno com `height` = `totalSize` do virtualizer
- Mapear `virtualizer.getVirtualItems()` em vez de `students.map()`, posicionando cada card com `position: absolute` + `transform: translateY()`
- Remover o `contentVisibility: auto` do StudentCard (nao e mais necessario com virtualizacao real)

### 3. Ajustar `src/components/portfolio/StudentCard.tsx`

- Remover a prop `style={{ contentVisibility: 'auto', containIntrinsicSize: '0 280px' }}` do Card, pois a virtualizacao ja cuida de nao renderizar cards fora do viewport

---

## Detalhes tecnicos

### Estrutura do virtualizer

```text
<div ref={parentRef} style={{ maxHeight: 'calc(100vh - 400px)', overflowY: 'auto' }}>
  <div style={{ height: totalSize, position: 'relative' }}>
    {virtualItems.map(virtualRow => (
      <div
        key={students[virtualRow.index].id}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          transform: `translateY(${virtualRow.start}px)`,
        }}
        ref={virtualRow.measureElement}  // medicao dinamica
      >
        <StudentCard ... />
      </div>
    ))}
  </div>
</div>
```

### Medicao dinamica

Usar `measureElement` em vez de tamanho fixo para lidar com cards de alturas diferentes (mobile vs desktop, badges extras, etc). O `estimateSize` de 108px serve apenas como estimativa inicial.

### Overscan

`overscan: 3` garante que 3 cards extras sao renderizados acima e abaixo da area visivel, evitando flash branco durante scroll rapido.

---

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `package.json` | Adicionar `@tanstack/react-virtual` |
| `src/components/portfolio/StudentList.tsx` | Implementar virtualizacao com useVirtualizer |
| `src/components/portfolio/StudentCard.tsx` | Remover contentVisibility/containIntrinsicSize |

