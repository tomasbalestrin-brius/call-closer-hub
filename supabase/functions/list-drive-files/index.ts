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
  
  // If token expires in less than 5 minutes, refresh it
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
      const error = await tokenResponse.text();
      console.error("Token refresh failed:", error);
      throw new Error("Failed to refresh Google token");
    }
    
    const tokens = await tokenResponse.json();
    const newExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();
    
    // Update tokens in database
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    await supabase
      .from("profiles")
      .update({
        google_access_token: tokens.access_token,
        google_token_expires_at: newExpiresAt,
      } as Record<string, unknown>)
      .eq("user_id", profile.user_id);
    
    console.log("Token refreshed successfully");
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

    // Get userId from JWT token or body
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    
    if (authHeader) {
      const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;
      }
    }

    const body = await req.json().catch(() => ({}));
    const { folderId, dateFrom, dateTo, foldersOnly } = body;
    
    // Allow userId from body as fallback (for internal calls)
    if (!userId && body.userId) {
      userId = body.userId;
    }
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user profile with Google tokens
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, google_access_token, google_refresh_token, google_token_expires_at, drive_folder_id")
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

    // Build query for Google Drive API
    const targetFolderId = folderId || "root";
    let query = `'${targetFolderId}' in parents and trashed = false`;
    
    if (foldersOnly) {
      // Only get folders
      query += ` and mimeType = 'application/vnd.google-apps.folder'`;
    } else {
      // Add date filters if provided
      if (dateFrom) {
        query += ` and createdTime >= '${dateFrom}'`;
      }
      if (dateTo) {
        query += ` and createdTime <= '${dateTo}'`;
      }
      
      // Only get documents (Google Docs, text files, PDFs)
      query += ` and (mimeType = 'application/vnd.google-apps.document' or mimeType = 'text/plain' or mimeType = 'application/pdf' or mimeType = 'application/vnd.google-apps.folder')`;
    }

    console.log("Fetching files with query:", query);

    const filesResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,createdTime,modifiedTime)&orderBy=name`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!filesResponse.ok) {
      const error = await filesResponse.text();
      console.error("Failed to list files:", error);
      return new Response(
        JSON.stringify({ error: "Failed to list Google Drive files" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const filesData = await filesResponse.json();
    console.log(`Found ${filesData.files?.length || 0} files`);

    return new Response(
      JSON.stringify({ files: filesData.files || [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in list-drive-files:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
