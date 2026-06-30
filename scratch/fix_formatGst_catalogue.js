const fs = require('fs');

let file2 = fs.readFileSync('src/components/catalogue/CatalogueManager.tsx', 'utf8');
file2 = file2.replace(/formatGst\(item\.tax_rate,\s*item\.category\)/g, "getTaxInfo(item).gstLabel");
fs.writeFileSync('src/components/catalogue/CatalogueManager.tsx', file2);

console.log('Fixed formatGst in CatalogueManager');
