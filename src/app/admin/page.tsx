"use client";

import { useState, useEffect, useRef } from "react";
import { supabaseAdminClient } from "@/lib/supabase";
import { 
  ShieldAlert, LogOut, Loader2, Download, Calendar, FileSpreadsheet, Award, FileText, TrendingUp, Users, Scissors, Clock, ExternalLink, PackageSearch, PackageOpen, Eye, EyeOff
} from "lucide-react";
import Link from "next/link";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { formatINR, formatNumber, formatDate } from "@/lib/format";
import TransactionReportTable from "@/components/admin/TransactionReportTable";
import CustomerManagement from "@/components/admin/CustomerManagement";
import EditInvoiceModal from "@/components/admin/EditInvoiceModal";

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
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Report Controls
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("All Branches");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [editInvoiceId, setEditInvoiceId] = useState<string | null>(null);

  // Staff Accounts state
  const [staffList, setStaffList] = useState<any[]>([]);
  const [staffListLoading, setStaffListLoading] = useState(false);

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
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        setStatsError("Network error. Please check your connection and try again.");
      } else {
        setStatsError("Something went wrong. Please try again.");
      }
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
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        alert("Network error. Please check your connection and try again.");
      } else {
        alert("Something went wrong. Please try again.");
      }
    } finally {
      setFinStatsLoading(false);
    }
  };

  // New staff inputs
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [newStaffBranch, setNewStaffBranch] = useState("Kaduthuruthy");
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
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        alert("Network error. Please check your connection and try again.");
      } else {
        alert("Something went wrong. Please try again.");
      }
    } finally {
      setStaffListLoading(false);
    }
  };

  // Guard: tracks whether the initial dashboard data has already been loaded by getSession().
  // Prevents onAuthStateChange from duplicating those API calls when it fires right after
  // getSession() on page mount with the same existing session.
  const dashboardLoadedRef = useRef(false);

  useEffect(() => {
    supabaseAdminClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const role = session.user?.app_metadata?.role;
        if (role === "admin") {
          setIsAdmin(true);
          setSessionToken(session.access_token);
          setAdminEmail(session.user?.email || null);
          
          // Parallelize initial admin mount requests
          Promise.all([
            loadStaffList(session.access_token),
            loadDailyStats(session.access_token),
            loadFinancialStats(session.access_token)
          ]);
          // Mark dashboard as loaded so onAuthStateChange skips the duplicate fetch
          dashboardLoadedRef.current = true;
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
          
          // Only load dashboard data if getSession() has NOT already done so.
          // This prevents the duplicate API calls caused by onAuthStateChange
          // firing immediately after getSession() on initial page mount.
          if (!dashboardLoadedRef.current) {
            Promise.all([
              loadStaffList(session.access_token),
              loadDailyStats(session.access_token),
              loadFinancialStats(session.access_token)
            ]);
            dashboardLoadedRef.current = true;
          }
        } else {
          setIsAdmin(false);
          setSessionToken(null);
          setAdminEmail(null);
          setAuthError("Access denied. Admin role required.");
        }
      } else {
        // Session ended (logout) — reset all dashboard state and allow reload on next login
        dashboardLoadedRef.current = false;
        setIsAdmin(false);
        setSessionToken(null);
        setAdminEmail(null);
        setReportData(null);
        setStaffList([]);
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
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        setStaffCreateError("Network error. Please check your connection and try again.");
      } else {
        setStaffCreateError("Something went wrong. Please try again.");
      }
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
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        alert("Network error. Please check your connection and try again.");
      } else {
        alert("Something went wrong. Please try again.");
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, expectedRole: "admin" })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setAuthError(data.error || "Failed to sign in. Please try again.");
      } else if (data.session) {
        await supabaseAdminClient.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });

        setIsAdmin(true);
        setSessionToken(data.session.access_token);
        setAdminEmail(data.session.user?.email || null);
        loadDailyStats(data.session.access_token);
        loadFinancialStats(data.session.access_token);
        loadStaffList(data.session.access_token);
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
        if (data.report.invoices && data.report.invoices.length > 5000) {
          const proceed = window.confirm(`Warning: You are about to load ${data.report.invoices.length} transactions into the browser. This may slow down your device. Do you want to continue?`);
          if (!proceed) {
            setReportData(null);
            return;
          }
        }
        setReportData(data.report);
      } else {
        alert(data.error || "Failed to query transactions.");
      }
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        alert("Network error. Please check your connection and try again.");
      } else {
        alert("Something went wrong. Please try again.");
      }
    } finally {
      setReportLoading(false);
    }
  };

  const exportPDFReport = async (filteredInvoices?: any[], metadata?: any) => {
    if (!reportData) return;
    const invoicesToExport = filteredInvoices || reportData.invoices;
    const filtersStr = metadata?.filters || "None";
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
      doc.text(`Filters: ${filtersStr}`, 200, 30, { align: "right" });

      if (invoicesToExport.length === 0) {
        doc.setTextColor(0, 0, 0);
        doc.text("No transactions recorded for the selected period and branch.", 14, 45);
      } else {
        const body: any[] = [];
        let totalRev = 0;
        let totalTax = 0;
        
        invoicesToExport.forEach(inv => {
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
        doc.text(`Total Invoices: ${invoicesToExport.length}`, 14, finalY + 10);
        doc.text(`Total GST: ${formatINR(totalTax)}`, 14, finalY + 15);
        doc.text(`Total Revenue: ${formatINR(totalRev)}`, 14, finalY + 20);
      }

      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated By: ${adminEmail} on ${new Date().toLocaleString()}`, 14, 290);
      doc.text(`Generated from Macbello Salon Management System`, 200, 290, { align: "right" });

      const fileName = selectedBranch !== "All Branches" 
        ? `Macbello_${selectedBranch.replace(/\\s+/g, "_")}_Transactions_${startDate}_to_${endDate}.pdf`
        : `Macbello_Transactions_${startDate}_to_${endDate}.pdf`;

      doc.save(fileName);
    } catch (err: any) {
      console.error(err);
      alert("Export generation failed. Please try again later.");
    } finally {
      setPdfLoading(false);
    }
  };

  const exportExcelReport = async (filteredInvoices?: any[], metadata?: any) => {
    if (!reportData) return;
    const invoicesToExport = filteredInvoices || reportData.invoices;
    const filtersStr = metadata?.filters || "None";
    
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

      let totalRev = 0;
      let totalTax = 0;
      const rows: any[] = [];
      
      invoicesToExport.forEach(inv => {
        if (inv.status !== 'archived' && inv.status !== 'cancelled') {
          totalRev += parseFloat(inv.grand_total as any) || 0;
          totalTax += parseFloat(inv.total_tax as any) || 0;
        }
        
        const dateStr = formatDate(inv.created_at);
        const customerName = inv.customers?.name || "Anonymous";
        const grand = parseFloat(inv.grand_total as any) || 0;
        const tax = parseFloat(inv.total_tax as any) || 0;
        const sub = parseFloat(inv.subtotal as any) || 0;
        
        inv.invoice_items.forEach((item: any) => {
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
            "Discount": parseFloat(inv.discount as any) || 0,
            "Loyalty Redemption": parseFloat(inv.points_redeemed as any) || 0,
            "Taxable Amount": sub,
            "GST Amount": tax,
            "Grand Total": grand,
            "Status": inv.status
          });
        });
      });

      // Add metadata rows at the top
      const metadataRows = [
        { "Date": "Report Name", "Invoice #": "Transaction Accounting Report" },
        { "Date": "Generated By", "Invoice #": adminEmail },
        { "Date": "Generated Date & Time", "Invoice #": new Date().toLocaleString() },
        { "Date": "Selected Branch", "Invoice #": selectedBranch },
        { "Date": "Date Range", "Invoice #": `${startDate} to ${endDate}` },
        { "Date": "Applied Filters", "Invoice #": filtersStr },
        { "Date": "Total Transactions", "Invoice #": invoicesToExport.length },
        { "Date": "Total Revenue", "Invoice #": totalRev },
        { "Date": "Total Tax", "Invoice #": totalTax },
        {}, // Empty row for spacing
      ];

      const finalRows = [...metadataRows, ...rows];

      const worksheet = XLSX.utils.json_to_sheet(finalRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
      
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const data = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
      
      const fileName = selectedBranch !== "All Branches" 
        ? `Macbello_${selectedBranch.replace(/\\s+/g, "_")}_Transactions_${startDate}_to_${endDate}.xlsx`
        : `Macbello_Transactions_${startDate}_to_${endDate}.xlsx`;
        
      saveAs(data, fileName);
    } catch (err: any) {
      console.error(err);
      alert("Export generation failed. Please try again later.");
    }
  };

  const handleEditInvoice = (id: string) => {
    setEditInvoiceId(id);
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!confirm(`Are you sure you want to delete invoice ${id}?`)) return;
    try {
      const res = await fetch("/api/billing/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sessionToken}` },
        body: JSON.stringify({ action: "delete_invoice", id })
      });
      const data = await res.json();
      if (data.success) {
        alert("Invoice deleted (archived) successfully.");
        if (reportData) {
          setReportData({
            ...reportData,
            invoices: reportData.invoices.map((inv: any) => inv.id === id ? { ...inv, status: "archived" } : inv)
          });
        }
      } else {
        alert(data.error || "Failed to delete invoice.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while deleting the invoice.");
    }
  };

  const handleRestoreInvoice = async (id: string) => {
    if (!confirm(`Are you sure you want to restore invoice ${id}?`)) return;
    try {
      const res = await fetch("/api/billing/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sessionToken}` },
        body: JSON.stringify({ action: "restore_invoice", id })
      });
      const data = await res.json();
      if (data.success) {
        alert("Invoice restored successfully.");
        if (reportData) {
          setReportData({
            ...reportData,
            invoices: reportData.invoices.map((inv: any) => inv.id === id ? { ...inv, status: "active" } : inv)
          });
        }
      } else {
        alert(data.error || "Failed to restore invoice.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while restoring the invoice.");
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
            <Link href="/admin/billing/services" className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.15em] border border-white/10 hover:border-gold-primary/40 hover:text-gold-primary px-4 py-2 bg-white/[0.02] transition-all duration-300 rounded-none">
              <PackageSearch className="w-3.5 h-3.5" />
              <span>Catalog</span>
            </Link>
            <Link href="/admin/products" className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.15em] border border-white/10 hover:border-gold-primary/40 hover:text-gold-primary px-4 py-2 bg-white/[0.02] transition-all duration-300 rounded-none">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Inventory</span>
            </Link>
            <Link href="/admin/purchase-of-stocks" className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.15em] border border-white/10 hover:border-gold-primary/40 hover:text-gold-primary px-4 py-2 bg-white/[0.02] transition-all duration-300 rounded-none">
              <PackageOpen className="w-3.5 h-3.5" />
              <span>Purchase Of Stocks</span>
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
                <span className="metric-value text-xl text-white font-medium tracking-wide">
                  {formatINR(finStats.todayRevenue)}
                </span>
              </div>
              {/* Monthly Revenue */}
              <div className="border border-white/5 bg-white/[0.01] p-4 relative flex flex-col justify-between h-[100px]">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] uppercase tracking-wider text-ivory/50">This Month</span>
                  <TrendingUp size={14} className="text-gold-primary" />
                </div>
                <span className="metric-value text-xl text-white font-medium tracking-wide">
                  {formatINR(finStats.monthlyRevenue)}
                </span>
              </div>
              {/* Total Revenue */}
              <div className="border border-white/5 bg-white/[0.01] p-4 relative flex flex-col justify-between h-[100px]">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] uppercase tracking-wider text-ivory/50">Total Revenue</span>
                  <Award size={14} className="text-gold-primary" />
                </div>
                <span className="metric-value text-xl text-white font-medium tracking-wide">
                  {formatINR(finStats.totalRevenue)}
                </span>
              </div>
              {/* Customers */}
              <div className="border border-white/5 bg-white/[0.01] p-4 relative flex flex-col justify-between h-[100px]">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] uppercase tracking-wider text-ivory/50">Customers</span>
                  <Users size={14} className="text-gold-primary" />
                </div>
                <span className="metric-value text-xl text-white font-medium tracking-wide">
                  {formatNumber(finStats.totalCustomers)}
                </span>
              </div>
              {/* Services */}
              <div className="border border-white/5 bg-white/[0.01] p-4 relative flex flex-col justify-between h-[100px]">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] uppercase tracking-wider text-ivory/50">Services</span>
                  <Scissors size={14} className="text-gold-primary" />
                </div>
                <span className="metric-value text-xl text-white font-medium tracking-wide">
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
                  <span className="metric-value text-xl text-white font-medium tracking-wide">
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
                  <span className="currency-value text-2xl text-white font-medium tracking-wide mt-0.5 block">
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
                  <span className="metric-value text-2xl text-white font-medium tracking-wide mt-0.5 block">
                    {stats.invoiceCount} Invoices
                  </span>
                </div>
              </div>
            </div>

            {/* Performance Breakdowns Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Peruvaontribution */}
              {stats.branchBreakdown && (
                <div className="border border-white/5 bg-white/[0.01] p-6 relative">
                  <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-gold-primary/25" />
                  <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-gold-primary/25" />
                  <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-gold-primary/25" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-gold-primary/25" />
                  <span className="text-[10px] uppercase tracking-wider text-gold-primary block font-bold mb-3">Peruvaontribution</span>
                  <div className="grid grid-cols-3 gap-3 text-xs text-ivory/70">
                    <div className="bg-white/[0.02] border border-white/5 p-3 text-center">
                      <span className="block font-medium text-white/90 truncate mb-1 text-[10px]">Kaduthuruthy</span>
                      <span className="currency-value text-xs text-gold-primary font-bold">₹{(stats.branchBreakdown["Kaduthuruthy"] || 0).toFixed(0)}</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 p-3 text-center">
                      <span className="block font-medium text-white/90 truncate mb-1 text-[10px]">Ettumanoor</span>
                      <span className="currency-value text-xs text-gold-primary font-bold">₹{(stats.branchBreakdown["Ettumanoor"] || 0).toFixed(0)}</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 p-3 text-center">
                      <span className="block font-medium text-white/90 truncate mb-1 text-[10px]">Peruva</span>
                      <span className="currency-value text-xs text-gold-primary font-bold">₹{(stats.branchBreakdown["Peruva"] || 0).toFixed(0)}</span>
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
                          <span className="metric-value text-gold-primary font-semibold">
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
                <option value="Kaduthuruthy">Kaduthuruthy</option>
                <option value="Ettumanoor">Ettumanoor</option>
                <option value="Peruva">Peruva</option>
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
            <div className="border-t border-white/5 pt-6 flex flex-col items-center justify-center">
              <div className="w-full mb-8">
                <TransactionReportTable 
                  invoices={reportData.invoices} 
                  onExportPDF={exportPDFReport} 
                  onExportExcel={exportExcelReport}
                  role="admin"
                  onEdit={handleEditInvoice}
                  onDelete={handleDeleteInvoice}
                  onRestore={handleRestoreInvoice}
                />
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
              <label className="text-[9px] uppercase tracking-wider text-ivory/40 mb-1.5">Kaduthuruthyssignment</label>
              <select
                value={newStaffBranch}
                onChange={(e) => setNewStaffBranch(e.target.value)}
                className="bg-luxury-black border border-white/10 px-4 py-2.5 text-xs text-white rounded-none focus:outline-none focus:border-gold-primary/50 cursor-pointer"
              >
                <option value="Kaduthuruthy">Kaduthuruthy</option>
                <option value="Ettumanoor">Ettumanoor</option>
                <option value="Peruva">Peruva</option>
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
                      <th className="pb-2">Kaduthuruthyssignment</th>
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

        {/* Customer Management Panel */}
        <CustomerManagement sessionToken={sessionToken!} />

        <div className="mt-8 flex justify-center space-x-6 text-[10px] uppercase tracking-wider text-ivory/40">
          <Link href="/staff/billing" className="hover:text-gold-primary transition-colors">
            Billing Workspace
          </Link>
          <span>•</span>
          <Link href="/admin/billing/services" className="hover:text-gold-primary transition-colors">
            Catalog Management
          </Link>
        </div>
      </div>
      {editInvoiceId && (
        <EditInvoiceModal
          invoiceId={editInvoiceId}
          sessionToken={sessionToken!}
          onClose={() => setEditInvoiceId(null)}
          onSuccess={(updatedInvoice) => {
            alert("Invoice updated successfully!");
            setEditInvoiceId(null);
            // Refresh data
            handleGenerateReport({ preventDefault: () => {} } as React.FormEvent);
          }}
        />
      )}
    </main>
  );
}
