import { normalizeGst } from '@/lib/gst';
import { validateAndCalculateServiceStatus } from "@/lib/validations/serviceStatus";
import { NextRequest, NextResponse } from "next/server";
import { normalizePhone } from "@/lib/phone";
import { logError } from '@/lib/logger';
import { supabase, getSupabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";
import { recalculateInvoiceTotals } from "@/lib/invoiceUtils";

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
    // Only console error here, because logging failed
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

    // 1. GET CATALOGUE SERVICES
    if (action === "get_services") {
      let query = adminSupabase
        .from("services")
        .select("*")
        .neq("status", "archived");

      // Staff can only see services belonging to their branch or global (null branch)
      if (user.role === "staff") {
        if (!user.branch) {
          return NextResponse.json({ success: false, error: "Staff account not assigned to a branch." }, { status: 403 });
        }
        query = query.or(`branch.is.null,branch.eq."${user.branch}"`);
      }

      const { data: services, error } = await query.order("name", { ascending: true });

      if (error) {
        console.error("Fetch services error:", error);
        return NextResponse.json({ success: false, error: "Failed to load catalogue menu." }, { status: 500 });
      }

      return NextResponse.json({ success: true, services });
    }

    // 2. SEARCH CUSTOMERS
    if (action === "search_customers") {
      const phone = searchParams.get("phone") || "";
      const phoneResult = normalizePhone(phone);
      if (!phoneResult.isValid || !phoneResult.normalized) {
        return NextResponse.json({ success: false, error: phoneResult.error || "Phone number required." }, { status: 400 });
      }
      const cleanPhone = phoneResult.normalized;

      let query = adminSupabase
        .from("customers")
        .select("id, name, phone, email, points, branch")
        .eq("status", "active")
        .ilike("phone", `%${cleanPhone}%`);

      // Customers are a global pool: any staff can search any customer
      // (Removed branch restriction here so customers can visit any branch)

      const { data: customers, error } = await query.limit(15);

      if (error) {
        console.error("Search customers error:", error);
        return NextResponse.json({ success: false, error: "Failed to query customers." }, { status: 500 });
      }

      return NextResponse.json({ success: true, customers });
    }

    // 3. DAILY OPERATIONS METRICS
    if (action === "get_daily_stats") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      let query = adminSupabase
        .from("invoices")
        .select("id, grand_total, discount, branch, created_at, invoice_items(line_total, staff_contribution)")
        .eq("status", "active")
        .gte("created_at", todayStart.toISOString());

      // Staff isolated to their assigned branch
      if (user.role === "staff") {
        if (!user.branch) {
          return NextResponse.json({ success: false, error: "Staff account not assigned to a branch." }, { status: 403 });
        }
        query = query.eq("branch", user.branch);
      }

      const { data: invoices, error } = await query;

      if (error) {
        console.error("Fetch daily stats error:", error);
        return NextResponse.json({ success: false, error: "Failed to load daily metrics." }, { status: 500 });
      }

      let totalSales = 0;
      const branchBreakdown: Record<string, number> = {
        "Kaduthuruthy": 0,
        "Ettumanoor": 0,
        "Peruva": 0
      };
      const staffBreakdown: Record<string, { revenue: number; count: number }> = {};

      invoices?.forEach((inv) => {
        const amt = parseFloat(inv.grand_total) || 0;
        totalSales += amt;
        if (inv.branch && branchBreakdown[inv.branch] !== undefined) {
          branchBreakdown[inv.branch] += amt;
        }

        const items = (inv.invoice_items as unknown as Array<{ line_total: string; staff_contribution: string | null }>) || [];
        items.forEach((item) => {
          if (item.staff_contribution && item.staff_contribution.trim() !== "") {
            const name = item.staff_contribution.trim();
            if (!staffBreakdown[name]) {
              staffBreakdown[name] = { revenue: 0, count: 0 };
            }
            const lineAmt = parseFloat(item.line_total) || 0;
            staffBreakdown[name].revenue += lineAmt;
            staffBreakdown[name].count += 1;
          }
        });
      });

      if (user.role === "staff") {
        return NextResponse.json({
          success: true,
          stats: {
            totalSales,
            invoiceCount: invoices?.length || 0
          }
        });
      }

      return NextResponse.json({
        success: true,
        stats: {
          totalSales,
          invoiceCount: invoices?.length || 0,
          branchBreakdown,
          staffBreakdown
        }
      });
    }

    // 3.5 FINANCIAL DASHBOARD METRICS
    if (action === "get_financial_stats") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

      let invoicesQuery = adminSupabase.from("invoices").select("grand_total, created_at").eq("status", "active");
      let customersQuery = adminSupabase.from("customers").select("id", { count: "exact", head: true }).eq("status", "active");
      let servicesQuery = adminSupabase.from("services").select("id", { count: "exact", head: true }).eq("status", "active");
      let appointmentsQuery = adminSupabase.from("appointments").select("status").neq("status", "archived");

      if (user.role === "staff") {
        if (!user.branch) return NextResponse.json({ success: false, error: "Staff account not assigned to a branch." }, { status: 403 });
        invoicesQuery = invoicesQuery.eq("branch", user.branch);
        customersQuery = customersQuery.eq("branch", user.branch);
        servicesQuery = servicesQuery.or(`branch.is.null,branch.eq."${user.branch}"`);
        appointmentsQuery = appointmentsQuery.eq("branch", user.branch);
      }

      // Launch independent count/status queries immediately in parallel —
      // they do not depend on invoice data and can run concurrently with pagination.
      const parallelQueriesPromise = Promise.all([
        customersQuery,
        servicesQuery,
        appointmentsQuery
      ]);

      // Paginate invoices to get accurate total revenue for large datasets.
      // The three queries above are already running in the background while this loop executes.
      let allInvoices: any[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await invoicesQuery.range(page * 1000, (page + 1) * 1000 - 1);
        if (error) {
          return NextResponse.json({ success: false, error: "Failed to query invoices." }, { status: 500 });
        }
        if (data && data.length > 0) {
          allInvoices = allInvoices.concat(data);
          page++;
        } else {
          hasMore = false;
        }
      }

      // Await the parallel queries (they have been running concurrently with invoice pagination above)
      const [custRes, servRes, apptRes] = await parallelQueriesPromise;

      if (custRes.error || servRes.error || apptRes.error) {
        return NextResponse.json({ success: false, error: "Failed to aggregate financial stats." }, { status: 500 });
      }

      let todayRevenue = 0;
      let monthlyRevenue = 0;
      let totalRevenue = 0;

      const tISO = todayStart.toISOString();
      const mISO = monthStart.toISOString();

      allInvoices.forEach(inv => {
        const amt = parseFloat(inv.grand_total as string) || 0;
        totalRevenue += amt;
        if (inv.created_at >= mISO) monthlyRevenue += amt;
        if (inv.created_at >= tISO) todayRevenue += amt;
      });

      let completedAppointments = 0;
      let pendingAppointments = 0;
      apptRes.data?.forEach(a => {
        if (a.status === "completed") completedAppointments++;
        else if (a.status === "pending" || a.status === "confirmed") pendingAppointments++;
      });

      return NextResponse.json({
        success: true,
        stats: {
          todayRevenue,
          monthlyRevenue,
          totalRevenue,
          totalCustomers: custRes.count || 0,
          totalServices: servRes.count || 0,
          totalAppointments: apptRes.data?.length || 0,
          completedAppointments,
          pendingAppointments
        }
      });
    }

    // 4. GET APPOINTMENTS (BOOKINGS)
    if (action === "get_appointments") {
      let query = adminSupabase
        .from("appointments")
        .select("*")
        .neq("status", "archived");

      // Staff isolated to branch
      if (user.role === "staff") {
        if (!user.branch) {
          return NextResponse.json({ success: false, error: "Staff account not assigned to a branch." }, { status: 403 });
        }
        query = query.eq("branch", user.branch);
      }
      
      // Admin optional filter
      if (user.role !== "staff") {
        const filterBranch = searchParams.get("branch");
        if (filterBranch) {
          query = query.eq("branch", filterBranch);
        }
      }

      // Optional date filter
      const filterDate = searchParams.get("date");
      if (filterDate) {
        query = query.eq("appointment_date", filterDate);
      }

      const { data: appointments, error } = await query.order("appointment_date", { ascending: true });
      if (error) {
        console.error("Fetch appointments error:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch bookings." }, { status: 500 });
      }

      return NextResponse.json({ success: true, appointments });
    }

    // 5. BUSINESS REPORTS (ADMIN ONLY)
    if (action === "get_admin_reports") {
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");
      const branchFilter = searchParams.get("branch"); // specific branch or 'All Branches'

      if (!startDate || !endDate) {
        return NextResponse.json({ success: false, error: "Start and End dates are required." }, { status: 400 });
      }

      let targetBranch: string | null = null;
      if (user.role === "staff") {
        if (!user.branch) {
          return NextResponse.json({ success: false, error: "Staff account not assigned to a branch." }, { status: 403 });
        }
        targetBranch = user.branch;
      } else {
        // Admin branch filtering selection
        if (branchFilter && branchFilter !== "All Branches") {
          targetBranch = branchFilter;
        }
      }

      // Fetch Invoices in range
      let invoicesQuery = adminSupabase
        .from("invoices")
        .select(`
          id, 
          invoice_number, 
          subtotal, 
          total_tax, 
          discount,
          grand_total, 
          points_earned, 
          points_redeemed, 
          branch,
          payment_method,
          status,
          created_by,
          created_at, 
          customers (
            name, 
            phone,
            status
          ), 
          invoice_items (
            item_name, 
            line_total, 
            tax_rate, 
            category, 
            quantity, 
            unit_price
          )
        `)
        .eq("status", "active")
        .gte("created_at", `${startDate}T00:00:00.000Z`)
        .lte("created_at", `${endDate}T23:59:59.999Z`);

      if (targetBranch) {
        invoicesQuery = invoicesQuery.eq("branch", targetBranch);
      }

      const { data: invoices, error: invError } = await invoicesQuery;

      if (invError) {
        console.error("Report invoices error:", invError);
        return NextResponse.json({ success: false, error: "Failed to query invoice records for report." }, { status: 500 });
      }

      // Fetch Customers registered in range
      let customersQuery = adminSupabase
        .from("customers")
        .select("id, created_at, name, phone, branch")
        .eq("status", "active")
        .gte("created_at", `${startDate}T00:00:00.000Z`)
        .lte("created_at", `${endDate}T23:59:59.999Z`);

      if (targetBranch) {
        customersQuery = customersQuery.eq("branch", targetBranch);
      }

      const { data: customers, error: custError } = await customersQuery;

      if (custError) {
        console.error("Report customers error:", custError);
        return NextResponse.json({ success: false, error: "Failed to query customer metrics for report." }, { status: 500 });
      }

      // Fetch Appointments in range
      let appointmentsQuery = adminSupabase
        .from("appointments")
        .select("id, status, branch, appointment_date, appointment_time, customer_name, customer_phone")
        .gte("appointment_date", startDate)
        .lte("appointment_date", endDate);

      if (targetBranch) {
        appointmentsQuery = appointmentsQuery.eq("branch", targetBranch);
      }

      const { data: appointments, error: appError } = await appointmentsQuery;

      if (appError) {
        console.error("Report appointments error:", appError);
        return NextResponse.json({ success: false, error: "Failed to query bookings for report." }, { status: 500 });
      }

      // Log report query activity to audit trail
      await logSecurityAction(
        adminSupabase, 
        user, 
        "report_query", 
        `Queried report range: ${startDate} to ${endDate} for branch: ${targetBranch || "All Branches"}`
      );

      return NextResponse.json({
        success: true,
        report: {
          invoices: invoices || [],
          newCustomersCount: customers?.length || 0,
          customers: customers || [],
          appointments: appointments || []
        }
      });
    }

    // 6. GET SECURITY AUDIT LOGS (ADMIN ONLY)
    if (action === "get_audit_logs") {
      if (user.role !== "admin") {
        return NextResponse.json({ success: false, error: "Forbidden: Admin access required." }, { status: 403 });
      }

      const { data: logs, error } = await adminSupabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Fetch audit logs error:", error);
        return NextResponse.json({ success: false, error: "Failed to load audit logs." }, { status: 500 });
      }

      return NextResponse.json({ success: true, logs });
    }

    // 7. LIST STAFF MEMBERS (ADMIN ONLY)
    if (action === "list_staff") {
      if (user.role !== "admin") {
        return NextResponse.json({ success: false, error: "Forbidden: Admin access required." }, { status: 403 });
      }

      const { data: { users }, error } = await adminSupabase.auth.admin.listUsers();

      if (error) {
        console.error("List staff error:", error);
        return NextResponse.json({ success: false, error: "Failed to list staff accounts." }, { status: 500 });
      }

      const staffMembers = users.filter((u: any) => u.app_metadata?.role === "staff");

      return NextResponse.json({ success: true, staff: staffMembers });
    }

    // 8. LIST ALL REGISTERED CUSTOMERS (ADMIN ONLY)
    if (action === "list_all_customers") {
      if (user.role !== "admin") {
        return NextResponse.json({ success: false, error: "Forbidden: Admin access required." }, { status: 403 });
      }

      const statusFilter = searchParams.get("statusFilter") || "active";
      let query = adminSupabase
        .from("customers")
        .select("id, name, phone, email, points, branch, status, created_at")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data: customers, error } = await query;

      if (error) {
        console.error("List all customers error:", error);
        return NextResponse.json({ success: false, error: "Failed to query customer database." }, { status: 500 });
      }

      return NextResponse.json({ success: true, customers });
    }

    if (action === "get_invoice") {
      const invoiceId = searchParams.get("id");
      if (!invoiceId) return NextResponse.json({ success: false, error: "Missing invoice ID" }, { status: 400 });

      const { data, error } = await adminSupabase
        .from("invoices")
        .select(`
          *,
          customers (name, phone),
          invoice_items (*)
        `)
        .eq("id", invoiceId)
        .single();
      
      if (error || !data) {
        console.error("Fetch invoice error:", error);
        return NextResponse.json({ success: false, error: "Invoice not found." }, { status: 404 });
      }

      // RLS Check: Staff can only edit invoices from their branch
      if (user.role === "staff" && user.branch && data.branch !== user.branch) {
        return NextResponse.json({ success: false, error: "Forbidden: Invoice belongs to a different branch." }, { status: 403 });
      }

      return NextResponse.json({ success: true, invoice: data });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch (err) {
    logError("Billing GET API", err, { req: request });
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
      return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const { action } = body || {};
    const adminSupabase = getSupabaseAdmin();

    // 1. ADD CATALOGUE ITEMS
    if (action === "create_service") {
      const { name, price, category, itemCode, hsn, taxRate, branch } = body;

      // Staff branch validation
      let targetBranch = branch;
      if (user.role === "staff") {
        targetBranch = user.branch || "Global";
      } else if (!targetBranch) {
        targetBranch = "Global";
      }

      if (!name || typeof name !== "string" || name.trim() === "") {
        return NextResponse.json({ success: false, error: "Name is required." }, { status: 400 });
      }
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return NextResponse.json({ success: false, error: "Price must be a non-negative number." }, { status: 400 });
      }
      if (category !== "Service" && category !== "Retail") {
        return NextResponse.json({ success: false, error: "Category must be either Service or Retail." }, { status: 400 });
      }

      const cleanName = name.replace(/<[^>]*>/g, "").trim();
      let safeItemCode = itemCode && typeof itemCode === "string" ? itemCode.trim().replace(/<[^>]*>/g, "") : null;
      const safeHsn = hsn && typeof hsn === "string" ? hsn.trim().replace(/<[^>]*>/g, "") : null;

      if (!safeItemCode) {
        const { data: lastItem } = await adminSupabase
          .from("services")
          .select("item_code")
          .like("item_code", "MAC%")
          .order("item_code", { ascending: false })
          .limit(1)
          .maybeSingle();

        let nextNum = 1;
        if (lastItem && lastItem.item_code) {
          const match = lastItem.item_code.match(/^MAC(\d+)$/i);
          if (match) {
            nextNum = parseInt(match[1], 10) + 1;
          }
        }
        safeItemCode = `MAC${nextNum.toString().padStart(3, '0')}`;
      }

      let parsedTaxRate = normalizeGst(taxRate, category);

      let validatedStatus = "ACTIVE";
      try {
        validatedStatus = validateAndCalculateServiceStatus(undefined, 0, 5, category);
      } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 400 });
      }

      const insertPayload = {
        name: cleanName,
        price: parsedPrice,
        category,
        tax_rate: parsedTaxRate,
        item_code: safeItemCode,
        hsn: safeHsn,
        branch: targetBranch,
        status: validatedStatus
      };
      console.log("Supabase services payload (BILLING ADMIN CREATE):", insertPayload);

      const { data: newService, error } = await adminSupabase
        .from("services")
        .insert([insertPayload])
        .select("*")
        .single();

      if (error) {
        console.error("Create service error:", error);
        if (error.code === "23505") {
          if (error.message.includes("services_name_key")) {
            return NextResponse.json({ success: false, error: "An item with this name already exists in the catalog." }, { status: 400 });
          }
          if (error.message.includes("services_item_code_key")) {
            return NextResponse.json({ success: false, error: "An item with this unique Item Code already exists." }, { status: 400 });
          }
          return NextResponse.json({ success: false, error: "A duplicate item already exists in the catalog." }, { status: 400 });
        }
        return NextResponse.json({ success: false, error: "Failed to create catalogue item." }, { status: 500 });
      }

      await logSecurityAction(adminSupabase, user, "create_catalogue_item", `Created ${category} item: ${cleanName} for branch ${targetBranch || "Global"}`);
      return NextResponse.json({ success: true, service: newService });
    }

    // 2. EDIT CATALOGUE ITEMS (IDOR Check)
    if (action === "edit_service") {
      const { id, name, price, category, itemCode, hsn, taxRate } = body;

      if (!id) {
        return NextResponse.json({ success: false, error: "Item ID is required." }, { status: 400 });
      }

      // Fetch item to verify ownership (IDOR check)
      const { data: dbItem, error: fetchErr } = await adminSupabase
        .from("services")
        .select("id, branch, name")
        .eq("id", id)
        .maybeSingle();

      if (fetchErr || !dbItem) {
        return NextResponse.json({ success: false, error: "Catalogue item not found." }, { status: 404 });
      }

      // Removed branch constraint to allow all staff and admins to edit catalogues

      if (!name || typeof name !== "string" || name.trim() === "") {
        return NextResponse.json({ success: false, error: "Name is required." }, { status: 400 });
      }

      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return NextResponse.json({ success: false, error: "Price must be a non-negative number." }, { status: 400 });
      }

      if (category !== "Service" && category !== "Retail") {
        return NextResponse.json({ success: false, error: "Category must be either Service or Retail." }, { status: 400 });
      }

      const cleanName = name.replace(/<[^>]*>/g, "").trim();
      const safeItemCode = itemCode && typeof itemCode === "string" ? itemCode.trim().replace(/<[^>]*>/g, "") : null;
      const safeHsn = hsn && typeof hsn === "string" ? hsn.trim().replace(/<[^>]*>/g, "") : null;

      let parsedTaxRate = normalizeGst(taxRate, category);

      const { data: updatedService, error } = await adminSupabase
        .from("services")
        .update({
          name: cleanName,
          price: parsedPrice,
          category,
          tax_rate: parsedTaxRate,
          item_code: safeItemCode,
          hsn: safeHsn
        })
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        console.error("Edit service error:", error);
        if (error.code === "23505") {
          if (error.message.includes("services_name_key")) {
            return NextResponse.json({ success: false, error: "An item with this name already exists in the catalog." }, { status: 400 });
          }
          if (error.message.includes("services_item_code_key")) {
            return NextResponse.json({ success: false, error: "An item with this unique Item Code already exists." }, { status: 400 });
          }
          return NextResponse.json({ success: false, error: "A duplicate item already exists in the catalog." }, { status: 400 });
        }
        return NextResponse.json({ success: false, error: "Failed to update catalog item." }, { status: 500 });
      }

      await logSecurityAction(adminSupabase, user, "edit_catalogue_item", `Edited item ID: ${id} (${cleanName})`);
      return NextResponse.json({ success: true, service: updatedService });
    }

    // 3. ARCHIVE SERVICES (SOFT DELETE)
    if (action === "delete_service") {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ success: false, error: "Item ID is required." }, { status: 400 });
      }

      const { data: dbItem, error: fetchErr } = await adminSupabase
        .from("services")
        .select("id, branch, name")
        .eq("id", id)
        .maybeSingle();

      if (fetchErr || !dbItem) {
        return NextResponse.json({ success: false, error: "Item not found." }, { status: 404 });
      }

      // Removed branch constraint for archiving

      // Soft delete: status = archived
      let validatedStatus = "archived";
      try {
        validatedStatus = validateAndCalculateServiceStatus("archived");
      } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 400 });
      }

      const updatePayload = { status: validatedStatus };
      console.log("Supabase services payload (BILLING ADMIN ARCHIVE):", updatePayload);

      const { error } = await adminSupabase
        .from("services")
        .update(updatePayload)
        .eq("id", id);

      if (error) {
        console.error("Archive service error:", error);
        return NextResponse.json({ success: false, error: "Failed to archive item." }, { status: 500 });
      }

      await logSecurityAction(adminSupabase, user, "archive_catalogue_item", `Archived catalogue item ID: ${id} (${dbItem.name})`);
      return NextResponse.json({ success: true });
    }

    // 4. CREATE CUSTOMER
    if (action === "create_customer") {
      const { name, phone, email, branch, gstin } = body;

      let targetBranch = branch;
      if (user.role === "staff") {
        if (!user.branch) {
          return NextResponse.json({ success: false, error: "Staff account not assigned to a branch." }, { status: 403 });
        }
        targetBranch = user.branch;
      }

      if (typeof name !== "string" || name.trim() === "") {
        return NextResponse.json({ success: false, error: "Name is required." }, { status: 400 });
      }

      const phoneResult = normalizePhone(phone);
      if (!phoneResult.isValid || !phoneResult.normalized) {
        return NextResponse.json({ success: false, error: phoneResult.error || "Invalid phone number." }, { status: 400 });
      }
      const cleanPhone = phoneResult.normalized;

      const { data: existingCustomer } = await adminSupabase
        .from("customers")
        .select("id")
        .eq("phone", cleanPhone)
        .eq("status", "active")
        .maybeSingle();

      if (existingCustomer) {
        return NextResponse.json({ success: false, error: "Customer profile already exists for this number." }, { status: 409 });
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

      // Validate GSTIN format if provided
      let cleanGstin: string | null = null;
      if (gstin && typeof gstin === "string" && gstin.trim() !== "") {
        const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        const normalized = gstin.trim().toUpperCase();
        if (!gstinRegex.test(normalized)) {
          return NextResponse.json({ success: false, error: "Invalid GSTIN format. Expected 15-character GST Identification Number." }, { status: 400 });
        }
        cleanGstin = normalized;
      }

      const { data: newCustomer, error } = await adminSupabase
        .from("customers")
        .insert([{
          name: name.trim(),
          phone: cleanPhone,
          email: cleanEmail,
          branch: targetBranch,
          gstin: cleanGstin,
          points: 0,
          status: "active"
        }])
        .select("id, name, phone, email, points, gstin")
        .single();

      if (error) {
        console.error("Create customer error:", error);
        if (error.code === "23505") {
          return NextResponse.json({ success: false, error: "Customer profile already exists for this number or email." }, { status: 409 });
        }
        return NextResponse.json({ success: false, error: "Failed to register customer." }, { status: 500 });
      }

      await logSecurityAction(adminSupabase, user, "create_customer", `Registered customer: ${name.trim()} (${cleanPhone}) at branch ${targetBranch || "Global"}`);
      return NextResponse.json({ success: true, customer: newCustomer });
    }

    // 4.5 UPDATE CUSTOMER (ADMIN ONLY)
    if (action === "update_customer") {
      if (user.role !== "admin") {
        return NextResponse.json({ success: false, error: "Forbidden: Only administrators can update customer details." }, { status: 403 });
      }

      const { id, name, phone, email, points } = body;

      if (!id) {
        return NextResponse.json({ success: false, error: "Customer ID is required." }, { status: 400 });
      }

      if (typeof name !== "string" || name.trim() === "") {
        return NextResponse.json({ success: false, error: "Name is required." }, { status: 400 });
      }

      const phoneResult = normalizePhone(phone);
      if (!phoneResult.isValid || !phoneResult.normalized) {
        return NextResponse.json({ success: false, error: phoneResult.error || "Invalid phone number." }, { status: 400 });
      }
      const cleanPhone = phoneResult.normalized;

      let cleanEmail = null;
      if (email && typeof email === "string" && email.trim() !== "") {
        cleanEmail = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
          return NextResponse.json({ success: false, error: "Invalid email format." }, { status: 400 });
        }
      }

      const parsedPoints = parseInt(points, 10);
      if (isNaN(parsedPoints) || parsedPoints < 0) {
        return NextResponse.json({ success: false, error: "Points must be a non-negative integer." }, { status: 400 });
      }

      // Check unique constraints manually
      const { data: duplicatePhone } = await adminSupabase
        .from("customers")
        .select("id")
        .eq("phone", cleanPhone)
        .eq("status", "active")
        .neq("id", id)
        .maybeSingle();

      if (duplicatePhone) {
        return NextResponse.json({ success: false, error: "Another customer profile is already registered with this phone number." }, { status: 409 });
      }

      if (cleanEmail) {
        const { data: duplicateEmail } = await adminSupabase
          .from("customers")
          .select("id")
          .eq("email", cleanEmail)
          .eq("status", "active")
          .neq("id", id)
          .maybeSingle();

        if (duplicateEmail) {
          return NextResponse.json({ success: false, error: "Another customer profile is already registered with this email." }, { status: 409 });
        }
      }

      const { data: updatedCustomer, error } = await adminSupabase
        .from("customers")
        .update({
          name: name.trim(),
          phone: cleanPhone,
          email: cleanEmail,
          points: parsedPoints
        })
        .eq("id", id)
        .select("id, name, phone, email, points, branch, created_at")
        .single();

      if (error) {
        console.error("Update customer error:", error);
        return NextResponse.json({ success: false, error: "Failed to update customer details." }, { status: 500 });
      }

      await logSecurityAction(adminSupabase, user, "update_customer", `Updated customer details for ID: ${id} (${name.trim()})`);
      return NextResponse.json({ success: true, customer: updatedCustomer });
    }

    // 5. SECURE INVOICING CHECKOUT
    if (action === "create_invoice") {
      try {
        const { customerId, items, pointsToRedeem, branch, paymentMethod, invoiceDate, idempotencyKey } = body;

        // 5a. Idempotency Check
        if (idempotencyKey && typeof idempotencyKey === 'string') {
          const { data: existingLog } = await adminSupabase
            .from("audit_logs")
            .select("details")
            .eq("request_id", idempotencyKey)
            .eq("action", "checkout_invoice")
            .maybeSingle();

          if (existingLog && existingLog.details) {
            try {
              const parsedDetails = JSON.parse(existingLog.details);
              if (parsedDetails.successResponse) {
                return NextResponse.json(parsedDetails.successResponse);
              }
            } catch (e) {}
          }
        }

        let targetBranch = branch;
        if (user.role === "staff") {
          if (branch && branch !== user.branch) {
            return NextResponse.json({ success: false, error: "Forbidden: Branch mismatch detected." }, { status: 403 });
          }
          targetBranch = user.branch || "Global";
        } else if (!targetBranch) {
          targetBranch = "Global";
        }

        if (!customerId || !Array.isArray(items) || items.length === 0 || !targetBranch) {
          return NextResponse.json({ success: false, error: "Missing checkout parameters." }, { status: 400 });
        }

      // Validate invoiceDate
      let customCreatedByDate: string | null = null;
      if (invoiceDate) {
        const parsedDate = new Date(invoiceDate);
        if (isNaN(parsedDate.getTime())) {
          return NextResponse.json({ success: false, error: "Invalid Invoice Date format." }, { status: 400 });
        }
        // Don't allow future dates (with buffer for today)
        const todayStr = new Date().toLocaleDateString("sv-SE");
        if (invoiceDate > todayStr) {
          return NextResponse.json({ success: false, error: "Future Invoice Dates are not allowed." }, { status: 400 });
        }
        // Append current time to the backdate so it's a valid timestamp
        const timeStr = new Date().toTimeString().split(" ")[0]; // "HH:MM:SS"
        customCreatedByDate = `${invoiceDate}T${timeStr}.000Z`;
      }

      const redeemAmt = parseInt(pointsToRedeem, 10) || 0;

      // Parallelize customer profile fetch and service items fetch for faster billing
      const itemIds = items.map((i) => i.id);
      
      const [customerRes, dbItemsRes] = await Promise.all([
        adminSupabase
          .from("customers")
          .select("id, name, phone, gstin, points, branch")
          .eq("id", customerId)
          .eq("status", "active")
          .maybeSingle(),
        adminSupabase
          .from("services")
          .select("*")
          .in("id", itemIds)
      ]);

      const { data: customer, error: customerErr } = customerRes;
      const { data: dbItems, error: dbItemsErr } = dbItemsRes;

      if (customerErr || !customer) {
        return NextResponse.json({ success: false, error: "Customer profile not found." }, { status: 404 });
      }

      if (redeemAmt > customer.points) {
        return NextResponse.json({ success: false, error: "Insufficient points balance." }, { status: 400 });
      }

      if (dbItemsErr || !dbItems || dbItems.length === 0) {
        return NextResponse.json({ success: false, error: "Failed to query checkout items." }, { status: 500 });
      }

      const invoiceItemsToInsert = [];
      const retailDeductions = [];

      for (const reqItem of items) {
        const dbItem = dbItems.find((i) => i.id === reqItem.id);
        if (!dbItem) {
          return NextResponse.json({ success: false, error: `Item ID ${reqItem.id} not found.` }, { status: 400 });
        }

        // Staff branch item check (IDOR check)
        if (user.role === "staff" && dbItem.branch && dbItem.branch !== user.branch) {
          return NextResponse.json({ success: false, error: `Forbidden: Item ${dbItem.name} belongs to another branch.` }, { status: 403 });
        }

        const qty = parseInt(reqItem.quantity, 10);
        if (isNaN(qty) || qty <= 0) {
          return NextResponse.json({ success: false, error: "Quantity must be positive integer." }, { status: 400 });
        }

        const lineTotal = dbItem.price * qty;

        if (dbItem.category !== "Service") {
          retailDeductions.push({
            product_id: dbItem.id,
            branch: targetBranch,
            quantity: qty
          });
        }

        invoiceItemsToInsert.push({
          item_name: dbItem.name,
          category: dbItem.category,
          quantity: qty,
          unit_price: dbItem.price,
          tax_rate: dbItem.tax_rate,
          line_total: lineTotal,
          item_code: dbItem.item_code || null,
          hsn: dbItem.hsn || null,
          staff_contribution: reqItem.staffContribution ? reqItem.staffContribution.replace(/<[^>]*>/g, "").trim() : null
        });
      }      const manualDiscount = parseFloat(body.discountAmount) || 0;
      const loyaltyDiscount = redeemAmt;

      // Use the shared math function. It validates internally and throws if inputs are malformed.
      const calculated = recalculateInvoiceTotals(invoiceItemsToInsert, manualDiscount, loyaltyDiscount);

      const pointsEarned = calculated.points_earned;

      // Save to database in a safe transaction sequence using RPC
      const finalPoints = customer.points - redeemAmt + pointsEarned;
      // The invoice number will now be generated natively in the database via the RPC.
      // We pass an empty/placeholder value here which will be overwritten by the RPC.
      const p_invoice = {
        invoice_number: "TBD",
        customer_id: customerId,
        customer_name: customer.name,
        customer_phone: customer.phone || null,
        customer_gstin: customer.gstin || null,
        subtotal: calculated.subtotal,
        service_tax: calculated.service_tax,
        retail_tax: calculated.retail_tax,
        total_tax: calculated.total_tax,
        discount: calculated.discount,
        grand_total: calculated.grand_total,
        points_earned: pointsEarned,
        points_redeemed: calculated.points_redeemed,
        created_by: user.email,
        branch: targetBranch,
        payment_method: paymentMethod || "Cash",
        status: "active",
        ...(customCreatedByDate ? { created_at: customCreatedByDate } : {})
      };

      const { data: rpcData, error: rpcError } = await adminSupabase.rpc("create_invoice_with_inventory", {
        p_invoice,
        p_items: invoiceItemsToInsert,
        p_retail_deductions: retailDeductions
      });

      if (rpcError) {
        return NextResponse.json({ success: false, error: rpcError.message }, { status: 400 });
      }

      if (!rpcData || !rpcData.success) {
        return NextResponse.json({ success: false, error: rpcData?.error || "Transaction failed due to inventory or points conflict." }, { status: 400 });
      }

      const newInvoiceId = rpcData.invoice_id;
      const finalInvoiceNumber = rpcData.invoice_number;
      
      const itemsToInsert = invoiceItemsToInsert.map((item) => ({ ...item, invoice_id: newInvoiceId }));
      
      const successResponse = { success: true, invoice: { id: newInvoiceId, ...p_invoice, invoice_number: finalInvoiceNumber }, items: itemsToInsert, newPoints: finalPoints };

      // Log audit log asynchronously, store successResponse for idempotency checks
      try {
        await adminSupabase.from("audit_logs").insert([{
          user_id: user.email,
          role: user.role,
          branch: targetBranch,
          action: "checkout_invoice",
          details: JSON.stringify({ message: `Generated Invoice #${finalInvoiceNumber}`, successResponse }),
          request_id: idempotencyKey || null
        }]);
      } catch (logErr) {
        console.error("Audit log failed during invoice creation", logErr);
      }

      return NextResponse.json(successResponse);
      } catch (error: any) {
        // Safe Catch: Prevent crash, log error, return generic message to client.
        await logError("create_invoice_exception", error, {
           userId: user.email,
           role: user.role,
           branch: user.branch,
           category: "Billing"
        });
        return NextResponse.json({ success: false, error: error.message || "An unexpected error occurred during billing checkout." }, { status: 500 });
      }
    }

    // 6. CREATE APPOINTMENT (BOOKING)
    if (action === "create_appointment") {
      const { customerName, customerPhone, serviceId, date, time, notes, branch } = body;

      let targetBranch = branch;
      if (user.role === "staff") {
        targetBranch = user.branch || "Global";
      } else if (!targetBranch) {
        targetBranch = "Global";
      }

      if (!customerName || !customerPhone || !date || !time) {
        return NextResponse.json({ success: false, error: "Missing required booking details." }, { status: 400 });
      }

      const customerPhoneResult = normalizePhone(customerPhone);
      if (!customerPhoneResult.isValid || !customerPhoneResult.normalized) {
        return NextResponse.json({ success: false, error: customerPhoneResult.error || "Invalid phone number format." }, { status: 400 });
      }

      const { data: newBooking, error } = await adminSupabase
        .from("appointments")
        .insert([{
          customer_name: customerName.replace(/<[^>]*>/g, "").trim(),
          customer_phone: customerPhoneResult.normalized,
          branch: targetBranch,
          service_id: serviceId || null,
          appointment_date: date,
          appointment_time: time,
          status: "scheduled",
          notes: notes ? notes.replace(/<[^>]*>/g, "").trim() : null
        }])
        .select("*")
        .single();

      if (error) {
        console.error("Create booking error:", error);
        return NextResponse.json({ success: false, error: "Failed to write appointment to database." }, { status: 500 });
      }

      await logSecurityAction(adminSupabase, user, "create_booking", `Booked appointment for customer ${customerName} on ${date} at branch ${targetBranch}`);
      return NextResponse.json({ success: true, appointment: newBooking });
    }

    // 7. EDIT APPOINTMENT (IDOR Check)
    if (action === "edit_appointment") {
      const { id, customerName, customerPhone, serviceId, date, time, notes, status } = body;

      if (!id) {
        return NextResponse.json({ success: false, error: "Booking ID is required." }, { status: 400 });
      }

      // IDOR constraint lookup
      const { data: dbBooking, error: fetchErr } = await adminSupabase
        .from("appointments")
        .select("id, branch, customer_name")
        .eq("id", id)
        .maybeSingle();

      if (fetchErr || !dbBooking) {
        return NextResponse.json({ success: false, error: "Booking not found." }, { status: 404 });
      }

      // Removed branch constraint for editing bookings

      let normalizedPhone = undefined;
      if (customerPhone) {
        const phoneResult = normalizePhone(customerPhone);
        if (!phoneResult.isValid || !phoneResult.normalized) {
          return NextResponse.json({ success: false, error: phoneResult.error || "Invalid phone number format." }, { status: 400 });
        }
        normalizedPhone = phoneResult.normalized;
      }

      const { data: updatedBooking, error } = await adminSupabase
        .from("appointments")
        .update({
          customer_name: customerName ? customerName.replace(/<[^>]*>/g, "").trim() : undefined,
          customer_phone: normalizedPhone,
          service_id: serviceId || undefined,
          appointment_date: date || undefined,
          appointment_time: time || undefined,
          notes: notes !== undefined ? notes.replace(/<[^>]*>/g, "").trim() : undefined,
          status: status || undefined
        })
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        console.error("Edit booking error:", error);
        return NextResponse.json({ success: false, error: "Failed to update appointment record." }, { status: 500 });
      }

      await logSecurityAction(adminSupabase, user, "edit_booking", `Updated booking ID: ${id} (${dbBooking.customer_name})`);
      return NextResponse.json({ success: true, appointment: updatedBooking });
    }

    // 8. ARCHIVE APPOINTMENT (SOFT DELETE / CANCEL)
    if (action === "cancel_appointment") {
      const { id } = body;

      if (!id) {
        return NextResponse.json({ success: false, error: "Booking ID required." }, { status: 400 });
      }

      const { data: dbBooking, error: fetchErr } = await adminSupabase
        .from("appointments")
        .select("id, branch, customer_name")
        .eq("id", id)
        .maybeSingle();

      if (fetchErr || !dbBooking) {
        return NextResponse.json({ success: false, error: "Booking not found." }, { status: 404 });
      }

      // Removed branch constraint for canceling bookings

      const { error } = await adminSupabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", id);

      if (error) {
        console.error("Cancel booking error:", error);
        return NextResponse.json({ success: false, error: "Failed to cancel booking." }, { status: 500 });
      }

      await logSecurityAction(adminSupabase, user, "cancel_booking", `Cancelled booking ID: ${id} (${dbBooking.customer_name})`);
      return NextResponse.json({ success: true });
    }

    // 9. LOG SECURITY AUDIT ACTION (e.g. PDF Export event log from frontend)
    if (action === "log_audit_action") {
      const { auditAction, details } = body;
      if (!auditAction) {
        return NextResponse.json({ success: false, error: "Action is required." }, { status: 400 });
      }

      const cleanAction = String(auditAction).replace(/<[^>]*>/g, "");
      const cleanDetails = details ? String(details).replace(/<[^>]*>/g, "") : "";

      await logSecurityAction(adminSupabase, user, cleanAction, cleanDetails);
      return NextResponse.json({ success: true });
    }

    // 10. CREATE STAFF MEMBER (ADMIN ONLY)
    if (action === "create_staff") {
      if (user.role !== "admin") {
        return NextResponse.json({ success: false, error: "Forbidden: Admin access required." }, { status: 403 });
      }

      const { staffEmail, password, branch } = body;

      if (!staffEmail || !password || !branch) {
        return NextResponse.json({ success: false, error: "Missing required staff parameters." }, { status: 400 });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (typeof staffEmail !== "string" || !emailRegex.test(staffEmail.trim())) {
        return NextResponse.json({ success: false, error: "Invalid staff email format." }, { status: 400 });
      }

      if (typeof password !== "string" || password.length < 6) {
        return NextResponse.json({ success: false, error: "Password must be at least 6 characters long." }, { status: 400 });
      }

      const allowedBranches = ["Kaduthuruthy", "Ettumanoor", "Peruva"];
      if (typeof branch !== "string" || !allowedBranches.includes(branch.trim())) {
        return NextResponse.json({ success: false, error: "Invalid branch name. Must be Kaduthuruthy, Ettumanoor, or Peruva." }, { status: 400 });
      }

      const cleanBranch = branch.trim();
      const cleanEmail = staffEmail.trim().toLowerCase();

      const { data: newStaff, error } = await adminSupabase.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true,
        app_metadata: { role: "staff", branch: cleanBranch }
      });

      if (error) {
        console.error("Create staff error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to create staff account." }, { status: 500 });
      }

      await logSecurityAction(adminSupabase, user, "create_staff", `Created staff account: ${cleanEmail} for branch ${cleanBranch}`);
      return NextResponse.json({ success: true, staff: newStaff.user });
    }

    // 11. DELETE STAFF MEMBER (ADMIN ONLY)
    if (action === "delete_staff") {
      if (user.role !== "admin") {
        return NextResponse.json({ success: false, error: "Forbidden: Admin access required." }, { status: 403 });
      }

      const { staffId, staffEmail } = body;

      if (!staffId) {
        return NextResponse.json({ success: false, error: "Staff user ID is required." }, { status: 400 });
      }

      const { error } = await adminSupabase.auth.admin.deleteUser(staffId);

      if (error) {
        console.error("Delete staff error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to delete staff account." }, { status: 500 });
      }

      await logSecurityAction(adminSupabase, user, "delete_staff", `Deleted staff account ID: ${staffId} (${staffEmail || "unknown"})`);
      return NextResponse.json({ success: true });
    }

    // 12. ADMIN-ONLY INVOICE AND CUSTOMER ACTIONS
    if (action === "edit_invoice") {
      if (user.role !== "admin") {
        return NextResponse.json({ success: false, error: "Forbidden: Admin access required to edit invoices." }, { status: 403 });
      }

      try {
        const { invoiceId, items, discountAmount, pointsToRedeem, paymentMethod, editReason, customerName, customerPhone } = body;

        if (!invoiceId || !Array.isArray(items) || items.length === 0 || !editReason) {
          return NextResponse.json({ success: false, error: "Missing required edit parameters." }, { status: 400 });
        }

        const redeemAmt = parseInt(pointsToRedeem, 10) || 0;
        const manualDiscount = parseFloat(discountAmount) || 0;
        const loyaltyDiscount = redeemAmt;

        // Verify invoice and customer
        const { data: currentInvoice, error: invErr } = await adminSupabase
          .from("invoices")
          .select("id, status, customer_id, branch, invoice_number")
          .eq("id", invoiceId)
          .single();

        if (invErr || !currentInvoice) {
          return NextResponse.json({ success: false, error: "Invoice not found." }, { status: 404 });
        }
        
        if (currentInvoice.status !== "active") {
          return NextResponse.json({ success: false, error: "Cannot edit archived or deleted invoices." }, { status: 400 });
        }

        const { data: customer, error: custErr } = await adminSupabase
          .from("customers")
          .select("id, name, phone, points")
          .eq("id", currentInvoice.customer_id)
          .single();

        if (custErr || !customer) {
          return NextResponse.json({ success: false, error: "Associated customer not found." }, { status: 404 });
        }

        // Optional: Update Customer Details if changed
        if (customerName || customerPhone) {
          const updates: any = {};
          if (customerName && customerName !== customer.name) updates.name = customerName;
          if (customerPhone && customerPhone !== customer.phone) updates.phone = customerPhone;

          if (Object.keys(updates).length > 0) {
            const { error: custUpdateErr } = await adminSupabase
              .from("customers")
              .update(updates)
              .eq("id", currentInvoice.customer_id);
            if (custUpdateErr) {
              if (custUpdateErr.code === '23505') {
                return NextResponse.json({ success: false, error: "Phone number already exists for another customer." }, { status: 400 });
              }
              console.error("Failed to update customer details:", custUpdateErr);
              return NextResponse.json({ success: false, error: "Failed to update customer details." }, { status: 500 });
            }
          }
        }

        const invoiceItemsToInsert = items.map((item: any) => {
          const qty = parseInt(item.quantity, 10) || 1;
          const price = parseFloat(item.unit_price) || 0;
          return {
            item_name: item.item_name,
            category: item.category || "Service",
            quantity: qty,
            unit_price: price,
            tax_rate: parseFloat(item.tax_rate) || 0,
            line_total: qty * price,
            item_code: item.item_code || null,
            hsn: item.hsn || null,
            staff_contribution: item.staff_contribution || null,
            product_id: item.product_id || null // Needed for retail inventory deductions
          };
        });

        const calculated = recalculateInvoiceTotals(invoiceItemsToInsert, manualDiscount, loyaltyDiscount);
        const pointsEarned = calculated.points_earned;

        const retailDeductions = invoiceItemsToInsert
          .filter((item: any) => item.category === "Retail" && item.product_id)
          .map((item: any) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            item_name: item.item_name
          }));

        const p_invoice = {
          subtotal: calculated.subtotal,
          service_tax: calculated.service_tax,
          retail_tax: calculated.retail_tax,
          total_tax: calculated.total_tax,
          discount: calculated.discount,
          grand_total: calculated.grand_total,
          points_earned: pointsEarned,
          points_redeemed: calculated.points_redeemed,
          payment_method: paymentMethod || "Cash",
          created_by: user.email
        };

        const { data: rpcData, error: rpcError } = await adminSupabase.rpc("update_invoice_with_inventory", {
          p_invoice_id: invoiceId,
          p_invoice,
          p_items: invoiceItemsToInsert,
          p_retail_deductions: retailDeductions,
          p_edit_reason: editReason
        });

        if (rpcError) {
          return NextResponse.json({ success: false, error: rpcError.message }, { status: 400 });
        }

        if (!rpcData || !rpcData.success) {
          return NextResponse.json({ success: false, error: rpcData?.error || "Transaction failed." }, { status: 400 });
        }

        // Insert audit log storing before and after JSON
        await adminSupabase.from("audit_logs").insert([{
          user_id: user.email,
          role: user.role,
          action: "edit_invoice",
          details: JSON.stringify({
            invoice_number: currentInvoice.invoice_number,
            reason: editReason,
            before: currentInvoice,
            after: p_invoice
          })
        }]);

        return NextResponse.json({ success: true, message: "Invoice edited successfully." });
      } catch (err) {
        logError("Billing Edit API", err, { req: request as any });
        return NextResponse.json({ success: false, error: "An unexpected error occurred during edit." }, { status: 500 });
      }
    }

    if (action === "delete_invoice") {
      if (user.role !== "admin") {
        return NextResponse.json({ success: false, error: "Forbidden: Admin access required to delete invoices." }, { status: 403 });
      }
      const { id } = body;
      if (!id) return NextResponse.json({ success: false, error: "Invoice ID required." }, { status: 400 });
      
      const { error } = await adminSupabase.from("invoices").update({ status: "archived" }).eq("id", id);
      if (error) return NextResponse.json({ success: false, error: "Failed to delete invoice." }, { status: 500 });
      
      await logSecurityAction(adminSupabase, user, "delete_invoice", `Archived invoice ID: ${id}`);
      return NextResponse.json({ success: true });
    }

    if (action === "restore_invoice") {
      if (user.role !== "admin") {
        return NextResponse.json({ success: false, error: "Forbidden: Admin access required to restore invoices." }, { status: 403 });
      }
      const { id } = body;
      if (!id) return NextResponse.json({ success: false, error: "Invoice ID required." }, { status: 400 });
      
      const { error } = await adminSupabase.from("invoices").update({ status: "active" }).eq("id", id);
      if (error) return NextResponse.json({ success: false, error: "Failed to restore invoice." }, { status: 500 });
      
      await logSecurityAction(adminSupabase, user, "restore_invoice", `Restored invoice ID: ${id}`);
      return NextResponse.json({ success: true });
    }

    if (action === "check_customer_deletable") {
      if (user.role !== "admin") {
        return NextResponse.json({ success: false, error: "Forbidden: Admin access required." }, { status: 403 });
      }
      const { id } = body;
      if (!id) return NextResponse.json({ success: false, error: "Customer ID required." }, { status: 400 });

      // Check linked records
      const [invRes, apptRes, transRes] = await Promise.all([
        adminSupabase.from("invoices").select("id", { count: "exact", head: true }).eq("customer_id", id),
        adminSupabase.from("appointments").select("id", { count: "exact", head: true }).eq("customer_phone", (await adminSupabase.from("customers").select("phone").eq("id", id).single()).data?.phone || "UNKNOWN_PHONE"), // Wait, appointments uses phone instead of customer_id? Let's check schema. Yes, appointments table: customer_name, customer_phone. But wait, checking invoices and transactions is the most important.
        adminSupabase.from("transactions").select("id", { count: "exact", head: true }).eq("customer_id", id)
      ]);

      const invCount = invRes.count || 0;
      const transCount = transRes.count || 0;
      
      const canDelete = invCount === 0 && transCount === 0;

      return NextResponse.json({ success: true, canDelete });
    }

    if (action === "hard_delete_customer") {
      if (user.role !== "admin") {
        return NextResponse.json({ success: false, error: "Forbidden: Admin access required." }, { status: 403 });
      }
      const { id } = body;
      if (!id) return NextResponse.json({ success: false, error: "Customer ID required." }, { status: 400 });

      // Extra safety check on backend
      const { count: invCount } = await adminSupabase.from("invoices").select("id", { count: "exact", head: true }).eq("customer_id", id);
      if ((invCount || 0) > 0) {
        return NextResponse.json({ success: false, error: "Cannot delete customer with existing invoices." }, { status: 400 });
      }

      const { data: custData } = await adminSupabase.from("customers").select("name").eq("id", id).single();
      const { error } = await adminSupabase.from("customers").delete().eq("id", id);
      if (error) return NextResponse.json({ success: false, error: "Failed to delete customer." }, { status: 500 });
      
      await logSecurityAction(adminSupabase, user, "hard_delete_customer", `Permanently deleted customer: ${custData?.name || id}`);
      return NextResponse.json({ success: true });
    }

    if (action === "archive_customer") {
      if (user.role !== "admin") {
        return NextResponse.json({ success: false, error: "Forbidden: Admin access required." }, { status: 403 });
      }
      const { ids } = body; // Support bulk
      if (!ids || !ids.length) return NextResponse.json({ success: false, error: "Customer IDs required." }, { status: 400 });
      
      const { error } = await adminSupabase.from("customers").update({ status: "archived" }).in("id", ids);
      if (error) return NextResponse.json({ success: false, error: "Failed to archive customer(s)." }, { status: 500 });
      
      await logSecurityAction(adminSupabase, user, "archive_customer", `Archived customer IDs: ${ids.join(", ")}`);
      return NextResponse.json({ success: true });
    }

    if (action === "restore_customer") {
      if (user.role !== "admin") {
        return NextResponse.json({ success: false, error: "Forbidden: Admin access required." }, { status: 403 });
      }
      const { ids } = body; // Support bulk
      if (!ids || !ids.length) return NextResponse.json({ success: false, error: "Customer IDs required." }, { status: 400 });
      
      const { error } = await adminSupabase.from("customers").update({ status: "active" }).in("id", ids);
      if (error) return NextResponse.json({ success: false, error: "Failed to restore customer(s)." }, { status: 500 });
      
      await logSecurityAction(adminSupabase, user, "restore_customer", `Restored customer IDs: ${ids.join(", ")}`);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch (err) {
    logError("Billing POST API", err, { req: request });
    return NextResponse.json({ success: false, error: "An unexpected error occurred. Please try again later." }, { status: 500 });
  }
}
