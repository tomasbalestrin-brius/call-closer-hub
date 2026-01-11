// Intensivo CRM Types

export type IntensiveLeadStatus = 
  | 'abordagem_inicial'
  | 'nivel_consciencia'
  | 'convite_intensivo'
  | 'aguardando_confirmacao'
  | 'confirmados'
  | 'ingresso_retirado'
  | 'aquecimento_30d'
  | 'aquecimento_15d'
  | 'aquecimento_7d'
  | 'aquecimento_1d'
  | 'compareceram'
  | 'nao_compareceram'
  | 'sem_interesse'
  | 'proximo_intensivo';

export interface IntensiveEdition {
  id: string;
  name: string;
  event_date: string;
  location: string | null;
  description: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface IntensiveLead {
  id: string;
  edition_id: string;
  closer_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  niche: string | null;
  status: IntensiveLeadStatus;
  status_changed_at: string;
  source: string | null;
  source_client_id: string | null;
  source_student_id: string | null;
  indication_id: string | null;
  confirmed_at: string | null;
  ticket_retrieved_at: string | null;
  attended_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntensiveLeadNote {
  id: string;
  lead_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface IntensiveKanbanColumn {
  id: IntensiveLeadStatus;
  title: string;
  icon: string;
  color: string;
}

export const INTENSIVE_COLUMNS: IntensiveKanbanColumn[] = [
  { id: 'abordagem_inicial', title: 'Abordagem Inicial', icon: 'MessageSquare', color: 'bg-blue-500' },
  { id: 'nivel_consciencia', title: 'Nível de Consciência', icon: 'Brain', color: 'bg-purple-500' },
  { id: 'convite_intensivo', title: 'Convite pro Intensivo', icon: 'Send', color: 'bg-cyan-500' },
  { id: 'aguardando_confirmacao', title: 'Aguardando Confirmação', icon: 'Clock', color: 'bg-yellow-500' },
  { id: 'confirmados', title: 'Confirmados', icon: 'CheckCircle', color: 'bg-green-500' },
  { id: 'ingresso_retirado', title: 'Retirado o Ingresso', icon: 'Ticket', color: 'bg-emerald-500' },
  { id: 'aquecimento_30d', title: 'Aquecimento -30 dias', icon: 'Flame', color: 'bg-orange-300' },
  { id: 'aquecimento_15d', title: 'Aquecimento -15 dias', icon: 'Flame', color: 'bg-orange-400' },
  { id: 'aquecimento_7d', title: 'Aquecimento -7 dias', icon: 'Flame', color: 'bg-orange-500' },
  { id: 'aquecimento_1d', title: 'Aquecimento -1 dia', icon: 'Flame', color: 'bg-red-500' },
  { id: 'compareceram', title: 'Compareceram', icon: 'UserCheck', color: 'bg-green-700' },
  { id: 'nao_compareceram', title: 'Não Compareceram', icon: 'UserX', color: 'bg-red-600' },
  { id: 'sem_interesse', title: 'Não tem interesse', icon: 'XCircle', color: 'bg-gray-500' },
  { id: 'proximo_intensivo', title: 'Chamar no Próximo', icon: 'Calendar', color: 'bg-indigo-500' },
];

export const INTENSIVE_STATUS_LABELS: Record<IntensiveLeadStatus, string> = {
  'abordagem_inicial': 'Abordagem Inicial',
  'nivel_consciencia': 'Nível de Consciência',
  'convite_intensivo': 'Convite pro Intensivo',
  'aguardando_confirmacao': 'Aguardando Confirmação',
  'confirmados': 'Confirmados',
  'ingresso_retirado': 'Retirado o Ingresso',
  'aquecimento_30d': 'Aquecimento -30 dias',
  'aquecimento_15d': 'Aquecimento -15 dias',
  'aquecimento_7d': 'Aquecimento -7 dias',
  'aquecimento_1d': 'Aquecimento -1 dia',
  'compareceram': 'Compareceram',
  'nao_compareceram': 'Não Compareceram',
  'sem_interesse': 'Não tem interesse',
  'proximo_intensivo': 'Chamar no Próximo',
};
