import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

// In-memory rate limiter: Map of ip-email -> { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_ATTEMPTS) {
    return false;
  }

  record.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const { email, password, expectedRole } = body;

    if (!email || !password || !expectedRole) {
      return NextResponse.json({ success: false, error: "Invalid request payload." }, { status: 400 });
    }

    // Rate Limiting by IP + Email
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const cleanEmail = email.trim().toLowerCase();
    const rateLimitKey = `${ip}-${cleanEmail}`;

    if (!checkRateLimit(rateLimitKey)) {
      try {
        const adminSupabase = getSupabaseAdmin();
        await adminSupabase.from("audit_logs").insert([{
          user_id: cleanEmail,
          role: expectedRole,
          action: "rate_limit_exceeded",
          details: `Rate limit blocked login attempt for IP: ${ip}`,
          ip_address: ip
        }]);
      } catch (e) {
        console.error("Audit logging failed", e);
      }
      return NextResponse.json({ success: false, error: "Too many login attempts. Please try again in 15 minutes." }, { status: 429 });
    }

    // Proceed with authentication using Anon Key
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: password
    });

    if (error || !data.session) {
      // Generic error message, log to audit
      try {
        const adminSupabase = getSupabaseAdmin();
        await adminSupabase.from("audit_logs").insert([{
          user_id: cleanEmail,
          role: expectedRole,
          action: "failed_login",
          details: `Failed login attempt. Reason: ${error?.message || "Unknown error"}. IP: ${ip}`,
          ip_address: ip
        }]);
      } catch (e) {
         console.error("Audit logging failed", e);
      }
      // Return a generic authentication error
      return NextResponse.json({ success: false, error: "Invalid email or password." }, { status: 401 });
    }

    const userRole = data.session.user?.app_metadata?.role;
    
    // Admin portal requires strict 'admin' role
    // Staff portal accepts both 'staff' and 'admin' roles
    const isValidRole = expectedRole === "admin" 
      ? userRole === "admin" 
      : (userRole === "staff" || userRole === "admin");

    if (!isValidRole) {
      // Role mismatch - treat as generic failure to not expose role info
      return NextResponse.json({ success: false, error: "Invalid email or password." }, { status: 401 });
    }

    // Successful login - Log success
    try {
        const adminSupabase = getSupabaseAdmin();
        await adminSupabase.from("audit_logs").insert([{
          user_id: cleanEmail,
          role: expectedRole,
          branch: data.session.user?.app_metadata?.branch || null,
          action: "successful_login",
          details: `Successful login from IP: ${ip}`,
          ip_address: ip
        }]);
    } catch (e) {}

    return NextResponse.json({ success: true, session: data.session });

  } catch (err) {
    console.error("Login Error:", err);
    return NextResponse.json({ success: false, error: "An unexpected error occurred." }, { status: 500 });
  }
}
