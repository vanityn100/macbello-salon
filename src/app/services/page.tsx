"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";
import Services from "@/components/Services";
import Booking from "@/components/Booking";

export default function ServicesPage() {
  return (
    <>
      <FloatingActions />
      <Navbar />
      <main className="flex flex-col min-h-screen pt-24 bg-luxury-black">
        {/* Page Header */}
        <section className="relative py-12 md:py-16 bg-luxury-black overflow-hidden border-b border-gold-primary/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.03),transparent_70%)] pointer-events-none" />
          <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
            <span className="text-[10px] md:text-xs uppercase tracking-[0.25em] text-gold-primary mb-3 font-medium block">
              Menu & Pricing
            </span>
            <h1 className="font-playfair text-4xl md:text-5xl text-white font-light tracking-wide mb-4">
              Our Complete Service Menu
            </h1>
            <p className="text-sm md:text-base text-ivory/60 max-w-2xl mx-auto leading-relaxed font-light">
              Explore our range of premium experiences across hair styling, advanced skin care, grooming, and luxury bridal services.
            </p>
          </div>
        </section>

        {/* Complete Services List */}
        <Services featuredOnly={false} />

        {/* Quick Booking CTA */}
        <Booking />
      </main>
      <Footer />
    </>
  );
}
