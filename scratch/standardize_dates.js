const fs = require('fs');

// 1. Update src/lib/format.ts
let formatContent = fs.readFileSync('src/lib/format.ts', 'utf8');
formatContent = formatContent.replace(
  /export function formatDate\([\s\S]*?}\n}/,
  `export function formatDate(date: string | Date): string {
  if (!date) return '-';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return \`\${year}-\${month}-\${day}\`;
  } catch {
    return String(date);
  }
}`
);
fs.writeFileSync('src/lib/format.ts', formatContent);


// 2. Clean up Tax Reports
let taxContent = fs.readFileSync('src/app/admin/reports/page.tsx', 'utf8');
taxContent = taxContent.replace(
  /"Date": inv\.invoiceDate \? \(inv\.invoiceDate\.includes\("T"\) \? inv\.invoiceDate\.split\("T"\)\[0\] : inv\.invoiceDate\) : "-",/g,
  '"Date": formatDate(inv.invoiceDate),'
);
fs.writeFileSync('src/app/admin/reports/page.tsx', taxContent);


// 3. Clean up GSTR1 Reports
let gstrContent = fs.readFileSync('src/app/admin/reports/gstr1/page.tsx', 'utf8');
gstrContent = gstrContent.replace(
  /inv\.date \? inv\.date\.split\("T"\)\[0\] : "-"/g,
  'formatDate(inv.date)'
);
gstrContent = gstrContent.replace(
  /inv\.date \? inv\.date\.split\("T"\)\[0\] : ""/g,
  'formatDate(inv.date)'
);
gstrContent = gstrContent.replace(
  /inv\.invoiceDate \? inv\.invoiceDate\.split\("T"\)\[0\] : ""/g,
  'formatDate(inv.invoiceDate)'
);
gstrContent = gstrContent.replace(
  /\(inv\.date \|\| inv\.invoiceDate \|\| ""\)\.split\("T"\)\[0\]/g,
  'formatDate(inv.date || inv.invoiceDate || "")'
);
fs.writeFileSync('src/app/admin/reports/gstr1/page.tsx', gstrContent);


// 4. Clean up Admin Page
let adminContent = fs.readFileSync('src/app/admin/page.tsx', 'utf8');
adminContent = adminContent.replace(
  /const dateStr = inv\.created_at \? new Date\(inv\.created_at\)\.toISOString\(\)\.slice\(0, 10\) : "-";/g,
  'const dateStr = formatDate(inv.created_at);'
);
fs.writeFileSync('src/app/admin/page.tsx', adminContent);


// 5. Clean up Admin Inventory Page
let adminInvContent = fs.readFileSync('src/app/admin/inventory/page.tsx', 'utf8');
adminInvContent = adminInvContent.replace(
  /"Date": txn\.created_at \? new Date\(txn\.created_at\)\.toISOString\(\)\.slice\(0, 10\) : "-",/g,
  '"Date": formatDate(txn.created_at),'
);
fs.writeFileSync('src/app/admin/inventory/page.tsx', adminInvContent);


// 6. Clean up Admin Products Page
let adminProdContent = fs.readFileSync('src/app/admin/products/page.tsx', 'utf8');
adminProdContent = adminProdContent.replace(
  /"Created Date": p\.created_at \? new Date\(p\.created_at\)\.toISOString\(\)\.slice\(0, 10\) : "-",/g,
  '"Created Date": formatDate(p.created_at),'
);
fs.writeFileSync('src/app/admin/products/page.tsx', adminProdContent);


// 7. Clean up Staff Products Page
let staffProdContent = fs.readFileSync('src/app/staff/products/page.tsx', 'utf8');
staffProdContent = staffProdContent.replace(
  /"Created Date": p\.created_at \? new Date\(p\.created_at\)\.toISOString\(\)\.slice\(0, 10\) : "-",/g,
  '"Created Date": formatDate(p.created_at),'
);
fs.writeFileSync('src/app/staff/products/page.tsx', staffProdContent);

console.log("All date formats standardized via formatDate!");
