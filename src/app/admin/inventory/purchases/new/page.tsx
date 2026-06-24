"use client";

import { useState, useEffect } from "react";
import { supabaseAdminClient } from "@/lib/supabase";
import { ArrowLeft, Save, Plus, Trash2, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/format";

interface CatalogItem {
  id: string;
  name: string;
  category: string;
}

export default function NewStockPurchasePage() {
  const router = useRouter();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);

  // Form State
  const [supplierName, setSupplierName] = useState("");
  const [supplierGstin, setSupplierGstin] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [branch, setBranch] = useState("Kaduthuruthy");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    supabaseAdminClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionToken(session.access_token);
        fetchCatalog(session.access_token);
      } else {
        setLoading(false);
        setError("Unauthorized access.");
      }
    });
  }, []);

  const fetchCatalog = async (token: string) => {
    try {
      const res = await fetch("/api/billing/admin?action=get_services", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCatalog(data.services || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      // Add first empty row
      if (items.length === 0) {
        handleAddItem();
      }
    }
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: Math.random().toString(),
        product_id: "",
        mrp: 0,
        quantity: 1,
        purchase_rate: 0,
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
    const rate = parseFloat(item.purchase_rate) || 0;
    const discPct = parseFloat(item.discount_percent) || 0;
    const gstPct = parseFloat(item.gst_percent) || 0;

    const gross = qty * rate;
    const discAmt = gross * (discPct / 100);
    const taxable = gross - discAmt;
    const gstAmt = taxable * (gstPct / 100);
    const total = taxable + gstAmt;

    return { gross, discAmt, taxable, gstAmt, total };
  };

  // Summary Totals
  const summary = items.reduce((acc, item) => {
    const row = calculateRow(item);
    return {
      qty: acc.qty + (parseInt(item.quantity) || 0),
      gross: acc.gross + row.gross,
      disc: acc.disc + row.discAmt,
      taxable: acc.taxable + row.taxable,
      gst: acc.gst + row.gstAmt,
      total: acc.total + row.total
    };
  }, { qty: 0, gross: 0, disc: 0, taxable: 0, gst: 0, total: 0 });

  const handleSave = async () => {
    setError("");
    setSuccess("");

    if (!supplierName.trim()) return setError("Supplier name is required.");
    if (!purchaseDate) return setError("Purchase date is required.");
    if (items.length === 0) return setError("At least one product must be added.");
    
    // Validate items
    for (let i = 0; i < items.length; i++) {
      if (!items[i].product_id) return setError(`Row ${i + 1}: Please select a product.`);
      if (items[i].quantity <= 0) return setError(`Row ${i + 1}: Quantity must be greater than 0.`);
      if (items[i].purchase_rate < 0) return setError(`Row ${i + 1}: Rate cannot be negative.`);
    }

    setSaving(true);
    try {
      const payload = {
        supplier_name: supplierName,
        supplier_gstin: supplierGstin,
        supplier_phone: supplierPhone,
        supplier_address: supplierAddress,
        invoice_number: invoiceNumber,
        purchase_date: purchaseDate,
        branch,
        notes,
        items: items.map(i => ({
          product_id: i.product_id,
          mrp: i.mrp,
          quantity: i.quantity,
          purchase_rate: i.purchase_rate,
          discount_percent: i.discount_percent,
          gst_percent: i.gst_percent
        }))
      };

      const res = await fetch("/api/inventory/purchases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(`Purchase saved successfully! PO Number: ${data.purchase_number}`);
        setTimeout(() => {
          router.push("/admin/inventory");
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
            <Link href="/admin/inventory" className="p-2 hover:bg-white/5 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-light tracking-wide uppercase">New Stock Purchase</h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Manual Invoice Entry</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center space-x-2 px-6 py-2.5 bg-gold-primary hover:bg-gold-secondary text-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 font-medium"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save & Update Stock</span>
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
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm focus:border-gold-primary/50 focus:ring-1 focus:ring-gold-primary/50 outline-none transition-all"
                placeholder="e.g. KANAKAMTHADATHIL EXPORTS"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2">Invoice Number</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm focus:border-gold-primary/50 focus:ring-1 focus:ring-gold-primary/50 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2">Purchase Date *</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm focus:border-gold-primary/50 focus:ring-1 focus:ring-gold-primary/50 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2">Branch Receiving Stock *</label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm focus:border-gold-primary/50 focus:ring-1 focus:ring-gold-primary/50 outline-none transition-all appearance-none"
              >
                <option value="MACBELLO" className="bg-black">MACBELLO</option>
                <option value="Kaduthuruthy" className="bg-black">Kaduthuruthy</option>
                <option value="Ettumanoor" className="bg-black">Ettumanoor</option>
                <option value="Peruva" className="bg-black">Peruva</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2">Supplier GSTIN</label>
              <input
                type="text"
                value={supplierGstin}
                onChange={(e) => setSupplierGstin(e.target.value)}
                className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm focus:border-gold-primary/50 focus:ring-1 focus:ring-gold-primary/50 outline-none transition-all"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm focus:border-gold-primary/50 focus:ring-1 focus:ring-gold-primary/50 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Product Table */}
        <div className="bg-[#111] border border-white/5 rounded-sm overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-widest text-gold-primary">Items Received</h2>
            <button
              onClick={handleAddItem}
              className="flex items-center space-x-1 px-3 py-1.5 border border-white/10 hover:border-gold-primary/50 hover:text-gold-primary text-[10px] uppercase tracking-widest transition-all"
            >
              <Plus className="w-3 h-3" />
              <span>Add Row</span>
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] uppercase tracking-widest text-gray-400">
                  <th className="px-4 py-3 font-normal min-w-[250px]">Product / Description *</th>
                  <th className="px-4 py-3 font-normal w-24">MRP</th>
                  <th className="px-4 py-3 font-normal w-20">Qty *</th>
                  <th className="px-4 py-3 font-normal w-24">Rate *</th>
                  <th className="px-4 py-3 font-normal w-24">Gross</th>
                  <th className="px-4 py-3 font-normal w-20">Disc %</th>
                  <th className="px-4 py-3 font-normal w-24">Taxable</th>
                  <th className="px-4 py-3 font-normal w-20">GST %</th>
                  <th className="px-4 py-3 font-normal w-24">Total</th>
                  <th className="px-4 py-3 font-normal w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.map((item, index) => {
                  const row = calculateRow(item);
                  return (
                    <tr key={item.id} className="hover:bg-white/[0.01]">
                      <td className="px-4 py-2">
                        <select
                          value={item.product_id}
                          onChange={(e) => handleItemChange(item.id, "product_id", e.target.value)}
                          className="w-full bg-white/5 border border-white/10 px-2 py-1.5 text-xs outline-none focus:border-gold-primary/50"
                        >
                          <option value="" className="bg-black">Select Product...</option>
                          {catalog.map(c => (
                            <option key={c.id} value={c.id} className="bg-black">
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="0"
                          value={item.mrp}
                          onChange={(e) => handleItemChange(item.id, "mrp", e.target.value)}
                          className="w-full bg-white/5 border border-white/10 px-2 py-1.5 text-xs outline-none"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(item.id, "quantity", e.target.value)}
                          className="w-full bg-white/5 border border-white/10 px-2 py-1.5 text-xs outline-none text-center"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.purchase_rate}
                          onChange={(e) => handleItemChange(item.id, "purchase_rate", e.target.value)}
                          className="w-full bg-white/5 border border-white/10 px-2 py-1.5 text-xs outline-none text-right"
                        />
                      </td>
                      <td className="px-4 py-2 text-right text-gray-400 font-mono text-xs">
                        {row.gross.toFixed(2)}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={item.discount_percent}
                          onChange={(e) => handleItemChange(item.id, "discount_percent", e.target.value)}
                          className="w-full bg-white/5 border border-white/10 px-2 py-1.5 text-xs outline-none text-right"
                        />
                      </td>
                      <td className="px-4 py-2 text-right text-gray-400 font-mono text-xs">
                        {row.taxable.toFixed(2)}
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={item.gst_percent}
                          onChange={(e) => handleItemChange(item.id, "gst_percent", e.target.value)}
                          className="w-full bg-white/5 border border-white/10 px-2 py-1.5 text-xs outline-none"
                        >
                          <option value="0" className="bg-black">0%</option>
                          <option value="5" className="bg-black">5%</option>
                          <option value="12" className="bg-black">12%</option>
                          <option value="18" className="bg-black">18%</option>
                          <option value="28" className="bg-black">28%</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-right text-gold-primary font-mono text-xs">
                        {row.total.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
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

        {/* Summary Footer */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="p-4 border border-white/5 bg-[#111] text-xs text-gray-400 leading-relaxed">
            <p className="uppercase tracking-widest text-[10px] text-white mb-2">Instructions</p>
            <p>• Only existing products from the catalog can be selected. If a product is missing, add it to the Catalog first.</p>
            <p>• GST amounts and Net Totals are calculated automatically based on Rate and Discount.</p>
            <p>• Saving this purchase will permanently increase the stock count for the selected branch.</p>
          </div>

          <div className="bg-[#111] border border-white/5 p-6 rounded-sm">
            <div className="space-y-3 font-mono text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Total Quantity</span>
                <span>{summary.qty}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Gross Total</span>
                <span>{formatINR(summary.gross)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Total Discount</span>
                <span>- {formatINR(summary.disc)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Taxable Amount</span>
                <span>{formatINR(summary.taxable)}</span>
              </div>
              <div className="flex justify-between text-gray-400 border-b border-white/10 pb-3">
                <span>Total GST</span>
                <span>+ {formatINR(summary.gst)}</span>
              </div>
              <div className="flex justify-between text-gold-primary text-lg pt-1 font-bold">
                <span>Grand Total</span>
                <span>{formatINR(summary.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
