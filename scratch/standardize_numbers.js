const fs = require('fs');

function standardizeNumbers() {
  const replaceExportNumber = (content) => {
    // Basic fields
    const fieldsToWrap = [
      'taxableValue', 'gstRate', 'quantity', 'cgst', 'sgst', 'igst', 'totalValue',
      'discount', 'unitPrice', 'gstAmount', 'revenue', 'gstCollected',
      'totalSales', 'totalTaxable', 'totalGstCollected', 'totalCgst', 'totalSgst', 'totalIgst',
      'grand_total', 'total_tax', 'subtotal', 'points_redeemed', 'points_earned', 'line_total'
    ];
    
    // We want to safely wrap `obj.field` with `exportNumber(obj.field)`
    // And `obj.field1 + obj.field2` with `exportNumber(obj.field1 + obj.field2)`
    
    // Instead of complex regex, let's inject exportNumber at the top of the file
    if (!content.includes('exportNumber')) {
      content = content.replace('formatDate }', 'formatDate, exportNumber }');
      content = content.replace('formatDate, formatINR }', 'formatDate, formatINR, exportNumber }');
    }

    // Reports page specific replacements for JSON objects:
    content = content.replace(/"Taxable Value": ([a-zA-Z0-9_.]+(?: + [a-zA-Z0-9_.]+)*),/g, '"Taxable Value": exportNumber($1),');
    content = content.replace(/"GST Rate": ([a-zA-Z0-9_.]+(?: + [a-zA-Z0-9_.]+)*),/g, '"GST Rate": exportNumber($1),');
    content = content.replace(/"Quantity Sold": ([a-zA-Z0-9_.]+(?: + [a-zA-Z0-9_.]+)*),/g, '"Quantity Sold": exportNumber($1),');
    content = content.replace(/"Quantity": ([a-zA-Z0-9_.]+(?: + [a-zA-Z0-9_.]+)*),/g, '"Quantity": exportNumber($1),');
    content = content.replace(/"Unit Price": ([a-zA-Z0-9_.]+(?: + [a-zA-Z0-9_.]+)*),/g, '"Unit Price": exportNumber($1),');
    content = content.replace(/"Discount": ([a-zA-Z0-9_.]+(?: + [a-zA-Z0-9_.]+)*),/g, '"Discount": exportNumber($1),');
    content = content.replace(/"CGST": ([a-zA-Z0-9_.]+(?: + [a-zA-Z0-9_.]+)*),/g, '"CGST": exportNumber($1),');
    content = content.replace(/"SGST": ([a-zA-Z0-9_.]+(?: + [a-zA-Z0-9_.]+)*),/g, '"SGST": exportNumber($1),');
    content = content.replace(/"IGST": ([a-zA-Z0-9_.]+(?: + [a-zA-Z0-9_.]+)*),/g, '"IGST": exportNumber($1),');
    content = content.replace(/"Total GST": ([a-zA-Z0-9_.]+(?: + [a-zA-Z0-9_.]+)*),/g, '"Total GST": exportNumber($1),');
    content = content.replace(/"Total Value": ([a-zA-Z0-9_.]+(?: + [a-zA-Z0-9_.]+)*)/g, '"Total Value": exportNumber($1)');
    content = content.replace(/"Total Amount": ([a-zA-Z0-9_.]+(?: + [a-zA-Z0-9_.]+)*),/g, '"Total Amount": exportNumber($1),');
    content = content.replace(/"GST Collected": ([a-zA-Z0-9_.]+(?: + [a-zA-Z0-9_.]+)*)/g, '"GST Collected": exportNumber($1)');
    content = content.replace(/"Revenue (GST Incl.)": ([a-zA-Z0-9_.]+(?: + [a-zA-Z0-9_.]+)*),/g, '"Revenue (GST Incl.)": exportNumber($1),');
    content = content.replace(/"Taxable (Pre-GST)": ([a-zA-Z0-9_.]+(?: + [a-zA-Z0-9_.]+)*),/g, '"Taxable (Pre-GST)": exportNumber($1),');
    content = content.replace(/"Total Revenue": ([a-zA-Z0-9_.]+(?: + [a-zA-Z0-9_.]+)*)/g, '"Total Revenue": exportNumber($1)');

    // Summary replacements
    content = content.replace(/Value: (dataToExport.summary.[a-zA-Z0-9_]+) }/g, 'Value: exportNumber($1) }');
    content = content.replace(/Value: exportNumber(dataToExport.summary.totalInvoices)/g, 'Value: dataToExport.summary.totalInvoices');

    // Admin Dashboard page specific replacements:
    content = content.replace(/"Line Total": (item.line_total),/g, '"Line Total": exportNumber($1),');
    content = content.replace(/"Loyalty Redemption": (parseFloat([sS]*?)),/g, '"Loyalty Redemption": exportNumber($1),');
    content = content.replace(/"Total Revenue": (totalRev),/g, '"Total Revenue": exportNumber($1),');
    content = content.replace(/"Total Tax": (totalTax),/g, '"Total Tax": exportNumber($1),');

    return content;
  }

  const files = [
    'src/app/admin/reports/page.tsx',
    'src/app/admin/page.tsx',
    'src/app/admin/inventory/page.tsx',
    'src/app/admin/products/page.tsx',
    'src/app/staff/products/page.tsx'
  ];

  for (let file of files) {
    if (fs.existsSync(file)) {
      let content = fs.readFileSync(file, 'utf8');
      content = replaceExportNumber(content);
      fs.writeFileSync(file, content);
      console.log(`Updated ${file}`);
    }
  }

  // GSTR1 has arrays of arrays
  const gstr1File = 'src/app/admin/reports/gstr1/page.tsx';
  if (fs.existsSync(gstr1File)) {
    let content = fs.readFileSync(gstr1File, 'utf8');
    if (!content.includes('exportNumber')) {
      content = content.replace('formatDate }', 'formatDate, exportNumber }');
    }
    // E.g. [inv.invoiceNumber, inv.date, exportNumber(inv.taxableValue), exportNumber(inv.cgst)]
    content = content.replace(/inv.taxableValue/g, 'exportNumber(inv.taxableValue)');
    content = content.replace(/inv.cgst/g, 'exportNumber(inv.cgst)');
    content = content.replace(/inv.sgst/g, 'exportNumber(inv.sgst)');
    content = content.replace(/inv.igst/g, 'exportNumber(inv.igst)');
    content = content.replace(/inv.gstAmount/g, 'exportNumber(inv.gstAmount)');
    content = content.replace(/inv.totalValue/g, 'exportNumber(inv.totalValue)');
    content = content.replace(/h.taxableValue/g, 'exportNumber(h.taxableValue)');
    content = content.replace(/h.cgst/g, 'exportNumber(h.cgst)');
    content = content.replace(/h.sgst/g, 'exportNumber(h.sgst)');
    content = content.replace(/h.igst/g, 'exportNumber(h.igst)');
    content = content.replace(/h.totalValue/g, 'exportNumber(h.totalValue)');
    
    // De-duplicate if it accidentally wrapped twice: exportNumber(exportNumber(x))
    content = content.replace(/exportNumber(exportNumber((.*?)))/g, 'exportNumber($1)');
    content = content.replace(/pdfINR(exportNumber((.*?)))/g, 'pdfINR($1)'); // We don't need exportNumber if we use pdfINR which formats anyway

    fs.writeFileSync(gstr1File, content);
    console.log(`Updated ${gstr1File}`);
  }
}

standardizeNumbers();
