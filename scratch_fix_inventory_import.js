const fs = require('fs');
let c2 = fs.readFileSync('src/app/api/inventory/route.ts', 'utf8');
if (!c2.includes('import { formatGst }')) {
  c2 = c2.replace('import { NextResponse } from "next/server";', 'import { NextResponse } from "next/server";\nimport { formatGst } from "@/lib/gst";');
  fs.writeFileSync('src/app/api/inventory/route.ts', c2);
}
console.log('Fixed inventory import');
