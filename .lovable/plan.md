

# Adicionar regra de Problematização para Deyvid e Leandro

## O que muda

Para Deyvid e Leandro, a etapa de **Problematização** é conduzida pela pergunta-chave:

> "O que vai acontecer com seu negócio se continuar da mesma forma?"

Sempre que essa pergunta (ou variação próxima) aparecer na transcrição, a IA deve reconhecer como a etapa de Problematização acontecendo.

## Onde aplicar

Essa instrução será injetada nas regras de prioridade de framework que já existem para Deyvid e Leandro, em **dois arquivos**:

| Arquivo | Localização |
|---------|-------------|
| `supabase/functions/analyze-call/index.ts` | Função `getFrameworkPriorityInstructions()`, bloco do Deyvid/Leandro (linhas 82-95) |
| `supabase/functions/reanalyze-call/index.ts` | Mesmo bloco equivalente (se já tiver a função de prioridade) ou no prompt master |

## Texto a ser adicionado

Dentro do bloco de regras para Deyvid/Leandro, após as regras de framework, será incluído:

```text
REGRA DE IDENTIFICAÇÃO DE PROBLEMATIZAÇÃO:
- A pergunta-chave que conduz a Problematização para este closer é: "O que vai acontecer com seu negócio se continuar da mesma forma?"
- Sempre que essa pergunta (ou variação semanticamente equivalente) aparecer na transcrição, marque a etapa "problematizacao" como aconteceu: "sim" ou "parcial"
- Variações válidas incluem: "o que acontece se você continuar assim?", "se nada mudar, o que vai acontecer?", "como fica daqui a 1 ano se continuar do mesmo jeito?"
```

## Impacto

- Nenhuma mudança estrutural no código
- Apenas adição de texto instrucional no prompt da IA
- Afeta apenas calls de Deyvid e Leandro
- Deploy automático das duas edge functions após a edição
