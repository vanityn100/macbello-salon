import { NextRequest, NextResponse } from "next/server";
import { logError } from '@/lib/logger';
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizePhone } from "@/lib/phone";

// Sliding window IP rate limiter with automatic memory cleanup
const rateLimitMap = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 10;           // Max 10 lookups per 10 minutes
const MAX_IPS = 5000;              // Hard cap to prevent unbounded growth

// Purge stale IP entries every 10 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const active = timestamps.filter((t) => now - t < WINDOW_MS);
    if (active.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, active);
    }
  }
}, WINDOW_MS);

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const active = timestamps.filter((t) => now - t < WINDOW_MS);

  if (active.length >= MAX_REQUESTS) return true;

  // Safety valve: evict oldest entry if map is too large
  if (!rateLimitMap.has(ip) && rateLimitMap.size >= MAX_IPS) {
    const oldestKey = rateLimitMap.keys().next().value;
    if (oldestKey) rateLimitMap.delete(oldestKey);
  }

  active.push(now);
  rateLimitMap.set(ip, active);
  return false;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Content-Type
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { success: false, error: "Invalid content type." },
        { status: 400 }
      );
    }

    // 2. IP Rate Limiting
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { success: false, error: "Too many balance check requests. Please try again in 10 minutes." },
        { status: 429 }
      );
    }

    // 3. Parse JSON Body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON format." },
        { status: 400 }
      );
    }

    const { phone } = body || {};

    // Validate environment variables first to avoid runtime crashes
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase URL or service role key in public lookup route");
      return NextResponse.json(
        { success: false, error: "Database service not configured." },
        { status: 500 }
      );
    }

    // 4. Validate Phone Number Using Centralized Utility
    const phoneResult = normalizePhone(phone);
    if (!phoneResult.isValid || !phoneResult.normalized) {
      return NextResponse.json(
        { success: false, error: phoneResult.error || "Please enter a valid phone number." },
        { status: 400 }
      );
    }
    const cleanPhone = phoneResult.normalized;

    // 5. Query Private Customer Table via Secure Admin Client
    const supabase = getSupabaseAdmin();
    const { data: customer, error } = await supabase
      .from("customers")
      .select("points")
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (error) {
      console.error("Database query error in public lookup API:", error);
      return NextResponse.json(
        { success: false, error: "Failed to look up loyalty points." },
        { status: 500 }
      );
    }

    if (!customer) {
      return NextResponse.json(
        { success: false, error: "No loyalty account found." },
        { status: 404 }
      );
    }

    // 6. Return ONLY points. Zero exposure of names, phone, or logs.
    return NextResponse.json({
      success: true,
      points: customer.points
    });

  } catch (err) {
    logError("Unhandled error in loyalty lookup handler:", err, { req: request });
    return NextResponse.json({ success: false, error: "An unexpected error occurred. Please try again later." }, { status: 500 });
  }
}
