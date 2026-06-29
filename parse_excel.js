const xlsx = require('xlsx');

const workbook = xlsx.readFile('product list.xlsx');
const sheetName = workbook.SheetNames[0];
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

console.log(JSON.stringify(data.slice(0, 5), null, 2));
console.log(`\nTotal rows: ${data.length}`);
