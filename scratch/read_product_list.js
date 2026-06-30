const XLSX = require('xlsx');

try {
  const workbook = XLSX.readFile('product list.xlsx');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  console.log(`Total rows: ${data.length}`);
  console.log("Sample row:", data[0]);
  
  // Find a product that had the wrong GST rate (e.g. 1800)
  const anomalies = data.filter(r => {
     const gst = r['GST Rate'] || r['GST'] || r['TAX RATE'] || r['tax_rate'];
     if (typeof gst === 'number' && gst > 18) return true;
     return false;
  });
  
  console.log("Some items in the excel:", data.slice(0, 5));
} catch (err) {
  console.error(err);
}
