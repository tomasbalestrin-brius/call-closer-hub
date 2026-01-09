import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Phone, Zap } from 'lucide-react';
import { Client } from '@/types';

const formSchema = z.object({
  indicated_name: z.string().min(2, 'Nome é obrigatório'),
  indicated_phone: z.string().min(8, 'Telefone é obrigatório'),
  indicated_email: z.string().email('Email inválido').optional().or(z.literal('')),
  indication_type: z.enum(['call', 'intensivo']),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface IndicationDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function IndicationDialog({ 
  client, 
  open, 
  onOpenChange,
  onSuccess 
}: IndicationDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      indicated_name: '',
      indicated_phone: '',
      indicated_email: '',
      indication_type: 'call',
      notes: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('indications')
        .insert({
          client_id: client?.id || null,
          indicated_by: user.id,
          indicated_name: data.indicated_name,
          indicated_phone: data.indicated_phone,
          indicated_email: data.indicated_email || null,
          indication_type: data.indication_type,
          notes: data.notes || null,
          status: 'pendente',
        });

      if (error) throw error;

      toast.success('Indicação criada com sucesso! 🎉');
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error creating indication:', error);
      toast.error('Erro ao criar indicação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Indicação</DialogTitle>
          {client && (
            <p className="text-sm text-muted-foreground">
              Indicação de: <span className="font-medium">{client.name}</span>
            </p>
          )}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="indication_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Indicação</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                        <RadioGroupItem value="call" id="call" />
                        <label htmlFor="call" className="flex items-center gap-2 cursor-pointer">
                          <Phone className="w-4 h-4 text-primary" />
                          <div>
                            <p className="font-medium">Indicação Call</p>
                            <p className="text-xs text-muted-foreground">Nova call de vendas</p>
                          </div>
                        </label>
                      </div>
                      <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                        <RadioGroupItem value="intensivo" id="intensivo" />
                        <label htmlFor="intensivo" className="flex items-center gap-2 cursor-pointer">
                          <Zap className="w-4 h-4 text-yellow-500" />
                          <div>
                            <p className="font-medium">Intensivo</p>
                            <p className="text-xs text-muted-foreground">Alta Performance</p>
                          </div>
                        </label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="indicated_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Indicado</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome completo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="indicated_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input placeholder="(11) 99999-9999" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="indicated_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (opcional)</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="email@exemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações (opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Informações adicionais sobre o indicado..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : 'Criar Indicação'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
