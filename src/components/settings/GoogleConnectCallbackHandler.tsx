import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const PENDING_KEY = "google_connect_pending";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSession(maxAttempts = 10, delayMs = 250) {
  for (let i = 0; i < maxAttempts; i++) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session) return data.session;
    await sleep(delayMs);
  }
  return null;
}

export function GoogleConnectCallbackHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const pending = sessionStorage.getItem(PENDING_KEY);
    if (!pending) return;

    const params = new URLSearchParams(location.search);
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    // If provider returned an explicit error, forward it to /settings so UI can render it.
    if (error) {
      sessionStorage.removeItem(PENDING_KEY);
      const qs = new URLSearchParams();
      qs.set("error", error);
      if (errorDescription) qs.set("error_description", errorDescription);
      navigate(`/settings?${qs.toString()}`, { replace: true });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // Give the auth client a moment to exchange the code for a session.
        const session = await waitForSession();
        if (cancelled) return;

        if (!session?.user) {
          sessionStorage.removeItem(PENDING_KEY);
          navigate(
            "/settings?error=session_missing&error_description=Não%20foi%20possível%20finalizar%20a%20conexão.",
            { replace: true }
          );
          return;
        }

        // Fetch linked identities to pick the Google email.
        const { data: identitiesData } = await supabase.auth.getUserIdentities();
        const googleIdentity = identitiesData?.identities?.find(
          (i) => i.provider === "google"
        );

        const googleEmail =
          (googleIdentity as any)?.identity_data?.email ?? null;

        const providerToken = session.provider_token ?? null;
        const providerRefreshToken = session.provider_refresh_token ?? null;

        if (!providerToken) {
          sessionStorage.removeItem(PENDING_KEY);
          navigate(
            "/settings?error=missing_provider_token&error_description=O%20Google%20não%20retornou%20um%20token%20de%20acesso.%20Tente%20novamente.",
            { replace: true }
          );
          return;
        }

        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            google_connected: true,
            google_email: googleEmail,
            google_access_token: providerToken,
            google_refresh_token: providerRefreshToken,
            google_token_expires_at: null,
          })
          .eq("user_id", session.user.id);

        sessionStorage.removeItem(PENDING_KEY);

        if (updateError) {
          const qs = new URLSearchParams();
          qs.set("error", "profile_update_failed");
          qs.set("error_description", updateError.message);
          navigate(`/settings?${qs.toString()}`, { replace: true });
          return;
        }

        // Final redirect to settings (removes OAuth params from the URL).
        navigate("/settings", { replace: true });
      } catch (e: any) {
        sessionStorage.removeItem(PENDING_KEY);
        const qs = new URLSearchParams();
        qs.set("error", "callback_failed");
        qs.set(
          "error_description",
          e?.message ?? "Erro inesperado ao finalizar a conexão."
        );
        navigate(`/settings?${qs.toString()}`, { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.search, navigate]);

  return null;
}
