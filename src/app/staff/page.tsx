"use client";

import { useState, useEffect, useRef } from "react";
import { supabaseStaffClient } from "@/lib/supabase";
import { 
  Phone, Award, ShieldAlert, LogOut, Search, Plus, 
  Loader2, CheckCircle2, FileClock, History, ShoppingBag, FileText, ExternalLink, PackageSearch, Eye, EyeOff
} from "lucide-react";
import Link from "next/link";
import { formatINR } from "@/lib/format";

interface Customer {
  id: string;
  name: string;
  phone: string;
  points: number;
}

interface Appointment {
  id: string;
  status: string;
  branch: string;
  appointment_date: string;
  appointment_time: string;
  customer_name: string;
  customer_phone: string;
}

interface Transaction {
  id: string;
  points_change: number;
  transaction_type: "add" | "redeem";
  branch: string;
  notes: string;
  balance_after: number;
  created_by_email: string;
  created_at: string;
}

export default function StaffPortal() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [staffEmail, setStaffEmail] = useState<string | null>(null);

  // Auth inputs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Search input
  const [searchPhone, setSearchPhone] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);

  // Create inputs
  const [createName, setCreateName] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Transaction history
  const [history, setHistory] = useState<Transaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Points adjustment inputs
  const [pointsChange, setPointsChange] = useState("");
  const [adjType, setAdjType] = useState<"add" | "redeem">("add");
  const [branch, setBranch] = useState("Kaduthuruthy");
  const [notes, setNotes] = useState("");
  const [adjError, setAdjError] = useState("");
  const [adjSuccess, setAdjSuccess] = useState("");
  const [adjLoading, setAdjLoading] = useState(false);

  const [userRole, setUserRole] = useState<string | null>(null);

  // Appointments Viewer
  const [appointmentsDate, setAppointmentsDate] = useState("");
  const [appointmentsList, setAppointmentsList] = useState<Appointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);

  const [stats, setStats] = useState<{
    totalSales: number;
    invoiceCount: number;
    branchBreakdown?: Record<string, number>;
    staffBreakdown?: Record<string, { revenue: number; count: number }>;
  } | null>(null);
  const loadDailyStats = async (token: string) => {
    try {
      const res = await fetch("/api/billing/admin?action=get_daily_stats", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStats(data.stats);
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

  const loadAppointments = async (token: string, date: string) => {
    if (!date) return;
    setAppointmentsLoading(true);
    try {
      const res = await fetch(`/api/billing/admin?action=get_appointments&date=${date}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAppointmentsList(data.appointments || []);
      }
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        alert("Network error. Please check your connection and try again.");
      } else {
        alert("Something went wrong. Please try again.");
      }
    } finally {
      setAppointmentsLoading(false);
    }
  };

  // Guard: tracks whether the initial dashboard data has already been loaded by getSession().
  // Prevents onAuthStateChange from duplicating those API calls when it fires right after
  // getSession() on page mount with the same existing session.
  const dashboardLoadedRef = useRef(false);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setAppointmentsDate(today);

    supabaseStaffClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const role = session.user?.app_metadata?.role;
        // Admin can enter staff portal; staff cannot enter admin portal
        if (role === "staff" || role === "admin") {
          setSessionToken(session.access_token);
          setStaffEmail(session.user?.email || null);
          setUserRole(role);
          
          // Parallelize initial stats and bookings fetches
          Promise.all([
            loadDailyStats(session.access_token),
            loadAppointments(session.access_token, today)
          ]);
          // Mark dashboard as loaded so onAuthStateChange skips the duplicate fetch
          dashboardLoadedRef.current = true;
        }
      }
    });

    const { data: { subscription } } = supabaseStaffClient.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const role = session.user?.app_metadata?.role;
        if (role === "staff" || role === "admin") {
          setSessionToken(session.access_token);
          setStaffEmail(session.user?.email || null);
          setUserRole(role);
          
          // Only load dashboard data if getSession() has NOT already done so.
          // This prevents the duplicate API calls caused by onAuthStateChange
          // firing immediately after getSession() on initial page mount.
          if (!dashboardLoadedRef.current) {
            Promise.all([
              loadDailyStats(session.access_token),
              loadAppointments(session.access_token, appointmentsDate || today)
            ]);
            dashboardLoadedRef.current = true;
          }
        } else {
          // Unknown role — sign out
          supabaseStaffClient.auth.signOut();
          setSessionToken(null);
          setStaffEmail(null);
          setUserRole(null);
        }
      } else {
        // Session ended (logout) — reset dashboard state and allow reload on next login
        dashboardLoadedRef.current = false;
        setSessionToken(null);
        setStaffEmail(null);
        setUserRole(null);
        setCustomer(null);
        setHistory([]);
        setStats(null);
        setAppointmentsList([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch appointments when date changes
  useEffect(() => {
    if (sessionToken && appointmentsDate) {
      loadAppointments(sessionToken, appointmentsDate);
    }
  }, [appointmentsDate, sessionToken]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, expectedRole: "staff" })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setAuthError(data.error || "Failed to sign in. Please try again.");
      } else if (data.session) {
        await supabaseStaffClient.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });
        
        const role = data.session.user?.app_metadata?.role;
        setSessionToken(data.session.access_token);
        setStaffEmail(data.session.user?.email || null);
        setUserRole(role);
      }
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        setAuthError("Network error. Please check your connection and try again.");
      } else {
        setAuthError("Something went wrong. Please try again.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabaseStaffClient.auth.signOut();
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError("");
    setCustomer(null);
    setHistory([]);
    setAdjSuccess("");
    setAdjError("");

    if (!searchPhone.trim()) {
      setSearchError("Enter a mobile number to search.");
      return;
    }

    setSearchLoading(true);

    try {
      const response = await fetch(`/api/loyalty/admin?action=search&phone=${encodeURIComponent(searchPhone)}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${sessionToken}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        setSearchError(result.error || "Lookup failed.");
      } else {
        setCustomer(result.customer);
        loadHistory(result.customer.id);
      }
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        setSearchError("Network error. Please check your connection and try again.");
      } else {
        setSearchError("Something went wrong. Please try again.");
      }
    } finally {
      setSearchLoading(false);
    }
  };

  const loadHistory = async (customerId: string) => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`/api/loyalty/admin?action=history&customerId=${customerId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${sessionToken}`
        }
      });
      const result = await response.json();
      if (response.ok) {
        setHistory(result.transactions);
      }
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        alert("Network error. Please check your connection and try again.");
      } else {
        alert("Something went wrong. Please try again.");
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");
    setCreateLoading(true);

    try {
      const response = await fetch("/api/loyalty/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          action: "create",
          name: createName,
          phone: createPhone
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setCreateError(result.error || "Failed to create profile.");
      } else {
        setCreateSuccess(`Profile for ${result.customer.name} created successfully!`);
        setCreateName("");
        setCreatePhone("");
        // Automatically load newly created customer
        setCustomer(result.customer);
        setHistory([]);
      }
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        setCreateError("Network error. Please check your connection and try again.");
      } else {
        setCreateError("Something went wrong. Please try again.");
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleModifyPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjError("");
    setAdjSuccess("");

    if (!customer) return;

    const pointsNum = parseInt(pointsChange, 10);
    if (isNaN(pointsNum) || pointsNum <= 0) {
      setAdjError("Please enter a positive integer value.");
      return;
    }

    setAdjLoading(true);

    try {
      const response = await fetch("/api/loyalty/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          action: "modify_points",
          customerId: customer.id,
          type: adjType,
          pointsChange: pointsNum,
          branch,
          notes
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setAdjError(result.error || "Failed to update points.");
      } else {
        setAdjSuccess(`Successfully logged transaction! New Balance: ${result.newBalance} Points.`);
        setPointsChange("");
        setNotes("");
        // Update local points
        setCustomer((prev) => prev ? { ...prev, points: result.newBalance } : null);
        loadHistory(customer.id);
      }
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        setAdjError("Network error. Please check your connection and try again.");
      } else {
        setAdjError("Something went wrong. Please try again.");
      }
    } finally {
      setAdjLoading(false);
    }
  };

  // Auth Screen
  if (!sessionToken) {
    return (
      <main className="min-h-screen bg-luxury-black flex items-center justify-center px-6 relative py-12">
        <div className="absolute top-[20%] left-[20%] w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(212,175,55,0.02),transparent_70%)] pointer-events-none" />

        <div className="max-w-md w-full border border-gold-primary/20 bg-white/[0.01] backdrop-blur-md p-8 md:p-12 relative shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
          {/* Gold corners */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-gold-primary/45" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-gold-primary/45" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-gold-primary/45" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-gold-primary/45" />

          <div className="text-center mb-8">
            <span className="text-[9px] uppercase tracking-[0.3em] text-gold-primary mb-2 font-medium block">
              Staff &amp; Admin Portal
            </span>
            <h1 className="font-playfair text-2xl text-white font-light tracking-wide">
              MACBELLO SALON
            </h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="flex flex-col">
              <label className="text-[9px] uppercase tracking-wider text-ivory/50 mb-2">Staff Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@macbello.com"
                className="bg-luxury-black border border-white/10 px-4 py-3 text-xs tracking-wider text-white placeholder-ivory/20 rounded-none focus:outline-none focus:border-gold-primary/50 transition-colors"
                required
              />
            </div>

            <div className="flex flex-col">
              <label className="text-[9px] uppercase tracking-wider text-ivory/50 mb-2">Password</label>
              <div className="relative w-full">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-luxury-black border border-white/10 pl-4 pr-12 py-3 text-xs tracking-wider text-white placeholder-ivory/20 rounded-none focus:outline-none focus:border-gold-primary/50 transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-ivory/55 hover:text-gold-primary transition-colors cursor-pointer focus:outline-none p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {authError && (
              <p className="text-[10px] text-red-400 font-light tracking-wide flex items-center">
                <ShieldAlert size={12} className="mr-1.5 shrink-0" />
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full text-center text-xs uppercase tracking-[0.2em] bg-gold-primary hover:bg-gold-dark disabled:bg-gold-primary/40 text-luxury-black font-semibold py-3.5 rounded-none transition-all duration-300 shadow-[0_5px_15px_rgba(212,175,55,0.1)] cursor-pointer flex items-center justify-center"
            >
              {authLoading ? (
                <Loader2 size={14} className="animate-spin mr-2" />
              ) : null}
              <span>Sign In</span>
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Dashboard Screen
  return (
    <main className="min-h-screen bg-luxury-black text-white px-6 py-12 md:py-20 relative">
      <div className="absolute top-[10%] left-[10%] w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(212,175,55,0.015),transparent_70%)] pointer-events-none" />

      <div className="max-w-6xl mx-auto z-10 relative">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/5 pb-6 mb-10 gap-4">
          <div>
            <span className="text-[9px] uppercase tracking-[0.25em] text-gold-primary mb-1.5 block">
              Prestige Management
            </span>
            <h1 className="font-playfair text-2xl md:text-3xl font-light tracking-wide">
              Staff Portal
            </h1>
            <p className="text-[10px] text-ivory/40 font-light mt-1 uppercase tracking-wider">
              Signed in as: <span className="text-gold-primary/80">{staffEmail}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/staff/billing"
              className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.15em] border border-gold-primary/20 hover:border-gold-primary/60 hover:text-gold-primary px-4 py-2 bg-gold-primary/5 transition-all duration-300 rounded-none"
            >
              <FileText size={12} className="text-gold-primary" />
              <span>Billing Workspace</span>
            </Link>

            <Link
              href="/staff/billing/services"
              className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.15em] border border-white/10 hover:border-white/30 px-4 py-2 bg-white/5 transition-all duration-300 rounded-none"
            >
              <ShoppingBag size={12} />
              <span>Manage Catalog</span>
            </Link>

            <Link
              href="/staff/products"
              className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.15em] border border-white/10 hover:border-white/30 px-4 py-2 bg-white/5 transition-all duration-300 rounded-none"
            >
              <PackageSearch size={12} />
              <span>Inventory</span>
            </Link>

            {/* Admin-only: escape back to Admin Portal */}
            {userRole === "admin" && (
              <Link
                href="/admin"
                className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.15em] border border-gold-primary bg-gold-primary/10 text-gold-primary hover:bg-gold-primary/20 px-4 py-2 transition-all duration-300 rounded-none"
              >
                <ExternalLink size={12} />
                <span>Admin Portal</span>
              </Link>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.15em] border border-white/10 hover:border-red-500/30 hover:text-red-400 px-4 py-2 bg-white/5 transition-all duration-300 rounded-none cursor-pointer"
            >
              <LogOut size={12} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Daily Profit & Stats Banner */}
        {stats && (
          <div className={`grid grid-cols-1 ${userRole === "admin" ? "md:grid-cols-4" : "md:grid-cols-2"} gap-6 mb-10 border border-white/5 bg-white/[0.01] p-6 relative`}>
            {/* Corners */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-gold-primary/25" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-gold-primary/25" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-gold-primary/25" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-gold-primary/25" />

            {/* Total Income */}
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gold-primary/10 border border-gold-primary/20 text-gold-primary">
                <Award size={20} />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-ivory/50 block">Today&apos;s Profit / Income</span>
                <span className="currency-value text-2xl text-white font-medium tracking-wide mt-0.5 block">
                  {formatINR(stats.totalSales)}
                </span>
              </div>
            </div>

            {/* Invoices Count */}
            <div className={`flex items-center space-x-4 border-t md:border-t-0 ${userRole === "admin" ? "md:border-x" : "md:border-l"} border-white/5 py-4 md:py-0 md:px-6`}>
              <div className="p-3 bg-white/5 border border-white/10 text-white">
                <FileText size={20} />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-ivory/50 block">Invoices Generated</span>
                <span className="metric-value text-2xl text-white font-medium tracking-wide mt-0.5 block">
                  {stats.invoiceCount} Invoices
                </span>
              </div>
            </div>

            {/* Branch-wise breakdown */}
            {userRole === "admin" && stats.branchBreakdown && (
              <div className="flex flex-col justify-center space-y-1.5 border-t md:border-t-0 md:pr-6 border-white/5 pt-4 md:pt-0">
                <span className="text-[10px] uppercase tracking-wider text-gold-primary block font-bold">Peruvaontribution</span>
                <div className="grid grid-cols-3 gap-2 text-[10px] text-ivory/70 pt-0.5">
                  <div>
                    <span className="block font-medium text-white/90 truncate">Kaduthuruthy</span>
                    <span className="text-[11px] text-gold-primary font-bold">₹{(stats.branchBreakdown["Kaduthuruthy"] || 0).toFixed(0)}</span>
                  </div>
                  <div>
                    <span className="block font-medium text-white/90 truncate">Ettumanoor</span>
                    <span className="text-[11px] text-gold-primary font-bold">₹{(stats.branchBreakdown["Ettumanoor"] || 0).toFixed(0)}</span>
                  </div>
                  <div>
                    <span className="block font-medium text-white/90 truncate">Peruva</span>
                    <span className="text-[11px] text-gold-primary font-bold">₹{(stats.branchBreakdown["Peruva"] || 0).toFixed(0)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Staff Performance Today */}
            {userRole === "admin" && stats.staffBreakdown && (
              <div className="flex flex-col justify-center space-y-1.5 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6">
                <span className="text-[10px] uppercase tracking-wider text-gold-primary block font-bold">Staff Performance</span>
                {Object.keys(stats.staffBreakdown).length > 0 ? (
                  <div className="space-y-1 max-h-[70px] overflow-y-auto no-scrollbar pr-1">
                    {Object.entries(stats.staffBreakdown).map(([name, performance]) => (
                      <div key={name} className="flex justify-between items-center text-[10px] text-ivory/80">
                        <span className="font-medium truncate max-w-[90px]">{name}</span>
                        <span className="text-gold-primary font-semibold">
                          ₹{performance.revenue.toFixed(0)} ({performance.count} services)
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] text-ivory/30 italic">No staff records logged today.</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Appointments Viewer */}
        <div className="border border-white/5 bg-white/[0.01] p-6 relative mb-10">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-gold-primary/25" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-gold-primary/25" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-gold-primary/25" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-gold-primary/25" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 border-b border-white/5 pb-4">
            <h2 className="font-playfair text-lg text-white font-medium tracking-wide flex items-center mb-4 md:mb-0">
              <span className="p-2 bg-gold-primary/10 border border-gold-primary/20 text-gold-primary mr-3">
                <FileClock size={16} />
              </span>
              <span>Appointments</span>
            </h2>
            <div className="flex items-center space-x-3">
              <label className="text-[10px] uppercase tracking-wider text-ivory/40">Select Date:</label>
              <input
                type="date"
                value={appointmentsDate}
                onChange={(e) => setAppointmentsDate(e.target.value)}
                className="bg-luxury-black border border-white/10 px-3 py-2 text-xs text-white rounded-none focus:outline-none focus:border-gold-primary/50"
              />
            </div>
          </div>

          {appointmentsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 size={24} className="animate-spin text-gold-primary" />
            </div>
          ) : appointmentsList.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
              {appointmentsList.map((apt) => (
                <div key={apt.id} className="bg-white/[0.02] border border-white/5 p-4 flex flex-col md:flex-row justify-between items-start md:items-center">
                  <div>
                    <div className="text-sm text-white font-medium mb-1">{apt.customer_name}</div>
                    <div className="text-[10px] text-ivory/50 uppercase tracking-wider">{apt.customer_phone}</div>
                  </div>
                  <div className="text-left md:text-right mt-3 md:mt-0">
                    <div className="text-xs text-gold-primary mb-1">{apt.appointment_time}</div>
                    <div className="text-[10px] text-ivory/40 uppercase tracking-wider">{apt.branch} &bull; {apt.status}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-xs text-ivory/30 italic">No appointments booked for {appointmentsDate}.</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Block: Lookup and Create Profile */}
          <div className="space-y-8">
            
            {/* Search Customers Card */}
            <div className="border border-white/5 bg-white/[0.01] p-6 relative">
              <h2 className="font-playfair text-lg text-white font-medium tracking-wide mb-4 flex items-center">
                <Search size={16} className="text-gold-primary mr-2" />
                <span>Search Customer</span>
              </h2>

              <form onSubmit={handleSearch} className="space-y-4">
                <div className="flex flex-col">
                  <input
                    type="tel"
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    placeholder="Enter phone number..."
                    className="bg-luxury-black border border-white/10 px-4 py-3 text-xs tracking-wider text-white placeholder-ivory/20 rounded-none focus:outline-none focus:border-gold-primary/50 transition-colors"
                  />
                </div>

                {searchError && (
                  <p className="text-[10px] text-red-400 font-light tracking-wide">{searchError}</p>
                )}

                <button
                  type="submit"
                  disabled={searchLoading}
                  className="w-full text-center text-[10px] uppercase tracking-[0.2em] bg-gold-primary hover:bg-gold-dark text-luxury-black font-semibold py-3 transition-colors cursor-pointer flex items-center justify-center"
                >
                  {searchLoading ? <Loader2 size={12} className="animate-spin mr-2" /> : null}
                  <span>Search Database</span>
                </button>
              </form>
            </div>

            {/* Create Customer Card */}
            <div className="border border-white/5 bg-white/[0.01] p-6 relative">
              <h2 className="font-playfair text-lg text-white font-medium tracking-wide mb-4 flex items-center">
                <Plus size={16} className="text-gold-primary mr-2" />
                <span>Create Customer Profile</span>
              </h2>

              <form onSubmit={handleCreateCustomer} className="space-y-4">
                <div className="flex flex-col">
                  <label className="text-[9px] uppercase tracking-wider text-ivory/40 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Alessandro Macbello"
                    className="bg-luxury-black border border-white/10 px-4 py-2.5 text-xs tracking-wider text-white placeholder-ivory/20 rounded-none focus:outline-none focus:border-gold-primary/50 transition-colors"
                    required
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[9px] uppercase tracking-wider text-ivory/40 mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={createPhone}
                    onChange={(e) => setCreatePhone(e.target.value)}
                    placeholder="e.g. +91 95625 14002"
                    className="bg-luxury-black border border-white/10 px-4 py-2.5 text-xs tracking-wider text-white placeholder-ivory/20 rounded-none focus:outline-none focus:border-gold-primary/50 transition-colors"
                    required
                  />
                </div>

                {createError && (
                  <p className="text-[10px] text-red-400 font-light tracking-wide">{createError}</p>
                )}
                {createSuccess && (
                  <p className="text-[10px] text-green-400 font-light tracking-wide flex items-center">
                    <CheckCircle2 size={12} className="mr-1 text-green-400 shrink-0" />
                    {createSuccess}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={createLoading}
                  className="w-full text-center text-[10px] uppercase tracking-[0.2em] bg-white/10 hover:bg-white/20 text-white font-semibold py-3 transition-colors cursor-pointer flex items-center justify-center border border-white/10"
                >
                  {createLoading ? <Loader2 size={12} className="animate-spin mr-2" /> : null}
                  <span>Register Customer</span>
                </button>
              </form>
            </div>

          </div>

          {/* Right Blocks: Customer Actions & logs */}
          <div className="lg:col-span-2 space-y-8">
            
            {customer ? (
              <>
                {/* Profile Overview & Actions */}
                <div className="border border-gold-primary/20 bg-gold-primary/[0.01] p-6 md:p-8 relative">
                  {/* Corners */}
                  <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-gold-primary/30" />
                  <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-gold-primary/30" />
                  <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-gold-primary/30" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-gold-primary/30" />

                  {/* Info Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-white/5 gap-4">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-gold-primary font-medium">Selected Profile</span>
                      <h3 className="font-playfair text-xl text-white font-medium mt-1 tracking-wide">{customer.name}</h3>
                      <p className="text-xs text-ivory/50 mt-1 flex items-center"><Phone size={10} className="mr-1 text-gold-primary" /> {customer.phone}</p>
                    </div>

                    <div className="text-left md:text-right bg-gold-primary/5 border border-gold-primary/20 px-5 py-3 shrink-0">
                      <span className="text-[9px] uppercase tracking-wider text-gold-primary block">Current Balance</span>
                      <span className="metric-value text-2xl text-white font-medium tracking-wide mt-1 block">{customer.points} Points</span>
                    </div>
                  </div>

                  {/* Adjust Points Form */}
                  <div className="pt-6">
                    <h4 className="text-xs uppercase tracking-[0.15em] text-gold-primary font-semibold mb-4 flex items-center">
                      <Award size={14} className="mr-1.5" />
                      <span>Adjust Loyalty Balance</span>
                    </h4>

                    <form onSubmit={handleModifyPoints} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col">
                        <label className="text-[9px] uppercase tracking-wider text-ivory/40 mb-1.5">Action Type</label>
                        <div className="flex border border-white/10">
                          <button
                            type="button"
                            onClick={() => setAdjType("add")}
                            className={`flex-1 py-2 text-center text-[10px] uppercase tracking-wider font-semibold cursor-pointer ${
                              adjType === "add" ? "bg-gold-primary text-luxury-black" : "bg-transparent text-ivory/60 hover:text-ivory"
                            }`}
                          >
                            Add Points
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdjType("redeem")}
                            className={`flex-1 py-2 text-center text-[10px] uppercase tracking-wider font-semibold cursor-pointer ${
                              adjType === "redeem" ? "bg-gold-primary text-luxury-black" : "bg-transparent text-ivory/60 hover:text-ivory"
                            }`}
                          >
                            Redeem Points
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[9px] uppercase tracking-wider text-ivory/40 mb-1.5">Branch Location</label>
                        <select
                          value={branch}
                          onChange={(e) => setBranch(e.target.value)}
                          className="bg-luxury-black border border-white/10 px-4 py-2.5 text-xs text-white rounded-none focus:outline-none cursor-pointer appearance-none"
                        >
                          <option value="Kaduthuruthy">Kaduthuruthy</option>
                          <option value="Ettumanoor">Ettumanoor</option>
                          <option value="Peruva">Peruva</option>
                        </select>
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[9px] uppercase tracking-wider text-ivory/40 mb-1.5">Points Quantity</label>
                        <input
                          type="number"
                          value={pointsChange}
                          onChange={(e) => setPointsChange(e.target.value)}
                          placeholder="e.g. 50"
                          min="1"
                          className="bg-luxury-black border border-white/10 px-4 py-2 text-xs tracking-wider text-white placeholder-ivory/20 rounded-none focus:outline-none focus:border-gold-primary/50 transition-colors"
                          required
                        />
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[9px] uppercase tracking-wider text-ivory/40 mb-1.5">Notes / Transaction Reference</label>
                        <input
                          type="text"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="e.g. Haircut & beard trim service"
                          className="bg-luxury-black border border-white/10 px-4 py-2 text-xs tracking-wider text-white placeholder-ivory/20 rounded-none focus:outline-none focus:border-gold-primary/50 transition-colors"
                        />
                      </div>

                      {adjError && (
                        <p className="text-[10px] text-red-400 font-light tracking-wide md:col-span-2">{adjError}</p>
                      )}
                      {adjSuccess && (
                        <p className="text-[10px] text-green-400 font-light tracking-wide md:col-span-2 flex items-center">
                          <CheckCircle2 size={12} className="mr-1 text-green-400 shrink-0" />
                          {adjSuccess}
                        </p>
                      )}

                      <div className="md:col-span-2 pt-2">
                        <button
                          type="submit"
                          disabled={adjLoading}
                          className="w-full text-center text-xs uppercase tracking-[0.2em] bg-gold-primary hover:bg-gold-dark disabled:bg-gold-primary/40 text-luxury-black font-semibold py-3 transition-colors cursor-pointer flex items-center justify-center"
                        >
                          {adjLoading ? <Loader2 size={12} className="animate-spin mr-2" /> : null}
                          <span>Submit Points Adjustment</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Audit Logs History */}
                <div className="border border-white/5 bg-white/[0.01] p-6 relative">
                  <h3 className="font-playfair text-lg text-white font-medium tracking-wide mb-6 flex items-center">
                    <FileClock size={16} className="text-gold-primary mr-2" />
                    <span>Transaction History Audit</span>
                  </h3>

                  {historyLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 size={24} className="animate-spin text-gold-primary" />
                    </div>
                  ) : history.length === 0 ? (
                    <p className="text-xs text-ivory/40 font-light text-center py-8">No historical transactions logged for this profile.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] font-light">
                        <thead>
                          <tr className="border-b border-white/10 uppercase tracking-wider text-gold-primary text-[9px]">
                            <th className="pb-3 font-semibold">Date</th>
                            <th className="pb-3 font-semibold">Branch</th>
                            <th className="pb-3 font-semibold">Change</th>
                            <th className="pb-3 font-semibold">Bal After</th>
                            <th className="pb-3 font-semibold">Notes</th>
                            <th className="pb-3 font-semibold">Added By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((tx) => (
                            <tr key={tx.id} className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                              <td className="py-3 text-ivory/80">
                                {new Date(tx.created_at).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric"
                                })}
                              </td>
                              <td className="py-3 text-ivory/80">{tx.branch}</td>
                              <td className={`py-3 font-semibold ${tx.points_change > 0 ? "text-green-400" : "text-red-400"}`}>
                                {tx.points_change > 0 ? `+${tx.points_change}` : tx.points_change}
                              </td>
                              <td className="py-3 text-white font-medium">{tx.balance_after}</td>
                              <td className="py-3 text-ivory/60 italic max-w-[150px] truncate" title={tx.notes}>
                                {tx.notes || "—"}
                              </td>
                              <td className="py-3 text-ivory/40">{tx.created_by_email}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="border border-dashed border-white/10 rounded-none p-12 text-center flex flex-col items-center justify-center h-full min-h-[300px]">
                <History size={32} className="text-gold-primary/30 mb-4" />
                <h3 className="font-playfair text-base text-white/80 font-medium tracking-wide">No Active Profile Selected</h3>
                <p className="text-xs text-ivory/40 font-light mt-2 max-w-sm">
                  Use the lookup sidebar to search a customer by phone number, or register a new profile to begin managing loyalty points.
                </p>
              </div>
            )}

          </div>

        </div>

      </div>
    </main>
  );
}
