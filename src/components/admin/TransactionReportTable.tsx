"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { formatINR, formatDate } from "@/lib/format";
import { Search, ChevronUp, ChevronDown, Download, FileSpreadsheet, Eye, Printer, Edit2, Trash2, X, Filter } from "lucide-react";

export interface TransactionReportTableProps {
  invoices: any[];
  onExportPDF: (filtered: any[]) => void;
  onExportExcel: (filtered: any[]) => void;
  role?: string;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export default function TransactionReportTable({ invoices, onExportPDF, onExportExcel, role = "admin", onEdit, onDelete }: TransactionReportTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortCol, setSortCol] = useState("created_at");
  const [sortDesc, setSortDesc] = useState(true);
  const [limit, setLimit] = useState(25);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewInvoice, setViewInvoice] = useState<any | null>(null);

  const [filterMethod, setFilterMethod] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      if (filterMethod && inv.payment_method !== filterMethod) return false;
      if (filterStatus && inv.status !== filterStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const num = (inv.invoice_number || "").toLowerCase();
        const name = (inv.customers?.name || "").toLowerCase();
        const phone = (inv.customers?.phone || "").toLowerCase();
        const staff = (inv.created_by || "").toLowerCase();
        if (!num.includes(q) && !name.includes(q) && !phone.includes(q) && !staff.includes(q)) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      let aVal = a[sortCol];
      let bVal = b[sortCol];

      if (sortCol === "customer") {
        aVal = a.customers?.name || "";
        bVal = b.customers?.name || "";
      } else if (sortCol === "amount") {
        aVal = parseFloat(a.grand_total);
        bVal = parseFloat(b.grand_total);
      } else if (sortCol === "staff") {
        aVal = a.created_by || "";
        bVal = b.created_by || "";
      }

      if (aVal < bVal) return sortDesc ? 1 : -1;
      if (aVal > bVal) return sortDesc ? -1 : 1;
      return 0;
    });
  }, [invoices, searchQuery, filterMethod, filterStatus, sortCol, sortDesc]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterMethod, filterStatus, limit]);

  const totals = useMemo(() => {
    let rev = 0;
    let disc = 0;
    let cash = 0, card = 0, upi = 0, pending = 0;
    let cancelled = 0;
    
    filtered.forEach(i => {
       const gt = parseFloat(i.grand_total) || 0;
       if (i.status === "archived" || i.status === "cancelled") {
         cancelled++;
       } else if (i.payment_method === "Pending") {
         pending += gt;
         rev += gt; // Count pending as revenue? Typically yes if invoiced.
       } else {
         rev += gt;
         disc += parseFloat(i.discount) || 0;
         const method = (i.payment_method || "cash").toLowerCase();
         if (method.includes("cash")) cash += gt;
         else if (method.includes("card")) card += gt;
         else if (method.includes("upi")) upi += gt;
       }
    });

    return { rev, disc, cash, card, upi, pending, cancelled, count: filtered.length };
  }, [filtered]);

  const totalPages = Math.ceil(filtered.length / limit);
  const paginated = useMemo(() => {
    const start = (page - 1) * limit;
    return filtered.slice(start, start + limit);
  }, [filtered, page, limit]);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDesc(!sortDesc);
    } else {
      setSortCol(col);
      setSortDesc(true);
    }
  };

  const handleExportPDF = () => {
    const dataToExport = selectedIds.size > 0 ? filtered.filter(i => selectedIds.has(i.id)) : filtered;
    onExportPDF(dataToExport);
  };

  const handleExportExcel = () => {
    const dataToExport = selectedIds.size > 0 ? filtered.filter(i => selectedIds.has(i.id)) : filtered;
    onExportExcel(dataToExport);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(i => i.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const printInvoice = () => {
    const printContent = document.getElementById("printable-invoice");
    if (!printContent) return;
    const windowPrint = window.open("", "", "width=800,height=900");
    if (windowPrint) {
      windowPrint.document.write(`
        <html>
          <head>
            <title>Print Invoice</title>
            <style>
              body { font-family: sans-serif; padding: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .font-bold { font-weight: bold; }
              .text-gold-primary { color: #d4af37; }
              .print-hidden { display: none !important; }
            </style>
          </head>
          <body>${printContent.innerHTML}</body>
        </html>
      `);
      windowPrint.document.close();
      windowPrint.focus();
      windowPrint.print();
      windowPrint.close();
    }
  };

  const Th = ({ col, label, align = "left" }: { col: string, label: string, align?: "left" | "right" | "center" }) => (
    <th 
      className={\`pb-4 pt-4 font-semibold text-gold-primary sticky top-0 bg-neutral-900 border-b border-white/10 cursor-pointer hover:text-white transition-colors z-10 text-\${align}\`}
      onClick={() => handleSort(col)}
    >
      <div className={\`flex items-center space-x-1 justify-\${align === "right" ? "end" : align === "center" ? "center" : "start"}\`}>
        <span>{label}</span>
        {sortCol === col && (
          sortDesc ? <ChevronDown size={14} /> : <ChevronUp size={14} />
        )}
      </div>
    </th>
  );

  return (
    <div className="w-full space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/[0.02] border border-white/5 p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-ivory/50">Total Transactions</span>
          <span className="text-xl text-white font-medium mt-2">{formatNumber(totals.count)}</span>
        </div>
        <div className="bg-white/[0.02] border border-white/5 p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-ivory/50">Total Revenue</span>
          <span className="text-xl text-gold-primary font-medium mt-2">{formatINR(totals.rev)}</span>
        </div>
        <div className="bg-white/[0.02] border border-white/5 p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-ivory/50">Payments Breakdown</span>
          <div className="mt-2 text-xs space-y-1 text-ivory/80">
            <div className="flex justify-between"><span>Cash:</span> <span>{formatINR(totals.cash)}</span></div>
            <div className="flex justify-between"><span>Card:</span> <span>{formatINR(totals.card)}</span></div>
            <div className="flex justify-between"><span>UPI:</span> <span>{formatINR(totals.upi)}</span></div>
            {totals.pending > 0 && <div className="flex justify-between text-red-400"><span>Pending:</span> <span>{formatINR(totals.pending)}</span></div>}
          </div>
        </div>
        <div className="bg-white/[0.02] border border-white/5 p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-ivory/50">Other Stats</span>
          <div className="mt-2 text-xs space-y-1 text-ivory/80">
            <div className="flex justify-between"><span>Discounts:</span> <span>{formatINR(totals.disc)}</span></div>
            <div className="flex justify-between"><span>Cancelled:</span> <span>{formatNumber(totals.cancelled)}</span></div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white/[0.01] border border-white/5 p-4">
        <div className="flex-1 flex flex-wrap gap-4 items-center w-full">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-luxury-black border border-white/10 pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-gold-primary/50"
            />
          </div>

          {/* Filters */}
          <select 
            value={filterMethod} 
            onChange={(e) => setFilterMethod(e.target.value)}
            className="bg-luxury-black border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-gold-primary/50"
          >
            <option value="">All Payment Methods</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="UPI">UPI</option>
            <option value="Pending">Pending</option>
          </select>

          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-luxury-black border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-gold-primary/50"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="archived">Archived / Cancelled</option>
          </select>
        </div>

        {/* Exports */}
        <div className="flex space-x-3 w-full lg:w-auto">
          <button
            onClick={handleExportPDF}
            className="flex-1 lg:flex-none flex items-center justify-center space-x-2 text-[10px] uppercase tracking-wider bg-gold-primary hover:bg-gold-dark text-luxury-black font-semibold px-4 py-2.5 transition-colors"
          >
            <Download size={14} />
            <span>{selectedIds.size > 0 ? \`Export Selected (\${selectedIds.size})\` : "Export PDF"}</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="flex-1 lg:flex-none flex items-center justify-center space-x-2 text-[10px] uppercase tracking-wider border border-gold-primary text-gold-primary hover:bg-gold-primary/10 font-semibold px-4 py-2.5 transition-colors"
          >
            <FileSpreadsheet size={14} />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-white/5 bg-white/[0.01] overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <table className="w-full text-left text-[11px] font-light min-w-[1200px] relative">
            <thead>
              <tr className="uppercase tracking-wider text-[9px]">
                <th className="pb-4 pt-4 pl-4 sticky top-0 bg-neutral-900 border-b border-white/10 z-10 w-10">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="accent-gold-primary"
                  />
                </th>
                <Th col="invoice_number" label="Invoice No" />
                <Th col="created_at" label="Date & Time" />
                <Th col="branch" label="Branch" />
                <Th col="customer" label="Customer" />
                <Th col="staff" label="Staff" />
                <th className="pb-4 pt-4 sticky top-0 bg-neutral-900 border-b border-white/10 z-10">Items</th>
                <Th col="amount" label="Final Amount" align="right" />
                <Th col="payment_method" label="Payment" align="center" />
                <th className="pb-4 pt-4 sticky top-0 bg-neutral-900 border-b border-white/10 z-10 text-center">Status</th>
                <th className="pb-4 pt-4 pr-4 sticky top-0 bg-neutral-900 border-b border-white/10 z-10 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-ivory/40">
                    No transactions found for the selected filters.
                  </td>
                </tr>
              ) : paginated.map(inv => {
                const totalItems = inv.invoice_items?.length || 0;
                const isCancelled = inv.status === "archived" || inv.status === "cancelled";
                return (
                  <tr key={inv.id} className={\`border-b border-white/5 hover:bg-white/[0.02] transition-colors \${selectedIds.has(inv.id) ? "bg-white/[0.04]" : ""} \${isCancelled ? "opacity-50" : ""}\`}>
                    <td className="py-3 pl-4">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(inv.id)}
                        onChange={() => toggleSelect(inv.id)}
                        className="accent-gold-primary"
                      />
                    </td>
                    <td className="py-3 font-medium text-gold-primary cursor-pointer hover:underline" onClick={() => setViewInvoice(inv)}>
                      {inv.invoice_number}
                    </td>
                    <td className="py-3">
                      <div>{formatDate(inv.created_at)}</div>
                      <div className="text-[9px] text-ivory/40">{new Date(inv.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </td>
                    <td className="py-3 text-ivory/80">{inv.branch || "-"}</td>
                    <td className="py-3">
                      <div className="text-white">{inv.customers?.name || "Walk-in"}</div>
                      <div className="text-[9px] text-ivory/50">{inv.customers?.phone || "-"}</div>
                    </td>
                    <td className="py-3 text-ivory/80">{inv.created_by?.split("@")[0] || "-"}</td>
                    <td className="py-3 text-ivory/60">{totalItems} items</td>
                    <td className="py-3 text-right font-semibold text-white">
                      {formatINR(parseFloat(inv.grand_total))}
                      {parseFloat(inv.discount) > 0 && <div className="text-[9px] text-red-400 font-normal">-{formatINR(parseFloat(inv.discount))}</div>}
                    </td>
                    <td className="py-3 text-center">
                      <span className={\`px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider \${inv.payment_method === 'Pending' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}\`}>
                        {inv.payment_method || "Cash"}
                      </span>
                    </td>
                    <td className="py-3 text-center text-ivory/60 uppercase text-[9px]">{isCancelled ? "Cancelled" : "Active"}</td>
                    <td className="py-3 pr-4 text-right">
                      <div className="inline-flex space-x-2">
                        <button onClick={() => setViewInvoice(inv)} className="p-1.5 text-ivory/50 hover:text-white transition-colors" title="View"><Eye size={14} /></button>
                        {role === "admin" && onEdit && <button onClick={() => onEdit(inv.id)} className="p-1.5 text-ivory/50 hover:text-gold-primary transition-colors" title="Edit"><Edit2 size={14} /></button>}
                        {role === "admin" && onDelete && <button onClick={() => onDelete(inv.id)} className="p-1.5 text-ivory/50 hover:text-red-400 transition-colors" title="Delete"><Trash2 size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {/* Footer Totals */}
            <tfoot className="sticky bottom-0 bg-neutral-900 border-t border-white/20 font-medium z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
              <tr className="text-gold-primary">
                <td colSpan={7} className="py-3 pl-4 text-right uppercase tracking-wider text-[10px]">Page Total:</td>
                <td className="py-3 text-right">{formatINR(paginated.reduce((sum, inv) => sum + (inv.status !== 'archived' && inv.status !== 'cancelled' ? parseFloat(inv.grand_total) : 0), 0))}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-white/5 bg-white/[0.01]">
          <div className="flex items-center space-x-2 text-xs text-ivory/60 mb-4 sm:mb-0">
            <span>Show</span>
            <select 
              value={limit} 
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              className="bg-luxury-black border border-white/10 px-2 py-1 focus:outline-none"
            >
              {[10, 25, 50, 100].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <span>entries</span>
          </div>

          <div className="flex items-center space-x-1 text-xs">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-white/10 disabled:opacity-30 hover:bg-white/5 transition-colors"
            >
              Prev
            </button>
            <div className="px-3 py-1 text-ivory/60">
              Page {page} of {Math.max(1, totalPages)}
            </div>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 border border-white/10 disabled:opacity-30 hover:bg-white/5 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* View Modal */}
      {viewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-white/10 w-full max-w-3xl my-8 relative flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-white/10 bg-neutral-900 flex-shrink-0">
              <h2 className="text-lg font-playfair text-gold-primary">Invoice Preview</h2>
              <div className="flex items-center space-x-4">
                <button onClick={printInvoice} className="flex items-center space-x-2 text-xs text-ivory/80 hover:text-white transition-colors">
                  <Printer size={14} /> <span>Print</span>
                </button>
                <button onClick={() => setViewInvoice(null)} className="text-ivory/50 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-8 bg-white text-black overflow-y-auto flex-1" id="printable-invoice">
              <div className="text-center mb-8 pb-6 border-b border-gray-300">
                <h1 className="text-2xl font-bold uppercase tracking-wider mb-1">Macbello Salon & Spa</h1>
                <p className="text-sm text-gray-500 mb-4">Tax Invoice</p>
                <div className="flex justify-between text-left text-sm mt-6">
                  <div>
                    <p><strong>Invoice No:</strong> {viewInvoice.invoice_number}</p>
                    <p><strong>Date:</strong> {formatDate(viewInvoice.created_at)} {new Date(viewInvoice.created_at).toLocaleTimeString()}</p>
                    <p><strong>Branch:</strong> {viewInvoice.branch}</p>
                  </div>
                  <div className="text-right">
                    <p><strong>Customer:</strong> {viewInvoice.customers?.name || "Walk-in"}</p>
                    <p><strong>Phone:</strong> {viewInvoice.customers?.phone || "-"}</p>
                    <p><strong>Staff:</strong> {viewInvoice.created_by?.split("@")[0]}</p>
                  </div>
                </div>
              </div>

              <table className="w-full text-sm mb-8 text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-800 uppercase tracking-wider text-xs">
                    <th className="py-2">Item</th>
                    <th className="py-2 text-center">Qty</th>
                    <th className="py-2 text-right">Unit Price</th>
                    <th className="py-2 text-right">Tax (%)</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {viewInvoice.invoice_items?.map((item: any, idx: number) => (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="py-3">{item.item_name} <span className="text-[10px] text-gray-500 block">{item.category}</span></td>
                      <td className="py-3 text-center">{item.quantity}</td>
                      <td className="py-3 text-right">{formatINR(parseFloat(item.unit_price))}</td>
                      <td className="py-3 text-right">{item.tax_rate * 100}%</td>
                      <td className="py-3 text-right">{formatINR(parseFloat(item.line_total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end text-sm">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between"><span>Subtotal:</span> <span>{formatINR(parseFloat(viewInvoice.subtotal))}</span></div>
                  <div className="flex justify-between"><span>Total Tax:</span> <span>{formatINR(parseFloat(viewInvoice.total_tax))}</span></div>
                  {parseFloat(viewInvoice.discount) > 0 && (
                    <div className="flex justify-between text-red-600"><span>Discount:</span> <span>-{formatINR(parseFloat(viewInvoice.discount))}</span></div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-800 mt-2">
                    <span>Grand Total:</span> <span>{formatINR(parseFloat(viewInvoice.grand_total))}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 pt-2">
                    <span>Payment Mode:</span> <span>{viewInvoice.payment_method || "Cash"}</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-12 text-center text-xs text-gray-500 pt-6 border-t border-gray-200">
                <p>Thank you for choosing Macbello Salon & Spa.</p>
                <p>This is a computer generated invoice.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
