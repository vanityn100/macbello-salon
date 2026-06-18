"use client";

import { useState, useEffect } from "react";
import { Menu, X, Phone, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
  { name: "About", href: "#about" },
  { name: "Services", href: "#services" },
  { name: "Transformations", href: "#transformations" },
  { name: "Gallery", href: "#gallery" },
  { name: "Reviews", href: "#reviews" },
  { name: "Experts", href: "#experts" },
  { name: "Contact", href: "#contact" }
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      // Background scroll trigger
      setScrolled(window.scrollY > 50);

      // Scroll progress computation
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll > 0) {
        setScrollProgress((window.scrollY / totalScroll) * 100);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* Scroll Progress Indicator */}
      <div className="fixed top-0 left-0 right-0 h-[2px] z-50 pointer-events-none">
        <div 
          className="h-full bg-gold-primary transition-all duration-75"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      <nav
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled
            ? "bg-luxury-black/80 backdrop-blur-md border-b border-gold-primary/10 py-4"
            : "bg-transparent py-6"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex flex-col items-start group">
            <span className="font-playfair text-xl md:text-2xl font-semibold tracking-[0.25em] text-gold-primary group-hover:text-champagne transition-colors duration-300">
              MACBELLO
            </span>
            <span className="text-[8px] uppercase tracking-[0.3em] text-ivory/50 -mt-1">
              Family Salon
            </span>
          </a>

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center space-x-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-xs uppercase tracking-[0.2em] text-ivory/70 hover:text-gold-primary transition-colors duration-300 relative py-1 group"
              >
                {link.name}
                <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-gold-primary transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </div>

          {/* Action CTAs */}
          <div className="hidden lg:flex items-center space-x-4">
            <a
              href="tel:+919562514002"
              className="flex items-center space-x-2 text-xs uppercase tracking-[0.15em] border border-white/10 hover:border-gold-primary/30 px-4 py-2.5 rounded-none backdrop-blur-md bg-white/5 text-ivory hover:text-gold-primary transition-all duration-300"
            >
              <Phone size={12} className="text-gold-primary" />
              <span>+91 95625 14002</span>
            </a>
            <a
              href="#booking"
              className="flex items-center space-x-2 text-xs uppercase tracking-[0.15em] bg-gold-primary hover:bg-gold-dark text-luxury-black px-5 py-2.5 rounded-none font-medium transition-all duration-300 shadow-[0_0_15px_rgba(212,175,55,0.2)] hover:shadow-[0_0_25px_rgba(212,175,55,0.4)]"
            >
              <Calendar size={12} />
              <span>Book Appointment</span>
            </a>
          </div>

          {/* Mobile Hamburguer Toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden text-ivory hover:text-gold-primary transition-colors focus:outline-none"
            aria-label="Toggle menu"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Fullscreen Navigation Overlay */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-x-0 top-[72px] bottom-0 z-40 bg-luxury-black/95 backdrop-blur-xl border-t border-white/5 flex flex-col justify-between p-8 lg:hidden"
            >
              <div className="flex flex-col space-y-6 mt-4">
                {navLinks.map((link, idx) => (
                  <motion.a
                    initial={{ opacity: 0, x: -25 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={link.name}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="text-lg font-playfair tracking-[0.15em] text-ivory hover:text-gold-primary transition-colors py-2 border-b border-white/5"
                  >
                    {link.name}
                  </motion.a>
                ))}
              </div>

              {/* Mobile Menu Action CTAs */}
              <div className="flex flex-col space-y-4 mb-12">
                <a
                  href="tel:+919562514002"
                  className="flex items-center justify-center space-x-3 text-sm uppercase tracking-[0.15em] border border-gold-primary/30 px-6 py-4 bg-white/5 text-ivory"
                  onClick={() => setIsOpen(false)}
                >
                  <Phone size={14} className="text-gold-primary" />
                  <span>Call: +91 95625 14002</span>
                </a>
                <a
                  href="#booking"
                  className="flex items-center justify-center space-x-3 text-sm uppercase tracking-[0.15em] bg-gold-primary text-luxury-black py-4 font-semibold"
                  onClick={() => setIsOpen(false)}
                >
                  <Calendar size={14} />
                  <span>Book Appointment</span>
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  );
}
