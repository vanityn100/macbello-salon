"use client";

import { useState, useEffect, useMemo } from "react";
import { supabaseAdminClient } from "@/lib/supabase";
import { 
  ArrowLeft, Download, Plus, Search, Loader2, Save, Trash2, Edit2, Check, X
} from "lucide-react";
import Link from "next/link";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { formatINR, formatDate } from "@/lib/format";

interface StockEntry {
  id: string;
  date: string;
  seller: string;
  invoice_no: string;
  description_of_goods: string;
  mrp: number;
  quantity: number;
  rate: number;
  total: number;
  discount_percent: number;
  amount: number;
  gst_percent: number;
  gst_amount: number;
  grand_total: number;
  branch: string;
}

export default function PurchaseOfStocksPage() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBranch, setFilterBranch] = useState("All");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<StockEntry>>({});

  useEffect(() => {
    supabaseAdminClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionToken(session.access_token);
        fetchEntries(session.access_token);
      } else {
        setLoading(false);
      }
    });
  }, [startDate, endDate]);

  const fetchEntries = async (token: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventory/purchase-of-stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "fetch", startDate, endDate }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEntries(data.data);
      } else {
        setError(data.error || "Failed to load records.");
      }
    } catch (err: any) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const matchSearch = e.seller.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          e.description_of_goods.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (e.invoice_no && e.invoice_no.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchBranch = filterBranch === "All" || e.branch === filterBranch;
      return matchSearch && matchBranch;
    });
  }, [entries, searchTerm, filterBranch]);

  // Dashboard Stats
  const stats = useMemo(() => {
    let totalPurchases = 0;
    let totalGST = 0;
    let totalQty = 0;
    let totalValue = 0;

    filteredEntries.forEach(e => {
      totalPurchases += 1;
      totalGST += Number(e.gst_amount || 0);
      totalQty += Number(e.quantity || 0);
      totalValue += Number(e.grand_total || 0);
    });

    return { totalPurchases, totalGST, totalQty, totalValue };
  }, [filteredEntries]);

  // Handlers
  const handleEditClick = (entry: StockEntry) => {
    setEditingId(entry.id);
    setEditForm({ ...entry });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    // If it was a new row (id starting with 'new-'), remove it
    setEntries(prev => prev.filter(e => !e.id.startsWith('new-')));
  };

  const handleFormChange = (field: keyof StockEntry, value: string | number) => {
    setEditForm(prev => {
      const updated = { ...prev, [field]: value };

      // Auto Calculations
      const qty = Number(updated.quantity || 0);
      const rate = Number(updated.rate || 0);
      const discPercent = Number(updated.discount_percent || 0);
      const gstPercent = Number(updated.gst_percent || 0);

      const total = qty * rate;
      const amount = total - (total * (discPercent / 100));
      const gstAmt = amount * (gstPercent / 100);
      const grandTotal = amount + gstAmt;

      updated.total = Number(total.toFixed(2));
      updated.amount = Number(amount.toFixed(2));
      updated.gst_amount = Number(gstAmt.toFixed(2));
      updated.grand_total = Number(grandTotal.toFixed(2));

      return updated;
    });
  };

  const handleSave = async () => {
    if (!sessionToken) return;
    
    const isNew = editingId?.startsWith('new-');
    const finalData = { ...editForm };
    if (isNew) {
      delete finalData.id; // Let db generate UUID
    }

    try {
      const res = await fetch("/api/inventory/purchase-of-stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({
          action: isNew ? "create" : "update",
          id: isNew ? undefined : editingId,
          rowData: finalData
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEditingId(null);
        fetchEntries(sessionToken);
      } else {
        alert(data.error || "Failed to save.");
      }
    } catch (err) {
      alert("Network error.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!sessionToken || !confirm("Are you sure you want to delete this row?")) return;
    try {
      const res = await fetch("/api/inventory/purchase-of-stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ action: "delete", id }),
      });
      if (res.ok) {
        setEntries(prev => prev.filter(e => e.id !== id));
      }
    } catch (err) {}
  };

  const handleAddRow = () => {
    const newId = 'new-' + Date.now();
    const newRow: StockEntry = {
      id: newId,
      date: new Date().toISOString().slice(0, 10),
      seller: "",
      invoice_no: "",
      description_of_goods: "",
      mrp: 0,
      quantity: 1,
      rate: 0,
      total: 0,
      discount_percent: 0,
      amount: 0,
      gst_percent: 18,
      gst_amount: 0,
      grand_total: 0,
      branch: filterBranch === "All" ? "Historical Import" : filterBranch
    };
    setEntries([newRow, ...entries]);
    setEditingId(newId);
    setEditForm(newRow);
  };

  const handleExportExcel = () => {
    const wsData = filteredEntries.map(e => ({
      "Date": formatDate(e.date),
      "SELLER": e.seller,
      "Invoice No": e.invoice_no,
      "Description Of Goods": e.description_of_goods,
      "MRP": e.mrp,
      "Quantity": e.quantity,
      "Rate": e.rate,
      "Total": e.total,
      "Disc%": e.discount_percent,
      "Amount": e.amount,
      "GST %": e.gst_percent,
      "GST Amount": e.gst_amount,
      "Grand Total": e.grand_total,
      "Branch": e.branch
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Purchase Of Stocks");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([excelBuffer], { type: "application/octet-stream" }), `Purchase_Of_Stocks_${startDate}_to_${endDate}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF("landscape");
    doc.setFontSize(18);
    doc.text("Purchase Of Stocks Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 28);
    doc.text(`Branch: ${filterBranch}`, 14, 34);

    const tableData = filteredEntries.map(e => [
      formatDate(e.date), e.seller, e.invoice_no, e.description_of_goods, e.quantity, 
      e.rate.toFixed(2), e.discount_percent + "%", e.amount.toFixed(2), 
      e.gst_amount.toFixed(2), e.grand_total.toFixed(2), e.branch
    ]);

    autoTable(doc, {
      startY: 40,
      head: [["Date", "Seller", "Invoice", "Product", "Qty", "Rate", "Disc%", "Amount", "GST", "Total", "Branch"]],
      body: tableData,
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [40, 40, 40] }
    });
    doc.save(`Purchase_Of_Stocks_${startDate}_to_${endDate}.pdf`);
  };

  if (loading && entries.length === 0) {
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
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/admin" className="p-2 hover:bg-white/5 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-light tracking-wide uppercase">Purchase Of Stocks</h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Accounting Module</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={handleExportExcel} className="flex items-center space-x-2 px-4 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 text-[10px] uppercase tracking-widest transition-all">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </button>
            <button onClick={handleExportPDF} className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-[10px] uppercase tracking-widest transition-all">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PDF</span>
            </button>
            <Link href="/admin/purchase-of-stocks/new" className="flex items-center space-x-2 px-4 py-2 bg-gold-primary/10 hover:bg-gold-primary/20 text-gold-primary border border-gold-primary/30 text-[10px] uppercase tracking-widest transition-all">
              <Plus className="w-3.5 h-3.5" />
              <span>New Entry</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Dashboard Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-none">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Total Purchases</p>
            <p className="text-2xl font-light text-white">{stats.totalPurchases}</p>
          </div>
          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-none">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Total Qty</p>
            <p className="text-2xl font-light text-white">{stats.totalQty}</p>
          </div>
          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-none">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Total GST Paid</p>
            <p className="text-2xl font-light text-gold-primary">{formatINR(stats.totalGST)}</p>
          </div>
          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-none">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Total Value</p>
            <p className="text-2xl font-light text-gold-primary">{formatINR(stats.totalValue)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search Product, Supplier, or Invoice..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-none pl-10 pr-4 py-2 text-sm focus:border-gold-primary/50 focus:ring-1 focus:ring-gold-primary/50 transition-all outline-none"
            />
          </div>
          <div className="flex space-x-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-none px-3 py-2 text-sm focus:border-gold-primary/50 outline-none"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-none px-3 py-2 text-sm focus:border-gold-primary/50 outline-none"
            />
          </div>
          <div>
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-none px-4 py-2 text-sm focus:border-gold-primary/50 focus:ring-1 focus:ring-gold-primary/50 transition-all outline-none appearance-none"
            >
              <option value="All" className="bg-black">All Branches</option>
              <option value="Kaduthuruthy" className="bg-black">Kaduthuruthy</option>
              <option value="Ettumanoor" className="bg-black">Ettumanoor</option>
              <option value="Peruva" className="bg-black">Peruva</option>
              <option value="Historical Import" className="bg-black">Historical Import</option>
            </select>
          </div>
        </div>

        {/* Data Grid */}
        <div className="overflow-x-auto bg-white/[0.01] border border-white/5 rounded-none pb-32">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-[10px] uppercase tracking-widest bg-white/5">
                <th className="px-3 py-3 font-normal">Date</th>
                <th className="px-3 py-3 font-normal">Seller</th>
                <th className="px-3 py-3 font-normal">Invoice No</th>
                <th className="px-3 py-3 font-normal">Description</th>
                <th className="px-3 py-3 font-normal">Branch</th>
                <th className="px-3 py-3 font-normal text-right">MRP</th>
                <th className="px-3 py-3 font-normal text-right">Qty</th>
                <th className="px-3 py-3 font-normal text-right">Rate</th>
                <th className="px-3 py-3 font-normal text-right">Total</th>
                <th className="px-3 py-3 font-normal text-right">Disc%</th>
                <th className="px-3 py-3 font-normal text-right">Amount</th>
                <th className="px-3 py-3 font-normal text-right">GST%</th>
                <th className="px-3 py-3 font-normal text-right">Grand Total</th>
                <th className="px-3 py-3 font-normal text-center sticky right-0 bg-[#0a0a0a] border-l border-white/5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-gray-500">
                    No purchase entries found.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((e) => {
                  const isEditing = editingId === e.id;
                  const data = isEditing ? editForm : e;

                  return (
                    <tr key={e.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input type="date" value={data.date || ""} onChange={(ev) => handleFormChange("date", ev.target.value)} className="w-24 bg-black border border-white/20 p-1 text-xs outline-none focus:border-gold-primary" />
                        ) : formatDate(e.date)}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input type="text" value={data.seller || ""} onChange={(ev) => handleFormChange("seller", ev.target.value)} className="w-28 bg-black border border-white/20 p-1 text-xs outline-none focus:border-gold-primary" />
                        ) : e.seller}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input type="text" value={data.invoice_no || ""} onChange={(ev) => handleFormChange("invoice_no", ev.target.value)} className="w-20 bg-black border border-white/20 p-1 text-xs outline-none focus:border-gold-primary" />
                        ) : <span className="font-mono text-[10px]">{e.invoice_no || "-"}</span>}
                      </td>
                      <td className="px-3 py-2 max-w-[200px] truncate" title={data.description_of_goods}>
                        {isEditing ? (
                          <input type="text" value={data.description_of_goods || ""} onChange={(ev) => handleFormChange("description_of_goods", ev.target.value)} className="w-40 bg-black border border-white/20 p-1 text-xs outline-none focus:border-gold-primary" />
                        ) : e.description_of_goods}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <select value={data.branch || "Historical Import"} onChange={(ev) => handleFormChange("branch", ev.target.value)} className="bg-black border border-white/20 p-1 text-xs outline-none focus:border-gold-primary">
                            <option value="Kaduthuruthy">Kaduthuruthy</option>
                            <option value="Ettumanoor">Ettumanoor</option>
                            <option value="Peruva">Peruva</option>
                            <option value="Historical Import">Historical Import</option>
                          </select>
                        ) : e.branch}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {isEditing ? (
                          <input type="number" value={data.mrp || 0} onChange={(ev) => handleFormChange("mrp", ev.target.value)} className="w-16 bg-black border border-white/20 p-1 text-xs text-right outline-none focus:border-gold-primary" />
                        ) : e.mrp.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {isEditing ? (
                          <input type="number" value={data.quantity || 0} onChange={(ev) => handleFormChange("quantity", ev.target.value)} className="w-12 bg-black border border-white/20 p-1 text-xs text-right outline-none focus:border-gold-primary" />
                        ) : e.quantity}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {isEditing ? (
                          <input type="number" value={data.rate || 0} onChange={(ev) => handleFormChange("rate", ev.target.value)} className="w-16 bg-black border border-white/20 p-1 text-xs text-right outline-none focus:border-gold-primary" />
                        ) : e.rate.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-400">{Number(data.total || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">
                        {isEditing ? (
                          <input type="number" value={data.discount_percent || 0} onChange={(ev) => handleFormChange("discount_percent", ev.target.value)} className="w-12 bg-black border border-white/20 p-1 text-xs text-right outline-none focus:border-gold-primary" />
                        ) : e.discount_percent + "%"}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-400">{Number(data.amount || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">
                        {isEditing ? (
                          <input type="number" value={data.gst_percent || 0} onChange={(ev) => handleFormChange("gst_percent", ev.target.value)} className="w-12 bg-black border border-white/20 p-1 text-xs text-right outline-none focus:border-gold-primary" />
                        ) : e.gst_percent + "%"}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-gold-primary">{Number(data.grand_total || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-center sticky right-0 bg-[#0a0a0a] border-l border-white/5">
                        {isEditing ? (
                          <div className="flex items-center justify-center space-x-2">
                            <button onClick={handleSave} className="p-1.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={handleCancelEdit} className="p-1.5 bg-white/5 text-gray-400 hover:bg-white/10 rounded"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEditClick(e)} className="p-1.5 bg-gold-primary/10 text-gold-primary hover:bg-gold-primary/20 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDelete(e.id)} className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
