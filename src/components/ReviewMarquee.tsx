"use client";

import { Star } from "lucide-react";

const marqueeItems = [
  "Amazing service and atmosphere",
  "Professional and friendly staff",
  "Best salon experience in Kaduthuruthy",
  "World-class hair botox treatment",
  "Extremely hygienic and family-friendly",
  "The bridal makeover was absolutely stunning",
  "Very skilled stylists and great consultations",
  "Premium products and affordable luxury"
];

export default function ReviewMarquee() {
  // Double the list to create a seamless infinite loop
  const items = [...marqueeItems, ...marqueeItems, ...marqueeItems];

  return (
    <div className="relative w-full overflow-hidden bg-luxury-dark border-y border-gold-primary/10 py-3 md:py-4 z-20">
      {/* Vignette Overlay (Glow fade at edges) */}
      <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-luxury-black to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-luxury-black to-transparent z-10 pointer-events-none" />

      <div className="flex w-max animate-marquee whitespace-nowrap">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center mx-8 md:mx-12 select-none">
            {/* 5 Gold Stars */}
            <div className="flex space-x-0.5 mr-3">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={12}
                  className="fill-gold-primary text-gold-primary"
                />
              ))}
            </div>
            <span className="text-[10px] md:text-xs uppercase tracking-[0.2em] font-medium text-ivory/80">
              {item}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
