const XLSX = require('xlsx');

const workbook = XLSX.readFile('product list.xlsx');
const sheetName = workbook.SheetNames[0];
const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

console.log('Total products in excel:', data.length);
console.log('First 5:', data.slice(0, 5));
