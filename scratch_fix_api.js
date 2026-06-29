const fs = require('fs');

['src/app/api/reports/tax/route.ts', 'src/app/api/reports/gstr1/route.ts'].forEach(file => {
  let c = fs.readFileSync(file, 'utf8');
  if (!c.includes('import { getDecimalGst }')) {
    c = "import { getDecimalGst } from '@/lib/gst';\n" + c;
  }
  // Ensure logError is back if it was removed
  if (file.includes('gstr1') && !c.includes('logError')) {
    c = c.replace('import { NextResponse } from "next/server";', 'import { NextResponse } from "next/server";\nimport { logError } from "@/lib/logger";');
  }
  c = c.replace(/const rate = parseFloat\(item\.tax_rate\) \|\| 0;/g, 'const rate = getDecimalGst(item.tax_rate, item.category);');
  fs.writeFileSync(file, c);
});
console.log('Fixed API GST logic');
