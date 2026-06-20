"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
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
}

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const loadItems = async (token: string) => {
    try {
      const res = await fetch("/api/billing/admin?action=get_services", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setItems(data.services || []);
      } else {
        setAuthError(data.error || "Failed to load database items.");
      }
    } catch {
      setAuthError("Network error connecting to administrative database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionToken(session.access_token);
        setStaffEmail(session.user?.email || null);
        loadItems(session.access_token);
      } else {
        setLoading(false);
        setAuthError("You must be logged in as staff to access this page.");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSessionToken(session.access_token);
        setStaffEmail(session.user?.email || null);
        loadItems(session.access_token);
      } else {
        setSessionToken(null);
        setStaffEmail(null);
        setItems([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
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
      const payload = editingId 
        ? { action: "edit_service", id: editingId, name, price: priceNum, category }
        : { action: "create_service", name, price: priceNum, category };

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
        setEditingId(null);
        loadItems(sessionToken!);
      }
    } catch {
      setFormError("Network error submitting form.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditInit = (item: ServiceItem) => {
    setEditingId(item.id);
    setName(item.name);
    setPrice(item.price.toString());
    setCategory(item.category);
    setFormError("");
    setFormSuccess("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName("");
    setPrice("");
    setCategory("Service");
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
    } catch {
      alert("Network error deleting item.");
    }
  };

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
          <p className="text-xs text-ivory/60 font-light mb-6">{authError || "Please log in on the admin page."}</p>
          <Link
            href="/admin"
            className="inline-block text-xs uppercase tracking-widest bg-gold-primary hover:bg-gold-dark text-luxury-black px-6 py-3 font-semibold transition-colors"
          >
            Go to Admin Login
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
            href="/admin" 
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
                    onClick={() => setCategory("Service")}
                    className={`flex-1 py-2 text-center text-[10px] uppercase tracking-wider font-semibold cursor-pointer transition-colors ${
                      category === "Service" ? "bg-gold-primary text-luxury-black" : "bg-transparent text-ivory/60 hover:text-ivory"
                    }`}
                  >
                    Service (5% Tax)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategory("Retail")}
                    className={`flex-1 py-2 text-center text-[10px] uppercase tracking-wider font-semibold cursor-pointer transition-colors ${
                      category === "Retail" ? "bg-gold-primary text-luxury-black" : "bg-transparent text-ivory/60 hover:text-ivory"
                    }`}
                  >
                    Retail Product (18% Tax)
                  </button>
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-[9px] uppercase tracking-wider text-ivory/40 mb-1.5">Base Price (₹)</label>
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
            
            {/* Services List */}
            <div className="border border-white/5 bg-white/[0.01] p-6 relative">
              <h2 className="font-playfair text-lg text-white font-medium tracking-wide mb-6 flex items-center border-b border-white/5 pb-3">
                <Scissors size={16} className="text-gold-primary mr-2" />
                <span>Saloon Services (5% Tax)</span>
              </h2>

              {items.filter(i => i.category === "Service").length === 0 ? (
                <p className="text-xs text-ivory/40 font-light py-6 text-center">No service menu items created yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] font-light">
                    <thead>
                      <tr className="border-b border-white/10 uppercase tracking-wider text-gold-primary text-[9px]">
                        <th className="pb-3 font-semibold">Name</th>
                        <th className="pb-3 font-semibold">Base Price</th>
                        <th className="pb-3 font-semibold">Tax Rate</th>
                        <th className="pb-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.filter(i => i.category === "Service").map((item) => (
                        <tr key={item.id} className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                          <td className="py-3 text-white font-medium">{item.name}</td>
                          <td className="py-3 text-ivory/80">₹{item.price.toFixed(2)}</td>
                          <td className="py-3 text-ivory/40">5%</td>
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

            {/* Retail Products List */}
            <div className="border border-white/5 bg-white/[0.01] p-6 relative">
              <h2 className="font-playfair text-lg text-white font-medium tracking-wide mb-6 flex items-center border-b border-white/5 pb-3">
                <ShoppingBag size={16} className="text-gold-primary mr-2" />
                <span>Retail Products (18% Tax)</span>
              </h2>

              {items.filter(i => i.category === "Retail").length === 0 ? (
                <p className="text-xs text-ivory/40 font-light py-6 text-center">No retail products created yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] font-light">
                    <thead>
                      <tr className="border-b border-white/10 uppercase tracking-wider text-gold-primary text-[9px]">
                        <th className="pb-3 font-semibold">Name</th>
                        <th className="pb-3 font-semibold">Base Price</th>
                        <th className="pb-3 font-semibold">Tax Rate</th>
                        <th className="pb-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.filter(i => i.category === "Retail").map((item) => (
                        <tr key={item.id} className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                          <td className="py-3 text-white font-medium">{item.name}</td>
                          <td className="py-3 text-ivory/80">₹{item.price.toFixed(2)}</td>
                          <td className="py-3 text-ivory/40">18%</td>
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
