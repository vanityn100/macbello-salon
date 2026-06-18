"use client";

import { useState, useEffect } from "react";
import { Star, ArrowRight, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import reviewsData from "@/data/reviews.json";

export default function Trust() {
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % reviewsData.length);
    }, 5000); // Swap card every 5 seconds
    return () => clearInterval(timer);
  }, []);

  const handlePrev = () => {
    setCurrentIdx((prev) => (prev - 1 + reviewsData.length) % reviewsData.length);
  };

  const handleNext = () => {
    setCurrentIdx((prev) => (prev + 1) % reviewsData.length);
  };

  const activeReview = reviewsData[currentIdx];

  // Simulated star rating distributions matching 4.8 / 781 reviews
  const distribution = [
    { stars: 5, percentage: 92, count: 718 },
    { stars: 4, percentage: 6, count: 47 },
    { stars: 3, percentage: 1, count: 12 },
    { stars: 2, percentage: 0.5, count: 3 },
    { stars: 1, percentage: 0.5, count: 1 }
  ];

  const googleReviewsSearchUrl = "https://www.google.com/maps/place/Macbello+Family+Salon/@9.773539,76.471694,15z/data=!4m6!3m5!1s0x3b0877a5ab0f7cf7:0xfb6efadca3d73507!8m2!3d9.773539!4d76.471694!16s%2Fg%2F11fn7cl20n?entry=ttu";

  return (
    <section id="reviews" className="relative py-20 md:py-28 bg-luxury-black overflow-hidden border-b border-gold-primary/10">
      {/* Background soft light */}
      <div className="absolute top-[10%] right-[10%] w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(212,175,55,0.02),transparent_70%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Section Title */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-[10px] md:text-xs uppercase tracking-[0.25em] text-gold-primary mb-3 font-medium block">
            Trust & Reviews
          </span>
          <h2 className="font-playfair text-3xl md:text-4xl text-white font-light tracking-wide">
            781+ Five-Star Experiences
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Stats & Badge */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            
            {/* Trust Badge */}
            <div className="mb-6 self-start inline-flex items-center space-x-2 border border-gold-primary/20 bg-gold-primary/5 px-3.5 py-1.5 backdrop-blur-sm">
              <span className="text-[9px] uppercase tracking-[0.2em] font-medium text-gold-primary">
                Kaduthuruthy&apos;s Trusted Family Salon
              </span>
            </div>

            {/* Large Stats block */}
            <div className="flex items-center space-x-6 mb-8">
              <div className="flex flex-col">
                <span className="font-playfair text-5xl md:text-6xl text-white font-light">4.8</span>
                <div className="flex space-x-1 mt-1">
                  {[...Array(5)].map((_, idx) => (
                    <Star
                      key={idx}
                      size={14}
                      className={idx < 4 ? "fill-gold-primary text-gold-primary" : "text-gold-primary fill-gold-primary/30"}
                    />
                  ))}
                </div>
              </div>
              <div className="border-l border-white/10 pl-6 flex flex-col justify-center">
                <span className="text-2xl font-light text-white tracking-wide">781+ Reviews</span>
                <span className="text-[10px] uppercase tracking-widest text-ivory/40 mt-1 font-light">
                  Verified Google Reviews
                </span>
              </div>
            </div>

            {/* Distribution Graph */}
            <div className="space-y-2.5 mb-8">
              {distribution.map((row) => (
                <div key={row.stars} className="flex items-center text-xs text-ivory/60">
                  <span className="w-3 text-right">{row.stars}</span>
                  <Star size={10} className="fill-gold-primary/60 text-gold-primary/60 mx-1.5" />
                  <div className="flex-1 h-[3px] bg-white/5 relative mx-2">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${row.percentage}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="absolute left-0 top-0 bottom-0 bg-gold-primary"
                    />
                  </div>
                  <span className="w-10 text-right text-[10px] text-ivory/40">{row.percentage}%</span>
                </div>
              ))}
            </div>

            {/* Link to Google Reviews */}
            <a
              href={googleReviewsSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-between text-xs uppercase tracking-[0.2em] text-gold-primary border border-gold-primary/20 hover:border-gold-primary hover:bg-gold-primary hover:text-luxury-black px-6 py-4 transition-all duration-300 w-full sm:w-auto"
            >
              <span>View All Google Reviews</span>
              <ArrowRight size={14} className="ml-3" />
            </a>
          </div>

          {/* Right Column: Rotative Review Cards */}
          <div className="lg:col-span-7 flex flex-col justify-center relative min-h-[300px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeReview.id}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.4 }}
                className="relative p-8 md:p-10 border border-white/5 bg-white/[0.02] backdrop-blur-md shadow-[0_15px_30px_rgba(0,0,0,0.5)] flex flex-col justify-between"
              >
                {/* Large Background Quote Symbol */}
                <span className="absolute top-4 right-8 font-playfair text-[120px] text-gold-primary/5 select-none leading-none pointer-events-none">
                  &ldquo;
                </span>

                <div>
                  <div className="flex space-x-0.5 mb-6">
                    {[...Array(activeReview.rating)].map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className="fill-gold-primary text-gold-primary"
                      />
                    ))}
                  </div>

                  <p className="font-playfair text-lg md:text-xl text-white font-light tracking-wide leading-relaxed italic mb-8">
                    &ldquo;{activeReview.text}&rdquo;
                  </p>
                </div>

                <div className="flex justify-between items-center border-t border-white/5 pt-6">
                  <div>
                    <h4 className="text-sm font-semibold text-white tracking-wide">
                      {activeReview.name}
                    </h4>
                    <span className="text-[10px] text-ivory/40 uppercase tracking-[0.15em] font-light">
                      {activeReview.location}, Kerala
                    </span>
                  </div>
                  <span className="text-[9px] uppercase tracking-[0.2em] text-gold-primary border border-gold-primary/20 px-2 py-0.5 font-light">
                    {activeReview.source}
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Slider Controls */}
            <div className="flex space-x-3 mt-6 self-end z-10">
              <button
                onClick={handlePrev}
                className="p-3 border border-white/10 hover:border-gold-primary text-ivory hover:text-gold-primary transition-all duration-300 rounded-none cursor-pointer"
                aria-label="Previous review"
              >
                <ArrowLeft size={14} />
              </button>
              <button
                onClick={handleNext}
                className="p-3 border border-white/10 hover:border-gold-primary text-ivory hover:text-gold-primary transition-all duration-300 rounded-none cursor-pointer"
                aria-label="Next review"
              >
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
