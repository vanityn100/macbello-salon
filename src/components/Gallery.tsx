"use client";

import { useState } from "react";
import { X, ZoomIn, ArrowRight, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import galleryData from "@/data/gallery.json";

const categories = [
  { name: "All", filter: "all" },
  { name: "Hair Styling", filter: "styling" },
  { name: "Hair Coloring", filter: "coloring" },
  { name: "Bridal Looks", filter: "bridal" },
  { name: "Grooming", filter: "grooming" },
  { name: "Salon Interior", filter: "interior" }
];

export default function Gallery() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // Filter gallery items
  const filteredItems = galleryData.filter(
    (item) => activeFilter === "all" || item.category === activeFilter
  );

  const openLightbox = (id: string) => {
    // Find index in filtered items to allow slider navigation in lightbox
    const idx = filteredItems.findIndex((item) => item.id === id);
    if (idx !== -1) setLightboxIdx(idx);
  };

  const closeLightbox = () => setLightboxIdx(null);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lightboxIdx !== null) {
      setLightboxIdx((prev) => (prev === 0 ? filteredItems.length - 1 : prev! - 1));
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lightboxIdx !== null) {
      setLightboxIdx((prev) => (prev === filteredItems.length - 1 ? 0 : prev! + 1));
    }
  };

  const lightboxItem = lightboxIdx !== null ? filteredItems[lightboxIdx] : null;

  return (
    <section id="gallery" className="relative py-20 md:py-28 bg-luxury-black overflow-hidden border-b border-gold-primary/10">
      {/* Background ambient light */}
      <div className="absolute top-[40%] left-[20%] w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(212,175,55,0.02),transparent_70%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-[10px] md:text-xs uppercase tracking-[0.25em] text-gold-primary mb-3 font-medium block">
            Gallery
          </span>
          <h2 className="font-playfair text-3xl md:text-4xl text-white font-light tracking-wide mb-6">
            Luxury Portfolio
          </h2>
          <p className="text-sm text-ivory/60 leading-relaxed font-light">
            Browse our collection of custom works and get inspired for your next transformation at Macbello.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-12 border-b border-white/5 pb-6">
          {categories.map((cat) => (
            <button
              key={cat.filter}
              onClick={() => {
                setActiveFilter(cat.filter);
                closeLightbox();
              }}
              className={`text-[10px] md:text-xs uppercase tracking-[0.15em] px-4 py-2 border transition-all duration-300 rounded-none cursor-pointer ${
                activeFilter === cat.filter
                  ? "border-gold-primary text-gold-primary bg-gold-primary/5"
                  : "border-white/5 text-ivory/60 hover:text-ivory hover:border-white/20 bg-transparent"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Masonry Layout Grid */}
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item, idx) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                onClick={() => openLightbox(item.id)}
                className="relative overflow-hidden border border-white/5 bg-white/[0.01] hover:border-gold-primary/30 group cursor-pointer break-inside-avoid shadow-[0_10px_20px_rgba(0,0,0,0.4)]"
              >
                {/* Image Wrap */}
                <div className="relative overflow-hidden w-full aspect-[4/3]">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    loading="lazy"
                    className="object-cover group-hover:scale-105 transition-transform duration-700 filter brightness-95 group-hover:brightness-100"
                  />
                  {/* Hover Overlay Icon */}
                  <div className="absolute inset-0 bg-luxury-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="p-3 border border-gold-primary/50 text-gold-primary bg-luxury-dark/80 scale-75 group-hover:scale-100 transition-transform duration-300">
                      <ZoomIn size={18} />
                    </div>
                  </div>
                </div>

                {/* Card Info */}
                <div className="p-5 border-t border-white/5">
                  <span className="text-[8px] uppercase tracking-[0.2em] text-gold-primary font-medium">
                    {item.category}
                  </span>
                  <h3 className="font-playfair text-sm text-white font-medium mt-1 tracking-wide">
                    {item.title}
                  </h3>
                  <p className="text-[10px] text-ivory/50 leading-relaxed font-light mt-1.5 truncate">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

      </div>

      {/* Lightbox Overlay */}
      <AnimatePresence>
        {lightboxIdx !== null && lightboxItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-luxury-black/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4"
            onClick={closeLightbox}
          >
            {/* Close Button */}
            <button
              onClick={closeLightbox}
              className="absolute top-6 right-6 p-2 text-ivory/60 hover:text-gold-primary transition-colors cursor-pointer z-50"
              aria-label="Close lightbox"
            >
              <X size={24} />
            </button>

            {/* Slider Navigation Buttons */}
            <button
              onClick={handlePrev}
              className="absolute left-6 top-1/2 -translate-y-1/2 p-3 border border-white/10 hover:border-gold-primary text-ivory hover:text-gold-primary transition-all duration-300 z-50 rounded-none cursor-pointer"
              aria-label="Previous image"
            >
              <ArrowLeft size={16} />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-6 top-1/2 -translate-y-1/2 p-3 border border-white/10 hover:border-gold-primary text-ivory hover:text-gold-primary transition-all duration-300 z-50 rounded-none cursor-pointer"
              aria-label="Next image"
            >
              <ArrowRight size={16} />
            </button>

            {/* Lightbox Canvas Card */}
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative max-w-4xl w-full border border-gold-primary/20 bg-luxury-black p-3 md:p-5 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Media image container */}
              <div className="relative aspect-[4/3] md:aspect-[16/10] bg-zinc-950 overflow-hidden">
                <Image
                  src={lightboxItem.image}
                  alt={lightboxItem.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 896px"
                  className="object-contain pointer-events-none"
                />
              </div>

              {/* Media descriptors */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between pt-4 border-t border-white/5 mt-3 gap-2">
                <div>
                  <span className="text-[9px] uppercase tracking-[0.25em] text-gold-primary font-semibold">
                    {lightboxItem.category}
                  </span>
                  <h4 className="font-playfair text-base md:text-lg text-white font-medium tracking-wide">
                    {lightboxItem.title}
                  </h4>
                  <p className="text-xs text-ivory/60 leading-relaxed font-light mt-1">
                    {lightboxItem.description}
                  </p>
                </div>
                
                <a
                  href="#booking"
                  onClick={closeLightbox}
                  className="text-center text-xs uppercase tracking-[0.2em] bg-gold-primary hover:bg-gold-dark text-luxury-black font-semibold px-6 py-3.5 rounded-none shrink-0"
                >
                  Book Makeover
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </section>
  );
}
