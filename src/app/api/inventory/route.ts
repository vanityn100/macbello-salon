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

    const role = user.app_metadata?.role;
    const userBranch = user.app_metadata?.branch;
    const body = await req.json();
    const { action } = body;

    // ── 1. GET PRODUCTS (INVENTORY) ─────────────────────────
    if (action === "get_products") {
      const { branch } = body;
      
      let targetBranch = branch;
      if (role === "staff") {
        targetBranch = userBranch;
      }

      let query = adminSupabase
        .from("services")
        .select("*")
        .eq("category", "Retail")
        .order("name", { ascending: true });

      if (targetBranch && targetBranch !== "All Branches") {
        query = query.or(`branch.is.null,branch.eq."${targetBranch}"`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json({ success: true, products: data });
    }

    // ── 1.5 CREATE PRODUCT (MANUAL ENTRY) ───────────────────
    if (action === "create_product") {
      const { name, price, hsn, gstRate, targetBranch, initialStock, minimumStock } = body;

      if (!name || isNaN(price) || isNaN(gstRate)) {
        return NextResponse.json({ success: false, error: "Invalid product details." }, { status: 400 });
      }

      const branchToAssign = role === "admin" ? (targetBranch === "All Branches" ? null : targetBranch) : userBranch;

      const { data, error } = await adminSupabase.from("services").insert({
        name: name.trim(),
        category: "Retail",
        price: Number(price),
        branch: branchToAssign || null,
        hsn: hsn || "999729",
        tax_rate: Number(gstRate) / 100,
        status: "active",
        current_stock: Number(initialStock) || 0,
        minimum_stock: Number(minimumStock) || 5
      }).select().single();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      if (Number(initialStock) > 0) {
        await adminSupabase.from("inventory_transactions").insert({
          product_id: data.id,
          branch: branchToAssign,
          transaction_type: "STOCK_IN",
          quantity: Number(initialStock),
          created_by: user.email
        });
      }

      await adminSupabase.from("audit_logs").insert({
        user_id: user.email,
        role: role,
        branch: branchToAssign,
        action: "inventory_create_product",
        details: `Created product ${name} with initial stock ${initialStock}`
      });

      return NextResponse.json({ success: true, product: data });
    }

    // ── 2. UPDATE STOCK ─────────────────────────────────────
    if (action === "update_stock") {
      const { productId, quantity, transactionType, targetBranch } = body;

      if (role === "staff" && targetBranch !== userBranch) {
        return NextResponse.json({ success: false, error: "Cannot modify stock for other branches." }, { status: 403 });
      }

      const numQty = parseInt(quantity, 10);
      if (isNaN(numQty) || numQty === 0) {
        return NextResponse.json({ success: false, error: "Invalid quantity." }, { status: 400 });
      }

      // 1. Fetch current product
      const { data: product, error: fetchErr } = await adminSupabase
        .from("services")
        .select("id, current_stock, branch")
        .eq("id", productId)
        .single();
        
      if (fetchErr || !product) throw fetchErr;

      const newStock = product.current_stock + numQty;

      // 2. Update stock
      const { error: updateErr } = await adminSupabase
        .from("services")
        .update({ current_stock: newStock })
        .eq("id", productId);
        
      if (updateErr) throw updateErr;

      // 3. Log transaction
      await adminSupabase.from("inventory_transactions").insert({
        product_id: productId,
        branch: targetBranch,
        transaction_type: transactionType,
        quantity: numQty,
        created_by: user.email
      });

      // 4. Audit Log
      await adminSupabase.from("audit_logs").insert({
        user_id: user.email,
        role: role,
        branch: targetBranch,
        action: `inventory_${transactionType.toLowerCase()}`,
        details: `Modified stock for product ${productId} by ${numQty}. New stock: ${newStock}`
      });

      return NextResponse.json({ success: true, newStock });
    }

    // ── 3. DELETE PRODUCT ───────────────────────────────────
    if (action === "delete_product") {
      const { productId } = body;

      if (role !== "admin") {
        return NextResponse.json({ success: false, error: "Only administrators can delete products." }, { status: 403 });
      }

      // Check if product is used in any invoices before deleting, or just delete if cascaded
      // For safety, we will just delete it from services. If there's an FK constraint, it will fail gracefully.
      const { error: delError } = await adminSupabase
        .from("services")
        .delete()
        .eq("id", productId);

      if (delError) {
        return NextResponse.json({ success: false, error: delError.message }, { status: 500 });
      }

      await adminSupabase.from("audit_logs").insert({
        user_id: user.email,
        role: role,
        action: "inventory_delete_product",
        details: `Deleted product with ID ${productId}`
      });

      return NextResponse.json({ success: true });
    }

    // ── 3. GET PRODUCT SUMMARY REPORT ───────────────────────
    if (action === "get_summary_report") {
      const { startDate, endDate, branch } = body;
      
      let targetBranch = branch;
      if (role === "staff") {
        targetBranch = userBranch;
      }

      const startISO = new Date(startDate);
      startISO.setHours(0, 0, 0, 0);
      const endISO = new Date(endDate);
      endISO.setHours(23, 59, 59, 999);

      let productQuery = adminSupabase
        .from("services")
        .select("*")
        .eq("category", "Retail")
        .order("name", { ascending: true });

      if (targetBranch && targetBranch !== "All Branches") {
        productQuery = productQuery.or(`branch.is.null,branch.eq."${targetBranch}"`);
      }
      const { data: products, error: pErr } = await productQuery;
      if (pErr) throw pErr;

      let invoiceQuery = adminSupabase
        .from("invoice_items")
        .select(`
          item_name, quantity, line_total, tax_rate,
          invoices!inner(branch, created_at, status)
        `)
        .eq("category", "Retail")
        .neq("invoices.status", "archived")
        .gte("invoices.created_at", startISO.toISOString())
        .lte("invoices.created_at", endISO.toISOString());

      if (targetBranch && targetBranch !== "All Branches") {
        invoiceQuery = invoiceQuery.eq("invoices.branch", targetBranch);
      }

      const { data: soldItems, error: iErr } = await invoiceQuery;
      if (iErr) throw iErr;

      const salesMap: Record<string, { qty: number, taxable: number, gst: number, revenue: number }> = {};
      
      for (const sale of soldItems || []) {
        const name = sale.item_name;
        if (!salesMap[name]) {
          salesMap[name] = { qty: 0, taxable: 0, gst: 0, revenue: 0 };
        }
        
        const lineTotal = parseFloat(sale.line_total) || 0;
        const rate = parseFloat(sale.tax_rate) || 0;
        
        const taxable = lineTotal; // items stored pre-tax
        const gst = lineTotal * rate;
        const totalInc = taxable + gst;

        salesMap[name].qty += sale.quantity;
        salesMap[name].taxable += taxable;
        salesMap[name].gst += gst;
        salesMap[name].revenue += totalInc;
      }

      const report = products.map((p: any) => {
        const sales = salesMap[p.name] || { qty: 0, taxable: 0, gst: 0, revenue: 0 };
        return {
          productId: p.id,
          productName: p.name,
          category: p.category,
          hsn: p.hsn || "—",
          gstRate: (parseFloat(p.tax_rate) * 100).toFixed(0) + "%",
          currentStock: p.current_stock || 0,
          minimumStock: p.minimum_stock || 0,
          status: p.status,
          quantitySold: sales.qty,
          revenue: sales.revenue,
          taxableValue: sales.taxable,
          gstCollected: sales.gst
        };
      });

      return NextResponse.json({ success: true, report });
    }

    // ── 4. LOG EXPORT ───────────────────────────────────────
    if (action === "log_export") {
      const { exportFormat, branch } = body;
      await adminSupabase.from("audit_logs").insert({
        user_id: user.email,
        role: role,
        branch: branch || userBranch,
        action: `inventory_report_export_${exportFormat.toLowerCase()}`,
        details: `Exported Product Summary Report in ${exportFormat} format for ${branch}`
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    logError("Inventory API", error, { req: req as any });
    return NextResponse.json({ success: false, error: "An unexpected error occurred. Please try again later." }, { status: 500 });
  }
}
