import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Edge-level auth gate for ALL admin API endpoints (billing + loyalty)
  const isAdminRoute =
    path.startsWith("/api/loyalty/admin") ||
    path.startsWith("/api/billing/admin");

  if (isAdminRoute) {
    const authHeader = request.headers.get("authorization");

    // Reject immediately if no Bearer token present — don't let request reach route handler
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Access Denied: Authentication token required." },
        { status: 401 }
      );
    }

    // Basic JWT structure check: must be 3 base64url segments separated by dots
    const token = authHeader.slice(7);
    const parts = token.split(".");
    if (parts.length !== 3) {
      return NextResponse.json(
        { success: false, error: "Access Denied: Malformed authentication token." },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

// Limit the proxy only to the protected admin API endpoints to optimize performance
export const config = {
  matcher: [
    "/api/loyalty/admin/:path*",
    "/api/billing/admin/:path*"
  ]
};
