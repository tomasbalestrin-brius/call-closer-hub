import { useState, useEffect } from "react";
import { Download, Smartphone, Monitor, Share, PlusSquare, MoreVertical, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) setPlatform("ios");
    else if (/android/.test(ua)) setPlatform("android");
    else setPlatform("desktop");

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="mx-auto mb-4">
              <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            </div>
            <CardTitle className="text-2xl font-display">App Instalado!</CardTitle>
            <CardDescription>
              O Bethel Closer já está instalado no seu dispositivo. Abra-o pela tela inicial.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Sistema
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 gap-6">
      <div className="text-center mb-2">
        <img src="/logo-bethel-closer.png" alt="Bethel Closer" className="h-20 w-20 mx-auto mb-4 rounded-2xl" />
        <h1 className="text-3xl font-display font-bold text-foreground">Instalar Bethel Closer</h1>
        <p className="text-muted-foreground mt-2 max-w-sm">
          Instale o app no seu dispositivo para acesso rápido, como um aplicativo nativo.
        </p>
      </div>

      {deferredPrompt && (
        <Button size="lg" onClick={handleInstall} className="gap-2 text-base px-8">
          <Download className="h-5 w-5" /> Instalar Agora
        </Button>
      )}

      <div className="grid gap-4 max-w-lg w-full">
        {platform === "ios" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Smartphone className="h-5 w-5" /> iPhone / iPad
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <div className="bg-accent text-accent-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                <p>Toque no ícone <Share className="inline h-4 w-4 mx-1" /> <strong>Compartilhar</strong> na barra do Safari</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-accent text-accent-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                <p>Role para baixo e toque em <PlusSquare className="inline h-4 w-4 mx-1" /> <strong>Adicionar à Tela de Início</strong></p>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-accent text-accent-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold shrink-0">3</div>
                <p>Toque em <strong>Adicionar</strong> para confirmar</p>
              </div>
            </CardContent>
          </Card>
        )}

        {platform === "android" && !deferredPrompt && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Smartphone className="h-5 w-5" /> Android
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <div className="bg-accent text-accent-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                <p>Toque no menu <MoreVertical className="inline h-4 w-4 mx-1" /> do navegador (3 pontos)</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-accent text-accent-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                <p>Toque em <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong></p>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-accent text-accent-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold shrink-0">3</div>
                <p>Confirme tocando em <strong>Instalar</strong></p>
              </div>
            </CardContent>
          </Card>
        )}

        {platform === "desktop" && !deferredPrompt && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Monitor className="h-5 w-5" /> Desktop
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <div className="bg-accent text-accent-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                <p>Clique no ícone de <strong>instalar</strong> na barra de endereço do navegador</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-accent text-accent-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                <p>Confirme clicando em <strong>Instalar</strong></p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Button variant="ghost" onClick={() => navigate("/")} className="mt-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Sistema
      </Button>
    </div>
  );
};

export default Install;
