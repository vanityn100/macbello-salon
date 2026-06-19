"use client";

import { useEffect, useRef, useState } from "react";
import { Star, Users, Award, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

interface StatItem {
  id: string;
  label: string;
  targetValue: number;
  suffix: string;
  isFloat?: boolean;
  icon: React.ComponentType<{ size: number; className?: string }>;
}

const statsData: StatItem[] = [
  {
    id: "clients",
    label: "Total Reviews",
    targetValue: 1626,
    suffix: "+",
    icon: Users
  },
  {
    id: "rating",
    label: "Avg. Google Rating",
    targetValue: 4.8,
    suffix: "★",
    isFloat: true,
    icon: Star
  },
  {
    id: "branches",
    label: "Salon Branches",
    targetValue: 3,
    suffix: "",
    icon: ShieldCheck
  },
  {
    id: "experience",
    label: "Years of Excellence",
    targetValue: 10,
    suffix: "+",
    icon: Award
  }
];

function CountUpNumber({ targetValue, suffix, isFloat }: { targetValue: number; suffix: string; isFloat?: boolean }) {
  const [count, setCount] = useState(0);
  const elementRef = useRef<HTMLSpanElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          let startTimestamp: number | null = null;
          const duration = 1500; // Animation duration in ms

          const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const elapsed = timestamp - startTimestamp;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function outQuad
            const easeProgress = progress * (2 - progress);
            
            const currentValue = isFloat 
              ? parseFloat((easeProgress * targetValue).toFixed(1))
              : Math.floor(easeProgress * targetValue);

            setCount(currentValue);

            if (progress < 1) {
              window.requestAnimationFrame(step);
            } else {
              setCount(targetValue);
            }
          };

          window.requestAnimationFrame(step);
        }
      },
      { threshold: 0.1 }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, [targetValue, isFloat, hasAnimated]);

  return (
    <span ref={elementRef} className="font-playfair text-3xl md:text-5xl font-light text-gold-primary">
      {isFloat ? count.toFixed(1) : count}
      <span className="text-gold-light font-normal">{suffix}</span>
    </span>
  );
}

export default function Stats() {
  return (
    <section className="relative py-16 md:py-24 bg-luxury-black border-b border-gold-primary/10 overflow-hidden">
      {/* Background radial soft light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[radial-gradient(circle,rgba(212,175,55,0.03),transparent_70%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          {statsData.map((stat, idx) => {
            const IconComponent = stat.icon;
            return (
              <motion.div
                key={stat.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.15, ease: "easeOut" }}
                className="flex flex-col items-center justify-center p-6 text-center border border-white/5 bg-white/[0.02] backdrop-blur-md relative group hover:border-gold-primary/20 transition-all duration-300"
              >
                {/* Gold glowing hover corner */}
                <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-gold-primary/0 group-hover:border-gold-primary/40 transition-all duration-300" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-gold-primary/0 group-hover:border-gold-primary/40 transition-all duration-300" />

                {/* Icon Circle */}
                <div className="mb-4 p-3 bg-gold-primary/5 rounded-full border border-gold-primary/10 group-hover:border-gold-primary/30 group-hover:bg-gold-primary/10 transition-all duration-300">
                  <IconComponent size={20} className="text-gold-primary" />
                </div>

                {/* Counting Metric */}
                <CountUpNumber
                  targetValue={stat.targetValue}
                  suffix={stat.suffix}
                  isFloat={stat.isFloat}
                />

                {/* Label */}
                <span className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-ivory/60 mt-3 font-light">
                  {stat.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
