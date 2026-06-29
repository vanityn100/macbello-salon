const XLSX = require('xlsx');

try {
  const workbook = XLSX.readFile('product list.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { defval: null });
  
  console.log(`Total rows: ${data.length}`);
  console.log("First 5 rows:");
  console.log(JSON.stringify(data.slice(0, 5), null, 2));
} catch (error) {
  console.error("Error reading file:", error.message);
}
