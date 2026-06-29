import { formatGst } from '@/lib/gst';
import { jsPDF } from "jspdf";

export interface CompletedInvoice {
  invoice: {
    id: string;
    invoice_number: string;
    grand_total: string;
    created_at: string;
    redeemed_points: number;
    discount: string;
    points_earned: number;
    created_by: string;
    points_redeemed: number;
    payment_method?: string;
    subtotal: string;
    total_tax: string;
    service_tax: string;
    retail_tax: string;
    branch?: string;
  };
  items: Array<{
    item_name: string;
    category: string;
    quantity: number;
    unit_price: string;
    tax_rate: number;
    line_total: string;
    item_code?: string | null;
    hsn?: string | null;
    staff_contribution?: string | null;
  }>;
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    points: number;
  };
  newPoints: number;
  branch: string;
}

/**
 * Builds the jsPDF instance for a completed invoice.
 * Shared between local downloads and email attachment packaging.
 */
export function buildInvoicePDFDocument(completedInvoice: CompletedInvoice): jsPDF {
  const { 
    invoice, items, customer, newPoints, branch
  } = completedInvoice;

  // Use the backend source-of-truth values directly
  const subtotal = parseFloat(invoice.subtotal) || 0;
  const serviceTax = parseFloat((invoice as any).service_tax) || 0;
  const retailTax = parseFloat((invoice as any).retail_tax) || 0;
  const totalTax = parseFloat(invoice.total_tax || (invoice as any).totalTax) || 0;
  const discount = parseFloat(invoice.discount) || 0;
  const grandTotal = parseFloat(invoice.grand_total) || 0;
  const pointsEarned = invoice.points_earned || 0;
  const loyaltyRedeemed = invoice.points_redeemed || invoice.redeemed_points || 0;

  const doc = new jsPDF("p", "mm", "a4");

  // Branch Info Directory
  const branchInfo: Record<string, { address: string; phone: string }> = {
    Kaduthuruthy: {
      address: "Market Junction, Kaduthuruthy, Kerala 686604",
      phone: "+91 95625 14002"
    },
    Ettumanoor: {
      address: "Ground Floor, Panthaplackil Buildings, MC Road, Ettumanoor, Kottayam, Kerala 686632",
      phone: "+91 97469 14003"
    },
    Peruva: {
      address: "Macbello Family Salon, Peruva, Kerala 686610",
      phone: "+91 95448 14003"
    }
  };

  const activeBranch = branchInfo[branch] || {
    address: "Macbello Salon, Kerala",
    phone: "+91 95625 14002"
  };

  // Determine membership tier based on points
  let tier = "Bronze";
  if (newPoints >= 1500) {
    tier = "Platinum";
  } else if (newPoints >= 500) {
    tier = "Gold";
  } else if (newPoints >= 100) {
    tier = "Silver";
  }

  // Header / Branding
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(170, 124, 17); // Gold-dark theme color for brand
  doc.text("MACBELLO SALON & SPA", 20, 20);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(17, 17, 17);
  doc.text("TAX INVOICE", 20, 30);

  // Invoice Details
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text(`Branch: ${branch}`, 20, 38);
  
  // Split long address onto two lines if needed to avoid overlapping
  const addressText = `Address: ${activeBranch.address}`;
  const addressLines = doc.splitTextToSize(addressText, 85);
  doc.text(addressLines, 20, 43);
  
  const addressHeight = addressLines.length * 4.5;
  const nextLeftY = 43 + addressHeight;
  
  doc.text(`Contact: ${activeBranch.phone}`, 20, nextLeftY);
  doc.text(`GSTIN: 32OOXPS4225A1ZL`, 20, nextLeftY + 5);
  
  // Right Column Details (fixed vertical spacing)
  doc.text(`Invoice ID: ${invoice.id.toUpperCase()}`, 115, 38);
  doc.text(`Invoice #: ${invoice.invoice_number}`, 115, 43);
  doc.text(`Date & Time: ${new Date(invoice.created_at).toLocaleString()}`, 115, 48);
  doc.text(`Payment Mode: ${invoice.payment_method || 'Cash'}`, 115, 53);
  
  const bottomY = Math.max(nextLeftY + 8, 57);
  
  // Divider Line
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.5);
  doc.line(20, bottomY, 190, bottomY);

  // Client and Staff Metadata Grid
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(170, 124, 17); // Gold-dark heading
  doc.text("BILLED TO (CUSTOMER)", 20, bottomY + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(17, 17, 17);
  doc.text(customer.name, 20, bottomY + 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Phone: ${customer.phone}`, 20, bottomY + 19);
  if (customer.email) {
    doc.text(`Email: ${customer.email}`, 20, bottomY + 25);
  }
  doc.text(`Customer ID: ${customer.id.substring(0, 8).toUpperCase()}`, 20, bottomY + 31);
  doc.setFont("helvetica", "bold");
  doc.text(`Membership Tier: ${tier}`, 20, bottomY + 37);

  // Staff Account info
  doc.setFont("helvetica", "bold");
  doc.setTextColor(170, 124, 17);
  doc.text("STAFF ACCOUNTABILITY", 115, bottomY + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Generated By: ${invoice.created_by}`, 115, bottomY + 13);
  doc.text(`Staff ID: ${invoice.created_by.split("@")[0].toUpperCase()}`, 115, bottomY + 19);
  doc.text(`Branch ID: ${branch.toUpperCase()}`, 115, bottomY + 25);

  // Table Headers
  let y = bottomY + 48;
  doc.setFillColor(248, 248, 248);
  doc.rect(20, y, 170, 8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text("Item Description", 20, y + 5.5);
  doc.text("HSN", 95, y + 5.5);
  doc.text("Category", 110, y + 5.5);
  doc.text("Tax Rate", 125, y + 5.5);
  doc.text("Qty", 138, y + 5.5);
  doc.text("Price (GST Inc.)", 148, y + 5.5);
  doc.text("Total (GST Inc.)", 168, y + 5.5);

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(17, 17, 17);
  doc.setFontSize(9);

  // Table Rows
  items.forEach((item) => {
    const hasStaff = !!item.staff_contribution;

    doc.setFont("helvetica", "bold");
    const rawDesc = item.item_code ? `${item.item_name} [${item.item_code}]` : item.item_name;
    const descLines = doc.splitTextToSize(rawDesc, 70); // 70 points max width
    
    const extraLines = descLines.length - 1;
    const rowHeight = (hasStaff ? 11 : 8) + (extraLines * 4.5);

    doc.setDrawColor(245, 245, 245);
    doc.setLineWidth(0.3);
    doc.line(20, y + rowHeight, 190, y + rowHeight);

    // Center alignment adjustment for dual-line text if staff exists
    const textY = y + (hasStaff ? 4.5 : 5);
    doc.text(descLines, 20, textY);
    
    if (hasStaff) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 120);
      doc.text(`Staff: ${item.staff_contribution}`, 20, textY + (extraLines * 4.5) + 3.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(17, 17, 17);
    }

    doc.setFont("helvetica", "normal");
    doc.text(item.hsn || "-", 95, textY);
    doc.text(item.category, 110, textY);
    doc.text(`${formatGst(item.tax_rate, item.category)}`, 125, textY);
    doc.text(String(item.quantity), 140, textY);
    const inclUnitPrice = parseFloat(item.unit_price);
    const inclLineTotal = parseFloat(item.line_total);
    doc.text(`INR ${inclUnitPrice.toFixed(2)}`, 148, textY);
    doc.text(`INR ${inclLineTotal.toFixed(2)}`, 168, textY);

    y += rowHeight;
  });

  // Summary and Totals Section Grid
  y += 12;
  
  // Left side: Loyalty Summary Card
  doc.setFillColor(250, 248, 242); // Light luxury background box
  doc.setDrawColor(230, 218, 194);
  doc.rect(20, y, 75, 33, "DF");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(170, 124, 17);
  doc.text("LOYALTY REWARDS SUMMARY", 24, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text("Loyalty Rate: 1 Point per INR 10 spent", 24, y + 12);
  doc.text(`Points Earned today: +${pointsEarned}`, 24, y + 18);
  if (loyaltyRedeemed > 0) {
    doc.text(`Points Redeemed: -${loyaltyRedeemed}`, 24, y + 24);
  }
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 17, 17);
  doc.text(`New Loyalty Balance: ${newPoints} Pts`, 24, y + 29);

  // Right side: Totals Calculation
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);

  let offset = 0;
  doc.text("Taxable Amount:", 115, y + 5 + offset);
  doc.text(`INR ${subtotal.toFixed(2)}`, 165, y + 5 + offset);
  offset += 5;

  if (serviceTax > 0) {
    doc.text("Service GST (5%):", 115, y + 5 + offset);
    doc.text(`INR ${serviceTax.toFixed(2)}`, 165, y + 5 + offset);
    offset += 5;
  }

  if (retailTax > 0) {
    doc.text("Retail GST (18%):", 115, y + 5 + offset);
    doc.text(`INR ${retailTax.toFixed(2)}`, 165, y + 5 + offset);
    offset += 5;
  }

  doc.text("Total GST Amount:", 115, y + 5 + offset);
  doc.text(`INR ${totalTax.toFixed(2)}`, 165, y + 5 + offset);
  offset += 5;

  if (discount > 0) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(200, 50, 50);
    doc.text("Discount:", 115, y + 5 + offset);
    doc.text(`-INR ${discount.toFixed(2)}`, 165, y + 5 + offset);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    offset += 5;
  }

  if (loyaltyRedeemed > 0) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(200, 50, 50);
    doc.text("Loyalty Discount:", 115, y + 5 + offset);
    doc.text(`-INR ${loyaltyRedeemed.toFixed(2)}`, 165, y + 5 + offset);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    offset += 5;
  }

  // Grand Total Highlight
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(17, 17, 17);
  doc.setDrawColor(170, 124, 17);
  doc.setLineWidth(0.5);
  doc.line(115, y + 3 + offset, 190, y + 3 + offset);
  
  doc.text("GRAND TOTAL:", 115, y + 8 + offset);
  doc.text(`INR ${grandTotal.toFixed(2)}`, 165, y + 8 + offset);

  // Professional Footer
  doc.setDrawColor(240, 240, 240);
  doc.line(20, 255, 190, 255);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Thank you for visiting Macbello Salon. Premium self-care is a luxury you deserve.", 20, 262);
  
  doc.setFont("helvetica", "normal");
  doc.text(`Contact Branch: ${activeBranch.phone} | Website: www.macbellosalon.com`, 20, 267);

  return doc;
}

/**
 * Generates and downloads a professional vector PDF of the invoice client-side.
 */
export async function downloadInvoicePDF(completedInvoice: CompletedInvoice): Promise<void> {
  const doc = buildInvoicePDFDocument(completedInvoice);
  doc.save(`INV-${completedInvoice.invoice.invoice_number}.pdf`);
}
