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
        .select(`
          *,
          branch_inventory (
            branch,
            current_stock,
            minimum_stock
          ),
          product_allocations (
            branch,
            allocated_quantity
          )
        `)
        .eq("category", "Retail")
        .not("status", "in", '("archived","ARCHIVED")')
        .order("name", { ascending: true });

      const { data, error } = await query;
      if (error) throw error;

      const formattedProducts = data.map((item: any) => {
        let currentStock = 0;
        let minimumStock = 5;

        if (targetBranch === "All Branches" || !targetBranch) {
          currentStock = item.branch_inventory?.reduce((sum: number, b: any) => sum + (b.current_stock || 0), 0) || 0;
          minimumStock = item.branch_inventory?.reduce((sum: number, b: any) => sum + (b.minimum_stock || 0), 0) || 0;
        } else {
          const branchRecord = item.branch_inventory?.find((b: any) => b.branch === targetBranch);
          if (branchRecord) {
            currentStock = branchRecord.current_stock;
            minimumStock = branchRecord.minimum_stock;
          }
        }

        // We clean up branch_inventory from response to keep payload small for billing,
        // but for Admin UI we pass raw_branch_inventory and product_allocations.
        const { branch_inventory, product_allocations, ...rest } = item;
        return {
          ...rest,
          current_stock: currentStock,
          minimum_stock: minimumStock,
          raw_branch_inventory: branch_inventory,
          product_allocations: product_allocations || []
        };
      });

      return NextResponse.json({ success: true, products: formattedProducts });
    }

    // ── 1.5 CREATE PRODUCT (MANUAL ENTRY) ───────────────────
    if (action === "create_product") {
      const { name, price, hsn, gstRate, targetBranch, initialStock, minimumStock, itemCode } = body;

      if (!name || isNaN(price) || isNaN(gstRate)) {
        return NextResponse.json({ success: false, error: "Invalid product details." }, { status: 400 });
      }

      const branchToAssign = role === "admin" ? (targetBranch === "All Branches" ? null : targetBranch) : userBranch;
      
      let finalItemCode = itemCode && typeof itemCode === "string" ? itemCode.trim().replace(/<[^>]*>/g, "") : null;
      
      if (!finalItemCode) {
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
        finalItemCode = `MAC${nextNum.toString().padStart(3, '0')}`;
      }

      const { data, error } = await adminSupabase.from("services").insert({
        name: name.trim(),
        category: "Retail",
        price: Number(price),
        branch: null, // Retail products are globally defined
        hsn: hsn || "999729",
        tax_rate: Number(gstRate) / 100,
        item_code: finalItemCode,
        status: "active",
        current_stock: 0,
        minimum_stock: 5
      }).select().single();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      // Generate branch_inventory records for all 3 branches
      const minStockNum = Number(minimumStock) || 5;
      await adminSupabase.from("branch_inventory").insert([
        { service_id: data.id, branch: "Kaduthuruthy", current_stock: 0, minimum_stock: minStockNum },
        { service_id: data.id, branch: "Ettumanoor", current_stock: 0, minimum_stock: minStockNum },
        { service_id: data.id, branch: "Peruva", current_stock: 0, minimum_stock: minStockNum }
      ]);

      if (Number(initialStock) > 0) {
        // Find the specific branch inventory record to update
        if (targetBranch && targetBranch !== "All Branches") {
          await adminSupabase.from("branch_inventory")
            .update({ current_stock: Number(initialStock) })
            .eq("service_id", data.id)
            .eq("branch", targetBranch);
        } else {
          // If admin adds without branch, add to all? No, just keep as 0, or add to first. 
          // Usually they must select a branch. If All Branches, maybe we don't add initial stock.
        }

        await adminSupabase.from("inventory_transactions").insert({
          product_id: data.id,
          branch: targetBranch,
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
      let { targetBranch, productId, transactionType, quantity } = body;

      if (!targetBranch) targetBranch = "Global";

      if (!productId || !transactionType || !quantity) {
        return NextResponse.json({ success: false, error: "Missing required details." }, { status: 400 });
      }

      const numQty = parseInt(quantity, 10);
      if (isNaN(numQty) || numQty === 0) {
        return NextResponse.json({ success: false, error: "Invalid quantity." }, { status: 400 });
      }

      // 1. Fetch current product inventory for this branch
      let { data: branchInv, error: fetchErr } = await adminSupabase
        .from("branch_inventory")
        .select("id, current_stock")
        .eq("service_id", productId)
        .eq("branch", targetBranch)
        .maybeSingle();
        
      let newStock = numQty;

      if (!branchInv) {
        // Upsert if missing
        const { error: insertErr } = await adminSupabase.from("branch_inventory").insert({
          service_id: productId,
          branch: targetBranch,
          current_stock: newStock,
          minimum_stock: 5
        });
        if (insertErr) throw insertErr;
      } else {
        newStock = branchInv.current_stock + numQty;
        // 2. Update stock
        const { error: updateErr } = await adminSupabase
          .from("branch_inventory")
          .update({ current_stock: newStock })
          .eq("id", branchInv.id);
          
        if (updateErr) throw updateErr;
      }

      // Calculate new global stock for this product to update status
      const { data: allInv } = await adminSupabase
        .from("branch_inventory")
        .select("current_stock")
        .eq("service_id", productId);
        
      if (allInv) {
        const totalStock = allInv.reduce((sum, item) => sum + (item.current_stock || 0), 0);
        let newStatus = 'ACTIVE';
        if (totalStock <= 0) newStatus = 'OUT OF STOCK';
        else if (totalStock === 1) newStatus = 'LOW STOCK';

        await adminSupabase.from("services").update({ status: newStatus }).eq("id", productId).not("status", "in", '("archived","ARCHIVED")');
      }

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


// Just writing out the chunk to be injected.

    // ── NEW WAREHOUSE ACTIONS ──────────────────────────────
    if (action === "receive_stock") {
      const { productId, quantity, notes } = body;
      const numQty = parseInt(quantity, 10);
      if (!productId || isNaN(numQty) || numQty <= 0) return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });

      const { data: serviceData } = await adminSupabase.from("services").select("total_received").eq("id", productId).single();
      const currentTotal = serviceData?.total_received || 0;
      await adminSupabase.from("services").update({ total_received: currentTotal + numQty }).eq("id", productId);

      let { data: branchInv } = await adminSupabase.from("branch_inventory").select("id, current_stock").eq("service_id", productId).eq("branch", "Warehouse").maybeSingle();
      if (!branchInv) {
        await adminSupabase.from("branch_inventory").insert({ service_id: productId, branch: "Warehouse", current_stock: numQty, minimum_stock: 5 });
      } else {
        await adminSupabase.from("branch_inventory").update({ current_stock: branchInv.current_stock + numQty }).eq("id", branchInv.id);
      }

      await adminSupabase.from("inventory_transactions").insert({
        product_id: productId, branch: "Warehouse", transaction_type: "RECEIVE", quantity: numQty, source: "Supplier", destination: "Warehouse", created_by: user.email, notes
      });

      return NextResponse.json({ success: true });
    }

    if (action === "allocate_stock") {
      const { productId, targetBranch, quantity, notes } = body;
      const numQty = parseInt(quantity, 10);
      if (!productId || !targetBranch || isNaN(numQty) || numQty <= 0) return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });

      let { data: whInv } = await adminSupabase.from("branch_inventory").select("id, current_stock").eq("service_id", productId).eq("branch", "Warehouse").maybeSingle();
      if (!whInv || whInv.current_stock < numQty) return NextResponse.json({ success: false, error: "Insufficient unallocated warehouse stock." }, { status: 400 });

      await adminSupabase.from("branch_inventory").update({ current_stock: whInv.current_stock - numQty }).eq("id", whInv.id);

      let { data: branchInv } = await adminSupabase.from("branch_inventory").select("id, current_stock").eq("service_id", productId).eq("branch", targetBranch).maybeSingle();
      if (!branchInv) {
        await adminSupabase.from("branch_inventory").insert({ service_id: productId, branch: targetBranch, current_stock: numQty, minimum_stock: 5 });
      } else {
        await adminSupabase.from("branch_inventory").update({ current_stock: branchInv.current_stock + numQty }).eq("id", branchInv.id);
      }

      let { data: allocData } = await adminSupabase.from("product_allocations").select("id, allocated_quantity").eq("product_id", productId).eq("branch", targetBranch).maybeSingle();
      if (!allocData) {
        await adminSupabase.from("product_allocations").insert({ product_id: productId, branch: targetBranch, allocated_quantity: numQty });
      } else {
        await adminSupabase.from("product_allocations").update({ allocated_quantity: allocData.allocated_quantity + numQty }).eq("id", allocData.id);
      }

      await adminSupabase.from("inventory_transactions").insert({
        product_id: productId, branch: targetBranch, transaction_type: "ALLOCATE", quantity: numQty, source: "Warehouse", destination: targetBranch, created_by: user.email, notes
      });
      return NextResponse.json({ success: true });
    }

    if (action === "transfer_stock") {
      const { productId, sourceBranch, targetBranch, quantity, notes } = body;
      const numQty = parseInt(quantity, 10);
      if (!productId || !sourceBranch || !targetBranch || isNaN(numQty) || numQty <= 0) return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });

      let { data: srcInv } = await adminSupabase.from("branch_inventory").select("id, current_stock").eq("service_id", productId).eq("branch", sourceBranch).maybeSingle();
      if (!srcInv || srcInv.current_stock < numQty) return NextResponse.json({ success: false, error: "Insufficient stock in source branch." }, { status: 400 });

      await adminSupabase.from("branch_inventory").update({ current_stock: srcInv.current_stock - numQty }).eq("id", srcInv.id);

      let { data: destInv } = await adminSupabase.from("branch_inventory").select("id, current_stock").eq("service_id", productId).eq("branch", targetBranch).maybeSingle();
      if (!destInv) {
        await adminSupabase.from("branch_inventory").insert({ service_id: productId, branch: targetBranch, current_stock: numQty, minimum_stock: 5 });
      } else {
        await adminSupabase.from("branch_inventory").update({ current_stock: destInv.current_stock + numQty }).eq("id", destInv.id);
      }

      // Do NOT modify product_allocations as per user's required change!

      await adminSupabase.from("inventory_transactions").insert({
        product_id: productId, branch: targetBranch, transaction_type: "TRANSFER", quantity: numQty, source: sourceBranch, destination: targetBranch, created_by: user.email, notes
      });
      return NextResponse.json({ success: true });
    }

    if (action === "return_stock") {
      const { productId, sourceBranch, quantity, notes } = body;
      const numQty = parseInt(quantity, 10);
      if (!productId || !sourceBranch || isNaN(numQty) || numQty <= 0) return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });

      let { data: srcInv } = await adminSupabase.from("branch_inventory").select("id, current_stock").eq("service_id", productId).eq("branch", sourceBranch).maybeSingle();
      if (!srcInv || srcInv.current_stock < numQty) return NextResponse.json({ success: false, error: "Insufficient stock in source branch." }, { status: 400 });

      await adminSupabase.from("branch_inventory").update({ current_stock: srcInv.current_stock - numQty }).eq("id", srcInv.id);

      let { data: whInv } = await adminSupabase.from("branch_inventory").select("id, current_stock").eq("service_id", productId).eq("branch", "Warehouse").maybeSingle();
      if (!whInv) {
        await adminSupabase.from("branch_inventory").insert({ service_id: productId, branch: "Warehouse", current_stock: numQty, minimum_stock: 5 });
      } else {
        await adminSupabase.from("branch_inventory").update({ current_stock: whInv.current_stock + numQty }).eq("id", whInv.id);
      }

      // Do NOT modify product_allocations as per user's required change!

      await adminSupabase.from("inventory_transactions").insert({
        product_id: productId, branch: "Warehouse", transaction_type: "RETURN", quantity: numQty, source: sourceBranch, destination: "Warehouse", created_by: user.email, notes
      });
      return NextResponse.json({ success: true });
    }

    // ── 3. DELETE PRODUCT ───────────────────────────────────
    if (action === "delete_product") {
      const { productId } = body;

      if (role !== "admin") {
        return NextResponse.json({ success: false, error: "Only administrators can delete products." }, { status: 403 });
      }

      // Safe soft delete to prevent historical report breaks and cascading issues
      const { error: delError } = await adminSupabase
        .from("services")
        .update({ status: "archived" })
        .eq("id", productId);

      if (delError) {
        return NextResponse.json({ success: false, error: delError.message }, { status: 500 });
      }

      await adminSupabase.from("audit_logs").insert({
        user_id: user.email,
        role: role,
        action: "inventory_delete_product",
        details: `Soft-deleted product with ID ${productId} (set status to archived)`
      });

      return NextResponse.json({ success: true });
    }

    // ── 4. RESET INVENTORY ───────────────────────────────────
    if (action === "reset_inventory") {
      if (role !== "admin") {
        return NextResponse.json({ success: false, error: "Only administrators can reset inventory." }, { status: 403 });
      }

      // 1. Reset all stock to 0
      const { error: resetErr } = await adminSupabase
        .from("branch_inventory")
        .update({ current_stock: 0 })
        .neq("current_stock", 0); // Optimization

      if (resetErr) {
        return NextResponse.json({ success: false, error: resetErr.message }, { status: 500 });
      }

      // Also reset product statuses to OUT OF STOCK (except archived ones)
      await adminSupabase
        .from("services")
        .update({ status: 'OUT OF STOCK' })
        .not("status", "in", '("archived","ARCHIVED")');

      // 2. Log the INVENTORY_RESET event
      await adminSupabase.from("audit_logs").insert({
        user_id: user.email,
        role: role,
        action: "INVENTORY_RESET",
        details: `Inventory was completely reset. All stock zeroed.`
      });

      return NextResponse.json({ success: true });
    }

    // ── 5. GET PRODUCT SUMMARY REPORT ───────────────────────
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
        .select(`
          *,
          branch_inventory ( branch, current_stock, minimum_stock ), product_allocations ( branch, allocated_quantity )
        `)
        .eq("category", "Retail")
        .not("status", "in", '("archived","ARCHIVED")')
        .order("name", { ascending: true });

      const { data: products, error: pErr } = await productQuery;
      if (pErr) throw pErr;

      // Fetch latest INVENTORY_RESET timestamp
      const { data: resetLog } = await adminSupabase
        .from("audit_logs")
        .select("created_at")
        .eq("action", "INVENTORY_RESET")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const resetTimestamp = resetLog ? new Date(resetLog.created_at) : null;
      
      let invoiceQuery = adminSupabase
        .from("invoice_items")
        .select(`
          item_name, quantity, line_total, tax_rate,
          invoices!inner(branch, created_at, status)
        `)
        .eq("category", "Retail")
        .neq("invoices.status", "archived")
        .lte("invoices.created_at", endISO.toISOString());

      if (resetTimestamp && resetTimestamp > startISO) {
          invoiceQuery = invoiceQuery.gte("invoices.created_at", resetTimestamp.toISOString());
      } else {
          invoiceQuery = invoiceQuery.gte("invoices.created_at", startISO.toISOString());
      }

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
        
        // The line_total stored in the database is already GST-inclusive
        const totalInc = lineTotal;
        const taxable = totalInc / (1 + rate);
        const gst = totalInc - taxable;

        salesMap[name].qty += sale.quantity;
        salesMap[name].taxable += taxable;
        salesMap[name].gst += gst;
        salesMap[name].revenue += totalInc;
      }

      const report = products.map((p: any) => {
        const sales = salesMap[p.name] || { qty: 0, taxable: 0, gst: 0, revenue: 0 };
        
        let currentStock = 0;
        let minimumStock = 5;

        if (targetBranch === "All Branches" || !targetBranch) {
          currentStock = p.branch_inventory?.reduce((sum: number, b: any) => sum + (b.current_stock || 0), 0) || 0;
          minimumStock = p.branch_inventory?.reduce((sum: number, b: any) => sum + (b.minimum_stock || 0), 0) || 0;
        } else {
          const branchRecord = p.branch_inventory?.find((b: any) => b.branch === targetBranch);
          if (branchRecord) {
            currentStock = branchRecord.current_stock;
            minimumStock = branchRecord.minimum_stock;
          }
        }

        const rawRate = parseFloat(p.tax_rate) || 0;
        const rateLabel = (rawRate > 1 ? rawRate : rawRate * 100).toFixed(0) + "%";

        return {
          productId: p.id,
          productName: p.name,
          category: p.category,
          hsn: p.hsn || "—",
          itemCode: p.item_code || "",
          gstRate: rateLabel,
          currentStock: currentStock,
          minimumStock: minimumStock,
          status: p.status,
          quantitySold: sales.qty,
          revenue: sales.revenue,
          taxableValue: sales.taxable,
          gstCollected: sales.gst,
          totalReceived: p.total_received || 0,
          rawBranchInventory: p.branch_inventory || [],
          productAllocations: p.product_allocations || []
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
