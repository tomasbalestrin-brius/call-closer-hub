import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useClosersList } from '@/hooks/useClosersList';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import mammoth from 'mammoth';
import { FileText, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface ManualAnalysisDialogProps {
  onAnalysisComplete?: () => void;
}

export function ManualAnalysisDialog({ onAnalysisComplete }: ManualAnalysisDialogProps) {
  const { user } = useAuth();
  const { data: closers = [] } = useClosersList();
  const [open, setOpen] = useState(false);
  const [closerId, setCloserId] = useState('');
  const [clientName, setClientName] = useState('');
  const [callDate, setCallDate] = useState(new Date().toISOString().split('T')[0]);
  const [transcription, setTranscription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.docx')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const result = await mammoth.extractRawText({ arrayBuffer });
          setTranscription(result.value);
          setFileName(file.name);
          toast.success(`Arquivo "${file.name}" carregado (${result.value.length} caracteres)`);
        } catch {
          toast.error('Erro ao ler arquivo .docx');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setTranscription(text);
        setFileName(file.name);
        toast.success(`Arquivo "${file.name}" carregado (${text.length} caracteres)`);
      };
      reader.readAsText(file);
    }
  };

  const handleAnalyze = async () => {
    if (!closerId) {
      toast.error('Selecione um closer');
      return;
    }
    if (!clientName.trim()) {
      toast.error('Informe o nome do cliente');
      return;
    }
    if (transcription.length < 500) {
      toast.error('A transcrição deve ter pelo menos 500 caracteres');
      return;
    }

    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manual-analyze', {
        body: { transcription, closerId, clientName: clientName.trim(), callDate },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(
        `Call analisada com sucesso! Nota: ${data.score ?? 'N/A'}/10`,
        { duration: 5000 }
      );

      // Reset form
      setCloserId('');
      setClientName('');
      setTranscription('');
      setFileName(null);
      setCallDate(new Date().toISOString().split('T')[0]);
      setOpen(false);
      onAnalysisComplete?.();
    } catch (error) {
      console.error('Manual analysis error:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao analisar transcrição');
    } finally {
      setAnalyzing(false);
    }
  };

  const allClosers = [
    ...(user ? [{ user_id: user.id, full_name: 'Eu mesmo (Admin)' }] : []),
    ...closers,
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileText className="w-4 h-4" />
          Análise Manual
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Análise Manual de Transcrição</DialogTitle>
          <DialogDescription>
            Cole a transcrição da call para análise automática pela IA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="closer">Closer *</Label>
              <Select value={closerId} onValueChange={setCloserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o closer" />
                </SelectTrigger>
                <SelectContent>
                  {allClosers.map((closer) => (
                    <SelectItem key={closer.user_id} value={closer.user_id}>
                      {closer.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="callDate">Data da Call *</Label>
              <Input
                id="callDate"
                type="date"
                value={callDate}
                onChange={(e) => setCallDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientName">Nome do Cliente *</Label>
            <Input
              id="clientName"
              placeholder="Nome do cliente"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="transcription">
              Transcrição * 
              <span className="text-muted-foreground text-xs ml-2">
                ({transcription.length} caracteres — mínimo 500)
              </span>
            </Label>
            <div className="flex items-center gap-2 mb-2">
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background text-sm hover:bg-accent hover:text-accent-foreground transition-colors">
                  <Upload className="w-4 h-4" />
                  Enviar arquivo .txt ou .docx
                </div>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".txt,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {fileName && (
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                  📄 {fileName}
                </span>
              )}
            </div>
            <Textarea
              id="transcription"
              placeholder="Cole aqui a transcrição completa da call ou envie um arquivo .txt..."
              value={transcription}
              onChange={(e) => { setTranscription(e.target.value); setFileName(null); }}
              className="min-h-[250px] font-mono text-xs"
            />
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={analyzing || !closerId || !clientName.trim() || transcription.length < 500}
            className="w-full"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analisando... (pode levar até 2 min)
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Analisar Transcrição
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
