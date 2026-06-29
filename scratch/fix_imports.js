const fs = require('fs');
const files = [
  'src/app/admin/reports/page.tsx',
  'src/app/admin/page.tsx',
  'src/app/admin/inventory/page.tsx',
  'src/app/admin/products/page.tsx',
  'src/app/staff/products/page.tsx',
  'src/app/admin/reports/gstr1/page.tsx'
];

for (let file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('exportNumber') && !content.includes('exportNumber,') && !content.includes(', exportNumber')) {
      // Find the import line for @/lib/format
      content = content.replace(/import {(.*?)} from ["']@/lib/format["'];/, (match, p1) => {
        if (p1.includes('exportNumber')) return match;
        return `import {${p1}, exportNumber} from "@/lib/format";`;
      });
      fs.writeFileSync(file, content);
      console.log(`Fixed imports in ${file}`);
    }
  }
}
