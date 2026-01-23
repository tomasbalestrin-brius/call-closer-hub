

# Plano: Reset de Arquivos Travados + Disparo de Processamento

## Situação Atual

- **117 arquivos** travados em `processing` há mais de 17 horas
- **5 sessões** marcadas como `running` mas sem workers ativos
- **18 arquivos** com status `error` (podem ser reprocessados também)

## Ações a Executar

### Fase 1: Limpar Estado Corrompido

**1.1 - Resetar arquivos travados para `pending`**
```sql
UPDATE imported_files 
SET status = 'pending', 
    started_processing_at = NULL, 
    error_message = NULL
WHERE status = 'processing'
  AND started_processing_at < NOW() - INTERVAL '5 minutes';
```

**1.2 - Marcar sessões órfãs como `error`**
```sql
UPDATE user_import_sessions 
SET status = 'error', 
    completed_at = NOW(),
    current_file_name = 'Sessão expirada - reset manual'
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '15 minutes';
```

### Fase 2: Disparar Novo Processamento

Após o reset, o painel de administração mostrará os arquivos como `pending` novamente. O processamento pode ser reiniciado:

- Via botão **"Turbo (3x)"** ou **"Ultra (6x)"** no painel Admin
- Cada closer com arquivos pendentes será processado em paralelo

### Fase 3: Melhoria Preventiva (Opcional)

Adicionar lógica de auto-recovery no `ImportStatusPanel` que:
1. Detecta sessões `running` por mais de 15 minutos
2. Chama automaticamente o `stale-file-cleanup` Edge Function
3. Exibe alerta ao admin quando há arquivos travados

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| 117 arquivos travados | 0 arquivos travados |
| 5 sessões órfãs | 0 sessões órfãs |
| Processamento parado | Processamento retomado |

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| (Banco de dados) | 2 queries UPDATE para reset |
| `src/components/admin/ImportStatusPanel.tsx` | Adicionar botão "Reset Stuck Files" + auto-recovery |

## Sequência de Execução

```text
┌─────────────────────────────────────────────────────┐
│  PASSO 1: Executar UPDATE nos arquivos travados    │
│  → 117 arquivos: processing → pending              │
├─────────────────────────────────────────────────────┤
│  PASSO 2: Executar UPDATE nas sessões órfãs        │
│  → 5 sessões: running → error                      │
├─────────────────────────────────────────────────────┤
│  PASSO 3: Adicionar botão de reset manual no Admin │
│  → Para evitar precisar de intervenção futura      │
├─────────────────────────────────────────────────────┤
│  PASSO 4: Usuário clica "Turbo (3x)" para iniciar  │
│  → Processamento retomado automaticamente          │
└─────────────────────────────────────────────────────┘
```

## Tempo Estimado de Processamento

Após o reset:
- **117 arquivos pendentes** ÷ 6 closers em paralelo = ~20 arquivos/closer
- **20 arquivos** × 15 segundos = **~5 minutos** em modo Turbo

