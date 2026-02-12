

# Corrigir vendas zeradas - Foreign Key ausente

## Problema Real

O erro NAO e de race condition de role. A query retorna **status 400** porque o join `profiles!clients_closer_id_fkey(full_name)` referencia uma foreign key que nao existe no banco de dados. A tabela `clients` nao possui nenhuma foreign key, entao o PostgREST nao consegue resolver o relacionamento e retorna erro.

Mensagem de erro da API:
```text
Could not find a relationship between 'clients' and 'profiles' 
using the hint 'clients_closer_id_fkey'
```

## Solucao

### 1. Migracao SQL - Criar a Foreign Key

Adicionar a FK de `clients.closer_id` para `profiles.user_id`:

```text
ALTER TABLE public.clients 
ADD CONSTRAINT clients_closer_id_fkey 
FOREIGN KEY (closer_id) REFERENCES public.profiles(user_id);
```

A coluna `profiles.user_id` ja possui indice unico, entao a FK e valida.

### 2. Nenhuma mudanca de codigo necessaria

O `SalesListDialog.tsx` ja esta correto - o join `profiles!clients_closer_id_fkey(full_name)` vai funcionar assim que a FK existir no banco.

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| Migracao SQL | Criar FK `clients_closer_id_fkey` de `closer_id` para `profiles(user_id)` |

