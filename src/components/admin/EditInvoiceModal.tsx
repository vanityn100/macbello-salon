import { formatGst } from '@/lib/gst';
"use client";

import { useState, useEffect } from "react";
import { X, Search, Plus, Trash2, Loader2, Save } from "lucide-react";
import { recalculateInvoiceTotals } from "@/lib/invoiceUtils";

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  category: "Service" | "Retail";
  tax_rate: number;
  item_code: string | null;
  hsn: string | null;
}

interface CartItem {
  item: ServiceItem;
  quantity: number;
  staffContribution?: string;
  unit_price?: number;
}

interface EditInvoiceModalProps {
  invoiceId: string;
  sessionToken: string;
  onClose: () => void;
  onSuccess: (updatedInvoice: any) => void;
}

export default function EditInvoiceModal({ invoiceId, sessionToken, onClose, onSuccess }: EditInvoiceModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  // Invoice state
  const [invoice, setInvoice] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [manualDiscount, setManualDiscount] = useState("");
  const [pointsToRedeem, setPointsToRedeem] = useState("");
  const [editReason, setEditReason] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  
  // Catalog state
  const [catalog, setCatalog] = useState<ServiceItem[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");

  useEffect(() => {
    fetchInvoiceAndCatalog();
  }, [invoiceId]);

  const fetchInvoiceAndCatalog = async () => {
    setLoading(true);
    console.log(`[EditInvoiceModal] Starting fetch for invoice ID: ${invoiceId}`);
    try {
      // 1. Fetch catalog
      const catRes = await fetch("/api/billing/admin?action=get_services", {
        headers: { "Authorization": `Bearer ${sessionToken}` }
      });
      const catData = await catRes.json();
      if (catData.success && catData.services) {
        setCatalog(catData.services);
      }

      // 2. Fetch full invoice details from the updated admin GET API
      const invRes = await fetch(`/api/billing/admin?action=get_invoice&id=${invoiceId}`, {
        headers: { "Authorization": `Bearer ${sessionToken}` }
      });
      const invData = await invRes.json();
      
      console.log(`[EditInvoiceModal] API Response for get_invoice:`, invData);
      
      let foundInvoice = null;
      if (invData.success && invData.invoice) {
        foundInvoice = invData.invoice;
      }

      if (!foundInvoice) {
        console.error(`[EditInvoiceModal] Could not find invoice. invData:`, invData);
        setError("Could not load invoice details.");
        setLoading(false);
        return;
      }

      setInvoice(foundInvoice);
      setPaymentMethod(foundInvoice.payment_method || "Cash");
      setManualDiscount(foundInvoice.discount?.toString() || "");
      setPointsToRedeem(foundInvoice.points_redeemed?.toString() || "");
      setCustomerName(foundInvoice.customers?.name || "");
      setCustomerPhone(foundInvoice.customers?.phone || "");

      const dbItems = foundInvoice.invoice_items || [];
      console.log(`[EditInvoiceModal] Number of invoice items returned: ${dbItems.length}`);

      // Map existing items to cart format
      const initialCart: CartItem[] = dbItems.map((dbItem: any) => {
        return {
          quantity: dbItem.quantity,
          staffContribution: dbItem.staff_contribution || "",
          unit_price: parseFloat(dbItem.unit_price),
          item: {
            id: dbItem.item_code || dbItem.item_name, // fallback
            name: dbItem.item_name,
            price: parseFloat(dbItem.unit_price),
            category: dbItem.category as "Service" | "Retail",
            tax_rate: parseFloat(dbItem.tax_rate),
            item_code: dbItem.item_code,
            hsn: dbItem.hsn
          }
        };
      });
      setCart(initialCart);
    } catch (err) {
      console.error("[EditInvoiceModal] Exception thrown during fetch:", err);
      setError("Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (service: ServiceItem) => {
    const existing = cart.find(c => c.item.name === service.name);
    if (existing) {
      setCart(cart.map(c => c.item.name === service.name ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { item: service, quantity: 1, unit_price: service.price }]);
    }
  };

  const updateQuantity = (idx: number, qty: number) => {
    if (qty < 1) return;
    const newCart = [...cart];
    newCart[idx].quantity = qty;
    setCart(newCart);
  };
  
  const updatePrice = (idx: number, price: number) => {
    if (price < 0) return;
    const newCart = [...cart];
    newCart[idx].unit_price = price;
    setCart(newCart);
  };

  const removeFromCart = (idx: number) => {
    const newCart = [...cart];
    newCart.splice(idx, 1);
    setCart(newCart);
  };

  // Preview Calculation
  let previewTotals = { subtotal: 0, total_tax: 0, grand_total: 0 };
  try {
    const itemsInput = cart.map(c => ({
      quantity: c.quantity,
      unit_price: c.unit_price ?? c.item.price,
      tax_rate: c.item.tax_rate
    }));
    previewTotals = recalculateInvoiceTotals(
      itemsInput, 
      parseFloat(manualDiscount) || 0, 
      parseInt(pointsToRedeem, 10) || 0
    );
  } catch (e) {
    // Math error in preview
  }

  const handleSave = async () => {
    if (cart.length === 0) {
      setError("Invoice must have at least one item.");
      return;
    }
    if (!editReason.trim()) {
      setError("You must provide a reason for editing this invoice.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        action: "edit_invoice",
        invoiceId,
        editReason,
        paymentMethod,
        discountAmount: manualDiscount,
        pointsToRedeem,
        customerName,
        customerPhone,
        items: cart.map(c => ({
          item_name: c.item.name,
          category: c.item.category,
          quantity: c.quantity,
          unit_price: c.unit_price ?? c.item.price,
          tax_rate: c.item.tax_rate,
          item_code: c.item.item_code,
          hsn: c.item.hsn,
          staff_contribution: c.staffContribution || "",
          product_id: c.item.category === "Retail" ? c.item.id : null
        }))
      };

      const res = await fetch("/api/billing/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sessionToken}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save invoice edits.");
      }

      onSuccess(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const filteredCatalog = catalog.filter(c => 
    c.name.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-neutral-900 border border-white/10 w-full max-w-5xl my-8 relative flex flex-col max-h-[90vh]" role="dialog">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-white/10 bg-neutral-900 flex-shrink-0">
          <div className="flex flex-col space-y-2 w-1/2">
            <h2 className="text-lg font-playfair text-gold-primary">Edit Invoice {invoice?.invoice_number}</h2>
            {invoice?.customers && (
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer Name"
                  className="bg-black border border-white/10 text-white text-xs px-2 py-1 rounded w-full"
                />
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone"
                  className="bg-black border border-white/10 text-white text-xs px-2 py-1 rounded w-full"
                />
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-ivory/50 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center items-center flex-1">
            <Loader2 className="w-8 h-8 animate-spin text-gold-primary" />
          </div>
        ) : (
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            
            {/* Left: Catalog */}
            <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-white/10 bg-neutral-900/50 flex flex-col h-[40vh] md:h-auto">
              <div className="p-4 border-b border-white/10">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ivory/40" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search catalog..." 
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="w-full bg-luxury-black border border-white/10 rounded-none pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-gold-primary transition-colors"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
                {filteredCatalog.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-white/[0.02] border border-white/5 hover:border-gold-primary/30 transition-colors group">
                    <div>
                      <div className="text-sm text-white group-hover:text-gold-primary transition-colors">{item.name}</div>
                      <div className="text-[10px] text-ivory/50 uppercase tracking-wider mt-1">{item.category} • ₹{item.price}</div>
                    </div>
                    <button 
                      onClick={() => addToCart(item)}
                      className="p-1.5 bg-white/5 text-ivory hover:text-white hover:bg-gold-primary transition-all"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Cart & Editor */}
            <div className="w-full md:w-2/3 flex flex-col h-[50vh] md:h-auto bg-luxury-black">
              <div className="flex-1 overflow-y-auto p-4 no-scrollbar space-y-3">
                {cart.length === 0 ? (
                  <div className="text-center text-ivory/40 py-12 text-sm">Invoice is empty.</div>
                ) : (
                  cart.map((c, idx) => (
                    <div key={idx} className="bg-neutral-900 border border-white/10 p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="text-sm font-medium text-white">{c.item.name}</div>
                          <div className="text-[10px] text-ivory/50 uppercase tracking-wider">{c.item.category}</div>
                        </div>
                        <button onClick={() => removeFromCart(idx)} className="text-red-400/70 hover:text-red-400 p-1"><Trash2 size={14} /></button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] text-ivory/40 uppercase tracking-wider mb-1">Quantity</label>
                          <input 
                            type="number" min="1" 
                            value={c.quantity} 
                            onChange={(e) => updateQuantity(idx, parseInt(e.target.value) || 1)}
                            className="w-full bg-black/50 border border-white/10 px-2 py-1.5 text-sm text-white focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-ivory/40 uppercase tracking-wider mb-1">Unit Price (₹)</label>
                          <input 
                            type="number" min="0" step="0.01"
                            value={c.unit_price ?? c.item.price} 
                            onChange={(e) => updatePrice(idx, parseFloat(e.target.value) || 0)}
                            className="w-full bg-black/50 border border-white/10 px-2 py-1.5 text-sm text-white focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Editor Footer */}
              <div className="border-t border-white/10 bg-neutral-900 p-4 shrink-0">
                {error && <div className="mb-4 text-xs text-red-400 bg-red-400/10 p-2 border border-red-400/20">{error}</div>}
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-[10px] text-ivory/40 uppercase tracking-wider mb-1">Manual Discount (₹)</label>
                    <input 
                      type="number" min="0" value={manualDiscount} onChange={(e) => setManualDiscount(e.target.value)}
                      className="w-full bg-luxury-black border border-white/10 px-2 py-1.5 text-sm text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-ivory/40 uppercase tracking-wider mb-1">Loyalty Points (₹)</label>
                    <input 
                      type="number" min="0" value={pointsToRedeem} onChange={(e) => setPointsToRedeem(e.target.value)}
                      className="w-full bg-luxury-black border border-white/10 px-2 py-1.5 text-sm text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-ivory/40 uppercase tracking-wider mb-1">Payment Method</label>
                    <select 
                      value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-luxury-black border border-white/10 px-2 py-1.5 text-sm text-white focus:outline-none"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                      <option value="UPI">UPI</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gold-primary uppercase tracking-wider mb-1">Grand Total</label>
                    <div className="currency-value text-lg font-bold text-white px-2 py-1">₹{previewTotals.grand_total.toFixed(2)}</div>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-[10px] text-ivory/40 uppercase tracking-wider mb-1">Reason for Edit <span className="text-red-400">*</span></label>
                  <input 
                    type="text" value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="E.g., Corrected quantity"
                    className="w-full bg-luxury-black border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-primary"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm text-ivory/60 hover:text-white transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving} className="flex items-center space-x-2 bg-gold-primary text-black px-6 py-2 text-sm font-medium hover:bg-gold-light transition-colors disabled:opacity-50">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
