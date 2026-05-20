import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, Plus, Pencil, Trash2, Webhook } from 'lucide-react';
import { toast } from 'sonner';

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  event_type: string;
  product_filter: string[] | null;
  is_active: boolean;
  headers: Record<string, string> | null;
}

const EVENT_TYPES = [
  { value: 'sale_closed', label: 'Venda registrada (formulário)' },
  { value: 'pipeline_sale_finalized', label: 'Card movido p/ Venda Realizada (Kanban)' },
];

const empty = (): Partial<WebhookConfig> => ({
  name: '',
  url: '',
  event_type: 'pipeline_sale_finalized',
  product_filter: [],
  is_active: true,
  headers: {},
});

export function WebhooksPanel() {
  const [list, setList] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<WebhookConfig> | null>(null);
  const [productsText, setProductsText] = useState('');
  const [headersText, setHeadersText] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('webhook_configs' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error('Erro ao carregar webhooks');
    setList(((data as unknown) as WebhookConfig[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchList();
  }, []);

  const openNew = () => {
    setEditing(empty());
    setProductsText('');
    setHeadersText('');
    setOpen(true);
  };

  const openEdit = (w: WebhookConfig) => {
    setEditing(w);
    setProductsText((w.product_filter || []).join(', '));
    setHeadersText(w.headers ? JSON.stringify(w.headers, null, 2) : '');
    setOpen(true);
  };

  const save = async () => {
    if (!editing?.name || !editing.url || !editing.event_type) {
      toast.error('Nome, URL e evento são obrigatórios');
      return;
    }
    let headers: any = {};
    if (headersText.trim()) {
      try {
        headers = JSON.parse(headersText);
      } catch {
        toast.error('Headers: JSON inválido');
        return;
      }
    }
    const product_filter = productsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    const payload = {
      name: editing.name,
      url: editing.url,
      event_type: editing.event_type,
      product_filter: product_filter.length ? product_filter : null,
      is_active: editing.is_active ?? true,
      headers,
    };
    const { error } = editing.id
      ? await supabase.from('webhook_configs' as any).update(payload).eq('id', editing.id)
      : await supabase.from('webhook_configs' as any).insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing.id ? 'Webhook atualizado' : 'Webhook criado');
    setOpen(false);
    fetchList();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('webhook_configs' as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Webhook removido');
    fetchList();
  };

  const toggleActive = async (w: WebhookConfig) => {
    const { error } = await supabase
      .from('webhook_configs' as any)
      .update({ is_active: !w.is_active })
      .eq('id', w.id);
    if (error) return toast.error(error.message);
    fetchList();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <Webhook className="w-5 h-5" /> Webhooks
          </CardTitle>
          <CardDescription>
            Gerencie integrações de saída. O evento "Card movido p/ Venda Realizada" dispara quando um card chega na coluna final do CRM Vendas.
          </CardDescription>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Novo webhook
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum webhook configurado.</p>
        ) : (
          <div className="space-y-3">
            {list.map((w) => (
              <div key={w.id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{w.name}</span>
                    <Badge variant={w.is_active ? 'default' : 'secondary'}>
                      {w.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <Badge variant="outline">
                      {EVENT_TYPES.find((e) => e.value === w.event_type)?.label || w.event_type}
                    </Badge>
                    {(w.product_filter || []).map((p) => (
                      <Badge key={p} variant="secondary">{p}</Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{w.url}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={w.is_active} onCheckedChange={() => toggleActive(w)} />
                  <Button size="icon" variant="ghost" onClick={() => openEdit(w)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover webhook?</AlertDialogTitle>
                        <AlertDialogDescription>"{w.name}" será removido permanentemente.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(w.id)} className="bg-destructive text-destructive-foreground">
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Editar webhook' : 'Novo webhook'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>URL</Label>
                <Input value={editing.url || ''} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <Label>Evento</Label>
                <Select value={editing.event_type} onValueChange={(v) => setEditing({ ...editing, event_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((e) => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Filtro de produtos (separados por vírgula, vazio = todos)</Label>
                <Input value={productsText} onChange={(e) => setProductsText(e.target.value)} placeholder="elite, mentoria" />
                <p className="text-xs text-muted-foreground mt-1">Match case-insensitive em product_offered.</p>
              </div>
              <div>
                <Label>Headers (JSON opcional)</Label>
                <textarea
                  className="w-full min-h-[80px] rounded-md border bg-background p-2 text-sm font-mono"
                  value={headersText}
                  onChange={(e) => setHeadersText(e.target.value)}
                  placeholder='{"X-Api-Key": "..."}'
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                <Label>Ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
