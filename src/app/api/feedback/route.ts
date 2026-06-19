import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

// In-memory rate limiting store (sliding window)
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const limit = 5; // 5 requests

  const timestamps = rateLimitMap.get(ip) || [];
  // Filter out timestamps outside the 15-minute window
  const activeTimestamps = timestamps.filter((time) => now - time < windowMs);

  if (activeTimestamps.length >= limit) {
    return true; // Rate limited
  }

  activeTimestamps.push(now);
  rateLimitMap.set(ip, activeTimestamps);
  return false;
}

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

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Content-Type header
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { success: false, error: "Invalid content type." },
        { status: 400 }
      );
    }

    // 2. Enforce Payload Size Limit (Max 50KB)
    const contentLengthHeader = request.headers.get("content-length");
    if (contentLengthHeader) {
      const contentLength = parseInt(contentLengthHeader, 10);
      if (isNaN(contentLength) || contentLength > 50 * 1024) {
        return NextResponse.json(
          { success: false, error: "Request payload too large." },
          { status: 413 }
        );
      }
    }

    // 3. In-Memory Rate Limiting
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    if (checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: "Too many feedback submissions. Please try again after 15 minutes." },
        { status: 429 }
      );
    }

    // 4. Parse JSON with exception handling
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON format." },
        { status: 400 }
      );
    }

    const { name, mobile, branch, rating, message } = body || {};

    // 5. Input Validation
    if (typeof name !== "string" || name.trim() === "" || name.length > 100) {
      return NextResponse.json(
        { success: false, error: "Invalid name format." },
        { status: 400 }
      );
    }

    // Mobile Validation: Require 10-15 digits (allowing optional leading plus, spaces or dashes for UX)
    const mobileRegex = /^\+?[0-9\s\-()]{10,15}$/;
    if (typeof mobile !== "string" || !mobileRegex.test(mobile)) {
      return NextResponse.json(
        { success: false, error: "Invalid mobile number format." },
        { status: 400 }
      );
    }

    // Branch Validation: Strict list
    const allowedBranches = ["Kaduthuruthy", "Ettumanoor", "Peruva"];
    if (typeof branch !== "string" || !allowedBranches.includes(branch)) {
      return NextResponse.json(
        { success: false, error: "Invalid branch selected." },
        { status: 400 }
      );
    }

    // Rating Validation: Strict integer between 1 and 5
    const parsedRating = Number(rating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return NextResponse.json(
        { success: false, error: "Invalid rating value." },
        { status: 400 }
      );
    }

    // Message Validation: Maximum 1000 characters
    if (typeof message !== "string" || message.trim() === "" || message.length > 1000) {
      return NextResponse.json(
        { success: false, error: "Invalid message format." },
        { status: 400 }
      );
    }

    // 6. Sanitization of input values
    const safeName = sanitize(name.trim());
    const safeMobile = sanitize(mobile.trim());
    const safeBranch = sanitize(branch.trim());
    const safeMessage = sanitize(message.trim());

    // 7. Verify Server-Side Secrets
    const feedbackEmail = process.env.FEEDBACK_EMAIL;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!feedbackEmail || !resendApiKey) {
      // Log details only on server side to safeguard config
      console.error("API Error: Configuration variables missing.");
      return NextResponse.json(
        { success: false, error: "Feedback submission failed." },
        { status: 500 }
      );
    }

    const resend = new Resend(resendApiKey);
    const stars = "★".repeat(parsedRating) + "☆".repeat(5 - parsedRating);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Georgia, serif; background: #050505; color: #F5F5F0; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #0B0B0B; border: 1px solid #D4AF3730; }
    .header { background: linear-gradient(135deg, #050505, #1a1400); padding: 32px 40px; border-bottom: 1px solid #D4AF3730; }
    .header h1 { font-size: 22px; color: #D4AF37; margin: 0; letter-spacing: 0.2em; text-transform: uppercase; }
    .header p { font-size: 11px; color: #F5F5F080; margin: 4px 0 0; letter-spacing: 0.15em; text-transform: uppercase; }
    .body { padding: 32px 40px; }
    .field { margin-bottom: 20px; border-bottom: 1px solid #ffffff0a; padding-bottom: 16px; }
    .field-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; color: #D4AF37; margin-bottom: 4px; }
    .field-value { font-size: 15px; color: #F5F5F0; line-height: 1.6; }
    .rating { color: #D4AF37; font-size: 20px; letter-spacing: 2px; }
    .message-box { background: #ffffff05; border: 1px solid #ffffff0d; padding: 16px; border-radius: 2px; }
    .footer { padding: 20px 40px; border-top: 1px solid #D4AF3720; text-align: center; }
    .footer p { font-size: 10px; color: #F5F5F030; letter-spacing: 0.15em; text-transform: uppercase; margin: 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Macbello Family Salon</h1>
      <p>New Customer Feedback Received</p>
    </div>
    <div class="body">
      <div class="field">
        <div class="field-label">Customer Name</div>
        <div class="field-value">${safeName}</div>
      </div>
      <div class="field">
        <div class="field-label">Mobile Number</div>
        <div class="field-value">${safeMobile}</div>
      </div>
      <div class="field">
        <div class="field-label">Branch Visited</div>
        <div class="field-value">${safeBranch}</div>
      </div>
      <div class="field">
        <div class="field-label">Rating</div>
        <div class="field-value rating">${stars} (${parsedRating}/5)</div>
      </div>
      <div class="field" style="border-bottom:none;padding-bottom:0;">
        <div class="field-label">Feedback</div>
        <div class="message-box field-value">${safeMessage.replace(/\n/g, "<br/>")}</div>
      </div>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Macbello Family Salon &nbsp;&bull;&nbsp; Where Style Meets Perfection</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const { error } = await resend.emails.send({
      from: "Macbello Feedback <onboarding@resend.dev>",
      to: [feedbackEmail],
      subject: `⭐ ${parsedRating}/5 Feedback from ${safeName} — ${safeBranch} Branch`,
      html,
    });

    if (error) {
      console.error("Resend API failed:", error);
      return NextResponse.json(
        { success: false, error: "Feedback submission failed." },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    // Catch-all with generic responses to ensure client doesn't receive stack traces
    console.error("Unhandled feedback routing error:", err);
    return NextResponse.json(
      { success: false, error: "Feedback submission failed." },
      { status: 500 }
    );
  }
}
