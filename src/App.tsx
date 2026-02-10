import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import PWAUpdatePrompt from "@/components/PWAUpdatePrompt";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy-loaded routes
const Calls = lazy(() => import("./pages/Calls"));
const Clients = lazy(() => import("./pages/Clients"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Settings = lazy(() => import("./pages/Settings"));
const Admin = lazy(() => import("./pages/Admin"));
const SquadReports = lazy(() => import("./pages/SquadReports"));
const SquadView = lazy(() => import("./pages/SquadView"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const IntensivoCRM = lazy(() => import("./pages/IntensivoCRM"));
const GoogleDriveCallback = lazy(() => import("./pages/GoogleDriveCallback"));
const Install = lazy(() => import("./pages/Install"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

// Cache warming component - prefetches critical data after auth
function CacheWarmer() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;
    qc.prefetchQuery({
      queryKey: ['daily-verse'],
      queryFn: async () => {
        const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
        const { data } = await supabase.from('daily_verses').select('verse_text, reference, category').eq('day_of_year', dayOfYear).maybeSingle();
        return data;
      },
      staleTime: 3600_000,
    });
  }, [user?.id, qc]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CacheWarmer />
      <PWAUpdatePrompt />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/calls" element={<Calls />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/:id" element={<ClientDetail />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/squad-reports" element={<SquadReports />} />
            <Route path="/squad-view" element={<SquadView />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/intensivo-crm" element={<IntensivoCRM />} />
            <Route path="/google-drive-callback" element={<GoogleDriveCallback />} />
            <Route path="/install" element={<Install />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
