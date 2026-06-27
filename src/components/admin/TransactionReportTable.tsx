"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { formatINR, formatDate } from "@/lib/format";
import { Search, ChevronUp, ChevronDown, Download, FileSpreadsheet, Eye, Printer, Edit2, Trash2, X, Columns, SearchX, Filter } from "lucide-react";

export interface TransactionReportTableProps {
  invoices: any[];
  onExportPDF: (filtered: any[], metadata: any) => void;
  onExportExcel: (filtered: any[], metadata: any) => void;
  role?: string;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const ALL_COLUMNS = [
  { id: "invoice_number", label: "Invoice No", mandatory: true },
  { id: "created_at", label: "Date", mandatory: true },
  { id: "customer", label: "Customer", mandatory: true },
  { id: "amount", label: "Final Amount", mandatory: true },
  { id: "branch", label: "Branch", mandatory: false },
  { id: "phone", label: "Phone", mandatory: false },
  { id: "staff", label: "Staff", mandatory: false },
  { id: "items", label: "Quantity", mandatory: false },
  { id: "tax", label: "Tax", mandatory: false },
  { id: "discount", label: "Discount", mandatory: false },
  { id: "payment_method", label: "Payment Method", mandatory: false },
  { id: "status", label: "Status", mandatory: false },
];

export default function TransactionReportTable({ invoices, onExportPDF, onExportExcel, role = "admin", onEdit, onDelete }: TransactionReportTableProps) {
  const getSaved = (key: string, def: any) => {
    if (typeof window === "undefined") return def;
    try {
      const saved = localStorage.getItem("tx_table_" + key);
      return saved ? JSON.parse(saved) : def;
    } catch { return def; }
  };
  
  const saveToStorage = (key: string, val: any) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("tx_table_" + key, JSON.stringify(val));
    }
  };

  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortCol, setSortCol] = useState(() => getSaved("sortCol", "created_at"));
  const [sortDesc, setSortDesc] = useState(() => getSaved("sortDesc", true));
  const [limit, setLimit] = useState(() => getSaved("limit", 25));
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewInvoice, setViewInvoice] = useState<any | null>(null);

  const [filterMethod, setFilterMethod] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMin, setFilterMin] = useState("");
  const [filterMax, setFilterMax] = useState("");
  
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  
  const defaultCols = ALL_COLUMNS.filter(c => c.mandatory || ["branch", "staff", "items", "payment_method", "status"].includes(c.id)).map(c => c.id);
  const [visibleCols, setVisibleCols] = useState<string[]>(() => getSaved("cols", defaultCols));

  useEffect(() => { saveToStorage("sortCol", sortCol); }, [sortCol]);
  useEffect(() => { saveToStorage("sortDesc", sortDesc); }, [sortDesc]);
  useEffect(() => { saveToStorage("limit", limit); }, [limit]);
  useEffect(() => { saveToStorage("cols", visibleCols); }, [visibleCols]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      
      if (e.key === "Escape") {
        setViewInvoice(null);
        setShowColumnsMenu(false);
      } else if (e.ctrlKey && e.key.toLowerCase() === "f" && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        handleExportPDF();
      } else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        handlePrintReport();
      } else if (e.ctrlKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        handleExportExcel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewInvoice, selectedIds, searchQuery, filterMethod, filterStatus, sortCol, sortDesc, visibleCols]);

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      if (filterMethod && inv.payment_method !== filterMethod) return false;
      if (filterStatus && inv.status !== filterStatus) return false;
      
      const gt = parseFloat(inv.grand_total);
      if (filterMin && gt < parseFloat(filterMin)) return false;
      if (filterMax && gt > parseFloat(filterMax)) return false;

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
        aVal = (a.customers?.name || "").toLowerCase();
        bVal = (b.customers?.name || "").toLowerCase();
      } else if (sortCol === "amount") {
        aVal = parseFloat(a.grand_total);
        bVal = parseFloat(b.grand_total);
      } else if (sortCol === "staff") {
        aVal = (a.created_by || "").toLowerCase();
        bVal = (b.created_by || "").toLowerCase();
      }

      if (aVal < bVal) return sortDesc ? 1 : -1;
      if (aVal > bVal) return sortDesc ? -1 : 1;
      return 0;
    });
  }, [invoices, searchQuery, filterMethod, filterStatus, filterMin, filterMax, sortCol, sortDesc]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterMethod, filterStatus, filterMin, filterMax, limit]);

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
         rev += gt; 
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
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
    onExportPDF(dataToExport, {
      filters: [
        searchQuery ? "Search: " + searchQuery : "",
        filterMethod ? "Payment: " + filterMethod : "",
        filterStatus ? "Status: " + filterStatus : ""
      ].filter(Boolean).join(" | ") || "None"
    });
  };

  const handleExportExcel = () => {
    const dataToExport = selectedIds.size > 0 ? filtered.filter(i => selectedIds.has(i.id)) : filtered;
    onExportExcel(dataToExport, {
      filters: [
        searchQuery ? "Search: " + searchQuery : "",
        filterMethod ? "Payment: " + filterMethod : "",
        filterStatus ? "Status: " + filterStatus : ""
      ].filter(Boolean).join(" | ") || "None"
    });
  };

  const handlePrintReport = () => {
    const dataToExport = selectedIds.size > 0 ? filtered.filter(i => selectedIds.has(i.id)) : filtered;
    
    let html = `
      <html>
        <head>
          <title>Macbello Salon - Transaction Report</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; font-size: 11px; color: #333; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px; }
            .title { font-size: 18px; font-weight: bold; margin: 0 0 5px 0; text-transform: uppercase; }
            .subtitle { font-size: 12px; color: #666; margin: 0 0 15px 0; }
            .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 10px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; text-transform: uppercase; font-size: 10px; }
            .right { text-align: right; }
            .center { text-align: center; }
            .footer { margin-top: 30px; text-align: center; font-size: 9px; color: #888; border-top: 1px solid #ddd; padding-top: 10px; }
            .totals { font-weight: bold; background-color: #f9f9f9; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">Macbello Family Salon</h1>
            <p class="subtitle">Transaction Report</p>
          </div>
          <div class="meta">
            <div>
              <strong>Generated:</strong> ${new Date().toLocaleString()}<br/>
              <strong>Filters:</strong> ${[
                searchQuery ? "Search: " + searchQuery : "",
                filterMethod ? "Payment: " + filterMethod : "",
                filterStatus ? "Status: " + filterStatus : ""
              ].filter(Boolean).join(" | ") || "None"}<br/>
              <strong>Total Records:</strong> ${dataToExport.length}
            </div>
            <div class="right">
              <strong>Total Revenue:</strong> ${formatINR(dataToExport.reduce((s, i) => s + (i.status !== 'archived' ? parseFloat(i.grand_total) : 0), 0))}<br/>
              <strong>Total Tax:</strong> ${formatINR(dataToExport.reduce((s, i) => s + (i.status !== 'archived' ? parseFloat(i.total_tax) : 0), 0))}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice No</th>
                ${visibleCols.includes("branch") ? "<th>Branch</th>" : ""}
                <th>Customer</th>
                ${visibleCols.includes("phone") ? "<th>Phone</th>" : ""}
                ${visibleCols.includes("staff") ? "<th>Staff</th>" : ""}
                ${visibleCols.includes("items") ? "<th class='center'>Qty</th>" : ""}
                ${visibleCols.includes("payment_method") ? "<th class='center'>Payment</th>" : ""}
                ${visibleCols.includes("status") ? "<th class='center'>Status</th>" : ""}
                ${visibleCols.includes("tax") ? "<th class='right'>Tax</th>" : ""}
                ${visibleCols.includes("discount") ? "<th class='right'>Discount</th>" : ""}
                <th class="right">Final Amount</th>
              </tr>
            </thead>
            <tbody>
    `;

    dataToExport.forEach(inv => {
      const isArchived = inv.status === 'archived' || inv.status === 'cancelled';
      html += `
        <tr style="${isArchived ? 'color: #999;' : ''}">
          <td>${formatDate(inv.created_at)}</td>
          <td>${inv.invoice_number}</td>
          ${visibleCols.includes("branch") ? "<td>" + (inv.branch || "-") + "</td>" : ""}
          <td>${inv.customers?.name || "Walk-in"}</td>
          ${visibleCols.includes("phone") ? "<td>" + (inv.customers?.phone || "-") + "</td>" : ""}
          ${visibleCols.includes("staff") ? "<td>" + (inv.created_by?.split("@")[0] || "-") + "</td>" : ""}
          ${visibleCols.includes("items") ? "<td class='center'>" + (inv.invoice_items?.length || 0) + "</td>" : ""}
          ${visibleCols.includes("payment_method") ? "<td class='center'>" + (inv.payment_method || "Cash") + "</td>" : ""}
          ${visibleCols.includes("status") ? "<td class='center'>" + (isArchived ? "Cancelled" : "Active") + "</td>" : ""}
          ${visibleCols.includes("tax") ? "<td class='right'>" + formatINR(parseFloat(inv.total_tax)) + "</td>" : ""}
          ${visibleCols.includes("discount") ? "<td class='right'>" + formatINR(parseFloat(inv.discount)) + "</td>" : ""}
          <td class="right">${formatINR(parseFloat(inv.grand_total))}</td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
          <div class="footer">
            Generated from Macbello Salon Management System
          </div>
        </body>
      </html>
    `;

    const printWin = window.open("", "_blank");
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
        printWin.close();
      }, 250);
    }
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

  const toggleColumn = (colId: string) => {
    setVisibleCols(prev => 
      prev.includes(colId) ? prev.filter(c => c !== colId) : [...prev, colId]
    );
  };

  const clearFilters = () => {
    setSearchQuery("");
    setFilterMethod("");
    setFilterStatus("");
    setFilterMin("");
    setFilterMax("");
    setPage(1);
  };

  const Th = ({ col, label, align = "left", hidden = false }: { col: string, label: string, align?: "left" | "right" | "center", hidden?: boolean }) => {
    if (hidden) return null;
    return (
      <th 
        className={"pb-4 pt-4 font-semibold text-gold-primary sticky top-0 bg-neutral-900 border-b border-white/10 cursor-pointer hover:text-white transition-colors z-10 text-" + align}
        onClick={() => handleSort(col)}
      >
        <div className={"flex items-center space-x-1 justify-" + (align === "right" ? "end" : align === "center" ? "center" : "start")}>
          <span>{label}</span>
          {sortCol === col && (
            sortDesc ? <ChevronDown size={14} /> : <ChevronUp size={14} />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="w-full space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/[0.02] border border-white/5 p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-ivory/50">Total Transactions</span>
          <span className="text-xl text-white font-medium mt-2">{totals.count}</span>
        </div>
        <div className="bg-white/[0.02] border border-white/5 p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-ivory/50">Total Revenue</span>
          <span className="text-xl text-gold-primary font-medium mt-2">{formatINR(totals.rev)}</span>
        </div>
        <div className="bg-white/[0.02] border border-white/5 p-4 flex flex-col justify-between hidden md:flex">
          <span className="text-[10px] uppercase tracking-wider text-ivory/50">Payments Breakdown</span>
          <div className="mt-2 text-xs space-y-1 text-ivory/80">
            <div className="flex justify-between"><span>Cash:</span> <span>{formatINR(totals.cash)}</span></div>
            <div className="flex justify-between"><span>Card:</span> <span>{formatINR(totals.card)}</span></div>
            <div className="flex justify-between"><span>UPI:</span> <span>{formatINR(totals.upi)}</span></div>
            {totals.pending > 0 && <div className="flex justify-between text-red-400"><span>Pending:</span> <span>{formatINR(totals.pending)}</span></div>}
          </div>
        </div>
        <div className="bg-white/[0.02] border border-white/5 p-4 flex flex-col justify-between hidden md:flex">
          <span className="text-[10px] uppercase tracking-wider text-ivory/50">Other Stats</span>
          <div className="mt-2 text-xs space-y-1 text-ivory/80">
            <div className="flex justify-between"><span>Discounts:</span> <span>{formatINR(totals.disc)}</span></div>
            <div className="flex justify-between"><span>Cancelled:</span> <span>{totals.cancelled}</span></div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 bg-white/[0.01] border border-white/5 p-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex-1 flex flex-wrap gap-4 items-center w-full">
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search invoices (Ctrl+F)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-luxury-black border border-white/10 pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-gold-primary/50"
              />
            </div>

            <button 
              onClick={() => setShowFiltersMobile(!showFiltersMobile)}
              className="md:hidden flex items-center space-x-2 text-xs text-ivory/80 border border-white/10 px-4 py-2.5 bg-luxury-black"
            >
              <Filter size={14} /> <span>Filters</span>
            </button>

            <div className={(showFiltersMobile ? 'flex' : 'hidden') + " md:flex flex-col sm:flex-row flex-wrap gap-4 w-full md:w-auto"}>
              <select 
                value={filterMethod} 
                onChange={(e) => setFilterMethod(e.target.value)}
                className="bg-luxury-black border border-white/10 px-3 py-2.5 text-xs text-white focus:outline-none focus:border-gold-primary/50 w-full sm:w-auto"
              >
                <option value="">All Payments</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="UPI">UPI</option>
                <option value="Pending">Pending</option>
              </select>

              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-luxury-black border border-white/10 px-3 py-2.5 text-xs text-white focus:outline-none focus:border-gold-primary/50 w-full sm:w-auto"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="archived">Cancelled</option>
              </select>

              <input
                type="number"
                placeholder="Min ₹"
                value={filterMin}
                onChange={(e) => setFilterMin(e.target.value)}
                className="bg-luxury-black border border-white/10 px-3 py-2.5 text-xs text-white focus:outline-none focus:border-gold-primary/50 w-full sm:w-24"
              />
              <input
                type="number"
                placeholder="Max ₹"
                value={filterMax}
                onChange={(e) => setFilterMax(e.target.value)}
                className="bg-luxury-black border border-white/10 px-3 py-2.5 text-xs text-white focus:outline-none focus:border-gold-primary/50 w-full sm:w-24"
              />
            </div>
            
            <div className="relative hidden md:block">
              <button 
                onClick={() => setShowColumnsMenu(!showColumnsMenu)}
                className="flex items-center space-x-2 text-xs text-ivory/80 border border-white/10 px-4 py-2.5 bg-luxury-black hover:bg-white/5 transition-colors"
              >
                <Columns size={14} /> <span>Columns</span>
              </button>
              {showColumnsMenu && (
                <div className="absolute top-full left-0 mt-1 bg-luxury-black border border-white/10 p-3 z-50 w-48 shadow-2xl">
                  <div className="text-[9px] uppercase tracking-wider text-ivory/50 mb-2">Toggle Columns</div>
                  {ALL_COLUMNS.filter(c => !c.mandatory).map(col => (
                    <label key={col.id} className="flex items-center space-x-2 text-xs text-white py-1.5 cursor-pointer hover:bg-white/5 px-2 -mx-2">
                      <input 
                        type="checkbox" 
                        checked={visibleCols.includes(col.id)}
                        onChange={() => toggleColumn(col.id)}
                        className="accent-gold-primary"
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-neutral-900 border-t border-white/10 md:relative md:p-0 md:border-0 md:bg-transparent z-40 flex justify-end space-x-3 shadow-[0_-10px_20px_rgba(0,0,0,0.5)] md:shadow-none">
          <button
            onClick={handlePrintReport}
            className="flex-1 md:flex-none flex items-center justify-center space-x-2 text-[10px] uppercase tracking-wider border border-white/20 text-white hover:bg-white/10 font-semibold px-4 py-3 transition-colors"
          >
            <Printer size={14} />
            <span className="hidden sm:inline">Print Report</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="flex-1 md:flex-none flex items-center justify-center space-x-2 text-[10px] uppercase tracking-wider bg-gold-primary hover:bg-gold-dark text-luxury-black font-semibold px-4 py-3 transition-colors"
          >
            <Download size={14} />
            <span>{selectedIds.size > 0 ? "PDF (" + selectedIds.size + ")" : "PDF"}</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="flex-1 md:flex-none flex items-center justify-center space-x-2 text-[10px] uppercase tracking-wider border border-gold-primary text-gold-primary hover:bg-gold-primary/10 font-semibold px-4 py-3 transition-colors"
          >
            <FileSpreadsheet size={14} />
            <span>{selectedIds.size > 0 ? "Excel (" + selectedIds.size + ")" : "Excel"}</span>
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-white/5 bg-white/[0.01] flex flex-col items-center justify-center py-20 px-4 text-center">
          <SearchX size={48} className="text-white/10 mb-4" />
          <h3 className="text-lg font-playfair text-white mb-2">No Transactions Found</h3>
          <p className="text-xs text-ivory/50 mb-6">There are no transactions matching your current date range and filter criteria.</p>
          <button 
            onClick={clearFilters}
            className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="border border-white/5 bg-white/[0.01] overflow-hidden">
          
          <div className="hidden md:block overflow-x-auto max-h-[600px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            <table className="w-full text-left text-[11px] font-light min-w-[1000px] relative">
              <thead>
                <tr className="uppercase tracking-wider text-[9px]">
                  <th className="pb-4 pt-4 pl-4 sticky top-0 bg-neutral-900 border-b border-white/10 z-10 w-10">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.size === paginated.length && paginated.length > 0}
                      onChange={() => {
                        if (selectedIds.size === paginated.length) setSelectedIds(new Set());
                        else setSelectedIds(new Set(paginated.map(i => i.id)));
                      }}
                      className="accent-gold-primary"
                      title="Select Page"
                    />
                  </th>
                  <Th col="invoice_number" label="Invoice No" />
                  <Th col="created_at" label="Date" />
                  <Th col="branch" label="Branch" hidden={!visibleCols.includes("branch")} />
                  <Th col="customer" label="Customer" />
                  <Th col="phone" label="Phone" hidden={!visibleCols.includes("phone")} />
                  <Th col="staff" label="Staff" hidden={!visibleCols.includes("staff")} />
                  <Th col="items" label="Qty" align="center" hidden={!visibleCols.includes("items")} />
                  <Th col="payment_method" label="Payment" align="center" hidden={!visibleCols.includes("payment_method")} />
                  <Th col="status" label="Status" align="center" hidden={!visibleCols.includes("status")} />
                  <Th col="tax" label="Tax" align="right" hidden={!visibleCols.includes("tax")} />
                  <Th col="discount" label="Discount" align="right" hidden={!visibleCols.includes("discount")} />
                  <Th col="amount" label="Final Amount" align="right" />
                  <th className="pb-4 pt-4 pr-4 sticky top-0 bg-neutral-900 border-b border-white/10 z-10 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(inv => {
                  const isCancelled = inv.status === "archived" || inv.status === "cancelled";
                  return (
                    <tr key={inv.id} className={"border-b border-white/5 hover:bg-white/[0.02] transition-colors " + (selectedIds.has(inv.id) ? "bg-white/[0.04] " : "") + (isCancelled ? "opacity-50" : "")}>
                      <td className="py-3 pl-4">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.has(inv.id)}
                          onChange={() => {
                            const newSet = new Set(selectedIds);
                            newSet.has(inv.id) ? newSet.delete(inv.id) : newSet.add(inv.id);
                            setSelectedIds(newSet);
                          }}
                          className="accent-gold-primary"
                        />
                      </td>
                      <td className="py-3 font-medium text-gold-primary cursor-pointer hover:underline" onClick={() => setViewInvoice(inv)}>
                        {inv.invoice_number}
                      </td>
                      <td className="py-3 text-ivory/80">
                        {formatDate(inv.created_at)}
                      </td>
                      {!visibleCols.includes("branch") ? null : <td className="py-3 text-ivory/60">{inv.branch || "-"}</td>}
                      <td className="py-3 text-white">
                        {inv.customers?.name || "Walk-in"}
                        {inv.customers?.status === "archived" && <span className="ml-2 bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 text-[8px] uppercase tracking-wider rounded-sm">Archived</span>}
                      </td>
                      {!visibleCols.includes("phone") ? null : <td className="py-3 text-ivory/60">{inv.customers?.phone || "-"}</td>}
                      {!visibleCols.includes("staff") ? null : <td className="py-3 text-ivory/60">{inv.created_by?.split("@")[0] || "-"}</td>}
                      {!visibleCols.includes("items") ? null : <td className="py-3 text-center text-ivory/60">{inv.invoice_items?.length || 0}</td>}
                      {!visibleCols.includes("payment_method") ? null : (
                        <td className="py-3 text-center">
                          <span className={"px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider " + (inv.payment_method === 'Pending' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400')}>
                            {inv.payment_method || "Cash"}
                          </span>
                        </td>
                      )}
                      {!visibleCols.includes("status") ? null : <td className="py-3 text-center text-ivory/60 uppercase text-[9px]">{isCancelled ? "Cancelled" : "Active"}</td>}
                      {!visibleCols.includes("tax") ? null : <td className="py-3 text-right text-ivory/60">{formatINR(parseFloat(inv.total_tax))}</td>}
                      {!visibleCols.includes("discount") ? null : <td className="py-3 text-right text-red-400/80">{parseFloat(inv.discount) > 0 ? "-" + formatINR(parseFloat(inv.discount)) : "-"}</td>}
                      <td className="py-3 text-right font-semibold text-white">
                        {formatINR(parseFloat(inv.grand_total))}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <div className="inline-flex space-x-2">
                          <button onClick={() => setViewInvoice(inv)} className="p-1.5 text-ivory/50 hover:text-white transition-colors" aria-label="View Invoice"><Eye size={14} /></button>
                          {role === "admin" && onEdit && <button onClick={() => onEdit(inv.id)} className="p-1.5 text-ivory/50 hover:text-gold-primary transition-colors" aria-label="Edit Invoice"><Edit2 size={14} /></button>}
                          {role === "admin" && onDelete && <button onClick={() => onDelete(inv.id)} className="p-1.5 text-ivory/50 hover:text-red-400 transition-colors" aria-label="Delete Invoice"><Trash2 size={14} /></button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="sticky bottom-0 bg-neutral-900 border-t border-white/20 font-medium z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <tr className="text-gold-primary">
                  <td colSpan={2} className="py-3 pl-4 text-left uppercase tracking-wider text-[10px]">Page Total</td>
                  <td colSpan={visibleCols.length + 1} className="py-3 pr-4 text-right">
                    {formatINR(paginated.reduce((sum, inv) => sum + (inv.status !== 'archived' && inv.status !== 'cancelled' ? parseFloat(inv.grand_total) : 0), 0))}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="md:hidden flex flex-col pb-20">
            {paginated.map(inv => {
              const isCancelled = inv.status === "archived" || inv.status === "cancelled";
              return (
                <div key={inv.id} className={"p-4 border-b border-white/5 " + (selectedIds.has(inv.id) ? "bg-white/[0.04] " : "") + (isCancelled ? "opacity-50" : "")}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-3">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(inv.id)}
                        onChange={() => {
                          const newSet = new Set(selectedIds);
                          newSet.has(inv.id) ? newSet.delete(inv.id) : newSet.add(inv.id);
                          setSelectedIds(newSet);
                        }}
                        className="accent-gold-primary"
                      />
                      <div>
                        <div className="font-medium text-gold-primary cursor-pointer hover:underline" onClick={() => setViewInvoice(inv)}>{inv.invoice_number}</div>
                        <div className="text-[10px] text-ivory/50">{formatDate(inv.created_at)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-white">{formatINR(parseFloat(inv.grand_total))}</div>
                      <span className={"px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider " + (inv.payment_method === 'Pending' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400')}>
                        {inv.payment_method || "Cash"}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-ivory/80 flex justify-between mt-3">
                    <div>
                      <span className="text-ivory/40">Customer:</span> {inv.customers?.name || "Walk-in"}
                    </div>
                    <div className="inline-flex space-x-2">
                      <button onClick={() => setViewInvoice(inv)} className="p-1 text-ivory/50"><Eye size={16} /></button>
                      {role === "admin" && onEdit && <button onClick={() => onEdit(inv.id)} className="p-1 text-ivory/50"><Edit2 size={16} /></button>}
                      {role === "admin" && onDelete && <button onClick={() => onDelete(inv.id)} className="p-1 text-ivory/50"><Trash2 size={16} /></button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-white/5 bg-white/[0.01] pb-24 md:pb-4">
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
                aria-label="Previous Page"
              >
                Prev
              </button>
              <div className="px-3 py-1 text-ivory/60">
                Page {page} of {totalPages}
              </div>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 border border-white/10 disabled:opacity-30 hover:bg-white/5 transition-colors"
                aria-label="Next Page"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {viewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-white/10 w-full max-w-3xl my-8 relative flex flex-col max-h-[90vh]" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="flex justify-between items-center p-4 border-b border-white/10 bg-neutral-900 flex-shrink-0">
              <h2 id="modal-title" className="text-lg font-playfair text-gold-primary">Invoice Preview</h2>
              <div className="flex items-center space-x-4">
                <button onClick={printInvoice} className="flex items-center space-x-2 text-xs text-ivory/80 hover:text-white transition-colors" aria-label="Print Invoice">
                  <Printer size={14} /> <span className="hidden sm:inline">Print</span>
                </button>
                <button onClick={() => setViewInvoice(null)} className="text-ivory/50 hover:text-white transition-colors" aria-label="Close Preview">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-6 sm:p-8 bg-white text-black overflow-y-auto flex-1" id="printable-invoice">
              <div className="text-center mb-8 pb-6 border-b border-gray-300">
                <h1 className="text-2xl font-bold uppercase tracking-wider mb-1">Macbello Salon & Spa</h1>
                <p className="text-sm text-gray-500 mb-4">Tax Invoice</p>
                <div className="flex flex-col sm:flex-row justify-between text-left text-sm mt-6 gap-4 sm:gap-0">
                  <div>
                    <p><strong>Invoice No:</strong> {viewInvoice.invoice_number}</p>
                    <p><strong>Date:</strong> {formatDate(viewInvoice.created_at)} {new Date(viewInvoice.created_at).toLocaleTimeString()}</p>
                    <p><strong>Branch:</strong> {viewInvoice.branch || "-"}</p>
                  </div>
                  <div className="sm:text-right">
                    <p><strong>Customer:</strong> {viewInvoice.customers?.name || "Walk-in"} {viewInvoice.customers?.status === "archived" && <span className="ml-1 bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 text-[8px] uppercase tracking-wider rounded-sm">Archived</span>}</p>
                    <p><strong>Phone:</strong> {viewInvoice.customers?.phone || "-"}</p>
                    <p><strong>Staff:</strong> {viewInvoice.created_by?.split("@")[0]}</p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm mb-8 text-left border-collapse min-w-[500px]">
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
              </div>

              <div className="flex justify-end text-sm">
                <div className="w-full sm:w-64 space-y-2">
                  <div className="flex justify-between"><span>Subtotal:</span> <span>{formatINR(parseFloat(viewInvoice.subtotal))}</span></div>
                  <div className="flex justify-between"><span>Total Tax:</span> <span>{formatINR(parseFloat(viewInvoice.total_tax))}</span></div>
                  {parseFloat(viewInvoice.discount) > 0 && (
                    <div className="flex justify-between text-red-600"><span>Discount:</span> <span>-{formatINR(parseFloat(viewInvoice.discount))}</span></div>
                  )}
                  {parseFloat(viewInvoice.points_redeemed) > 0 && (
                    <div className="flex justify-between text-red-600"><span>Loyalty Redeemed:</span> <span>-{formatINR(parseFloat(viewInvoice.points_redeemed))}</span></div>
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
