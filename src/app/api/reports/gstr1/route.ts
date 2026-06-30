import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  buildCatalogueMap,
  aggregateInvoices,
  finalizeGstRateSummary,
  buildB2cRateSummary,
  finalizeHsnSummary,
} from "@/lib/reportEngine";

// GSTIN validation regex (Indian GST format)
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function validateGstin(gstin: string): boolean {
  if (!gstin || gstin.trim() === "") return true; // Optional — blank is valid
  return GSTIN_REGEX.test(gstin.trim().toUpperCase());
}

// Generate unique Report ID: MB-GSTR1-YYYY-MM-XXXX
async function generateReportId(adminSupabase: any, period: string): Promise<string> {
  const prefix = `MB-GSTR1-${period}`;
  const { count } = await adminSupabase
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .like("action", "gstr1_%")
    .like("details", `%${prefix}%`);
  const seq = String((count || 0) + 1).padStart(4, "0");
  return `${prefix}-${seq}`;
}

export async function POST(req: Request) {
  try {
    const adminSupabase = getSupabaseAdmin();

    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });
    }
    if (user.app_metadata?.role !== "admin") {
      return NextResponse.json({ success: false, error: "Access denied. Admin only." }, { status: 403 });
    }

    const body = await req.json();
    const { action, startDate, endDate, branch, month, year } = body;

    // ── LOG EXPORT ────────────────────────────────────────────────────────────
    if (action === "log_gstr1_export") {
      const { exportFormat, reportId } = body;
      await adminSupabase.from("audit_logs").insert({
        user_id: user.email || user.id,
        role: "admin",
        branch: branch || "All",
        action: `gstr1_export_${(exportFormat || "unknown").toLowerCase()}`,
        details: `Report ${reportId} | Period: ${startDate} to ${endDate} | Branch: ${branch || "All"} | Format: ${exportFormat}`,
      });
      return NextResponse.json({ success: true });
    }

    // ── GET GSTR-1 REPORT ─────────────────────────────────────────────────────
    if (action === "get_gstr1_report") {
      if (!startDate || !endDate) {
        return NextResponse.json({ success: false, error: "Date range required." }, { status: 400 });
      }

      const startISO = new Date(startDate);
      startISO.setHours(0, 0, 0, 0);
      const endISO = new Date(endDate);
      endISO.setHours(23, 59, 59, 999);

      const periodLabel = month && year
        ? `${year}-${String(month).padStart(2, "0")}`
        : `${startDate.slice(0, 7)}`;

      // ── Paginated invoice fetch ────────────────────────────────────────────
      let invoicesQuery = adminSupabase
        .from("invoices")
        .select(`
          id, invoice_number, created_at,
          subtotal, service_tax, retail_tax, total_tax, grand_total, discount,
          branch, status, customer_id, points_redeemed,
          customer_name, customer_phone, customer_gstin,
          customers (name, phone, gstin),
          invoice_items (
            item_name, category, quantity, unit_price,
            tax_rate, line_total, hsn, item_code
          )
        `)
        .gte("created_at", startISO.toISOString())
        .lte("created_at", endISO.toISOString())
        .neq("status", "archived");

      if (branch && branch !== "All Branches") {
        invoicesQuery = invoicesQuery.eq("branch", branch);
      }

      let allInvoices: any[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await invoicesQuery.range(page * 1000, (page + 1) * 1000 - 1);
        if (error) {
          console.error("GSTR-1 query error:", error);
          return NextResponse.json({ success: false, error: "Database query failed." }, { status: 500 });
        }
        if (data && data.length > 0) {
          allInvoices = allInvoices.concat(data);
          page++;
        } else {
          hasMore = false;
        }
      }

      // Build live catalogue map for display enrichment (HSN, item_code, category)
      const catalogue = await buildCatalogueMap(adminSupabase);

      // Single aggregation pass via centralized engine
      const agg = aggregateInvoices(allInvoices, catalogue);

      const gstRateSummary = finalizeGstRateSummary(agg.gstRateMap);
      const b2cRateSummary = buildB2cRateSummary(agg.b2cInvoices);

      const reportId = await generateReportId(adminSupabase, periodLabel);

      return NextResponse.json({
        success: true,
        validationErrors: [],
        report: {
          reportId,
          period: { startDate, endDate, month, year },
          branch: branch || "All Branches",
          generatedAt: new Date().toISOString(),
          generatedBy: user.email,
          summary: {
            totalInvoices:  agg.totalInvoices,
            totalSales:     agg.totalSales,
            totalTaxable:   agg.totalTaxable,
            totalCgst:      agg.totalCgst,
            totalSgst:      agg.totalSgst,
            totalIgst:      agg.totalIgst,
            totalGst:       agg.totalGstCollected,
            b2bCount:       agg.b2bInvoices.length,
            b2cCount:       agg.b2cInvoices.length,
          },
          b2bSales:           agg.b2bInvoices,
          b2cSales:           agg.b2cInvoices,
          b2cRateSummary,
          hsnSummary:         finalizeHsnSummary(agg.hsnMap),
          gstRateSummary,
          invoiceRegister:    agg.gstr1InvoiceRegister,
        },
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch (error) {
    logError("GSTR-1 API", error, { req: req as any });
    return NextResponse.json({ success: false, error: "An unexpected error occurred. Please try again later." }, { status: 500 });
  }
}
