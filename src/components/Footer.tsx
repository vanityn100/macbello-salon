"use client";

import { Star, ArrowUp, Phone, MapPin, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import branchesData from "@/data/branches.json";

export default function Footer() {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 800);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="relative bg-luxury-black border-t border-gold-primary/10 pt-16 pb-24 md:pb-16 text-ivory/60 text-xs">

      {/* Subtle gold top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gold-primary/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

        {/* Column 1: Brand */}
        <div className="space-y-6 flex flex-col">
          <div>
            <h3 className="font-playfair text-xl text-white tracking-[0.2em] uppercase font-semibold mb-1">
              MACBELLO
            </h3>
            <span className="text-[9px] uppercase tracking-[0.3em] text-gold-primary block">
              Family Salon
            </span>
          </div>

          <p className="font-light leading-relaxed text-ivory/50">
            Kerala&apos;s premier multi-branch luxury salon, serving Kaduthuruthy, Ettumanoor, and Peruva with precision styling and premium therapies.
          </p>

          <p className="text-[10px] uppercase tracking-[0.2em] text-gold-primary/60 font-light border-t border-white/5 pt-4">
            Serving Customers Across<br />
            <span className="text-gold-primary/80">Kaduthuruthy · Ettumanoor · Peruva</span>
          </p>

          {/* Combined Rating Badge */}
          <div className="flex items-center space-x-3.5 border border-white/5 bg-white/[0.01] p-4 self-start">
            <div className="bg-gold-primary/10 p-2 border border-gold-primary/20">
              <Star size={16} className="fill-gold-primary text-gold-primary" />
            </div>
            <div>
              <div className="flex items-center space-x-1">
                <span className="font-semibold text-white">4.8</span>
                <span className="text-[10px] text-ivory/40">★</span>
                <span className="text-[10px] text-gold-light font-medium ml-1">Avg. Rating</span>
              </div>
              <span className="text-[9px] uppercase tracking-wider text-ivory/40">
                1,626+ Reviews Across All Branches
              </span>
            </div>
          </div>
        </div>

        {/* Column 2: Navigation */}
        <div className="space-y-4">
          <h4 className="font-playfair text-sm text-white tracking-wider font-medium">
            Quick Navigation
          </h4>
          <ul className="space-y-2.5 font-light">
            {[
              { label: "About Our Heritage", href: "#about" },
              { label: "Premium Experiences", href: "#services" },
              { label: "Our Branches", href: "#branches" },
              { label: "Before & After Slider", href: "#transformations" },
              { label: "Luxury Portfolio", href: "#gallery" },
              { label: "Customer Feedback", href: "#feedback" },
              { label: "Contact Us", href: "#contact" },
            ].map((link) => (
              <li key={link.href}>
                <a href={link.href} className="hover:text-gold-primary transition-colors">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Column 3: Services */}
        <div className="space-y-4">
          <h4 className="font-playfair text-sm text-white tracking-wider font-medium">
            Styling Services
          </h4>
          <ul className="space-y-2.5 font-light">
            {[
              "Haircuts & Styling",
              "Organic Hair Botox",
              "Keratin Treatment",
              "HD Bridal Makeovers",
              "Executive Beard Grooming",
              "Hair Coloring & Balayage",
            ].map((service) => (
              <li key={service}>
                <a href="#services" className="hover:text-gold-primary transition-colors">
                  {service}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Column 4: Branch Directory */}
        <div className="space-y-4">
          <h4 className="font-playfair text-sm text-white tracking-wider font-medium">
            Our Branches
          </h4>
          <ul className="space-y-5 font-light">
            {branchesData.map((branch) => (
              <li key={branch.id} className="space-y-1.5 pb-4 border-b border-white/5 last:border-b-0 last:pb-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-gold-primary font-medium">
                  {branch.branch}
                </p>
                <div className="flex items-start space-x-2">
                  <MapPin size={10} className="text-gold-primary/60 mt-0.5 shrink-0" />
                  <span className="text-[11px] leading-relaxed">{branch.address}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone size={10} className="text-gold-primary/60 shrink-0" />
                  <a
                    href={`tel:+${branch.phoneRaw}`}
                    className="text-[11px] hover:text-gold-primary transition-colors"
                  >
                    {branch.phone}
                  </a>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock size={10} className="text-gold-primary/60 shrink-0" />
                  <span className="text-[11px]">9:30 AM – 8:30 PM · All Days</span>
                </div>
              </li>
            ))}
          </ul>

          {/* Social Icons */}
          <div className="flex space-x-3 pt-2">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 border border-white/5 bg-white/[0.02] hover:border-gold-primary text-ivory hover:text-gold-primary transition-all duration-300"
              aria-label="Instagram Profile"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
            </a>
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 border border-white/5 bg-white/[0.02] hover:border-gold-primary text-ivory hover:text-gold-primary transition-all duration-300"
              aria-label="Facebook Profile"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
            </a>
          </div>
        </div>
      </div>

      {/* Copyright bar */}
      <div className="max-w-7xl mx-auto px-6 border-t border-white/5 mt-16 pt-8 flex flex-col sm:flex-row items-center justify-between text-ivory/30 text-[10px] uppercase tracking-wider font-light gap-2">
        <span>&copy; {new Date().getFullYear()} Macbello Family Salon. All Rights Reserved.</span>
        <span>Where Style Meets Perfection</span>
      </div>

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-24 lg:bottom-8 left-8 z-40 p-3 bg-luxury-dark/95 border border-gold-primary/20 text-gold-primary hover:text-luxury-black hover:bg-gold-primary transition-all duration-300 shadow-lg cursor-pointer"
          aria-label="Scroll to top"
        >
          <ArrowUp size={16} />
        </button>
      )}
    </footer>
  );
}
