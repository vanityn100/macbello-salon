"use client";

import { motion } from "framer-motion";
import { Calendar, Users, ShieldCheck, Sparkles, Award, MessageSquare } from "lucide-react";
import Image from "next/image";

const milestones = [
  {
    year: "2016",
    title: "The Genesis",
    description: "Macbello opened its doors at Market Junction, Kaduthuruthy, bringing international styling techniques to the heart of Kerala."
  },
  {
    year: "2020",
    title: "Family Salon Evolution",
    description: "Expanded our facilities to include specialized bridal suites and exclusive grooming lounges, creating a premium sanctuary for the entire family."
  },
  {
    year: "2026",
    title: "A Trusted Benchmark",
    description: "Celebrating 10 years and over 781+ five-star Google reviews, standing proud as the region's premier luxury salon destination."
  }
];

const sellingPoints = [
  {
    text: "Warm & Welcoming Family Environment",
    icon: Users
  },
  {
    text: "Dermatologist-Approved Premium Products",
    icon: ShieldCheck
  },
  {
    text: "Impeccable Hygiene & Sterilization Standards",
    icon: Sparkles
  },
  {
    text: "Internationally Trained Styling Professionals",
    icon: Award
  },
  {
    text: "Personalized Consultation Before Every Service",
    icon: MessageSquare
  }
];

export default function About() {
  return (
    <section id="about" className="relative py-10 md:py-28 bg-luxury-black overflow-hidden border-b border-gold-primary/10">
      {/* Background soft ambient glow */}
      <div className="absolute top-[20%] right-0 w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(212,175,55,0.02),transparent_70%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6">
        
        {/* Header Block (Centered) */}
        <div className="text-center max-w-4xl mx-auto mb-10">
          <span className="text-[10px] md:text-xs uppercase tracking-[0.25em] text-gold-primary mb-3 font-medium block">
            About Macbello
          </span>
          <h2 className="font-playfair text-2xl sm:text-3xl md:text-4xl text-white font-light leading-tight mb-4">
            More Than a Salon.<br />
            <span className="text-gold-primary italic">A Destination for Confidence.</span>
          </h2>
          
          {/* Subtle gold divider */}
          <div className="flex items-center justify-center my-5">
            <div className="h-[1px] w-12 bg-gold-primary/30" />
            <div className="mx-2.5 w-1.5 h-1.5 rotate-45 border border-gold-primary bg-luxury-black" />
            <div className="h-[1px] w-12 bg-gold-primary/30" />
          </div>

          <p className="text-xs sm:text-sm text-ivory/70 leading-relaxed font-light max-w-3xl mx-auto mt-4">
            At Macbello Family Salon, we believe style is a language of self-respect. Located at Market Junction, Kaduthuruthy, we blend international aesthetic trends with warm, personalized care to deliver styling experiences that leave you feeling refreshed, redefined, and confident.
          </p>
        </div>

        {/* Landscape Showroom Gallery (3 columns) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 w-full">
          
          {/* Image 1 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative h-[220px] sm:h-[260px] md:h-[280px] lg:h-[320px] border border-gold-primary/20 hover:border-gold-primary/50 transition-all duration-300 shadow-[0_8px_30px_rgba(0,0,0,0.4)] overflow-hidden rounded-lg group"
          >
            <Image 
              src="/images/gallery/photo1.webp"
              alt="photo1"
              fill
              sizes="(max-width: 768px) 100vw, 30vw"
              className="object-cover group-hover:scale-105 transition-transform duration-700" 
            />
          </motion.div>

          {/* Image 2 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="relative h-[220px] sm:h-[260px] md:h-[280px] lg:h-[320px] border border-gold-primary/20 hover:border-gold-primary/50 transition-all duration-300 shadow-[0_8px_30px_rgba(0,0,0,0.4)] overflow-hidden rounded-lg group max-md:hidden"
          >
            <Image 
              src="/images/gallery/photo2.webp"
              alt="photo2"
              fill
              sizes="(max-width: 768px) 100vw, 30vw"
              className="object-cover group-hover:scale-105 transition-transform duration-700"
            />
          </motion.div>

          {/* Image 3 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative h-[220px] sm:h-[260px] md:h-[280px] lg:h-[320px] border border-gold-primary/20 hover:border-gold-primary/50 transition-all duration-300 shadow-[0_8px_30px_rgba(0,0,0,0.4)] overflow-hidden rounded-lg group max-md:hidden"
          >
            <Image 
              src="/images/gallery/photo3.webp"
              alt="photo3"
              fill
              sizes="(max-width: 768px) 100vw, 30vw"
              className="object-cover group-hover:scale-105 transition-transform duration-700"
            />
          </motion.div>
        </div>

        {/* Experience Highlights Checklist (Horizontal list at bottom) */}
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs font-light text-ivory/80 max-w-6xl mx-auto py-4 border-b border-white/5 print-border-gray">
          {sellingPoints.map((point, idx) => {
            const Icon = point.icon;
            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                key={idx}
                className="flex items-center space-x-3"
              >
                <div className="w-8 h-8 rounded-full border border-gold-primary/30 bg-gold-primary/5 flex items-center justify-center text-gold-primary shrink-0">
                  <Icon size={14} />
                </div>
                <span className="text-[11px] md:text-xs text-ivory/90 font-light tracking-wide">{point.text}</span>
              </motion.div>
            );
          })}
        </div>

        {/* Call to Action & Timeline */}
        <div className="mt-6 md:mt-12 flex flex-col items-center">
          {/* Reserve CTA */}
          <div className="mb-6 md:mb-14">
            <a
              href="#booking"
              className="inline-flex items-center space-x-2 text-[10px] uppercase tracking-[0.2em] bg-gold-primary hover:bg-gold-dark text-luxury-black font-semibold px-6 py-3.5 transition-all duration-300"
            >
              <Calendar size={12} />
              <span>Reserve An Experience</span>
            </a>
          </div>

          {/* Timeline Block - hidden on mobile to save space */}
          <div className="hidden md:grid grid-cols-3 gap-8 w-full max-w-6xl">
            {milestones.map((milestone, idx) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.2 }}
                key={milestone.year}
                className="relative group border-l md:border-l-0 md:border-t border-gold-primary/20 pl-6 md:pl-0 md:pt-6 pt-1"
              >
                {/* Timeline bullet */}
                <div className="absolute -left-[5px] md:left-1/2 md:-translate-x-1/2 md:-top-[5px] top-1 w-2.5 h-2.5 rounded-full bg-luxury-black border border-gold-primary group-hover:bg-gold-primary transition-colors duration-300" />
                
                {/* Year Tag */}
                <span className="text-sm uppercase font-semibold tracking-wider text-gold-primary font-playfair block mb-1 md:text-center">
                  {milestone.year}
                </span>
                
                {/* Title & Description */}
                <h3 className="text-xs font-semibold text-white tracking-wide mb-1 md:text-center">
                  {milestone.title}
                </h3>
                <p className="text-[11px] text-ivory/60 leading-relaxed font-light md:text-center">
                  {milestone.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
