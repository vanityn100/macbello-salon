"use client";

import { useState, useEffect } from "react";
import { supabaseAdminClient } from "@/lib/supabase";
import {
  ShieldAlert, Loader2, Download, FileSpreadsheet,
  Building2, Calendar, ChevronLeft, AlertTriangle,
  CheckCircle2, FileText, ReceiptText, Hash,
  ChevronDown, ChevronUp
} from "lucide-react";
import Link from "next/link";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { formatINR, formatDate } from "@/lib/format";

// PDF-safe currency: jsPDF Helvetica cannot render ₹
function pdfINR(v: number) {
  return "Rs." + new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const BUSINESS_INFO = {
  name: "MacBello Family Salon",
  gstin: "32AABCM1029F1Z4",
  address: "Corporate Office, Kerala, India",
  phone: "+91 95625 14002",
  email: "accounts@macbellosalon.com",
};

export default function GSTR1Page() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  // Filters
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("All Branches");
  const [gstFormat, setGstFormat] = useState<"separated" | "combined">("separated");
  const [branches, setBranches] = useState<string[]>([]);
  const [useCustomRange, setUseCustomRange] = useState(false);

  // State
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    b2b: true, b2c: true, hsn: false, gstRate: false, register: false
  });

  // Derive date range from month/year
  useEffect(() => {
    if (!useCustomRange) {
      const first = new Date(selectedYear, selectedMonth - 1, 1);
      const last = new Date(selectedYear, selectedMonth, 0);
      setStartDate(first.toISOString().slice(0, 10));
      setEndDate(last.toISOString().slice(0, 10));
    }
  }, [selectedMonth, selectedYear, useCustomRange]);

  useEffect(() => {
    supabaseAdminClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const role = session.user?.app_metadata?.role;
        if (role === "admin") {
          setIsAdmin(true);
          setSessionToken(session.access_token);
          setAdminEmail(session.user?.email || null);
          loadBranches(session.access_token);
        } else {
          setAuthError("Access denied. Admin role required.");
        }
      }
      setAuthLoading(false);
    });
  }, []);

  const loadBranches = async (token: string) => {
    try {
      const res = await fetch("/api/billing/admin?action=list_staff", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success && data.staff) {
        const unique = Array.from(new Set([
          "Kaduthuruthy", "Ettumanoor", "Peruva",
          ...data.staff.map((s: any) => s.app_metadata?.branch).filter(Boolean)
        ])) as string[];
        setBranches(unique);
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

  const toggleSection = (key: string) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken) return;
    setReportLoading(true);
    setReportData(null);
    setValidationErrors([]);

    try {
      const res = await fetch("/api/reports/gstr1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          action: "get_gstr1_report",
          startDate,
          endDate,
          branch: selectedBranch,
          month: selectedMonth,
          year: selectedYear,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReportData(data.report);
        setValidationErrors(data.validationErrors || []);
      } else {
        alert(data.error || "Failed to generate GSTR-1 report.");
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

  const logExport = async (format: string) => {
    if (!reportData) return;
    try {
      await fetch("/api/reports/gstr1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          action: "log_gstr1_export",
          exportFormat: format,
          reportId: reportData.reportId,
          startDate,
          endDate,
          branch: selectedBranch,
        }),
      });
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        alert("Network error. Please check your connection and try again.");
      } else {
        alert("Something went wrong. Please try again.");
      }
    }
  };

  // ── PDF EXPORT ───────────────────────────────────────────────────────────────
  const exportPDF = async () => {
    if (!reportData) return;
    if (validationErrors.length > 0) {
      alert("Cannot export: validation errors found. Please review the errors below.");
      return;
    }
    setPdfLoading(true);
    try {
      await logExport("PDF");
      const doc = new jsPDF("p", "mm", "a4");
      const pw = 210;
      const periodLabel = `${MONTHS[selectedMonth - 1]} ${selectedYear}`;
      const genTime = new Date().toLocaleString("en-IN");
      let y = 0;

      const drawHeader = (pageTitle: string) => {
        doc.setFillColor(20, 20, 20);
        doc.rect(0, 0, pw, 28, "F");
        // Gold left bar
        doc.setFillColor(212, 175, 55);
        doc.rect(0, 0, 3, 28, "F");

        doc.setTextColor(212, 175, 55);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text(BUSINESS_INFO.name, 8, 10);

        doc.setTextColor(200, 200, 200);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(`GSTIN: ${BUSINESS_INFO.gstin}  |  ${BUSINESS_INFO.address}`, 8, 16);
        doc.text(`${BUSINESS_INFO.phone}  |  ${BUSINESS_INFO.email}`, 8, 20);

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("GSTR-1 RETURN", pw - 8, 10, { align: "right" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(pageTitle, pw - 8, 16, { align: "right" });
        doc.text(`Period: ${periodLabel}  |  Branch: ${reportData.branch}`, pw - 8, 20, { align: "right" });

        y = 33;
      };

      const addFooter = (reportId: string) => {
        const total = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= total; i++) {
          doc.setPage(i);
          doc.setFillColor(240, 240, 240);
          doc.rect(0, 286, pw, 11, "F");
          doc.setFont("helvetica", "italic");
          doc.setFontSize(6.5);
          doc.setTextColor(100, 100, 100);
          doc.text(`Report ID: ${reportId}  |  Generated by: ${adminEmail}  |  ${genTime}`, 8, 291);
          doc.text(`Page ${i} of ${total}`, pw - 8, 291, { align: "right" });
        }
      };

      const s = reportData.summary;

      // ── PAGE 1: Summary ───────────────────────────────────
      drawHeader("GSTR-1 SUMMARY");
      doc.setTextColor(0, 0, 0);

      autoTable(doc, {
        startY: y,
        head: [["Particulars", "Value"]],
        body: [
          ["Report ID", reportData.reportId],
          ["Period", periodLabel],
          ["Branch", reportData.branch],
          ["Total Invoices", s.totalInvoices.toString()],
          ["B2B Invoices (with GSTIN)", s.b2bCount.toString()],
          ["B2C Invoices (without GSTIN)", s.b2cCount.toString()],
          ["Total Sales (GST Inclusive)", pdfINR(s.totalSales)],
          ["Taxable Value (Before GST)", pdfINR(s.totalTaxable)],
          ["Total GST Collected", pdfINR(s.totalGst)],
          ["CGST (50% of GST)", pdfINR(s.totalCgst)],
          ["SGST (50% of GST)", pdfINR(s.totalSgst)],
          ["IGST", pdfINR(s.totalIgst)],
        ],
        theme: "grid",
        headStyles: { fillColor: [20, 20, 20], textColor: [212, 175, 55], fontStyle: "bold" },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 90 }, 1: { cellWidth: 90 } },
        styles: { fontSize: 8 },
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      // B2C Summary on page 1
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      doc.text("SECTION 1 — B2C SALES SUMMARY", 8, y);
      y += 3;

      if (reportData.b2cRateSummary.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text("No B2C invoices found in this period.", 8, y + 6);
        y += 14;
      } else {
        autoTable(doc, {
          startY: y,
          head: [["GST Rate", "Invoice Count", "Taxable Value (Before GST)", "GST Amount", "Total Value (GST Incl.)"]],
          body: reportData.b2cRateSummary.map((r: any) => [
            r.gstRate, r.invoiceCount, pdfINR(r.taxableValue), pdfINR(r.gstAmount), pdfINR(r.totalValue)
          ]),
          theme: "grid",
          headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255] },
          styles: { fontSize: 7.5 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // ── PAGE 2: B2B ───────────────────────────────────────
      doc.addPage();
      drawHeader("SECTION 2 — B2B SALES");

      if (reportData.b2bSales.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text("No B2B invoices found. (No customers with GSTIN in this period.)", 8, y + 10);
      } else {
        const b2bHead = gstFormat === "combined"
          ? [["Date", "Invoice #", "Customer", "GSTIN", "Branch", "Taxable", "Total GST", "Total"]]
          : [["Date", "Invoice #", "Customer", "GSTIN", "Branch", "Taxable", "CGST", "SGST", "Total"]];

        const b2bBody = reportData.b2bSales.map((inv: any) => gstFormat === "combined"
          ? [formatDate(inv.invoiceDate), inv.invoiceNumber, inv.customerName.substring(0, 18), inv.customerGstin, inv.branch, pdfINR(inv.taxableValue), pdfINR(inv.cgst + inv.sgst + inv.igst), pdfINR(inv.totalValue)]
          : [formatDate(inv.invoiceDate), inv.invoiceNumber, inv.customerName.substring(0, 18), inv.customerGstin, inv.branch, pdfINR(inv.taxableValue), pdfINR(inv.cgst), pdfINR(inv.sgst), pdfINR(inv.totalValue)]
        );

        autoTable(doc, {
          startY: y,
          head: b2bHead,
          body: b2bBody,
          theme: "grid",
          headStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255] },
          styles: { fontSize: 6.5 },
        });
      }

      // ── PAGE 3: HSN Summary ───────────────────────────────
      doc.addPage();
      drawHeader("SECTION 3 — HSN/SAC SUMMARY");

      const hsnHead = gstFormat === "combined"
        ? [["HSN/SAC", "Description", "Qty", "Taxable (Before GST)", "Rate", "Total GST", "Total (GST Incl.)"]]
        : [["HSN/SAC", "Description", "Qty", "Taxable (Before GST)", "Rate", "CGST", "SGST", "IGST", "Total (GST Incl.)"]];

      const hsnBody = reportData.hsnSummary.map((h: any) => gstFormat === "combined"
        ? [h.hsnCode, h.description.substring(0, 20), h.quantity, pdfINR(h.taxableValue), h.gstRate, pdfINR(h.cgst + h.sgst + h.igst), pdfINR(h.totalValue)]
        : [h.hsnCode, h.description.substring(0, 20), h.quantity, pdfINR(h.taxableValue), h.gstRate, pdfINR(h.cgst), pdfINR(h.sgst), pdfINR(h.igst), pdfINR(h.totalValue)]
      );

      autoTable(doc, {
        startY: y,
        head: hsnHead,
        body: hsnBody,
        theme: "grid",
        headStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255] },
        styles: { fontSize: 6.5 },
      });

      // ── PAGE 4: GST Rate Summary ──────────────────────────
      doc.addPage();
      drawHeader("SECTION 4 — GST RATE SUMMARY");

      const gstHead = gstFormat === "combined"
        ? [["GST Rate", "Invoice Count", "Taxable Value (Before GST)", "Total GST"]]
        : [["GST Rate", "Invoice Count", "Taxable Value (Before GST)", "CGST", "SGST", "IGST", "Total GST"]];

      const gstBody = reportData.gstRateSummary.map((g: any) => gstFormat === "combined"
        ? [g.gstRate, g.invoiceCount, pdfINR(g.taxableValue), pdfINR(g.gstCollected)]
        : [g.gstRate, g.invoiceCount, pdfINR(g.taxableValue), pdfINR(g.cgst), pdfINR(g.sgst), pdfINR(g.igst), pdfINR(g.gstCollected)]
      );

      autoTable(doc, {
        startY: y,
        head: gstHead,
        body: gstBody,
        theme: "grid",
        headStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255] },
        styles: { fontSize: 7.5 },
      });

      // ── PAGE 5+: Invoice Register ─────────────────────────
      doc.addPage();
      drawHeader("SECTION 5 — INVOICE REGISTER");
      autoTable(doc, {
        startY: y,
        head: [["Invoice #", "Date", "Customer", "Branch", "GST Rate", "Taxable", "GST Amt", "Total"]],
        body: reportData.invoiceRegister.map((inv: any) => [
          inv.invoiceNumber, formatDate(inv.invoiceDate),
          inv.customerName.substring(0, 18), inv.branch,
          inv.gstRate, pdfINR(inv.taxableValue), pdfINR(inv.gstAmount), pdfINR(inv.totalValue),
        ]),
        theme: "grid",
        headStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255] },
        styles: { fontSize: 6.5 },
        didDrawPage: () => { y = 33; },
      });

      addFooter(reportData.reportId);
      doc.save(`GSTR1_${MONTHS[selectedMonth - 1]}_${selectedYear}.pdf`);
    } catch (err: any) {
      console.error(err);
      alert("Export generation failed. Please try again later.");
    } finally {
      setPdfLoading(false);
    }
  };

  // ── EXCEL EXPORT ─────────────────────────────────────────────────────────────
  const exportExcel = async () => {
    if (!reportData) return;
    if (validationErrors.length > 0) {
      alert("Cannot export: validation errors found. Please review the errors below.");
      return;
    }
    setExcelLoading(true);
    try {
      await logExport("Excel");
      const wb = XLSX.utils.book_new();
      const periodLabel = `${MONTHS[selectedMonth - 1]} ${selectedYear}`;

      // 1. INVOICE REGISTER (OFFICIAL FORMAT)
      const invoiceSheetData = [
        ["Period", `${periodLabel} - ${periodLabel}`],
        [],
        ["1. GSTIN", BUSINESS_INFO.gstin],
        ["2.a Legal name of the registered person.", BUSINESS_INFO.name],
        ["2.b Trade name, if any", ""],
        ["3.a Aggregate turnover of the preceeding Financial Year", ""],
        ["3.b Aggregate turnover, April to June 2017", ""],
        [],
        ["GSTIN/UIN", "Party Name", "Transaction Type", "Invoice No.", "Invoice Date", "Invoice Value", "Rate", "Taxable value", "Integrated Tax Amount", "Central Tax Amount", "State/UT Tax Amount"],
        [],
        ...reportData.invoiceRegister.map((inv: any) => [
          inv.customerGstin || "",
          inv.customerName || "B2C",
          "Sale",
          inv.invoiceNumber,
          new Date(inv.invoiceDate).toLocaleDateString('en-GB'), // DD/MM/YYYY format
          inv.totalValue,
          inv.gstRate,
          inv.taxableValue,
          inv.igst,
          inv.cgst,
          inv.sgst
        ])
      ];

      const wsInvoices = XLSX.utils.aoa_to_sheet(invoiceSheetData);
      XLSX.utils.book_append_sheet(wb, wsInvoices, "Invoice Register");

      // 2. HSN SUMMARY (OFFICIAL FORMAT)
      const totalValueSum = reportData.hsnSummary.reduce((acc: number, curr: any) => acc + curr.totalValue, 0);
      const totalTaxableSum = reportData.hsnSummary.reduce((acc: number, curr: any) => acc + curr.taxableValue, 0);
      const totalIgstSum = reportData.hsnSummary.reduce((acc: number, curr: any) => acc + curr.igst, 0);
      const totalCgstSum = reportData.hsnSummary.reduce((acc: number, curr: any) => acc + curr.cgst, 0);
      const totalSgstSum = reportData.hsnSummary.reduce((acc: number, curr: any) => acc + curr.sgst, 0);
      const noOfHsn = reportData.hsnSummary.length;

      const hsnSheetData = [
        ["No. of HSN", "", "", "Total Value", "", "Total Taxable Value", "Total Integrated Tax", "Total Central Tax", "Total State/UT Tax"],
        [noOfHsn, "", "", Number(totalValueSum.toFixed(2)), "", Number(totalTaxableSum.toFixed(2)), Number(totalIgstSum.toFixed(2)), Number(totalCgstSum.toFixed(2)), Number(totalSgstSum.toFixed(2))],
        ["HSN", "Description", "UQC", "Total Quantity", "Total Value", "Rate", "Taxable Value", "Integrated Tax Amount", "Central Tax Amount", "State/UT Tax Amount"],
        ...reportData.hsnSummary.map((h: any) => [
          h.hsnCode,
          h.description,
          "OTH-OTHERS",
          h.quantity,
          Number(h.totalValue.toFixed(2)),
          h.gstRate,
          Number(h.taxableValue.toFixed(2)),
          Number(h.igst.toFixed(2)),
          Number(h.cgst.toFixed(2)),
          Number(h.sgst.toFixed(2))
        ])
      ];

      const wsHsn = XLSX.utils.aoa_to_sheet(hsnSheetData);
      XLSX.utils.book_append_sheet(wb, wsHsn, "HSN Summary");

      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(
        new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `GSTR1_${MONTHS[selectedMonth - 1]}_${selectedYear}.xlsx`
      );
    } catch (err: any) {
      console.error(err);
      alert("Export generation failed. Please try again later.");
    } finally {
      setExcelLoading(false);
    }
  };

  // ── RENDER ────────────────────────────────────────────────────────────────────
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
        <p className="text-ivory/60 text-sm max-w-md">{authError || "Admin role required."}</p>
        <Link href="/admin" className="mt-8 text-gold-primary uppercase tracking-widest text-xs border border-gold-primary/30 px-6 py-3 hover:bg-gold-primary/10 transition-colors">
          Return to Admin
        </Link>
      </div>
    );
  }

  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - i);
  const s = reportData?.summary;

  return (
    <main className="min-h-screen bg-luxury-black text-white px-6 py-12 md:py-16 relative">
      <div className="absolute top-0 left-0 w-full h-full bg-[url('/noise.png')] opacity-[0.03] pointer-events-none mix-blend-overlay" />

      <div className="max-w-6xl mx-auto relative z-10">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-6 mb-8 gap-4">
          <div>
            <Link href="/admin/reports" className="text-gold-primary/70 hover:text-gold-primary text-[10px] uppercase tracking-widest flex items-center mb-3 transition-colors">
              <ChevronLeft size={12} className="mr-1" /> Back to Reports
            </Link>
            <span className="text-[9px] uppercase tracking-[0.25em] text-red-500 font-bold mb-1.5 flex items-center">
              <ShieldAlert size={10} className="mr-1.5" /> Admin Only · GSTR-1 Filing Module
            </span>
            <h1 className="font-playfair text-3xl font-light tracking-wide">GSTR-1 Export</h1>
            <p className="text-xs text-ivory/50 mt-1.5 max-w-xl">
              GST return filing preparation. Generates accountant-ready B2B/B2C reports from historical invoice data.
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-widest text-ivory/40">Business GSTIN</p>
            <p className="text-gold-primary text-sm font-bold tracking-widest">{BUSINESS_INFO.gstin}</p>
            <p className="text-[9px] text-ivory/30 mt-1">{BUSINESS_INFO.name}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/[0.01] border border-white/5 p-6 mb-8 relative">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-gold-primary/30" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-gold-primary/30" />

          <div className="flex items-center gap-4 mb-4">
            <span className="text-[10px] uppercase tracking-wider text-ivory/60">Period Type:</span>
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input type="radio" checked={!useCustomRange} onChange={() => setUseCustomRange(false)} className="accent-gold-primary" />
              <span>Month / Year</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input type="radio" checked={useCustomRange} onChange={() => setUseCustomRange(true)} className="accent-gold-primary" />
              <span>Custom Date Range</span>
            </label>
          </div>

          <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            {!useCustomRange ? (
              <>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-ivory/60 mb-2 flex items-center">
                    <Calendar size={10} className="mr-1.5" /> Month
                  </label>
                  <select value={selectedMonth} onChange={(e) => setSelectedMonth(+e.target.value)}
                    className="w-full bg-luxury-black border border-white/10 px-4 py-2.5 text-xs text-white focus:border-gold-primary/50 outline-none appearance-none">
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-ivory/60 mb-2">Year</label>
                  <select value={selectedYear} onChange={(e) => setSelectedYear(+e.target.value)}
                    className="w-full bg-luxury-black border border-white/10 px-4 py-2.5 text-xs text-white focus:border-gold-primary/50 outline-none appearance-none">
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-ivory/60 mb-2 flex items-center">
                <Building2 size={10} className="mr-1.5" /> Branch
              </label>
              <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full bg-luxury-black border border-white/10 px-4 py-2.5 text-xs text-white focus:border-gold-primary/50 outline-none appearance-none">
                <option value="All Branches">All Branches</option>
                {branches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className={!useCustomRange ? "" : "col-span-1"}>
              <button type="submit" disabled={reportLoading}
                className="w-full bg-gold-primary text-luxury-black text-[10px] font-bold uppercase tracking-widest px-4 py-3 hover:bg-gold-dark transition-colors disabled:opacity-50 flex items-center justify-center">
                {reportLoading ? <Loader2 size={12} className="animate-spin mr-2" /> : <ReceiptText size={12} className="mr-2" />}
                Generate GSTR-1
              </button>
            </div>
          </form>

          {/* Date range preview */}
          {startDate && endDate && (
            <p className="text-[10px] text-ivory/40 mt-3">
              Period: <span className="text-ivory/70">{startDate}</span> to <span className="text-ivory/70">{endDate}</span>
            </p>
          )}
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="bg-red-950/30 border border-red-500/30 p-5 mb-6">
            <div className="flex items-center mb-3">
              <AlertTriangle size={16} className="text-red-400 mr-2" />
              <p className="text-xs font-bold uppercase tracking-wider text-red-400">
                {validationErrors.length} Validation Error{validationErrors.length > 1 ? "s" : ""} — Export Blocked
              </p>
            </div>
            <ul className="space-y-1">
              {validationErrors.map((err, i) => (
                <li key={i} className="text-[11px] text-red-300 ">{err}</li>
              ))}
            </ul>
            <p className="text-[10px] text-red-400/70 mt-3">
              These invoices have total mismatches. Please review and correct before exporting.
            </p>
          </div>
        )}

        {/* Results */}
        {reportData && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Report ID + Export Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white/[0.02] border border-white/10 p-4 gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-[9px] uppercase tracking-widest text-ivory/40">Report ID</span>
                  <span className="text-gold-primary text-xs font-bold">{reportData.reportId}</span>
                  {validationErrors.length === 0 && (
                    <span className="flex items-center text-[9px] text-green-400 uppercase tracking-wider">
                      <CheckCircle2 size={10} className="mr-1" /> Validated
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-ivory/60">
                  {s.totalInvoices} invoices · {s.b2bCount} B2B · {s.b2cCount} B2C
                  · Period: {startDate} to {endDate}
                </p>
              </div>
              <div className="flex items-center gap-3 mt-4 sm:mt-0">
                <select value={gstFormat} onChange={e => setGstFormat(e.target.value as "combined" | "separated")} className="bg-luxury-black border border-white/10 px-3 py-2 text-[10px] uppercase tracking-wider text-white outline-none">
                  <option value="separated">Separated GST</option>
                  <option value="combined">Combined GST</option>
                </select>
                <button onClick={exportExcel} disabled={excelLoading || validationErrors.length > 0}
                  className="flex items-center text-[10px] font-bold uppercase tracking-wider border border-green-600 text-green-400 hover:bg-green-600/10 px-4 py-2.5 transition-colors disabled:opacity-40">
                  {excelLoading ? <Loader2 size={12} className="animate-spin mr-2" /> : <FileSpreadsheet size={12} className="mr-2" />}
                  GSTR1.xlsx
                </button>
                <button onClick={exportPDF} disabled={pdfLoading || validationErrors.length > 0}
                  className="flex items-center text-[10px] font-bold uppercase tracking-wider bg-red-700 hover:bg-red-800 text-white px-4 py-2.5 transition-colors disabled:opacity-40">
                  {pdfLoading ? <Loader2 size={12} className="animate-spin mr-2" /> : <Download size={12} className="mr-2" />}
                  GSTR1.pdf
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Sales", value: formatINR(s.totalSales), sub: "GST Inclusive", gold: false },
                { label: "Taxable Value", value: formatINR(s.totalTaxable), sub: "Before GST", gold: false },
                { label: "Total GST", value: formatINR(s.totalGst), sub: "CGST + SGST", gold: true },
                { label: "Total Invoices", value: s.totalInvoices.toString(), sub: `${s.b2bCount} B2B · ${s.b2cCount} B2C`, gold: false },
              ].map((card) => (
                <div key={card.label} className="bg-white/[0.01] border border-white/5 p-5 relative">
                  <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-gold-primary/30" />
                  <p className="text-[9px] uppercase tracking-widest text-ivory/50 mb-1">{card.label}</p>
                  <p className={`text-xl ${card.gold ? "text-gold-primary" : "text-white"}`}>{card.value}</p>
                  <p className="text-[9px] text-ivory/30 mt-1">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* CGST / SGST / IGST Row */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "CGST", value: formatINR(s.totalCgst) },
                { label: "SGST", value: formatINR(s.totalSgst) },
                { label: "IGST", value: formatINR(s.totalIgst) },
              ].map((card) => (
                <div key={card.label} className="bg-white/[0.005] border border-white/5 p-4">
                  <p className="text-[9px] uppercase tracking-widest text-ivory/40 mb-1">{card.label}</p>
                  <p className="text-lg text-white">{card.value}</p>
                </div>
              ))}
            </div>

            {/* Section 1: B2C */}
            <SectionCard
              title="Section 1 — B2C Sales Summary"
              icon={<ReceiptText size={14} />}
              expanded={expandedSections.b2c}
              onToggle={() => toggleSection("b2c")}
              count={reportData.b2cSales.length}
            >
              {reportData.b2cRateSummary.length === 0 ? (
                <EmptyNote>No B2C invoices found in this period.</EmptyNote>
              ) : (
                <TableWrapper>
                  <thead>
                    <tr className="text-left border-b border-white/5">
                      {["GST Rate", "Invoice Count", "Taxable Value", "GST Amount", "Total Value"].map((h) => (
                        <th key={h} className="text-[9px] uppercase tracking-wider text-ivory/50 pb-2 pr-4 font-normal">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.b2cRateSummary.map((r: any, i: number) => (
                      <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 pr-4 text-xs text-gold-primary">{r.gstRate}</td>
                        <td className="py-2.5 pr-4 text-xs">{r.invoiceCount}</td>
                        <td className="py-2.5 pr-4 text-xs ">{formatINR(r.taxableValue)}</td>
                        <td className="py-2.5 pr-4 text-xs ">{formatINR(r.gstAmount)}</td>
                        <td className="py-2.5 text-xs text-gold-primary/80">{formatINR(r.totalValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrapper>
              )}
            </SectionCard>

            {/* Section 2: B2B */}
            <SectionCard
              title="Section 2 — B2B Sales (with GSTIN)"
              icon={<Hash size={14} />}
              expanded={expandedSections.b2b}
              onToggle={() => toggleSection("b2b")}
              count={reportData.b2bSales.length}
            >
              {reportData.b2bSales.length === 0 ? (
                <EmptyNote>No B2B invoices found. Customers with GSTIN will appear here.</EmptyNote>
              ) : (
                <TableWrapper>
                  <thead>
                    <tr className="text-left border-b border-white/5">
                      {["Date", "Invoice #", "Customer", "GSTIN", "Branch", "Taxable", "CGST", "SGST", "Total"].map((h) => (
                        <th key={h} className="text-[9px] uppercase tracking-wider text-ivory/50 pb-2 pr-4 font-normal">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.b2bSales.map((inv: any, i: number) => (
                      <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="py-2 pr-4 text-[11px]">{formatDate(inv.invoiceDate)}</td>
                        <td className="py-2 pr-4 text-[11px] text-ivory/80">{inv.invoiceNumber}</td>
                        <td className="py-2 pr-4 text-[11px]">{inv.customerName}</td>
                        <td className="py-2 pr-4 text-[11px] text-gold-primary">{inv.customerGstin}</td>
                        <td className="py-2 pr-4 text-[11px]">{inv.branch}</td>
                        <td className="py-2 pr-4 text-[11px] ">{formatINR(inv.taxableValue)}</td>
                        <td className="py-2 pr-4 text-[11px] ">{formatINR(inv.cgst)}</td>
                        <td className="py-2 pr-4 text-[11px] ">{formatINR(inv.sgst)}</td>
                        <td className="py-2 text-[11px] text-gold-primary/80">{formatINR(inv.totalValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrapper>
              )}
            </SectionCard>

            {/* Section 3: HSN */}
            <SectionCard
              title="Section 3 — HSN/SAC Summary"
              icon={<FileText size={14} />}
              expanded={expandedSections.hsn}
              onToggle={() => toggleSection("hsn")}
              count={reportData.hsnSummary.length}
            >
              <TableWrapper>
                <thead>
                  <tr className="text-left border-b border-white/5">
                    {["HSN/SAC", "Description", "Qty", "Taxable", "Rate", "CGST", "SGST", "IGST", "Total"].map((h) => (
                      <th key={h} className="text-[9px] uppercase tracking-wider text-ivory/50 pb-2 pr-4 font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.hsnSummary.map((h: any, i: number) => (
                    <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="py-2 pr-4 text-[11px] text-gold-primary">{h.hsnCode}</td>
                      <td className="py-2 pr-4 text-[11px]">{h.description}</td>
                      <td className="py-2 pr-4 text-[11px]">{h.quantity}</td>
                      <td className="py-2 pr-4 text-[11px] ">{formatINR(h.taxableValue)}</td>
                      <td className="py-2 pr-4 text-[11px] text-gold-primary">{h.gstRate}</td>
                      <td className="py-2 pr-4 text-[11px] ">{formatINR(h.cgst)}</td>
                      <td className="py-2 pr-4 text-[11px] ">{formatINR(h.sgst)}</td>
                      <td className="py-2 pr-4 text-[11px] ">{formatINR(h.igst)}</td>
                      <td className="py-2 text-[11px] text-gold-primary/80">{formatINR(h.totalValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            </SectionCard>

            {/* Section 4: GST Rate */}
            <SectionCard
              title="Section 4 — GST Rate Summary"
              icon={<Hash size={14} />}
              expanded={expandedSections.gstRate}
              onToggle={() => toggleSection("gstRate")}
              count={reportData.gstRateSummary.length}
            >
              <TableWrapper>
                <thead>
                  <tr className="text-left border-b border-white/5">
                    {["Rate", "Invoice Count", "Taxable Value", "CGST", "SGST", "IGST", "GST Collected"].map((h) => (
                      <th key={h} className="text-[9px] uppercase tracking-wider text-ivory/50 pb-2 pr-4 font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.gstRateSummary.map((g: any, i: number) => (
                    <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 pr-4 text-xs text-gold-primary font-bold">{g.gstRate}</td>
                      <td className="py-2.5 pr-4 text-xs">{g.invoiceCount}</td>
                      <td className="py-2.5 pr-4 text-xs ">{formatINR(g.taxableValue)}</td>
                      <td className="py-2.5 pr-4 text-xs ">{formatINR(g.cgst)}</td>
                      <td className="py-2.5 pr-4 text-xs ">{formatINR(g.sgst)}</td>
                      <td className="py-2.5 pr-4 text-xs ">{formatINR(g.igst)}</td>
                      <td className="py-2.5 text-xs text-gold-primary/80">{formatINR(g.gstCollected)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            </SectionCard>

            {/* Section 5: Invoice Register */}
            <SectionCard
              title="Section 5 — Invoice Register"
              icon={<ReceiptText size={14} />}
              expanded={expandedSections.register}
              onToggle={() => toggleSection("register")}
              count={reportData.invoiceRegister.length}
            >
              <TableWrapper>
                <thead>
                  <tr className="text-left border-b border-white/5">
                    {["Invoice #", "Date", "Customer", "Branch", "Rate", "Taxable", "GST", "Total"].map((h) => (
                      <th key={h} className="text-[9px] uppercase tracking-wider text-ivory/50 pb-2 pr-4 font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.invoiceRegister.map((inv: any, i: number) => (
                    <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="py-2 pr-4 text-[11px] text-ivory/80">{inv.invoiceNumber}</td>
                      <td className="py-2 pr-4 text-[11px]">{formatDate(inv.invoiceDate)}</td>
                      <td className="py-2 pr-4 text-[11px]">{inv.customerName}</td>
                      <td className="py-2 pr-4 text-[11px]">{inv.branch}</td>
                      <td className="py-2 pr-4 text-[11px] text-gold-primary">{inv.gstRate}</td>
                      <td className="py-2 pr-4 text-[11px] ">{formatINR(inv.taxableValue)}</td>
                      <td className="py-2 pr-4 text-[11px] ">{formatINR(inv.gstAmount)}</td>
                      <td className="py-2 text-[11px] text-gold-primary/80">{formatINR(inv.totalValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            </SectionCard>

          </div>
        )}
      </div>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ title, icon, expanded, onToggle, count, children }: {
  title: string; icon: React.ReactNode; expanded: boolean;
  onToggle: () => void; count: number; children: React.ReactNode;
}) {
  return (
    <div className="bg-white/[0.01] border border-white/5">
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-3">
          <span className="text-gold-primary/70">{icon}</span>
          <span className="text-xs font-bold uppercase tracking-widest text-white">{title}</span>
          <span className="text-[9px] bg-white/10 text-ivory/60 px-2 py-0.5 rounded-sm">{count}</span>
        </div>
        {expanded
          ? <ChevronUp size={14} className="text-ivory/40" />
          : <ChevronDown size={14} className="text-ivory/40" />}
      </button>
      {expanded && <div className="px-5 pb-5 overflow-x-auto">{children}</div>}
    </div>
  );
}

function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <table className="w-full min-w-[600px]">
      {children}
    </table>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-8 text-center">
      <p className="text-xs text-ivory/40 italic">{children}</p>
    </div>
  );
}
