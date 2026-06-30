const fs = require('fs');

// 1. Update API route
let taxRoute = fs.readFileSync('src/app/api/reports/tax/route.ts', 'utf8');

// The items.length === 0 push
taxRoute = taxRoute.replace(
  /itemName: "",\s*category: "",/g,
  `itemName: "",\n              hsnCode: "—",\n              category: "",`
);

// The item loop push
taxRoute = taxRoute.replace(
  /itemName: item\.item_name \|\| "Unknown Item",\s*category: item\.category \|\| "Service",/g,
  `itemName: item.item_name || "Unknown Item",\n              hsnCode: taxInfo.hsn,\n              category: item.category || "Service",`
);

fs.writeFileSync('src/app/api/reports/tax/route.ts', taxRoute);

// 2. Update page.tsx PDF export
let pageFile = fs.readFileSync('src/app/admin/reports/page.tsx', 'utf8');

pageFile = pageFile.replace(
  /const invHead = \[\["Invoice Number", "Date", "Customer Name", "GSTIN", "Branch", "Item Name", "Category"/g,
  `const invHead = [["Invoice Number", "Date", "Customer Name", "GSTIN", "Branch", "Item Name", "HSN", "Category"`
);

pageFile = pageFile.replace(
  /inv\.itemName, inv\.category, inv\.gstRate/g,
  `inv.itemName, inv.hsnCode, inv.category, inv.gstRate`
);

// 3. Update page.tsx Excel export
pageFile = pageFile.replace(
  /"Item Name": inv\.itemName,\s*"Category": inv\.category,/g,
  `"Item Name": inv.itemName,\n          "HSN": inv.hsnCode,\n          "Category": inv.category,`
);

fs.writeFileSync('src/app/admin/reports/page.tsx', pageFile);

console.log("Successfully added HSN to Invoice Register in Tax Report");
