"use client";

import { motion } from "framer-motion";
import { Check, Calendar } from "lucide-react";
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
  "Warm and welcoming family-friendly environment",
  "Internationally trained styling professionals",
  "Exclusive, dermatologist-approved premium products",
  "Tailored consultation before every hair and skin service",
  "Impeccable hygiene and sterilization standards"
];

export default function About() {
  return (
    <section id="about" className="relative py-20 md:py-28 bg-luxury-black overflow-hidden border-b border-gold-primary/10">
      {/* Background soft ambient glow */}
      <div className="absolute top-[20%] right-0 w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(212,175,55,0.02),transparent_70%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          
          {/* Left: Overlapping Image Collage */}
          <div className="lg:col-span-6 relative h-[450px] sm:h-[500px] w-full flex items-center justify-center">
            
            {/* Background decorative gold frame */}
            <div className="absolute w-[80%] h-[80%] border border-gold-primary/10 -translate-x-4 -translate-y-4 pointer-events-none hidden sm:block" />

            {/* Image 1: Salon Lounge (Largest, Background) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="absolute left-4 top-4 w-[65%] h-[65%] border border-gold-primary/20 shadow-[0_15px_30px_rgba(0,0,0,0.6)] overflow-hidden"
            >
              <Image 
                src="/images/gallery/interior-1.webp"
                alt="Macbello Suite Main Styling Lounge"
                fill
                sizes="(max-width: 1024px) 50vw, 35vw"
                className="object-cover hover:scale-105 transition-transform duration-700" 
              />
            </motion.div>

            {/* Image 2: Hair Styling (Foreground overlap, Bottom Right) */}
            <motion.div
              initial={{ opacity: 0, x: 50, y: 50 }}
              whileInView={{ opacity: 1, x: 0, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="absolute right-4 bottom-4 w-[55%] h-[55%] border border-gold-primary/20 shadow-[0_20px_45px_rgba(0,0,0,0.7)] z-10 overflow-hidden"
            >
              <Image 
                src="/images/gallery/styling-1.webp"
                alt="Premium Hair Styling Session"
                fill
                sizes="(max-width: 1024px) 40vw, 25vw"
                className="object-cover hover:scale-105 transition-transform duration-700"
              />
            </motion.div>

            {/* Image 3: Small Detail (Floating Top Right) */}
            <motion.div
              initial={{ opacity: 0, y: -30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="absolute right-8 top-12 w-[35%] h-[35%] border border-gold-primary/30 shadow-[0_10px_25px_rgba(0,0,0,0.5)] z-20 overflow-hidden hidden sm:block"
            >
              <Image 
                src="/images/gallery/interior-2.webp"
                alt="VIP Waiting Lounge area"
                fill
                sizes="15vw"
                className="object-cover hover:scale-105 transition-transform duration-700"
              />
            </motion.div>
          </div>

          {/* Right: Storytelling & Timeline */}
          <div className="lg:col-span-6 flex flex-col justify-center">
            <span className="text-[10px] md:text-xs uppercase tracking-[0.25em] text-gold-primary mb-3 font-medium">
              Our Heritage
            </span>
            <h2 className="font-playfair text-2xl sm:text-3xl md:text-4xl text-white font-light leading-tight mb-6">
              More Than a Salon.<br />
              <span className="text-gold-primary italic">A Destination for Confidence.</span>
            </h2>

            <p className="text-xs sm:text-sm text-ivory/70 leading-relaxed font-light mb-8">
              At Macbello Family Salon, we believe style is a language of self-respect. Located at Market Junction, Kaduthuruthy, we blend international aesthetic trends with warm, personalized care to deliver styling experiences that leave you feeling refreshed, redefined, and confident.
            </p>

            {/* Experience Checklist */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {sellingPoints.map((point, idx) => (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  key={idx}
                  className="flex items-start space-x-2.5"
                >
                  <div className="mt-0.5 p-0.5 bg-gold-primary/10 border border-gold-primary/30 rounded-none text-gold-primary shrink-0">
                    <Check size={10} />
                  </div>
                  <span className="text-xs text-ivory/80 font-light tracking-wide">{point}</span>
                </motion.div>
              ))}
            </div>

            {/* Call to Action Trigger inside About Section */}
            <div className="mb-10">
              <a
                href="#booking"
                className="inline-flex items-center space-x-2 text-[10px] uppercase tracking-[0.2em] bg-gold-primary hover:bg-gold-dark text-luxury-black font-semibold px-6 py-3.5 transition-all duration-300"
              >
                <Calendar size={12} />
                <span>Reserve An Experience</span>
              </a>
            </div>

            {/* Animated Timeline */}
            <div className="relative border-l border-gold-primary/10 pl-6 space-y-8 mt-4">
              {milestones.map((milestone, idx) => (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.2 }}
                  key={milestone.year}
                  className="relative group"
                >
                  {/* Timeline bullet */}
                  <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full bg-luxury-black border border-gold-primary group-hover:bg-gold-primary transition-colors duration-300" />
                  
                  {/* Year Tag */}
                  <span className="text-xs uppercase font-semibold tracking-wider text-gold-primary font-playfair block mb-1">
                    {milestone.year}
                  </span>
                  
                  {/* Title & Description */}
                  <h3 className="text-xs font-semibold text-white tracking-wide mb-1">
                    {milestone.title}
                  </h3>
                  <p className="text-[11px] text-ivory/60 leading-relaxed font-light">
                    {milestone.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
