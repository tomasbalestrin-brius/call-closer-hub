import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FolderOpen,
  FileText,
  Settings,
  Save,
  Loader2,
  Info,
  Plus,
  X,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ImportSettings {
  folderId: string;
  folderName: string;
  fileTypes: string[];
  namePatterns: string[];
  autoImport: boolean;
  importFrequency: 'manual' | 'hourly' | 'daily' | 'realtime';
}

const FILE_TYPE_OPTIONS = [
  { value: 'google-docs', label: 'Google Docs', icon: '📄' },
  { value: 'pdf', label: 'PDF', icon: '📕' },
  { value: 'txt', label: 'Texto (.txt)', icon: '📝' },
  { value: 'docx', label: 'Word (.docx)', icon: '📘' },
];

const DEFAULT_PATTERNS = [
  'Transcrição*',
  'Call*',
  'Reunião*',
  '*transcription*',
];

export function GoogleDriveImportSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ImportSettings>({
    folderId: '',
    folderName: '',
    fileTypes: ['google-docs'],
    namePatterns: [],
    autoImport: true,
    importFrequency: 'daily',
  });
  const [newPattern, setNewPattern] = useState('');

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    // For now, we'll use localStorage since we haven't added these fields to the profiles table yet
    const saved = localStorage.getItem(`drive_import_settings_${user?.id}`);
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading settings:', e);
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save to localStorage for now
      localStorage.setItem(`drive_import_settings_${user?.id}`, JSON.stringify(settings));
      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const addPattern = () => {
    if (newPattern.trim() && !settings.namePatterns.includes(newPattern.trim())) {
      setSettings(prev => ({
        ...prev,
        namePatterns: [...prev.namePatterns, newPattern.trim()],
      }));
      setNewPattern('');
    }
  };

  const removePattern = (pattern: string) => {
    setSettings(prev => ({
      ...prev,
      namePatterns: prev.namePatterns.filter(p => p !== pattern),
    }));
  };

  const addDefaultPattern = (pattern: string) => {
    if (!settings.namePatterns.includes(pattern)) {
      setSettings(prev => ({
        ...prev,
        namePatterns: [...prev.namePatterns, pattern],
      }));
    }
  };

  const toggleFileType = (type: string) => {
    setSettings(prev => ({
      ...prev,
      fileTypes: prev.fileTypes.includes(type)
        ? prev.fileTypes.filter(t => t !== type)
        : [...prev.fileTypes, type],
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="font-display text-lg">Configurações de Importação</CardTitle>
            <CardDescription>
              Configure como os arquivos serão importados do Google Drive
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Folder Selection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-base font-medium">Pasta de Origem</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Selecione a pasta do Google Drive onde suas transcrições estão armazenadas.
                    Subpastas também serão incluídas.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                <FolderOpen className="w-5 h-5 text-amber-500" />
                <span className="text-sm">
                  {settings.folderName || 'Nenhuma pasta selecionada'}
                </span>
              </div>
            </div>
            <Button variant="outline" className="shrink-0">
              <FolderOpen className="w-4 h-4 mr-2" />
              Selecionar Pasta
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground">
            Ou insira o ID da pasta diretamente:
          </div>
          <Input
            placeholder="Ex: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
            value={settings.folderId}
            onChange={(e) => setSettings(prev => ({ ...prev, folderId: e.target.value }))}
            className="font-mono text-sm"
          />
        </div>

        {/* File Types */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-base font-medium">Tipos de Arquivo</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Selecione quais tipos de arquivo devem ser importados.
                    Google Docs é recomendado para melhor extração de texto.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {FILE_TYPE_OPTIONS.map((option) => (
              <div
                key={option.value}
                onClick={() => toggleFileType(option.value)}
                className={`
                  flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
                  ${settings.fileTypes.includes(option.value)
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-muted-foreground/30'
                  }
                `}
              >
                <Checkbox
                  checked={settings.fileTypes.includes(option.value)}
                  onCheckedChange={() => toggleFileType(option.value)}
                />
                <span className="text-lg">{option.icon}</span>
                <span className="text-sm font-medium">{option.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Name Patterns */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-base font-medium">Padrões de Nome</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Use * como coringa. Ex: "Transcrição*" importa todos os arquivos
                    que começam com "Transcrição".
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Added patterns */}
          {settings.namePatterns.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {settings.namePatterns.map((pattern) => (
                <Badge
                  key={pattern}
                  variant="secondary"
                  className="pl-3 pr-1 py-1.5 flex items-center gap-2"
                >
                  <FileText className="w-3 h-3" />
                  <code className="text-xs">{pattern}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 hover:bg-destructive/20"
                    onClick={() => removePattern(pattern)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}

          {/* Add new pattern */}
          <div className="flex gap-2">
            <Input
              placeholder="Ex: Transcrição* ou *call*"
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPattern()}
              className="flex-1"
            />
            <Button variant="outline" onClick={addPattern} disabled={!newPattern.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Suggested patterns */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Sugestões:</div>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_PATTERNS.filter(p => !settings.namePatterns.includes(p)).map((pattern) => (
                <Badge
                  key={pattern}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10 transition-colors"
                  onClick={() => addDefaultPattern(pattern)}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  <code className="text-xs">{pattern}</code>
                </Badge>
              ))}
            </div>
          </div>

          {settings.namePatterns.length === 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <Info className="w-4 h-4 text-amber-600 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Sem padrões definidos, todos os arquivos dos tipos selecionados serão importados.
              </p>
            </div>
          )}
        </div>

        {/* Auto Import Settings */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Importação Automática</Label>
              <p className="text-xs text-muted-foreground">
                Importar novos arquivos automaticamente
              </p>
            </div>
            <Switch
              checked={settings.autoImport}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, autoImport: checked }))}
            />
          </div>

          {settings.autoImport && (
            <div className="space-y-2 pl-4 border-l-2 border-primary/30">
              <Label>Frequência de Verificação</Label>
              <Select
                value={settings.importFrequency}
                onValueChange={(value: ImportSettings['importFrequency']) => 
                  setSettings(prev => ({ ...prev, importFrequency: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realtime">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      Tempo Real
                    </span>
                  </SelectItem>
                  <SelectItem value="hourly">A cada hora</SelectItem>
                  <SelectItem value="daily">Diariamente</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full gradient-primary"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Salvar Configurações
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
