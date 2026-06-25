import { NextResponse } from "next/server";
import { logError } from '@/lib/logger';
import { getSupabaseAdmin } from "@/lib/supabase";

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

    if (action === "get_tax_report") {
      if (!startDate || !endDate) {
        return NextResponse.json({ success: false, error: "Date range required" }, { status: 400 });
      }

      const startISO = new Date(startDate);
      startISO.setHours(0, 0, 0, 0);
      const endISO = new Date(endDate);
      endISO.setHours(23, 59, 59, 999);

      let invoicesQuery = adminSupabase
        .from("invoices")
        .select(`
          id, invoice_number, created_at, subtotal, discount, total_tax, grand_total, branch, status,
          customers (name),
          invoice_items (item_name, category, quantity, unit_price, tax_rate, line_total, hsn)
        `)
        .gte("created_at", startISO.toISOString())
        .lte("created_at", endISO.toISOString())
        .neq("status", "archived"); // Exclude permanently deleted/archived, but keep active for tax

      if (branch && branch !== "All Branches") {
        invoicesQuery = invoicesQuery.eq("branch", branch);
      }

      // Paginate to fetch all invoices in range safely
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

      // Process Data server-side
      let totalSales = 0;
      let totalTaxable = 0;
      let totalGstCollected = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0; // Keeping structure ready if IGST is introduced

      const invoiceRegister: any[] = [];
      const detailedTransactions: any[] = [];
      const hsnMap: Record<string, any> = {};
      const gstRateMap: Record<string, any> = {};
      const branchMap: Record<string, any> = {};
      const itemMap: Record<string, any> = {};

      allInvoices.forEach(inv => {
        const grandTotal = parseFloat(inv.grand_total) || 0;
        const taxTotal = parseFloat(inv.total_tax) || 0;
        const subtotal = parseFloat(inv.subtotal) || 0;
        
        totalSales += grandTotal;
        totalTaxable += subtotal;
        totalGstCollected += taxTotal;

        // Splitting logic strictly based on existing architecture: 50% CGST / 50% SGST
        const cgstAmount = taxTotal / 2;
        const sgstAmount = taxTotal / 2;
        const igstAmount = 0;

        totalCgst += cgstAmount;
        totalSgst += sgstAmount;
        totalIgst += igstAmount;

        const customerName = inv.customers?.name || "Walk-in";
        const invBranch = inv.branch || "Global";

        // Kaduthuruthyggregation
        if (!branchMap[invBranch]) {
          branchMap[invBranch] = { branchName: invBranch, invoiceCount: 0, revenue: 0, taxableValue: 0, gstCollected: 0 };
        }
        branchMap[invBranch].invoiceCount += 1;
        branchMap[invBranch].revenue += grandTotal;
        branchMap[invBranch].taxableValue += subtotal;
        branchMap[invBranch].gstCollected += taxTotal;

        // Invoice Register
        invoiceRegister.push({
          invoiceNumber: inv.invoice_number,
          invoiceDate: inv.created_at,
          customerName: customerName,
          customerGstin: "—",
          branch: invBranch,
          taxableValue: subtotal,
          discount: parseFloat(inv.discount) || 0,
          cgst: cgstAmount,
          sgst: sgstAmount,
          igst: igstAmount,
          totalValue: grandTotal,
          status: inv.status
        });

        // Items logic
        const items = inv.invoice_items || [];
        items.forEach((item: any) => {
          const qty = item.quantity || 1;
          const rate = parseFloat(item.tax_rate) || 0;
          const lineTotal = parseFloat(item.line_total) || 0;
          
          // Tax logic per item
          // Since line_total = taxable + tax, and tax = taxable * rate
          // taxable = line_total / (1 + rate)
          const itemTaxable = lineTotal / (1 + rate);
          const itemTax = lineTotal - itemTaxable;
          const itemCgst = itemTax / 2;
          const itemSgst = itemTax / 2;

          const ratePercentage = (rate * 100).toFixed(0) + "%";

          // HSN Aggregation
          const hsnCode = item.hsn || "Unassigned";
          if (!hsnMap[hsnCode]) {
            hsnMap[hsnCode] = { 
              hsnCode, 
              description: item.category, // using category as a proxy
              quantity: 0, 
              taxableValue: 0, 
              gstRate: ratePercentage,
              cgst: 0, sgst: 0, igst: 0, 
              totalValue: 0 
            };
          }
          hsnMap[hsnCode].quantity += qty;
          hsnMap[hsnCode].taxableValue += itemTaxable;
          hsnMap[hsnCode].cgst += itemCgst;
          hsnMap[hsnCode].sgst += itemSgst;
          hsnMap[hsnCode].totalValue += lineTotal;

          // GST Rate Aggregation
          if (!gstRateMap[ratePercentage]) {
            gstRateMap[ratePercentage] = { gstRate: ratePercentage, taxableValue: 0, gstCollected: 0, invoiceCount: new Set() };
          }
          gstRateMap[ratePercentage].taxableValue += itemTaxable;
          gstRateMap[ratePercentage].gstCollected += itemTax;
          gstRateMap[ratePercentage].invoiceCount.add(inv.id);

          // Item Sales Aggregation
          const itemName = item.item_name || "Unknown Item";
          if (!itemMap[itemName]) {
            itemMap[itemName] = {
              itemName,
              category: item.category || "Service",
              quantity: 0,
              revenue: 0
            };
          }
          itemMap[itemName].quantity += qty;
          itemMap[itemName].revenue += lineTotal;

          // Detailed Transactions
          const rawUnitPrice = parseFloat(item.unit_price) || 0;
          // unit_price in DB is GST-inclusive; compute taxable (pre-GST) unit price
          const taxableUnitPrice = rate > 0 ? rawUnitPrice / (1 + rate) : rawUnitPrice;
          detailedTransactions.push({
            date: inv.created_at,
            invoiceNumber: inv.invoice_number,
            customer: customerName,
            itemName: item.item_name,
            hsnCode: hsnCode,
            quantity: qty,
            unitPrice: taxableUnitPrice,   // Pre-GST price per unit
            gstRate: ratePercentage,
            gstAmount: itemTax,
            finalAmount: lineTotal,        // GST-inclusive total
            branch: invBranch
          });
        });
      });

      // Format sets back to counts
      const finalGstRateSummary = Object.values(gstRateMap).map((g: any) => ({
        ...g,
        invoiceCount: g.invoiceCount.size
      }));

      const itemSummary = Object.values(itemMap).sort((a: any, b: any) => b.quantity - a.quantity);

      return NextResponse.json({
        success: true,
        report: {
          summary: {
            totalSales,
            totalTaxable,
            totalGstCollected,
            totalCgst,
            totalSgst,
            totalIgst,
            totalTransactions: detailedTransactions.length,
            totalInvoices: allInvoices.length
          },
          hsnSummary: Object.values(hsnMap),
          gstRateSummary: finalGstRateSummary,
          branchSummary: Object.values(branchMap),
          itemSummary,
          invoiceRegister,
          detailedTransactions
        }
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    logError("Tax Reporting API", error, { req: req as any });
    return NextResponse.json({ success: false, error: "An unexpected error occurred. Please try again later." }, { status: 500 });
  }
}
