"use client";
import { getTaxInfo } from '@/lib/gst';


import { useState, useEffect } from "react";
import { supabaseStaffClient, supabaseAdminClient } from "@/lib/supabase";
import { 
  ArrowLeft, Search, Plus, User, Phone, Mail, Award, AlertCircle, 
  Loader2, Trash2, ShoppingBag, Scissors, FileText, CheckCircle2, Printer, Download
} from "lucide-react";
import Link from "next/link";
import { downloadInvoicePDF, buildInvoicePDFDocument, CompletedInvoice } from "@/lib/pdf";
import { recalculateInvoiceTotals } from "@/lib/invoiceUtils";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  points: number;
}

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
}

export default function BillingModule() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [staffEmail, setStaffEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);

  // Customer Management
  const [searchPhone, setSearchPhone] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [createName, setCreateName] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createGstin, setCreateGstin] = useState("");
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Catalog / Cart
  const [catalog, setCatalog] = useState<ServiceItem[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"All" | "Service" | "Retail">("All");
  const [cart, setCart] = useState<CartItem[]>([]);

  // Branch
  const [branch, setBranch] = useState("Kaduthuruthy");

  // Loyalty Redemption & Discount
  const [pointsToRedeem, setPointsToRedeem] = useState("");
  const [redeemError, setRedeemError] = useState("");
  const [manualDiscount, setManualDiscount] = useState("");
  const [discountError, setDiscountError] = useState("");

  // Checkout
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [completedInvoice, setCompletedInvoice] = useState<CompletedInvoice | null>(null);

  // PDF Generation
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [pdfSuccess, setPdfSuccess] = useState(false);

  // Email Dispatch
  const [emailStatus, setEmailStatus] = useState<"ready" | "sending" | "success" | "failed">("ready");
  const [emailError, setEmailError] = useState("");

  // Invoice Date (Backdated billing)
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toLocaleDateString("sv-SE")); // sv-SE locale gives YYYY-MM-DD

  const loadCatalog = async (token: string) => {
    try {
      const res = await fetch("/api/billing/admin?action=get_services", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCatalog(data.services || []);
      } else {
        setAuthError(data.error || "Failed to load catalog items.");
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
        const userBranch = session.user?.app_metadata?.branch || "Kaduthuruthy";
        if (role === "staff" || role === "admin") {
          setSessionToken(session.access_token);
          setStaffEmail(session.user?.email || null);
          setUserRole(role);
          if (role === "staff") {
            setBranch(userBranch);
          }
          loadCatalog(session.access_token);
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

    // Listen for sign-outs on both clients to redirect users who log out.
    // Do NOT call loadCatalog() here — checkAuth() already handles the initial load.
    // Calling it here would cause up to 3 catalog fetches on every page mount.
    const subStaff = supabaseStaffClient.auth.onAuthStateChange((_event, session) => {
      if (session) {
        // Update session token in case it was refreshed, but do not re-fetch catalog
        const role = session.user?.app_metadata?.role;
        const userBranch = session.user?.app_metadata?.branch || "Kaduthuruthy";
        if (role === "staff" || role === "admin") {
          setSessionToken(session.access_token);
          setStaffEmail(session.user?.email || null);
          setUserRole(role);
          if (role === "staff") {
            setBranch(userBranch);
          }
        }
      } else {
        // Staff signed out — clear state
        setSessionToken(null);
        setStaffEmail(null);
        setUserRole(null);
        setCatalog([]);
        setLoading(false);
      }
    });

    const subAdmin = supabaseAdminClient.auth.onAuthStateChange((_event, session) => {
      if (session) {
        // Update session token in case it was refreshed, but do not re-fetch catalog
        const role = session.user?.app_metadata?.role;
        if (role === "admin") {
          setSessionToken(session.access_token);
          setStaffEmail(session.user?.email || null);
          setUserRole(role);
        }
      }
    });

    return () => {
      subStaff.data.subscription.unsubscribe();
      subAdmin.data.subscription.unsubscribe();
    };
  }, []);

  // Search Customer
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPhone.trim()) return;
    setSearchLoading(true);
    setSearchResults([]);

    try {
      const res = await fetch(`/api/billing/admin?action=search_customers&phone=${encodeURIComponent(searchPhone)}`, {
        headers: {
          "Authorization": `Bearer ${sessionToken}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSearchResults(data.customers || []);
        if (data.customers.length === 0) {
          setSearchPhone("");
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        alert("Network error. Please check your connection and try again.");
      } else {
        alert("Something went wrong. Please try again.");
      }
    } finally {
      setSearchLoading(false);
    }
  };

  // Register Customer
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");
    setCreateLoading(true);

    try {
      const res = await fetch("/api/billing/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          action: "create_customer",
          name: createName,
          phone: createPhone,
          email: createEmail,
          gstin: createGstin || undefined
        })
      });

      const result = await res.json();

      if (!res.ok) {
        setCreateError(result.error || "Failed to create customer.");
      } else {
        setCreateSuccess("Customer registered successfully!");
        setSelectedCustomer(result.customer);
        setCreateName("");
        setCreatePhone("");
        setCreateEmail("");
        setCreateGstin("");
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

  // Cart Management
  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((c) => c.item.id !== itemId));
  };

  // Calculations
  const redeemPointsNum = parseInt(pointsToRedeem, 10) || 0;
  const manualDiscountNum = parseFloat(manualDiscount) || 0;

  // Single Source of Truth Calculation
  const invoiceItemsInput = cart.map(c => ({
    category: c.item.category,
    quantity: c.quantity,
    // The database stores the GST-Exclusive base price. 
    // The invoice engine expects the GST-Inclusive sale price.
    unit_price: Math.round(c.item.price * (1 + getTaxInfo(c.item).gstDecimal) * 100) / 100,
    tax_rate: c.item.tax_rate
  }));

  // Safe fallback to prevent crash on empty cart
  let calcTotals = {
    subtotal: 0,
    service_base: 0,
    retail_base: 0,
    service_inclusive: 0,
    retail_inclusive: 0,
    service_tax: 0,
    retail_tax: 0,
    total_tax: 0,
    discount: 0,
    points_redeemed: 0,
    grand_total: 0,
    points_earned: 0
  };

  if (invoiceItemsInput.length > 0) {
    try {
      calcTotals = recalculateInvoiceTotals(invoiceItemsInput, manualDiscountNum, redeemPointsNum);
    } catch (e) {
      // Ignored for live preview
    }
  }

  const {
    subtotal,
    total_tax: totalTax,
    grand_total: grandTotal,
    points_earned: pointsEarned
  } = calcTotals;

  const preDiscountTotal = subtotal + totalTax; // Used ONLY for points redemption validation ceiling

  // Validate points redemption
  const handlePointsChange = (val: string) => {
    setPointsToRedeem(val);
    setRedeemError("");

    if (!selectedCustomer) return;
    const num = parseInt(val, 10);
    if (isNaN(num)) return;

    if (num < 0) {
      setRedeemError("Points cannot be negative.");
    } else if (num > selectedCustomer.points) {
      setRedeemError(`Customer only has ${selectedCustomer.points} points.`);
    } else if (num > preDiscountTotal - (parseFloat(manualDiscount) || 0)) {
      setRedeemError("Total discount cannot exceed bill total.");
    }
  };

  // Validate manual discount
  const handleManualDiscountChange = (val: string) => {
    setManualDiscount(val);
    setDiscountError("");
    
    const num = parseFloat(val);
    if (isNaN(num)) return;

    if (num < 0) {
      setDiscountError("Discount cannot be negative.");
    } else if (num > preDiscountTotal) {
      setDiscountError("Discount cannot exceed bill total.");
    } else if (num + (parseInt(pointsToRedeem, 10) || 0) > preDiscountTotal) {
      setDiscountError("Total discount cannot exceed bill total.");
    }
  };

  // Checkout submit
  const handleCheckout = async () => {
    setCheckoutError("");
    if (!selectedCustomer) {
      setCheckoutError("Please select or register a customer first.");
      return;
    }
    if (cart.length === 0) {
      setCheckoutError("Please add at least one item to the bill.");
      return;
    }
    if (redeemError || discountError) {
      setCheckoutError("Please fix redemption or discount errors.");
      return;
    }

    setCheckoutLoading(true);

    try {
      const res = await fetch("/api/billing/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          action: "create_invoice",
          idempotencyKey: crypto.randomUUID(),
          customerId: selectedCustomer.id,
          items: cart.map((c) => ({ 
            id: c.item.id, 
            quantity: c.quantity,
            staffContribution: c.staffContribution || null
          })),
          pointsToRedeem: redeemPointsNum,
          discountAmount: manualDiscountNum,
          branch,
          paymentMethod,
          invoiceDate: invoiceDate || undefined
        })
      });

      const result = await res.json();

      if (!res.ok) {
        setCheckoutError(result.error || "Checkout transaction failed.");
      } else {
        setCompletedInvoice({
          invoice: result.invoice,
          items: result.items,
          customer: selectedCustomer,
          newPoints: result.newPoints,
          branch
        });
        // Clear state
        setCart([]);
        setSelectedCustomer(null);
        setPointsToRedeem("");
        setManualDiscount("");
        setSearchPhone("");
        setSearchResults([]);
      }
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        setCheckoutError("Network error. Please check your connection and try again.");
      } else {
        setCheckoutError("Something went wrong. Please try again.");
      }
    } finally {
      setCheckoutLoading(false);
    }
  };

  const startNewInvoice = () => {
    setCompletedInvoice(null);
    setCheckoutError("");
    setPdfError("");
    setPdfSuccess(false);
    setEmailStatus("ready");
    setEmailError("");
    setInvoiceDate(new Date().toLocaleDateString("sv-SE"));
  };

  const handleDownloadPDF = async () => {
    if (pdfLoading || !completedInvoice) return; // Prevent concurrent downloads
    setPdfError("");
    setPdfSuccess(false);
    setPdfLoading(true);

    try {
      await downloadInvoicePDF(completedInvoice);
      setPdfSuccess(true);
      // Auto-clear success status after 3 seconds
      setTimeout(() => setPdfSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setPdfError("Export generation failed. Please try again later.");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleSendInvoiceEmail = async () => {
    if (!completedInvoice || emailStatus === "sending") return;

    const { customer, invoice } = completedInvoice;
    if (!customer.email || customer.email.trim() === "") {
      setEmailError("Customer email required to send invoice.");
      setEmailStatus("failed");
      return;
    }

    setEmailStatus("sending");
    setEmailError("");

    try {
      // 1. Generate PDF in-memory using the exact same build function
      const doc = buildInvoicePDFDocument(completedInvoice);
      const dataUri = doc.output("datauristring");
      const pdfBase64 = dataUri.split(",")[1];

      // 2. Post to secure server api endpoint
      const res = await fetch("/api/billing/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          action: "send_invoice_email",
          invoiceId: invoice.id,
          pdfBase64
        })
      });

      const result = await res.json();

      if (!res.ok) {
        setEmailError(result.error || "Email dispatch failed on the server.");
        setEmailStatus("failed");
      } else {
        setEmailStatus("success");
        // Clear success status after 4 seconds
        setTimeout(() => setEmailStatus("ready"), 4000);
      }
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError) {
        setEmailError("Network error. Please check your connection and try again.");
      } else {
        setEmailError("Something went wrong. Please try again.");
      }
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

  // Invoice Render Screen
  if (completedInvoice) {
    const { invoice, items: finalItems, customer, newPoints } = completedInvoice;
    
    // Determine membership tier based on points
    let tier = "Bronze";
    if (newPoints >= 1500) {
      tier = "Platinum";
    } else if (newPoints >= 500) {
      tier = "Gold";
    } else if (newPoints >= 100) {
      tier = "Silver";
    }

    // Branch Details lookup
    const branchInfo: Record<string, { address: string; phone: string }> = {
      Kaduthuruthy: {
        address: "Market Junction, Kaduthuruthy, Kerala 686604",
        phone: "+91 95625 14002"
      },
      Ettumanoor: {
        address: "Ground Floor, Panthaplackil Buildings, MC Road, Ettumanoor, Kottayam, Kerala 686632",
        phone: "+91 97469 14003"
      },
      Peruva: {
        address: "Macbello Family Salon, Peruva, Kerala 686610",
        phone: "+91 95448 14003"
      }
    };

    const activeBranch = branchInfo[completedInvoice.branch] || {
      address: "Macbello Salon, Kerala",
      phone: "+91 95625 14002"
    };

    return (
      <main className="min-h-screen bg-luxury-black text-white px-6 py-12 md:py-20 flex flex-col items-center relative">
        <div className="absolute top-[10%] left-[10%] w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(212,175,55,0.015),transparent_70%)] pointer-events-none" />

        {/* CSS Printer styles injected locally */}
        <style>{`
          @media print {
            body, html, main {
              background: #ffffff !important;
              color: #111111 !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            #printable-invoice {
              background: #ffffff !important;
              color: #111111 !important;
              border: none !important;
              box-shadow: none !important;
              padding: 0 !important;
              margin: 0 !important;
              max-width: 100% !important;
              width: 100% !important;
            }
            .print-text-black {
              color: #111111 !important;
            }
            .print-text-muted {
              color: #555555 !important;
            }
            .print-text-gold {
              color: #aa7c11 !important;
            }
            .print-bg-light {
              background-color: #f9f9f9 !important;
              border-color: #e5e5e5 !important;
            }
            .print-border-gray {
              border-color: #d4d4d4 !important;
            }
            .print-border-dark {
              border-color: #111111 !important;
            }
            .print-hidden {
              display: none !important;
            }
          }
        `}</style>

        {/* Printable Area Wrapper */}
        <div className="max-w-2xl w-full border border-gold-primary/20 bg-neutral-900/90 backdrop-blur-md p-8 md:p-12 relative shadow-2xl print:bg-white print:text-black print:border-none" id="printable-invoice">
          
          {/* Gold corners */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-gold-primary/45 print-hidden" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-gold-primary/45 print-hidden" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-gold-primary/45 print-hidden" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-gold-primary/45 print-hidden" />

          {/* Header */}
          <div className="text-center border-b border-white/10 pb-6 mb-8 print-border-gray">
            <span className="text-[10px] uppercase tracking-[0.3em] text-gold-primary print-text-gold font-bold block mb-1">Macbello Salon & Spa</span>
            <h1 className="font-playfair text-3xl tracking-wider text-gold-primary print-text-gold font-light mb-2">TAX INVOICE</h1>
            
            <div className="text-[10px] text-ivory/50 print-text-muted font-light flex flex-col space-y-1 mt-3">
              <span className="text-white print-text-black font-semibold uppercase tracking-wider text-xs">Branch: {completedInvoice.branch}</span>
              <span>{activeBranch.address}</span>
              <span>Phone: {activeBranch.phone}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/5 print-border-gray text-left text-[10px] text-ivory/60 print-text-muted">
              <div>
                <span className="block"><strong className="text-gold-primary print-text-gold font-semibold uppercase">Invoice ID:</strong> {invoice.id}</span>
                <span className="block mt-1"><strong className="text-gold-primary print-text-gold font-semibold uppercase">Invoice #:</strong> {invoice.invoice_number}</span>
              </div>
              <div className="text-right">
                <span className="block"><strong className="text-gold-primary print-text-gold font-semibold uppercase">Date:</strong> {new Date(invoice.created_at).toLocaleDateString()}</span>
                <span className="block mt-1"><strong className="text-gold-primary print-text-gold font-semibold uppercase">Time:</strong> {new Date(invoice.created_at).toLocaleTimeString()}</span>
                <span className="block mt-1"><strong className="text-gold-primary print-text-gold font-semibold uppercase">Payment Mode:</strong> {invoice.payment_method || 'Cash'}</span>
              </div>
            </div>
          </div>

          {/* Client & Staff Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 text-xs font-light">
            <div className="border border-white/5 p-4 bg-white/[0.01] print-bg-light print-border-gray">
              <span className="text-[9px] uppercase tracking-wider text-gold-primary print-text-gold font-bold block mb-2">Billed To (Customer):</span>
              <div className="text-white print-text-black font-semibold text-sm">{customer.name}</div>
              <div className="text-ivory/80 print-text-muted mt-1">Phone: {customer.phone}</div>
              {customer.email && <div className="text-ivory/60 print-text-muted mt-0.5">Email: {customer.email}</div>}
              
              <div className="border-t border-white/5 pt-2 mt-2 flex justify-between text-[10px] text-ivory/40 print-text-muted print-border-gray">
                <span>Customer ID: {customer.id.substring(0, 8).toUpperCase()}</span>
                <span className="text-gold-primary print-text-gold font-semibold uppercase tracking-wider">Tier: {tier}</span>
              </div>
            </div>

            <div className="border border-white/5 p-4 bg-white/[0.01] print-bg-light print-border-gray">
              <span className="text-[9px] uppercase tracking-wider text-gold-primary print-text-gold font-bold block mb-2">Staff Accountability:</span>
              <div className="text-white print-text-black font-medium">Email: {invoice.created_by}</div>
              <div className="text-ivory/70 print-text-muted mt-1">Staff ID: {invoice.created_by.split("@")[0].toUpperCase()}</div>
              <div className="text-ivory/50 print-text-muted mt-2 text-[9px] leading-relaxed">
                Logged invoice submission validated server-side. Transaction verified.
              </div>
            </div>
          </div>
          {/* Items Table */}
          <table className="w-full text-left text-xs font-light mb-8 border-collapse">
            <thead>
              <tr className="border-b border-gold-primary/20 text-[10px] uppercase tracking-wider text-gold-primary print-text-gold font-bold">
                <th className="pb-3">Item Description</th>
                <th className="pb-3 pr-8">HSN</th>
                <th className="pb-3">Category</th>
                <th className="pb-3 text-center">Qty</th>
                <th className="pb-3">Unit Price (GST Included)</th>
                <th className="pb-3">Tax Rate</th>
                <th className="pb-3 text-right">Total (GST Included)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 print-border-gray">
              {finalItems.map((item, idx: number) => (
                <tr key={idx} className="text-ivory/80 print-text-black">
                  <td className="py-3.5 pr-2">
                    <span className="block font-medium text-white print-text-black">
                      {item.item_name} {item.item_code ? `[${item.item_code}]` : ""}
                    </span>
                    {item.staff_contribution && (
                      <span className="block text-[10px] text-gold-primary/80 font-light mt-0.5">
                        Staff: {item.staff_contribution}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 pr-8 text-white print-text-black">{getTaxInfo(item).hsn}</td>
                  <td className="py-3.5 text-gold-primary/70 print-text-gold font-medium">{item.category}</td>
                  <td className="metric-value py-3.5 text-center font-medium text-white print-text-black">{item.quantity}</td>
                  <td className="currency-value py-3.5 text-white print-text-black">₹{parseFloat(item.unit_price).toFixed(2)}</td>
                  <td className="metric-value py-3.5 text-ivory/60 print-text-muted">
                    {getTaxInfo(item).gstLabel}
                    <span className="block text-[9px] text-ivory/40">
                      ({parseFloat(getTaxInfo(item).gstLabel) / 2}% CGST + {parseFloat(getTaxInfo(item).gstLabel) / 2}% SGST)
                    </span>
                  </td>
                  <td className="currency-value py-3.5 text-right font-medium text-white print-text-black">₹{parseFloat(item.line_total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Financial Breakdown */}
          <div className="border-t border-white/10 pt-4 mb-6 print-border-gray text-xs font-light grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left: Loyalty information Card */}
            <div className="bg-gold-primary/[0.02] border border-gold-primary/25 p-4 rounded-none h-fit print-bg-light print-border-gray">
              <span className="text-[9px] uppercase tracking-wider text-gold-primary print-text-gold font-bold block mb-3">Loyalty Summary Card</span>
              
              <div className="space-y-2 text-ivory/80 print-text-black">
                <div className="flex justify-between text-[10px] text-ivory/50 print-text-muted">
                  <span>Loyalty Rate:</span>
                  <span>1 Pt per ₹10 spent</span>
                </div>
                
                <div className="flex justify-between border-t border-white/5 pt-2 print-border-gray">
                  <span>Points Earned:</span>
                  <span className="metric-value font-semibold text-green-400 print-text-black">+{invoice.points_earned}</span>
                </div>
                
                {invoice.points_redeemed > 0 && (
                  <div className="flex justify-between">
                    <span>Points Redeemed:</span>
                    <span className="metric-value font-semibold text-red-400 print-text-black">-{invoice.points_redeemed}</span>
                  </div>
                )}
                
                <div className="border-t border-gold-primary/20 pt-2 mt-2 flex justify-between print-border-gray">
                  <span className="font-medium text-gold-primary print-text-gold">New Loyalty Balance:</span>
                  <span className="metric-value font-bold text-white print-text-black">{newPoints} Pts</span>
                </div>
              </div>
            </div>

            {/* Right: Tax Breakdown and Totals */}
            <div className="space-y-2 text-ivory/70 print-text-black">
              <div className="flex justify-between">
                <span>Subtotal (GST Included):</span>
                <span className="currency-value text-white print-text-black">₹{(parseFloat(invoice.subtotal) + parseFloat(invoice.total_tax)).toFixed(2)}</span>
              </div>
              {parseFloat(invoice.service_tax as any) > 0 && (
                <>
                  <div className="flex justify-between text-[11px] pl-2 border-l border-white/5 print-border-gray">
                    <span>Service CGST (2.5%):</span>
                    <span className="currency-value text-white print-text-black">₹{(parseFloat(invoice.service_tax as any) / 2).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] pl-2 border-l border-white/5 print-border-gray">
                    <span>Service SGST (2.5%):</span>
                    <span className="currency-value text-white print-text-black">₹{(parseFloat(invoice.service_tax as any) / 2).toFixed(2)}</span>
                  </div>
                </>
              )}
              {parseFloat(invoice.retail_tax as any) > 0 && (
                <>
                  <div className="flex justify-between text-[11px] pl-2 border-l border-white/5 print-border-gray">
                    <span>Retail CGST (9%):</span>
                    <span className="currency-value text-white print-text-black">₹{(parseFloat(invoice.retail_tax as any) / 2).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] pl-2 border-l border-white/5 print-border-gray">
                    <span>Retail SGST (9%):</span>
                    <span className="currency-value text-white print-text-black">₹{(parseFloat(invoice.retail_tax as any) / 2).toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-medium border-t border-white/5 pt-1.5 mt-1">
                <span>Total Tax (CGST + SGST):</span>
                <span className="currency-value text-white print-text-black">₹{parseFloat(invoice.total_tax).toFixed(2)}</span>
              </div>
              {parseFloat(invoice.discount) > 0 && (
                <div className="flex justify-between text-white print-text-black font-medium">
                  <span>Discount:</span>
                  <span className="currency-value">-₹{parseFloat(invoice.discount).toFixed(2)}</span>
                </div>
              )}
              {invoice.points_redeemed > 0 && (
                <div className="flex justify-between text-red-400 print-text-black font-medium">
                  <span>Loyalty Discount:</span>
                  <span className="currency-value">-₹{invoice.points_redeemed.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gold-primary/30 pt-2 mt-2 font-playfair text-base text-gold-primary print-text-gold">
                <span className="font-bold">GRAND TOTAL:</span>
                <span className="currency-value font-bold text-white print-text-black">₹{parseFloat(invoice.grand_total).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Professional Footer */}
          <div className="text-center text-[10px] text-ivory/40 print-text-muted mt-8 border-t border-white/10 pt-5 print-border-gray space-y-1.5 font-light">
            <p className="text-gold-primary print-text-gold font-medium">Thank you for visiting Macbello Salon. Premium self-care is a luxury you deserve.</p>
            <p>Join our Loyalty Rewards program and earn points on every service or retail transaction.</p>
            <p className="text-[9px] pt-1">
              Contact us at <span className="text-white print-text-black font-medium">{activeBranch.phone}</span> | Website: <span className="text-white print-text-black font-medium">www.macbello.com</span>
            </p>
          </div>
        </div>

        {/* Buttons (Hidden on print) */}
        <div className="flex flex-wrap gap-4 mt-8 print-hidden justify-center">
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.15em] border border-white/10 hover:border-gold-primary/45 text-white px-6 py-3 font-semibold transition-colors cursor-pointer bg-white/5"
          >
            <Printer size={14} className="text-gold-primary" />
            <span>Print Invoice</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.15em] border border-gold-primary/20 hover:border-gold-primary/65 text-white px-6 py-3 font-semibold transition-colors cursor-pointer bg-gold-primary/5 disabled:opacity-50"
          >
            {pdfLoading ? (
              <Loader2 size={14} className="animate-spin text-gold-primary" />
            ) : (
              <Download size={14} className="text-gold-primary" />
            )}
            <span>{pdfLoading ? "Generating..." : "Download PDF"}</span>
          </button>

          {customer.email ? (
            <button
              onClick={handleSendInvoiceEmail}
              disabled={emailStatus === "sending"}
              className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.15em] border border-gold-primary/20 hover:border-gold-primary/65 text-white px-6 py-3 font-semibold transition-colors cursor-pointer bg-gold-primary/5 disabled:opacity-50"
            >
              {emailStatus === "sending" ? (
                <Loader2 size={14} className="animate-spin text-gold-primary" />
              ) : (
                <Mail size={14} className="text-gold-primary" />
              )}
              <span>
                {emailStatus === "ready" && "Send Invoice Email"}
                {emailStatus === "sending" && "Sending..."}
                {emailStatus === "success" && "Sent Successfully"}
                {emailStatus === "failed" && "Failed"}
              </span>
            </button>
          ) : (
            <div className="flex flex-col items-center">
              <button
                disabled
                className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.15em] border border-white/10 text-white/30 px-6 py-3 font-semibold bg-white/[0.02] cursor-not-allowed opacity-50"
              >
                <Mail size={14} />
                <span>Send Invoice Email</span>
              </button>
              <span className="text-[9px] text-red-400 font-light mt-1.5 print-hidden">
                Customer email required to send invoice.
              </span>
            </div>
          )}

          <button
            onClick={startNewInvoice}
            className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.15em] bg-gold-primary hover:bg-gold-dark text-luxury-black px-6 py-3 font-semibold transition-colors cursor-pointer"
          >
            <FileText size={14} />
            <span>Start New Invoice</span>
          </button>
        </div>

        {pdfSuccess && (
          <p className="text-[10px] text-green-400 font-light mt-3 flex items-center print-hidden">
            <CheckCircle2 size={12} className="mr-1 text-green-400" /> PDF downloaded successfully!
          </p>
        )}
        {pdfError && (
          <p className="text-[10px] text-red-400 font-light mt-3 flex items-center print-hidden">
            <AlertCircle size={12} className="mr-1 text-red-400" /> {pdfError}
          </p>
        )}
        {emailStatus === "success" && (
          <p className="text-[10px] text-green-400 font-light mt-3 flex items-center print-hidden">
            <CheckCircle2 size={12} className="mr-1 text-green-400" /> Email invoice dispatched successfully to customer!
          </p>
        )}
        {emailError && (
          <p className="text-[10px] text-red-400 font-light mt-3 flex items-center print-hidden">
            <AlertCircle size={12} className="mr-1 text-red-400" /> {emailError}
          </p>
        )}
      </main>
    );
  }

  // Cart/Form builder view
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
              Prestige Operations
            </span>
            <h1 className="font-playfair text-2xl md:text-3xl font-light tracking-wide">
              Billing & Invoicing Workspace
            </h1>
            <p className="text-[10px] text-ivory/40 font-light mt-1 uppercase tracking-wider">
              Signed in as: <span className="text-gold-primary/80">{staffEmail}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] text-ivory/50 uppercase tracking-wider">Branch Location:</span>
            {userRole === "admin" ? (
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="bg-neutral-900 border border-white/10 px-4 py-2 text-xs text-white rounded-none focus:outline-none cursor-pointer appearance-none"
              >
                <option value="Kaduthuruthy">Kaduthuruthy</option>
                <option value="Ettumanoor">Ettumanoor</option>
                <option value="Peruva">Peruva</option>
              </select>
            ) : (
              <span className="text-xs text-white border border-white/10 px-4 py-2 bg-neutral-900/50 uppercase tracking-wider font-semibold">
                {branch}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Columns (Steps 1, 2, 3) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Step 1: Customer Selection */}
            <div className="border border-white/5 bg-white/[0.01] p-6 relative">
              <h2 className="font-playfair text-base text-white font-medium tracking-wide mb-4 flex items-center border-b border-white/5 pb-3">
                <span className="w-5 h-5 rounded-full bg-gold-primary/20 text-gold-primary text-[10px] flex items-center justify-center font-bold mr-2">1</span>
                <span>Customer Selection / Registration</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Search */}
                <div className="space-y-4">
                  <span className="text-[10px] uppercase tracking-wider text-gold-primary block font-semibold">Search Existing Database</span>
                  <form onSubmit={handleSearch} className="flex gap-2">
                    <input
                      type="tel"
                      value={searchPhone}
                      onChange={(e) => setSearchPhone(e.target.value)}
                      placeholder="Enter customer phone..."
                      className="bg-luxury-black border border-white/10 px-3 py-2 text-xs text-white placeholder-ivory/20 rounded-none focus:outline-none focus:border-gold-primary/50 flex-1"
                    />
                    <button
                      type="submit"
                      disabled={searchLoading}
                      className="bg-gold-primary hover:bg-gold-dark disabled:bg-gold-primary/40 text-luxury-black text-[10px] font-semibold px-4 uppercase tracking-wider rounded-none cursor-pointer flex items-center"
                    >
                      {searchLoading ? <Loader2 size={12} className="animate-spin mr-1" /> : <Search size={12} className="mr-1" />}
                      Search
                    </button>
                  </form>

                  {searchResults.length > 0 && (
                    <div className="border border-white/10 bg-neutral-950 divide-y divide-white/5 max-h-[180px] overflow-y-auto">
                      {searchResults.map((cust) => (
                        <div 
                          key={cust.id} 
                          onClick={() => { setSelectedCustomer(cust); setSearchResults([]); }}
                          className="p-3 text-xs hover:bg-white/[0.02] cursor-pointer flex justify-between items-center transition-colors"
                        >
                          <div>
                            <span className="text-white font-medium block">{cust.name}</span>
                            <span className="text-[10px] text-ivory/50">{cust.phone}</span>
                          </div>
                          <span className="metric-value text-[10px] text-gold-primary font-semibold">{cust.points} Points</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Create */}
                <div className="space-y-4 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6">
                  <span className="text-[10px] uppercase tracking-wider text-gold-primary block font-semibold">Register New Customer</span>
                  <form onSubmit={handleCreateCustomer} className="space-y-3">
                    <input
                      type="text"
                      placeholder="Full Name (Required)"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      className="w-full bg-luxury-black border border-white/10 px-3 py-2 text-xs text-white placeholder-ivory/20 rounded-none focus:outline-none focus:border-gold-primary/50"
                      required
                    />
                    <input
                      type="tel"
                      placeholder="Phone Number (Required)"
                      value={createPhone}
                      onChange={(e) => setCreatePhone(e.target.value)}
                      className="w-full bg-luxury-black border border-white/10 px-3 py-2 text-xs text-white placeholder-ivory/20 rounded-none focus:outline-none focus:border-gold-primary/50"
                      required
                    />
                    <input
                      type="email"
                      placeholder="Email Address (Optional)"
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      className="w-full bg-luxury-black border border-white/10 px-3 py-2 text-xs text-white placeholder-ivory/20 rounded-none focus:outline-none focus:border-gold-primary/50"
                    />
                    {createError && <p className="text-[10px] text-red-400 font-light">{createError}</p>}
                    {createSuccess && <p className="text-[10px] text-green-400 font-light">{createSuccess}</p>}
                    <button
                      type="submit"
                      disabled={createLoading}
                      className="w-full text-center text-[10px] uppercase tracking-wider bg-white/10 hover:bg-white/20 text-white font-semibold py-2 transition-colors cursor-pointer border border-white/10"
                    >
                      {createLoading ? <Loader2 size={12} className="animate-spin mr-2 inline" /> : <Plus size={12} className="mr-1 inline" />}
                      Register Profile
                    </button>
                  </form>
                </div>
              </div>

              {selectedCustomer && (
                <div className="mt-6 bg-gold-primary/[0.02] border border-gold-primary/20 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gold-primary/10 rounded-full text-gold-primary">
                      <User size={16} />
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-gold-primary font-semibold">Active Client Selected</span>
                      <h3 className="font-playfair text-base text-white font-medium mt-0.5">{selectedCustomer.name}</h3>
                      <div className="flex flex-wrap gap-x-4 text-[10px] text-ivory/50 mt-1">
                        <span className="flex items-center"><Phone size={10} className="mr-1 text-gold-primary/70" /> {selectedCustomer.phone}</span>
                        {selectedCustomer.email && <span className="flex items-center"><Mail size={10} className="mr-1 text-gold-primary/70" /> {selectedCustomer.email}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right bg-luxury-black px-4 py-2 border border-white/5 self-stretch sm:self-auto flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
                    <span className="text-[9px] uppercase tracking-wider text-gold-primary/75">Points Balance</span>
                    <span className="metric-value text-lg text-white font-semibold tracking-wide sm:mt-0.5">{selectedCustomer.points} Pts</span>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Select Items */}
            <div className="border border-white/5 bg-white/[0.01] p-6 relative">
              <h2 className="font-playfair text-base text-white font-medium tracking-wide mb-4 flex items-center border-b border-white/5 pb-3">
                <span className="w-5 h-5 rounded-full bg-gold-primary/20 text-gold-primary text-[10px] flex items-center justify-center font-bold mr-2">2</span>
                <span>Select Services & Products</span>
              </h2>

              <div className="flex border border-white/10 mb-3">
                {["All", "Service", "Retail"].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setCategoryFilter(tab as "All" | "Service" | "Retail");
                    }}
                    className={`flex-1 py-2 text-center text-xs uppercase tracking-wider font-semibold cursor-pointer transition-colors ${
                      categoryFilter === tab ? "bg-gold-primary text-luxury-black" : "bg-transparent text-ivory/60 hover:text-ivory"
                    }`}
                  >
                    {tab === "All" ? "All Items" : tab === "Service" ? "Services" : "Retail Products"}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type name or code to filter catalog instantly..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="w-full bg-neutral-900 border border-white/10 px-3.5 py-3 text-xs md:text-sm text-white rounded-none focus:outline-none placeholder-white/30"
                  />
                  {catalogSearch && (
                    <button
                      type="button"
                      onClick={() => setCatalogSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gold-primary hover:underline cursor-pointer font-medium"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Inline Instant Search & Catalog List */}
                <div className="w-full bg-neutral-900 border border-white/10 max-h-[300px] overflow-y-auto divide-y divide-white/5">
                  {(() => {
                    const searchLower = catalogSearch.toLowerCase();
                    const filtered = catalog.filter((item) => {
                      const matchesSearch = item.name.toLowerCase().includes(searchLower) || 
                                            (item.item_code && item.item_code.toLowerCase().includes(searchLower)) ||
                                            (item.hsn && item.hsn.toLowerCase().includes(searchLower));
                      const matchesCategory = categoryFilter === "All" || item.category === categoryFilter;
                      return matchesSearch && matchesCategory;
                    });

                    if (filtered.length === 0) {
                      return <div className="p-4 text-xs md:text-sm text-ivory/40 text-center">No matching items found.</div>;
                    }

                    return filtered.map((item) => (
                      <div key={item.id} className="p-3 flex items-center justify-between hover:bg-white/[0.01] transition-colors gap-3">
                        <div className="flex-1 min-w-0">
                          <span className="block text-xs md:text-sm font-semibold text-white truncate">{item.name}</span>
                          <span className="text-[10px] uppercase tracking-wider text-gold-primary/95 mt-0.5 block">
                            {item.category} {item.item_code ? `• Code: ${item.item_code}` : ""} {item.hsn ? `• HSN: ${item.hsn}` : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="currency-value text-xs md:text-sm text-white font-medium">₹{(Number(item.price) * (1 + getTaxInfo(item).gstDecimal)).toFixed(2)} <span className="text-[9px] text-ivory/50 font-normal normal-case">(GST Included)</span></span>
                          <button
                            type="button"
                            onClick={() => {
                              const existing = cart.find((c) => c.item.id === item.id);
                              if (existing) {
                                setCart(cart.map((c) => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
                              } else {
                                setCart([...cart, { item, quantity: 1 }]);
                              }
                            }}
                            className="bg-gold-primary hover:bg-gold-dark text-luxury-black text-xs uppercase font-bold px-3 py-1.5 transition-colors cursor-pointer"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>

            {/* Cart Table Display */}
            <div className="border border-white/5 bg-white/[0.01] p-6 relative">
              <h2 className="font-playfair text-base text-white font-medium tracking-wide mb-4 flex items-center border-b border-white/5 pb-3">
                <span className="w-5 h-5 rounded-full bg-gold-primary/20 text-gold-primary text-[10px] flex items-center justify-center font-bold mr-2">3</span>
                <span>Itemized Invoice Cart</span>
              </h2>

              {cart.length === 0 ? (
                <p className="text-xs text-ivory/40 font-light py-8 text-center">Your invoice card is empty. Add services or products above.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] font-light">
                    <thead>
                      <tr className="border-b border-white/10 uppercase tracking-wider text-gold-primary text-[9px]">
                        <th className="pb-3">Item Name</th>
                        <th className="pb-3 pr-8">Item Code</th>
                        <th className="pb-3">Category</th>
                        <th className="pb-3 pr-8">HSN</th>
                        <th className="pb-3 pr-4">Staff/Stylist</th>
                        <th className="pb-3">Qty</th>
                        <th className="pb-3">Unit Price</th>
                        <th className="pb-3">Tax Rate</th>
                        <th className="pb-3">Line Total</th>
                        <th className="pb-3 text-right">Remove</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((cartItem) => {
                        const { item, quantity } = cartItem;
                        const lineTotal = item.price * (1 + getTaxInfo(item).gstDecimal) * quantity;
                        return (
                          <tr key={item.id} className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                            <td className="py-3 font-medium text-white">{item.name}</td>
                            <td className="py-3 text-ivory/70 pr-8">{item.item_code || "-"}</td>
                            <td className="py-3 text-ivory/60 text-[10px]">
                              {item.category === "Service" ? (
                                <span className="flex items-center text-sky-400"><Scissors size={10} className="mr-1" /> Service</span>
                              ) : (
                                <span className="flex items-center text-amber-400"><ShoppingBag size={10} className="mr-1" /> Retail</span>
                              )}
                            </td>
                            <td className="py-3 text-ivory/70 pr-8">{getTaxInfo(item).hsn}</td>
                            <td className="py-3 pr-4">
                              <input
                                type="text"
                                value={cartItem.staffContribution || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCart(cart.map((c) => c.item.id === item.id ? { ...c, staffContribution: val } : c));
                                }}
                                placeholder="Stylist/Staff"
                                maxLength={100}
                                className="bg-luxury-black border border-white/10 px-2 py-1 text-[11px] text-white w-28 rounded-none focus:outline-none focus:border-gold-primary/50 transition-colors"
                              />
                            </td>
                            <td className="metric-value py-3 font-medium">{quantity}</td>
                            <td className="currency-value py-3">₹{(Number(item.price) * (1 + getTaxInfo(item).gstDecimal)).toFixed(2)}</td>
                            <td className="metric-value py-3">
                              {getTaxInfo(item).gstLabel}
                              <span className="block text-[9px] text-ivory/45">
                                ({parseFloat(getTaxInfo(item).gstLabel) / 2}% CGST + {parseFloat(getTaxInfo(item).gstLabel) / 2}% SGST)
                              </span>
                            </td>
                            <td className="currency-value py-3 text-white font-medium">₹{(lineTotal).toFixed(2)}</td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="p-1 text-ivory/40 hover:text-red-400 transition-colors cursor-pointer"
                                title="Remove"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Step 4 & Checkout Calculations */}
          <div className="space-y-8">
            
            <div className="border border-gold-primary/20 bg-gold-primary/[0.01] p-6 relative">
              {/* Corners */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-gold-primary/30" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-gold-primary/30" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-gold-primary/30" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-gold-primary/30" />

              <h2 className="font-playfair text-base text-white font-medium tracking-wide mb-6 flex items-center border-b border-white/5 pb-3">
                <span className="w-5 h-5 rounded-full bg-gold-primary/20 text-gold-primary text-[10px] flex items-center justify-center font-bold mr-2">4</span>
                <span>Calculations & Checkout</span>
              </h2>

              {/* Loyalty discount selection */}
              {selectedCustomer && selectedCustomer.points > 0 ? (
                <div className="mb-6 bg-gold-primary/5 border border-gold-primary/20 p-4">
                  <span className="text-[9px] uppercase tracking-wider text-gold-primary font-semibold flex items-center">
                    <Award size={12} className="mr-1" /> Points Redemption (1 Pt = ₹1)
                  </span>
                  <p className="text-[10px] text-ivory/50 mt-1">Maximum available: {selectedCustomer.points} Points</p>
                  
                  <div className="mt-3 flex gap-2">
                    <input
                      type="number"
                      placeholder="Redeem quantity..."
                      value={pointsToRedeem}
                      onChange={(e) => handlePointsChange(e.target.value)}
                      className="bg-luxury-black border border-white/10 px-3 py-2 text-xs text-white placeholder-ivory/20 rounded-none focus:outline-none focus:border-gold-primary/50 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => handlePointsChange(Math.min(selectedCustomer.points, Math.floor(preDiscountTotal)).toString())}
                      className="bg-white/10 border border-white/10 hover:bg-white/20 text-white text-[9px] font-semibold px-3 uppercase tracking-wider rounded-none cursor-pointer"
                    >
                      Max
                    </button>
                  </div>
                  {redeemError && <p className="text-[10px] text-red-400 font-light mt-1.5">{redeemError}</p>}
                </div>
              ) : selectedCustomer ? (
                <div className="mb-6 text-[10px] text-ivory/40 font-light p-3 border border-white/5 bg-white/[0.01] text-center">
                  Customer has 0 points available for redemption.
                </div>
              ) : (
                <div className="mb-6 text-[10px] text-ivory/40 font-light p-3 border border-dashed border-white/10 text-center">
                  Select a customer to enable loyalty point redemption.
                </div>
              )}

              {/* Manual Discount */}
              <div className="mb-6 bg-white/[0.02] border border-white/10 p-4">
                <span className="text-[9px] uppercase tracking-wider text-white font-semibold flex items-center justify-between">
                  <span>Manual Discount (₹)</span>
                  {parseFloat(manualDiscount) > 0 && (
                    <button 
                      onClick={() => handleManualDiscountChange("0")}
                      className="text-red-400 hover:text-red-300 text-[8px] uppercase font-bold px-2 py-1 border border-red-900/30 bg-red-950/20 transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </span>
                
                <div className="mt-3">
                  <input
                    type="number"
                    placeholder="Discount amount..."
                    value={manualDiscount}
                    onChange={(e) => handleManualDiscountChange(e.target.value)}
                    className="bg-luxury-black border border-white/10 px-3 py-2 text-xs text-white placeholder-ivory/20 rounded-none focus:outline-none focus:border-white/50 w-full"
                    min="0"
                    step="0.01"
                  />
                </div>
                {discountError && <p className="text-[10px] text-red-400 font-light mt-1.5">{discountError}</p>}
              </div>

              {/* Financial Breakdowns */}
              <div className="space-y-3.5 text-xs font-light border-b border-white/5 pb-5">
                <div className="flex justify-between text-zinc-400">
                  <span>Services Subtotal (Inc. GST)</span>
                  <span className="currency-value font-medium">₹{calcTotals.service_inclusive.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Retail Subtotal (Inc. GST)</span>
                  <span className="currency-value font-medium">₹{calcTotals.retail_inclusive.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pl-3 text-[11px] text-ivory/40 border-l border-white/5">
                  <span className="font-semibold text-ivory/70">Services Base Price (Before GST):</span>
                  <span className="currency-value font-semibold text-ivory/70">₹{calcTotals.service_base.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pl-3 text-[11px] text-ivory/40 border-l border-white/5">
                  <span className="font-semibold text-ivory/70">Retail Base Price (Before GST):</span>
                  <span className="currency-value font-semibold text-ivory/70">₹{calcTotals.retail_base.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-3">
                  <span className="text-ivory/50">Combined GST Included:</span>
                  <span className="currency-value font-medium">₹{calcTotals.total_tax.toFixed(2)}</span>
                </div>

                {manualDiscountNum > 0 && (
                  <div className="flex justify-between text-white border-t border-white/5 pt-3">
                    <span>Discount:</span>
                    <span className="currency-value font-semibold">-₹{manualDiscountNum.toFixed(2)}</span>
                  </div>
                )}

                {calcTotals.points_redeemed > 0 && (
                  <div className="flex justify-between text-red-400 border-t border-white/5 pt-3">
                    <span>Loyalty Points Redeemed:</span>
                    <span className="currency-value font-semibold">-₹{calcTotals.points_redeemed.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between border-t border-gold-primary/20 pt-3 font-playfair text-lg text-white">
                          <span className="text-gold-primary font-semibold">GRAND TOTAL:</span>
                  <span className="currency-value font-semibold">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Invoice Date (Backdated billing support) */}
              <div className="mb-6 border-t border-white/5 pt-4">
                <label htmlFor="invoice-date-input" className="block text-[10px] uppercase tracking-wider text-ivory/60 mb-2">Invoice Date</label>
                <input
                  id="invoice-date-input"
                  type="date"
                  max={new Date().toLocaleDateString("sv-SE")}
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full bg-luxury-black border border-white/10 px-3 py-2.5 text-xs text-white rounded-none focus:outline-none focus:border-gold-primary/50"
                  required
                />
              </div>

              {/* Payment Method Selector */}
              <div className="mb-6 border-t border-white/5 pt-4">
                <label className="block text-[10px] uppercase tracking-wider text-ivory/60 mb-3">Payment Method</label>
                <div className="flex gap-3">
                  {["Cash", "UPI", "Card"].map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`flex-1 py-2.5 text-xs tracking-widest font-medium transition-colors border ${
                        paymentMethod === method
                          ? "border-gold-primary text-gold-primary bg-gold-primary/5"
                          : "border-white/10 text-ivory/50 hover:bg-white/5"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Loyalty Reward preview */}
              <div className="py-4 text-[10px] font-light text-ivory/50 flex justify-between items-center">
                <span>Loyalty Points to Earn:</span>
                <span className="metric-value text-green-400 font-semibold flex items-center">
                  <Award size={10} className="mr-1" /> +{pointsEarned} Points
                </span>
              </div>

              {/* Error messages */}
              {checkoutError && (
                <div className="mb-4 text-[10px] text-red-400 font-light flex items-center bg-red-950/20 border border-red-900/30 p-2.5">
                  <AlertCircle size={12} className="mr-1.5 shrink-0" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {/* Trigger Check out */}
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading || cart.length === 0 || !selectedCustomer || !!redeemError}
                className="w-full text-center text-xs uppercase tracking-[0.2em] bg-gold-primary hover:bg-gold-dark disabled:bg-gold-primary/40 disabled:cursor-not-allowed text-luxury-black font-semibold py-3.5 transition-colors flex items-center justify-center cursor-pointer"
              >
                {checkoutLoading ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
                <span>{checkoutLoading ? "Processing Payment..." : "Process Payment & Generate Invoice"}</span>
              </button>
            </div>

            {/* Menu catalog manager link */}
            <div className="border border-white/5 bg-white/[0.01] p-4 text-center">
              <span className="text-[10px] text-ivory/50 block mb-2 font-light">Need to modify catalog items or product pricing?</span>
              <Link
                href="/staff/billing/services"
                className="inline-block text-[10px] uppercase tracking-wider border border-white/10 hover:border-gold-primary/40 hover:text-gold-primary px-4 py-2 bg-white/5 transition-colors font-medium"
              >
                Manage Services & Products
              </Link>
            </div>

          </div>

        </div>

      </div>
    </main>
  );
}
