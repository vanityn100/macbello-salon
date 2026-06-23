"use client";

import { useState, useEffect } from "react";
import { supabaseAdminClient } from "@/lib/supabase";
import { 
  ShieldAlert, LogOut, Loader2, Download, Calendar, FileSpreadsheet, Award, FileText, TrendingUp, Users, Scissors, Clock, ExternalLink, PackageSearch
} from "lucide-react";
import Link from "next/link";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { formatINR, formatNumber, formatDate } from "@/lib/format";

interface AuditLog {
  id: string;
  user_id: string;
  role: string;
  branch: string;
  action: string;
  details: string;
  created_at: string;
}

interface InvoiceItem {
  item_name: string;
  line_total: number;
  tax_rate: number;
  category: "Service" | "Retail";
  quantity: number;
  unit_price: number;
  hsn?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  grand_total: number;
  subtotal: number;
  total_tax: number;
  points_earned: number;
  points_redeemed: number;
  branch: string;
  created_at: string;
  customers: {
    name: string;
    phone: string;
  } | null;
  invoice_items: InvoiceItem[];
}

interface Customer {
  id: string;
  created_at: string;
  name: string;
  phone: string;
  branch: string;
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

interface ReportData {
  invoices: Invoice[];
  newCustomersCount: number;
  customers: Customer[];
  appointments: Appointment[];
}

export default function AdminPortal() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Auth inputs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Report Controls
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("All Branches");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Staff Accounts state
  const [staffList, setStaffList] = useState<any[]>([]);
  const [staffListLoading, setStaffListLoading] = useState(false);

  // Registered Customers state
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [customerListLoading, setCustomerListLoading] = useState(false);

  // Daily Stats state
  const [stats, setStats] = useState<{
    totalSales: number;
    invoiceCount: number;
    branchBreakdown?: Record<string, number>;
    staffBreakdown?: Record<string, { revenue: number; count: number }>;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState("");

  // Financial Stats state
  const [finStats, setFinStats] = useState<{
    todayRevenue: number;
    monthlyRevenue: number;
    totalRevenue: number;
    totalCustomers: number;
    totalServices: number;
    totalAppointments: number;
    completedAppointments: number;
    pendingAppointments: number;
  } | null>(null);
  const [finStatsLoading, setFinStatsLoading] = useState(false);

  const loadCustomerList = async (token: string) => {
    setCustomerListLoading(true);
    try {
      const res = await fetch("/api/billing/admin?action=list_all_customers", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCustomerList(data.customers || []);
      }
    } catch (err) {
      console.error("Failed to load customer list:", err);
    } finally {
      setCustomerListLoading(false);
    }
  };

  const loadDailyStats = async (token: string) => {
    setStatsLoading(true);
    setStatsError("");
    try {
      const res = await fetch("/api/billing/admin?action=get_daily_stats", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStats(data.stats);
      } else {
        setStatsError(data.error || "Failed to load operations metrics.");
      }
    } catch (err) {
      console.error("Failed to load daily stats:", err);
      setStatsError("Network error loading metrics.");
    } finally {
      setStatsLoading(false);
    }
  };

  const loadFinancialStats = async (token: string) => {
    setFinStatsLoading(true);
    try {
      const res = await fetch("/api/billing/admin?action=get_financial_stats", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFinStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to load financial stats:", err);
    } finally {
      setFinStatsLoading(false);
    }
  };

  // New staff inputs
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [newStaffBranch, setNewStaffBranch] = useState("Branch A");
  const [staffCreateLoading, setStaffCreateLoading] = useState(false);
  const [staffCreateError, setStaffCreateError] = useState("");
  const [staffCreateSuccess, setStaffCreateSuccess] = useState("");

  // Set initial date range (default to current month)
  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setStartDate(firstDay.toISOString().slice(0, 10));
    setEndDate(today.toISOString().slice(0, 10));
  }, []);

  const loadStaffList = async (token: string) => {
    setStaffListLoading(true);
    try {
      const res = await fetch("/api/billing/admin?action=list_staff", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStaffList(data.staff || []);
      }
    } catch (err) {
      console.error("Failed to load staff list:", err);
    } finally {
      setStaffListLoading(false);
    }
  };

  useEffect(() => {
    supabaseAdminClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const role = session.user?.app_metadata?.role;
        if (role === "admin") {
          setIsAdmin(true);
          setSessionToken(session.access_token);
          setAdminEmail(session.user?.email || null);
          loadStaffList(session.access_token);
          loadDailyStats(session.access_token);
          loadFinancialStats(session.access_token);
          loadCustomerList(session.access_token);
        } else {
          setIsAdmin(false);
          setAuthError("Access denied. Admin role required.");
        }
      }
    });

    const { data: { subscription } } = supabaseAdminClient.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const role = session.user?.app_metadata?.role;
        if (role === "admin") {
          setIsAdmin(true);
          setSessionToken(session.access_token);
          setAdminEmail(session.user?.email || null);
          loadStaffList(session.access_token);
          loadDailyStats(session.access_token);
          loadFinancialStats(session.access_token);
          loadCustomerList(session.access_token);
        } else {
          setIsAdmin(false);
          setSessionToken(null);
          setAdminEmail(null);
          setAuthError("Access denied. Admin role required.");
        }
      } else {
        setIsAdmin(false);
        setSessionToken(null);
        setAdminEmail(null);
        setReportData(null);
        setStaffList([]);
        setCustomerList([]);
        setStats(null);
        setFinStats(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffCreateError("");
    setStaffCreateSuccess("");
    setStaffCreateLoading(true);

    try {
      const res = await fetch("/api/billing/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          action: "create_staff",
          staffEmail: newStaffEmail,
          password: newStaffPassword,
          branch: newStaffBranch
        })
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setStaffCreateSuccess(`Staff account created successfully!`);
        setNewStaffEmail("");
        setNewStaffPassword("");
        loadStaffList(sessionToken!);
      } else {
        setStaffCreateError(result.error || "Failed to create staff account.");
      }
    } catch {
      setStaffCreateError("Network error creating staff account.");
    } finally {
      setStaffCreateLoading(false);
    }
  };

  const handleDeleteStaff = async (staffId: string, email: string) => {
    if (!confirm(`Are you sure you want to delete staff account: ${email}?`)) return;

    try {
      const res = await fetch("/api/billing/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          action: "delete_staff",
          staffId,
          staffEmail: email
        })
      });

      const result = await res.json();
      if (res.ok && result.success) {
        alert("Staff account deleted successfully.");
        loadStaffList(sessionToken!);
      } else {
        alert(result.error || "Failed to delete staff account.");
      }
    } catch {
      alert("Network error deleting staff account.");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      const { data, error } = await supabaseAdminClient.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        setAuthError(error.message);
      } else if (data.session) {
        const role = data.session.user?.app_metadata?.role;
        if (role !== "admin") {
          await supabaseAdminClient.auth.signOut();
          setAuthError("Forbidden: Admin privileges required.");
        } else {
          setIsAdmin(true);
          setSessionToken(data.session.access_token);
          setAdminEmail(data.session.user?.email || null);
          loadDailyStats(data.session.access_token);
          loadFinancialStats(data.session.access_token);
          loadStaffList(data.session.access_token);
          loadCustomerList(data.session.access_token);
        }
      }
    } catch {
      setAuthError("Failed to sign in. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabaseAdminClient.auth.signOut();
  };

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportLoading(true);
    setReportData(null);

    try {
      const res = await fetch(`/api/billing/admin?action=get_admin_reports&startDate=${startDate}&endDate=${endDate}&branch=${encodeURIComponent(selectedBranch)}`, {
        headers: { "Authorization": `Bearer ${sessionToken}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReportData(data.report);
      } else {
        alert(data.error || "Failed to query transactions.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error querying transaction records.");
    } finally {
      setReportLoading(false);
    }
  };

  const exportPDFReport = async () => {
    if (!reportData) return;
    setPdfLoading(true);

    try {
      // Log report export action to audit trail
      await fetch("/api/billing/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          action: "log_audit_action",
          auditAction: "pdf_transaction_report_export",
          details: `Exported printable accounting report for ${selectedBranch} [${startDate} to ${endDate}]`
        })
      });

      const doc = new jsPDF("p", "mm", "a4");
      
      // Header
      doc.setFillColor(30, 30, 30);
      doc.rect(0, 0, 210, 32, "F");
      
      doc.setTextColor(212, 175, 55); // Gold
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("MacBello Family Salon", 14, 14);
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("GSTIN: 32AABCM1029F1Z4 | Phone: +91 95625 14002", 14, 20);
      doc.text("Email: accounts@macbellosalon.com", 14, 25);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("TRANSACTION ACCOUNTING REPORT", 200, 14, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Branch: ${selectedBranch}`, 200, 20, { align: "right" });
      doc.text(`Period: ${startDate} to ${endDate}`, 200, 25, { align: "right" });

      if (reportData.invoices.length === 0) {
        doc.setTextColor(0, 0, 0);
        doc.text("No transactions recorded for the selected period and branch.", 14, 45);
      } else {
        const body: any[] = [];
        let totalRev = 0;
        let totalTax = 0;
        
        reportData.invoices.forEach(inv => {
          const dateStr = formatDate(inv.created_at);
          const customerName = inv.customers?.name || "Anonymous";
          const grand = parseFloat(inv.grand_total as any) || 0;
          const tax = parseFloat(inv.total_tax as any) || 0;
          totalRev += grand;
          totalTax += tax;
          
          body.push([
            dateStr,
            inv.invoice_number,
            customerName,
            inv.branch || "—",
            formatINR(tax),
            formatINR(grand)
          ]);
        });

        autoTable(doc, {
          startY: 40,
          head: [["Date", "Invoice #", "Customer", "Branch", "GST", "Total"]],
          body,
          theme: "grid",
          headStyles: { fillColor: [30, 30, 30], textColor: [212, 175, 55], fontStyle: "bold" },
          styles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [250, 250, 250] },
        });

        // @ts-ignore
        const finalY = (doc as any).lastAutoTable?.finalY || 40;
        
        doc.setTextColor(30, 30, 30);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(`Total Invoices: ${reportData.invoices.length}`, 14, finalY + 10);
        doc.text(`Total GST: ${formatINR(totalTax)}`, 14, finalY + 15);
        doc.text(`Total Revenue: ${formatINR(totalRev)}`, 14, finalY + 20);
      }

      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated By: ${adminEmail} on ${new Date().toLocaleString()}`, 14, 290);

      doc.save(`MacBello_Transaction_Report_${startDate}_to_${endDate}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Error printing ledger report PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  const exportExcelReport = async () => {
    if (!reportData) return;
    
    try {
      await fetch("/api/billing/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          action: "log_audit_action",
          auditAction: "excel_transaction_report_export",
          details: `Exported Excel accounting report for ${selectedBranch} [${startDate} to ${endDate}]`
        })
      });

      const rows: any[] = [];
      reportData.invoices.forEach(inv => {
        const dateStr = formatDate(inv.created_at);
        const customerName = inv.customers?.name || "Anonymous";
        const grand = parseFloat(inv.grand_total as any) || 0;
        const tax = parseFloat(inv.total_tax as any) || 0;
        const sub = parseFloat(inv.subtotal as any) || 0;
        
        inv.invoice_items.forEach(item => {
          rows.push({
            "Date": dateStr,
            "Invoice #": inv.invoice_number,
            "Customer": customerName,
            "Branch": inv.branch || "Global",
            "Item Name": item.item_name,
            "Category": item.category,
            "Quantity": item.quantity,
            "Unit Price": item.unit_price,
            "Line Total": item.line_total,
            "Invoice Subtotal": sub,
            "Invoice GST": tax,
            "Invoice Total": grand
          });
        });
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
      
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const data = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
      saveAs(data, `MacBello_Transactions_${startDate}_to_${endDate}.xlsx`);
    } catch (err) {
      console.error(err);
      alert("Error exporting Excel report.");
    }
  };

  // Auth Screen
  if (!sessionToken || !isAdmin) {
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
              Administrative Portal Login
            </span>
            <h1 className="font-playfair text-2xl text-white font-light tracking-wide">
              MACBELLO SALON
            </h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="flex flex-col">
              <label className="text-[9px] uppercase tracking-wider text-ivory/50 mb-2">Admin Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@macbello.com"
                className="bg-luxury-black border border-white/10 px-4 py-3 text-xs tracking-wider text-white placeholder-ivory/20 rounded-none focus:outline-none focus:border-gold-primary/50 transition-colors"
                required
              />
            </div>

            <div className="flex flex-col">
              <label className="text-[9px] uppercase tracking-wider text-ivory/50 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-luxury-black border border-white/10 px-4 py-3 text-xs tracking-wider text-white placeholder-ivory/20 rounded-none focus:outline-none focus:border-gold-primary/50 transition-colors"
                required
              />
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
              <span>Sign In as Admin</span>
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Dashboard Screen (Clean Administration Export Center)
  return (
    <main className="min-h-screen bg-luxury-black text-white px-6 py-12 md:py-20 relative">
      <div className="absolute top-[10%] left-[10%] w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(212,175,55,0.015),transparent_70%)] pointer-events-none" />

      <div className="max-w-4xl mx-auto z-10 relative">
        <div className="flex items-center justify-between border-b border-white/5 pb-6 mb-10">
          <div>
            <span className="text-[9px] uppercase tracking-[0.25em] text-gold-primary mb-1.5 block">
              Financial Administration
            </span>
            <h1 className="font-playfair text-2xl font-light tracking-wide">
              Reports Workspace
            </h1>
            <p className="text-[10px] text-ivory/40 font-light mt-1 uppercase tracking-wider">
              Signed in: <span className="text-gold-primary/80">{adminEmail}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin/products" className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.15em] border border-white/10 hover:border-gold-primary/40 hover:text-gold-primary px-4 py-2 bg-white/[0.02] transition-all duration-300 rounded-none">
              <PackageSearch size={12} />
              <span>Inventory</span>
            </Link>
            <Link href="/admin/reports" className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.15em] border border-gold-primary text-gold-primary px-4 py-2 hover:bg-gold-primary/10 transition-all duration-300 rounded-none">
              <FileText size={12} />
              <span>Tax Reports</span>
            </Link>
            <Link href="/staff" className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.15em] border border-white/10 hover:border-gold-primary/40 hover:text-gold-primary px-4 py-2 bg-white/[0.02] transition-all duration-300 rounded-none">
              <ExternalLink size={12} />
              <span>Staff Portal</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.15em] border border-white/10 hover:border-red-500/30 hover:text-red-400 px-4 py-2 bg-white/5 transition-all duration-300 rounded-none cursor-pointer"
            >
              <LogOut size={12} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Financial Overview Cards */}
        {finStatsLoading && (
          <div className="flex items-center justify-center p-6 border border-white/5 bg-white/[0.01] mb-8">
            <Loader2 size={20} className="animate-spin text-gold-primary mr-2" />
            <span className="text-xs text-ivory/50">Loading financial dashboard...</span>
          </div>
        )}

        {!finStatsLoading && finStats && (
          <div className="mb-10">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-playfair text-lg text-white font-medium tracking-wide">
                Financial Dashboard
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* Today's Revenue */}
              <div className="border border-white/5 bg-white/[0.01] p-4 relative flex flex-col justify-between h-[100px]">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] uppercase tracking-wider text-ivory/50">Today's Revenue</span>
                  <Award size={14} className="text-gold-primary" />
                </div>
                <span className="font-sans text-xl text-white font-medium tracking-wide">
                  {formatINR(finStats.todayRevenue)}
                </span>
              </div>
              {/* Monthly Revenue */}
              <div className="border border-white/5 bg-white/[0.01] p-4 relative flex flex-col justify-between h-[100px]">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] uppercase tracking-wider text-ivory/50">This Month</span>
                  <TrendingUp size={14} className="text-gold-primary" />
                </div>
                <span className="font-sans text-xl text-white font-medium tracking-wide">
                  {formatINR(finStats.monthlyRevenue)}
                </span>
              </div>
              {/* Total Revenue */}
              <div className="border border-white/5 bg-white/[0.01] p-4 relative flex flex-col justify-between h-[100px]">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] uppercase tracking-wider text-ivory/50">Total Revenue</span>
                  <Award size={14} className="text-gold-primary" />
                </div>
                <span className="font-sans text-xl text-white font-medium tracking-wide">
                  {formatINR(finStats.totalRevenue)}
                </span>
              </div>
              {/* Customers */}
              <div className="border border-white/5 bg-white/[0.01] p-4 relative flex flex-col justify-between h-[100px]">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] uppercase tracking-wider text-ivory/50">Customers</span>
                  <Users size={14} className="text-gold-primary" />
                </div>
                <span className="font-sans text-xl text-white font-medium tracking-wide">
                  {formatNumber(finStats.totalCustomers)}
                </span>
              </div>
              {/* Services */}
              <div className="border border-white/5 bg-white/[0.01] p-4 relative flex flex-col justify-between h-[100px]">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] uppercase tracking-wider text-ivory/50">Services</span>
                  <Scissors size={14} className="text-gold-primary" />
                </div>
                <span className="font-sans text-xl text-white font-medium tracking-wide">
                  {formatNumber(finStats.totalServices)}
                </span>
              </div>
              {/* Appointments */}
              <div className="border border-white/5 bg-white/[0.01] p-4 relative flex flex-col justify-between h-[100px]">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] uppercase tracking-wider text-ivory/50">Appointments</span>
                  <Clock size={14} className="text-gold-primary" />
                </div>
                <div className="flex items-end justify-between">
                  <span className="font-sans text-xl text-white font-medium tracking-wide">
                    {formatNumber(finStats.totalAppointments)}
                  </span>
                  <span className="text-[9px] text-ivory/40">
                    {finStats.completedAppointments} Done
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Daily Profit & Stats Banner */}
        {statsLoading && (
          <div className="flex items-center justify-center p-6 border border-white/5 bg-white/[0.01] mb-8">
            <Loader2 size={20} className="animate-spin text-gold-primary mr-2" />
            <span className="text-xs text-ivory/50">Loading operations metrics...</span>
          </div>
        )}

        {statsError && (
          <div className="p-4 border border-red-500/20 bg-red-950/20 text-red-400 text-xs mb-8 text-center">
            {statsError}
          </div>
        )}

        {!statsLoading && !statsError && stats && (
          <>
            {/* Overview Totals Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Today's Revenue */}
              <div className="border border-white/5 bg-white/[0.01] p-6 relative flex items-center space-x-4">
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-gold-primary/25" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-gold-primary/25" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-gold-primary/25" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-gold-primary/25" />
                <div className="p-3.5 bg-gold-primary/10 border border-gold-primary/20 text-gold-primary">
                  <Award size={20} />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-ivory/50 block">Today&apos;s Revenue</span>
                  <span className="font-playfair text-2xl text-white font-medium tracking-wide mt-0.5 block">
                    ₹{stats.totalSales.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Invoices Count */}
              <div className="border border-white/5 bg-white/[0.01] p-6 relative flex items-center space-x-4">
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-gold-primary/25" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-gold-primary/25" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-gold-primary/25" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-gold-primary/25" />
                <div className="p-3.5 bg-white/5 border border-white/10 text-white">
                  <FileText size={20} />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-ivory/50 block">Invoices Generated</span>
                  <span className="font-playfair text-2xl text-white font-medium tracking-wide mt-0.5 block">
                    {stats.invoiceCount} Invoices
                  </span>
                </div>
              </div>
            </div>

            {/* Performance Breakdowns Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Branch Contribution */}
              {stats.branchBreakdown && (
                <div className="border border-white/5 bg-white/[0.01] p-6 relative">
                  <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-gold-primary/25" />
                  <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-gold-primary/25" />
                  <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-gold-primary/25" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-gold-primary/25" />
                  <span className="text-[10px] uppercase tracking-wider text-gold-primary block font-bold mb-3">Branch Contribution</span>
                  <div className="grid grid-cols-3 gap-3 text-xs text-ivory/70">
                    <div className="bg-white/[0.02] border border-white/5 p-3 text-center">
                      <span className="block font-medium text-white/90 truncate mb-1 text-[10px]">Branch A</span>
                      <span className="text-xs text-gold-primary font-bold">₹{(stats.branchBreakdown["Branch A"] || 0).toFixed(0)}</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 p-3 text-center">
                      <span className="block font-medium text-white/90 truncate mb-1 text-[10px]">Branch B</span>
                      <span className="text-xs text-gold-primary font-bold">₹{(stats.branchBreakdown["Branch B"] || 0).toFixed(0)}</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 p-3 text-center">
                      <span className="block font-medium text-white/90 truncate mb-1 text-[10px]">Branch C</span>
                      <span className="text-xs text-gold-primary font-bold">₹{(stats.branchBreakdown["Branch C"] || 0).toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Staff Performance */}
              {stats.staffBreakdown && (
                <div className="border border-white/5 bg-white/[0.01] p-6 relative">
                  <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-gold-primary/25" />
                  <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-gold-primary/25" />
                  <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-gold-primary/25" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-gold-primary/25" />
                  <span className="text-[10px] uppercase tracking-wider text-gold-primary block font-bold mb-3">Staff Performance</span>
                  {Object.keys(stats.staffBreakdown).length > 0 ? (
                    <div className="space-y-2 max-h-[85px] overflow-y-auto no-scrollbar pr-1">
                      {Object.entries(stats.staffBreakdown).map(([name, performance]) => (
                        <div key={name} className="flex justify-between items-center text-[11px] text-ivory/80 border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                          <span className="font-medium truncate max-w-[130px]">{name}</span>
                          <span className="text-gold-primary font-semibold">
                            ₹{performance.revenue.toFixed(0)} ({performance.count} services)
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[70px] text-[10px] text-ivory/30 italic">
                      No staff records logged today.
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        <div className="border border-white/5 bg-white/[0.01] p-8 relative">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-gold-primary/25" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-gold-primary/25" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-gold-primary/25" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-gold-primary/25" />

          <h2 className="font-playfair text-lg text-white font-medium tracking-wide mb-6 flex items-center">
            <span>Export Transactions Report</span>
          </h2>

          <form onSubmit={handleGenerateReport} className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="flex flex-col">
              <label className="text-[9px] uppercase tracking-wider text-ivory/40 mb-1.5">Branch Selection</label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="bg-luxury-black border border-white/10 px-4 py-2.5 text-xs text-white rounded-none focus:outline-none focus:border-gold-primary/50 cursor-pointer"
              >
                <option value="All Branches">All Branches</option>
                <option value="Branch A">Branch A</option>
                <option value="Branch B">Branch B</option>
                <option value="Branch C">Branch C</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-[9px] uppercase tracking-wider text-ivory/40 mb-1.5">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-luxury-black border border-white/10 px-4 py-2.5 text-xs text-white rounded-none focus:outline-none focus:border-gold-primary/50"
                required
              />
            </div>

            <div className="flex flex-col">
              <label className="text-[9px] uppercase tracking-wider text-ivory/40 mb-1.5">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-luxury-black border border-white/10 px-4 py-2.5 text-xs text-white rounded-none focus:outline-none focus:border-gold-primary/50"
                required
              />
            </div>

            <div className="md:col-span-3 pt-2">
              <button
                type="submit"
                disabled={reportLoading}
                className="w-full text-center text-xs uppercase tracking-[0.2em] bg-gold-primary hover:bg-gold-dark text-luxury-black font-semibold py-3.5 transition-colors cursor-pointer flex items-center justify-center"
              >
                {reportLoading ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
                <span>Query Transactions</span>
              </button>
            </div>
          </form>

          {reportData ? (
            <div className="border-t border-white/5 pt-6 flex flex-col items-center justify-center text-center">
              <p className="text-xs text-ivory/60 font-light mb-4">
                Queried **{reportData.invoices.length}** transactions matching your range configuration.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
                <button
                  onClick={exportPDFReport}
                  disabled={pdfLoading}
                  className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.15em] bg-gold-primary text-luxury-black font-bold px-6 py-3 hover:bg-gold-dark transition-all duration-300 rounded-none cursor-pointer w-full sm:w-auto"
                >
                  {pdfLoading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  <span>Export PDF</span>
                </button>
                <button
                  onClick={exportExcelReport}
                  className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.15em] border border-gold-primary text-gold-primary font-bold px-6 py-3 hover:bg-gold-primary/10 transition-all duration-300 rounded-none cursor-pointer w-full sm:w-auto"
                >
                  <FileSpreadsheet size={12} />
                  <span>Export Excel</span>
                </button>
              </div>

              {/* Appointments List */}
              <div className="w-full text-left mt-4 border-t border-white/5 pt-6">
                <h3 className="text-sm text-gold-primary uppercase tracking-[0.2em] mb-4 flex items-center justify-between">
                  <span>Appointments in Range</span>
                  <span className="text-[10px] text-ivory/50">Total: {reportData.appointments.length}</span>
                </h3>
                {reportData.appointments.length > 0 ? (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                    {reportData.appointments.map((apt) => (
                      <div key={apt.id} className="bg-white/[0.02] border border-white/5 p-4 flex flex-col md:flex-row justify-between items-start md:items-center">
                        <div>
                          <div className="text-sm text-white font-medium mb-1">{apt.customer_name}</div>
                          <div className="text-[10px] text-ivory/50 uppercase tracking-wider">{apt.customer_phone}</div>
                        </div>
                        <div className="text-right mt-3 md:mt-0">
                          <div className="text-xs text-gold-primary mb-1">{apt.appointment_date} {apt.appointment_time ? `at ${apt.appointment_time}` : ""}</div>
                          <div className="text-[10px] text-ivory/40 uppercase tracking-wider">{apt.branch} &bull; {apt.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-ivory/30 italic text-center py-6">No appointments found for this date range.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="border-t border-white/5 pt-8 text-center text-xs text-ivory/30 italic">
              Select date ranges and branch parameters to build printable transaction reports and view appointments.
            </div>
          )}
        </div>

        {/* Staff Management Panel */}
        <div className="border border-white/5 bg-white/[0.01] p-8 relative mt-8">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-gold-primary/25" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-gold-primary/25" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-gold-primary/25" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-gold-primary/25" />

          <h2 className="font-playfair text-lg text-white font-medium tracking-wide mb-6">
            <span>Staff Accounts Management</span>
          </h2>

          <form onSubmit={handleCreateStaff} className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 pb-6 border-b border-white/5">
            <div className="flex flex-col">
              <label className="text-[9px] uppercase tracking-wider text-ivory/40 mb-1.5">Staff Email</label>
              <input
                type="email"
                value={newStaffEmail}
                onChange={(e) => setNewStaffEmail(e.target.value)}
                placeholder="staff@macbellosalon.com"
                className="bg-luxury-black border border-white/10 px-4 py-2.5 text-xs text-white rounded-none focus:outline-none focus:border-gold-primary/50"
                required
              />
            </div>

            <div className="flex flex-col">
              <label className="text-[9px] uppercase tracking-wider text-ivory/40 mb-1.5">Password</label>
              <input
                type="password"
                value={newStaffPassword}
                onChange={(e) => setNewStaffPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-luxury-black border border-white/10 px-4 py-2.5 text-xs text-white rounded-none focus:outline-none focus:border-gold-primary/50"
                required
              />
            </div>

            <div className="flex flex-col">
              <label className="text-[9px] uppercase tracking-wider text-ivory/40 mb-1.5">Branch Assignment</label>
              <select
                value={newStaffBranch}
                onChange={(e) => setNewStaffBranch(e.target.value)}
                className="bg-luxury-black border border-white/10 px-4 py-2.5 text-xs text-white rounded-none focus:outline-none focus:border-gold-primary/50 cursor-pointer"
              >
                <option value="Branch A">Branch A</option>
                <option value="Branch B">Branch B</option>
                <option value="Branch C">Branch C</option>
              </select>
            </div>

            {staffCreateError && (
              <p className="text-[10px] text-red-400 font-light tracking-wide md:col-span-3">{staffCreateError}</p>
            )}
            {staffCreateSuccess && (
              <p className="text-[10px] text-green-400 font-light tracking-wide md:col-span-3">{staffCreateSuccess}</p>
            )}

            <div className="md:col-span-3 pt-2">
              <button
                type="submit"
                disabled={staffCreateLoading}
                className="w-full text-center text-xs uppercase tracking-[0.2em] bg-white/10 hover:bg-white/20 text-white font-semibold py-3 transition-colors cursor-pointer border border-white/10"
              >
                {staffCreateLoading ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
                <span>Register New Staff Account</span>
              </button>
            </div>
          </form>

          <div>
            <h3 className="text-xs uppercase tracking-wider text-gold-primary font-bold mb-4">Active Staff Accounts</h3>
            {staffListLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={20} className="animate-spin text-gold-primary" />
              </div>
            ) : staffList.length === 0 ? (
              <p className="text-xs text-ivory/30 italic text-center py-4">No registered staff users found in authentication database.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] font-light">
                  <thead>
                    <tr className="border-b border-white/10 uppercase text-ivory/40 text-[9px]">
                      <th className="pb-2">Staff Email</th>
                      <th className="pb-2">Branch Assignment</th>
                      <th className="pb-2">User ID</th>
                      <th className="pb-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map((st) => (
                      <tr key={st.id} className="border-b border-white/5">
                        <td className="py-2.5 text-white font-medium">{st.email}</td>
                        <td className="py-2.5 text-gold-primary">{st.app_metadata?.branch || "—"}</td>
                        <td className="py-2.5 text-ivory/40 text-[9px]">{st.id}</td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => handleDeleteStaff(st.id, st.email)}
                            className="text-[9px] uppercase tracking-wider bg-red-900/30 text-red-300 border border-red-500/20 px-2.5 py-1 hover:bg-red-900/60 hover:text-white transition-all cursor-pointer"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Registered Customers List Panel */}
        <div className="border border-white/5 bg-white/[0.01] p-8 relative mt-8">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-gold-primary/25" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-gold-primary/25" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-gold-primary/25" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-gold-primary/25" />

          <h2 className="font-playfair text-lg text-white font-medium tracking-wide mb-6">
            <span>Registered Customers Database</span>
          </h2>

          <div>
            {customerListLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={20} className="animate-spin text-gold-primary" />
              </div>
            ) : customerList.length === 0 ? (
              <p className="text-xs text-ivory/30 italic text-center py-4">No registered customers found in database.</p>
            ) : (
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto no-scrollbar">
                <table className="w-full text-left text-[11px] font-light">
                  <thead>
                    <tr className="border-b border-white/10 uppercase text-ivory/40 text-[9px] sticky top-0 bg-luxury-black z-10">
                      <th className="pb-2">Name</th>
                      <th className="pb-2">Phone</th>
                      <th className="pb-2">Email</th>
                      <th className="pb-2">Branch Origin</th>
                      <th className="pb-2">Loyalty Balance</th>
                      <th className="pb-2 text-right">Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerList.map((cust) => (
                      <tr key={cust.id} className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                        <td className="py-2.5 text-white font-medium">{cust.name}</td>
                        <td className="py-2.5 text-ivory/80 ">{cust.phone}</td>
                        <td className="py-2.5 text-ivory/60">{cust.email || "—"}</td>
                        <td className="py-2.5 text-gold-primary">{cust.branch || "Global"}</td>
                        <td className="py-2.5 text-white font-bold">{cust.points} Pts</td>
                        <td className="py-2.5 text-ivory/40 text-right">
                          {new Date(cust.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex justify-center space-x-6 text-[10px] uppercase tracking-wider text-ivory/40">
          <Link href="/staff/billing" className="hover:text-gold-primary transition-colors">
            Billing Workspace
          </Link>
          <span>•</span>
          <Link href="/staff/billing/services" className="hover:text-gold-primary transition-colors">
            Catalog Management
          </Link>
        </div>
      </div>
    </main>
  );
}
