"use client";

import { useState } from "react";
import { Award, Phone, ShieldCheck, Loader2 } from "lucide-react";

export default function Loyalty() {
  const [phone, setPhone] = useState("");
  const [points, setPoints] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setPoints(null);

    // Validate phone input format (10-15 characters)
    const phoneRegex = /^\+?[0-9\s\-()]{10,15}$/;
    if (!phone.trim()) {
      setErrorMsg("Please enter your phone number.");
      return;
    } else if (!phoneRegex.test(phone)) {
      setErrorMsg("Please enter a valid phone number (10-15 digits).");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/loyalty/lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ phone })
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMsg(result.error || "Failed to look up loyalty points.");
      } else {
        setPoints(result.points);
      }
    } catch {
      setErrorMsg("A connection error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="loyalty" className="relative py-20 md:py-28 bg-luxury-black overflow-hidden border-b border-gold-primary/10">
      {/* Background ambient radial light */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(circle,rgba(212,175,55,0.03),transparent_70%)] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-[10px] md:text-xs uppercase tracking-[0.25em] text-gold-primary mb-3 font-medium block">
            Loyalty Rewards
          </span>
          <h2 className="font-playfair text-3xl md:text-4xl text-white font-light tracking-wide mb-4">
            Macbello Prestige Club
          </h2>
          <p className="text-sm text-ivory/60 leading-relaxed font-light">
            Check your prestige membership rewards balance. Enter your registered mobile number below.
          </p>
        </div>

        {/* Lookup Card */}
        <div className="max-w-xl mx-auto border border-gold-primary/15 bg-white/[0.02] backdrop-blur-md p-8 md:p-12 relative shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
          {/* Decorative Corners */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-gold-primary/45" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-gold-primary/45" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-gold-primary/45" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-gold-primary/45" />

          <form onSubmit={handleLookup} className="space-y-6">
            <div className="flex flex-col">
              <label className="text-[10px] uppercase tracking-[0.2em] text-gold-primary font-medium mb-3 flex items-center">
                <Phone size={10} className="mr-1.5" />
                <span>Registered Mobile Number *</span>
              </label>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 95625 14002"
                  className="flex-1 bg-luxury-black border border-white/10 px-4 py-3.5 text-xs tracking-wider text-white placeholder-ivory/20 rounded-none focus:outline-none focus:border-gold-primary/50 transition-colors duration-300"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="text-xs uppercase tracking-[0.2em] bg-gold-primary hover:bg-gold-dark disabled:bg-gold-primary/40 text-luxury-black font-semibold px-8 py-3.5 rounded-none transition-all duration-300 shadow-[0_5px_15px_rgba(212,175,55,0.1)] cursor-pointer flex items-center justify-center min-w-[160px]"
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin text-luxury-black mr-2" />
                  ) : (
                    <Award size={14} className="text-luxury-black mr-2" />
                  )}
                  <span>Check Points</span>
                </button>
              </div>
            </div>

            {/* Error Message rendering */}
            {errorMsg && (
              <p className="text-[11px] text-red-400 font-light tracking-wide flex items-center">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-2" />
                {errorMsg}
              </p>
            )}

            {/* Success rendering */}
            {points !== null && (
              <div className="pt-4 border-t border-white/5 mt-4 text-center">
                <div className="inline-flex flex-col items-center p-6 border border-gold-primary/20 bg-gold-primary/5">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-gold-primary font-medium mb-1">
                    Prestige Balance
                  </span>
                  <span className="font-playfair text-2xl md:text-3xl text-white font-medium tracking-wide">
                    {points} Points
                  </span>
                  <span className="text-[8px] uppercase tracking-wider text-ivory/40 mt-2 flex items-center">
                    <ShieldCheck size={10} className="text-gold-primary mr-1" /> Secure read-only lookup
                  </span>
                </div>
              </div>
            )}
          </form>
        </div>

      </div>
    </section>
  );
}
