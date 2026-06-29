const fs = require('fs');

function replaceAll(file, search, replacement) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.split(search).join(replacement);
  fs.writeFileSync(file, content);
}

// 1. Tax Report
replaceAll(
  'src/app/admin/reports/page.tsx', 
  '"Date": inv.invoiceDate,', 
  '"Date": inv.invoiceDate ? (inv.invoiceDate.includes("T") ? inv.invoiceDate.split("T")[0] : inv.invoiceDate) : "-",'
);

// 2. GSTR1 Report
let gstrContent = fs.readFileSync('src/app/admin/reports/gstr1/page.tsx', 'utf8');

// For PDF:
gstrContent = gstrContent.split('[inv.date,').join('[inv.date ? inv.date.split("T")[0] : "-",');

// For Excel B2B:
gstrContent = gstrContent.split('"Invoice Date": inv.date,').join('"Invoice Date": inv.date ? inv.date.split("T")[0] : "-",');

// For Excel B2C:
// B2C aggregates by date, so we need to ensure the aggregation key slices the date.
gstrContent = gstrContent.replace(
  'const dateKey = inv.date;', 
  'const dateKey = inv.date ? inv.date.split("T")[0] : "";'
);
gstrContent = gstrContent.replace(
  'const dateKey = inv.invoiceDate;',
  'const dateKey = inv.invoiceDate ? inv.invoiceDate.split("T")[0] : "";'
);
gstrContent = gstrContent.replace(
  'const date = inv.date || inv.invoiceDate || "";',
  'const date = (inv.date || inv.invoiceDate || "").split("T")[0];'
);

fs.writeFileSync('src/app/admin/reports/gstr1/page.tsx', gstrContent);
console.log("Updated dates!");
