import { NextResponse } from "next/server";
import { logError } from '@/lib/logger';
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  buildCatalogueMap,
  aggregateInvoices,
  finalizeGstRateSummary,
  finalizeHsnSummary,
} from "@/lib/reportEngine";

export async function POST(req: Request) {
  try {
    const adminSupabase = getSupabaseAdmin();
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
    const { action, startDate, endDate, branch } = body;

    // ── LOG EXPORT ────────────────────────────────────────────────────────────
    if (action === "log_export") {
      const { exportType, exportFormat } = body;
      await adminSupabase.from("audit_logs").insert({
        user_id: user.email || user.id,
        role: "admin",
        branch: branch || "All",
        action: `tax_report_export_${exportFormat}`,
        details: `Exported ${exportType} for period [${startDate} to ${endDate}]`
      });
      return NextResponse.json({ success: true });
    }

    // ── GET TAX REPORT ────────────────────────────────────────────────────────
    if (action === "get_tax_report") {
      if (!startDate || !endDate) {
        return NextResponse.json({ success: false, error: "Date range required" }, { status: 400 });
      }

      const startISO = new Date(startDate);
      startISO.setHours(0, 0, 0, 0);
      const endISO = new Date(endDate);
      endISO.setHours(23, 59, 59, 999);

      // Fetch all invoices with items — paginated to handle large datasets
      let invoicesQuery = adminSupabase
        .from("invoices")
        .select(`
          id, invoice_number, created_at,
          subtotal, discount, points_redeemed, total_tax, grand_total,
          branch, status,
          customer_name, customer_phone, customer_gstin,
          customers (name, gstin),
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
          console.error("Error fetching tax report data:", error);
          return NextResponse.json({ success: false, error: "Database query failed" }, { status: 500 });
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

      // Single aggregation pass — all maps built by the centralized engine
      const agg = aggregateInvoices(allInvoices, catalogue);

      return NextResponse.json({
        success: true,
        report: {
          summary: {
            totalSales:         agg.totalSales,
            totalTaxable:       agg.totalTaxable,
            totalGstCollected:  agg.totalGstCollected,
            totalCgst:          agg.totalCgst,
            totalSgst:          agg.totalSgst,
            totalIgst:          agg.totalIgst,
            totalTransactions:  agg.detailedTransactions.length,
            totalInvoices:      agg.totalInvoices,
          },
          hsnSummary:         finalizeHsnSummary(agg.hsnMap),
          gstRateSummary:     finalizeGstRateSummary(agg.gstRateMap),
          branchSummary:      Object.values(agg.branchMap),
          itemSummary:        Object.values(agg.itemMap).sort((a: any, b: any) => b.quantity - a.quantity),
          invoiceRegister:    agg.invoiceItemRegister,
          detailedTransactions: agg.detailedTransactions,
        }
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    logError("Tax Reporting API", error, { req: req as any });
    return NextResponse.json({ success: false, error: "An unexpected error occurred. Please try again later." }, { status: 500 });
  }
}
