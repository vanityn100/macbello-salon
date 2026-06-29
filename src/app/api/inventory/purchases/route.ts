import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function authenticateAdmin(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];

  const { data: { user }, error } = await adminSupabase.auth.getUser(token);
  if (error || !user || !user.email) return null;

  const role = user.app_metadata?.role;
  if (role !== "admin") return null;

  return { id: user.id, email: user.email };
}

export async function GET(req: Request) {
  const user = await authenticateAdmin(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    if (action === "list") {
      const { data, error } = await adminSupabase
        .from("stock_purchases")
        .select(`
          *,
          stock_purchase_items (
            *,
            services (
              name
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return NextResponse.json({ success: true, purchases: data });
    }
    
    if (action === "low_stock") {
       const branch = url.searchParams.get("branch");
       let query = adminSupabase.from("branch_inventory").select(`
         *,
         services!inner(name, item_code, category, status)
       `).lte("current_stock", 1).not("services.status", "in", '("archived","ARCHIVED")'); // User specifically requested <= 1 for low stock / out of stock
       
       if (branch && branch !== "All Branches") {
         query = query.eq("branch", branch);
       }
       
       const { data, error } = await query;
       if (error) throw error;
       return NextResponse.json({ success: true, low_stock: data });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Purchases API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await authenticateAdmin(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized. Admin access required." }, { status: 401 });

  try {
    const body = await req.json();
    const { supplier_name, supplier_gstin, supplier_phone, supplier_address, invoice_number, purchase_date, branch, notes, items } = body;

    if (!supplier_name || !purchase_date || !branch || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: "Missing required fields." }, { status: 400 });
    }

    // 1. Verify products and calculate totals server-side
    const productIds = items.map((i: any) => i.product_id);
    const { data: dbProducts, error: prodErr } = await adminSupabase
      .from("services")
      .select("id, name")
      .in("id", productIds);

    if (prodErr || !dbProducts || dbProducts.length !== productIds.length) {
      return NextResponse.json({ success: false, error: "One or more products not found in catalog." }, { status: 400 });
    }

    let subtotal = 0;
    let discount_total = 0;
    let taxable_amount = 0;
    let gst_total = 0;
    let grand_total = 0;

    const itemsToInsert = items.map((item: any) => {
      const qty = parseInt(item.quantity, 10);
      const rate = parseFloat(item.purchase_rate);
      const discountPct = parseFloat(item.discount_percent || 0);
      const gstPct = parseFloat(item.gst_percent || 0);

      if (qty <= 0 || rate < 0) throw new Error("Invalid quantity or rate.");

      const lineGross = qty * rate;
      const discountAmt = lineGross * (discountPct / 100);
      const taxable = lineGross - discountAmt;
      const gstAmt = taxable * (gstPct / 100);
      const lineTotal = taxable + gstAmt;

      subtotal += lineGross;
      discount_total += discountAmt;
      taxable_amount += taxable;
      gst_total += gstAmt;
      grand_total += lineTotal;

      return {
        product_id: item.product_id,
        mrp: parseFloat(item.mrp || 0),
        quantity: qty,
        purchase_rate: rate,
        discount_percent: discountPct,
        discount_amount: discountAmt,
        taxable_amount: taxable,
        gst_percent: gstPct,
        gst_amount: gstAmt,
        line_total: lineTotal
      };
    });

    // 2. Generate Purchase Number
    const purchaseNumber = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 3. Insert into stock_purchases
    const { data: purchase, error: purchaseErr } = await adminSupabase
      .from("stock_purchases")
      .insert([{
        purchase_number: purchaseNumber,
        invoice_number: invoice_number || null,
        supplier_name,
        supplier_gstin: supplier_gstin || null,
        supplier_phone: supplier_phone || null,
        supplier_address: supplier_address || null,
        purchase_date,
        branch,
        notes: notes || null,
        subtotal: parseFloat(subtotal.toFixed(2)),
        discount_total: parseFloat(discount_total.toFixed(2)),
        taxable_amount: parseFloat(taxable_amount.toFixed(2)),
        gst_total: parseFloat(gst_total.toFixed(2)),
        grand_total: parseFloat(grand_total.toFixed(2)),
        created_by: user.email
      }])
      .select("id")
      .single();

    if (purchaseErr || !purchase) throw new Error("Failed to create purchase record.");

    // 4. Insert items
    const finalItems = itemsToInsert.map(i => ({ ...i, purchase_id: purchase.id }));
    const { error: itemsErr } = await adminSupabase.from("stock_purchase_items").insert(finalItems);

    if (itemsErr) {
      // Rollback
      await adminSupabase.from("stock_purchases").delete().eq("id", purchase.id);
      throw new Error("Failed to create purchase line items.");
    }

    // 5. Update branch_inventory logic
    for (const item of finalItems) {
      // Check if product exists in branch_inventory
      const { data: invRow, error: invFetchErr } = await adminSupabase
        .from("branch_inventory")
        .select("id, current_stock")
        .eq("branch", branch)
        .eq("service_id", item.product_id)
        .maybeSingle();

      if (invRow) {
        // Update existing stock
        await adminSupabase
          .from("branch_inventory")
          .update({ current_stock: invRow.current_stock + item.quantity })
          .eq("id", invRow.id);
      } else {
        // Create new inventory record for this branch
        await adminSupabase
          .from("branch_inventory")
          .insert([{
            service_id: item.product_id,
            branch: branch,
            current_stock: item.quantity,
            minimum_stock: 5 // Default minimum
          }]);
      }
      
      // Also log into inventory_transactions
      await adminSupabase.from("inventory_transactions").insert([{
         product_id: item.product_id,
         branch: branch,
         transaction_type: "STOCK_IN",
         quantity: item.quantity,
         created_by: user.email
      }]);
    }

    // 6. Log security audit
    const { error: logErr } = await adminSupabase.from("security_logs").insert([{
      user_id: user.id,
      user_email: user.email,
      action: "stock_purchase_created",
      details: `Recorded purchase ${purchaseNumber} from ${supplier_name} for INR ${grand_total.toFixed(2)} at ${branch}`,
      ip_address: req.headers.get("x-forwarded-for") || "unknown"
    }]);

    return NextResponse.json({ success: true, purchase_id: purchase.id, purchase_number: purchaseNumber });

  } catch (error: any) {
    console.error("Purchases Post Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to process purchase." }, { status: 500 });
  }
}
