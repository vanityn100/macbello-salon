import { getSupabaseAdmin } from "./supabase";
import { NextRequest } from "next/server";

type Severity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

interface LogEntry {
  userId?: string | null;
  role?: string | null;
  branch?: string | null;
  action: string;
  details?: string;
  errorCategory?: string | null;
  severity?: Severity;
  ipAddress?: string | null;
  requestId?: string | null;
}

/**
 * Extracts client IP from NextRequest
 */
export function extractIp(req?: NextRequest | null): string | null {
  if (!req) return null;
  return req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null;
}

/**
 * Generates a simple request ID if not provided
 */
export function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Centralized logging function that securely writes to the database's audit_logs table.
 * It is completely insulated with try/catch to ensure logging failures NEVER crash the app.
 */
export async function logEvent(entry: LogEntry) {
  try {
    const adminSupabase = getSupabaseAdmin();
    
    await adminSupabase.from("audit_logs").insert([{
      user_id: entry.userId || "system",
      role: entry.role || "unknown",
      branch: entry.branch || null,
      action: entry.action,
      details: entry.details || null,
      error_category: entry.errorCategory || null,
      severity: entry.severity || "INFO",
      ip_address: entry.ipAddress || null,
      request_id: entry.requestId || generateRequestId()
    }]);
  } catch (error) {
    // We swallow the error but log it to the server console to ensure the main application flow never crashes due to a logging failure.
    console.error("FATAL: Failed to write to audit_logs:", error);
  }
}

/**
 * Convenience wrapper for logging errors
 */
export async function logError(
  action: string,
  error: any,
  context?: {
    userId?: string | null;
    role?: string | null;
    branch?: string | null;
    req?: NextRequest;
    category?: string;
    severity?: Severity;
  }
) {
  // Extract error details safely without exposing them to end users
  const errorDetails = error instanceof Error 
    ? `${error.name}: ${error.message}\nStack: ${error.stack}` 
    : JSON.stringify(error);

  console.error(`[ERROR] ${action}:`, error);

  await logEvent({
    userId: context?.userId,
    role: context?.role,
    branch: context?.branch,
    action: action,
    details: errorDetails,
    errorCategory: context?.category || "Unexpected Exception",
    severity: context?.severity || "ERROR",
    ipAddress: extractIp(context?.req),
    requestId: generateRequestId()
  });
}
