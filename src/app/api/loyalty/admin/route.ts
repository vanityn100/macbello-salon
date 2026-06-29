import { NextRequest, NextResponse } from "next/server";
import { logError } from '@/lib/logger';
import { supabase, getSupabaseAdmin } from "@/lib/supabase";
import { normalizePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

interface AuthenticatedUser {
  email: string;
  role: "admin" | "staff";
  branch: string | null;
}

// Authenticate staff helper retrieving role and branch from Supabase app_metadata
async function authenticateStaff(request: NextRequest): Promise<AuthenticatedUser | null> {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.split(" ")[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user || !user.email) return null;

  const role = user.app_metadata?.role;
  if (role !== "staff" && role !== "admin") return null;

  return {
    email: user.email,
    role: role as "admin" | "staff",
    branch: user.app_metadata?.branch || null
  };
}

// Audit helper
async function logSecurityAction(
  adminSupabase: any,
  user: AuthenticatedUser,
  action: string,
  details: string
) {
  try {
    await adminSupabase.from("audit_logs").insert([{
      user_id: user.email,
      role: user.role,
      branch: user.branch || "All",
      action,
      details
    }]);
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateStaff(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const adminSupabase = getSupabaseAdmin();

    if (action === "search") {
      const phone = searchParams.get("phone") || "";
      const phoneResult = normalizePhone(phone);
      
      if (!phoneResult.isValid || !phoneResult.normalized) {
        return NextResponse.json({ success: false, error: phoneResult.error || "Phone number required." }, { status: 400 });
      }
      const cleanPhone = phoneResult.normalized;

      let query = adminSupabase
        .from("customers")
        .select("id, name, phone, points, branch")
        .eq("status", "active")
        .ilike("phone", `%${cleanPhone}%`);

      // Customers are a global pool: any staff can search any customer
      // (Removed branch restriction here so customers can visit any branch)

      const { data: customers, error } = await query.limit(1);

      if (error) {
        console.error("Search query error:", error);
        return NextResponse.json({ success: false, error: "Failed to search customer." }, { status: 500 });
      }

      if (!customers || customers.length === 0) {
        return NextResponse.json({ success: false, error: "No customer account found." }, { status: 404 });
      }

      return NextResponse.json({ success: true, customer: customers[0] });
    }

    if (action === "history") {
      const customerId = searchParams.get("customerId");
      if (!customerId) {
        return NextResponse.json({ success: false, error: "Customer ID required." }, { status: 400 });
      }

      // Fetch customer first to check ownership (prevent IDOR)
      const { data: customer, error: custErr } = await adminSupabase
        .from("customers")
        .select("id, branch")
        .eq("id", customerId)
        .eq("status", "active")
        .maybeSingle();

      if (custErr || !customer) {
        return NextResponse.json({ success: false, error: "Customer profile not found." }, { status: 404 });
      }

      // Customers are a global pool, so no branch check is needed here

      // Retrieve full transaction logs
      const { data: transactions, error } = await adminSupabase
        .from("transactions")
        .select("id, points_change, transaction_type, branch, notes, balance_after, created_by_email, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("History query error:", error);
        return NextResponse.json({ success: false, error: "Failed to load transaction logs." }, { status: 500 });
      }

      return NextResponse.json({ success: true, transactions });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });

  } catch (err) {
    logError("Admin GET API", err, { req: request });
    return NextResponse.json({ success: false, error: "An unexpected error occurred. Please try again later." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateStaff(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON format." }, { status: 400 });
    }

    const { action } = body || {};
    const adminSupabase = getSupabaseAdmin();

    // Create Customer
    if (action === "create") {
      const { name, phone, email, branch } = body;

      let targetBranch = branch;
      if (user.role === "staff") {
        if (!user.branch) {
          return NextResponse.json({ success: false, error: "Staff account not assigned to a branch." }, { status: 403 });
        }
        targetBranch = user.branch; // Override request body value
      }

      if (typeof name !== "string" || name.trim() === "" || name.length > 100) {
        return NextResponse.json({ success: false, error: "Invalid name format." }, { status: 400 });
      }

      const phoneResult = normalizePhone(phone);
      if (!phoneResult.isValid || !phoneResult.normalized) {
        return NextResponse.json({ success: false, error: phoneResult.error || "Invalid phone number format." }, { status: 400 });
      }
      const cleanPhone = phoneResult.normalized;

      // Check if duplicate profile exists by phone
      const { data: existingCustomer } = await adminSupabase
        .from("customers")
        .select("id")
        .eq("phone", cleanPhone)
        .eq("status", "active")
        .maybeSingle();

      if (existingCustomer) {
        return NextResponse.json({ success: false, error: "A customer profile already exists for this phone number." }, { status: 409 });
      }

      let cleanEmail = null;
      if (email && typeof email === "string" && email.trim() !== "") {
        cleanEmail = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
          return NextResponse.json({ success: false, error: "Invalid email format." }, { status: 400 });
        }

        const { data: existingEmailCustomer } = await adminSupabase
          .from("customers")
          .select("id")
          .eq("email", cleanEmail)
          .eq("status", "active")
          .maybeSingle();

        if (existingEmailCustomer) {
          return NextResponse.json({ success: false, error: "A customer profile already exists for this email." }, { status: 409 });
        }
      }

      // Create new customer
      const { data: newCustomer, error } = await adminSupabase
        .from("customers")
        .insert([{
          name: name.trim(),
          phone: cleanPhone,
          email: cleanEmail,
          branch: targetBranch,
          points: 0,
          status: "active"
        }])
        .select("id, name, phone, email, points, branch")
        .single();

      if (error) {
        console.error("Customer creation error:", error);
        return NextResponse.json({ success: false, error: "Failed to create customer." }, { status: 500 });
      }

      await logSecurityAction(adminSupabase, user, "create_customer", `Registered customer: ${name.trim()} (${cleanPhone}) at branch ${targetBranch}`);
      return NextResponse.json({ success: true, customer: newCustomer });
    }

    // Points Modification: Add or Redeem Points
    if (action === "modify_points") {
      const { customerId, type, pointsChange, branch, notes } = body;

      if (!customerId || !type || !pointsChange) {
        return NextResponse.json({ success: false, error: "Missing required fields." }, { status: 400 });
      }

      if (!["add", "redeem"].includes(type)) {
        return NextResponse.json({ success: false, error: "Invalid transaction type." }, { status: 400 });
      }

      let targetBranch = branch;
      if (user.role === "staff") {
        if (!user.branch) {
          return NextResponse.json({ success: false, error: "Staff account not assigned to a branch." }, { status: 403 });
        }
        targetBranch = user.branch; // Override request body value
      } else {
        // Admin branch validation
        if (!targetBranch) {
          return NextResponse.json({ success: false, error: "Invalid branch location." }, { status: 400 });
        }
      }

      // Validate point values (positive integers only)
      const parsedPoints = Number(pointsChange);
      if (!Number.isInteger(parsedPoints) || parsedPoints <= 0) {
        return NextResponse.json({ success: false, error: "Points value must be a positive integer." }, { status: 400 });
      }

      // Fetch current customer profile to perform updates and checks (prevent IDOR)
      const { data: customer, error: fetchError } = await adminSupabase
        .from("customers")
        .select("id, points, branch")
        .eq("id", customerId)
        .eq("status", "active")
        .maybeSingle();

      if (fetchError || !customer) {
        return NextResponse.json({ success: false, error: "Customer not found." }, { status: 404 });
      }

      // Customers are a global pool, so no branch check is needed here

      let newBalance = customer.points;
      if (type === "add") {
        newBalance += parsedPoints;
      } else {
        if (customer.points < parsedPoints) {
          return NextResponse.json({ success: false, error: "Insufficient points balance." }, { status: 400 });
        }
        newBalance -= parsedPoints;
      }

      // 1. Update customer point total
      const { error: updateError } = await adminSupabase
        .from("customers")
        .update({ points: newBalance })
        .eq("id", customerId);

      if (updateError) {
        console.error("Update points error:", updateError);
        return NextResponse.json({ success: false, error: "Failed to update points balance." }, { status: 500 });
      }

      // 2. Insert transaction audit log
      const { error: txError } = await adminSupabase
        .from("transactions")
        .insert([
          {
            customer_id: customerId,
            points_change: type === "add" ? parsedPoints : -parsedPoints,
            transaction_type: type,
            branch: targetBranch,
            notes: notes ? sanitizeInput(notes) : "",
            balance_after: newBalance,
            created_by_email: user.email
          }
        ]);

      if (txError) {
        console.error("Insert transaction error:", txError);
        // Rollback customer points back if logging fails (vital for consistency)
        await adminSupabase.from("customers").update({ points: customer.points }).eq("id", customerId);
        return NextResponse.json({ success: false, error: "Failed to log transaction audit." }, { status: 500 });
      }

      await logSecurityAction(adminSupabase, user, "customer_edit", `Modified loyalty points for customer ID: ${customerId} (${type} ${parsedPoints} points) at branch ${targetBranch}`);
      return NextResponse.json({ success: true, newBalance });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });

  } catch (err) {
    logError("Admin POST API", err, { req: request });
    return NextResponse.json({ success: false, error: "An unexpected error occurred. Please try again later." }, { status: 500 });
  }
}

// Simple HTML/Input escape script
function sanitizeInput(input: string): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}
