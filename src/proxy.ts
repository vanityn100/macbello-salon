import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // Edge-level routing validation for loyalty admin API endpoints
  if (request.nextUrl.pathname.startsWith("/api/loyalty/admin")) {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Access Denied: Authentication token required." },
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
