"use client";

import { useState, useRef, useEffect } from "react";
import { MoveHorizontal, Maximize2, X, Info, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import transformationsData from "@/data/transformations.json";

export default function BeforeAfter() {
  const [activeCategory, setActiveCategory] = useState("Hair Styling");
  const [sliderPosition, setSliderPosition] = useState(50); // percentage (0 - 100)
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);

  const activeData = transformationsData.find(
    (item) => item.category === activeCategory
  ) || transformationsData[0];

  // Drag coordinates calculator
  const handleMove = (clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    handleMove(e.clientX, containerRef.current.getBoundingClientRect());
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !containerRef.current) return;
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX, containerRef.current.getBoundingClientRect());
    }
  };

  // Fullscreen event trackers
  const onFullscreenMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !fullscreenContainerRef.current) return;
    handleMove(e.clientX, fullscreenContainerRef.current.getBoundingClientRect());
  };

  const onFullscreenTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !fullscreenContainerRef.current) return;
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX, fullscreenContainerRef.current.getBoundingClientRect());
    }
  };

  // Global releases
  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchend", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, []);

  return (
    <section id="transformations" className="relative py-10 md:py-28 bg-luxury-black overflow-hidden border-b border-gold-primary/10">
      {/* Background soft light */}
      <div className="absolute bottom-10 right-1/2 translate-x-1/2 w-[700px] h-[350px] bg-[radial-gradient(circle,rgba(212,175,55,0.01),transparent_70%)] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-[10px] md:text-xs uppercase tracking-[0.25em] text-gold-primary mb-3 font-medium block">
            Transformations
          </span>
          <h2 className="font-playfair text-3xl md:text-4xl text-white font-light tracking-wide mb-6">
            Before & After Showcase
          </h2>
          <p className="text-xs text-ivory/60 leading-relaxed font-light">
            Real results from our elite stylists. Slide the gold divider left and right to inspect the details of each aesthetic transformation.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10 border-b border-white/5 pb-6">
          {transformationsData.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveCategory(item.category);
                setSliderPosition(50);
              }}
              className={`text-[10px] md:text-xs uppercase tracking-[0.15em] px-4 py-2 border transition-all duration-300 rounded-none cursor-pointer ${
                activeCategory === item.category
                  ? "border-gold-primary text-gold-primary bg-gold-primary/5"
                  : "border-white/5 text-ivory/60 hover:text-ivory hover:border-white/20 bg-transparent"
              }`}
            >
              {item.category}
            </button>
          ))}
        </div>

        {/* Interactive Comparison Module */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Slider Container */}
          <div className="lg:col-span-8 flex flex-col items-center">
            <div
              ref={containerRef}
              onMouseMove={onMouseMove}
              onTouchMove={onTouchMove}
              className="relative w-full aspect-[4/3] md:aspect-[16/10] bg-zinc-950 overflow-hidden border border-white/10 select-none cursor-ew-resize group shadow-[0_15px_40px_rgba(0,0,0,0.6)]"
            >
              {/* "Before" Image */}
              <Image
                src={activeData.before}
                alt="Before style transformation"
                fill
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover pointer-events-none"
              />
              <span className="absolute bottom-4 left-4 z-10 text-[9px] uppercase tracking-[0.2em] font-medium bg-black/85 border border-white/10 px-2.5 py-1 text-ivory/70 select-none">
                Before
              </span>

              {/* "After" Image (Overlay wrapper, clipped width) */}
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ width: `${sliderPosition}%` }}
              >
                <div className="absolute inset-0 w-full h-full aspect-[4/3] md:aspect-[16/10] min-w-[300px]">
                  <Image
                    src={activeData.after}
                    alt="After style transformation"
                    fill
                    sizes="(max-width: 1024px) 100vw, 60vw"
                    className="object-cover pointer-events-none max-w-none"
                  />
                </div>
              </div>
              <span className="absolute bottom-4 right-4 z-10 text-[9px] uppercase tracking-[0.2em] font-medium bg-gold-primary text-luxury-black px-2.5 py-1 font-semibold select-none">
                After
              </span>

              {/* Slider Divider Line */}
              <div
                className="absolute top-0 bottom-0 w-[1px] bg-gold-primary/80 z-20 pointer-events-none"
                style={{ left: `${sliderPosition}%` }}
              />

              {/* Slider Drag Handle */}
              <div
                onMouseDown={() => setIsDragging(true)}
                onTouchStart={() => setIsDragging(true)}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full border border-gold-primary bg-luxury-dark/95 text-gold-primary flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.4)] z-30 transition-transform duration-200 hover:scale-110 active:scale-95"
                style={{ left: `${sliderPosition}%` }}
              >
                <MoveHorizontal size={16} />
              </div>

              {/* Fullscreen Trigger */}
              <button
                onClick={() => setIsFullscreen(true)}
                className="absolute top-4 right-4 p-2 bg-luxury-black/60 hover:bg-gold-primary hover:text-luxury-black text-white border border-white/10 transition-colors duration-300 z-10 rounded-none cursor-pointer"
                aria-label="Fullscreen view"
              >
                <Maximize2 size={12} />
              </button>
            </div>

            <span className="text-[9px] text-ivory/40 uppercase tracking-[0.2em] mt-3 flex items-center space-x-1.5 font-light select-none">
              <Info size={10} className="text-gold-primary/50" />
              <span>Drag the gold circle horizontally to compare details</span>
            </span>
          </div>

          {/* Details Box */}
          <div className="lg:col-span-4 flex flex-col justify-center">
            <span className="text-[8px] uppercase tracking-[0.25em] text-gold-primary font-semibold mb-2 block">
              Transformation Details
            </span>
            <h3 className="font-playfair text-xl md:text-2xl text-white font-light mb-4 tracking-wide leading-tight">
              {activeData.title}
            </h3>
            <p className="text-xs md:text-sm text-ivory/70 leading-relaxed font-light mb-6">
              {activeData.details}
            </p>
            <div className="p-5 border border-white/5 bg-white/[0.01]">
              <span className="text-[9px] uppercase tracking-[0.2em] text-gold-light block font-semibold mb-2">
                Styling Protocol Included:
              </span>
              <ul className="space-y-1.5">
                <li className="text-[10px] text-ivory/80 font-light flex items-center space-x-2">
                  <span className="w-1 h-1 bg-gold-primary rounded-full" />
                  <span>Personal Consultation & Mapping</span>
                </li>
                <li className="text-[10px] text-ivory/80 font-light flex items-center space-x-2">
                  <span className="w-1 h-1 bg-gold-primary rounded-full" />
                  <span>Premium Organic Styling Products</span>
                </li>
                <li className="text-[10px] text-ivory/80 font-light flex items-center space-x-2">
                  <span className="w-1 h-1 bg-gold-primary rounded-full" />
                  <span>Post-styling restorative lock wash</span>
                </li>
              </ul>
            </div>
            
            {/* Direct Book CTA in transformations column */}
            <a
              href="#booking"
              className="mt-8 text-center text-xs uppercase tracking-[0.2em] bg-gold-primary hover:bg-gold-dark text-luxury-black font-semibold py-3.5 transition-all duration-300 flex items-center justify-center space-x-2"
            >
              <Calendar size={12} />
              <span>Book This Treatment</span>
            </a>
          </div>

        </div>

      </div>

      {/* Fullscreen Lightbox Overlay Modal */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-luxury-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            {/* Close trigger overlay */}
            <div className="absolute inset-0" onClick={() => setIsFullscreen(false)} />

            {/* Modal Inner Container */}
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative w-full max-w-4xl bg-luxury-black border border-gold-primary/20 p-4 md:p-6 shadow-[0_20px_50px_rgba(212,175,55,0.1)] z-10 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setIsFullscreen(false)}
                className="absolute -top-12 right-0 p-2 text-ivory/60 hover:text-gold-primary transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X size={24} />
              </button>

              <div className="flex justify-between items-center mb-4">
                <h4 className="font-playfair text-xs md:text-sm text-white font-medium">
                  {activeCategory} Transformation Detail
                </h4>
                <span className="text-[9px] text-gold-primary uppercase tracking-widest font-semibold font-playfair">
                  Macbello Family Salon
                </span>
              </div>

              {/* Fullscreen Slider Canvas */}
              <div
                ref={fullscreenContainerRef}
                onMouseMove={onFullscreenMouseMove}
                onTouchMove={onFullscreenTouchMove}
                className="relative w-full aspect-[4/3] md:aspect-[16/10] bg-zinc-950 border border-white/5 overflow-hidden select-none cursor-ew-resize"
              >
                {/* Before Image */}
                <Image
                  src={activeData.before}
                  alt="Before style transformation"
                  fill
                  sizes="90vw"
                  className="object-cover pointer-events-none"
                />
                <span className="absolute bottom-4 left-4 z-10 text-[9px] uppercase tracking-[0.2em] font-semibold bg-black/75 px-3 py-1 text-ivory/70">
                  Before
                </span>

                {/* After Image */}
                <div
                  className="absolute inset-0 overflow-hidden pointer-events-none"
                  style={{ width: `${sliderPosition}%` }}
                >
                  <div className="absolute inset-0 w-full h-full aspect-[4/3] md:aspect-[16/10] min-w-[300px]">
                    <Image
                      src={activeData.after}
                      alt="After style transformation"
                      fill
                      sizes="90vw"
                      className="object-cover pointer-events-none max-w-none"
                    />
                  </div>
                </div>
                <span className="absolute bottom-4 right-4 z-10 text-[9px] uppercase tracking-[0.2em] font-semibold bg-gold-primary text-luxury-black px-3 py-1">
                  After
                </span>

                {/* Divider Line */}
                <div
                  className="absolute top-0 bottom-0 w-[1px] bg-gold-primary/80 z-20 pointer-events-none"
                  style={{ left: `${sliderPosition}%` }}
                />

                {/* Drag Handle */}
                <div
                  onMouseDown={() => setIsDragging(true)}
                  onTouchStart={() => setIsDragging(true)}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-12 h-12 rounded-full border border-gold-primary bg-luxury-dark/95 text-gold-primary flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.4)] z-30"
                  style={{ left: `${sliderPosition}%` }}
                >
                  <MoveHorizontal size={18} />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </section>
  );
}
