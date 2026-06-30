const fs = require('fs');

// 1. Fix getTaxInfo in gst.ts
let gstFile = fs.readFileSync('src/lib/gst.ts', 'utf8');
gstFile = gstFile.replace(
  `  const isService = item.category?.toLowerCase().includes("service") || item.category === "Service";`,
  `  const rawCategory = item.category || "Service";\n  const isService = rawCategory.toLowerCase().includes("service") || rawCategory === "Service";`
);
fs.writeFileSync('src/lib/gst.ts', gstFile);

// 2. Fix exportNumber around gstRate in reports/page.tsx
let reportFile = fs.readFileSync('src/app/admin/reports/page.tsx', 'utf8');
reportFile = reportFile.replace(/exportNumber\(h\.gstRate\)/g, "h.gstRate");
reportFile = reportFile.replace(/exportNumber\(g\.gstRate\)/g, "g.gstRate");
reportFile = reportFile.replace(/exportNumber\(i\.gstRate\)/g, "i.gstRate");
reportFile = reportFile.replace(/exportNumber\(inv\.gstRate\)/g, "inv.gstRate");
fs.writeFileSync('src/app/admin/reports/page.tsx', reportFile);

// 3. Fix exportNumber around gstRate in reports/gstr1/page.tsx
let gstr1File = fs.readFileSync('src/app/admin/reports/gstr1/page.tsx', 'utf8');
gstr1File = gstr1File.replace(/exportNumber\(h\.gstRate\)/g, "h.gstRate");
fs.writeFileSync('src/app/admin/reports/gstr1/page.tsx', gstr1File);

console.log('Fixed exportNumber and gst.ts');
