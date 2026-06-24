"use client";

import { useState, useEffect } from "react";
import { supabaseAdminClient } from "@/lib/supabase";
import { 
  ShieldAlert, Loader2, Download, FileSpreadsheet, Building2, Calendar, LayoutDashboard, ChevronLeft
} from "lucide-react";
import Link from "next/link";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { formatINR, formatDate, monthKey, todayISO } from "@/lib/format";

// PDF-safe currency formatter: jsPDF Helvetica cannot render ₹ (shows as ¹)
// Use 'Rs.' prefix for all PDF output instead.
function pdfINR(value: number): string {
  const v = Number(value) || 0;
  return "Rs." + new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

export default function TaxComplianceReports() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("All Branches");
  const [exportBranch, setExportBranch] = useState("All Branches");
  const [gstFormat, setGstFormat] = useState<"combined" | "separated">("separated");
  const [branches, setBranches] = useState<string[]>([]);
  
  // Data
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);

  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setStartDate(firstDay.toISOString().slice(0, 10));
    setEndDate(today.toISOString().slice(0, 10));

    // Auth Check
    supabaseAdminClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const role = session.user?.app_metadata?.role;
        if (role === "admin") {
          setIsAdmin(true);
          setSessionToken(session.access_token);
          setAdminEmail(session.user?.email || null);
          loadBranches(session.access_token);
        } else {
          setAuthError("Access denied. Admin role required for Tax & Compliance Reports.");
        }
      }
      setAuthLoading(false);
    });
  }, []);

  const loadBranches = async (token: string) => {
    try {
      const res = await fetch("/api/billing/admin?action=list_staff", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success && data.staff) {
        const uniqueBranches = Array.from(new Set([
          "Kaduthuruthy", "Ettumanoor", "Peruva",
          ...data.staff.map((s: any) => s.app_metadata?.branch).filter(Boolean)
        ])) as string[];
        setBranches(uniqueBranches);
      }
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        alert("Network error. Please check your connection and try again.");
      } else {
        alert("Something went wrong. Please try again.");
      }
    }
  };

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken) return;

    setReportLoading(true);
    setReportData(null);

    try {
      const res = await fetch("/api/reports/tax", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          action: "get_tax_report",
          startDate,
          endDate,
          branch: selectedBranch
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setReportData(data.report);
      } else {
        alert(data.error || "Failed to query tax report.");
      }
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        alert("Network error. Please check your connection and try again.");
      } else {
        alert("Something went wrong. Please try again.");
      }
    } finally {
      setReportLoading(false);
    }
  };

  const logExport = async (format: string, branch: string) => {
    try {
      await fetch("/api/reports/tax", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          action: "log_export",
          exportType: "Tax & Compliance Report",
          exportFormat: format,
          startDate,
          endDate,
          branch
        })
      });
    } catch (err: any) {
      console.error(err);
      alert("Export generation failed. Please try again later.");
    }
  };

  const getExportData = async () => {
    if (exportBranch === selectedBranch && reportData) return reportData;
    const res = await fetch("/api/reports/tax", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sessionToken}`
      },
      body: JSON.stringify({ action: "get_tax_report", startDate, endDate, branch: exportBranch })
    });
    const data = await res.json();
    return data.success ? data.report : null;
  };

  const exportPDF = async () => {
    setPdfLoading(true);
    const dataToExport = await getExportData();
    setPdfLoading(false);
    if (!dataToExport) return;

    try {
      await logExport("PDF", exportBranch);

      const doc = new jsPDF("l", "mm", "a4"); // Landscape for wide tables
      const pageWidth = 297;
      let y = 15;

      const drawHeader = (title: string) => {
        doc.setFillColor(30, 30, 30);
        doc.rect(0, 0, pageWidth, 25, "F");
        
        doc.setTextColor(212, 175, 55);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("MacBello Family Salon", 14, 12);
        
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("GSTIN: 32AABCM1029F1Z4 | Address: Corporate Office, Kerala", 14, 18);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(title, pageWidth - 14, 12, { align: "right" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(`Branch: ${exportBranch} | Period: ${startDate} to ${endDate}`, pageWidth - 14, 18, { align: "right" });
        
        y = 35;
      };

      // PAGE 1: SUMMARY
      drawHeader("TAX & COMPLIANCE SUMMARY");
      doc.setTextColor(0, 0, 0);
      
      const sum = dataToExport.summary;
      autoTable(doc, {
        startY: y,
        head: [["Metric", "Value"]],
        body: [
          ["Total Invoices", sum.totalInvoices.toString()],
          ["Total Sales Value (GST Incl.)", pdfINR(sum.totalSales)],
          ["Taxable Value (Before GST)", pdfINR(sum.totalTaxable)],
          ["Total GST Collected", pdfINR(sum.totalGstCollected)],
          ["CGST Total (50% of GST)", pdfINR(sum.totalCgst)],
          ["SGST Total (50% of GST)", pdfINR(sum.totalSgst)],
          ["IGST Total", pdfINR(sum.totalIgst)]
        ],
        theme: "grid",
        headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255] }
      });
      y = (doc as any).lastAutoTable?.finalY + 15 || y + 50;

      // HSN SUMMARY
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("HSN/SAC SUMMARY", 14, y);
      
      const hsnHead = gstFormat === "combined" 
        ? [["HSN Code", "Description", "Qty", "Taxable (Before GST)", "Rate", "Total GST", "Total (GST Incl.)"]]
        : [["HSN Code", "Description", "Qty", "Taxable (Before GST)", "Rate", "CGST", "SGST", "IGST", "Total (GST Incl.)"]];

      const hsnBody = dataToExport.hsnSummary.map((h: any) => gstFormat === "combined"
        ? [h.hsnCode, h.description, h.quantity, pdfINR(h.taxableValue), h.gstRate, pdfINR(h.cgst + h.sgst + h.igst), pdfINR(h.totalValue)]
        : [h.hsnCode, h.description, h.quantity, pdfINR(h.taxableValue), h.gstRate, pdfINR(h.cgst), pdfINR(h.sgst), pdfINR(h.igst), pdfINR(h.totalValue)]
      );

      autoTable(doc, {
        startY: y + 4,
        head: hsnHead,
        body: hsnBody,
        theme: "grid",
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
        styles: { fontSize: 7 }
      });

      // PAGE 2: INVOICE REGISTER
      doc.addPage();
      drawHeader("INVOICE REGISTER (B2C/B2B)");

      const invHead = gstFormat === "combined"
        ? [["Date", "Invoice #", "Customer", "GSTIN", "Branch", "Taxable (Pre-GST)", "Total GST", "Total (GST Incl.)", "Status"]]
        : [["Date", "Invoice #", "Customer", "GSTIN", "Branch", "Taxable (Pre-GST)", "CGST", "SGST", "Total (GST Incl.)", "Status"]];

      const invBody = dataToExport.invoiceRegister.map((inv: any) => gstFormat === "combined"
        ? [formatDate(inv.invoiceDate), inv.invoiceNumber, inv.customerName, inv.customerGstin, inv.branch, pdfINR(inv.taxableValue), pdfINR(inv.cgst + inv.sgst + inv.igst), pdfINR(inv.totalValue), inv.status]
        : [formatDate(inv.invoiceDate), inv.invoiceNumber, inv.customerName, inv.customerGstin, inv.branch, pdfINR(inv.taxableValue), pdfINR(inv.cgst), pdfINR(inv.sgst), pdfINR(inv.totalValue), inv.status]
      );

      autoTable(doc, {
        startY: y,
        head: invHead,
        body: invBody,
        theme: "grid",
        headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255] },
        styles: { fontSize: 7 }
      });

      // PAGE 3: BRANCH & GST SUMMARY
      doc.addPage();
      drawHeader("BRANCH & RATE SUMMARY");
      
      doc.setFontSize(10);
      doc.text("GST RATE SUMMARY", 14, y);
      autoTable(doc, {
        startY: y + 4,
        head: [["GST Rate", "Invoices", "Taxable (Before GST)", "GST Collected"]],
        body: dataToExport.gstRateSummary.map((g: any) => [
          g.gstRate, g.invoiceCount, pdfINR(g.taxableValue), pdfINR(g.gstCollected)
        ]),
        theme: "grid",
        styles: { fontSize: 8 }
      });
      y = (doc as any).lastAutoTable?.finalY + 15 || y + 30;

      doc.text("BRANCH SUMMARY", 14, y);
      autoTable(doc, {
        startY: y + 4,
        head: [["Branch", "Invoices", "Revenue (GST Incl.)", "Taxable (Pre-GST)", "GST Collected"]],
        body: dataToExport.branchSummary.map((b: any) => [
          b.branchName, b.invoiceCount, pdfINR(b.revenue), pdfINR(b.taxableValue), pdfINR(b.gstCollected)
        ]),
        theme: "grid",
        styles: { fontSize: 8 }
      });

      // PAGE 4: ITEM SALES SUMMARY
      doc.addPage();
      drawHeader("ITEM SALES SUMMARY (SORTED BY QTY)");
      autoTable(doc, {
        startY: y,
        head: [["Item Name", "Category", "Quantity Sold", "Total Revenue (GST Incl.)"]],
        body: dataToExport.itemSummary.map((item: any) => [
          item.itemName, item.category, item.quantity, pdfINR(item.revenue)
        ]),
        theme: "grid",
        styles: { fontSize: 8 }
      });

      // PAGE 5: DETAILED TRANSACTIONS
      doc.addPage();
      drawHeader("DETAILED TRANSACTIONS");
      autoTable(doc, {
        startY: y,
        head: [["Date", "Invoice", "Item", "HSN", "Qty", "Pre-GST Price", "GST Rate", "GST Amt", "Total (GST Incl.)"]],
        body: reportData.detailedTransactions.map((t: any) => [
          formatDate(t.date), t.invoiceNumber, t.itemName.substring(0, 20), t.hsnCode, t.quantity,
          pdfINR(t.unitPrice), t.gstRate, pdfINR(t.gstAmount), pdfINR(t.finalAmount)
        ]),
        theme: "grid",
        styles: { fontSize: 7 }
      });

      // Add Footer to all pages
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Generated by ${adminEmail} on ${new Date().toLocaleString()} | Page ${i} of ${pageCount}`, 14, 200);
      }

      doc.save(`Monthly_Tax_Report_${exportBranch.replace(/ /g, "_")}_${endDate}.pdf`);
    } catch (err: any) {
      console.error(err);
      alert("Export generation failed. Please try again later.");
    }
  };

  const exportExcel = async () => {
    setExcelLoading(true);
    const dataToExport = await getExportData();
    setExcelLoading(false);
    if (!dataToExport) return;

    try {
      await logExport("Excel", exportBranch);

      const wb = XLSX.utils.book_new();

      // SHEET 1: Summary
      const wsSummary = XLSX.utils.json_to_sheet([
        { Metric: "Total Invoices", Value: dataToExport.summary.totalInvoices },
        { Metric: "Total Sales Value (GST Incl.)", Value: dataToExport.summary.totalSales },
        { Metric: "Taxable Value (Before GST)", Value: dataToExport.summary.totalTaxable },
        { Metric: "Total GST Collected", Value: dataToExport.summary.totalGstCollected },
        { Metric: "CGST Total", Value: dataToExport.summary.totalCgst },
        { Metric: "SGST Total", Value: dataToExport.summary.totalSgst },
        { Metric: "IGST Total", Value: dataToExport.summary.totalIgst },
      ]);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

      // SHEET 2: HSN Summary
      const wsHsn = XLSX.utils.json_to_sheet(dataToExport.hsnSummary.map((h: any) => {
        if (gstFormat === "combined") {
          return {
            "HSN Code": h.hsnCode,
            "Description": h.description,
            "Quantity": h.quantity,
            "Taxable Value": h.taxableValue,
            "GST Rate": h.gstRate,
            "Total GST": h.cgst + h.sgst + h.igst,
            "Total Value": h.totalValue
          };
        } else {
          return {
            "HSN Code": h.hsnCode,
            "Description": h.description,
            "Quantity": h.quantity,
            "Taxable Value": h.taxableValue,
            "GST Rate": h.gstRate,
            "CGST": h.cgst,
            "SGST": h.sgst,
            "IGST": h.igst,
            "Total Value": h.totalValue
          };
        }
      }));
      XLSX.utils.book_append_sheet(wb, wsHsn, "HSN Summary");

      // SHEET 3: GST Rate Summary
      const wsGst = XLSX.utils.json_to_sheet(dataToExport.gstRateSummary.map((g: any) => ({
        "GST Rate": g.gstRate,
        "Invoices": g.invoiceCount,
        "Taxable Value": g.taxableValue,
        "GST Collected": g.gstCollected
      })));
      XLSX.utils.book_append_sheet(wb, wsGst, "GST Rate Summary");

      // SHEET 4: Branch Summary
      const wsBranch = XLSX.utils.json_to_sheet(dataToExport.branchSummary.map((b: any) => ({
        "Branch": b.branchName,
        "Invoices": b.invoiceCount,
        "Revenue (GST Incl.)": b.revenue,
        "Taxable (Pre-GST)": b.taxableValue,
        "GST Collected": b.gstCollected
      })));
      XLSX.utils.book_append_sheet(wb, wsBranch, "Branch Summary");

      // SHEET 5: Item Sales Summary
      const wsItem = XLSX.utils.json_to_sheet(dataToExport.itemSummary.map((i: any) => ({
        "Item Name": i.itemName,
        "Category": i.category,
        "Quantity Sold": i.quantity,
        "Total Revenue": i.revenue
      })));
      XLSX.utils.book_append_sheet(wb, wsItem, "Item Sales Summary");

      // SHEET 6: Invoice Register
      const wsInvoices = XLSX.utils.json_to_sheet(dataToExport.invoiceRegister.map((inv: any) => {
        if (gstFormat === "combined") {
          return {
            "Invoice Number": inv.invoiceNumber,
            "Date": inv.invoiceDate,
            "Customer Name": inv.customerName,
            "GSTIN": inv.customerGstin,
            "Branch": inv.branch,
            "Taxable Value": inv.taxableValue,
            "Total GST": inv.cgst + inv.sgst + inv.igst,
            "Total Amount": inv.totalValue,
            "Status": inv.status
          };
        } else {
          return {
            "Invoice Number": inv.invoiceNumber,
            "Date": inv.invoiceDate,
            "Customer Name": inv.customerName,
            "GSTIN": inv.customerGstin,
            "Branch": inv.branch,
            "Taxable Value": inv.taxableValue,
            "CGST": inv.cgst,
            "SGST": inv.sgst,
            "Total Amount": inv.totalValue,
            "Status": inv.status
          };
        }
      }));
      XLSX.utils.book_append_sheet(wb, wsInvoices, "Invoice Register");

      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
      saveAs(blob, `Monthly_Tax_Report_${exportBranch.replace(/ /g, "_")}_${endDate}.xlsx`);
    } catch (err: any) {
      console.error(err);
      alert("Export generation failed. Please try again later.");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-luxury-black flex items-center justify-center">
        <Loader2 className="animate-spin text-gold-primary" size={32} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-luxury-black flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert size={48} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-playfair text-white mb-2">Access Denied</h1>
        <p className="text-ivory/60 text-sm max-w-md">{authError}</p>
        <Link href="/" className="mt-8 text-gold-primary uppercase tracking-widest text-xs border border-gold-primary/30 px-6 py-3 hover:bg-gold-primary/10 transition-colors">
          Return Home
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-luxury-black text-white px-6 py-12 md:py-20 relative">
      <div className="absolute top-0 left-0 w-full h-full bg-[url('/noise.png')] opacity-[0.03] pointer-events-none mix-blend-overlay" />
      
      <div className="max-w-6xl mx-auto z-10 relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-6 mb-8 gap-4">
          <div>
            <Link href="/admin" className="text-gold-primary/70 hover:text-gold-primary text-[10px] uppercase tracking-widest flex items-center mb-3 transition-colors">
              <ChevronLeft size={12} className="mr-1" /> Back to Admin
            </Link>
            <span className="text-[9px] uppercase tracking-[0.25em] text-red-500 font-bold mb-1.5 block flex items-center">
              <ShieldAlert size={10} className="mr-1.5" /> Restricted Access
            </span>
            <h1 className="font-playfair text-3xl font-light tracking-wide">
              Tax & Compliance Reporting
            </h1>
            <p className="text-xs text-ivory/50 font-light mt-2 max-w-xl">
              Accountant-grade reporting module for GST verification, financial audits, and compliance checks.
            </p>
          </div>
          {/* GSTR-1 Quick Link */}
          <Link href="/admin/reports/gstr1"
            className="flex flex-col items-start border border-gold-primary/30 bg-gold-primary/[0.03] hover:bg-gold-primary/[0.07] p-5 transition-all duration-300 group min-w-[220px]">
            <div className="flex items-center gap-2 mb-2">
              <LayoutDashboard size={14} className="text-gold-primary" />
              <span className="text-[9px] uppercase tracking-[0.2em] text-gold-primary font-bold">GSTR-1 Module</span>
            </div>
            <p className="text-sm text-white font-playfair font-light">GST Filing Export</p>
            <p className="text-[9px] text-ivory/50 mt-1.5">B2B · B2C · HSN · Rate Summary · Invoice Register</p>
            <span className="text-[9px] uppercase tracking-widest text-gold-primary/60 group-hover:text-gold-primary mt-3 transition-colors">Open Module →</span>
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white/[0.01] border border-white/5 p-6 mb-8 relative">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-gold-primary/30" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-gold-primary/30" />
          
          <form onSubmit={handleQuery} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-ivory/60 mb-2 flex items-center">
                <Calendar size={10} className="mr-1.5" /> Start Date
              </label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required
                className="w-full bg-luxury-black border border-white/10 px-4 py-2.5 text-xs text-white focus:border-gold-primary/50 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-ivory/60 mb-2 flex items-center">
                <Calendar size={10} className="mr-1.5" /> End Date
              </label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required
                className="w-full bg-luxury-black border border-white/10 px-4 py-2.5 text-xs text-white focus:border-gold-primary/50 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-ivory/60 mb-2 flex items-center">
                <Building2 size={10} className="mr-1.5" /> Branch Filter
              </label>
              <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full bg-luxury-black border border-white/10 px-4 py-2.5 text-xs text-white focus:border-gold-primary/50 outline-none appearance-none">
                <option value="All Branches">All Branches</option>
                {branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <button type="submit" disabled={reportLoading}
                className="w-full bg-gold-primary text-luxury-black text-[10px] font-bold uppercase tracking-widest px-4 py-3 hover:bg-gold-dark transition-colors disabled:opacity-50 flex items-center justify-center">
                {reportLoading ? <Loader2 size={12} className="animate-spin mr-2" /> : <LayoutDashboard size={12} className="mr-2" />}
                Generate Reports
              </button>
            </div>
          </form>
        </div>

        {/* Results */}
        {reportData && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Export Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-center bg-white/[0.02] border border-white/10 p-4">
              <div>
                <p className="text-xs text-ivory/70">
                  Generated reports for <strong className="metric-value text-white">{reportData.summary.totalInvoices}</strong> invoices from {startDate} to {endDate}.
                </p>
              </div>
              <div className="flex items-center gap-3 mt-4 sm:mt-0">
                <div className="flex gap-2 items-center">
                  <select value={gstFormat} onChange={e => setGstFormat(e.target.value as "combined" | "separated")} className="bg-luxury-black border border-white/10 px-3 py-2 text-[10px] uppercase tracking-wider text-white outline-none h-full">
                    <option value="separated">Separated GST</option>
                    <option value="combined">Combined GST</option>
                  </select>
                  <select value={exportBranch} onChange={e => setExportBranch(e.target.value)} className="bg-luxury-black border border-white/10 px-3 py-2 text-[10px] uppercase tracking-wider text-white outline-none h-full">
                    <option>All Branches</option>
                    {branches.map(b => <option key={b}>{b}</option>)}
                  </select>
                  <button
                    onClick={exportExcel}
                    disabled={excelLoading}
                    className="flex items-center text-[10px] uppercase tracking-wider border border-green-600 text-green-400 px-4 py-2 hover:bg-green-600/10 transition-colors disabled:opacity-50"
                  >
                    <FileSpreadsheet size={12} className="mr-2" />
                    {excelLoading ? "Exporting..." : "Excel"}
                  </button>
                  <button
                    onClick={exportPDF}
                    disabled={pdfLoading}
                    className="flex items-center text-[10px] uppercase tracking-wider bg-red-700 text-white px-4 py-2 hover:bg-red-800 transition-colors disabled:opacity-50"
                  >
                    <Download size={12} className="mr-2" />
                    {pdfLoading ? "Exporting..." : "PDF"}
                  </button>
                </div>
              </div>
            </div>

            {/* Dashboards Preview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white/[0.01] border border-white/5 p-5">
                <p className="text-[10px] text-ivory/50 uppercase tracking-widest mb-1">Total Sales</p>
                <p className="currency-value text-xl text-white">{formatINR(reportData.summary.totalSales)}</p>
              </div>
              <div className="bg-white/[0.01] border border-white/5 p-5">
                <p className="text-[10px] text-ivory/50 uppercase tracking-widest mb-1">Taxable Value</p>
                <p className="currency-value text-xl text-white">{formatINR(reportData.summary.totalTaxable)}</p>
              </div>
              <div className="bg-white/[0.01] border border-white/5 p-5">
                <p className="text-[10px] text-ivory/50 uppercase tracking-widest mb-1">Total GST Collected</p>
                <p className="currency-value text-xl text-gold-primary">{formatINR(reportData.summary.totalGstCollected)}</p>
              </div>
              <div className="bg-white/[0.01] border border-white/5 p-5">
                <p className="text-[10px] text-ivory/50 uppercase tracking-widest mb-1">Total CGST</p>
                <p className="currency-value text-xl text-white">{formatINR(reportData.summary.totalCgst)}</p>
              </div>
            </div>

            {/* Top 5 Best Selling Items Preview */}
            <div className="bg-white/[0.01] border border-white/5 p-6 mt-8">
              <h3 className="font-playfair text-lg text-gold-primary mb-4">Top 5 Best Selling Items</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-ivory/60">
                      <th className="pb-3 font-medium">Item Name</th>
                      <th className="pb-3 font-medium">Category</th>
                      <th className="pb-3 font-medium text-right">Quantity Sold</th>
                      <th className="pb-3 font-medium text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.itemSummary.slice(0, 5).map((item: any, idx: number) => (
                      <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="py-3 text-white">{item.itemName}</td>
                        <td className="py-3 text-ivory/70">{item.category}</td>
                        <td className="metric-value py-3 text-right text-white font-medium">{item.quantity}</td>
                        <td className="currency-value py-3 text-right text-gold-primary">{formatINR(item.revenue)}</td>
                      </tr>
                    ))}
                    {reportData.itemSummary.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-ivory/40">No items sold in this period</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="text-center pt-8 pb-4">
              <p className="text-xs text-ivory/40 italic">
                Please use the Export functions above to download the full Accountant-Grade reports.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
