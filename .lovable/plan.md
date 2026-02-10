

# Suporte a upload de arquivos .docx na Analise Manual

## Problema

Atualmente apenas arquivos `.txt` sao aceitos. Arquivos `.docx` (Word) sao binarios e precisam de uma biblioteca para extrair o texto.

## Solucao

Adicionar a biblioteca `mammoth` ao projeto e atualizar o componente `ManualAnalysisDialog` para aceitar tanto `.txt` quanto `.docx`.

## Alteracoes

### 1. Instalar dependencia `mammoth`

Pacote leve (~30KB gzipped) que converte `.docx` para texto puro diretamente no navegador. Sem mudancas no backend.

### 2. Atualizar `src/components/admin/ManualAnalysisDialog.tsx`

- Alterar o `accept` do input de arquivo para `.txt,.docx`
- Na funcao `handleFileUpload`, verificar a extensao do arquivo:
  - Se `.txt`: usar `FileReader.readAsText()` (como ja funciona)
  - Se `.docx`: usar `FileReader.readAsArrayBuffer()` e passar para `mammoth.extractRawText()`
- O texto extraido vai para o mesmo state `transcription`, seguindo o fluxo identico

### Codigo resumido

```tsx
import mammoth from 'mammoth';

const handleFileUpload = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.name.endsWith('.docx')) {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      const result = await mammoth.extractRawText({ arrayBuffer });
      setTranscription(result.value);
      setFileName(file.name);
      toast.success(`Arquivo "${file.name}" carregado`);
    };
    reader.readAsArrayBuffer(file);
  } else {
    // .txt - fluxo existente
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setTranscription(text);
      setFileName(file.name);
      toast.success(`Arquivo "${file.name}" carregado`);
    };
    reader.readAsText(file);
  }
};
```

## Impactos

- **Bundle**: +30KB gzipped (mammoth)
- **Backend**: Nenhum
- **UX**: Admin pode arrastar/selecionar arquivos .txt ou .docx. O texto e editavel antes de analisar.
- **Formatos nao suportados**: .doc (formato antigo do Word) nao e suportado pelo mammoth, apenas .docx

