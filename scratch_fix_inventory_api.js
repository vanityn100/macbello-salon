const fs = require('fs');

let c = fs.readFileSync('src/app/api/inventory/route.ts', 'utf8');

c = c.replace(/const rateLabel = \(rawRate > 1 \? rawRate : rawRate \* 100\)\.toFixed\(0\) \+ "%";/, `const rateLabel = formatGst(p.gst_rate, p.category);`);

if (!c.includes('import { formatGst }')) {
  c = c.replace(/import { getDecimalGst } from '@\/lib\/gst';/, "import { getDecimalGst, formatGst } from '@/lib/gst';");
}

fs.writeFileSync('src/app/api/inventory/route.ts', c);
console.log('Fixed inventory API');
