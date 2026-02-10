

# Analise Manual de Transcrições (Admin)

## Objetivo

Adicionar um botão "Análise Manual" na area administrativa que permite ao admin colar/subir uma transcrição de call para ser analisada pela IA, seguindo o pipeline existente. Tambem reabilitar o modulo "Calls" no sidebar para administradores.

## Alterações Necessarias

### 1. Reabilitar "Calls" no Sidebar para Admins

**Arquivo:** `src/components/layout/Sidebar.tsx`

Atualmente, a linha 36 filtra os itens `/calls`, `/clients`, `/intensivo-crm` para admins:
```ts
const closerOnlyItems = ['/calls', '/clients', '/intensivo-crm'];
```

Remover `/calls` dessa lista para que admins vejam o modulo Calls no menu lateral. Assim, admins poderao acessar a pagina de Calls e visualizar calls de todos os closers (ja suportado pelo sistema de selecao de closer existente).

### 2. Criar componente `ManualAnalysisDialog`

**Arquivo:** `src/components/admin/ManualAnalysisDialog.tsx` (novo)

Dialog que permite ao admin:
- Selecionar o closer para quem a call sera atribuida (dropdown com lista de closers)
- Informar o nome do cliente
- Informar a data da call
- Colar a transcrição em um campo de texto grande (textarea)
- Botão "Analisar" que:
  1. Cria um registro na tabela `calls` com os dados basicos + transcrição (closer_id do closer selecionado, status "pendente")
  2. Chama a edge function `analyze-call` diretamente passando a transcrição
  3. Atualiza o registro da call com os resultados da analise (score, ai_summary, technical_analysis, etc.)
  4. Exibe toast de sucesso/erro

Fluxo tecnico:
- O admin cola a transcrição no textarea
- Ao clicar "Analisar", o sistema chama `supabase.functions.invoke('analyze-call', { body: { transcription, fileName: 'Manual Analysis', userId: selectedCloserId } })`
- Com o resultado da analise, faz um `INSERT` na tabela `calls` com todos os campos extraidos (seguindo o mesmo mapeamento que o `import-and-analyze` faz nas linhas 707-743)
- Opcionalmente cria o cliente se nao existir

### 3. Adicionar o botao na pagina Admin

**Arquivo:** `src/pages/Admin.tsx`

Adicionar uma nova aba "Análise Manual" (ou um botão no header) no TabsList da pagina Admin. Essa aba contera o botao que abre o `ManualAnalysisDialog`.

Alternativa mais simples: adicionar o botão diretamente na aba "Importações" ao lado do botão "Reanalisar Todas", ja que faz sentido contextual.

### 4. Adicionar na pagina Calls (para admin)

**Arquivo:** `src/pages/Calls.tsx`

Adicionar o botão "Análise Manual" no header da pagina Calls (ao lado de "Nova Call"), visivel apenas para admins. Isso permite que o admin analise transcricoes tanto da pagina Admin quanto da pagina Calls.

## Detalhes Tecnicos

### Fluxo de dados

```text
Admin cola transcrição
    |
    v
Frontend chama analyze-call (edge function existente)
    |
    v
analyze-call processa com OpenAI (gpt-4o/gpt-4o-mini)
    |
    v
Retorna resultado da analise
    |
    v
Frontend insere registro na tabela calls (via supabase client)
    |
    v
Call aparece na pagina Calls (com filtro do closer selecionado)
```

### Campos do formulario

- **Closer** (obrigatorio): Select com lista de closers (useClosersList)
- **Nome do Cliente** (obrigatorio): Input de texto
- **Data da Call** (obrigatorio): Input date (default: hoje)
- **Transcrição** (obrigatorio): Textarea grande (minimo 3750 caracteres para passar validação de qualidade)

### Inserção na tabela calls

O resultado da analise sera mapeado exatamente como o `import-and-analyze` faz, incluindo:
- `client_name`, `closer_id`, `call_date`, `status` (derivado da analise)
- `score`, `product`, `niche`, `main_pain`, `ai_summary`
- `technical_analysis` (objeto completo da analise)
- `analysis_metadata` (metadados de analise)
- `main_errors`, `main_wins`, `loss_point`
- `lead_classification`, `closer_classification`
- `transcription` (a transcrição colada)
- `analyzed_at` (timestamp atual)

### RLS

O admin ja tem permissao para SELECT em calls (via policy "Admins can view all calls"). Para INSERT, a policy atual exige `auth.uid() = closer_id`. Como o admin esta inserindo em nome de outro closer, sera necessario usar o service role key via edge function, OU criar uma nova policy que permita admins inserirem calls para qualquer closer.

**Solucao recomendada**: Criar uma nova edge function `manual-analyze` que:
1. Verifica se o usuario autenticado e admin
2. Recebe a transcrição + closerId + clientName + callDate
3. Chama `analyze-call` internamente
4. Insere o registro na tabela `calls` usando service role (bypassa RLS)
5. Opcionalmente cria/vincula o cliente

Isso e mais seguro do que alterar as policies de INSERT.

### Nova Edge Function: `manual-analyze`

**Arquivo:** `supabase/functions/manual-analyze/index.ts` (novo)

Responsabilidades:
1. Validar autenticação e role de admin
2. Validar tamanho minimo da transcrição (3750 chars)
3. Chamar `analyze-call` com a transcrição
4. Mapear resultado da analise para campos da tabela `calls`
5. Inserir registro na tabela `calls` com service role
6. Criar cliente se necessário (opcional)
7. Retornar ID da call criada

**Configuração:** Adicionar `[functions.manual-analyze]` no `supabase/config.toml` com `verify_jwt = false`.

## Resumo dos arquivos alterados/criados

| Arquivo | Ação |
|---------|------|
| `src/components/layout/Sidebar.tsx` | Remover `/calls` do filtro de admins |
| `src/components/admin/ManualAnalysisDialog.tsx` | Criar componente do dialog |
| `src/pages/Calls.tsx` | Adicionar botão "Análise Manual" (admin only) |
| `supabase/functions/manual-analyze/index.ts` | Nova edge function |
| `supabase/config.toml` | Adicionar config da nova function |

