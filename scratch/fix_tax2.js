const fs = require('fs');

let file = fs.readFileSync('src/app/api/reports/tax/route.ts', 'utf8');

file = file.replace(
  "const rate = getDecimalGst(item.tax_rate, item.category);",
  "const taxInfo = getTaxInfo(item);\n          const rate = taxInfo.gstDecimal;"
);

file = file.replace(
  "const ratePercentage = formatGst(item.tax_rate, item.category);",
  "const ratePercentage = taxInfo.gstLabel;"
);

file = file.replace(
  "const hsnCode = item.hsn || \"Unassigned\";",
  "const hsnCode = taxInfo.hsn;"
);

fs.writeFileSync('src/app/api/reports/tax/route.ts', file);
console.log('Fixed tax/route.ts (again)');
