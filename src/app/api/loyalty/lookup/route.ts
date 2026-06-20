import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// In-memory sliding window IP rate limiter
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const maxRequests = 10; // Max 10 lookups per 10 minutes

  const timestamps = rateLimitMap.get(ip) || [];
  const activeTimestamps = timestamps.filter((time) => now - time < windowMs);

  if (activeTimestamps.length >= maxRequests) {
    return true;
  }

  activeTimestamps.push(now);
  rateLimitMap.set(ip, activeTimestamps);
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

    // 4. Validate Phone Number (Allow leading plus, spaces, dashes but require digits length 10-15)
    const phoneRegex = /^\+?[0-9\s\-()]{10,15}$/;
    if (typeof phone !== "string" || !phoneRegex.test(phone)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid phone number." },
        { status: 400 }
      );
    }

    // Clean phone number for database query matching (keep only digits and optional +)
    const cleanPhone = phone.trim().replace(/[\s\-()]/g, "");

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
    console.error("Unhandled error in loyalty lookup handler:", err);
    return NextResponse.json(
      { success: false, error: "Failed to process request." },
      { status: 500 }
    );
  }
}
