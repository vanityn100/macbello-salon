/**
 * Canonical branch information for MacBello Family Salon.
 * Used in all PDF reports, invoices, and exports.
 */

export interface BranchInfo {
  name: string;
  address1: string; // building / arcade
  address2: string; // street / road
  city: string;     // city, district
  state: string;    // state – pincode
  gstin: string;
  phone: string;
  email: string;
}

export const BRANCH_INFO: Record<string, BranchInfo> = {
  Kaduthuruthy: {
    name:     "MACBELLO FAMILY SALON",
    address1: "Aiden's Arcade, Market Junction",
    address2: "",
    city:     "Kaduthuruthy, Kottayam",
    state:    "Kerala – 686604",
    gstin:    "32OOXPS4225A1ZL",
    phone:    "+91 95625 14002",
    email:    "macbellosalonkdty@gmail.com",
  },
  Ettumanoor: {
    name:     "MACBELLO FAMILY SALON",
    address1: "Ground Floor, Panthaplackil Buildings",
    address2: "1/376, MC Road",
    city:     "Ettumanoor, Kottayam",
    state:    "Kerala – 686632",
    gstin:    "32OOXPS4225A1ZL",
    phone:    "+91 97469 14003",
    email:    "macbellosalonetr@gmail.com",
  },
  Peruva: {
    name:     "MACBELLO FAMILY SALON",
    address1: "Jacobs Arcade, Elenji Road",
    address2: "",
    city:     "Peruva, Kottayam",
    state:    "Kerala – 686610",
    gstin:    "32OOXPS4225A1ZL",
    phone:    "+91 95448 14003",
    email:    "macbellosalonperuva@gmail.com",
  },
};

/** Returns branch info, falling back to Kaduthuruthy if unrecognised. */
export function getBranchInfo(branch: string): BranchInfo {
  return BRANCH_INFO[branch] ?? BRANCH_INFO["Kaduthuruthy"];
}

/** Single-line address string for compact use in PDFs. */
export function getBranchAddressLine(branch: string): string {
  const b = getBranchInfo(branch);
  const parts = [b.address1, b.address2, b.city, b.state].filter(Boolean);
  return parts.join(", ");
}

/**
 * Draws a standard branch header block onto a jsPDF document.
 * Landscape (A4) safe — designed for the 8mm left margin.
 *
 * @param doc      jsPDF instance (already created)
 * @param branch   Branch name string
 * @param title    Report title shown on the right e.g. "GSTR-1 REPORT"
 * @param subtitle Optional subtitle e.g. "Period: 2026-01-01 to 2026-06-24"
 * @param isLandscape Pass true if the doc is landscape (pw=297) else false (pw=210)
 */
export function drawPDFBranchHeader(
  doc: any,
  branch: string,
  title: string,
  subtitle: string,
  isLandscape = true
): void {
  const b = getBranchInfo(branch);
  const pw = isLandscape ? 297 : 210;
  const GOLD: [number, number, number] = [212, 175, 55];
  const WHITE: [number, number, number] = [255, 255, 255];
  const DARK: [number, number, number] = [20, 20, 20];

  // Header bar
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pw, 32, "F");

  // Gold left accent bar
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, 3, 32, "F");

  // LEFT — Salon name + address
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(b.name, 8, 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...WHITE);
  const addr = [b.address1, b.address2].filter(Boolean).join(", ");
  doc.text(addr, 8, 14);
  doc.text(`${b.city}, ${b.state}`, 8, 18);
  doc.text(`GSTIN: ${b.gstin}  |  ${b.phone}`, 8, 22);
  doc.text(`${branch} Branch`, 8, 27);

  // RIGHT — Report title + subtitle
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...GOLD);
  doc.text(title, pw - 8, 10, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...WHITE);
  if (subtitle) doc.text(subtitle, pw - 8, 16, { align: "right" });
}
