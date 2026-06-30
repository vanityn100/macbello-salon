const XLSX = require('xlsx');
const fs = require('fs');

const workbook = XLSX.readFile('product list.xlsx');
const sheetName = workbook.SheetNames[0];
const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

const productMaster = {};

for (const row of data) {
    if (row.PRODUCT) {
        const productName = String(row.PRODUCT).trim().toUpperCase();
        const hsn = row['HSN CODE'] ? String(row['HSN CODE']).trim() : "Unassigned";
        const gstRate = row['tax rate'] !== undefined ? Number(row['tax rate']) : null;
        
        productMaster[productName] = {
            hsn,
            gstRate
        };
    }
}

fs.writeFileSync('src/lib/productMaster.json', JSON.stringify(productMaster, null, 2));
console.log('Saved productMaster.json with', Object.keys(productMaster).length, 'products');
