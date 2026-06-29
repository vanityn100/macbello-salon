const fs = require('fs');

let c = fs.readFileSync('src/app/api/reports/tax/route.ts', 'utf8');

c = c.replace(/const rawRate = rate > 1 \? rate : rate \* 100;\s*const ratePercentage = rawRate\.toFixed\(0\) \+ "%";/, `const ratePercentage = formatGst(item.tax_rate, item.category);`);

if (!c.includes('import { formatGst }')) {
  c = c.replace(/import { getDecimalGst } from '@\/lib\/gst';/, "import { getDecimalGst, formatGst } from '@/lib/gst';");
}

c = c.replace(/discount: parseFloat\(inv\.discount\) \|\| 0,\s*cgst: cgstAmount,/, `discount: parseFloat(inv.discount) || 0,\n            loyaltyPoints: parseFloat(inv.points_redeemed) || 0,\n            cgst: cgstAmount,`);

c = c.replace(/discount: parseFloat\(inv\.discount\) \|\| 0,\s*cgst: itemCgst,/, `discount: parseFloat(inv.discount) || 0,\n            loyaltyPoints: parseFloat(inv.points_redeemed) || 0,\n            cgst: itemCgst,`);

fs.writeFileSync('src/app/api/reports/tax/route.ts', c);
console.log('Fixed tax API');
