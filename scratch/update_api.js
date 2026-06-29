const fs = require('fs');

let content = fs.readFileSync('src/app/api/billing/admin/route.ts', 'utf8');

const oldResponseStr = `      const newInvoiceId = rpcData.invoice_id;
      const itemsToInsert = invoiceItemsToInsert.map((item) => ({ ...item, invoice_id: newInvoiceId }));
      
      const successResponse = { success: true, invoice: { id: newInvoiceId, ...p_invoice }, items: itemsToInsert, newPoints: finalPoints };

      // Log audit log asynchronously, store successResponse for idempotency checks
      try {
        await adminSupabase.from("audit_logs").insert([{
          user_id: user.email,
          role: user.role,
          branch: targetBranch,
          action: "checkout_invoice",
          details: JSON.stringify({ message: \`Generated Invoice #\${invoiceNumber}\`, successResponse }),
          request_id: idempotencyKey || null
        }]);`;

const newResponseStr = `      const newInvoiceId = rpcData.invoice_id;
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
          details: JSON.stringify({ message: \`Generated Invoice #\${finalInvoiceNumber}\`, successResponse }),
          request_id: idempotencyKey || null
        }]);`;

if (content.includes(oldResponseStr)) {
  content = content.replace(oldResponseStr, newResponseStr);
  console.log("Replaced response str!");
} else {
  console.log("Could not find oldResponseStr, trying regex fallback...");
  content = content.replace(/const newInvoiceId = rpcData\.invoice_id;[\s\S]*?request_id: idempotencyKey \|\| null\s*}\]\);/, newResponseStr);
}

fs.writeFileSync('src/app/api/billing/admin/route.ts', content);
