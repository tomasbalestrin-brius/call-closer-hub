
# Melhorias no CRM Intensivo, Carteira, Dashboard e UX

## 1. Drag-and-drop do CRM Intensivo (alinhamento com CRM Calls)

O CRM Intensivo ja possui drag-and-drop funcional no `IntensiveKanban.tsx`. Porem, falta a logica de **prevencao de clique apos arraste** que o CRM Calls implementa usando `isDraggingRef` + `setTimeout`. Vou aplicar o mesmo padrao:

**Arquivo:** `src/components/intensivo/IntensiveKanban.tsx`
- Adicionar `isDraggingRef` (useRef) para rastrear estado de arraste
- No `handleDragStart`, setar `isDraggingRef.current = true`
- No `handleDragEnd`, usar `setTimeout(() => { isDraggingRef.current = false }, 0)`
- Envolver cada card em um wrapper `<div>` com `draggable`, `onDragStart`, `onDragEnd`, e `onClick` que verifica `isDraggingRef` antes de permitir navegacao
- Remover os props `onDragStart`/`onDragEnd`/`draggable` do `IntensiveLeadCard` (movendo para o wrapper)

**Arquivo:** `src/components/intensivo/IntensiveLeadCard.tsx`
- Remover props `onDragStart`, `onDragEnd`, `isDragging`, `draggable` do componente
- Simplificar para ser apenas um card de exibicao (sem logica de drag)

---

## 2. Sistema de Tags: Lead Quente, Morno e Frio

### 2.1 Migracao de banco de dados

Adicionar coluna `lead_temperature` na tabela `intensive_leads`:
```sql
ALTER TABLE intensive_leads 
ADD COLUMN lead_temperature text DEFAULT 'morno' 
CHECK (lead_temperature IN ('quente', 'morno', 'frio'));
```

### 2.2 Alteracoes no tipo TypeScript

**Arquivo:** `src/types/intensivo.ts`
- Adicionar tipo `LeadTemperature = 'quente' | 'morno' | 'frio'`
- Adicionar campo `lead_temperature` na interface `IntensiveLead`

### 2.3 Exibicao no card

**Arquivo:** `src/components/intensivo/IntensiveLeadCard.tsx`
- Exibir badge colorido com a temperatura:
  - Quente: vermelho/laranja com icone Flame
  - Morno: amarelo com icone Thermometer
  - Frio: azul com icone Snowflake

### 2.4 Filtro de temperatura

**Arquivo:** `src/pages/IntensivoCRM.tsx`
- Adicionar state `temperatureFilter` ('all' | 'quente' | 'morno' | 'frio')
- Adicionar Select de filtro no bloco de filtros existente
- Filtrar `filteredLeads` pela temperatura
- Adicionar chip no `IntensiveActiveFilters`

**Arquivo:** `src/components/intensivo/IntensiveActiveFilters.tsx`
- Adicionar chip para filtro de temperatura

### 2.5 Edicao da temperatura

**Arquivo:** `src/components/intensivo/IntensiveLeadDetailDialog.tsx`
- Adicionar selector de temperatura no painel de detalhes do lead

---

## 3. Carteira: Categorizacao por mes de entrada e filtro

### 3.1 Badge de mes no card

**Arquivo:** `src/components/portfolio/StudentCard.tsx`
- Adicionar badge com formato "Mmm/AA" (ex: "Jan/26") derivado de `student.entry_date`
- Usar `format(new Date(student.entry_date), "MMM/yy", { locale: ptBR })` com primeira letra maiuscula

### 3.2 Filtro por mes

**Arquivo:** `src/pages/Portfolio.tsx`
- Adicionar campo `monthFilter` no `PortfolioFiltersState` (string | 'all', formato 'YYYY-MM')
- Calcular lista de meses disponiveis a partir dos `entry_date` dos alunos
- Filtrar alunos pelo mes selecionado

**Arquivo:** `src/components/portfolio/PortfolioFilters.tsx`
- Adicionar Select com os meses disponiveis (ex: "Janeiro/2026", "Dezembro/2025")
- Manter o filtro de periodo existente (ambos podem coexistir)

---

## 4. Carteira: Icones clicaveis de Intensivo, Mentoria e Evento

### 4.1 Criar dialogs de listagem

**Arquivo:** `src/components/portfolio/ActivityListDialog.tsx` (novo)
- Dialog que recebe um tipo de atividade ('intensivo' | 'mentoria' | 'evento')
- Lista todos os alunos que possuem aquela atividade registrada
- Cada item mostra nome do aluno, data da atividade
- Ao clicar no aluno, abre o `StudentDetailDialog`

### 4.2 Tornar icones clicaveis

**Arquivo:** `src/components/portfolio/ActivityMetrics.tsx`
- Adicionar `onClick` em cada Card (Intensivos, Mentorias, Eventos)
- Ao clicar, abrir o `ActivityListDialog` com o tipo correspondente
- Adicionar `cursor-pointer hover:shadow-md` nos cards

---

## 5. Dashboard: Card de Vendas clicavel com popup

### 5.1 Criar dialog de vendas

**Arquivo:** `src/components/dashboard/SalesListDialog.tsx` (novo)
- Dialog que lista todas as vendas do periodo selecionado
- Cada linha mostra: nome do cliente, nicho, valor de venda, valor de entrada, produto vendido
- Ao clicar em um lead, navega para `/clients/{id}` (abre painel do cliente)
- Busca dados da tabela `clients` onde `is_sold = true` e `sold_at` esta no range

### 5.2 Tornar o card clicavel

**Arquivo:** `src/pages/Dashboard.tsx`
- Adicionar state para controlar abertura do dialog
- No `StatsCard` de "Vendas Fechadas", adicionar `onClick` para abrir o dialog
- Adicionar `className="cursor-pointer"` ao card
- Passar `dateRange` e `selectedFunnel` para o dialog filtrar corretamente

**Arquivo:** `src/components/dashboard/StatsCard.tsx`
- Adicionar prop `onClick?: () => void` opcional
- Quando presente, aplicar `cursor-pointer` e chamar onClick ao clicar

---

## 6. Instagram e WhatsApp clicaveis

O Instagram e WhatsApp **ja estao clicaveis** no `ClientCard.tsx`:
- WhatsApp: link `https://wa.me/{phone}` (linha 137-146)
- Instagram: link `https://instagram.com/{handle}` (linha 165-176)
- Ambos com `e.stopPropagation()` para nao abrir o card

Verificarei se isso tambem esta implementado em:

**Arquivo:** `src/components/portfolio/StudentCard.tsx`
- Atualmente o telefone e email nao sao clicaveis. Adicionar link de WhatsApp no telefone (mesmo padrao do ClientCard)

**Arquivo:** `src/components/intensivo/IntensiveLeadCard.tsx`
- O telefone ja aparece mas nao e clicavel. Adicionar link de WhatsApp

**Arquivo:** `src/components/portfolio/StudentDetailDialog.tsx`
- Verificar se telefone e instagram estao clicaveis no dialog de detalhe

---

## Resumo de arquivos

| Arquivo | Acao |
|---------|------|
| `src/types/intensivo.ts` | Adicionar `LeadTemperature` e campo no `IntensiveLead` |
| `src/components/intensivo/IntensiveKanban.tsx` | Aplicar padrao isDraggingRef do CRM Calls |
| `src/components/intensivo/IntensiveLeadCard.tsx` | Tags de temperatura, WhatsApp clicavel, simplificar drag |
| `src/pages/IntensivoCRM.tsx` | Filtro de temperatura |
| `src/components/intensivo/IntensiveActiveFilters.tsx` | Chip de temperatura |
| `src/components/intensivo/IntensiveLeadDetailDialog.tsx` | Selector de temperatura |
| `src/components/portfolio/StudentCard.tsx` | Badge de mes, WhatsApp clicavel |
| `src/pages/Portfolio.tsx` | Filtro por mes no state |
| `src/components/portfolio/PortfolioFilters.tsx` | Select de filtro por mes |
| `src/components/portfolio/ActivityMetrics.tsx` | Cards clicaveis |
| `src/components/portfolio/ActivityListDialog.tsx` | Novo dialog de listagem por atividade |
| `src/components/dashboard/SalesListDialog.tsx` | Novo dialog de vendas |
| `src/components/dashboard/StatsCard.tsx` | Prop onClick |
| `src/pages/Dashboard.tsx` | Abrir dialog de vendas |
| `src/components/portfolio/StudentDetailDialog.tsx` | Links clicaveis |
| Migracao SQL | Coluna `lead_temperature` em `intensive_leads` |

## Detalhes tecnicos

### Migracao SQL
```sql
ALTER TABLE public.intensive_leads 
ADD COLUMN lead_temperature text NOT NULL DEFAULT 'morno';

-- Validacao via trigger (sem CHECK constraint)
CREATE OR REPLACE FUNCTION validate_lead_temperature()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lead_temperature NOT IN ('quente', 'morno', 'frio') THEN
    RAISE EXCEPTION 'lead_temperature must be quente, morno or frio';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_lead_temperature
BEFORE INSERT OR UPDATE ON public.intensive_leads
FOR EACH ROW EXECUTE FUNCTION validate_lead_temperature();
```

### Fluxo do dialog de vendas no Dashboard
```text
Usuario clica no card "Vendas Fechadas"
    |
    v
Abre SalesListDialog
    |
    v
Query: clients WHERE is_sold=true AND sold_at BETWEEN dateRange
    |
    v
Lista com: nome, nicho, sale_value, entry_value, product_offered
    |
    v
Clique no lead -> navigate('/clients/{id}')
```
