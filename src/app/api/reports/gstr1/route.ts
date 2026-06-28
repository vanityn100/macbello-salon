import { NextResponse } from "next/server";
import { logError } from '@/lib/logger';
import { getSupabaseAdmin } from "@/lib/supabase";
import { recalculateInvoiceTotals } from "@/lib/invoiceUtils";

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

    // ── Auth ──────────────────────────────────────────────────
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

    // ── LOG EXPORT ────────────────────────────────────────────
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

    // ── GET GSTR-1 REPORT ─────────────────────────────────────
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

      // ── Paginated invoice fetch ────────────────────────────
      let invoicesQuery = adminSupabase
        .from("invoices")
        .select(`
          id, invoice_number, created_at,
          subtotal, service_tax, retail_tax, total_tax, grand_total, discount,
          branch, status, customer_id, points_redeemed,
          customer_name, customer_phone, customer_gstin,
          customers (name, phone, gstin),
          invoice_items (item_name, category, quantity, unit_price, tax_rate, line_total, hsn, item_code)
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

      // ── Aggregation ───────────────────────────────────────
      let totalSales = 0;
      let totalTaxable = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;
      let totalGst = 0;

      const b2bInvoices: any[] = [];
      const b2cInvoices: any[] = [];
      const hsnMap: Record<string, any> = {};
      const gstRateMap: Record<string, any> = {};
      const invoiceRegister: any[] = [];
      const validationErrors: string[] = [];

      for (const inv of allInvoices) {
        const grandTotal = parseFloat(inv.grand_total) || 0;
        const taxTotal = parseFloat(inv.total_tax) || 0;
        const subtotal = parseFloat(inv.subtotal) || 0;
        const pointsRedeemed = parseFloat(inv.points_redeemed) || 0;
        const discount = parseFloat(inv.discount) || 0;

        // Snapshot first, fallback to joined customer
        const custName = inv.customer_name || inv.customers?.name || "Walk-in";
        const custPhone = inv.customer_phone || inv.customers?.phone || "";
        const custGstin = inv.customer_gstin
          || (inv.customers?.gstin && inv.customers.gstin !== "" ? inv.customers.gstin : null)
          || null;
        const invBranch = inv.branch || "Global";

        const items = inv.invoice_items || [];

        let calculated: any = null;
        // Validation: invoice total integrity using shared module
        try {
          // If there are no items, recalculateInvoiceTotals will throw a validation error.
          calculated = recalculateInvoiceTotals(items, discount, pointsRedeemed);
          if (Math.abs(calculated.grand_total - grandTotal) > 0.10) {
            validationErrors.push(`${inv.invoice_number}: computed grand Rs.${calculated.grand_total} vs stored Rs.${grandTotal}`);
          }
          if (Math.abs(calculated.subtotal - subtotal) > 0.10) {
            validationErrors.push(`${inv.invoice_number}: computed sub Rs.${calculated.subtotal} vs stored Rs.${subtotal}`);
          }
          if (Math.abs(calculated.total_tax - taxTotal) > 0.10) {
            validationErrors.push(`${inv.invoice_number}: computed tax Rs.${calculated.total_tax} vs stored Rs.${taxTotal}`);
          }
        } catch (validationErr: any) {
          validationErrors.push(`${inv.invoice_number}: ${validationErr.message}`);
        }
        let itemGstSum = 0;
        let invGstRate = "5%";

        if (items.length === 0 || !calculated || !calculated.items_breakdown) {
          // No items - use invoice-level figures
          totalCgst += taxTotal / 2;
          totalSgst += taxTotal / 2;
          itemGstSum = taxTotal;
        } else {
          items.forEach((item: any, i: number) => {
            const rate = parseFloat(item.tax_rate) || 0;
            const qty = item.quantity || 1;

            const breakdown = calculated.items_breakdown[i];
            const itemTaxable = breakdown.baseAmount;
            const itemTax = breakdown.taxAmount;
            const itemCgst = itemTax / 2;
            const itemSgst = itemTax / 2;

            itemGstSum += itemTax;
            totalCgst += itemCgst;
            totalSgst += itemSgst;

            const rawRate = rate * 100;
            const rateLabel = rawRate.toFixed(0) + "%";
            invGstRate = rateLabel;

            // HSN aggregation
            const hsnCode = item.hsn || "Unassigned";
            const hsnKey = `${hsnCode}__${rateLabel}`;
            if (!hsnMap[hsnKey]) {
              hsnMap[hsnKey] = {
                hsnCode,
                description: item.item_name || item.category || "—",
                quantity: 0,
                taxableValue: 0,
                gstRate: rateLabel,
                cgst: 0,
                sgst: 0,
                igst: 0,
                totalValue: 0,
              };
            }
            hsnMap[hsnKey].quantity += qty;
            hsnMap[hsnKey].taxableValue += itemTaxable;
            hsnMap[hsnKey].cgst += itemCgst;
            hsnMap[hsnKey].sgst += itemSgst;
            hsnMap[hsnKey].totalValue += (itemTaxable + itemTax);

            // GST rate bucket (5, 12, 18, 28)
            const buckets = [0, 5, 12, 18, 28];
            const bucket = buckets.reduce((prev, curr) =>
              Math.abs(curr - rawRate) < Math.abs(prev - rawRate) ? curr : prev
            );
            const bucketKey = `${bucket}%`;
            if (!gstRateMap[bucketKey]) {
              gstRateMap[bucketKey] = {
                gstRate: bucketKey,
                taxableValue: 0,
                cgst: 0,
                sgst: 0,
                igst: 0,
                gstCollected: 0,
                invoiceIds: new Set(),
              };
            }
            gstRateMap[bucketKey].taxableValue += itemTaxable;
            gstRateMap[bucketKey].cgst += itemCgst;
            gstRateMap[bucketKey].sgst += itemSgst;
            gstRateMap[bucketKey].gstCollected += itemTax;
            gstRateMap[bucketKey].invoiceIds.add(inv.id);
          });
        }

        // Cross-validate GST
        if (items.length > 0 && Math.abs(itemGstSum - taxTotal) > 1.0) {
          validationErrors.push(
            `${inv.invoice_number}: item GST Rs.${itemGstSum.toFixed(2)} ≠ invoice GST Rs.${taxTotal.toFixed(2)}`
          );
        }

        const invoiceTotalValueForGst = parseFloat((subtotal + taxTotal).toFixed(2));
        totalSales += invoiceTotalValueForGst;
        totalTaxable += subtotal;
        totalGst += taxTotal;

        const invRecord = {
          invoiceNumber: inv.invoice_number,
          invoiceDate: inv.created_at,
          customerName: custName,
          customerPhone: custPhone,
          customerGstin: custGstin || "",
          branch: invBranch,
          taxableValue: subtotal,
          cgst: parseFloat((taxTotal / 2).toFixed(2)),
          sgst: parseFloat((taxTotal / 2).toFixed(2)),
          igst: 0,
          gstAmount: taxTotal,
          totalValue: invoiceTotalValueForGst,
          status: inv.status,
          gstRate: invGstRate,
        };

        if (custGstin && custGstin.trim() !== "") {
          b2bInvoices.push(invRecord);
        } else {
          b2cInvoices.push(invRecord);
        }
        invoiceRegister.push(invRecord);
      }

      // Finalize GST rate map
      const gstRateSummary = Object.values(gstRateMap)
        .map((g: any) => ({ ...g, invoiceCount: g.invoiceIds.size, invoiceIds: undefined }))
        .sort((a: any, b: any) => parseInt(a.gstRate) - parseInt(b.gstRate));

      // B2C rate summary
      const b2cRateMap: Record<string, any> = {};
      for (const inv of b2cInvoices) {
        const key = inv.gstRate;
        if (!b2cRateMap[key]) {
          b2cRateMap[key] = { gstRate: key, invoiceCount: 0, taxableValue: 0, gstAmount: 0, totalValue: 0 };
        }
        b2cRateMap[key].invoiceCount += 1;
        b2cRateMap[key].taxableValue += inv.taxableValue;
        b2cRateMap[key].gstAmount += inv.gstAmount;
        b2cRateMap[key].totalValue += inv.totalValue;
      }

      const reportId = await generateReportId(adminSupabase, periodLabel);

      return NextResponse.json({
        success: true,
        validationErrors,
        report: {
          reportId,
          period: { startDate, endDate, month, year },
          branch: branch || "All Branches",
          generatedAt: new Date().toISOString(),
          generatedBy: user.email,
          summary: {
            totalInvoices: allInvoices.length,
            totalSales: parseFloat(totalSales.toFixed(2)),
            totalTaxable: parseFloat(totalTaxable.toFixed(2)),
            totalCgst: parseFloat(totalCgst.toFixed(2)),
            totalSgst: parseFloat(totalSgst.toFixed(2)),
            totalIgst: parseFloat(totalIgst.toFixed(2)),
            totalGst: parseFloat(totalGst.toFixed(2)),
            b2bCount: b2bInvoices.length,
            b2cCount: b2cInvoices.length,
          },
          b2bSales: b2bInvoices,
          b2cSales: b2cInvoices,
          b2cRateSummary: Object.values(b2cRateMap),
          hsnSummary: Object.values(hsnMap),
          gstRateSummary,
          invoiceRegister,
        },
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch (error) {
    logError("GSTR-1 API", error, { req: req as any });
    return NextResponse.json({ success: false, error: "An unexpected error occurred. Please try again later." }, { status: 500 });
  }
}
