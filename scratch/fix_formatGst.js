const fs = require('fs');

let file = fs.readFileSync('src/app/staff/billing/page.tsx', 'utf8');

file = file.replace(/formatGst\(item\.tax_rate,\s*item\.category\)/g, "getTaxInfo(item).gstLabel");

fs.writeFileSync('src/app/staff/billing/page.tsx', file);
console.log('Fixed formatGst in billing');
