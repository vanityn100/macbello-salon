const fs = require('fs');

const files = [
  'src/app/staff/billing/page.tsx',
  'src/components/admin/EditInvoiceModal.tsx',
  'src/components/admin/TransactionReportTable.tsx',
  'src/components/catalogue/CatalogueManager.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('"use client";') && content.indexOf('"use client";') > 0) {
    // Remove the misplaced "use client";
    content = content.replace(/"use client";\n?/g, '');
    // Add it to the very top
    content = '"use client";\n' + content;
    fs.writeFileSync(file, content);
    console.log('Fixed ' + file);
  }
}
