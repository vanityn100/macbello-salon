"use client";

import { useState, useEffect } from "react";
import { supabaseAdminClient } from "@/lib/supabase";
import { ArrowLeft, Save, Plus, Trash2, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/format";

export default function NewEnterprisePurchasePage() {
  const router = useRouter();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form State
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
        setLoading(false);
        handleAddItem();
      } else {
        setLoading(false);
        setError("Unauthorized access.");
      }
    });
  }, []);

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: Math.random().toString(),
        description_of_goods: "",
        mrp: 0,
        quantity: 1,
        rate: 0,
        discount_percent: 0,
        gst_percent: 18
      }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const handleItemChange = (id: string, field: string, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const calculateRow = (item: any) => {
    const qty = parseInt(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    const disc = parseFloat(item.discount_percent) || 0;
    const gst = parseFloat(item.gst_percent) || 0;

    const total = qty * rate;
    const amount = total - (total * (disc / 100));
    const gstAmount = amount * (gst / 100);
    const grandTotal = amount + gstAmount;

    return {
      total,
      amount,
      gst_amount: gstAmount,
      grand_total: grandTotal
    };
  };

  const calculateInvoiceTotals = () => {
    let grandTotal = 0;
    let totalTax = 0;
    items.forEach(i => {
      const row = calculateRow(i);
      grandTotal += row.grand_total;
      totalTax += row.gst_amount;
    });
    return { grandTotal, totalTax };
  };

  const totals = calculateInvoiceTotals();

  const handleSave = async () => {
    if (!seller || !invoiceNo || items.length === 0) {
      setError("Please fill in Supplier, Invoice Number, and add at least one item.");
      return;
    }

    // Validate items
    const invalidItem = items.find(i => !i.description_of_goods || i.quantity <= 0);
    if (invalidItem) {
      setError("Please ensure all items have a description and valid quantity.");
      return;
    }

    if (!sessionToken) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const rowsToInsert = items.map(item => {
        const calcs = calculateRow(item);
        return {
          date: purchaseDate,
          seller,
          invoice_no: invoiceNo,
          description_of_goods: item.description_of_goods,
          mrp: parseFloat(item.mrp),
          quantity: parseInt(item.quantity),
          rate: parseFloat(item.rate),
          discount_percent: parseFloat(item.discount_percent),
          gst_percent: parseFloat(item.gst_percent),
          total: calcs.total,
          amount: calcs.amount,
          gst_amount: calcs.gst_amount,
          grand_total: calcs.grand_total,
          branch,
          notes
        };
      });

      const res = await fetch("/api/inventory/purchase-of-stocks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          action: "create",
          rowData: rowsToInsert
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(`Invoice successfully recorded! Redirecting...`);
        setTimeout(() => {
          router.push("/admin/purchase-of-stocks");
        }, 1500);
      } else {
        setError(data.error || "Failed to save purchase.");
      }
    } catch (err: any) {
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/admin/purchase-of-stocks" className="p-2 hover:bg-white/5 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-light tracking-wide uppercase">New Enterprise Entry</h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Purchase Of Stocks</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center space-x-2 px-6 py-2.5 bg-gold-primary hover:bg-gold-secondary text-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 font-medium"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save & Record Entry</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
            {success}
          </div>
        )}

        {/* Invoice Details Section */}
        <div className="bg-[#111] border border-white/5 p-6 rounded-sm">
          <h2 className="text-xs uppercase tracking-widest text-gold-primary mb-6">Supplier & Invoice Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2">Supplier Name *</label>
              <input
                type="text"
                value={seller}
                onChange={(e) => setSeller(e.target.value)}
                className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm focus:border-gold-primary/50 focus:ring-1 focus:ring-gold-primary/50 outline-none transition-all"
                placeholder="e.g. KANAKAMTHADATHIL EXPORTS"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2">Invoice Number *</label>
              <input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm font-mono focus:border-gold-primary/50 focus:ring-1 focus:ring-gold-primary/50 outline-none transition-all"
                placeholder="INV-001"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2">Purchase Date</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm focus:border-gold-primary/50 focus:ring-1 focus:ring-gold-primary/50 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2">Branch</label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm focus:border-gold-primary/50 focus:ring-1 focus:ring-gold-primary/50 outline-none transition-all appearance-none"
              >
                <option value="Kaduthuruthy" className="bg-black">Kaduthuruthy</option>
                <option value="Ettumanoor" className="bg-black">Ettumanoor</option>
                <option value="Peruva" className="bg-black">Peruva</option>
              </select>
            </div>
          </div>
        </div>

        {/* Items Section */}
        <div className="bg-[#111] border border-white/5 p-6 rounded-sm">
          <div className="flex justify-between items-end mb-6 border-b border-white/5 pb-4">
            <h2 className="text-xs uppercase tracking-widest text-gold-primary">Item Details</h2>
            <button
              onClick={handleAddItem}
              className="flex items-center space-x-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-[10px] uppercase tracking-widest transition-colors border border-white/10"
            >
              <Plus className="w-3 h-3" />
              <span>Add Item</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-gray-400 border-b border-white/10">
                  <th className="pb-3 px-2 font-normal">Description of Goods</th>
                  <th className="pb-3 px-2 font-normal text-right w-24">MRP</th>
                  <th className="pb-3 px-2 font-normal text-right w-20">Qty</th>
                  <th className="pb-3 px-2 font-normal text-right w-24">Rate</th>
                  <th className="pb-3 px-2 font-normal text-right w-20">Disc %</th>
                  <th className="pb-3 px-2 font-normal text-right w-20">GST %</th>
                  <th className="pb-3 px-2 font-normal text-right w-24">Line Total</th>
                  <th className="pb-3 px-2 font-normal text-center w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.map((item, index) => {
                  const calcs = calculateRow(item);
                  return (
                    <tr key={item.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-2">
                        <input
                          type="text"
                          value={item.description_of_goods}
                          onChange={(e) => handleItemChange(item.id, 'description_of_goods', e.target.value)}
                          placeholder="e.g. IGORA 6-65 60 ML"
                          className="w-full bg-white/5 border border-white/10 px-2 py-1.5 text-xs outline-none focus:border-gold-primary"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          value={item.mrp || ""}
                          onChange={(e) => handleItemChange(item.id, 'mrp', e.target.value)}
                          className="w-full bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-right outline-none focus:border-gold-primary"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          value={item.quantity || ""}
                          onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                          className="w-full bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-right outline-none focus:border-gold-primary"
                          min="1"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          value={item.rate || ""}
                          onChange={(e) => handleItemChange(item.id, 'rate', e.target.value)}
                          className="w-full bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-right outline-none focus:border-gold-primary"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          value={item.discount_percent || ""}
                          onChange={(e) => handleItemChange(item.id, 'discount_percent', e.target.value)}
                          className="w-full bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-right outline-none focus:border-gold-primary"
                          placeholder="0"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          value={item.gst_percent || ""}
                          onChange={(e) => handleItemChange(item.id, 'gst_percent', e.target.value)}
                          className="w-full bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-right outline-none focus:border-gold-primary"
                          placeholder="18"
                        />
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="font-mono text-gold-primary">{formatINR(calcs.grand_total)}</div>
                        <div className="text-[9px] text-gray-500 mt-0.5">Tax: {formatINR(calcs.gst_amount)}</div>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                          disabled={items.length === 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals Section */}
        <div className="flex justify-end">
          <div className="w-full md:w-80 bg-[#111] border border-white/5 p-6 rounded-sm">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Total Tax (GST)</span>
                <span>{formatINR(totals.totalTax)}</span>
              </div>
              <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                <span className="text-xs uppercase tracking-widest text-gold-primary">Invoice Total</span>
                <span className="text-xl font-light text-white">{formatINR(totals.grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
