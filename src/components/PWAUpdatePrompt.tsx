import { useEffect } from 'react';
import { toast } from 'sonner';

export default function PWAUpdatePrompt() {
  useEffect(() => {
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      toast.info('Atualizando para nova versão...');
      setTimeout(() => window.location.reload(), 500);
    };
    navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange);
  }, []);

  return null;
}
