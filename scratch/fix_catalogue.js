const fs = require('fs');

let file = fs.readFileSync('src/components/catalogue/CatalogueManager.tsx', 'utf8');

file = file.replace(
  "import { formatGst, getDecimalGst } from '@/lib/gst';",
  "import { getTaxInfo } from '@/lib/gst';"
);

file = file.replace(/getDecimalGst\(item\.tax_rate,\s*item\.category\)/g, "getTaxInfo(item).gstDecimal");
file = file.replace(/item\.hsn \|\| "-"/g, 'getTaxInfo(item).hsn');

fs.writeFileSync('src/components/catalogue/CatalogueManager.tsx', file);
console.log('Fixed CatalogueManager');
