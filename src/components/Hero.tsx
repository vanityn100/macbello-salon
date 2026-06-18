"use client";

import { useSyncExternalStore } from "react";
import { Phone, Calendar, ChevronDown, Star } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";

// Idiomatic client-side detection without setState-in-effect
const useIsClient = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

export default function Hero() {
  const mounted = useIsClient();

  const headline = "Transform Your Look. Elevate Your Confidence.";
  const headlineWords = headline.split(" ");

  // Static particle configurations for hydration safety (rendered only after mounting)
  const particles = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    size: ((i * 7) % 4) + 2, // 2px to 5px
    left: `${(i * 17) % 100}%`,
    top: `${(i * 23) % 100}%`,
    delay: (i * 0.4) % 6,
    duration: ((i * 1.5) % 6) + 6
  }));

  return (
    <section className="relative h-screen w-full overflow-hidden flex flex-col justify-center items-center px-6 text-center">
      {/* Background Cinematic Single WebP Image with soft zoom */}
      <motion.div
        initial={{ scale: 1 }}
        animate={{ scale: 1.08 }}
        transition={{ duration: 15, ease: "easeOut" }}
        className="absolute inset-0 z-0"
      >
        <Image
          src="/images/hero/hero_salon.webp"
          alt="Macbello Family Salon Luxury Interior"
          fill
          priority
          className="object-cover filter brightness-[0.35]"
          sizes="100vw"
        />
      </motion.div>

      {/* Dark Luxury Gradient Overlay */}
      <div className="absolute inset-0 z-1 bg-gradient-to-t from-luxury-black via-transparent to-luxury-black/70 pointer-events-none" />

      {/* Floating Gold Particles (Client-mount only to avoid SSR mismatches) */}
      {mounted && (
        <div className="absolute inset-0 z-1 pointer-events-none overflow-hidden">
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute bg-gold-primary/20 rounded-full animate-float"
              style={{
                width: `${p.size}px`,
                height: `${p.size}px`,
                left: p.left,
                top: p.top,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`
              }}
            />
          ))}
        </div>
      )}

      {/* Content Container */}
      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center justify-center mt-12">
        {/* Luxury Reviews Badge */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-6 flex items-center space-x-2 border border-gold-primary/20 bg-gold-primary/5 px-4 py-2 backdrop-blur-md"
        >
          <div className="flex space-x-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={10} className="fill-gold-primary text-gold-primary" />
            ))}
          </div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-champagne">
            4.8★ Rating | 781+ Reviews
          </span>
        </motion.div>

        {/* Headline Word-by-Word Reveal */}
        <h1 className="font-playfair text-4xl sm:text-5xl md:text-7xl text-white font-light tracking-wide leading-tight max-w-3xl">
          {headlineWords.map((word, index) => (
            <span key={index} className="inline-block overflow-hidden mr-3 md:mr-4 py-1">
              <motion.span
                className="inline-block"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{
                  duration: 0.8,
                  delay: index * 0.08,
                  ease: [0.215, 0.61, 0.355, 1.0]
                }}
              >
                {word}
              </motion.span>
            </span>
          ))}
        </h1>

        {/* Subheadline Reveal */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7, ease: "easeOut" }}
          className="text-xs sm:text-sm md:text-lg text-ivory/80 max-w-2xl font-light tracking-wide mt-6 leading-relaxed"
        >
          Kaduthuruthy&apos;s trusted destination for premium beauty, grooming, and wellness experiences.
        </motion.p>

        {/* Action CTAs with strong priority */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9, ease: "easeOut" }}
          className="mt-8 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 w-full sm:w-auto"
        >
          <a
            href="#booking"
            className="flex items-center justify-center space-x-2 text-xs uppercase tracking-[0.2em] bg-gold-primary hover:bg-gold-dark text-luxury-black font-semibold px-8 py-4 transition-all duration-300 shadow-[0_0_20px_rgba(212,175,55,0.2)]"
          >
            <Calendar size={13} />
            <span>Book Appointment</span>
          </a>
          <a
            href="tel:+919562514002"
            className="flex items-center justify-center space-x-2 text-xs uppercase tracking-[0.2em] border border-white/10 hover:border-gold-primary bg-white/5 hover:bg-white/10 text-ivory hover:text-gold-primary px-8 py-4 transition-all duration-300 backdrop-blur-sm"
          >
            <Phone size={13} />
            <span>Call Now</span>
          </a>
        </motion.div>
      </div>

      {/* Smooth Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5, y: [0, 6, 0] }}
        transition={{ delay: 1.2, duration: 2, repeat: Infinity }}
        className="absolute bottom-8 z-10 flex flex-col items-center cursor-pointer"
        onClick={() => document.getElementById("about")?.scrollIntoView({ behavior: "smooth" })}
      >
        <span className="text-[9px] uppercase tracking-[0.25em] text-ivory/50 mb-2 font-light">
          Discover Macbello
        </span>
        <ChevronDown size={12} className="text-gold-primary" />
      </motion.div>
    </section>
  );
}
