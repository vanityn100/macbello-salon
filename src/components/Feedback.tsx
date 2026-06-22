"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Send, User, Phone, Mail, MapPin, MessageSquare, CheckCircle, XCircle } from "lucide-react";
import branchesData from "@/data/branches.json";

interface FormState {
  name: string;
  mobile: string;
  email: string;
  branch: string;
  rating: number;
  message: string;
}

const initialForm: FormState = {
  name: "",
  mobile: "",
  email: "",
  branch: "",
  rating: 0,
  message: "",
};

export default function Feedback() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.rating) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { success: boolean };
      if (data.success) {
        setStatus("success");
        setForm(initialForm);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const displayRating = hoveredRating || form.rating;

  return (
    <section
      id="feedback"
      className="relative py-20 md:py-28 bg-luxury-black overflow-hidden border-b border-gold-primary/10"
    >
      {/* Ambient background glow */}
      <div className="absolute top-[20%] right-[10%] w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(212,175,55,0.03),transparent_70%)] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[5%] w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(212,175,55,0.02),transparent_70%)] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-6 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="text-center max-w-2xl mx-auto mb-14"
        >
          <span className="text-[10px] md:text-xs uppercase tracking-[0.3em] text-gold-primary mb-4 font-medium block">
            Your Voice Matters
          </span>
          <h2 className="font-playfair text-3xl md:text-5xl text-white font-light tracking-wide mb-5">
            Customer{" "}
            <span className="text-gold-primary italic">Feedback</span>
          </h2>
          <p className="text-sm text-ivory/60 leading-relaxed font-light">
            Your experience drives our pursuit of excellence. Share your thoughts and help us continue raising the standard of luxury beauty in Kerala.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
        >
          <AnimatePresence mode="wait">
            {status === "success" ? (
              /* Success State */
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-card border border-gold-primary/20 p-14 text-center flex flex-col items-center"
              >
                <div className="p-5 bg-gold-primary/10 border border-gold-primary/30 rounded-full mb-6">
                  <CheckCircle size={40} className="text-gold-primary" />
                </div>
                <h3 className="font-playfair text-2xl text-white font-light tracking-wide mb-3">
                  Thank You for Your Feedback
                </h3>
                <p className="text-sm text-ivory/60 font-light max-w-md leading-relaxed mb-8">
                  Your response has been received and will help us deliver an even more exceptional experience at Macbello Family Salon.
                </p>
                <button
                  onClick={() => setStatus("idle")}
                  className="text-xs uppercase tracking-[0.2em] border border-gold-primary/40 hover:bg-gold-primary hover:text-luxury-black text-gold-primary px-8 py-3 transition-all duration-300 cursor-pointer"
                >
                  Submit Another
                </button>
              </motion.div>
            ) : (
              /* Form State */
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit}
                className="glass-card border border-white/5 hover:border-gold-primary/15 transition-all duration-500"
              >
                {/* Top accent */}
                <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-gold-primary/60 to-transparent" />

                <div className="p-8 md:p-12">
                  {/* Error banner */}
                  {status === "error" && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center space-x-3 bg-red-500/10 border border-red-500/20 p-4 mb-8 text-red-400"
                    >
                      <XCircle size={16} />
                      <span className="text-xs font-light">
                        Unable to send feedback. Please try again or call us directly.
                      </span>
                    </motion.div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Full Name */}
                    <div className="space-y-2">
                      <label
                        htmlFor="feedback-name"
                        className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.2em] text-gold-primary font-medium"
                      >
                        <User size={10} />
                        <span>Full Name</span>
                      </label>
                      <input
                        id="feedback-name"
                        name="name"
                        type="text"
                        value={form.name}
                        onChange={handleChange}
                        required
                        placeholder="Your name"
                        className="w-full bg-white/[0.03] border border-white/8 hover:border-white/15 focus:border-gold-primary/50 focus:outline-none px-4 py-3.5 text-sm text-ivory placeholder-ivory/30 transition-colors duration-200 font-light"
                      />
                    </div>

                    {/* Mobile Number */}
                    <div className="space-y-2">
                      <label
                        htmlFor="feedback-mobile"
                        className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.2em] text-gold-primary font-medium"
                      >
                        <Phone size={10} />
                        <span>Mobile Number</span>
                      </label>
                      <input
                        id="feedback-mobile"
                        name="mobile"
                        type="tel"
                        value={form.mobile}
                        onChange={handleChange}
                        required
                        placeholder="+91 XXXXX XXXXX"
                        className="w-full bg-white/[0.03] border border-white/8 hover:border-white/15 focus:border-gold-primary/50 focus:outline-none px-4 py-3.5 text-sm text-ivory placeholder-ivory/30 transition-colors duration-200 font-light"
                      />
                    </div>

                    {/* Email Address (optional — for confirmation) */}
                    <div className="space-y-2 md:col-span-2">
                      <label
                        htmlFor="feedback-email"
                        className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.2em] text-gold-primary font-medium"
                      >
                        <Mail size={10} />
                        <span>Email Address <span className="text-ivory/30 normal-case tracking-normal">(optional — we&apos;ll send you a thank-you)</span></span>
                      </label>
                      <input
                        id="feedback-email"
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="your@email.com"
                        className="w-full bg-white/[0.03] border border-white/8 hover:border-white/15 focus:border-gold-primary/50 focus:outline-none px-4 py-3.5 text-sm text-ivory placeholder-ivory/30 transition-colors duration-200 font-light"
                      />
                    </div>

                    {/* Branch Visited */}
                    <div className="space-y-2">
                      <label
                        htmlFor="feedback-branch"
                        className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.2em] text-gold-primary font-medium"
                      >
                        <MapPin size={10} />
                        <span>Branch Visited</span>
                      </label>
                      <select
                        id="feedback-branch"
                        name="branch"
                        value={form.branch}
                        onChange={handleChange}
                        required
                        className="w-full bg-white/[0.03] border border-white/8 hover:border-white/15 focus:border-gold-primary/50 focus:outline-none px-4 py-3.5 text-sm text-ivory transition-colors duration-200 font-light cursor-pointer appearance-none"
                        style={{ backgroundImage: "none" }}
                      >
                        <option value="" disabled className="bg-luxury-black">
                          Select a branch
                        </option>
                        {branchesData.map((b) => (
                          <option key={b.id} value={b.branch} className="bg-luxury-black">
                            {b.branch}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Star Rating */}
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.2em] text-gold-primary font-medium">
                        <Star size={10} />
                        <span>Your Rating</span>
                      </label>
                      <div className="flex items-center space-x-1 py-2.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setForm((p) => ({ ...p, rating: star }))}
                            onMouseEnter={() => setHoveredRating(star)}
                            onMouseLeave={() => setHoveredRating(0)}
                            className="transition-transform duration-150 hover:scale-110 cursor-pointer focus:outline-none"
                            aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                          >
                            <Star
                              size={28}
                              className={
                                star <= displayRating
                                  ? "fill-gold-primary text-gold-primary"
                                  : "fill-white/5 text-white/20 hover:text-gold-primary/40"
                              }
                            />
                          </button>
                        ))}
                        {form.rating > 0 && (
                          <span className="ml-3 text-xs text-ivory/50 font-light">
                            {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][form.rating]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Feedback Message */}
                  <div className="space-y-2 mb-8">
                    <label
                      htmlFor="feedback-message"
                      className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.2em] text-gold-primary font-medium"
                    >
                      <MessageSquare size={10} />
                      <span>Your Feedback</span>
                    </label>
                    <textarea
                      id="feedback-message"
                      name="message"
                      value={form.message}
                      onChange={handleChange}
                      required
                      rows={5}
                      placeholder="Tell us about your experience at Macbello..."
                      className="w-full bg-white/[0.03] border border-white/8 hover:border-white/15 focus:border-gold-primary/50 focus:outline-none px-4 py-3.5 text-sm text-ivory placeholder-ivory/30 transition-colors duration-200 font-light resize-none leading-relaxed"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <p className="text-[10px] text-ivory/30 font-light leading-relaxed max-w-xs">
                      Your feedback is private and will only be seen by the Macbello management team.
                    </p>
                    <button
                      type="submit"
                      disabled={status === "loading" || !form.rating}
                      className="flex items-center space-x-3 text-xs uppercase tracking-[0.2em] bg-gold-primary hover:bg-gold-dark disabled:opacity-40 disabled:cursor-not-allowed text-luxury-black font-semibold px-8 py-4 transition-all duration-300 shadow-[0_0_20px_rgba(212,175,55,0.15)] hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] shrink-0 cursor-pointer"
                    >
                      <Send size={13} className={status === "loading" ? "animate-pulse" : ""} />
                      <span>{status === "loading" ? "Sending…" : "Submit Feedback"}</span>
                    </button>
                  </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
