"use client";

import { motion } from "framer-motion";
import { Phone, MessageSquare, MapPin, Clock, Star, Compass } from "lucide-react";
import branchesData from "@/data/branches.json";

export default function Branches() {
  return (
    <section
      id="branches"
      className="relative py-20 md:py-28 bg-luxury-black overflow-hidden border-b border-gold-primary/10"
    >
      {/* Ambient background glow */}
      <div className="absolute top-[30%] left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-[radial-gradient(ellipse,rgba(212,175,55,0.04),transparent_70%)] pointer-events-none" />

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
            Our Locations
          </span>
          <h2 className="font-playfair text-3xl md:text-5xl text-white font-light tracking-wide mb-5">
            Three Branches.{" "}
            <span className="text-gold-primary italic">One Standard.</span>
          </h2>
          <p className="text-sm text-ivory/60 leading-relaxed font-light">
            Every Macbello branch delivers the same luxury experience — premium products, expert stylists, and a five-star environment across Kaduthuruthy, Ettumanoor, and Peruva.
          </p>
        </motion.div>

        {/* Branch Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {branchesData.map((branch, idx) => {
            const whatsappUrl = `https://wa.me/${branch.phoneRaw}?text=${encodeURIComponent(branch.whatsappMessage)}`;

            return (
              <motion.div
                key={branch.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.15, ease: "easeOut" }}
                className="group relative flex flex-col glass-card border border-white/5 hover:border-gold-primary/30 transition-all duration-500 overflow-hidden"
              >
                {/* Top gold accent bar */}
                <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-gold-primary to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-500" />

                {/* Corner accents */}
                <div className="absolute top-3 right-3 w-4 h-4 border-t border-r border-gold-primary/0 group-hover:border-gold-primary/50 transition-all duration-500" />
                <div className="absolute bottom-3 left-3 w-4 h-4 border-b border-l border-gold-primary/0 group-hover:border-gold-primary/50 transition-all duration-500" />

                <div className="p-7 flex flex-col flex-1">
                  {/* Branch name + location */}
                  <div className="mb-5">
                    <span className="text-[9px] uppercase tracking-[0.3em] text-gold-primary font-semibold block mb-2">
                      Branch {idx + 1}
                    </span>
                    <h3 className="font-playfair text-xl text-white font-medium tracking-wide leading-snug">
                      {branch.name}
                    </h3>
                    <p className="text-sm text-gold-primary/80 font-medium tracking-wider mt-0.5">
                      {branch.branch}
                    </p>
                  </div>

                  {/* Rating badge */}
                  <div className="flex items-center space-x-2 mb-5">
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={11}
                          className={
                            i < Math.floor(branch.rating)
                              ? "fill-gold-primary text-gold-primary"
                              : "fill-gold-primary/20 text-gold-primary/20"
                          }
                        />
                      ))}
                    </div>
                    <span className="text-xs text-ivory/70 font-light">
                      {branch.rating}★ ({branch.reviewCount.toLocaleString()} Reviews)
                    </span>
                  </div>

                  {/* Info rows */}
                  <div className="space-y-3 mb-7 flex-1">
                    <div className="flex items-start space-x-3">
                      <div className="p-1.5 border border-gold-primary/15 bg-gold-primary/5 text-gold-primary mt-0.5 shrink-0">
                        <MapPin size={11} />
                      </div>
                      <p className="text-xs text-ivory/65 leading-relaxed font-light">
                        {branch.address}
                      </p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="p-1.5 border border-gold-primary/15 bg-gold-primary/5 text-gold-primary mt-0.5 shrink-0">
                        <Phone size={11} />
                      </div>
                      <a
                        href={`tel:+${branch.phoneRaw}`}
                        className="text-xs text-ivory/80 hover:text-gold-primary transition-colors font-medium tracking-wide"
                      >
                        {branch.phone}
                      </a>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="p-1.5 border border-gold-primary/15 bg-gold-primary/5 text-gold-primary mt-0.5 shrink-0">
                        <Clock size={11} />
                      </div>
                      <div>
                        <p className="text-xs text-ivory/65 font-light">{branch.hours}</p>
                        <span className="text-[10px] text-gold-primary/60 font-light">
                          {branch.hoursNote}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CTA Buttons */}
                  <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-5">
                    <a
                      href={`tel:+${branch.phoneRaw}`}
                      className="flex flex-col items-center justify-center py-3 border border-white/8 bg-white/[0.03] hover:border-gold-primary/40 hover:bg-gold-primary/5 text-ivory hover:text-gold-primary transition-all duration-300 group/btn"
                      aria-label={`Call ${branch.branch} branch`}
                    >
                      <Phone size={15} className="mb-1 text-gold-primary" />
                      <span className="text-[9px] uppercase tracking-[0.1em] font-medium">Call</span>
                    </a>
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center py-3 bg-gold-primary hover:bg-gold-dark text-luxury-black font-semibold transition-all duration-300"
                      aria-label={`WhatsApp ${branch.branch} branch`}
                    >
                      <MessageSquare size={15} className="mb-1" />
                      <span className="text-[9px] uppercase tracking-[0.1em] font-bold">WhatsApp</span>
                    </a>
                    <a
                      href={branch.directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center py-3 border border-white/8 bg-white/[0.03] hover:border-gold-primary/40 hover:bg-gold-primary/5 text-ivory hover:text-gold-primary transition-all duration-300"
                      aria-label={`Directions to ${branch.branch} branch`}
                    >
                      <Compass size={15} className="mb-1 text-gold-primary" />
                      <span className="text-[9px] uppercase tracking-[0.1em] font-medium">Map</span>
                    </a>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom tagline strip */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-14 text-center"
        >
          <p className="text-[11px] uppercase tracking-[0.3em] text-ivory/30 font-light">
            Serving customers across Kaduthuruthy · Ettumanoor · Peruva
          </p>
        </motion.div>
      </div>
    </section>
  );
}
