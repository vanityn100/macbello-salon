const fs = require('fs');

function refactorFile(filePath) {
  let c = fs.readFileSync(filePath, 'utf8');
  if (!c.includes('formatGst')) {
    c = "import { formatGst } from '@/lib/gst';\n" + c;
  }
  
  // Replace `{item.tax_rate * 100}%` with `{formatGst(item.tax_rate, item.category)}`
  c = c.replace(/\{item\.tax_rate \* 100\}%/g, '{formatGst(item.tax_rate, item.category)}');
  c = c.replace(/\{\(item\.tax_rate \* 100\)\.toFixed\(0\)\}%/g, '{formatGst(item.tax_rate, item.category)}');
  
  // Replace `{(item.tax_rate * 50).toFixed(1)}% CGST + {(item.tax_rate * 50).toFixed(1)}% SGST` 
  // with something deterministic based on normalized gst
  // Wait, I can just use a helper method inside gst.ts or parse it here, but actually I can do:
  c = c.replace(/\{\(item\.tax_rate \* 50\)\.toFixed\(\d\)\}% CGST \+ \{\(item\.tax_rate \* 50\)\.toFixed\(\d\)\}% SGST/g, 
    "{parseFloat(formatGst(item.tax_rate, item.category)) / 2}% CGST + {parseFloat(formatGst(item.tax_rate, item.category)) / 2}% SGST");

  // `price * (1 + item.tax_rate)` needs to be `price * (1 + getDecimalGst(item.tax_rate, item.category))`
  // But wait, the UI shouldn't calculate this inline anyway, or if it does, it needs `getDecimalGst`.
  if (!c.includes('getDecimalGst') && c.includes('1 + item.tax_rate')) {
    c = c.replace("import { formatGst } from '@/lib/gst';", "import { formatGst, getDecimalGst } from '@/lib/gst';");
  }
  c = c.replace(/1 \+ item\.tax_rate/g, '1 + getDecimalGst(item.tax_rate, item.category)');

  fs.writeFileSync(filePath, c);
}

const files = [
  'src/app/staff/billing/page.tsx',
  'src/components/admin/EditInvoiceModal.tsx',
  'src/components/admin/TransactionReportTable.tsx',
  'src/components/catalogue/CatalogueManager.tsx',
  'src/lib/pdf.ts'
];

for (const f of files) {
  try {
    refactorFile(f);
    console.log('Refactored ' + f);
  } catch(e) {
    console.error('Error on ' + f, e.message);
  }
}
