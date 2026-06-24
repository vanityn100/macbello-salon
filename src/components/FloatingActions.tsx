"use client";

import { useEffect, useState } from "react";
import { Phone, MessageSquare, MapPin, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function FloatingActions() {
  const [showDesktopBtn, setShowDesktopBtn] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowDesktopBtn(window.scrollY > 500);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Default to Kaduthuruthy branch for floating WhatsApp
  const whatsappUrl = `https://wa.me/919562514002?text=${encodeURIComponent(
    "Hi Macbello Family Salon, I'd like to book an appointment."
  )}`;

  // Default directions to Kaduthuruthy (nearest / primary branch)
  const directionsUrl =
    "https://www.google.com/maps/dir/?api=1&destination=Macbello+Family+Salon+Market+Junction+Kaduthuruthy+Kerala+686604";

  return (
    <>
      {/* Desktop Floating Book Appointment Button */}
      <AnimatePresence>
        {showDesktopBtn && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="fixed bottom-8 right-8 z-40 hidden lg:block"
          >
            <a
              href="#booking"
              className="relative flex items-center space-x-3 bg-luxury-dark/90 text-gold-primary border border-gold-primary/30 px-6 py-4 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.5)] group overflow-hidden transition-all duration-300 hover:border-gold-primary/60"
            >
              {/* Inner shine sweep */}
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
              {/* Pulse dot */}
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gold-primary" />
              </span>
              <Calendar size={16} className="group-hover:rotate-12 transition-transform" />
              <span className="text-xs uppercase tracking-[0.2em] font-medium">Book Appointment</span>
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Mobile WhatsApp Bubble */}
      <div 
        className="fixed right-4 z-[95] lg:hidden"
        style={{ bottom: "calc(110px + env(safe-area-inset-bottom))" }}
      >
        <motion.a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="flex items-center justify-center w-14 h-14 bg-[#25D366] text-white rounded-full shadow-[0_4px_15px_rgba(37,211,102,0.4)] animate-pulse-gold focus:outline-none"
          aria-label="WhatsApp Chat"
        >
          <MessageSquare fill="white" size={24} />
        </motion.a>
      </div>

      {/* Sticky Mobile Bottom Bar */}
      <div className="fixed bottom-0 inset-x-0 z-[90] lg:hidden border-t border-gold-primary/20 bg-luxury-dark/95 backdrop-blur-xl px-2 sm:px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-[0_-10px_25px_rgba(0,0,0,0.8)]">
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {/* Call Now */}
          <a
            href="tel:+919562514002"
            className="flex flex-col items-center justify-center py-2.5 border border-white/5 bg-white/5 active:bg-gold-primary/10 text-ivory active:text-gold-primary transition-colors"
          >
            <Phone size={18} className="mb-1 text-gold-primary" />
            <span className="text-[8px] sm:text-[9px] uppercase tracking-[0.1em] text-center min-w-0 truncate w-full px-1">Call Now</span>
          </a>

          {/* WhatsApp Book */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center py-2.5 border border-gold-primary/20 bg-gold-primary text-luxury-black font-semibold"
          >
            <MessageSquare size={18} className="mb-1" />
            <span className="text-[8px] sm:text-[9px] uppercase tracking-[0.1em] text-center min-w-0 truncate w-full px-1">WhatsApp</span>
          </a>

          {/* Directions */}
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center py-2.5 border border-white/5 bg-white/5 active:bg-gold-primary/10 text-ivory active:text-gold-primary transition-colors"
          >
            <MapPin size={18} className="mb-1 text-gold-primary" />
            <span className="text-[8px] sm:text-[9px] uppercase tracking-[0.1em] text-center min-w-0 truncate w-full px-1">Directions</span>
          </a>
        </div>
      </div>
    </>
  );
}
