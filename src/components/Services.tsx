"use client";

import { motion } from "framer-motion";
import servicesData from "@/data/services.json";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Helper to map icon names from JSON to Lucide React components
const getIcon = (iconName: string): LucideIcon => {
  const allIcons = Icons as unknown as Record<string, LucideIcon>;
  return allIcons[iconName] ?? Icons.Sparkles;
};

export default function Services({ featuredOnly = false }: { featuredOnly?: boolean }) {
  const displayServices = featuredOnly ? servicesData.slice(0, 6) : servicesData;

  return (
    <section id="services" className="relative py-20 md:py-28 bg-luxury-black overflow-hidden border-b border-gold-primary/10">
      {/* Background ambient gold gradient */}
      <div className="absolute top-[30%] left-[10%] w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(212,175,55,0.02),transparent_70%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
          <span className="text-[10px] md:text-xs uppercase tracking-[0.25em] text-gold-primary mb-3 font-medium block">
            Our Menu
          </span>
          <h2 className="font-playfair text-3xl md:text-4xl text-white font-light tracking-wide mb-6">
            Premium Service Experiences
          </h2>
          <p className="text-sm md:text-base text-ivory/60 leading-relaxed font-light">
            We focus on custom, high-caliber care rather than standard checklists. Every treatment is custom-tailored using premium materials and expert styling methods to match your specific beauty desires.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {displayServices.map((service, idx) => {
            const Icon = getIcon(service.icon);
            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: (idx % 3) * 0.15 }}
                className="relative overflow-hidden p-8 border border-white/5 bg-white/[0.02] hover:border-gold-primary/30 group hover:shadow-[0_10px_30px_rgba(212,175,55,0.05)] transition-all duration-500 flex flex-col justify-between h-full"
              >
                {/* Subtle glass shimmer hover animation */}
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />

                {/* Top Section */}
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-3 bg-gold-primary/5 border border-gold-primary/10 rounded-none group-hover:border-gold-primary/30 group-hover:bg-gold-primary/10 text-gold-primary transition-all duration-300">
                      <Icon size={24} className="group-hover:rotate-12 transition-transform duration-300" />
                    </div>
                    <span className="text-[8px] uppercase tracking-[0.2em] text-gold-light border border-gold-primary/20 px-2 py-0.5 font-light">
                      {service.category}
                    </span>
                  </div>

                  <h3 className="font-playfair text-xl text-white font-medium mb-3 tracking-wide">
                    {service.name}
                  </h3>
                  <p className="text-xs text-ivory/60 leading-relaxed font-light mb-6">
                     {service.description}
                  </p>
                </div>

                {/* Bottom Section: Experience Standards */}
                <div className="border-t border-white/5 pt-6 mt-4">
                  <span className="text-[9px] uppercase tracking-[0.2em] text-gold-primary font-medium block mb-3">
                    Experience Highlights
                  </span>
                  <ul className="grid grid-cols-2 gap-2">
                    {service.features.map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-center space-x-1.5">
                        <span className="w-1 h-1 bg-gold-primary rounded-full shrink-0" />
                        <span className="text-[9px] text-ivory/80 font-light tracking-wide truncate" title={feature}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Dynamic CTA box */}
        <div className="mt-16 md:mt-24 text-center">
          <div className="inline-block p-6 md:p-8 border border-gold-primary/10 bg-gold-primary/5 backdrop-blur-md max-w-2xl mx-auto">
            <h4 className="font-playfair text-lg text-white font-medium tracking-wide mb-2">
              {featuredOnly ? "Want to see our full range?" : "Looking for a custom makeover?"}
            </h4>
            <p className="text-xs text-ivory/70 font-light leading-relaxed mb-6">
              {featuredOnly 
                ? "We offer dozens of specialty treatments, custom styling packages, and grooming experiences." 
                : "Our experts offer complimentary, in-depth styling consultations to curate bespoke services tailored uniquely to your aesthetic goals."}
            </p>
            {featuredOnly ? (
              <a
                href="/services"
                className="inline-block text-xs uppercase tracking-[0.2em] border border-gold-primary/30 hover:border-gold-primary bg-transparent text-gold-primary hover:text-luxury-black hover:bg-gold-primary px-8 py-3 transition-all duration-300"
              >
                View Full Services Menu
              </a>
            ) : (
              <a
                href="#booking"
                className="inline-block text-xs uppercase tracking-[0.2em] border border-gold-primary/30 hover:border-gold-primary bg-transparent text-gold-primary hover:text-luxury-black hover:bg-gold-primary px-6 py-3 transition-all duration-300"
              >
                Consult an Expert
              </a>
            )}
          </div>
        </div>

      </div>
    </section>
  );
}
