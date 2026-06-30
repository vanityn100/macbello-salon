const fs = require('fs');

let file = fs.readFileSync('src/app/api/reports/tax/route.ts', 'utf8');

file = file.replace(
  "import { getDecimalGst, formatGst } from '@/lib/gst';",
  "import { getTaxInfo } from '@/lib/gst';"
);

file = file.replace(
  `        items.forEach((item: any) => {
          const qty = item.quantity || 1;
          const rate = getDecimalGst(item.tax_rate, item.category);
          const lineTotal = parseFloat(item.line_total) || 0;`,
  `        items.forEach((item: any) => {
          const qty = item.quantity || 1;
          const taxInfo = getTaxInfo(item);
          const rate = taxInfo.gstDecimal;
          const lineTotal = parseFloat(item.line_total) || 0;`
);

file = file.replace(
  `          const ratePercentage = formatGst(item.tax_rate, item.category);`,
  `          const ratePercentage = taxInfo.gstLabel;`
);

file = file.replace(
  `          // HSN Aggregation
          const hsnCode = item.hsn || "Unassigned";
          if (!hsnMap[hsnCode]) {`,
  `          // HSN Aggregation
          const hsnCode = taxInfo.hsn;
          const hsnKey = \`\${hsnCode}__\${ratePercentage}\`;
          if (!hsnMap[hsnKey]) {`
);

file = file.replace(
  `          hsnMap[hsnCode].quantity += qty;
          hsnMap[hsnCode].taxableValue += itemTaxable;
          hsnMap[hsnCode].cgst += itemCgst;
          hsnMap[hsnCode].sgst += itemSgst;
          hsnMap[hsnCode].totalValue += lineTotal;`,
  `          hsnMap[hsnKey].quantity += qty;
          hsnMap[hsnKey].taxableValue += itemTaxable;
          hsnMap[hsnKey].cgst += itemCgst;
          hsnMap[hsnKey].sgst += itemSgst;
          hsnMap[hsnKey].totalValue += lineTotal;`
);

file = file.replace(
  `            hsnCode: hsnCode,`,
  `            hsnCode: taxInfo.hsn,`
);

fs.writeFileSync('src/app/api/reports/tax/route.ts', file);
console.log('Fixed tax/route.ts');
