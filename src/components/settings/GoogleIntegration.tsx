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
  Mail,
  FileText,
  FolderOpen,
  Shield,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { GoogleDriveImportSettings } from './GoogleDriveImportSettings';
import { toast } from 'sonner';

// Google Drive icon component using forwardRef to avoid ref warnings
const GoogleDriveIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7.71 3.5L1.15 15l3.43 5.98 6.56-11.47L7.71 3.5zm8.58 0L4.84 21.5h6.86l11.45-18H16.29zm-3.67 6.42l-3.43 5.98 3.43 5.98L22.85 15l-10.23-5.08z"/>
  </svg>
);

interface GoogleProfile {
  google_connected: boolean;
  google_email: string | null;
}

type ConnectionStep = "intro" | "permissions" | "connecting" | "success" | "error";

type FriendlyError = {
  message: string;
  causes?: string[];
};

function toFriendlyGoogleConnectError(err: unknown): FriendlyError {
  const message =
    typeof err === "string"
      ? err
      : (err as { message?: string; error_description?: string })?.message || 
        (err as { message?: string; error_description?: string })?.error_description || "";

  const lower = message.toLowerCase();

  if (lower.includes("invalid_client")) {
    return {
      message:
        "Credenciais OAuth inválidas (invalid_client). Confirme Client ID/Secret e os domínios/redirects autorizados no Google.",
    };
  }

  if (lower.includes("not configured")) {
    return {
      message:
        "OAuth do Google não configurado. Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nos Secrets do backend.",
      causes: [
        "GOOGLE_CLIENT_ID não configurado",
        "GOOGLE_CLIENT_SECRET não configurado",
      ],
    };
  }

  return {
    message:
      message || "Erro ao conectar com Google. Verifique as configurações OAuth e tente novamente.",
  };
}

export function GoogleIntegration() {
  const [showImportSettings, setShowImportSettings] = useState(false);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<GoogleProfile | null>(null);
  const [currentStep, setCurrentStep] = useState<ConnectionStep>("intro");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCauses, setErrorCauses] = useState<string[] | null>(null);

  useEffect(() => {
    if (user) {
      fetchGoogleStatus();
    }
  }, [user]);

  // Check URL for OAuth callback errors
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    if (error) {
      const friendly = toFriendlyGoogleConnectError(errorDescription || error);
      setCurrentStep("error");
      setErrorMessage(friendly.message);
      setErrorCauses(friendly.causes ?? null);

      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const fetchGoogleStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("google_connected, google_email")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);

      if (data?.google_connected) {
        setCurrentStep("success");
      }
    } catch (error) {
      console.error("Error fetching Google status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartConnection = () => {
    setCurrentStep("permissions");
    setErrorMessage(null);
    setErrorCauses(null);
  };

  const handleConnectGoogle = async () => {
    setCurrentStep("connecting");

    try {
      const redirectUri = `${window.location.origin}/google-drive-callback`;

      // Call edge function to get auth URL
      const { data, error } = await supabase.functions.invoke('google-auth-url', {
        body: { redirectUri }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Store state for CSRF protection
      sessionStorage.setItem('google_oauth_state', data.state);

      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    } catch (error: unknown) {
      console.error("Error connecting Google:", error);

      const friendly = toFriendlyGoogleConnectError(error);
      setCurrentStep("error");
      setErrorMessage(friendly.message);
      setErrorCauses(friendly.causes ?? null);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          google_connected: false,
          google_email: null,
          google_access_token: null,
          google_refresh_token: null,
          google_token_expires_at: null,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      setProfile({ google_connected: false, google_email: null });
      setCurrentStep("intro");
      toast.success("Google desconectado com sucesso");
    } catch (error) {
      console.error("Error disconnecting Google:", error);
      toast.error("Erro ao desconectar Google");
    }
  };

  const handleRetry = () => {
    setCurrentStep("intro");
    setErrorMessage(null);
    setErrorCauses(null);
  };

  if (loading) {
    return (
      <Card className="border-2">
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando status da integração...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-500/10 via-green-500/10 to-yellow-500/10 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <GoogleDriveIcon className="w-6 h-6 text-[#4285F4]" />
          </div>
          <div>
            <CardTitle className="font-display text-lg">Integração Google Drive</CardTitle>
            <CardDescription>
              Conecte sua conta para importar transcrições automaticamente
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        {/* Step Indicator */}
        {currentStep !== 'success' && currentStep !== 'error' && (
          <div className="flex items-center justify-center mb-6 pb-6 border-b">
            <StepIndicator 
              steps={['Início', 'Permissões', 'Conectar']} 
              currentStep={currentStep === 'intro' ? 0 : currentStep === 'permissions' ? 1 : 2} 
            />
          </div>
        )}

        {/* Intro Step */}
        {currentStep === 'intro' && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Comece a importar suas transcrições</h3>
              <p className="text-muted-foreground text-sm">
                Conecte seu Google Drive para importar automaticamente os documentos de transcrição das suas calls.
              </p>
            </div>

            <div className="grid gap-3">
              <FeatureItem 
                icon={<FileText className="w-5 h-5 text-blue-500" />}
                title="Importação Automática"
                description="Detectamos novos documentos e importamos automaticamente"
              />
              <FeatureItem 
                icon={<FolderOpen className="w-5 h-5 text-green-500" />}
                title="Acesso Somente Leitura"
                description="Nunca modificamos ou deletamos seus arquivos"
              />
              <FeatureItem 
                icon={<Shield className="w-5 h-5 text-purple-500" />}
                title="100% Seguro"
                description="Você pode revogar o acesso a qualquer momento"
              />
            </div>

            <Button 
              onClick={handleStartConnection}
              className="w-full h-12 text-base font-medium bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              Começar Conexão
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}

        {/* Permissions Step */}
        {currentStep === 'permissions' && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Permissões Necessárias</h3>
              <p className="text-muted-foreground text-sm">
                Veja exatamente o que o aplicativo poderá acessar
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <PermissionItem 
                title="Ver arquivos do Google Drive"
                description="Acesso apenas leitura aos seus arquivos"
                allowed
              />
              <PermissionItem 
                title="Ler documentos do Google Docs"
                description="Para extrair o conteúdo das transcrições"
                allowed
              />
              <PermissionItem 
                title="Modificar ou deletar arquivos"
                description="Nunca faremos alterações nos seus arquivos"
                allowed={false}
              />
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Nota:</strong> Você será redirecionado para o Google para autorizar. 
                Após autorizar, você voltará automaticamente para esta página.
              </p>
            </div>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep('intro')}
                className="flex-1"
              >
                Voltar
              </Button>
              <Button 
                onClick={handleConnectGoogle}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Autorizar com Google
              </Button>
            </div>
          </div>
        )}

        {/* Connecting Step */}
        {currentStep === 'connecting' && (
          <div className="py-8 text-center space-y-4">
            <div className="relative mx-auto w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-blue-100 dark:border-blue-900"></div>
              <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
              <GoogleDriveIcon className="absolute inset-0 m-auto w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Conectando ao Google...</h3>
              <p className="text-muted-foreground text-sm">
                Aguarde enquanto redirecionamos você
              </p>
            </div>
          </div>
        )}

        {/* Success Step */}
        {currentStep === 'success' && (
          <div className="space-y-6">
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-5">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-green-800 dark:text-green-200">
                      Conta Conectada com Sucesso!
                    </h3>
                    <Badge className="bg-green-600 hover:bg-green-600">Ativo</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-sm text-green-700 dark:text-green-300">
                    <Mail className="w-4 h-4" />
                    <span>{profile?.google_email || 'Email não disponível'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Import Settings Button */}
            <Button
              variant="outline"
              onClick={() => setShowImportSettings(!showImportSettings)}
              className="w-full justify-between"
            >
              <span className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Configurar Importação
              </span>
              <ArrowRight className={`w-4 h-4 transition-transform ${showImportSettings ? 'rotate-90' : ''}`} />
            </Button>

            {/* Import Settings Panel */}
            {showImportSettings && (
              <div className="animate-in slide-in-from-top-2">
                <GoogleDriveImportSettings />
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-3">O que acontece agora?</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Configure a pasta e padrões de importação acima
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Suas transcrições serão importadas automaticamente
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Você pode desconectar a qualquer momento
                </li>
              </ul>
            </div>

            <Button 
              variant="outline" 
              onClick={handleDisconnectGoogle}
              className="w-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Desconectar Google Drive
            </Button>
          </div>
        )}

        {/* Error Step */}
        {currentStep === 'error' && (
          <div className="space-y-6">
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-5">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-red-100 dark:bg-red-900 rounded-full">
                  <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-red-800 dark:text-red-200">
                    Erro na Conexão
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {errorMessage || 'Não foi possível conectar com o Google. Por favor, tente novamente.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">Possíveis causas:</h4>
              <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                {(errorCauses ?? [
                  'Credenciais OAuth do Google não configuradas corretamente',
                  'Domínio de redirecionamento não autorizado no Google Cloud',
                  'Conexão cancelada durante a autorização',
                ]).map((cause) => (
                  <li key={cause}>• {cause}</li>
                ))}
              </ul>
              {errorCauses && (
                <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                  Dica: abra o backend do Lovable Cloud e procure por uma opção chamada “Manual linking / Vinculação manual”.
                </p>
              )}
            </div>

            <Button 
              onClick={handleRetry}
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Step Indicator Component
function StepIndicator({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center">
          <div className={`
            flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors
            ${index <= currentStep 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground'
            }
          `}>
            {index < currentStep ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              index + 1
            )}
          </div>
          <span className={`ml-2 text-sm ${index <= currentStep ? 'font-medium' : 'text-muted-foreground'}`}>
            {step}
          </span>
          {index < steps.length - 1 && (
            <div className={`w-8 h-0.5 mx-2 ${index < currentStep ? 'bg-primary' : 'bg-muted'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// Feature Item Component
function FeatureItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
      <div className="mt-0.5">{icon}</div>
      <div>
        <h4 className="font-medium text-sm">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// Permission Item Component
function PermissionItem({ title, description, allowed }: { title: string; description: string; allowed: boolean }) {
  return (
    <div className="flex items-start gap-3">
      {allowed ? (
        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
      ) : (
        <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
      )}
      <div>
        <h4 className={`font-medium text-sm ${!allowed ? 'line-through text-muted-foreground' : ''}`}>
          {title}
        </h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
