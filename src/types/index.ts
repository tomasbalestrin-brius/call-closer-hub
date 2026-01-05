export type UserRole = 'admin' | 'closer';

export type CallStatus = 
  | 'pendente' 
  | 'em_andamento' 
  | 'follow_up' 
  | 'proposta_enviada' 
  | 'vendido' 
  | 'perdido';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  closer_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  revenue: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
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

export interface DashboardStats {
  totalCalls: number;
  averageScore: number;
  totalSales: number;
  totalSaleValue: number;
  totalEntryValue: number;
  conversionRate: number;
}
