"use client";

import { useState, useEffect } from "react";
import { supabaseAdminClient } from "@/lib/supabase";
import { 
  ArrowLeft, Search, Plus, FileSpreadsheet, Loader2, Download, PackageOpen
} from "lucide-react";
import Link from "next/link";
import { formatINR, formatDate } from "@/lib/format";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface StockPurchase {
  id: string;
  purchase_number: string;
  invoice_number: string;
  supplier_name: string;
  purchase_date: string;
  branch: string;
  grand_total: number;
  stock_purchase_items: any[];
}

export default function StockPurchasesPage() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<StockPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBranch, setFilterBranch] = useState("All Branches");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    supabaseAdminClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionToken(session.access_token);
        fetchPurchases(session.access_token);
      } else {
        setLoading(false);
        setError("Unauthorized access.");
      }
    });
  }, []);

  const fetchPurchases = async (token: string) => {
    try {
      const res = await fetch("/api/inventory/purchases?action=list", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPurchases(data.purchases || []);
      } else {
        setError(data.error || "Failed to load purchases.");
      }
    } catch (err) {
      setError("Network error. Could not fetch purchases.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    const dataToExport = purchases.map(p => ({
      "Date": formatDate(p.purchase_date),
      "Purchase No": p.purchase_number,
      "Supplier": p.supplier_name,
      "Invoice No": p.invoice_number || "-",
      "Branch": p.branch,
      "Total Items": p.stock_purchase_items.length,
      "Grand Total (INR)": p.grand_total
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Purchases");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const dataBlob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(dataBlob, `Stock_Purchases_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleExportPDF = (purchase: StockPurchase) => {
    const doc = new jsPDF("p", "mm", "a4");
    let y = 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("PURCHASE INVOICE RECORD", 105, y, { align: "center" });

    y += 15;
    doc.setFontSize(10);
    doc.text(`Purchase No: ${purchase.purchase_number}`, 20, y);
    doc.text(`Date: ${formatDate(purchase.purchase_date)}`, 140, y);
    
    y += 8;
    doc.text(`Supplier: ${purchase.supplier_name}`, 20, y);
    if (purchase.invoice_number) doc.text(`Invoice No: ${purchase.invoice_number}`, 140, y);

    y += 8;
    doc.text(`Branch Receiving: ${purchase.branch}`, 20, y);

    y += 15;
    const tableData = purchase.stock_purchase_items.map((item: any) => [
      item.product_id.substring(0, 8), 
      item.quantity,
      `INR ${item.purchase_rate.toFixed(2)}`,
      `${item.discount_percent}%`,
      `${item.gst_percent}%`,
      `INR ${item.line_total.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Item Code", "Qty", "Rate", "Disc %", "GST %", "Line Total"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [40, 40, 40] }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Grand Total: INR ${purchase.grand_total.toFixed(2)}`, 140, finalY);

    doc.save(`Purchase_${purchase.purchase_number}.pdf`);
  };

  const handleExportPDFReport = () => {
    const doc = new jsPDF("l", "mm", "a4");
    let y = 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("STOCK PURCHASES REPORT", 148, y, { align: "center" });

    y += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const dateStr = (startDate && endDate) ? `From: ${startDate} To: ${endDate}` : `Generated: ${new Date().toLocaleDateString()}`;
    doc.text(dateStr, 148, y, { align: "center" });

    y += 15;
    const tableData = filteredPurchases.map(p => [
      formatDate(p.purchase_date),
      p.purchase_number,
      p.supplier_name,
      p.invoice_number || "-",
      p.branch,
      p.stock_purchase_items.length.toString(),
      p.grand_total.toFixed(2)
    ]);

    const totalAmount = filteredPurchases.reduce((sum, p) => sum + p.grand_total, 0);
    tableData.push(["", "", "", "", "", "TOTAL", totalAmount.toFixed(2)]);

    autoTable(doc, {
      startY: y,
      head: [["Date", "Purchase No", "Supplier", "Invoice No", "Branch", "Items", "Grand Total"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [40, 40, 40] },
      columnStyles: { 6: { halign: 'right' }, 5: { halign: 'right' } }
    });

    doc.save(`Stock_Purchases_Report_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const filteredPurchases = purchases.filter(p => {
    const matchesSearch = p.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.purchase_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.invoice_number && p.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesBranch = filterBranch === "All Branches" || p.branch === filterBranch;

    let matchesDate = true;
    if (startDate && endDate) {
      matchesDate = p.purchase_date >= startDate && p.purchase_date <= endDate;
    } else if (startDate) {
      matchesDate = p.purchase_date >= startDate;
    } else if (endDate) {
      matchesDate = p.purchase_date <= endDate;
    }

    return matchesSearch && matchesBranch && matchesDate;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/admin" className="p-2 hover:bg-white/5 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-light tracking-wide uppercase">Stock Purchases</h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Inventory Management</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Link href="/admin/inventory/low-stock" className="flex items-center space-x-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] uppercase tracking-widest transition-all">
              <PackageOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Low Stock</span>
            </Link>
            <button onClick={handleExportPDFReport} className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-[10px] uppercase tracking-widest transition-all border border-white/10">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PDF Report</span>
            </button>
            <button onClick={handleExportExcel} className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-[10px] uppercase tracking-widest transition-all border border-white/10">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Excel Report</span>
            </button>
            <Link href="/admin/inventory/purchases/new" className="flex items-center space-x-2 px-4 py-2 bg-gold-primary/10 hover:bg-gold-primary/20 text-gold-primary border border-gold-primary/30 text-[10px] uppercase tracking-widest transition-all">
              <Plus className="w-3.5 h-3.5" />
              <span>New Entry</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="p-4 mb-6 bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search Supplier, Invoice or PO Number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-none pl-10 pr-4 py-2.5 text-sm focus:border-gold-primary/50 focus:ring-1 focus:ring-gold-primary/50 transition-all outline-none"
            />
          </div>
          <div>
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-none px-4 py-2.5 text-sm focus:border-gold-primary/50 focus:ring-1 focus:ring-gold-primary/50 transition-all outline-none appearance-none"
            >
              <option value="All" className="bg-black">All Branches</option>
              <option value="Kaduthuruthy" className="bg-black">Kaduthuruthy</option>
              <option value="Ettumanoor" className="bg-black">Ettumanoor</option>
              <option value="Peruva" className="bg-black">Peruva</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-[10px] uppercase tracking-widest bg-white/5">
                <th className="px-4 py-4 font-normal">Date</th>
                <th className="px-4 py-4 font-normal">Purchase No</th>
                <th className="px-4 py-4 font-normal">Supplier</th>
                <th className="px-4 py-4 font-normal">Invoice No</th>
                <th className="px-4 py-4 font-normal">Branch</th>
                <th className="px-4 py-4 font-normal text-right">Items</th>
                <th className="px-4 py-4 font-normal text-right">Grand Total</th>
                <th className="px-4 py-4 font-normal text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    <PackageOpen className="w-8 h-8 mx-auto mb-3 opacity-20" />
                    <p>No stock purchases found.</p>
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-4 text-gray-300">{formatDate(p.purchase_date)}</td>
                    <td className="px-4 py-4 font-mono text-xs text-gold-primary">{p.purchase_number}</td>
                    <td className="px-4 py-4">{p.supplier_name}</td>
                    <td className="px-4 py-4 text-gray-400">{p.invoice_number || "-"}</td>
                    <td className="px-4 py-4 text-gray-300">{p.branch}</td>
                    <td className="px-4 py-4 text-right">{p.stock_purchase_items.length}</td>
                    <td className="px-4 py-4 text-right text-gold-primary">{formatINR(p.grand_total)}</td>
                    <td className="px-4 py-4 text-center">
                      <button 
                        onClick={() => handleExportPDF(p)}
                        className="text-[10px] uppercase tracking-widest text-gold-primary hover:text-white transition-colors border border-gold-primary/30 hover:border-white/50 px-3 py-1 bg-gold-primary/5"
                      >
                        PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
