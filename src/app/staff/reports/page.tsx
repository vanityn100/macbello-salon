"use client";

import { useState, useEffect } from "react";
import { supabaseStaffClient } from "@/lib/supabase";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import TransactionReportTable from "@/components/admin/TransactionReportTable";
import { formatINR, formatDate, exportNumber } from "@/lib/format";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export default function StaffTransactionReport() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [staffEmail, setStaffEmail] = useState<string | null>(null);
  const [staffBranch, setStaffBranch] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  // Set initial date range (default to current month)
  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setStartDate(firstDay.toISOString().slice(0, 10));
    setEndDate(today.toISOString().slice(0, 10));

    supabaseStaffClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionToken(session.access_token);
        setStaffEmail(session.user?.email || null);
        setStaffBranch(session.user?.app_metadata?.branch || "Unknown Branch");
      }
    });

    const { data: { subscription } } = supabaseStaffClient.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSessionToken(session.access_token);
        setStaffEmail(session.user?.email || null);
        setStaffBranch(session.user?.app_metadata?.branch || "Unknown Branch");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken) return;

    setReportLoading(true);
    setReportData(null);

    try {
      const res = await fetch(`/api/billing/admin?action=get_admin_reports&startDate=${startDate}&endDate=${endDate}&branch=${encodeURIComponent(staffBranch || "All Branches")}`, {
        headers: { "Authorization": `Bearer ${sessionToken}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.report.invoices && data.report.invoices.length > 5000) {
          const proceed = window.confirm(`Warning: You are about to load ${data.report.invoices.length} transactions into the browser. This may slow down your device. Do you want to continue?`);
          if (!proceed) {
            setReportData(null);
            return;
          }
        }
        setReportData(data.report);
      } else {
        alert(data.error || "Failed to query transactions.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Network error or something went wrong. Please try again.");
    } finally {
      setReportLoading(false);
    }
  };

  const exportPDFReport = async (filteredInvoices?: any[], metadata?: any) => {
    if (!reportData) return;
    const invoicesToExport = filteredInvoices || reportData.invoices;
    const filtersStr = metadata?.filters || "None";
    setPdfLoading(true);

    try {
      const doc = new jsPDF("p", "mm", "a4");
      
      // Header
      doc.setFillColor(30, 30, 30);
      doc.rect(0, 0, 210, 32, "F");
      
      doc.setTextColor(212, 175, 55); // Gold
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("MacBello Family Salon", 14, 14);
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("GSTIN: 32AABCM1029F1Z4 | Phone: +91 95625 14002", 14, 20);
      doc.text("Email: accounts@macbello.com", 14, 25);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("TRANSACTION ACCOUNTING REPORT", 200, 14, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Branch: ${staffBranch}`, 200, 20, { align: "right" });
      doc.text(`Period: ${startDate} to ${endDate}`, 200, 25, { align: "right" });
      doc.text(`Filters: ${filtersStr}`, 200, 30, { align: "right" });

      if (invoicesToExport.length === 0) {
        doc.setTextColor(0, 0, 0);
        doc.text("No transactions recorded for the selected period and branch.", 14, 45);
      } else {
        const body: any[] = [];
        let totalRev = 0;
        let totalTax = 0;
        
        invoicesToExport.forEach((inv: any) => {
          const dateStr = formatDate(inv.created_at);
          const customerName = inv.customers?.name || "Anonymous";
          const grand = parseFloat(inv.grand_total as any) || 0;
          const tax = parseFloat(inv.total_tax as any) || 0;
          totalRev += grand;
          totalTax += tax;
          
          body.push([
            dateStr,
            inv.invoice_number,
            customerName,
            inv.branch || "—",
            formatINR(tax),
            formatINR(grand)
          ]);
        });

        autoTable(doc, {
          startY: 40,
          head: [["Date", "Invoice #", "Customer", "Branch", "GST", "Total"]],
          body,
          theme: "grid",
          headStyles: { fillColor: [30, 30, 30], textColor: [212, 175, 55], fontStyle: "bold" },
          styles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [250, 250, 250] },
        });

        // @ts-ignore
        const finalY = (doc as any).lastAutoTable?.finalY || 40;
        
        doc.setTextColor(30, 30, 30);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(`Total Invoices: ${invoicesToExport.length}`, 14, finalY + 10);
        doc.text(`Total GST: ${formatINR(totalTax)}`, 14, finalY + 15);
        doc.text(`Total Revenue: ${formatINR(totalRev)}`, 14, finalY + 20);
      }

      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated By: ${staffEmail} on ${new Date().toLocaleString()}`, 14, 290);
      doc.text(`Generated from Macbello Salon Management System`, 200, 290, { align: "right" });

      const fileName = staffBranch
        ? `Macbello_${staffBranch.replace(/\s+/g, "_")}_Transactions_${startDate}_to_${endDate}.pdf`
        : `Macbello_Transactions_${startDate}_to_${endDate}.pdf`;

      doc.save(fileName);
    } catch (err: any) {
      console.error(err);
      alert("Export generation failed. Please try again later.");
    } finally {
      setPdfLoading(false);
    }
  };

  const exportExcelReport = async (filteredInvoices?: any[], metadata?: any) => {
    if (!reportData) return;
    const invoicesToExport = filteredInvoices || reportData.invoices;
    const filtersStr = metadata?.filters || "None";
    
    try {
      let totalRev = 0;
      let totalTax = 0;
      const rows: any[] = [];
      
      invoicesToExport.forEach((inv: any) => {
        if (inv.status !== 'archived' && inv.status !== 'cancelled') {
          totalRev += parseFloat(inv.grand_total as any) || 0;
          totalTax += parseFloat(inv.total_tax as any) || 0;
        }
        
        const dateStr = formatDate(inv.created_at);
        const customerName = inv.customers?.name || "Anonymous";
        const grand = parseFloat(inv.grand_total as any) || 0;
        const invDiscount = parseFloat(inv.discount as any) || 0;
        const loyalty = parseFloat(inv.points_redeemed as any) || 0;
        
        const totalLineInclusive = (inv.invoice_items as any[]).reduce(
          (s: number, it: any) => s + (parseFloat(it.line_total) || 0), 0
        );
        const proportion = (totalLineInclusive > 0 && invDiscount > 0)
          ? 1 - (invDiscount / totalLineInclusive)
          : 1;

        inv.invoice_items.forEach((item: any, itemIdx: number) => {
          const lineTotal = parseFloat(item.line_total) || 0;
          const taxRate   = parseFloat(item.tax_rate)   || 0;
          const discountedInclusive = lineTotal * proportion;
          const itemBase  = taxRate > 0 ? discountedInclusive / (1 + taxRate) : discountedInclusive;
          const itemGst   = discountedInclusive - itemBase;
          const itemDiscount = lineTotal * (1 - proportion);

          rows.push({
            "Date":                   dateStr,
            "Invoice #":              inv.invoice_number,
            "Customer":               customerName,
            "Branch":                 inv.branch || "Global",
            "Item Name":              item.item_name,
            "Category":               item.category,
            "Quantity":               exportNumber(item.quantity),
            "Unit Price (GST Incl.)": exportNumber(item.unit_price),
            "Line Total (GST Incl.)": exportNumber(lineTotal),
            "Item Discount":          exportNumber(itemDiscount),
            "Loyalty Redemption":     itemIdx === 0 ? exportNumber(loyalty) : 0,
            "Taxable Amount":         exportNumber(itemBase),
            "GST Amount":             exportNumber(itemGst),
            "GST Incl. Item Total":   exportNumber(discountedInclusive),
            "Invoice Grand Total":    itemIdx === 0 ? exportNumber(grand) : 0,
            "Status":                 inv.status
          });
        });
      });

      const metadataRows = [
        { "Date": "Report Name", "Invoice #": "Transaction Accounting Report" },
        { "Date": "Generated By", "Invoice #": staffEmail },
        { "Date": "Generated Date & Time", "Invoice #": new Date().toLocaleString() },
        { "Date": "Selected Branch", "Invoice #": staffBranch },
        { "Date": "Date Range", "Invoice #": `${startDate} to ${endDate}` },
        { "Date": "Applied Filters", "Invoice #": filtersStr },
        { "Date": "Total Transactions", "Invoice #": invoicesToExport.length },
        { "Date": "Total Revenue", "Invoice #": totalRev },
        { "Date": "Total Tax", "Invoice #": totalTax },
        {}, 
      ];

      const finalRows = [...metadataRows, ...rows];

      const worksheet = XLSX.utils.json_to_sheet(finalRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
      
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const data = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
      
      const fileName = staffBranch 
        ? `Macbello_${staffBranch.replace(/\s+/g, "_")}_Transactions_${startDate}_to_${endDate}.xlsx`
        : `Macbello_Transactions_${startDate}_to_${endDate}.xlsx`;
        
      saveAs(data, fileName);
    } catch (err: any) {
      console.error(err);
      alert("Export generation failed. Please try again later.");
    }
  };

  if (!sessionToken) {
    return (
      <div className="min-h-screen bg-luxury-black text-ivory font-sans p-4 flex items-center justify-center">
        <Loader2 className="animate-spin text-gold-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-luxury-black text-ivory font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border border-white/5 bg-white/[0.01] p-6 md:p-8 relative gap-6">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-gold-primary/25" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-gold-primary/25" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-gold-primary/25" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-gold-primary/25" />

          <div>
            <span className="text-[10px] text-gold-primary tracking-[0.3em] uppercase block mb-2">
              Authorized Access
            </span>
            <h1 className="font-playfair text-2xl md:text-3xl font-light tracking-wide">
              Transaction Report
            </h1>
            <p className="text-[10px] text-ivory/40 font-light mt-1 uppercase tracking-wider">
              Assigned Branch: <span className="text-gold-primary/80">{staffBranch}</span>
            </p>
          </div>

          <div className="flex items-center">
            <Link
              href="/staff"
              className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.15em] border border-white/10 hover:border-gold-primary/50 hover:text-gold-primary px-4 py-2 bg-white/5 transition-all duration-300 rounded-none"
            >
              <ArrowLeft size={12} />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </div>

        {/* Builder Panel */}
        <div className="border border-white/5 bg-white/[0.01] p-8 relative">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-gold-primary/25" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-gold-primary/25" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-gold-primary/25" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-gold-primary/25" />

          <h2 className="font-playfair text-lg text-white font-medium tracking-wide mb-6 flex items-center">
            <span>Query Transactions</span>
          </h2>

          <form onSubmit={handleGenerateReport} className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="flex flex-col">
              <label className="text-[9px] uppercase tracking-wider text-ivory/40 mb-1.5">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-luxury-black border border-white/10 px-4 py-2.5 text-xs text-white rounded-none focus:outline-none focus:border-gold-primary/50"
                required
              />
            </div>

            <div className="flex flex-col">
              <label className="text-[9px] uppercase tracking-wider text-ivory/40 mb-1.5">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-luxury-black border border-white/10 px-4 py-2.5 text-xs text-white rounded-none focus:outline-none focus:border-gold-primary/50"
                required
              />
            </div>

            <div className="md:col-span-2 pt-2">
              <button
                type="submit"
                disabled={reportLoading || pdfLoading}
                className="w-full text-center text-xs uppercase tracking-[0.2em] bg-gold-primary hover:bg-gold-dark text-luxury-black font-semibold py-3.5 transition-colors cursor-pointer flex items-center justify-center"
              >
                {reportLoading ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
                <span>Build Report</span>
              </button>
            </div>
          </form>

          {reportData ? (
            <div className="border-t border-white/5 pt-6 flex flex-col items-center justify-center">
              <div className="w-full mb-8">
                <TransactionReportTable 
                  invoices={reportData.invoices} 
                  onExportPDF={exportPDFReport} 
                  onExportExcel={exportExcelReport}
                  role="staff"
                />
              </div>
            </div>
          ) : (
            <div className="border-t border-white/5 pt-8 text-center text-xs text-ivory/30 italic">
              Select date ranges to view and export your branch's transaction report.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
