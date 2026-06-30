const fs = require('fs');

let file = fs.readFileSync('src/lib/pdf.ts', 'utf8');

file = file.replace(
  `  items.forEach((item) => {
    const hasStaff = !!item.staff_contribution;`,
  `  items.forEach((item) => {
    const taxInfo = getTaxInfo(item);
    const hasStaff = !!item.staff_contribution;`
);

file = file.replace(
  `    doc.text(\`\${formatGst(item.tax_rate, item.category)}\`, 125, textY);`,
  `    doc.text(taxInfo.gstLabel, 125, textY);`
);

fs.writeFileSync('src/lib/pdf.ts', file);
console.log('Fixed pdf.ts taxInfo scope');
