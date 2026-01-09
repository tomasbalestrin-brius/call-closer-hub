-- Adicionar coluna is_super_hot para tag Super Quente
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS is_super_hot boolean DEFAULT false;

-- Criar tabela de indicações
CREATE TABLE IF NOT EXISTS indications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  indicated_by uuid NOT NULL,
  indicated_name text NOT NULL,
  indicated_phone text NOT NULL,
  indicated_email text,
  indication_type text NOT NULL CHECK (indication_type IN ('call', 'intensivo')),
  notes text,
  status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'contatado', 'convertido', 'perdido')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on indications
ALTER TABLE indications ENABLE ROW LEVEL SECURITY;

-- RLS policies for indications
CREATE POLICY "Users can view their own indications"
  ON indications FOR SELECT
  USING (auth.uid() = indicated_by);

CREATE POLICY "Users can create their own indications"
  ON indications FOR INSERT
  WITH CHECK (auth.uid() = indicated_by);

CREATE POLICY "Users can update their own indications"
  ON indications FOR UPDATE
  USING (auth.uid() = indicated_by);

CREATE POLICY "Users can delete their own indications"
  ON indications FOR DELETE
  USING (auth.uid() = indicated_by);

-- Admins can view all indications
CREATE POLICY "Admins can view all indications"
  ON indications FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Trigger for updated_at
CREATE TRIGGER update_indications_updated_at
  BEFORE UPDATE ON indications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();