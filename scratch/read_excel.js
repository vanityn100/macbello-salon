const xlsx = require('xlsx');

const workbook = xlsx.readFile('PERUVA SALE REPORT TILL 27-6-2026.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const data = xlsx.utils.sheet_to_json(sheet, { defval: "" });
console.log(JSON.stringify(data.slice(0, 5), null, 2));
