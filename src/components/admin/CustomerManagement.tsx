"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2, Search, Trash2, Edit2, ShieldAlert, RefreshCw, Archive, CheckSquare, Square, X } from "lucide-react";
import { formatINR } from "@/lib/format";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  points: number;
  branch: string | null;
  status?: "active" | "archived";
  created_at: string;
}

export default function CustomerManagement({ sessionToken }: { sessionToken: string }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "all">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [minPoints, setMinPoints] = useState("");
  const [maxPoints, setMaxPoints] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Edit Modal State
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPoints, setEditPoints] = useState("");
  const [editModalLoading, setEditModalLoading] = useState(false);
  const [editModalError, setEditModalError] = useState("");

  // Delete/Archive State
  const [deleteCandidate, setDeleteCandidate] = useState<Customer | null>(null);
  const [checkingDelete, setCheckingDelete] = useState(false);
  const [canDeleteCustomer, setCanDeleteCustomer] = useState(false);
  const [showArchivePrompt, setShowArchivePrompt] = useState(false);
  
  const [restoreCandidate, setRestoreCandidate] = useState<Customer | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/billing/admin?action=list_all_customers&statusFilter=${statusFilter}`, {
        headers: { "Authorization": `Bearer ${sessionToken}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCustomers(data.customers || []);
      }
    } catch (err) {
      console.error("Failed to load customers", err);
    } finally {
      setLoading(false);
      setSelectedIds(new Set()); // Reset selections
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [statusFilter, sessionToken]);

  // Client-side filtering (Name, Phone, Points)
  const filteredCustomers = useMemo(() => {
    return customers.filter(cust => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!cust.name.toLowerCase().includes(q) && !cust.phone.includes(q)) return false;
      }
      if (minPoints !== "" && cust.points < parseInt(minPoints)) return false;
      if (maxPoints !== "" && cust.points > parseInt(maxPoints)) return false;
      return true;
    });
  }, [customers, searchQuery, minPoints, maxPoints]);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCustomers.length && filteredCustomers.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCustomers.map(c => c.id)));
    }
  };

  // --- ACTIONS ---

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setEditModalError("");
    setEditModalLoading(true);
    try {
      const payload = {
        action: "update_customer",
        id: editingCustomer.id,
        name: editName,
        phone: editPhone,
        email: editEmail || null,
        points: parseInt(editPoints) || 0
      };
      const res = await fetch("/api/billing/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sessionToken}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEditingCustomer(null);
        fetchCustomers();
      } else {
        setEditModalError(data.error || "Update failed.");
      }
    } catch (err) {
      setEditModalError("Network error.");
    } finally {
      setEditModalLoading(false);
    }
  };

  const initiateDelete = async (cust: Customer) => {
    setDeleteCandidate(cust);
    setCheckingDelete(true);
    setShowArchivePrompt(false);
    try {
      const res = await fetch("/api/billing/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sessionToken}` },
        body: JSON.stringify({ action: "check_customer_deletable", id: cust.id })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.canDelete) {
          setCanDeleteCustomer(true);
        } else {
          setCanDeleteCustomer(false);
          setShowArchivePrompt(true);
        }
      } else {
        setDeleteCandidate(null);
        alert(data.error || "Failed to check customer status.");
      }
    } catch (err) {
      setDeleteCandidate(null);
      alert("Network error while checking delete status.");
    } finally {
      setCheckingDelete(false);
    }
  };

  const executeHardDelete = async () => {
    if (!deleteCandidate) return;
    try {
      const res = await fetch("/api/billing/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sessionToken}` },
        body: JSON.stringify({ action: "hard_delete_customer", id: deleteCandidate.id })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeleteCandidate(null);
        fetchCustomers();
      } else {
        alert(data.error || "Failed to delete customer.");
      }
    } catch (err) {
      alert("Network error.");
    }
  };

  const executeArchive = async (ids: string[]) => {
    if (!ids.length) return;
    setBulkActionLoading(true);
    try {
      const res = await fetch("/api/billing/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sessionToken}` },
        body: JSON.stringify({ action: "archive_customer", ids })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeleteCandidate(null);
        setShowArchivePrompt(false);
        fetchCustomers();
      } else {
        alert(data.error || "Failed to archive.");
      }
    } catch (err) {
      alert("Network error.");
    } finally {
      setBulkActionLoading(false);
      setSelectedIds(new Set());
    }
  };

  const executeRestore = async (ids: string[]) => {
    if (!ids.length) return;
    setBulkActionLoading(true);
    try {
      const res = await fetch("/api/billing/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sessionToken}` },
        body: JSON.stringify({ action: "restore_customer", ids })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRestoreCandidate(null);
        fetchCustomers();
      } else {
        alert(data.error || "Failed to restore.");
      }
    } catch (err) {
      alert("Network error.");
    } finally {
      setBulkActionLoading(false);
      setSelectedIds(new Set());
    }
  };

  return (
    <div className="border border-white/5 bg-white/[0.01] p-8 relative mt-8">
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-gold-primary/25" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-gold-primary/25" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-gold-primary/25" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-gold-primary/25" />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="font-playfair text-lg text-white font-medium tracking-wide">
          Registered Customers Database
        </h2>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Search Name or Phone"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-luxury-black border border-white/10 pl-9 pr-4 py-2 text-xs text-white focus:border-gold-primary/50 outline-none w-48 transition-colors"
            />
          </div>
          
          <input
            type="number"
            placeholder="Min Pts"
            value={minPoints}
            onChange={e => setMinPoints(e.target.value)}
            className="bg-luxury-black border border-white/10 px-3 py-2 text-xs text-white focus:border-gold-primary/50 outline-none w-20 transition-colors"
          />
          <input
            type="number"
            placeholder="Max Pts"
            value={maxPoints}
            onChange={e => setMaxPoints(e.target.value)}
            className="bg-luxury-black border border-white/10 px-3 py-2 text-xs text-white focus:border-gold-primary/50 outline-none w-20 transition-colors"
          />

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-luxury-black border border-white/10 px-3 py-2 text-xs text-white focus:border-gold-primary/50 outline-none cursor-pointer transition-colors"
          >
            <option value="active">Active Customers</option>
            <option value="archived">Archived Customers</option>
            <option value="all">All Customers</option>
          </select>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-gold-primary/10 border border-gold-primary/20 px-4 py-3 mb-4 flex items-center justify-between text-xs transition-all">
          <span className="text-gold-primary font-medium">{selectedIds.size} customers selected</span>
          <div className="flex space-x-3">
            {statusFilter !== "archived" && (
              <button 
                onClick={() => executeArchive(Array.from(selectedIds))}
                disabled={bulkActionLoading}
                className="flex items-center space-x-2 text-orange-400 hover:text-orange-300 transition-colors bg-orange-500/10 px-3 py-1.5 cursor-pointer"
              >
                {bulkActionLoading ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
                <span>Archive Selected</span>
              </button>
            )}
            {statusFilter !== "active" && (
              <button 
                onClick={() => executeRestore(Array.from(selectedIds))}
                disabled={bulkActionLoading}
                className="flex items-center space-x-2 text-green-400 hover:text-green-300 transition-colors bg-green-500/10 px-3 py-1.5 cursor-pointer"
              >
                {bulkActionLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                <span>Restore Selected</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={24} className="animate-spin text-gold-primary" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <p className="text-xs text-ivory/30 italic text-center py-10 border border-white/5">No customers found.</p>
        ) : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto no-scrollbar border border-white/5">
            <table className="w-full text-left text-[11px] font-light">
              <thead>
                <tr className="border-b border-white/10 uppercase text-ivory/40 text-[9px] sticky top-0 bg-neutral-900 z-10">
                  <th className="pb-3 pt-3 pl-4 w-10">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.size === filteredCustomers.length && filteredCustomers.length > 0}
                      onChange={toggleSelectAll}
                      className="accent-gold-primary cursor-pointer w-3 h-3"
                    />
                  </th>
                  <th className="pb-3 pt-3">Name</th>
                  <th className="pb-3 pt-3">Phone</th>
                  <th className="pb-3 pt-3">Loyalty Balance</th>
                  <th className="pb-3 pt-3">Status</th>
                  <th className="pb-3 pt-3">Created At</th>
                  <th className="pb-3 pt-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((cust) => {
                  const isArchived = cust.status === "archived";
                  return (
                    <tr key={cust.id} className={"border-b border-white/5 hover:bg-white/[0.02] transition-colors " + (selectedIds.has(cust.id) ? "bg-white/[0.04]" : "")}>
                      <td className="py-3 pl-4">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.has(cust.id)}
                          onChange={() => toggleSelect(cust.id)}
                          className="accent-gold-primary cursor-pointer w-3 h-3"
                        />
                      </td>
                      <td className="py-3 text-white font-medium">{cust.name}</td>
                      <td className="py-3 text-ivory/80">{cust.phone}</td>
                      <td className="py-3 text-gold-primary font-bold">{formatINR(cust.points).replace("₹", "")} Pts</td>
                      <td className="py-3">
                        {isArchived ? (
                          <span className="bg-yellow-500/20 border border-yellow-500/30 text-yellow-500 px-2 py-0.5 text-[9px] uppercase tracking-wider rounded-sm inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span> Archived</span>
                        ) : (
                          <span className="bg-green-500/10 border border-green-500/30 text-green-400 px-2 py-0.5 text-[9px] uppercase tracking-wider rounded-sm inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400"></span> Active</span>
                        )}
                      </td>
                      <td className="py-3 text-ivory/50">
                        {new Date(cust.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <div className="inline-flex space-x-2">
                          <button
                            onClick={() => {
                              setEditingCustomer(cust);
                              setEditName(cust.name);
                              setEditPhone(cust.phone);
                              setEditEmail(cust.email || "");
                              setEditPoints(cust.points.toString());
                              setEditModalError("");
                            }}
                            className="p-1.5 text-ivory/50 hover:text-gold-primary transition-colors border border-transparent hover:border-gold-primary/30 hover:bg-gold-primary/10 rounded-sm cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          
                          {isArchived ? (
                            <button
                              onClick={() => setRestoreCandidate(cust)}
                              className="p-1.5 text-ivory/50 hover:text-green-400 transition-colors border border-transparent hover:border-green-400/30 hover:bg-green-400/10 rounded-sm cursor-pointer"
                              title="Restore"
                            >
                              <RefreshCw size={14} />
                            </button>
                          ) : (
                            <button
                              onClick={() => initiateDelete(cust)}
                              className="p-1.5 text-ivory/50 hover:text-red-400 transition-colors border border-transparent hover:border-red-400/30 hover:bg-red-400/10 rounded-sm cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-luxury-black/90 backdrop-blur-md flex items-center justify-center p-6 z-[9999]">
          <div className="max-w-md w-full border border-gold-primary/20 bg-luxury-dark p-8 relative shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
            <div className="mb-6 border-b border-white/5 pb-4">
              <span className="text-[8px] uppercase tracking-[0.25em] text-gold-primary block mb-1">Administrative Action</span>
              <h3 className="font-playfair text-xl text-white font-medium">Edit Customer Details</h3>
            </div>
            <form onSubmit={handleUpdateCustomer} className="space-y-4">
              <div className="flex flex-col">
                <label className="text-[9px] uppercase tracking-wider text-ivory/50 mb-1.5">Customer Name</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-luxury-black border border-white/10 px-4 py-2.5 text-xs text-white rounded-none outline-none focus:border-gold-primary/50 transition-colors" required />
              </div>
              <div className="flex flex-col">
                <label className="text-[9px] uppercase tracking-wider text-ivory/50 mb-1.5">Phone Number</label>
                <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="bg-luxury-black border border-white/10 px-4 py-2.5 text-xs text-white rounded-none outline-none focus:border-gold-primary/50 transition-colors" required />
              </div>
              <div className="flex flex-col">
                <label className="text-[9px] uppercase tracking-wider text-ivory/50 mb-1.5">Email Address</label>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="bg-luxury-black border border-white/10 px-4 py-2.5 text-xs text-white rounded-none outline-none focus:border-gold-primary/50 transition-colors" />
              </div>
              <div className="flex flex-col">
                <label className="text-[9px] uppercase tracking-wider text-ivory/50 mb-1.5">Loyalty Points</label>
                <input type="number" value={editPoints} onChange={(e) => setEditPoints(e.target.value)} className="bg-luxury-black border border-white/10 px-4 py-2.5 text-xs text-white rounded-none outline-none focus:border-gold-primary/50 transition-colors" required />
              </div>
              {editModalError && (
                <p className="text-[10px] text-red-400 font-light tracking-wide flex items-center bg-red-950/20 border border-red-900/30 p-2.5">
                  <ShieldAlert size={12} className="mr-1.5 shrink-0" />
                  {editModalError}
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingCustomer(null)} className="flex-1 text-center text-[10px] uppercase tracking-wider border border-white/10 text-white py-3 hover:bg-white/5 transition-colors cursor-pointer">Cancel</button>
                <button type="submit" disabled={editModalLoading} className="flex-1 text-center text-[10px] uppercase tracking-wider bg-gold-primary hover:bg-gold-dark text-luxury-black font-semibold py-3 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50">
                  {editModalLoading && <Loader2 size={12} className="animate-spin mr-1.5" />} Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Archive Confirmation */}
      {deleteCandidate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-[9999]">
          <div className="bg-neutral-900 border border-white/10 max-w-sm w-full p-6 text-center shadow-2xl">
            {checkingDelete ? (
              <div className="py-8 flex flex-col items-center">
                <Loader2 size={32} className="animate-spin text-gold-primary mb-4" />
                <p className="text-xs text-ivory/60">Checking linked records...</p>
              </div>
            ) : canDeleteCustomer ? (
              <>
                <Trash2 size={40} className="mx-auto text-red-500 mb-4" />
                <h3 className="text-lg font-playfair text-white mb-2">Delete Customer?</h3>
                <div className="bg-white/5 border border-white/10 p-3 text-left text-xs mb-4 text-ivory/80">
                  <p><strong className="text-white">Customer:</strong> {deleteCandidate.name}</p>
                  <p><strong className="text-white">Phone:</strong> {deleteCandidate.phone}</p>
                </div>
                <p className="text-[10px] text-red-400 mb-6 font-medium tracking-wide uppercase flex items-center justify-center gap-1.5 bg-red-950/30 p-2 border border-red-900/30">
                  <ShieldAlert size={14} /> This action cannot be undone.
                </p>
                <div className="flex space-x-3">
                  <button onClick={() => setDeleteCandidate(null)} className="flex-1 border border-white/10 text-white py-2.5 text-[10px] uppercase tracking-wider hover:bg-white/5 transition-colors cursor-pointer">Cancel</button>
                  <button onClick={executeHardDelete} className="flex-1 bg-red-600/90 text-white py-2.5 text-[10px] uppercase tracking-wider font-semibold hover:bg-red-600 transition-colors cursor-pointer border border-red-500">Delete Customer</button>
                </div>
              </>
            ) : showArchivePrompt ? (
              <>
                <Archive size={40} className="mx-auto text-orange-400 mb-4" />
                <h3 className="text-lg font-playfair text-white mb-2">Archive Customer</h3>
                <span className="text-[9px] uppercase tracking-wider bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full inline-block mb-4">Recommended</span>
                <div className="bg-orange-500/10 border border-orange-500/20 text-orange-300/90 p-3 text-xs text-left mb-6 leading-relaxed">
                  This customer has existing invoices, appointments, or loyalty transactions and cannot be permanently deleted.<br/><br/>
                  You can archive the customer instead. This preserves all historical data but hides them from the billing POS.
                </div>
                <div className="flex space-x-3">
                  <button onClick={() => setDeleteCandidate(null)} className="flex-1 border border-white/10 text-white py-2.5 text-[10px] uppercase tracking-wider hover:bg-white/5 transition-colors cursor-pointer">Cancel</button>
                  <button onClick={() => executeArchive([deleteCandidate.id])} className="flex-1 bg-orange-500 text-white py-2.5 text-[10px] uppercase tracking-wider font-semibold hover:bg-orange-600 transition-colors cursor-pointer border border-orange-400">Archive Customer</button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Restore Confirmation */}
      {restoreCandidate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-[9999]">
          <div className="bg-neutral-900 border border-white/10 max-w-sm w-full p-6 text-center shadow-2xl">
            <RefreshCw size={40} className="mx-auto text-green-400 mb-4" />
            <h3 className="text-lg font-playfair text-white mb-2">Restore Customer?</h3>
            <p className="text-xs text-ivory/70 mb-6 leading-relaxed bg-white/5 p-3 border border-white/10 text-left">
              This customer will become available again in billing, appointments, loyalty, and customer search.
            </p>
            <div className="flex space-x-3">
              <button onClick={() => setRestoreCandidate(null)} className="flex-1 border border-white/10 text-white py-2.5 text-[10px] uppercase tracking-wider hover:bg-white/5 transition-colors cursor-pointer">Cancel</button>
              <button onClick={() => executeRestore([restoreCandidate.id])} className="flex-1 bg-green-500/90 text-white py-2.5 text-[10px] uppercase tracking-wider font-semibold hover:bg-green-500 transition-colors cursor-pointer border border-green-400">Restore Customer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
