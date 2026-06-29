const fs = require('fs');

let c1 = fs.readFileSync('src/app/api/reports/gstr1/route.ts', 'utf8');
if (!c1.includes('import { logError }')) {
  c1 = c1.replace('import { NextResponse } from "next/server";', 'import { NextResponse } from "next/server";\nimport { logError } from "@/lib/logger";');
  fs.writeFileSync('src/app/api/reports/gstr1/route.ts', c1);
}

let c2 = fs.readFileSync('src/app/api/inventory/route.ts', 'utf8');
if (!c2.includes('import { getDecimalGst, formatGst }')) {
  c2 = c2.replace(/import { getDecimalGst } from '@\/lib\/gst';/, "import { getDecimalGst, formatGst } from '@/lib/gst';");
  fs.writeFileSync('src/app/api/inventory/route.ts', c2);
}
console.log('Fixed imports');
