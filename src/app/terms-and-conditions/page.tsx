import { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";

export const metadata: Metadata = {
  title: "Terms & Conditions | Macbello Family Salon",
  description: "Read the Terms & Conditions for Macbello Family Salon. Discover our service availability, booking terms, and usage policies.",
};

export default function TermsAndConditionsPage() {
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
              Terms & Conditions
            </h1>
            <p className="text-sm md:text-base text-ivory/60">
              Last Updated: {lastUpdated}
            </p>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-6 py-12 md:py-20 space-y-12 font-light leading-relaxed">
          
          <div className="space-y-4">
            <h2 className="font-playfair text-2xl text-gold-primary">1. Acceptance of Terms</h2>
            <p>
              By accessing the Macbello Family Salon website, booking an appointment, or using any of our services, you agree to be bound by these Terms & Conditions. If you do not agree with any part of these terms, please refrain from using our services.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="font-playfair text-2xl text-gold-primary">2. Appointment Booking Policies</h2>
            <ul className="list-disc pl-5 space-y-2 text-ivory/70">
              <li>Appointments can be booked online, by phone, or in person at any of our branches.</li>
              <li>Please arrive at least 10 minutes prior to your scheduled appointment to ensure a smooth experience.</li>
              <li>Late arrivals may result in shortened service time to accommodate following clients.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="font-playfair text-2xl text-gold-primary">3. Customer Responsibilities</h2>
            <p>
              Customers are expected to provide accurate contact information. If you have any medical conditions, allergies, or sensitivities, it is your responsibility to inform our staff prior to the commencement of any service. Macbello Salon is not liable for adverse reactions resulting from undisclosed medical conditions.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="font-playfair text-2xl text-gold-primary">4. Service Availability</h2>
            <p>
              While we strive to provide all listed services, availability may vary by branch and depends on staff availability and operational constraints. Macbello Salon reserves the right to modify, suspend, or discontinue any service without prior notice.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="font-playfair text-2xl text-gold-primary">5. Pricing, Billing, and Invoice Generation</h2>
            <ul className="list-disc pl-5 space-y-2 text-ivory/70">
              <li>All prices listed on the website or in-store are subject to change without prior notice.</li>
              <li>Final billing will be calculated based on the services provided and any applicable taxes (GST).</li>
              <li>Invoices are automatically generated and sent via email/WhatsApp or provided in-store upon checkout.</li>
              <li>Payment must be completed in full at the time of service completion.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="font-playfair text-2xl text-gold-primary">6. Intellectual Property Rights</h2>
            <p>
              All content on the Macbello Family Salon website, including logos, images, text, and design elements, is the intellectual property of Macbello Salon. Unauthorized reproduction, distribution, or commercial use is strictly prohibited.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="font-playfair text-2xl text-gold-primary">7. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, Macbello Salon shall not be liable for any direct, indirect, incidental, or consequential damages arising from the use of our website or services. This includes, but is not limited to, dissatisfaction with services, personal injury, or loss of data.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="font-playfair text-2xl text-gold-primary">8. Website Usage Rules</h2>
            <p>
              You agree not to use our website for any unlawful purpose, to attempt unauthorized access to our systems, or to submit false information. Any violation of these rules may result in the termination of your access to our online booking system.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="font-playfair text-2xl text-gold-primary">9. Governing Law</h2>
            <p>
              These Terms & Conditions shall be governed by and construed in accordance with the laws of India. Any disputes arising out of these terms shall be subject to the exclusive jurisdiction of the courts in Kerala, India.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="font-playfair text-2xl text-gold-primary">10. Contact Information</h2>
            <p>
              For any legal or service-related inquiries, please contact us at:
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
