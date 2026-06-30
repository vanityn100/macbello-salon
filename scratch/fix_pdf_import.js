const fs = require('fs');

let file = fs.readFileSync('src/lib/pdf.ts', 'utf8');

file = file.replace(
  "import { formatGst } from '@/lib/gst';",
  "import { formatGst, getTaxInfo } from '@/lib/gst';"
);

fs.writeFileSync('src/lib/pdf.ts', file);
console.log('Fixed pdf.ts imports');
