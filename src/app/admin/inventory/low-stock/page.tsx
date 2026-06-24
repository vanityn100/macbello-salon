"use client";

import { useState, useEffect } from "react";
import { supabaseAdminClient } from "@/lib/supabase";
import { ArrowLeft, Download, PackageOpen, Loader2 } from "lucide-react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

interface LowStockItem {
  id: string;
  branch: string;
  current_stock: number;
  minimum_stock: number;
  services: {
    name: string;
    item_code: string;
    category: string;
  };
}

export default function LowStockReportPage() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [filterBranch, setFilterBranch] = useState("All Branches");

  useEffect(() => {
    supabaseAdminClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionToken(session.access_token);
        fetchLowStock(session.access_token, filterBranch);
      } else {
        setLoading(false);
        setError("Unauthorized access.");
      }
    });
  }, [filterBranch]);

  const fetchLowStock = async (token: string, branch: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/purchases?action=low_stock&branch=${encodeURIComponent(branch)}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setItems(data.low_stock || []);
      } else {
        setError(data.error || "Failed to load low stock items.");
      }
    } catch (err) {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    const dataToExport = items.map(i => ({
      "Branch": i.branch,
      "Product Name": i.services?.name || "-",
      "Item Code": i.services?.item_code || "-",
      "Category": i.services?.category || "-",
      "Current Stock": i.current_stock,
      "Minimum Stock": i.minimum_stock,
      "Status": i.current_stock === 0 ? "Out of Stock" : "Low Stock"
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Low Stock Report");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const dataBlob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(dataBlob, `Low_Stock_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  if (loading && items.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/admin/inventory" className="p-2 hover:bg-white/5 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-light tracking-wide uppercase text-red-400">Low Stock Report</h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Inventory Management</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={handleExportExcel} className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-[10px] uppercase tracking-widest transition-all">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>
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
        <div className="mb-6 max-w-xs">
          <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2">Filter By Branch</label>
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-none px-4 py-2.5 text-sm focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all outline-none appearance-none"
          >
            <option value="All Branches" className="bg-black">All Branches</option>
            <option value="MACBELLO" className="bg-black">MACBELLO</option>
            <option value="Kaduthuruthy" className="bg-black">Kaduthuruthy</option>
            <option value="Ettumanoor" className="bg-black">Ettumanoor</option>
            <option value="Peruva" className="bg-black">Peruva</option>
          </select>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap border border-white/5">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-[10px] uppercase tracking-widest bg-white/5">
                <th className="px-4 py-4 font-normal">Branch</th>
                <th className="px-4 py-4 font-normal">Product</th>
                <th className="px-4 py-4 font-normal">Category</th>
                <th className="px-4 py-4 font-normal text-right">Current Stock</th>
                <th className="px-4 py-4 font-normal text-right">Min Stock</th>
                <th className="px-4 py-4 font-normal text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <PackageOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="text-sm">All inventory levels are healthy.</p>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isOutOfStock = item.current_stock === 0;
                  return (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-4 text-gray-300">{item.branch}</td>
                      <td className="px-4 py-4">
                        <div className="font-medium">{item.services?.name || "Unknown"}</div>
                        <div className="text-[10px] text-gray-500 font-mono mt-1">{item.services?.item_code}</div>
                      </td>
                      <td className="px-4 py-4 text-gray-400">{item.services?.category || "-"}</td>
                      <td className="px-4 py-4 text-right">
                        <span className={`font-mono text-lg font-bold ${isOutOfStock ? "text-red-500" : "text-yellow-500"}`}>
                          {item.current_stock}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-gray-500 font-mono">
                        {item.minimum_stock}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2 py-1 text-[10px] uppercase tracking-widest border ${
                          isOutOfStock 
                            ? "border-red-500/30 text-red-500 bg-red-500/10" 
                            : "border-yellow-500/30 text-yellow-500 bg-yellow-500/10"
                        }`}>
                          {isOutOfStock ? "Out of Stock" : "Low Stock"}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
