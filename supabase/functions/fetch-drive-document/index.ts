import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProfileWithTokens {
  user_id: string;
  google_access_token: string;
  google_refresh_token: string;
  google_token_expires_at: string;
}

async function refreshTokenIfNeeded(
  supabaseUrl: string,
  serviceRoleKey: string,
  profile: ProfileWithTokens
): Promise<string> {
  const expiresAt = new Date(profile.google_token_expires_at);
  const now = new Date();
  
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    console.log("Token expired or expiring soon, refreshing...");
    
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: profile.google_refresh_token,
        grant_type: "refresh_token",
      }),
    });
    
    if (!tokenResponse.ok) {
      throw new Error("Failed to refresh Google token");
    }
    
    const tokens = await tokenResponse.json();
    const newExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    await supabase
      .from("profiles")
      .update({
        google_access_token: tokens.access_token,
        google_token_expires_at: newExpiresAt,
      } as Record<string, unknown>)
      .eq("user_id", profile.user_id);
    
    return tokens.access_token;
  }
  
  return profile.google_access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Server configuration error");
    }

    const { userId, fileId } = await req.json();
    
    if (!userId || !fileId) {
      return new Response(
        JSON.stringify({ error: "userId and fileId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user profile with Google tokens
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, google_access_token, google_refresh_token, google_token_expires_at")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile?.google_access_token) {
      return new Response(
        JSON.stringify({ error: "Google Drive not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      profile as ProfileWithTokens
    );

    // First, get file metadata to determine type
    const metadataResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,name`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!metadataResponse.ok) {
      const error = await metadataResponse.text();
      console.error("Failed to get file metadata:", error);
      return new Response(
        JSON.stringify({ error: "Failed to get file metadata" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const metadata = await metadataResponse.json();
    console.log("File metadata:", metadata);

    let content = "";

    if (metadata.mimeType === "application/vnd.google-apps.document") {
      // Export Google Doc as plain text
      const exportResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!exportResponse.ok) {
        const error = await exportResponse.text();
        console.error("Failed to export document:", error);
        return new Response(
          JSON.stringify({ error: "Failed to export document" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      content = await exportResponse.text();
    } else if (metadata.mimeType === "text/plain") {
      // Download text file directly
      const downloadResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!downloadResponse.ok) {
        const error = await downloadResponse.text();
        console.error("Failed to download file:", error);
        return new Response(
          JSON.stringify({ error: "Failed to download file" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      content = await downloadResponse.text();
    } else {
      return new Response(
        JSON.stringify({ error: "Unsupported file type. Only Google Docs and text files are supported." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Document fetched successfully, content length: ${content.length} chars`);

    return new Response(
      JSON.stringify({ 
        content, 
        fileName: metadata.name,
        mimeType: metadata.mimeType 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in fetch-drive-document:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
