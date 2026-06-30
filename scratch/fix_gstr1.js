const fs = require('fs');

let file = fs.readFileSync('src/app/api/reports/gstr1/route.ts', 'utf8');

file = file.replace(
  "import { getDecimalGst } from '@/lib/gst';",
  "import { getTaxInfo } from '@/lib/gst';"
);

file = file.replace(
  `          items.forEach((item: any, i: number) => {
            const rate = getDecimalGst(item.tax_rate, item.category);
            const qty = item.quantity || 1;`,
  `          items.forEach((item: any, i: number) => {
            const taxInfo = getTaxInfo(item);
            const rate = taxInfo.gstDecimal;
            const qty = item.quantity || 1;`
);

file = file.replace(
  `            const rawRate = rate > 1 ? rate : rate * 100;
            const rateLabel = rawRate.toFixed(0) + "%";

            // HSN aggregation
            const hsnCode = item.hsn || "Unassigned";
            const hsnKey = \`\${hsnCode}__\${rateLabel}\`;
            if (!hsnMap[hsnKey]) {`,
  `            const rawRate = taxInfo.gstRate;
            const rateLabel = taxInfo.gstLabel;

            // HSN aggregation
            const hsnCode = taxInfo.hsn;
            const hsnKey = \`\${hsnCode}__\${rateLabel}\`;
            if (!hsnMap[hsnKey]) {`
);

fs.writeFileSync('src/app/api/reports/gstr1/route.ts', file);
console.log('Fixed gstr1/route.ts');
