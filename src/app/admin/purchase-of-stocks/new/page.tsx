"use client";

import { useState, useEffect } from "react";
import { supabaseAdminClient } from "@/lib/supabase";
import { ArrowLeft, Save, Plus, Trash2, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/format";
import AutocompleteInput from "@/components/AutocompleteInput";

interface ProductSuggestion {
  name: string;
  lastRate: number;
  lastGst: number;
  lastMrp: number;
  lastSeller: string;
}

export default function NewEnterprisePurchasePage() {
  const router = useRouter();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Autocomplete suggestion data
  const [sellerSuggestions, setSellerSuggestions] = useState<string[]>([]);
  const [productSuggestions, setProductSuggestions] = useState<ProductSuggestion[]>([]);

  // Form Header State
  const [seller, setSeller] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [branch, setBranch] = useState("Kaduthuruthy");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    supabaseAdminClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionToken(session.access_token);
        fetchSuggestions(session.access_token);
      } else {
        setLoading(false);
        setError("Unauthorized access.");
      }
    });
  }, []);

  const fetchSuggestions = async (token: string) => {
    try {
      const res = await fetch("/api/inventory/purchase-of-stocks/suggestions", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSellerSuggestions(data.sellers);
        setProductSuggestions(data.products);
      }
    } catch (err) {
      // Suggestions are non-critical, fail silently
    } finally {
      setLoading(false);
      // Start with one blank row
      setItems([makeBlankItem()]);
    }
  };

  const makeBlankItem = () => ({
    id: Math.random().toString(),
    description_of_goods: "",
    mrp: "",
    quantity: "",
    rate: "",
    discount_percent: "",
    gst_percent: "18",
    // hint text shown below product field after a product is selected
    productHint: "",
  });

  const handleAddItem = () => {
    setItems(prev => [...prev, makeBlankItem()]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleItemChange = (id: string, field: string, value: any) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        return { ...item, [field]: value };
      })
    );
  };

  // Called ONLY when user explicitly selects a product from the dropdown
  const handleProductSelect = (id: string, productName: string) => {
    const match = productSuggestions.find(p => p.name === productName);
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;

        // Build hint string — displayed as read-only info, NOT auto-filled into fields
        const hint = match
          ? `Last Rate: ₹${match.lastRate} · GST: ${match.lastGst}% · MRP: ₹${match.lastMrp} · Supplier: ${match.lastSeller}`
          : "";

        return {
          ...item,
          description_of_goods: productName, // only fill product name
          productHint: hint,
          // ⛔ NEVER auto-fill rate, mrp, gst, qty, discount — user must enter manually
        };
      })
    );
  };

  const calculateRow = (item: any) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    const disc = parseFloat(item.discount_percent) || 0;
    const gst = parseFloat(item.gst_percent) || 0;

    const total = qty * rate;
    const amount = total - total * (disc / 100);
    const gstAmount = amount * (gst / 100);
    const grandTotal = amount + gstAmount;

    return { total, amount, gst_amount: gstAmount, grand_total: grandTotal };
  };

  const invoiceTotals = items.reduce(
    (acc, item) => {
      const r = calculateRow(item);
      return {
        grandTotal: acc.grandTotal + r.grand_total,
        totalTax: acc.totalTax + r.gst_amount,
      };
    },
    { grandTotal: 0, totalTax: 0 }
  );

  const handleSave = async () => {
    setError("");
    if (!seller.trim() || !invoiceNo.trim()) {
      setError("Please fill in Supplier Name and Invoice Number.");
      return;
    }
    if (items.length === 0) {
      setError("Please add at least one item.");
      return;
    }
    const invalid = items.find(i => !i.description_of_goods.trim() || !i.quantity || parseFloat(i.quantity) <= 0);
    if (invalid) {
      setError("All items must have a Description and a valid Quantity.");
      return;
    }
    if (!sessionToken) return;

    setSaving(true);
    try {
      const rowsToInsert = items.map(item => {
        const calcs = calculateRow(item);
        return {
          date: purchaseDate,
          seller: seller.trim(),
          invoice_no: invoiceNo.trim(),
          description_of_goods: item.description_of_goods.trim(),
          mrp: parseFloat(item.mrp) || 0,
          quantity: parseInt(item.quantity) || 0,
          rate: parseFloat(item.rate) || 0,
          discount_percent: parseFloat(item.discount_percent) || 0,
          gst_percent: parseFloat(item.gst_percent) || 0,
          total: calcs.total,
          amount: calcs.amount,
          gst_amount: calcs.gst_amount,
          grand_total: calcs.grand_total,
          branch,
          notes: notes.trim() || null,
        };
      });

      const res = await fetch("/api/inventory/purchase-of-stocks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ action: "create", rowData: rowsToInsert }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess("Invoice successfully recorded! Redirecting…");
        setTimeout(() => router.push("/admin/purchase-of-stocks"), 1500);
      } else {
        setError(data.error || "Failed to save purchase.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold-primary animate-spin" />
      </div>
    );
  }

  const inputCls =
    "w-full bg-white/5 border border-white/10 px-3 py-2 text-sm focus:border-gold-primary/50 focus:ring-1 focus:ring-gold-primary/50 outline-none transition-all";
  const smallInputCls =
    "w-full bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-right outline-none focus:border-gold-primary/50 focus:ring-1 focus:ring-gold-primary/50 transition-all";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-24">
      {/* ── Header ── */}
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/admin/purchase-of-stocks"
              className="p-2 hover:bg-white/5 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-light tracking-wide uppercase">New Entry</h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">
                Purchase Of Stocks
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-2 px-6 py-2.5 bg-gold-primary hover:bg-gold-secondary text-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 font-medium"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Entry</span>
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Alerts */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
            {success}
          </div>
        )}

        {/* ── Supplier & Invoice Details ── */}
        <div className="bg-[#111] border border-white/5 p-6">
          <h2 className="text-xs uppercase tracking-widest text-gold-primary mb-6">
            Supplier &amp; Invoice Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Supplier — autocomplete, selection-only fill */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2">
                Supplier Name *
              </label>
              <AutocompleteInput
                value={seller}
                onChange={setSeller}
                suggestions={sellerSuggestions}
                placeholder="e.g. ROYAL DISTRIBUTORS"
                className={inputCls}
              />
              <p className="mt-1 text-[9px] text-gray-600">
                Type to search existing suppliers or enter a new one.
              </p>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2">
                Invoice Number *
              </label>
              <input
                type="text"
                value={invoiceNo}
                onChange={e => setInvoiceNo(e.target.value)}
                className={`${inputCls} font-mono`}
                placeholder="INV-001"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2">
                Purchase Date
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2">
                Branch
              </label>
              <select
                value={branch}
                onChange={e => setBranch(e.target.value)}
                className={`${inputCls} appearance-none`}
              >
                <option value="Kaduthuruthy" className="bg-black">Kaduthuruthy</option>
                <option value="Ettumanoor" className="bg-black">Ettumanoor</option>
                <option value="Peruva" className="bg-black">Peruva</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Items ── */}
        <div className="bg-[#111] border border-white/5 p-6">
          <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
            <h2 className="text-xs uppercase tracking-widest text-gold-primary">Item Details</h2>
            <button
              onClick={handleAddItem}
              className="flex items-center space-x-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] uppercase tracking-widest transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>Add Item</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-gray-400 border-b border-white/10">
                  <th className="pb-3 px-2 font-normal min-w-[220px]">Description of Goods</th>
                  <th className="pb-3 px-2 font-normal text-right w-24">MRP</th>
                  <th className="pb-3 px-2 font-normal text-right w-20">Qty *</th>
                  <th className="pb-3 px-2 font-normal text-right w-24">Rate</th>
                  <th className="pb-3 px-2 font-normal text-right w-20">Disc %</th>
                  <th className="pb-3 px-2 font-normal text-right w-20">GST %</th>
                  <th className="pb-3 px-2 font-normal text-right w-28">Line Total</th>
                  <th className="pb-3 px-2 font-normal text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.map(item => {
                  const calcs = calculateRow(item);
                  const productNames = productSuggestions.map(p => p.name);

                  return (
                    <tr key={item.id} className="hover:bg-white/[0.015] align-top">
                      {/* Description — autocomplete, fills name only on selection */}
                      <td className="py-3 px-2">
                        <AutocompleteInput
                          value={item.description_of_goods}
                          onChange={val => handleItemChange(item.id, "description_of_goods", val)}
                          onSelect={val => handleProductSelect(item.id, val)}
                          suggestions={productNames}
                          placeholder="e.g. IGORA 6-65 60ML"
                          className="w-full bg-white/5 border border-white/10 px-2 py-1.5 text-xs outline-none focus:border-gold-primary/50 focus:ring-1 focus:ring-gold-primary/50 transition-all"
                        />
                        {/* Hint — shown below field after product selection, read-only */}
                        {item.productHint && (
                          <p className="mt-1 text-[9px] text-amber-500/70 leading-relaxed">
                            ℹ {item.productHint}
                          </p>
                        )}
                      </td>

                      <td className="py-3 px-2">
                        <input
                          type="number"
                          value={item.mrp}
                          onChange={e => handleItemChange(item.id, "mrp", e.target.value)}
                          className={smallInputCls}
                          placeholder="0.00"
                          min="0"
                        />
                      </td>

                      <td className="py-3 px-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e => handleItemChange(item.id, "quantity", e.target.value)}
                          className={smallInputCls}
                          placeholder="1"
                          min="1"
                        />
                      </td>

                      <td className="py-3 px-2">
                        <input
                          type="number"
                          value={item.rate}
                          onChange={e => handleItemChange(item.id, "rate", e.target.value)}
                          className={smallInputCls}
                          placeholder="0.00"
                          min="0"
                        />
                      </td>

                      <td className="py-3 px-2">
                        <input
                          type="number"
                          value={item.discount_percent}
                          onChange={e =>
                            handleItemChange(item.id, "discount_percent", e.target.value)
                          }
                          className={smallInputCls}
                          placeholder="0"
                          min="0"
                          max="100"
                        />
                      </td>

                      <td className="py-3 px-2">
                        <input
                          type="number"
                          value={item.gst_percent}
                          onChange={e => handleItemChange(item.id, "gst_percent", e.target.value)}
                          className={smallInputCls}
                          placeholder="18"
                          min="0"
                        />
                      </td>

                      {/* Auto-calculated line total — read-only display */}
                      <td className="py-3 px-2 text-right">
                        <div className="font-mono text-gold-primary">
                          {formatINR(calcs.grand_total)}
                        </div>
                        <div className="text-[9px] text-gray-500 mt-0.5">
                          Tax: {formatINR(calcs.gst_amount)}
                        </div>
                      </td>

                      <td className="py-3 px-2 text-center">
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={items.length === 1}
                          className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors disabled:opacity-30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Totals ── */}
        <div className="flex justify-end">
          <div className="w-full md:w-80 bg-[#111] border border-white/5 p-6">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-400 text-xs">
                <span>Total GST</span>
                <span className="font-mono">{formatINR(invoiceTotals.totalTax)}</span>
              </div>
              <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                <span className="text-[10px] uppercase tracking-widest text-gold-primary">
                  Invoice Total
                </span>
                <span className="text-xl font-light font-mono">
                  {formatINR(invoiceTotals.grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Notes ── */}
        <div className="bg-[#111] border border-white/5 p-6">
          <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm focus:border-gold-primary/50 focus:ring-1 focus:ring-gold-primary/50 outline-none transition-all resize-none"
            placeholder="Any remarks about this invoice…"
          />
        </div>
      </div>
    </div>
  );
}
