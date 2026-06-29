const fs = require('fs');

let c = fs.readFileSync('src/app/admin/reports/page.tsx', 'utf8');

// Replace PDF Invoice Register
c = c.replace(/const invHead = gstFormat === "combined"[\s\S]*?\);\n\n        autoTable\(doc, \{/g, `const invHead = [["Invoice #", "Date", "Customer Name", "GSTIN", "Branch", "Item Name", "Category", "GST Rate", "Qty", "Unit Price", "Taxable Value", "Discount", "Loyalty Pts", "CGST", "SGST", "Total Amt", "Status"]];
        
        const invBody = dataToExport.invoiceRegister.map((inv: any) => [
          inv.invoiceNumber, formatDate(inv.invoiceDate), inv.customerName, inv.customerGstin, inv.branch, inv.itemName, inv.category, inv.gstRate, inv.quantity, pdfINR(inv.unitPrice), pdfINR(inv.taxableValue), pdfINR(inv.discount), pdfINR(inv.loyaltyPoints), pdfINR(inv.cgst), pdfINR(inv.sgst), pdfINR(inv.totalValue), inv.status
        ]);

        autoTable(doc, {`);

// Replace Excel Invoice Register
c = c.replace(/const wsInvoices = XLSX\.utils\.json_to_sheet\(dataToExport\.invoiceRegister\.map\(\(inv: any\) => \{[\s\S]*?\}\)\);/g, `const wsInvoices = XLSX.utils.json_to_sheet(dataToExport.invoiceRegister.map((inv: any) => ({
          "Invoice Number": inv.invoiceNumber,
          "Date": formatDate(inv.invoiceDate),
          "Customer Name": inv.customerName,
          "GSTIN": inv.customerGstin,
          "Branch": inv.branch,
          "Item Name": inv.itemName,
          "Category": inv.category,
          "GST Rate": exportNumber(inv.gstRate),
          "Quantity": exportNumber(inv.quantity),
          "Unit Price": exportNumber(inv.unitPrice),
          "Taxable Value": exportNumber(inv.taxableValue),
          "Discount": exportNumber(inv.discount),
          "Loyalty Points": exportNumber(inv.loyaltyPoints),
          "CGST": exportNumber(inv.cgst),
          "SGST": exportNumber(inv.sgst),
          "Total Amount": exportNumber(inv.totalValue),
          "Status": inv.status
        })));`);

// Replace UI Table Invoice Register
c = c.replace(/\{gstFormat === "combined"[\s\S]*?\{dataToExport\.invoiceRegister\.map\(\(inv: any, i: number\) => \([\s\S]*?\)\)}/g, `{["Invoice Number", "Date", "Customer Name", "GSTIN", "Branch", "Item Name", "Category", "GST Rate", "Quantity", "Unit Price", "Taxable Value", "Discount", "Loyalty Points", "CGST", "SGST", "Total Amount", "Status"].map((h) => (
                          <th key={h} className="text-[10px] uppercase tracking-wider text-ivory/50 pb-3 pr-6 font-normal whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dataToExport.invoiceRegister.map((inv: any, i: number) => (
                        <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 pr-6 text-xs text-ivory/80 whitespace-nowrap">{inv.invoiceNumber}</td>
                          <td className="py-3 pr-6 text-xs text-ivory/80 whitespace-nowrap">{formatDate(inv.invoiceDate)}</td>
                          <td className="py-3 pr-6 text-xs text-ivory/80 whitespace-nowrap">{inv.customerName}</td>
                          <td className="py-3 pr-6 text-xs text-ivory/80 whitespace-nowrap">{inv.customerGstin}</td>
                          <td className="py-3 pr-6 text-xs text-ivory/80 whitespace-nowrap">{inv.branch}</td>
                          <td className="py-3 pr-6 text-xs text-ivory/80 whitespace-nowrap">{inv.itemName}</td>
                          <td className="py-3 pr-6 text-xs text-ivory/80 whitespace-nowrap">{inv.category}</td>
                          <td className="py-3 pr-6 text-xs text-ivory/80 whitespace-nowrap">{inv.gstRate}</td>
                          <td className="py-3 pr-6 text-xs text-ivory/80 whitespace-nowrap">{inv.quantity}</td>
                          <td className="py-3 pr-6 text-xs text-ivory/80 whitespace-nowrap font-mono">{formatINR(inv.unitPrice)}</td>
                          <td className="py-3 pr-6 text-xs text-ivory/80 whitespace-nowrap font-mono">{formatINR(inv.taxableValue)}</td>
                          <td className="py-3 pr-6 text-xs text-ivory/80 whitespace-nowrap font-mono">{formatINR(inv.discount)}</td>
                          <td className="py-3 pr-6 text-xs text-ivory/80 whitespace-nowrap font-mono">{formatINR(inv.loyaltyPoints)}</td>
                          <td className="py-3 pr-6 text-xs text-ivory/80 whitespace-nowrap font-mono">{formatINR(inv.cgst)}</td>
                          <td className="py-3 pr-6 text-xs text-ivory/80 whitespace-nowrap font-mono">{formatINR(inv.sgst)}</td>
                          <td className="py-3 pr-6 text-xs text-gold-primary whitespace-nowrap font-mono">{formatINR(inv.totalValue)}</td>
                          <td className="py-3 pr-6 text-xs text-ivory/80 whitespace-nowrap">{inv.status}</td>
                        </tr>
                      ))}`);

fs.writeFileSync('src/app/admin/reports/page.tsx', c);
console.log('Tax report modified');
