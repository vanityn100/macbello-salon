"use client";

import { useState, useEffect, useRef } from "react";
import { X, ZoomIn, ArrowRight, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getGalleryItems, GalleryItem } from "@/lib/gallery/getGalleryItems";

const categories = [
  { name: "All", filter: "all" },
  { name: "Hair Styling", filter: "styling" },
  { name: "Hair Coloring", filter: "coloring" },
  { name: "Bridal Looks", filter: "bridal" },
  { name: "Grooming", filter: "grooming" },
  { name: "Salon Interior", filter: "interior" }
];

function VideoCard({ item, onClick }: { item: GalleryItem; onClick: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    observer.observe(video);
    return () => {
      observer.unobserve(video);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isIntersecting) {
      // Lazy load video src
      if (!video.src && item.video) {
        video.src = item.video;
      }
      video.play().catch(() => {
        // Handle blocked autoplay gracefully
      });
    } else {
      video.pause();
    }
  }, [isIntersecting, item.video]);

  return (
    <div
      onClick={onClick}
      className="relative overflow-hidden border border-white/5 bg-white/[0.01] hover:border-gold-primary/30 group cursor-pointer shadow-[0_10px_20px_rgba(0,0,0,0.4)] aspect-[4/3] w-full"
    >
      <video
        ref={videoRef}
        poster={item.thumbnail}
        muted
        loop
        playsInline
        preload="none"
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 filter brightness-95 group-hover:brightness-100"
      />
      {/* Glassmorphic Play Overlay */}
      <div className="absolute inset-0 bg-luxury-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
        <div className="p-3 border border-gold-primary/50 text-gold-primary bg-luxury-dark/80 backdrop-blur-md scale-75 group-hover:scale-100 transition-transform duration-300">
          <ZoomIn size={18} />
        </div>
      </div>
    </div>
  );
}

export default function Gallery() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const galleryItems = getGalleryItems();
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Filter gallery items
  const filteredItems = galleryItems.filter(
    (item) => activeFilter === "all" || item.category === activeFilter
  );

  const openLightbox = (id: string, e: React.MouseEvent) => {
    triggerRef.current = e.currentTarget as HTMLElement;
    const idx = filteredItems.findIndex((item) => item.id === id);
    if (idx !== -1) setLightboxIdx(idx);
  };

  const closeLightbox = () => {
    setLightboxIdx(null);
    // Return focus to the trigger element for accessibility
    setTimeout(() => {
      triggerRef.current?.focus();
    }, 50);
  };

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

  // Keyboard navigation & Focus trapping
  useEffect(() => {
    if (lightboxIdx === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeLightbox();
        return;
      }
      if (e.key === "ArrowLeft") {
        setLightboxIdx((prev) => (prev === 0 ? filteredItems.length - 1 : prev! - 1));
        return;
      }
      if (e.key === "ArrowRight") {
        setLightboxIdx((prev) => (prev === filteredItems.length - 1 ? 0 : prev! + 1));
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'a[href], button, video, [tabindex="0"]'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    
    // Focus first focusable element inside modal on open
    setTimeout(() => {
      const firstFocusable = modalRef.current?.querySelector('[aria-label="Close lightbox"]') as HTMLElement;
      firstFocusable?.focus();
    }, 50);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIdx, filteredItems]);

  const lightboxItem = lightboxIdx !== null ? filteredItems[lightboxIdx] : null;

  return (
    <section id="portfolio" className="relative py-10 md:py-28 bg-luxury-black overflow-hidden border-b border-gold-primary/10">
      {/* Background ambient light */}
      <div className="absolute top-[40%] left-[20%] w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(212,175,55,0.02),transparent_70%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-[10px] md:text-xs uppercase tracking-[0.25em] text-gold-primary mb-3 font-medium block">
            Portfolio
          </span>
          <h2 className="font-playfair text-3xl md:text-4xl text-white font-light tracking-wide mb-6">
            Luxury Showcase
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

        {/* Grid Layout Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item, idx) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className={`w-full focus:outline-none focus:ring-1 focus:ring-gold-primary ${
                  !expanded && idx >= 4 ? "max-md:hidden" : ""
                }`}
                tabIndex={0}
                role="button"
                aria-label={`View ${item.category} showcase video`}
                onClick={(e) => openLightbox(item.id, e)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openLightbox(item.id, e as unknown as React.MouseEvent);
                  }
                }}
              >
                <VideoCard item={item} onClick={() => {}} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Mobile View Full Gallery Toggle Button */}
        {!expanded && filteredItems.length > 4 && (
          <div className="mt-8 text-center md:hidden">
            <button
              onClick={() => setExpanded(true)}
              className="inline-block text-xs uppercase tracking-[0.2em] border border-gold-primary/30 hover:border-gold-primary bg-transparent text-gold-primary hover:text-luxury-black hover:bg-gold-primary px-8 py-3 transition-all duration-300 cursor-pointer"
            >
              View Full Gallery
            </button>
          </div>
        )}

      </div>

      {/* Lightbox Overlay */}
      <AnimatePresence>
        {lightboxIdx !== null && lightboxItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-luxury-black/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Video details lightbox"
            onClick={closeLightbox}
          >
            {/* Focus Trap Container */}
            <div
              ref={modalRef}
              className="relative max-w-4xl w-full border border-gold-primary/20 bg-luxury-black p-3 md:p-5 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={closeLightbox}
                className="absolute -top-12 right-0 p-2 text-ivory/60 hover:text-gold-primary transition-colors cursor-pointer z-50 focus:outline-none focus:ring-1 focus:ring-gold-primary"
                aria-label="Close lightbox"
              >
                <X size={24} />
              </button>

              {/* Slider Navigation Buttons */}
              <button
                onClick={handlePrev}
                className="absolute -left-4 md:left-6 top-1/2 -translate-y-1/2 p-3 border border-white/10 hover:border-gold-primary text-ivory hover:text-gold-primary bg-luxury-black/80 backdrop-blur-md transition-all duration-300 z-50 rounded-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-gold-primary"
                aria-label="Previous video"
              >
                <ArrowLeft size={16} />
              </button>
              <button
                onClick={handleNext}
                className="absolute -right-4 md:right-6 top-1/2 -translate-y-1/2 p-3 border border-white/10 hover:border-gold-primary text-ivory hover:text-gold-primary bg-luxury-black/80 backdrop-blur-md transition-all duration-300 z-50 rounded-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-gold-primary"
                aria-label="Next video"
              >
                <ArrowRight size={16} />
              </button>

              {/* Media video container */}
              <div className="relative aspect-[4/3] md:aspect-[16/10] bg-zinc-950 overflow-hidden">
                <video
                  key={lightboxItem.video}
                  src={lightboxItem.video}
                  poster={lightboxItem.thumbnail}
                  autoPlay
                  controls
                  controlsList="nodownload"
                  disablePictureInPicture
                  className="w-full h-full object-contain focus:outline-none"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </section>
  );
}
