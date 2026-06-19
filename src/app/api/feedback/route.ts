import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, mobile, branch, rating, message } = body as {
      name: string;
      mobile: string;
      branch: string;
      rating: number;
      message: string;
    };

    // Validate required fields
    if (!name || !mobile || !branch || !rating || !message) {
      return NextResponse.json(
        { success: false, error: "All fields are required." },
        { status: 400 }
      );
    }

    const feedbackEmail = process.env.FEEDBACK_EMAIL;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!feedbackEmail || !resendApiKey) {
      console.error("Missing FEEDBACK_EMAIL or RESEND_API_KEY environment variables.");
      return NextResponse.json(
        { success: false, error: "Email service not configured." },
        { status: 500 }
      );
    }

    const resend = new Resend(resendApiKey);
    const stars = "★".repeat(rating) + "☆".repeat(5 - rating);

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
        <div class="field-value">${name}</div>
      </div>
      <div class="field">
        <div class="field-label">Mobile Number</div>
        <div class="field-value">${mobile}</div>
      </div>
      <div class="field">
        <div class="field-label">Branch Visited</div>
        <div class="field-value">${branch}</div>
      </div>
      <div class="field">
        <div class="field-label">Rating</div>
        <div class="field-value rating">${stars} (${rating}/5)</div>
      </div>
      <div class="field" style="border-bottom:none;padding-bottom:0;">
        <div class="field-label">Feedback</div>
        <div class="message-box field-value">${message.replace(/\n/g, "<br/>")}</div>
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
      subject: `⭐ ${rating}/5 Feedback from ${name} — ${branch} Branch`,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to send feedback." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Feedback email error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to send feedback." },
      { status: 500 }
    );
  }
}
