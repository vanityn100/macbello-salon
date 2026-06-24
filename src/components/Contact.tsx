"use client";

import { motion } from "framer-motion";
import { Phone, MapPin, Clock, MessageSquare, Compass } from "lucide-react";
import branchesData from "@/data/branches.json";

export default function Contact() {
  return (
    <section
      id="contact"
      className="relative py-20 md:py-28 bg-luxury-black overflow-hidden border-b border-gold-primary/10"
    >
      {/* Background soft ambient */}
      <div className="absolute top-[20%] left-[5%] w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(212,175,55,0.02),transparent_70%)] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[5%] w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(212,175,55,0.02),transparent_70%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="text-[10px] md:text-xs uppercase tracking-[0.3em] text-gold-primary mb-4 font-medium block">
            Find Us
          </span>
          <h2 className="font-playfair text-3xl md:text-5xl text-white font-light tracking-wide mb-4">
            Contact{" "}
            <span className="text-gold-primary italic">Any Branch</span>
          </h2>
          <p className="text-sm text-ivory/55 font-light leading-relaxed">
            Reach out to any of our three locations for appointments, inquiries, or directions.
          </p>
        </motion.div>

        {/* Branch Contact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {branchesData.map((branch, idx) => {
            const whatsappUrl = `https://wa.me/${branch.phoneRaw}?text=${encodeURIComponent(branch.whatsappMessage)}`;

            return (
              <motion.div
                key={branch.id}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.12, ease: "easeOut" }}
                className="glass-card border border-white/5 hover:border-gold-primary/25 transition-all duration-500 group"
              >
                <div className="h-[1px] bg-gradient-to-r from-transparent via-gold-primary/40 to-transparent" />

                <div className="p-6 space-y-5">
                  {/* Header */}
                  <div>
                    <span className="text-[9px] uppercase tracking-[0.25em] text-gold-primary/70 font-medium block mb-1">
                      Branch {idx + 1}
                    </span>
                    <h3 className="font-playfair text-lg text-white font-medium tracking-wide">
                      {branch.branch}
                    </h3>
                  </div>

                  {/* Info */}
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3 min-w-0">
                      <div className="p-1.5 border border-gold-primary/20 bg-gold-primary/5 text-gold-primary mt-0.5 shrink-0">
                        <MapPin size={11} />
                      </div>
                      <p className="text-xs text-ivory/60 leading-relaxed font-light break-words min-w-0">
                        {branch.address}
                      </p>
                    </div>

                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="p-1.5 border border-gold-primary/20 bg-gold-primary/5 text-gold-primary shrink-0">
                        <Phone size={11} />
                      </div>
                      <a
                        href={`tel:+${branch.phoneRaw}`}
                        className="text-xs text-ivory/75 hover:text-gold-primary transition-colors font-medium tracking-wide break-all min-w-0"
                      >
                        {branch.phone}
                      </a>
                    </div>

                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="p-1.5 border border-gold-primary/20 bg-gold-primary/5 text-gold-primary shrink-0">
                        <Clock size={11} />
                      </div>
                      <p className="text-xs text-ivory/60 font-light break-words min-w-0">
                        {branch.hours} · {branch.hoursNote}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/5">
                    <a
                      href={`tel:+${branch.phoneRaw}`}
                      className="flex flex-col items-center justify-center py-3 border border-white/8 bg-white/[0.02] hover:border-gold-primary/40 hover:bg-gold-primary/5 text-ivory hover:text-gold-primary transition-all duration-300"
                      aria-label={`Call ${branch.branch}`}
                    >
                      <Phone size={14} className="mb-1 text-gold-primary" />
                      <span className="text-[8px] uppercase tracking-[0.1em]">Call</span>
                    </a>
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center py-3 bg-gold-primary hover:bg-gold-dark text-luxury-black font-semibold transition-all duration-300"
                      aria-label={`WhatsApp ${branch.branch}`}
                    >
                      <MessageSquare size={14} className="mb-1" />
                      <span className="text-[8px] uppercase tracking-[0.1em] font-bold">WhatsApp</span>
                    </a>
                    <a
                      href={branch.directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center py-3 border border-white/8 bg-white/[0.02] hover:border-gold-primary/40 hover:bg-gold-primary/5 text-ivory hover:text-gold-primary transition-all duration-300"
                      aria-label={`Directions to ${branch.branch}`}
                    >
                      <Compass size={14} className="mb-1 text-gold-primary" />
                      <span className="text-[8px] uppercase tracking-[0.1em]">Directions</span>
                    </a>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Opening Hours note */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-12 text-center border border-gold-primary/10 bg-gold-primary/[0.02] py-5 px-6"
        >
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-6 text-[11px] text-ivory/40 uppercase tracking-[0.2em] font-light">
            <div className="flex items-center space-x-2">
              <Clock size={11} className="text-gold-primary/50" />
              <span>All Branches Open 9:30 AM – 8:30 PM</span>
            </div>
            <span className="hidden sm:block text-gold-primary/20">·</span>
            <span>Monday through Sunday</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
