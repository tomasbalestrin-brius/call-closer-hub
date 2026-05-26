import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

const STATUS_LABELS: Record<string, string> = {
  // Sales pipeline
  call_realizada: 'Call Realizada',
  repitch: 'RePitch',
  pos_call_0_2: 'Pós Call 0-2 dias',
  pos_call_3_7: 'Pós Call 3-7 dias',
  pos_call_8_15: 'Pós Call 8-15 dias',
  pos_call_16_21: 'Pós Call 16-21 dias',
  sinal_compromisso: 'Sinal de Compromisso',
  venda_realizada: 'Venda Realizada',
  aluno_nao_fit: 'Aluno Não Fit',
  pos_21_carterizacao: 'Pós 21 dias - Carterização',
  intensivo_carlos: 'Intensivo (Carlos)',
  // Intensivo
  enviar_convite_intensivo: 'Enviar Convite Intensivo',
  formulario_preenchido: 'Formulário Preenchido',
  retirado_ingresso: 'Retirado o Ingresso',
  confirmado_intensivo: 'Confirmado',
};

const statusLabel = (s: string | null | undefined) => {
  if (!s) return '';
  return STATUS_LABELS[s] || s;
};

const fmtDate = (v: string | null | undefined) => {
  if (!v) return '';
  try {
    return format(new Date(v), 'dd/MM/yyyy HH:mm');
  } catch {
    return '';
  }
};

const fmtDateOnly = (v: string | null | undefined) => {
  if (!v) return '';
  try {
    return format(new Date(v), 'dd/MM/yyyy');
  } catch {
    return '';
  }
};

const fmtBool = (v: boolean | null | undefined) =>
  v === true ? 'Sim' : v === false ? 'Não' : '';

const fmtNumber = (v: number | string | null | undefined) => {
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'number' ? v : Number(v);
  if (Number.isNaN(n)) return '';
  return n.toString().replace('.', ',');
};

const escapeCsv = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[";\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const COLUMNS: Array<{ header: string; get: (c: any) => unknown }> = [
  { header: 'Nome', get: (c) => c.name },
  { header: 'Email', get: (c) => c.email },
  { header: 'Telefone', get: (c) => c.phone },
  { header: 'Empresa', get: (c) => c.company },
  { header: 'Instagram', get: (c) => c.instagram },
  { header: 'Nicho', get: (c) => c.niche },
  { header: 'Faturamento', get: (c) => fmtNumber(c.revenue) },
  { header: 'Tem Sócio', get: (c) => fmtBool(c.has_partner) },
  { header: 'SDR', get: (c) => c.sdr_name },
  { header: 'Funil', get: (c) => c.funnel_source },
  { header: 'Produto Oferecido', get: (c) => c.product_offered },
  { header: 'Origem', get: (c) => c.source },
  { header: 'Closer de Origem', get: (c) => c.origin_closer_name },
  { header: 'Indicação', get: (c) => fmtBool(c.is_from_indication) },
  { header: 'Super Quente', get: (c) => fmtBool(c.is_super_hot) },
  { header: 'Etapa Atual', get: (c) => statusLabel(c.status) },
  { header: 'Status (id)', get: (c) => c.status },
  { header: 'Mudança de Status em', get: (c) => fmtDate(c.status_changed_at) },
  { header: 'Follow-up', get: (c) => fmtDateOnly(c.followup_date) },
  { header: 'Criado em', get: (c) => fmtDate(c.created_at) },
  { header: 'Atualizado em', get: (c) => fmtDate(c.updated_at) },
  // Venda
  { header: 'Vendido', get: (c) => fmtBool(c.is_sold) },
  { header: 'Valor da Venda', get: (c) => fmtNumber(c.sale_value) },
  { header: 'Valor de Entrada', get: (c) => fmtNumber(c.entry_value) },
  { header: 'Vendido em', get: (c) => fmtDate(c.sold_at) },
  { header: 'Validade do Contrato', get: (c) => c.contract_validity },
  // Notas
  { header: 'Dor Principal', get: (c) => c.main_pain },
  { header: 'Dificuldade Principal', get: (c) => c.main_difficulty },
  { header: 'Notas Gerais', get: (c) => c.notes },
  { header: 'Notas de Negociação', get: (c) => c.negotiation_notes },
  { header: 'Notas de Venda', get: (c) => c.sale_notes },
];

async function fetchAllLeads(closerId: string) {
  const pageSize = 1000;
  let from = 0;
  const all: any[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('closer_id', closerId)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function buildCsv(rows: any[]): string {
  const header = COLUMNS.map((c) => escapeCsv(c.header)).join(';');
  const lines = rows.map((row) =>
    COLUMNS.map((c) => escapeCsv(c.get(row))).join(';')
  );
  return [header, ...lines].join('\r\n');
}

function downloadCsv(filename: string, csv: string) {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'closer';

export async function exportLeadsForCloser(closerId: string, closerName: string) {
  const leads = await fetchAllLeads(closerId);
  const csv = buildCsv(leads);
  const filename = `leads-${slug(closerName)}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  downloadCsv(filename, csv);
  return leads.length;
}
