export type UserRole = 'admin' | 'lider' | 'closer';

export type CallStatus = 
  | 'pendente' 
  | 'em_andamento' 
  | 'follow_up' 
  | 'proposta_enviada' 
  | 'vendido' 
  | 'perdido';

export type LeadClassification = 'pos_venda' | 'follow';

export type CloserClassification = 'iniciante' | 'intermediario' | 'avancado' | 'alta_performance' | 'elite';

export type ClientSource = 'manual' | 'google_drive';

export type ImportStatus = 'pending' | 'processing' | 'completed' | 'error';

export type CloserLevel = 
  | 'assessor' 
  | 'executivo' 
  | 'pro' 
  | 'elite' 
  | 'especialista' 
  | 'especialista_pro' 
  | 'especialista_elite';

// Constantes para selects
export const FUNNEL_SOURCES = [
  '50 scripts',
  'Teste dos Arquetipos',
  'MPM',
  'Implementacao de IA da Julia',
  'Social Selling Julia',
  'Social Selling Cleiton',
  'Social Selling Bethel',
  'Social Selling Kennedy',
  'Formulario Instagram Cleiton',
  'Formulario Instagram Julia',
  'Formulario Instagram Bethel',
  'Formulario Instagram Kennedy',
  'Formulario Youtube',
  'Indicacao de Aluno',
  'Indicacao de Mentorado',
  'Indicacao de Vendedor',
  'Indicacao Elite Premium',
  'Implementacao Comercial',
  'Implementacao Personalizada IA',
  'Mentoria Julia',
  'Elite Premium',
  'Bethel Club'
] as const;

export const SDR_NAMES = [
  'Jaque',
  'Dienifer',
  'Nathali',
  'Thalita',
  'Maria'
] as const;

export const PRODUCTS_OFFERED = [
  'Mentoria Premium',
  'Mentoria Elite Premium',
  'Implementacao Comercial',
  'Bethel Club',
  'Intensivo da Alta Performance',
  'Implementacao de IA'
] as const;

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  google_connected: boolean;
  google_email: string | null;
  drive_folder_id: string | null;
  drive_folder_name: string | null;
  drive_last_sync: string | null;
  closer_level: CloserLevel;
  created_at: string;
  updated_at: string;
}

export interface MonthlyGoal {
  id: string;
  closer_id: string;
  month: number;
  year: number;
  goal_value: number;
  set_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface DailyVerse {
  id: string;
  day_of_year: number;
  verse_text: string;
  reference: string;
  category: string;
  created_at: string;
}

export type ClientStatus = 'call_realizada' | 'contato_agendado' | 'encaminhado_fechamento' | 'venda_realizada';

export interface Client {
  id: string;
  closer_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  revenue: number | null;
  notes: string | null;
  niche: string | null;
  has_partner: boolean | null;
  main_difficulty: string | null;
  main_pain: string | null;
  source: ClientSource | null;
  status: ClientStatus | null;
  // Sale fields
  is_sold: boolean | null;
  sold_at: string | null;
  sale_value: number | null;
  entry_value: number | null;
  negotiation_notes: string | null;
  contract_validity: string | null;
  sale_notes: string | null;
  // New fields
  funnel_source: string | null;
  sdr_name: string | null;
  product_offered: string | null;
  followup_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface StageAnalysis {
  aconteceu: 'sim' | 'parcial' | 'nao';
  nota: number;
  funcao_cumprida: string;
  ponto_forte: string;
  ponto_fraco: string;
  sugestao: string;
}

export interface TechnicalAnalysis {
  conexao?: StageAnalysis;
  abertura?: StageAnalysis;
  mapeamento_negocio?: StageAnalysis;
  mapeamento_problemas?: StageAnalysis;
  consultoria?: StageAnalysis;
  problematizacao?: StageAnalysis;
  solucao_imaginada?: StageAnalysis;
  transicao?: StageAnalysis;
  pitch?: StageAnalysis;
  perguntas_compromisso?: StageAnalysis;
  contorno_objecoes?: StageAnalysis;
  fechamento?: StageAnalysis;
}

export interface Call {
  id: string;
  closer_id: string;
  client_id: string | null;
  client_name: string;
  call_date: string;
  call_time: string | null;
  duration_minutes: number | null;
  status: CallStatus;
  score: number | null;
  product: string | null;
  sale_value: number | null;
  entry_value: number | null;
  transcription: string | null;
  notes: string | null;
  google_doc_id: string | null;
  // AI Analysis fields
  niche: string | null;
  has_partner: boolean | null;
  main_difficulty: string | null;
  main_pain: string | null;
  consciousness_level: string | null;
  decision_reason: string | null;
  ai_summary: string | null;
  lead_classification: LeadClassification | null;
  closer_classification: CloserClassification | null;
  technical_analysis: TechnicalAnalysis | null;
  main_errors: string[] | null;
  main_wins: string[] | null;
  loss_point: string | null;
  next_contact_date: string | null;
  source_file_id: string | null;
  analyzed_at: string | null;
  // New fields
  company_name: string | null;
  call_conclusion: string | null;
  observation: string | null;
  merged_with_call_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientNote {
  id: string;
  client_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

export interface ImportedFile {
  id: string;
  user_id: string;
  drive_file_id: string;
  file_name: string;
  imported_at: string;
  call_id: string | null;
  status: ImportStatus;
  error_message: string | null;
  created_at: string;
}

export interface DashboardStats {
  totalCalls: number;
  averageScore: number;
  totalSales: number;
  totalSaleValue: number;
  totalEntryValue: number;
  conversionRate: number;
}

export interface Squad {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SquadMember {
  id: string;
  squad_id: string;
  user_id: string;
  created_at: string;
}
