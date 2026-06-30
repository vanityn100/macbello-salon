import { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";

export const metadata: Metadata = {
  title: "Privacy Policy | Macbello Family Salon",
  description: "Read the Privacy Policy for Macbello Family Salon. Understand how we collect, use, and protect your personal data.",
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "June 23, 2026";

  return (
    <>
      <FloatingActions />
      <Navbar />
      <main className="flex flex-col min-h-screen pt-24 bg-luxury-black text-ivory/80">
        <section className="relative py-12 md:py-16 overflow-hidden border-b border-gold-primary/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.03),transparent_70%)] pointer-events-none" />
          <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
            <span className="text-[10px] md:text-xs uppercase tracking-[0.25em] text-gold-primary mb-3 font-medium block">
              Legal
            </span>
            <h1 className="font-playfair text-4xl md:text-5xl text-white font-light tracking-wide mb-4">
              Privacy Policy
            </h1>
            <p className="text-sm md:text-base text-ivory/60">
              Last Updated: {lastUpdated}
            </p>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-6 py-12 md:py-20 space-y-12 font-light leading-relaxed">
          
          <div className="space-y-4">
            <h2 className="font-playfair text-2xl text-gold-primary">1. Information We Collect</h2>
            <p>
              When you book an appointment, submit a feedback form, or interact with Macbello Family Salon, we may collect the following personal information:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-ivory/70">
              <li><strong>Contact Details:</strong> Your full name, phone number, and email address.</li>
              <li><strong>Appointment Data:</strong> Preferred branch, service requests, appointment dates, and related notes.</li>
              <li><strong>Billing Information:</strong> Invoice details and transaction history related to your services (we do not store raw credit card details).</li>
              <li><strong>Feedback:</strong> Any reviews, messages, or ratings you submit to us.</li>
              <li><strong>Usage Data:</strong> Basic website analytics, cookies, and tracking information to improve our digital experience.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="font-playfair text-2xl text-gold-primary">2. Purpose of Data Collection</h2>
            <p>
              We strictly use your information to provide a premium salon experience. This includes:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-ivory/70">
              <li><strong>Appointment Management:</strong> To schedule, confirm, or modify your bookings.</li>
              <li><strong>Customer Communication:</strong> To send reminders, updates, or reply to your inquiries.</li>
              <li><strong>Invoicing:</strong> To generate accurate GST bills and manage your transactions securely.</li>
              <li><strong>Feedback & Improvement:</strong> To address your concerns and improve our service quality.</li>
              <li><strong>Loyalty Programs:</strong> To track and manage your earned loyalty points.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="font-playfair text-2xl text-gold-primary">3. Data Security Measures</h2>
            <p>
              Macbello Salon implements robust technical and organizational security measures to safeguard your personal data. We use encrypted databases, secure authentication mechanisms, and strict role-based access control to ensure that only authorized personnel can access your information. Your data is never sold to third parties.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="font-playfair text-2xl text-gold-primary">4. Data Retention Policy</h2>
            <p>
              We retain your personal data and invoice history only as long as necessary to fulfill the purposes outlined in this policy, and to comply with legal, accounting, and tax regulations in India. Accounts that have been inactive for an extended period may have non-essential data safely archived.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="font-playfair text-2xl text-gold-primary">5. Customer Rights</h2>
            <p>
              You have the right to request access to the personal data we hold about you. You may also request corrections to inaccurate data or request the deletion of your account (subject to legal and tax retention requirements). To exercise these rights, please contact our support team.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="font-playfair text-2xl text-gold-primary">6. Third-Party Services</h2>
            <p>
              We may utilize trusted third-party providers for essential business functions:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-ivory/70">
              <li><strong>WhatsApp API:</strong> For sending booking confirmations and reminders.</li>
              <li><strong>Email Service Providers:</strong> For sending invoices, reports, and official communications.</li>
              <li><strong>Cloud Hosting:</strong> For securely storing our application and database.</li>
            </ul>
            <p>These services operate under strict confidentiality agreements and use your data only as instructed by Macbello Salon.</p>
          </div>

          <div className="space-y-4">
            <h2 className="font-playfair text-2xl text-gold-primary">7. Contact Information</h2>
            <p>
              If you have any questions or concerns regarding this Privacy Policy or how your data is handled, please reach out to us at:
            </p>
            <div className="bg-white/5 p-6 rounded-xl border border-white/10 text-ivory/80 mt-4">
              <p><strong>Macbello Family Salon</strong></p>
              <p>Email: <a href="mailto:info@macbello.com" className="text-gold-primary hover:text-gold-hover transition-colors">info@macbello.com</a></p>
            </div>
          </div>

        </section>
      </main>
      <Footer />
    </>
  );
}
