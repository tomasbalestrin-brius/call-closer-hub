

# Separar logs resolvidos dos nao resolvidos

## O que muda

O painel "Logs de Erros" sera dividido em duas abas internas:

- **Erros Pendentes**: mostra apenas logs cujos arquivos ainda estao com erro ou nao foram reprocessados
- **Arquivos Resolvidos**: mostra logs cujos arquivos ja foram reprocessados com sucesso (status `completed` na tabela `imported_files`)

Logs que nao possuem `fileId` no metadata (erros genericos do sistema sem arquivo associado) permanecerao sempre na aba "Erros Pendentes".

## Como funciona a separacao

Ao carregar os logs, o sistema tambem busca o status atual dos arquivos na tabela `imported_files` usando os `drive_file_id` extraidos do metadata. Compara-se:

- Se o arquivo associado tem status `completed` -> log vai para "Arquivos Resolvidos"
- Se o arquivo tem status `error`, `pending`, `processing`, ou nao existe -> log fica em "Erros Pendentes"
- Se o log nao tem `fileId` no metadata -> fica em "Erros Pendentes"

## Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `src/components/admin/ErrorLogsPanel.tsx` | Adicionar Tabs (Erros Pendentes / Arquivos Resolvidos), buscar status dos arquivos em `imported_files`, separar logs por status resolvido/pendente |

### Alteracoes especificas:

1. **Import**: Adicionar `Tabs, TabsList, TabsTrigger, TabsContent` e icone `CheckCircle`

2. **Novo estado**: `resolvedFileIds` (Set de drive_file_ids com status completed)

3. **fetchLogs atualizado**: Apos buscar logs, extrair todos os `fileId` do metadata e consultar `imported_files` para saber quais tem status `completed`. Guardar no Set.

4. **Separacao dos logs**:
   - `unresolvedLogs`: logs sem fileId OU cujo fileId nao esta no Set de resolvidos
   - `resolvedLogs`: logs cujo fileId esta no Set de resolvidos

5. **UI com Tabs**:
   - Aba "Erros Pendentes" exibe filtros, quality rejections e erros do sistema (apenas os nao resolvidos)
   - Aba "Arquivos Resolvidos" exibe tabela simples com data, arquivo, usuario, mensagem de erro original e um badge "Resolvido"

6. **Contadores nas abas**: Cada aba mostra o numero de itens entre parenteses

