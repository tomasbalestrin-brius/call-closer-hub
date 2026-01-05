import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  XCircle, 
  Loader2,
  Link as LinkIcon,
  Mail
} from 'lucide-react';
import { toast } from 'sonner';

// Google Drive icon component
function GoogleDriveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.71 3.5L1.15 15l3.43 5.98 6.56-11.47L7.71 3.5zm8.58 0L4.84 21.5h6.86l11.45-18H16.29zm-3.67 6.42l-3.43 5.98 3.43 5.98L22.85 15l-10.23-5.08z"/>
    </svg>
  );
}

interface GoogleProfile {
  google_connected: boolean;
  google_email: string | null;
}

export function GoogleIntegration() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [profile, setProfile] = useState<GoogleProfile | null>(null);

  useEffect(() => {
    if (user) {
      fetchGoogleStatus();
    }
  }, [user]);

  const fetchGoogleStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('google_connected, google_email')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching Google status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGoogle = async () => {
    setConnecting(true);
    
    try {
      // Use Supabase OAuth with Google
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/settings`,
          scopes: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/documents.readonly',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
      
      // The user will be redirected to Google for authorization
    } catch (error: any) {
      console.error('Error connecting Google:', error);
      toast.error('Erro ao conectar com Google. Tente novamente.');
      setConnecting(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          google_connected: false,
          google_email: null,
          google_access_token: null,
          google_refresh_token: null,
          google_token_expires_at: null,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setProfile({ google_connected: false, google_email: null });
      toast.success('Google desconectado com sucesso');
    } catch (error) {
      console.error('Error disconnecting Google:', error);
      toast.error('Erro ao desconectar Google');
    }
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
    <Card>
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2">
          <GoogleDriveIcon className="w-5 h-5" />
          Integração Google Drive
        </CardTitle>
        <CardDescription>
          Conecte sua conta Google para importar transcrições automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {profile?.google_connected ? (
          <>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20">
              <CheckCircle className="w-6 h-6 text-success" />
              <div className="flex-1">
                <p className="font-medium text-success">Conta conectada</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {profile.google_email}
                </p>
              </div>
              <Badge variant="default" className="bg-success">Ativo</Badge>
            </div>
            <Button 
              variant="outline" 
              onClick={handleDisconnectGoogle}
              className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Desconectar Google
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted border">
              <XCircle className="w-6 h-6 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium">Conta não conectada</p>
                <p className="text-sm text-muted-foreground">
                  Conecte sua conta para começar a importar transcrições
                </p>
              </div>
              <Badge variant="secondary">Pendente</Badge>
            </div>
            <Button 
              onClick={handleConnectGoogle}
              className="gradient-primary"
              disabled={connecting}
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <LinkIcon className="w-4 h-4 mr-2" />
              )}
              {connecting ? 'Conectando...' : 'Conectar Google Drive'}
            </Button>
          </>
        )}

        <div className="pt-4 border-t">
          <h4 className="font-medium mb-2">Permissões solicitadas:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Ler arquivos do Google Drive</li>
            <li>• Ler documentos do Google Docs</li>
            <li>• Acesso apenas leitura (não modifica nada)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
