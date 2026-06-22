import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabase";

// HTML sanitizer to prevent XSS / HTML Injection
function sanitize(input: string): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

// Format date from YYYY-MM-DD to readable "23 June 2026"
function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return dateStr;
  }
}

// Format time from HH:MM to 12-hour "2:30 PM"
function formatTime(timeStr: string): string {
  try {
    const [h, m] = timeStr.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
  } catch {
    return timeStr;
  }
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // 1. Content-Type check
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ success: false, error: "Invalid content type." }, { status: 400 });
    }

    // 2. Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON format." }, { status: 400 });
    }

    const { name, phone, email, branch, service, serviceId, date, time, message } = body || {};

    // 3. Validate required fields
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, error: "Missing name." }, { status: 400 });
    }
    
    let safeEmail = "";
    if (email && typeof email === "string" && email.trim()) {
      const emailRegex = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
      if (!emailRegex.test(email.trim()) || email.length > 254) {
        return NextResponse.json({ success: false, error: "Invalid email address." }, { status: 400 });
      }
      safeEmail = sanitize(email.trim());
    }

    const allowedBranches = ["Kaduthuruthy", "Ettumanoor", "Peruva"];
    if (typeof branch !== "string" || !allowedBranches.includes(branch)) {
      return NextResponse.json({ success: false, error: "Invalid branch." }, { status: 400 });
    }

    // 4. Sanitize inputs
    const safeName    = sanitize(String(name).trim());
    const safePhone   = sanitize(String(phone || "").trim());
    const safeBranch  = sanitize(branch);
    const safeService = sanitize(String(service || "").trim());
    const safeDate    = sanitize(String(date || "").trim());
    const safeTime    = sanitize(String(time || "").trim());
    const safeMessage = sanitize(String(message || "").trim());
    
    // Save to Database
    const supabase = getSupabaseAdmin();
    const { error: dbError } = await supabase.from("appointments").insert([
      {
        customer_name: safeName,
        customer_phone: safePhone,
        branch: safeBranch,
        service_id: serviceId || null,
        appointment_date: safeDate,
        appointment_time: safeTime,
        status: "scheduled",
        notes: safeMessage || null,
      }
    ]);
    
    if (dbError) {
      console.error("Failed to save appointment to DB:", dbError);
      // We don't block the user, but we log the error
    }

    const displayDate = safeDate ? formatDate(safeDate) : "—";
    const displayTime = safeTime ? formatTime(safeTime) : "—";

    // Branch-specific WhatsApp number for the CTA
    const branchPhones: { [key: string]: string } = {
      Kaduthuruthy: "919562514002",
      Ettumanoor:   "919746914003",
      Peruva:       "919544814003",
    };
    const whatsappNumber = branchPhones[branch] || "919562514002";

    // 6. Build the branded HTML confirmation email
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Appointment Confirmation — Macbello Family Salon</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; background: #050505; color: #F5F5F0; margin: 0; padding: 24px 0; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #0B0B0B; border: 1px solid rgba(212,175,55,0.2); }

    /* Header */
    .header { background: linear-gradient(160deg, #0d0900 0%, #1a1200 50%, #0d0900 100%); padding: 40px; text-align: center; border-bottom: 1px solid rgba(212,175,55,0.2); }
    .logo-line { width: 40px; height: 1px; background: rgba(212,175,55,0.5); display: inline-block; vertical-align: middle; margin: 0 12px; }
    .salon-name { font-size: 20px; color: #D4AF37; letter-spacing: 0.3em; text-transform: uppercase; margin: 0 0 8px; }
    .tagline { font-size: 10px; color: rgba(245,245,240,0.4); letter-spacing: 0.2em; text-transform: uppercase; margin: 0; }

    /* Confirmation banner */
    .confirm-banner { background: rgba(212,175,55,0.06); border-top: 2px solid #D4AF37; border-bottom: 1px solid rgba(212,175,55,0.1); padding: 28px 40px; text-align: center; }
    .confirm-icon { font-size: 36px; margin-bottom: 10px; }
    .confirm-title { font-size: 22px; color: #fff; font-weight: 300; letter-spacing: 0.08em; margin: 0 0 6px; }
    .confirm-sub { font-size: 12px; color: rgba(245,245,240,0.5); letter-spacing: 0.12em; text-transform: uppercase; margin: 0; }

    /* Body */
    .body { padding: 36px 40px; }
    .greeting { font-size: 15px; color: rgba(245,245,240,0.8); line-height: 1.8; margin: 0 0 28px; }

    /* Summary card */
    .summary-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 24px; margin-bottom: 28px; }
    .summary-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.25em; color: #D4AF37; margin: 0 0 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(212,175,55,0.15); }
    .summary-row { display: flex; padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .summary-row:last-child { border-bottom: none; }
    .summary-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; color: rgba(212,175,55,0.7); width: 100px; flex-shrink: 0; padding-top: 2px; }
    .summary-value { font-size: 14px; color: #F5F5F0; font-weight: 300; flex: 1; }

    /* Note */
    .note { font-size: 12px; color: rgba(245,245,240,0.4); line-height: 1.8; background: rgba(255,255,255,0.015); border-left: 2px solid rgba(212,175,55,0.3); padding: 14px 16px; margin-bottom: 28px; }

    /* CTA */
    .cta-wrapper { text-align: center; margin-bottom: 8px; }
    .cta { display: inline-block; padding: 14px 36px; background: #D4AF37; color: #050505 !important; text-decoration: none; font-size: 10px; font-weight: 700; letter-spacing: 0.25em; text-transform: uppercase; }

    /* Divider */
    .divider { height: 1px; background: linear-gradient(to right, transparent, rgba(212,175,55,0.3), transparent); margin: 28px 0; }

    /* Footer */
    .footer { padding: 24px 40px; border-top: 1px solid rgba(212,175,55,0.1); text-align: center; }
    .footer p { font-size: 10px; color: rgba(245,245,240,0.2); letter-spacing: 0.15em; text-transform: uppercase; margin: 4px 0; }

    @media (max-width: 480px) {
      .header, .confirm-banner, .body, .footer { padding-left: 20px; padding-right: 20px; }
      .summary-label { width: 80px; font-size: 9px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <!-- Header -->
    <div class="header">
      <p class="salon-name">
        <span class="logo-line"></span>Macbello<span class="logo-line"></span>
      </p>
      <p class="tagline">Family Salon &nbsp;&bull;&nbsp; Where Style Meets Perfection</p>
    </div>

    <!-- Confirmation Banner -->
    <div class="confirm-banner">
      <div class="confirm-icon">✦</div>
      <h1 class="confirm-title">Appointment Request Received</h1>
      <p class="confirm-sub">Our team will confirm your slot shortly</p>
    </div>

    <!-- Body -->
    <div class="body">
      <p class="greeting">
        Dear ${safeName},<br /><br />
        Thank you for choosing <strong style="color:#D4AF37">Macbello Family Salon</strong>. 
        We have received your appointment request and our front desk team at the <strong style="color:#D4AF37">${safeBranch}</strong> branch 
        will reach out to you on WhatsApp to confirm your booking.
      </p>

      <!-- Booking Summary -->
      <div class="summary-card">
        <p class="summary-title">Your Booking Details</p>
        <div class="summary-row">
          <span class="summary-label">Service</span>
          <span class="summary-value">${safeService || "—"}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Branch</span>
          <span class="summary-value">${safeBranch}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Date</span>
          <span class="summary-value">${displayDate}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Time</span>
          <span class="summary-value">${displayTime}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Phone</span>
          <span class="summary-value">${safePhone || "—"}</span>
        </div>
        ${safeMessage ? `
        <div class="summary-row">
          <span class="summary-label">Note</span>
          <span class="summary-value" style="font-size:13px;color:rgba(245,245,240,0.6);">${safeMessage.replace(/\n/g, "<br/>")}</span>
        </div>` : ""}
      </div>

      <div class="note">
        This is a <strong>preliminary confirmation</strong>. Your appointment slot will be formally confirmed when our team contacts you via WhatsApp. 
        If you need to reschedule or cancel, please reach out to us at least 2 hours before your appointment.
      </div>

      <div class="divider"></div>

      <!-- CTA -->
      <div class="cta-wrapper">
        <a class="cta" href="https://wa.me/${whatsappNumber}">Message Us on WhatsApp</a>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>Macbello Family Salon</p>
      <p>Kaduthuruthy &nbsp;&bull;&nbsp; Ettumanoor &nbsp;&bull;&nbsp; Peruva</p>
      <p style="margin-top:10px;">&copy; ${new Date().getFullYear()} All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    // 5. Send confirmation email to customer if email is provided
    if (safeEmail) {
      const resendApiKey = process.env.RESEND_API_KEY;
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        resend.emails.send({
          from: "Macbello Family Salon <onboarding@resend.dev>",
          to: [safeEmail],
          subject: `Appointment Confirmation — ${safeService || "Your Booking"} at Macbello ${safeBranch}`,
          html,
        }).catch((err) => console.error("Resend API failed for booking confirmation:", err));
      }
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("Unhandled error in booking confirmation route:", err);
    return NextResponse.json({ success: false, error: "Failed to process request." }, { status: 500 });
  }
}
