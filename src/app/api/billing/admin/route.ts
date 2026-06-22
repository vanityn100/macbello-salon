import { NextRequest, NextResponse } from "next/server";
import { supabase, getSupabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";

// Authenticate staff helper
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

// Allowed branches
const ALLOWED_BRANCHES = ["Kaduthuruthy", "Ettumanoor", "Peruva"];

export async function GET(request: NextRequest) {
  try {
    const staff = await authenticateStaff(request);
    if (!staff) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const adminSupabase = getSupabaseAdmin();

    if (action === "get_services") {
      const { data: services, error } = await adminSupabase
        .from("services")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        console.error("Fetch services error:", error);
        return NextResponse.json({ success: false, error: "Failed to load menu items." }, { status: 500 });
      }

      return NextResponse.json({ success: true, services });
    }

    if (action === "search_customers") {
      const phone = searchParams.get("phone") || "";
      const cleanPhone = phone.trim().replace(/[\s\-()]/g, "");

      if (!cleanPhone) {
        return NextResponse.json({ success: false, error: "Phone number required." }, { status: 400 });
      }

      const { data: customers, error } = await adminSupabase
        .from("customers")
        .select("id, name, phone, email, points")
        .ilike("phone", `%${cleanPhone}%`)
        .limit(10);

      if (error) {
        console.error("Search customers error:", error);
        return NextResponse.json({ success: false, error: "Failed to query customers." }, { status: 500 });
      }

      return NextResponse.json({ success: true, customers });
    }

    if (action === "get_daily_stats") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: invoices, error } = await adminSupabase
        .from("invoices")
        .select("grand_total, branch, created_at, invoice_items(line_total, staff_contribution)")
        .gte("created_at", todayStart.toISOString());

      if (error) {
        console.error("Fetch daily stats error:", error);
        return NextResponse.json({ success: false, error: "Failed to load daily metrics." }, { status: 500 });
      }

      let totalSales = 0;
      const branchBreakdown: Record<string, number> = {
        Kaduthuruthy: 0,
        Ettumanoor: 0,
        Peruva: 0
      };
      const staffBreakdown: Record<string, { revenue: number; count: number }> = {};

      invoices?.forEach((inv) => {
        const amt = parseFloat(inv.grand_total) || 0;
        totalSales += amt;
        if (inv.branch && branchBreakdown[inv.branch] !== undefined) {
          branchBreakdown[inv.branch] += amt;
        }

        // Aggregate staff performance from nested invoice_items
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

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch (err) {
    console.error("Billing GET API Error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const staff = await authenticateStaff(request);
    if (!staff) {
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

    // 1. SERVICE / PRODUCT MANAGEMENT
    if (action === "create_service") {
      const { name, price, category, itemCode, hsn, taxRate } = body;
      
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

      const cleanItemCode = itemCode && typeof itemCode === "string" ? itemCode.trim() : null;
      const cleanHsn = hsn && typeof hsn === "string" ? hsn.trim() : null;

      // Sanitization: Escape HTML tags to prevent XSS
      const cleanName = name.replace(/<[^>]*>/g, "").trim();
      const safeItemCode = cleanItemCode ? cleanItemCode.replace(/<[^>]*>/g, "") : null;
      const safeHsn = cleanHsn ? cleanHsn.replace(/<[^>]*>/g, "") : null;

      let parsedTaxRate = category === "Service" ? 0.05 : 0.18;
      if (taxRate !== undefined) {
        const tempTax = parseFloat(taxRate);
        if (!isNaN(tempTax) && tempTax >= 0 && tempTax <= 1) {
          parsedTaxRate = tempTax;
        } else {
          return NextResponse.json({ success: false, error: "Tax rate must be a percentage between 0% and 100%." }, { status: 400 });
        }
      }

      const { data: newService, error } = await adminSupabase
         .from("services")
         .insert([{ 
           name: cleanName, 
           price: parsedPrice, 
           category, 
           tax_rate: parsedTaxRate, 
           item_code: safeItemCode, 
           hsn: safeHsn 
         }])
         .select("*")
         .single();

      if (error) {
        console.error("Create service error:", error);
        if (error.code === "23505") {
          if (error.message?.includes("item_code") || error.details?.includes("item_code")) {
            return NextResponse.json({ success: false, error: "An item with this Item Code already exists." }, { status: 409 });
          }
          return NextResponse.json({ success: false, error: "An item with this name already exists." }, { status: 409 });
        }
        return NextResponse.json({ success: false, error: "Failed to create menu item." }, { status: 500 });
      }

      return NextResponse.json({ success: true, service: newService });
    }

    if (action === "edit_service") {
      const { id, name, price, category, itemCode, hsn, taxRate } = body;

      if (!id) {
        return NextResponse.json({ success: false, error: "Item ID is required." }, { status: 400 });
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

      const cleanItemCode = itemCode && typeof itemCode === "string" ? itemCode.trim() : null;
      const cleanHsn = hsn && typeof hsn === "string" ? hsn.trim() : null;

      // Sanitization: Escape HTML tags to prevent XSS
      const cleanName = name.replace(/<[^>]*>/g, "").trim();
      const safeItemCode = cleanItemCode ? cleanItemCode.replace(/<[^>]*>/g, "") : null;
      const safeHsn = cleanHsn ? cleanHsn.replace(/<[^>]*>/g, "") : null;

      let parsedTaxRate = category === "Service" ? 0.05 : 0.18;
      if (taxRate !== undefined) {
        const tempTax = parseFloat(taxRate);
        if (!isNaN(tempTax) && tempTax >= 0 && tempTax <= 1) {
          parsedTaxRate = tempTax;
        } else {
          return NextResponse.json({ success: false, error: "Tax rate must be a percentage between 0% and 100%." }, { status: 400 });
        }
      }

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
          if (error.message?.includes("item_code") || error.details?.includes("item_code")) {
            return NextResponse.json({ success: false, error: "An item with this Item Code already exists." }, { status: 409 });
          }
          return NextResponse.json({ success: false, error: "An item with this name already exists." }, { status: 409 });
        }
        return NextResponse.json({ success: false, error: "Failed to update menu item." }, { status: 500 });
      }

      return NextResponse.json({ success: true, service: updatedService });
    }

    if (action === "delete_service") {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ success: false, error: "Item ID is required." }, { status: 400 });
      }

      const { error } = await adminSupabase
        .from("services")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Delete service error:", error);
        return NextResponse.json({ success: false, error: "Failed to delete menu item." }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // 2. CUSTOMER REGISTRATION WITH EMAIL
    if (action === "create_customer") {
      const { name, phone, email } = body;

      if (typeof name !== "string" || name.trim() === "" || name.length > 100) {
        return NextResponse.json({ success: false, error: "Invalid name format." }, { status: 400 });
      }

      const phoneRegex = /^\+?[0-9\s\-()]{10,15}$/;
      if (typeof phone !== "string" || !phoneRegex.test(phone)) {
        return NextResponse.json({ success: false, error: "Invalid phone number format." }, { status: 400 });
      }

      const cleanPhone = phone.trim().replace(/[\s\-()]/g, "");

      let cleanEmail = null;
      if (email && email.trim() !== "") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return NextResponse.json({ success: false, error: "Invalid email format." }, { status: 400 });
        }
        cleanEmail = email.trim().toLowerCase();
      }

      // Check if duplicate phone profile exists
      const { data: existingCustomer } = await adminSupabase
        .from("customers")
        .select("id")
        .eq("phone", cleanPhone)
        .maybeSingle();

      if (existingCustomer) {
        return NextResponse.json({ success: false, error: "A customer profile already exists for this phone number." }, { status: 409 });
      }

      const { data: newCustomer, error: insertError } = await adminSupabase
        .from("customers")
        .insert([{ name: name.trim(), phone: cleanPhone, email: cleanEmail, points: 0 }])
        .select("id, name, phone, email, points")
        .single();

      if (insertError) {
        console.error("Customer creation error:", insertError);
        return NextResponse.json({ success: false, error: "Failed to create customer profile." }, { status: 500 });
      }

      return NextResponse.json({ success: true, customer: newCustomer });
    }

    // 3. SECURE BILLING CHECKOUT & POINT ADJUSTMENTS
    if (action === "create_invoice") {
      const { customerId, items, pointsToRedeem, branch } = body;

      if (!customerId || !Array.isArray(items) || items.length === 0 || !branch) {
        return NextResponse.json({ success: false, error: "Missing required fields." }, { status: 400 });
      }

      if (!ALLOWED_BRANCHES.includes(branch)) {
        return NextResponse.json({ success: false, error: "Invalid branch location." }, { status: 400 });
      }

      const redeemAmt = parseInt(pointsToRedeem, 10) || 0;
      if (redeemAmt < 0) {
        return NextResponse.json({ success: false, error: "Invalid point redemption amount." }, { status: 400 });
      }

      // Fetch customer profile to check loyalty points
      const { data: customer, error: customerError } = await adminSupabase
        .from("customers")
        .select("id, name, phone, email, points")
        .eq("id", customerId)
        .maybeSingle();

      if (customerError || !customer) {
        return NextResponse.json({ success: false, error: "Customer not found." }, { status: 404 });
      }

      if (redeemAmt > customer.points) {
        return NextResponse.json({ success: false, error: "Insufficient loyalty points balance." }, { status: 400 });
      }

      // Fetch all items from DB to verify prices and tax rates
      const itemIds = items.map((i) => i.id);
      const { data: dbItems, error: dbItemsError } = await adminSupabase
        .from("services")
        .select("*")
        .in("id", itemIds);

      if (dbItemsError || !dbItems || dbItems.length === 0) {
        return NextResponse.json({ success: false, error: "Failed to retrieve menu items from database." }, { status: 500 });
      }

      // Perform calculations
      let serviceSubtotal = 0;
      let retailSubtotal = 0;
      let serviceTax = 0;
      let retailTax = 0;
      interface InvoiceItemInsert {
        item_name: string;
        category: "Service" | "Retail";
        quantity: number;
        unit_price: number;
        tax_rate: number;
        line_total: number;
        item_code: string | null;
        hsn: string | null;
        staff_contribution: string | null;
      }
      const invoiceItemsToInsert: InvoiceItemInsert[] = [];

      for (const reqItem of items) {
        const dbItem = dbItems.find((i) => i.id === reqItem.id);
        if (!dbItem) {
          return NextResponse.json({ success: false, error: `Item with ID ${reqItem.id} not found.` }, { status: 400 });
        }
        const qty = parseInt(reqItem.quantity, 10);
        if (isNaN(qty) || qty <= 0) {
          return NextResponse.json({ success: false, error: "Quantity must be a positive integer." }, { status: 400 });
        }

        const price = dbItem.price;
        const lineTotal = price * qty;

        const calculatedTax = lineTotal * (parseFloat(dbItem.tax_rate) || 0);
        if (dbItem.category === "Service") {
          serviceSubtotal += lineTotal;
          serviceTax += calculatedTax;
        } else {
          retailSubtotal += lineTotal;
          retailTax += calculatedTax;
        }

        const cleanStaff = reqItem.staffContribution && typeof reqItem.staffContribution === "string" 
          ? reqItem.staffContribution.replace(/<[^>]*>/g, "").trim()
          : null;

        invoiceItemsToInsert.push({
          item_name: dbItem.name,
          category: dbItem.category,
          quantity: qty,
          unit_price: price,
          tax_rate: dbItem.tax_rate,
          line_total: lineTotal,
          item_code: dbItem.item_code || null,
          hsn: dbItem.hsn || null,
          staff_contribution: cleanStaff
        });
      }

      const subtotal = serviceSubtotal + retailSubtotal;
      const totalTax = serviceTax + retailTax;
      const preDiscountTotal = subtotal + totalTax;

      // 1 Point = 1 Rupee discount
      const discount = redeemAmt;
      if (discount > preDiscountTotal) {
        return NextResponse.json({ success: false, error: "Discount exceeds invoice grand total." }, { status: 400 });
      }

      const grandTotal = parseFloat((preDiscountTotal - discount).toFixed(2));

      // Calculate loyalty points earned (1 Loyalty Point = 10 Rs spent)
      const pointsEarned = Math.floor(grandTotal / 10);

      // Generate invoice number
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const randStr = Math.floor(1000 + Math.random() * 9000);
      const invoiceNumber = `INV-${dateStr}-${randStr}`;

      // Update customer loyalty points balance atomically
      const finalPoints = customer.points - redeemAmt + pointsEarned;
      const { error: pointsUpdateError } = await adminSupabase
        .from("customers")
        .update({ points: finalPoints })
        .eq("id", customerId)
        .gte("points", redeemAmt); // Race condition safety: ensure points haven't been spent in another request

      if (pointsUpdateError) {
        console.error("Points update error:", pointsUpdateError);
        return NextResponse.json({ success: false, error: "Failed to modify points. Concurrent update or insufficient points." }, { status: 409 });
      }

      // Create Invoice
      const { data: invoice, error: invoiceInsertError } = await adminSupabase
        .from("invoices")
        .insert([{
          invoice_number: invoiceNumber,
          customer_id: customerId,
          subtotal: parseFloat(subtotal.toFixed(2)),
          service_tax: parseFloat(serviceTax.toFixed(2)),
          retail_tax: parseFloat(retailTax.toFixed(2)),
          total_tax: parseFloat(totalTax.toFixed(2)),
          grand_total: grandTotal,
          points_earned: pointsEarned,
          points_redeemed: redeemAmt,
          created_by: staff.email,
          branch: branch
        }])
        .select("*")
        .single();

      if (invoiceInsertError) {
        console.error("Invoice insertion error:", invoiceInsertError);
        // Rollback points on failure
        await adminSupabase.from("customers").update({ points: customer.points }).eq("id", customerId);
        return NextResponse.json({ success: false, error: "Failed to generate invoice." }, { status: 500 });
      }

      // Create Invoice Items
      const itemsToInsert = invoiceItemsToInsert.map((item) => ({
        ...item,
        invoice_id: invoice.id
      }));

      const { error: itemsInsertError } = await adminSupabase
        .from("invoice_items")
        .insert(itemsToInsert);

      if (itemsInsertError) {
        console.error("Invoice items insertion error:", itemsInsertError);
        // Rollback invoice and points on failure
        await adminSupabase.from("invoices").delete().eq("id", invoice.id);
        await adminSupabase.from("customers").update({ points: customer.points }).eq("id", customerId);
        return NextResponse.json({ success: false, error: "Failed to log invoice items." }, { status: 500 });
      }

      // Log invoice action
      await adminSupabase.from("invoice_audit_logs").insert([{
        staff_id: staff.email,
        invoice_id: invoice.id,
        action: "created"
      }]);

      // Log loyalty action
      await adminSupabase.from("loyalty_audit_logs").insert([{
        customer_id: customerId,
        staff_id: staff.email,
        points_earned: pointsEarned,
        points_redeemed: redeemAmt,
        balance_before: customer.points,
        balance_after: finalPoints
      }]);

      // Log to standard transaction logs table for backwards compatibility and easy lookup in customer history
      if (redeemAmt > 0) {
        await adminSupabase.from("transactions").insert([{
          customer_id: customerId,
          points_change: -redeemAmt,
          transaction_type: "redeem",
          branch: branch,
          notes: `Redeemed on Invoice #${invoiceNumber}`,
          balance_after: customer.points - redeemAmt,
          created_by_email: staff.email
        }]);
      }
      if (pointsEarned > 0) {
        await adminSupabase.from("transactions").insert([{
          customer_id: customerId,
          points_change: pointsEarned,
          transaction_type: "add",
          branch: branch,
          notes: `Earned on Invoice #${invoiceNumber}`,
          balance_after: finalPoints,
          created_by_email: staff.email
        }]);
      }

      return NextResponse.json({
        success: true,
        invoice,
        items: itemsToInsert,
        newPoints: finalPoints
      });
    }

    if (action === "send_invoice_email") {
      const { invoiceId, pdfBase64 } = body;

      if (!invoiceId || typeof invoiceId !== "string") {
        return NextResponse.json({ success: false, error: "Invoice ID is required." }, { status: 400 });
      }

      if (!pdfBase64 || typeof pdfBase64 !== "string" || pdfBase64.trim() === "") {
        return NextResponse.json({ success: false, error: "PDF document attachment is required." }, { status: 400 });
      }

      // Fetch Invoice from DB to verify existence
      const { data: invoice, error: invoiceError } = await adminSupabase
        .from("invoices")
        .select("id, invoice_number, customer_id, grand_total, created_at")
        .eq("id", invoiceId)
        .maybeSingle();

      if (invoiceError || !invoice) {
        console.error("DB Fetch Invoice Error:", invoiceError);
        return NextResponse.json({ success: false, error: "Invoice record not found." }, { status: 404 });
      }

      // Fetch Customer from DB
      const { data: customer, error: customerError } = await adminSupabase
        .from("customers")
        .select("id, name, email")
        .eq("id", invoice.customer_id)
        .maybeSingle();

      if (customerError || !customer) {
        console.error("DB Fetch Customer Error:", customerError);
        return NextResponse.json({ success: false, error: "Customer profile not found." }, { status: 404 });
      }

      // Verify that customer email is available
      if (!customer.email || customer.email.trim() === "") {
        return NextResponse.json({ success: false, error: "Customer does not have a registered email address." }, { status: 400 });
      }

      // Server-side email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customer.email)) {
        return NextResponse.json({ success: false, error: "Invalid customer email address configuration." }, { status: 400 });
      }

      // Strip potential base64 prefix
      let rawBase64 = pdfBase64;
      if (rawBase64.startsWith("data:application/pdf;base64,")) {
        rawBase64 = rawBase64.replace("data:application/pdf;base64,", "");
      }

      // Initialize Resend
      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        console.error("Resend API Key is missing in environment configuration");
        return NextResponse.json({ success: false, error: "Mail service not configured on the server." }, { status: 500 });
      }

      const resend = new Resend(resendApiKey);
      const senderEmail = process.env.SENDER_EMAIL || "Macbello Salon <onboarding@resend.dev>";

      const siteUrl = request.nextUrl.origin;

      // Subject and Body Construction
      const subject = `Macbello Salon Invoice #${invoice.invoice_number}`;
      const bodyText = `
Hello ${customer.name},

Thank you for visiting Macbello Salon.

Please find your invoice attached.

Invoice Number: ${invoice.invoice_number}
Invoice Date: ${new Date(invoice.created_at).toLocaleDateString()}
Total Amount: INR ${parseFloat(invoice.grand_total).toFixed(2)}

We value your experience! We would love to hear your thoughts. Please share your feedback with us here:
${siteUrl}/#feedback

Thank you for choosing Macbello Salon.

Regards,
Macbello Salon
      `.trim();

      try {
        const { data: emailResult, error: emailSendError } = await resend.emails.send({
          from: senderEmail,
          to: [customer.email],
          subject: subject,
          text: bodyText,
          attachments: [
            {
              filename: `INV-${invoice.invoice_number}.pdf`,
              content: rawBase64,
            }
          ]
        });

        if (emailSendError || !emailResult) {
          console.error("Resend send call failed:", emailSendError);
          const errMsg = emailSendError?.message || "Email dispatch failed.";

          // Log failure to DB Audit Logs
          await adminSupabase.from("invoice_email_logs").insert([{
            invoice_id: invoice.id,
            customer_id: customer.id,
            recipient_email: customer.email,
            staff_id: staff.email,
            status: "failed",
            error_message: errMsg
          }]);

          return NextResponse.json({ success: false, error: "Failed to dispatch email. " + errMsg }, { status: 502 });
        }

        // Log success to DB Audit Logs
        await adminSupabase.from("invoice_email_logs").insert([{
          invoice_id: invoice.id,
          customer_id: customer.id,
          recipient_email: customer.email,
          staff_id: staff.email,
          status: "success",
          error_message: null
        }]);

        return NextResponse.json({ success: true });
      } catch (err) {
        console.error("Resend API Error:", err);
        const errMsg = err instanceof Error ? err.message : "Unhandled email routing error.";

        // Log failure to DB Audit Logs
        await adminSupabase.from("invoice_email_logs").insert([{
          invoice_id: invoice.id,
          customer_id: customer.id,
          recipient_email: customer.email,
          staff_id: staff.email,
          status: "failed",
          error_message: errMsg
        }]);

        return NextResponse.json({ success: false, error: "Internal mail transmission error." }, { status: 500 });
      }
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });

  } catch (err) {
    console.error("Billing POST API Error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
