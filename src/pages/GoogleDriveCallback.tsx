import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, CheckCircle, XCircle, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type CallbackStatus = 'processing' | 'importing' | 'success' | 'error';

export default function GoogleDriveCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<CallbackStatus>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const storedState = sessionStorage.getItem('google_oauth_state');
      const returnedState = searchParams.get('state');

      // Check for errors from Google
      if (error) {
        console.error('Google OAuth error:', error);
        setStatus('error');
        setErrorMessage(error === 'access_denied' 
          ? 'Você cancelou a autorização do Google Drive.'
          : `Erro do Google: ${error}`
        );
        return;
      }

      // Validate state for CSRF protection
      if (!storedState || storedState !== returnedState) {
        console.error('State mismatch - possible CSRF attack');
        setStatus('error');
        setErrorMessage('Erro de segurança: estado inválido. Por favor, tente novamente.');
        return;
      }

      if (!code) {
        setStatus('error');
        setErrorMessage('Código de autorização não encontrado.');
        return;
      }

      if (!user) {
        // Wait for user to be loaded
        return;
      }

      try {
        // Get the redirect URI (must match exactly what was used in the auth request)
        const redirectUri = `${window.location.origin}/google-drive-callback`;

        // Call our edge function to exchange the code for tokens
        const { data, error: fnError } = await supabase.functions.invoke('google-auth-callback', {
          body: { code, redirectUri, userId: user.id }
        });

        if (fnError) {
          console.error('Edge function error:', fnError);
          throw new Error(fnError.message || 'Erro ao conectar com Google Drive');
        }

        if (data?.error) {
          throw new Error(data.error);
        }
        
        // Clean up
        sessionStorage.removeItem('google_oauth_state');
        
        // Now start the initial import
        setStatus('importing');
        setImportProgress('Buscando arquivos do mês atual...');

        try {
          // Get folder settings from profile
          const { data: profileData } = await supabase
            .from('profiles')
            .select('drive_folder_id')
            .eq('user_id', user.id)
            .single();
          
          const { data: importData, error: importError } = await supabase.functions.invoke('initial-import', {
            body: { 
              userId: user.id,
              folderId: profileData?.drive_folder_id || null
            }
          });

          if (importError) {
            console.error('Initial import error:', importError);
            // Don't fail the whole process, just log the error
          } else {
            if (importData?.imported > 0) {
              setImportProgress(`${importData.imported} arquivos importados!`);
            } else if (importData?.message === 'No files to import') {
              setImportProgress('Nenhum arquivo encontrado no mês atual.');
            }
          }
        } catch (importErr) {
          console.error('Error during initial import:', importErr);
          // Don't fail, continue to success
        }

        setStatus('success');

        // Redirect to settings after a brief delay
        setTimeout(() => {
          navigate('/settings', { replace: true });
        }, 3000);

      } catch (err: unknown) {
        console.error('Callback error:', err);
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Erro ao conectar Google Drive');
      }
    };

    if (user) {
      handleCallback();
    }
  }, [searchParams, user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          {status === 'processing' && (
            <div className="text-center space-y-4">
              <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
              <h2 className="text-xl font-semibold">Conectando Google Drive...</h2>
              <p className="text-muted-foreground">
                Aguarde enquanto finalizamos a conexão.
              </p>
            </div>
          )}

          {status === 'importing' && (
            <div className="text-center space-y-4">
              <div className="relative mx-auto w-12 h-12">
                <FileText className="w-12 h-12 text-primary" />
                <Loader2 className="w-6 h-6 absolute -bottom-1 -right-1 animate-spin text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Importando arquivos...</h2>
              <p className="text-muted-foreground">
                {importProgress || 'Buscando transcrições do mês atual...'}
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-semibold text-green-700 dark:text-green-300">
                Google Drive Conectado!
              </h2>
              <p className="text-muted-foreground">
                {importProgress || 'Redirecionando para configurações...'}
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-red-700 dark:text-red-300">
                Erro na Conexão
              </h2>
              <p className="text-muted-foreground">
                {errorMessage || 'Não foi possível conectar com o Google Drive.'}
              </p>
              <Button onClick={() => navigate('/settings')} className="mt-4">
                Voltar para Configurações
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
