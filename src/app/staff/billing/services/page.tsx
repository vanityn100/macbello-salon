"use client";

import { useState, useEffect } from "react";
import { supabaseStaffClient, supabaseAdminClient } from "@/lib/supabase";
import { 
  ArrowLeft, Edit2, Trash2, Loader2, Sparkles, AlertCircle, ShoppingBag, Scissors
} from "lucide-react";
import Link from "next/link";

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  category: "Service" | "Retail";
  tax_rate: number;
  item_code: string | null;
  hsn: string | null;
}

const getNextItemCode = (itemsList: ServiceItem[]) => {
  let maxNum = 0;
  for (const item of itemsList) {
    if (item.item_code) {
      const match = item.item_code.match(/^MAC(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    }
  }
  const nextNum = maxNum + 1;
  return `MAC${String(nextNum).padStart(3, '0')}`;
};

export default function ServicesManagement() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [staffEmail, setStaffEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  const [items, setItems] = useState<ServiceItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<"Service" | "Retail">("Service");
  const [itemCode, setItemCode] = useState("");
  const [hsn, setHsn] = useState("");
  const [gstRate, setGstRate] = useState("5");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const loadItems = async (token: string) => {
    try {
      const res = await fetch("/api/billing/admin?action=get_services", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const fetched = data.services || [];
        setItems(fetched);
        setItemCode(getNextItemCode(fetched));
      } else {
        setAuthError(data.error || "Failed to load database items.");
      }
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        setAuthError("Network error. Please check your connection and try again.");
      } else {
        setAuthError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      // Try staff client first
      let { data: { session } } = await supabaseStaffClient.auth.getSession();
      
      // If no staff session, check admin client session
      if (!session) {
        const adminSession = await supabaseAdminClient.auth.getSession();
        session = adminSession.data.session;
      }

      if (session) {
        const role = session.user?.app_metadata?.role;
        if (role === "staff" || role === "admin") {
          setSessionToken(session.access_token);
          setStaffEmail(session.user?.email || null);
          loadItems(session.access_token);
        } else {
          setLoading(false);
          setAuthError("Access denied. You do not have permission.");
        }
      } else {
        setLoading(false);
        setAuthError("You must be logged in as staff or admin to access this page.");
      }
    };

    checkAuth();

    // Listen to changes on both clients to handle sign outs/logins
    const subStaff = supabaseStaffClient.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const role = session.user?.app_metadata?.role;
        if (role === "staff" || role === "admin") {
          setSessionToken(session.access_token);
          setStaffEmail(session.user?.email || null);
          loadItems(session.access_token);
        }
      } else {
        setSessionToken(null);
        setStaffEmail(null);
        setItems([]);
        setLoading(false);
      }
    });

    const subAdmin = supabaseAdminClient.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const role = session.user?.app_metadata?.role;
        if (role === "admin") {
          setSessionToken(session.access_token);
          setStaffEmail(session.user?.email || null);
          loadItems(session.access_token);
        }
      }
    });

    return () => {
      subStaff.data.subscription.unsubscribe();
      subAdmin.data.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    setIsSubmitting(true);

    if (!name.trim()) {
      setFormError("Name is required.");
      setIsSubmitting(false);
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setFormError("Price must be a valid positive number.");
      setIsSubmitting(false);
      return;
    }

    try {
      const url = "/api/billing/admin";
      const gstPercent = parseFloat(gstRate) / 100;
      const taxablePrice = priceNum / (1 + gstPercent);
      const payload = editingId 
        ? { action: "edit_service", id: editingId, name, price: taxablePrice, category, itemCode, hsn, taxRate: gstPercent }
        : { action: "create_service", name, price: taxablePrice, category, itemCode, hsn, taxRate: gstPercent };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify(payload)
      });

      const result = await res.json();

      if (!res.ok) {
        setFormError(result.error || "Operation failed.");
      } else {
        setFormSuccess(editingId ? "Item updated successfully!" : "Item created successfully!");
        setName("");
        setPrice("");
        setCategory("Service");
        setItemCode("");
        setHsn("");
        setGstRate("5");
        setEditingId(null);
        loadItems(sessionToken!);
      }
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        setFormError("Network error. Please check your connection and try again.");
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditInit = (item: ServiceItem) => {
    setEditingId(item.id);
    setName(item.name);
    setPrice((item.price * (1 + item.tax_rate)).toFixed(2));
    setCategory(item.category);
    setItemCode(item.item_code || "");
    setHsn(item.hsn || "");
    setGstRate((item.tax_rate * 100).toString());
    setFormError("");
    setFormSuccess("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName("");
    setPrice("");
    setCategory("Service");
    setItemCode(getNextItemCode(items));
    setHsn("");
    setGstRate("5");
    setFormError("");
    setFormSuccess("");
  };

  const handleDelete = async (id: string, itemName: string) => {
    if (!confirm(`Are you sure you want to delete "${itemName}"?`)) return;

    try {
      const res = await fetch("/api/billing/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          action: "delete_service",
          id
        })
      });

      const result = await res.json();

      if (!res.ok) {
        alert(result.error || "Failed to delete item.");
      } else {
        loadItems(sessionToken!);
      }
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        alert("Network error. Please check your connection and try again.");
      } else {
        alert("Something went wrong. Please try again.");
      }
    }
  };

  const filteredServices = items.filter(
    (i) => i.category === "Service" && i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredRetail = items.filter(
    (i) => i.category === "Retail" && i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-luxury-black flex items-center justify-center">
        <Loader2 size={36} className="animate-spin text-gold-primary" />
      </div>
    );
  }

  if (authError || !sessionToken) {
    return (
      <main className="min-h-screen bg-luxury-black flex items-center justify-center px-6">
        <div className="max-w-md w-full border border-gold-primary/20 bg-white/[0.01] p-8 text-center relative shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-4" />
          <h1 className="font-playfair text-xl text-white font-light mb-2">Access Denied</h1>
          <p className="text-xs text-ivory/60 font-light mb-6">{authError || "Please log in on the staff page."}</p>
          <Link
            href="/staff"
            className="inline-block text-xs uppercase tracking-widest bg-gold-primary hover:bg-gold-dark text-luxury-black px-6 py-3 font-semibold transition-colors"
          >
            Go to Staff Login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-luxury-black text-white px-6 py-12 md:py-20 relative">
      <div className="absolute top-[10%] left-[10%] w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(212,175,55,0.015),transparent_70%)] pointer-events-none" />

      <div className="max-w-6xl mx-auto z-10 relative">
        
        {/* Back Link */}
        <div className="mb-6">
          <Link 
            href="/staff" 
            className="inline-flex items-center text-xs text-ivory/60 hover:text-gold-primary transition-colors uppercase tracking-wider"
          >
            <ArrowLeft size={14} className="mr-1.5" />
            Back to Dashboard
          </Link>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/5 pb-6 mb-10 gap-4">
          <div>
            <span className="text-[9px] uppercase tracking-[0.25em] text-gold-primary mb-1.5 block">
              Prestige Catalog
            </span>
            <h1 className="font-playfair text-2xl md:text-3xl font-light tracking-wide">
              Services & Products
            </h1>
            <p className="text-[10px] text-ivory/40 font-light mt-1 uppercase tracking-wider">
              Managing database for: <span className="text-gold-primary/80">{staffEmail}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Form Side */}
          <div className="border border-white/5 bg-white/[0.01] p-6 relative h-fit">
            {/* Corners */}
            <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-gold-primary/30" />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-gold-primary/30" />
            <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-gold-primary/30" />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-gold-primary/30" />

            <h2 className="font-playfair text-lg text-white font-medium tracking-wide mb-6 flex items-center">
              <Sparkles size={16} className="text-gold-primary mr-2" />
              <span>{editingId ? "Edit Catalog Item" : "Add Catalog Item"}</span>
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex flex-col">
                <label className="text-[9px] uppercase tracking-wider text-ivory/40 mb-1.5">Item Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Luxury Haircut / Styling Styling Gel"
                  className="bg-luxury-black border border-white/10 px-4 py-2.5 text-xs tracking-wider text-white placeholder-ivory/20 rounded-none focus:outline-none focus:border-gold-primary/50 transition-colors"
                  required
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[9px] uppercase tracking-wider text-ivory/40 mb-1.5">Category</label>
                <div className="flex border border-white/10">
                  <button
                    type="button"
                    onClick={() => { setCategory("Service"); setGstRate("5"); }}
                    className={`flex-1 py-2 text-center text-[10px] uppercase tracking-wider font-semibold cursor-pointer transition-colors ${
                      category === "Service" ? "bg-gold-primary text-luxury-black" : "bg-transparent text-ivory/60 hover:text-ivory"
                    }`}
                  >
                    Service
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCategory("Retail"); setGstRate("18"); }}
                    className={`flex-1 py-2 text-center text-[10px] uppercase tracking-wider font-semibold cursor-pointer transition-colors ${
                      category === "Retail" ? "bg-gold-primary text-luxury-black" : "bg-transparent text-ivory/60 hover:text-ivory"
                    }`}
                  >
                    Retail Product
                  </button>
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-[9px] uppercase tracking-wider text-ivory/40 mb-1.5">Selling Price (GST Included) (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 750"
                  className="bg-luxury-black border border-white/10 px-4 py-2.5 text-xs tracking-wider text-white placeholder-ivory/20 rounded-none focus:outline-none focus:border-gold-primary/50 transition-colors"
                  required
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[9px] uppercase tracking-wider text-ivory/40 mb-1.5">GST Rate (%)</label>
                <select
                  value={gstRate}
                  onChange={(e) => setGstRate(e.target.value)}
                  className="bg-luxury-black border border-white/10 px-4 py-2.5 text-xs text-white rounded-none focus:outline-none focus:border-gold-primary/50 cursor-pointer"
                >
                  <option value="0">0% (GST Exempt)</option>
                  <option value="3">3% GST</option>
                  <option value="5">5% GST (CGST 2.5% + SGST 2.5%)</option>
                  <option value="12">12% GST (CGST 6% + SGST 6%)</option>
                  <option value="18">18% GST (CGST 9% + SGST 9%)</option>
                  <option value="28">28% GST (CGST 14% + SGST 14%)</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[9px] uppercase tracking-wider text-ivory/40 mb-1.5">Item Code (Unique & Optional)</label>
                <input
                  type="text"
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value)}
                  placeholder="e.g. SERV-HAIR-01 / PROD-GEL-05"
                  className="bg-luxury-black border border-white/10 px-4 py-2.5 text-xs tracking-wider text-white placeholder-ivory/20 rounded-none focus:outline-none focus:border-gold-primary/50 transition-colors"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[9px] uppercase tracking-wider text-ivory/40 mb-1.5">HSN Code (Optional)</label>
                <input
                  type="text"
                  value={hsn}
                  onChange={(e) => setHsn(e.target.value)}
                  placeholder="e.g. 9985 / 3305"
                  className="bg-luxury-black border border-white/10 px-4 py-2.5 text-xs tracking-wider text-white placeholder-ivory/20 rounded-none focus:outline-none focus:border-gold-primary/50 transition-colors"
                />
              </div>

              {formError && (
                <p className="text-[10px] text-red-400 font-light tracking-wide">{formError}</p>
              )}
              {formSuccess && (
                <p className="text-[10px] text-green-400 font-light tracking-wide">{formSuccess}</p>
              )}

              <div className="flex gap-3">
                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="flex-1 text-center text-[10px] uppercase tracking-[0.15em] border border-white/10 hover:border-white/20 text-white font-semibold py-3 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 text-center text-[10px] uppercase tracking-[0.15em] bg-gold-primary hover:bg-gold-dark disabled:bg-gold-primary/40 text-luxury-black font-semibold py-3 transition-colors cursor-pointer flex items-center justify-center"
                >
                  {isSubmitting ? <Loader2 size={12} className="animate-spin mr-2" /> : null}
                  <span>{editingId ? "Update Item" : "Save to Catalog"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* List Side */}
          <div className="lg:col-span-2 space-y-6">

            {/* Search Input Box */}
            <div className="border border-white/5 bg-white/[0.01] p-6 relative">
              <label className="text-[10px] uppercase tracking-[0.2em] text-gold-primary mb-2 block font-medium">Search Catalog</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Type service or retail product name to filter..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-900 border border-white/10 px-3.5 py-2.5 text-xs text-white rounded-none focus:outline-none placeholder-white/20"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gold-primary hover:underline cursor-pointer font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
                       {/* Services List */}
            <div className="border border-white/5 bg-white/[0.01] p-6 relative">
              <h2 className="font-playfair text-lg text-white font-medium tracking-wide mb-6 flex items-center border-b border-white/5 pb-3">
                <Scissors size={16} className="text-gold-primary mr-2" />
                <span>Saloon Services Menu</span>
              </h2>

              {filteredServices.length === 0 ? (
                <p className="text-xs text-ivory/40 font-light py-6 text-center">
                  {searchQuery ? "No matching services found." : "No service menu items created yet."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] font-light">
                    <thead>
                      <tr className="border-b border-white/10 uppercase tracking-wider text-gold-primary text-[9px]">
                        <th className="pb-3 font-semibold">Name</th>
                        <th className="pb-3 font-semibold pr-8">Code</th>
                        <th className="pb-3 font-semibold pr-8">HSN</th>
                        <th className="pb-3 font-semibold">Base Price</th>
                        <th className="pb-3 font-semibold">Tax Rate</th>
                        <th className="pb-3 font-semibold">Sale Price</th>
                        <th className="pb-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredServices.map((item) => (
                        <tr key={item.id} className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                          <td className="py-3 text-white font-medium">{item.name}</td>
                          <td className="py-3 text-ivory/60 text-[10px] pr-8">{item.item_code || "-"}</td>
                          <td className="py-3 text-ivory/60 pr-8">{item.hsn || "-"}</td>
                          <td className="py-3 text-ivory/80">₹{item.price.toFixed(2)}</td>
                          <td className="py-3 text-ivory/40">{(item.tax_rate * 100).toFixed(0)}%</td>
                          <td className="py-3 text-white font-semibold">₹{(item.price * (1 + item.tax_rate)).toFixed(2)}</td>
                          <td className="py-3 text-right">
                            <div className="inline-flex gap-2">
                              <button
                                onClick={() => handleEditInit(item)}
                                className="p-1.5 text-ivory/60 hover:text-gold-primary transition-colors cursor-pointer"
                                title="Edit"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id, item.name)}
                                className="p-1.5 text-ivory/60 hover:text-red-400 transition-colors cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}
