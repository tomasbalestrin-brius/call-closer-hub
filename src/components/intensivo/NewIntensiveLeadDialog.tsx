import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useIntensivoCRM } from '@/hooks/useIntensivoCRM';
import type { IntensiveLeadStatus } from '@/types/intensivo';

interface NewIntensiveLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editionId: string;
}

interface FormData {
  name: string;
  phone: string;
  email: string;
  company: string;
  niche: string;
  source: string;
  notes: string;
}

const LEAD_SOURCES = [
  'Indicação de Aluno',
  'Indicação de Mentorado',
  'Lista Própria',
  'Redes Sociais',
  'Cliente Existente',
  'Outro',
];

export function NewIntensiveLeadDialog({ 
  open, 
  onOpenChange, 
  editionId 
}: NewIntensiveLeadDialogProps) {
  const { user } = useAuth();
  const { createLead } = useIntensivoCRM(editionId);
  
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>();
  const sourceValue = watch('source');

  const onSubmit = async (data: FormData) => {
    if (!user || !editionId) return;

    await createLead.mutateAsync({
      edition_id: editionId,
      closer_id: user.id,
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      company: data.company || null,
      niche: data.niche || null,
      status: 'abordagem_inicial' as IntensiveLeadStatus,
      source: data.source || null,
      source_client_id: null,
      source_student_id: null,
      indication_id: null,
      confirmed_at: null,
      ticket_retrieved_at: null,
      attended_at: null,
      notes: data.notes || null,
      lead_temperature: 'morno' as const,
    });

    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Novo Lead do Intensivo</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              placeholder="Nome do lead"
              {...register('name', { required: 'Nome é obrigatório' })}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                placeholder="(11) 99999-9999"
                {...register('phone')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemplo.com"
                {...register('email')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Empresa</Label>
              <Input
                id="company"
                placeholder="Nome da empresa"
                {...register('company')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="niche">Nicho</Label>
              <Input
                id="niche"
                placeholder="Ex: Saúde, Tech..."
                {...register('niche')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Origem</Label>
            <Select value={sourceValue} onValueChange={(value) => setValue('source', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a origem" />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCES.map((source) => (
                  <SelectItem key={source} value={source}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Anotações sobre o lead..."
              {...register('notes')}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createLead.isPending}>
              {createLead.isPending ? 'Adicionando...' : 'Adicionar Lead'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
