import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

// Public client for standard user operations and auth state checks
// Uses placeholder values during build-time to prevent build failures
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Secure admin client bypassing RLS, restricted exclusively to server execution context
export const getSupabaseAdmin = () => {
  if (typeof window !== "undefined") {
    throw new Error("CRITICAL SECURITY ERROR: getSupabaseAdmin can only be executed in a server environment.");
  }
  
  const activeUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const activeServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!activeUrl || !activeServiceKey) {
    throw new Error("Missing Supabase admin configuration: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");
  }
  
  return createClient(activeUrl, activeServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};
