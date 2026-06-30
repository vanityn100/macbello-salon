const fs = require('fs');

let file = fs.readFileSync('src/app/staff/billing/page.tsx', 'utf8');

file = file.replace(
  "import { formatGst, getDecimalGst } from '@/lib/gst';",
  "import { getTaxInfo } from '@/lib/gst';"
);

// We need to replace `getDecimalGst(item.tax_rate, item.category)` with `getTaxInfo(item).gstDecimal`
// and `item.hsn` with `getTaxInfo(item).hsn`

file = file.replace(/getDecimalGst\(item\.tax_rate,\s*item\.category\)/g, "getTaxInfo(item).gstDecimal");
file = file.replace(/item\.hsn \|\| "-"/g, 'getTaxInfo(item).hsn');
file = file.replace(/\{item\.hsn \? \`  HSN: \$\{item\.hsn\}\` : ""\}/g, '{`  HSN: ${getTaxInfo(item).hsn}`}');

fs.writeFileSync('src/app/staff/billing/page.tsx', file);
console.log('Fixed billing page');
