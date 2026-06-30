const fs = require('fs');

let productMaster = JSON.parse(fs.readFileSync('src/lib/productMaster.json', 'utf8'));

// Fix typos by replacing old keys with new ones
const replacements = {
  "MK REPL. SHAMOO WITH ARGAN OIL 500ML*2": "MK REPL. SHAMPOO WITH ARGAN OIL 500ML*2",
  "MK MAJESTIC REPL CONDTIONER 300ML": "MK MAJESTIC REPL CONDITIONER 300ML"
};

for (const [oldKey, newKey] of Object.entries(replacements)) {
  if (productMaster[oldKey]) {
    productMaster[newKey] = productMaster[oldKey];
    delete productMaster[oldKey];
  }
}

// Fix encoding issues dynamically
const newMaster = {};
for (const [key, value] of Object.entries(productMaster)) {
  let cleanKey = key.replace(/K\?TS/g, "K'S").replace(/K\?T/g, "K'S"); // Catch any weird encoding
  // Hardcoded catch-all for the SSP items just in case regex misses
  if (key.includes("BACKWASH CONDITIONER")) cleanKey = "SSP K'S BACKWASH CONDITIONER 5000ML";
  if (key.includes("BACKWASH ACTIVATOR")) cleanKey = "SSP K'S BACKWASH ACTIVATOR SHAMPOO 5000ML";
  
  newMaster[cleanKey] = value;
}
productMaster = newMaster;

// Assign STRX PRO SERUM
if (productMaster["STRX PRO SERUM"]) {
  productMaster["STRX PRO SERUM"].hsn = "33059090"; // Assigning standard hair serum HSN
}

fs.writeFileSync('src/lib/productMaster.json', JSON.stringify(productMaster, null, 2));

console.log("Updated productMaster.json");
