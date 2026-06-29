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
    if (content.includes('exportNumber') && !content.includes('import { exportNumber }') && !content.includes(', exportNumber')) {
      content = content.replace('import { formatINR', 'import { exportNumber } from "@/lib/format";\\nimport { formatINR');
      fs.writeFileSync(file, content);
      console.log('Fixed imports in', file);
    }
  }
}
