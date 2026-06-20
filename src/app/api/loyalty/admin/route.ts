import { NextRequest, NextResponse } from "next/server";
import { supabase, getSupabaseAdmin } from "@/lib/supabase";

// Helper to authenticate staff using their Supabase JWT
async function authenticateStaff(request: NextRequest): Promise<{ email: string } | null> {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.split(" ")[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user || !user.email || !(user.app_metadata?.role === "staff" || user.app_metadata?.role === "admin")) {
    return null;
  }

  return { email: user.email };
}

// Allowed branches validation
const ALLOWED_BRANCHES = ["Kaduthuruthy", "Ettumanoor", "Peruva"];

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate Staff Request
    const staff = await authenticateStaff(request);
    if (!staff) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase configuration in admin route");
      return NextResponse.json({ success: false, error: "Database service not configured." }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const adminSupabase = getSupabaseAdmin();

    if (action === "search") {
      const phone = searchParams.get("phone") || "";
      const cleanPhone = phone.trim().replace(/[\s\-()]/g, "");

      if (!cleanPhone) {
        return NextResponse.json({ success: false, error: "Phone number required." }, { status: 400 });
      }

      // Search customer profiles
      const { data: customer, error } = await adminSupabase
        .from("customers")
        .select("id, name, phone, points")
        .eq("phone", cleanPhone)
        .maybeSingle();

      if (error) {
        console.error("Search query error:", error);
        return NextResponse.json({ success: false, error: "Failed to search customer." }, { status: 500 });
      }

      if (!customer) {
        return NextResponse.json({ success: false, error: "No customer account found." }, { status: 404 });
      }

      return NextResponse.json({ success: true, customer });
    }

    if (action === "history") {
      const customerId = searchParams.get("customerId");
      if (!customerId) {
        return NextResponse.json({ success: false, error: "Customer ID required." }, { status: 400 });
      }

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
    console.error("Admin GET API Error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate Staff Request
    const staff = await authenticateStaff(request);
    if (!staff) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase configuration in admin route");
      return NextResponse.json({ success: false, error: "Database service not configured." }, { status: 500 });
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
      const { name, phone } = body;

      if (typeof name !== "string" || name.trim() === "" || name.length > 100) {
        return NextResponse.json({ success: false, error: "Invalid name format." }, { status: 400 });
      }

      const phoneRegex = /^\+?[0-9\s\-()]{10,15}$/;
      if (typeof phone !== "string" || !phoneRegex.test(phone)) {
        return NextResponse.json({ success: false, error: "Invalid phone number format." }, { status: 400 });
      }

      const cleanPhone = phone.trim().replace(/[\s\-()]/g, "");

      // Check if duplicate profile exists
      const { data: existingCustomer } = await adminSupabase
        .from("customers")
        .select("id")
        .eq("phone", cleanPhone)
        .maybeSingle();

      if (existingCustomer) {
        return NextResponse.json({ success: false, error: "A customer profile already exists for this phone number." }, { status: 409 });
      }

      // Create new customer
      const { data: newCustomer, error } = await adminSupabase
        .from("customers")
        .insert([{ name: name.trim(), phone: cleanPhone, points: 0 }])
        .select("id, name, phone, points")
        .single();

      if (error) {
        console.error("Customer creation error:", error);
        return NextResponse.json({ success: false, error: "Failed to create customer." }, { status: 500 });
      }

      return NextResponse.json({ success: true, customer: newCustomer });
    }

    // Points Modification: Add or Redeem Points
    if (action === "modify_points") {
      const { customerId, type, pointsChange, branch, notes } = body;

      if (!customerId || !type || !pointsChange || !branch) {
        return NextResponse.json({ success: false, error: "Missing required fields." }, { status: 400 });
      }

      if (!["add", "redeem"].includes(type)) {
        return NextResponse.json({ success: false, error: "Invalid transaction type." }, { status: 400 });
      }

      // Validate Branch selection
      if (!ALLOWED_BRANCHES.includes(branch)) {
        return NextResponse.json({ success: false, error: "Invalid branch location." }, { status: 400 });
      }

      // Validate point values (positive integers only)
      const parsedPoints = Number(pointsChange);
      if (!Number.isInteger(parsedPoints) || parsedPoints <= 0) {
        return NextResponse.json({ success: false, error: "Points value must be a positive integer." }, { status: 400 });
      }

      // Fetch current customer profile to perform updates and calculations
      const { data: customer, error: fetchError } = await adminSupabase
        .from("customers")
        .select("id, points")
        .eq("id", customerId)
        .maybeSingle();

      if (fetchError || !customer) {
        return NextResponse.json({ success: false, error: "Customer not found." }, { status: 404 });
      }

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
            branch,
            notes: notes ? sanitizeInput(notes) : "",
            balance_after: newBalance,
            created_by_email: staff.email
          }
        ]);

      if (txError) {
        console.error("Insert transaction error:", txError);
        // Rollback customer points back if logging fails (vital for consistency)
        await adminSupabase.from("customers").update({ points: customer.points }).eq("id", customerId);
        return NextResponse.json({ success: false, error: "Failed to log transaction audit." }, { status: 500 });
      }

      return NextResponse.json({ success: true, newBalance });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });

  } catch (err) {
    console.error("Admin POST API Error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
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
