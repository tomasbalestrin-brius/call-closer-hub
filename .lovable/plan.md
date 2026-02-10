

# Upload de arquivo de transcrição na Análise Manual

## Abordagem

Adicionar um botão "Enviar arquivo" ao lado do textarea no `ManualAnalysisDialog`. O arquivo e lido diretamente no navegador usando a `FileReader API` e o conteudo e inserido no campo de transcrição. Nenhuma mudança no backend.

## Impactos

- **Backend**: Nenhum. O texto extraido do arquivo segue o mesmo fluxo que o texto colado manualmente.
- **Infraestrutura**: Nenhum bucket de storage necessario.
- **Formatos suportados**: `.txt` (leitura nativa via FileReader).
- **Limitação**: Somente arquivos de texto puro. Para `.docx` seria necessario adicionar uma dependencia (`mammoth`), o que aumenta o bundle. Recomendo manter apenas `.txt` por simplicidade.

## Alterações

### 1. Atualizar `src/components/admin/ManualAnalysisDialog.tsx`

- Adicionar um `<Input type="file" accept=".txt" />` acima ou ao lado do textarea
- Ao selecionar um arquivo, usar `FileReader.readAsText()` para ler o conteudo
- Preencher o state `transcription` com o texto lido
- O admin ainda pode editar o texto apos o upload, caso queira ajustar
- Exibir o nome do arquivo selecionado como feedback visual

### Codigo resumido da mudanca

```tsx
const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const text = event.target?.result as string;
    setTranscription(text);
    toast.success(`Arquivo "${file.name}" carregado (${text.length} caracteres)`);
  };
  reader.readAsText(file);
};
```

## Resultado

O admin pode tanto colar a transcrição manualmente quanto fazer upload de um arquivo `.txt`. O restante do fluxo (analise via IA, inserção na tabela calls) permanece identico.

