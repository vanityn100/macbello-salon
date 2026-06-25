"use client";

import { useState, useEffect } from "react";
import { supabaseAdminClient } from "@/lib/supabase";
import { 
  ShieldAlert, Loader2, Download, FileSpreadsheet, Building2, Calendar, ChevronLeft, 
  PackageSearch, AlertTriangle, ArrowDownRight, ArrowUpRight, Search, Plus, Minus
} from "lucide-react";
import Link from "next/link";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { formatINR, formatDate } from "@/lib/format";

function pdfINR(v: number) {
  return "Rs." + new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);
}

const BUSINESS_INFO = {
  name: "MacBello Family Salon",
  gstin: "32AABCM1029F1Z4",
};

export default function AdminInventoryPage() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [staffEmail, setStaffEmail] = useState<string | null>(null);
  const [staffBranch, setStaffBranch] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstDay.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Branch selection — admin can switch; staff is locked to their own branch
  const BRANCHES = ["Kaduthuruthy", "Ettumanoor", "Peruva"];
  const [selectedBranch, setSelectedBranch] = useState<string>("Kaduthuruthy");
  
  // Stock adjustment modal
  const [adjustModal, setAdjustModal] = useState<any | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustType, setAdjustType] = useState<"STOCK_IN" | "ADJUSTMENT">("STOCK_IN");
  const [adjustLoading, setAdjustLoading] = useState(false);

  // Create Product modal
  const [createModal, setCreateModal] = useState(false);
  const [createData, setCreateData] = useState({ name: "", price: "", hsn: "999729", gstRate: "18", initialStock: "0", minimumStock: "5" });
  const [createLoading, setCreateLoading] = useState(false);

  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const handleSession = (session: any) => {
      const role = session?.user?.app_metadata?.role;
      if (session && (role === "staff" || role === "admin")) {
        setSessionToken(session.access_token);
        setStaffEmail(session.user?.email || null);
        const branch = session.user?.app_metadata?.branch || null;
        setStaffBranch(branch);
        setUserRole(role);
        // For staff, lock the selectedBranch to their branch
        if (role === "staff" && branch) {
          setSelectedBranch(branch);
        }
      } else {
        setSessionToken(null);
        setStaffEmail(null);
        setStaffBranch(null);
        setUserRole(null);
      }
      setAuthLoading(false);
    };

    supabaseAdminClient.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    const { data: { subscription } } = supabaseAdminClient.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadReport = async () => {
    if (!sessionToken) return;
    const branchToLoad = userRole === "admin" ? selectedBranch : (staffBranch || "Kaduthuruthy");
    setLoading(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({
          action: "get_summary_report",
          startDate, endDate, branch: branchToLoad
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReportData(data.report);
      } else {
        alert(data.error || "Failed to load inventory.");
      }
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        alert("Network error. Please check your connection and try again.");
      } else {
        alert("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionToken) {
      loadReport();
    }
  }, [sessionToken, selectedBranch]);

  const handleDeleteProduct = async (p: any) => {
    if (!confirm(`Are you sure you want to delete ${p.productName}?\nThis action cannot be undone.`)) return;
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ action: "delete_product", productId: p.productId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        loadReport();
      } else {
        alert(data.error || "Failed to delete product.");
      }
    } catch (err) {
      alert("Something went wrong. Please try again.");
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken || !adjustModal) return;
    setAdjustLoading(true);
    try {
      const qty = parseInt(adjustQty, 10);
      const signedQty = adjustType === "STOCK_IN" ? Math.abs(qty) : -Math.abs(qty);

      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({
          action: "update_stock",
          productId: adjustModal.productId,
          targetBranch: userRole === "admin" ? selectedBranch : staffBranch,
          quantity: signedQty,
          transactionType: adjustType
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAdjustModal(null);
        setAdjustQty("");
        loadReport(); // refresh
      } else {
        alert(data.error || "Failed to update stock.");
      }
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        alert("Network error. Please check your connection and try again.");
      } else {
        alert("Something went wrong. Please try again.");
      }
    } finally {
      setAdjustLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken) return;
    setCreateLoading(true);
    try {
      const gstRateVal = parseFloat(createData.gstRate) || 0;
      const inclusivePrice = parseFloat(createData.price) || 0;
      const taxablePrice = inclusivePrice / (1 + (gstRateVal / 100));

      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({
          action: "create_product",
          targetBranch: userRole === "admin" ? selectedBranch : staffBranch,
          ...createData,
          price: taxablePrice
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCreateModal(false);
        setCreateData({ name: "", price: "", hsn: "999729", gstRate: "18", initialStock: "0", minimumStock: "5" });
        loadReport();
      } else {
        alert(data.error || "Failed to create product.");
      }
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        alert("Network error. Please check your connection and try again.");
      } else {
        alert("Something went wrong. Please try again.");
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const logExport = async (format: string) => {
    const branchToExport = userRole === "admin" ? selectedBranch : (staffBranch || "Kaduthuruthy");
    try {
      await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ action: "log_export", exportFormat: format, branch: branchToExport }),
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

  const exportPDF = async () => {
    const branchLabel = userRole === "admin" ? selectedBranch : (staffBranch || "Kaduthuruthy");
    await logExport("PDF");
    const doc = new jsPDF("l", "mm", "a4");
    const pw = 297;
    doc.setFillColor(20, 20, 20);
    doc.rect(0, 0, pw, 28, "F");
    doc.setFillColor(212, 175, 55);
    doc.rect(0, 0, 3, 28, "F");
    doc.setTextColor(212, 175, 55);
    doc.setFontSize(13); doc.text(BUSINESS_INFO.name, 8, 12);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10); doc.text("PRODUCT SUMMARY REPORT", pw - 8, 12, { align: "right" });
    doc.setFontSize(7); doc.text(`Period: ${startDate} to ${endDate} | Branch: ${branchLabel}`, pw - 8, 18, { align: "right" });

    autoTable(doc, {
      startY: 33,
      head: [["Product", "HSN", "GST", "Status", "In Stock", "Qty Sold", "Taxable (Rs)", "GST (Rs)", "Revenue (Rs)"]],
      body: reportData.map(p => [
        p.productName, p.hsn, p.gstRate, p.status, p.currentStock, p.quantitySold,
        pdfINR(p.taxableValue), pdfINR(p.gstCollected), pdfINR(p.revenue)
      ]),
      theme: "grid",
      headStyles: { fillColor: [20, 20, 20], textColor: [212, 175, 55] },
      styles: { fontSize: 7 }
    });
    doc.save(`Product_Summary_${branchLabel}_${endDate}.pdf`);
  };

  const exportExcel = async () => {
    const branchLabel = userRole === "admin" ? selectedBranch : (staffBranch || "Kaduthuruthy");
    await logExport("Excel");
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(reportData.map(p => ({
      "Product Name": p.productName,
      "Category": p.category,
      "HSN": p.hsn,
      "GST Rate": p.gstRate,
      "Current Stock": p.currentStock,
      "Status": p.status,
      "Quantity Sold": p.quantitySold,
      "Taxable Value": p.taxableValue,
      "GST Collected": p.gstCollected,
      "Revenue": p.revenue
    })));
    XLSX.utils.book_append_sheet(wb, ws, "Product Summary");
    saveAs(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]), `Product_Summary_${branchLabel}_${endDate}.xlsx`);
  };

  if (authLoading) return <div className="min-h-screen bg-luxury-black flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;
  if (!sessionToken || (!staffBranch && userRole !== "admin")) return <div className="min-h-screen bg-luxury-black text-white p-10">Access Denied. Admin or Staff access required.</div>;

  const filtered = reportData.filter(p => p.productName.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <main className="min-h-screen bg-luxury-black text-white px-6 py-12 md:py-16">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-end border-b border-white/5 pb-6 mb-8">
          <div>
            <Link href="/admin" className="text-gold-primary/70 hover:text-gold-primary text-[10px] uppercase tracking-widest flex items-center mb-3">
              <ChevronLeft className="w-3 h-3 mr-1" /> Back to Dashboard
            </Link>
            <h1 className="font-playfair text-3xl font-light tracking-wide flex items-center">
              <PackageSearch className="mr-3 text-gold-primary" size={28} /> Branch Inventory
            </h1>
            <p className="text-ivory/50 mt-1">
              {userRole === "admin" ? selectedBranch : (staffBranch || "")} Branch
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={exportExcel} className="flex items-center text-[10px] uppercase tracking-wider border border-green-600 text-green-400 px-4 py-2 hover:bg-green-600/10">
              <FileSpreadsheet size={12} className="mr-2" /> Excel
            </button>
            <button onClick={exportPDF} className="flex items-center text-[10px] uppercase tracking-wider bg-red-700 text-white px-4 py-2 hover:bg-red-800">
              <Download size={12} className="mr-2" /> PDF
            </button>
            <button onClick={() => setCreateModal(true)} className="flex items-center text-[10px] font-bold uppercase tracking-wider bg-gold-primary text-black px-4 py-2 hover:bg-gold-dark transition-colors ml-2">
              <Plus size={12} className="mr-2" /> Manual Entry
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 bg-white/[0.01] border border-white/5 p-4">
          {/* Branch Dropdown — visible only to admins */}
          {userRole === "admin" && (
            <div>
              <label className="block text-[9px] uppercase tracking-wider text-ivory/60 mb-2 flex items-center gap-1">
                <Building2 size={10} /> Branch
              </label>
              <select
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                className="w-full bg-luxury-black border border-gold-primary/30 px-3 py-2 text-xs text-white outline-none focus:border-gold-primary appearance-none"
              >
                {BRANCHES.map(b => (
                  <option key={b} value={b} className="bg-black">{b}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[9px] uppercase tracking-wider text-ivory/60 mb-2">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-luxury-black border border-white/10 px-3 py-2 text-xs text-white outline-none" />
          </div>
          <div>
            <label className="block text-[9px] uppercase tracking-wider text-ivory/60 mb-2">End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-luxury-black border border-white/10 px-3 py-2 text-xs text-white outline-none" />
          </div>
          <div className="flex items-end">
            <button onClick={loadReport} disabled={loading} className="w-full bg-gold-primary text-black text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 hover:bg-gold-dark">
              {loading ? "Loading..." : "Generate Report"}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ivory/40" />
          <input type="text" placeholder="Search products..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.02] border border-white/10 pl-9 pr-4 py-3 text-sm text-white focus:outline-none focus:border-gold-primary/50" />
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-white/5">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5">
                <th className="p-4 text-[10px] uppercase tracking-wider text-ivory/50 font-normal">Product</th>
                <th className="p-4 text-[10px] uppercase tracking-wider text-ivory/50 font-normal">Status</th>
                <th className="p-4 text-[10px] uppercase tracking-wider text-ivory/50 font-normal text-right">Stock</th>
                <th className="p-4 text-[10px] uppercase tracking-wider text-ivory/50 font-normal text-right">Sold</th>
                <th className="p-4 text-[10px] uppercase tracking-wider text-ivory/50 font-normal text-right">Revenue</th>
                <th className="p-4 text-[10px] uppercase tracking-wider text-ivory/50 font-normal text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.productId} className="border-b border-white/5 hover:bg-white/[0.01]">
                  <td className="p-4">
                    <p className="text-sm font-medium text-white">{p.productName}</p>
                    <p className="text-[9px] text-ivory/40 mt-0.5">HSN: {p.hsn} · GST: {p.gstRate}</p>
                  </td>
                  <td className="p-4">
                    {p.currentStock <= 0 ? (
                      <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wider text-red-400 bg-red-400/10 px-2 py-1 rounded">
                        OUT OF STOCK
                      </span>
                    ) : p.currentStock <= p.minimumStock ? (
                      <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wider text-orange-400 bg-orange-400/10 px-2 py-1 rounded">
                        <AlertTriangle size={10} className="mr-1" /> LOW STOCK
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wider text-green-400 bg-green-400/10 px-2 py-1 rounded">
                        ACTIVE
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <span className={`metric-value text-sm ${p.currentStock <= p.minimumStock ? "text-orange-400" : "text-white"}`}>{p.currentStock}</span>
                  </td>
                  <td className="metric-value p-4 text-right text-sm text-ivory/70">{p.quantitySold}</td>
                  <td className="currency-value p-4 text-right text-sm text-gold-primary">{formatINR(p.revenue)}</td>
                  <td className="p-4 text-right whitespace-nowrap">
                    <button onClick={() => setAdjustModal(p)} className="text-[10px] uppercase tracking-wider text-gold-primary hover:underline">
                      Adjust
                    </button>
                    {userRole === "admin" && (
                      <button onClick={() => handleDeleteProduct(p)} className="text-[10px] uppercase tracking-wider text-red-500 hover:underline ml-4">
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && !loading && (
            <div className="p-8 text-center text-ivory/40 text-sm">No products found for this period.</div>
          )}
        </div>
      </div>

      {/* Adjust Modal */}
      {adjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-luxury-black border border-white/10 w-full max-w-sm p-6 relative">
            <h3 className="font-playfair text-xl text-white mb-1">Adjust Stock</h3>
            <p className="text-xs text-ivory/60 mb-6">{adjustModal.productName}</p>
            
            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => setAdjustType("STOCK_IN")} 
                  className={`flex-1 flex items-center justify-center py-2 text-xs border transition-colors ${adjustType === "STOCK_IN" ? "border-green-500 text-green-400 bg-green-500/10" : "border-white/10 text-ivory/50"}`}>
                  <Plus size={12} className="mr-1" /> Restock
                </button>
                <button type="button" onClick={() => setAdjustType("ADJUSTMENT")} 
                  className={`flex-1 flex items-center justify-center py-2 text-xs border transition-colors ${adjustType === "ADJUSTMENT" ? "border-red-500 text-red-400 bg-red-500/10" : "border-white/10 text-ivory/50"}`}>
                  <Minus size={12} className="mr-1" /> Damage/Loss
                </button>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-ivory/60 mb-2">Quantity</label>
                <input type="number" min="1" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} required
                  className="w-full bg-white/[0.02] border border-white/10 px-3 py-2 text-white outline-none focus:border-gold-primary" />
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setAdjustModal(null)} className="flex-1 py-2 text-xs border border-white/10 hover:bg-white/5">Cancel</button>
                <button type="submit" disabled={adjustLoading} className="flex-1 py-2 text-xs bg-gold-primary text-black font-bold uppercase">
                  {adjustLoading ? "Saving..." : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-luxury-black border border-white/10 w-full max-w-md p-6 relative">
            <h3 className="text-xl text-white mb-6">Add Manual Entry (Product)</h3>
            
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-ivory/60 mb-2">Product Name</label>
                <input type="text" value={createData.name} onChange={e => setCreateData({...createData, name: e.target.value})} required
                  className="w-full bg-white/[0.02] border border-white/10 px-3 py-2 text-white outline-none focus:border-gold-primary" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-ivory/60 mb-2">Selling Price (GST Included)</label>
                  <input type="number" min="0" step="0.01" value={createData.price} onChange={e => setCreateData({...createData, price: e.target.value})} required
                    className="w-full bg-white/[0.02] border border-white/10 px-3 py-2 text-white outline-none focus:border-gold-primary" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-ivory/60 mb-2">GST Rate (%)</label>
                  <select value={createData.gstRate} onChange={e => setCreateData({...createData, gstRate: e.target.value})}
                    className="w-full bg-white/[0.02] border border-white/10 px-3 py-2 text-white outline-none focus:border-gold-primary">
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-ivory/60 mb-2">Initial Stock</label>
                  <input type="number" min="0" value={createData.initialStock} onChange={e => setCreateData({...createData, initialStock: e.target.value})} required
                    className="w-full bg-white/[0.02] border border-white/10 px-3 py-2 text-white outline-none focus:border-gold-primary" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-ivory/60 mb-2">Min Stock Alert</label>
                  <input type="number" min="0" value={createData.minimumStock} onChange={e => setCreateData({...createData, minimumStock: e.target.value})} required
                    className="w-full bg-white/[0.02] border border-white/10 px-3 py-2 text-white outline-none focus:border-gold-primary" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-ivory/60 mb-2">HSN Code</label>
                <input type="text" value={createData.hsn} onChange={e => setCreateData({...createData, hsn: e.target.value})} required
                  className="w-full bg-white/[0.02] border border-white/10 px-3 py-2 text-white outline-none focus:border-gold-primary" />
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setCreateModal(false)} className="flex-1 py-2 text-xs border border-white/10 hover:bg-white/5">Cancel</button>
                <button type="submit" disabled={createLoading} className="flex-1 py-2 text-xs bg-gold-primary text-black font-bold uppercase">
                  {createLoading ? "Saving..." : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
