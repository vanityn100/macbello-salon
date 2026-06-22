"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";
import Trust from "@/components/Trust";
import { Star } from "lucide-react";
import reviewsData from "@/data/reviews.json";
import { motion } from "framer-motion";

export default function ReviewsPage() {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <FloatingActions />
      <Navbar />
      <main className="flex flex-col min-h-screen pt-24 bg-luxury-black">
        {/* Page Header */}
        <section className="relative py-12 md:py-16 bg-luxury-black overflow-hidden border-b border-gold-primary/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.03),transparent_70%)] pointer-events-none" />
          <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
            <span className="text-[10px] md:text-xs uppercase tracking-[0.25em] text-gold-primary mb-3 font-medium block">
              Testimonials
            </span>
            <h1 className="font-playfair text-4xl md:text-5xl text-white font-light tracking-wide mb-4">
              What Our Clients Say
            </h1>
            <p className="text-sm md:text-base text-ivory/60 max-w-2xl mx-auto leading-relaxed font-light">
              Read verified testimonials and experience logs from our premium clientele.
            </p>
          </div>
        </section>

        {/* Aggregate trust dashboard section */}
        <Trust />

        {/* Detailed reviews grid */}
        <section className="py-16 md:py-20 bg-luxury-black relative z-10 border-b border-gold-primary/10">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="font-playfair text-2xl md:text-3xl text-white font-light tracking-wide mb-12 text-center">
              Verified Client Feedbacks
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {reviewsData.map((review, idx) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className={`relative p-6 md:p-8 border border-white/5 bg-white/[0.01] hover:border-gold-primary/20 transition-all duration-300 flex flex-col justify-between ${
                    !expanded && idx >= 3 ? "max-md:hidden" : ""
                  }`}
                >
                  <div>
                    <div className="flex space-x-0.5 mb-4">
                      {[...Array(review.rating)].map((_, i) => (
                        <Star
                          key={i}
                          size={12}
                          className="fill-gold-primary text-gold-primary"
                        />
                      ))}
                    </div>
                    <p className="font-playfair text-sm md:text-base text-white/90 leading-relaxed font-light mb-6 italic">
                      &ldquo;{review.text}&rdquo;
                    </p>
                  </div>

                  <div className="flex justify-between items-center border-t border-white/5 pt-4 mt-auto">
                    <div>
                      <h4 className="text-xs font-semibold text-white tracking-wide">
                        {review.name}
                      </h4>
                      <span className="text-[9px] text-ivory/40 uppercase tracking-[0.15em] font-light">
                        {review.location}, Kerala
                      </span>
                    </div>
                    <span className="text-[9px] text-ivory/30">{review.date}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Mobile Expand Button */}
            {!expanded && reviewsData.length > 3 && (
              <div className="mt-8 text-center md:hidden">
                <button
                  onClick={() => setExpanded(true)}
                  className="inline-block text-xs uppercase tracking-[0.2em] border border-gold-primary/30 hover:border-gold-primary bg-transparent text-gold-primary hover:text-luxury-black hover:bg-gold-primary px-8 py-3 transition-all duration-300 cursor-pointer"
                >
                  Read All Reviews
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
