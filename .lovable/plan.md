# Exportar leads por closer (Admin)

## Objetivo
Adicionar, na lista de usuários da página Admin, um botão por closer que gera um arquivo CSV com todos os leads (clients) daquele closer, incluindo etapa atual do CRM, dados de venda e notas.

## Acesso
Apenas usuários com role `admin`. O botão só aparece para admins (já estão na página Admin).

## UI
- Local: `src/pages/Admin.tsx`, na linha de cada closer da lista de usuários.
- Componente novo: `src/components/admin/ExportLeadsButton.tsx`
  - Ícone `Download` + tooltip "Exportar leads (CSV)"
  - Estado de loading enquanto gera o arquivo
  - Toast de sucesso/erro

## Fluxo de exportação (client-side)
1. Ao clicar, busca todos os `clients` do closer via Supabase (RLS de admin já permite SELECT global).
2. Mapeia o campo `status` (id da coluna do Kanban) para o título legível usando o mesmo dicionário usado em `ClientKanban` (ex.: `call_realizada` → "Call Realizada", `pos_call_8_15` → "Pós Call 8-15", etc.).
3. Gera CSV em memória e dispara download como `leads-{nome-do-closer}-{YYYY-MM-DD}.csv`.

## Colunas do CSV
**Básicos + etapa:** Nome, Email, Telefone, Empresa, Instagram, Nicho, Faturamento, Tem Sócio, SDR, Funil, Produto Oferecido, Origem, Indicado por, Super Quente, Etapa Atual (label), Status (id), Data de Mudança de Status, Criado em, Atualizado em, Follow-up.

**Venda:** Vendido, Valor da Venda, Valor de Entrada, Vendido em, Validade do Contrato.

**Notas:** Dor Principal, Dificuldade Principal, Notas Gerais, Notas de Negociação, Notas de Venda.

## Detalhes técnicos
- Geração de CSV pura em JS (sem libs novas): escape de aspas, separador `;` (melhor para Excel pt-BR), BOM UTF-8 para acentuação correta.
- Datas formatadas como `DD/MM/YYYY HH:mm` via `date-fns` (já no projeto).
- Booleanos como `Sim`/`Não`.
- Valores numéricos com vírgula decimal.
- Sem paginação: usa `.range()` em loop de 1000 em 1000 até esgotar (caso o closer tenha mais de 1000 leads), para contornar o limite padrão do Supabase.

## Arquivos afetados
- `src/components/admin/ExportLeadsButton.tsx` (novo)
- `src/pages/Admin.tsx` (adicionar botão na linha do closer)
- `src/lib/exportLeadsCsv.ts` (novo — função utilitária de fetch + geração do CSV)

## Fora do escopo
- Exportação em XLSX, ZIP em massa, ou histórico de calls do lead.
- Botão fora da página Admin.
