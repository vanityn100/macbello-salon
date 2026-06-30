const fs = require('fs');

let file = fs.readFileSync('src/lib/invoiceUtils.ts', 'utf8');

file = file.replace(
  "import { getDecimalGst } from './gst';",
  "import { getTaxInfo } from './gst';"
);

file = file.replace(/getDecimalGst\(item\.tax_rate,\s*item\.category\)/g, "getTaxInfo(item).gstDecimal");

fs.writeFileSync('src/lib/invoiceUtils.ts', file);
console.log('Fixed invoiceUtils.ts');
