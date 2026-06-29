const fs = require('fs');
let formatContent = fs.readFileSync('src/lib/format.ts', 'utf8');

if (!formatContent.includes('exportNumber')) {
  formatContent += `
export function exportNumber(value: number | string | any): number {
  const v = Number(value) || 0;
  return Number(v.toFixed(2));
}
`;
  fs.writeFileSync('src/lib/format.ts', formatContent);
  console.log("Added exportNumber to format.ts");
}
