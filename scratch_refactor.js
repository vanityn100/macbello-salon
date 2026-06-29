const fs = require('fs');
let c = fs.readFileSync('src/app/api/billing/admin/route.ts', 'utf8');

if (!c.includes('normalizeGst')) {
  c = "import { normalizeGst } from '@/lib/gst';\n" + c;
}

const regex = /let parsedTaxRate = category === "Service" \? 0\.05 : 0\.18;\s*if \(taxRate !== undefined\) \{\s*const tempTax = parseFloat\(taxRate\);\s*if \(!isNaN\(tempTax\) && tempTax >= 0 && tempTax <= 1\) \{\s*parsedTaxRate = tempTax;\s*\}\s*\}/g;

c = c.replace(regex, 'let parsedTaxRate = normalizeGst(taxRate, category);');

fs.writeFileSync('src/app/api/billing/admin/route.ts', c);
console.log('done');
