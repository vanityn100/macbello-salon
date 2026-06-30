const fs = require('fs');

let file = fs.readFileSync('src/lib/pdf.ts', 'utf8');

file = file.replace(
  "import { formatGst } from './gst';",
  "import { formatGst, getTaxInfo } from './gst';"
);

file = file.replace(
  `  // Add items
  let y = 145;
  invoice.items.forEach((item: any, index: number) => {
    // Determine category correctly based on item data or fallback to 'Service' if unknown
    const rawCategory = item.category?.toLowerCase() || "";
    const isRetail = rawCategory.includes("retail") || rawCategory.includes("product");
    const category = isRetail ? "Retail" : "Service";
    const gstRateLabel = formatGst(item.tax_rate, category);`,
  `  // Add items
  let y = 145;
  invoice.items.forEach((item: any, index: number) => {
    const taxInfo = getTaxInfo(item);
    const category = taxInfo.isService ? "Service" : "Retail";
    const gstRateLabel = taxInfo.gstLabel;`
);

file = file.replace(
  `    doc.text(item.hsn || "-", 95, textY);`,
  `    doc.text(taxInfo.hsn, 95, textY);`
);

fs.writeFileSync('src/lib/pdf.ts', file);
console.log('Fixed pdf.ts');
