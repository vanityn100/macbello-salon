"use client";

import { useState } from "react";
import { Calendar, Clock, MessageSquare, Sparkles, User, Phone, Mail, X, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import servicesData from "@/data/services.json";

export default function Booking() {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    branch: "",
    service: "",
    date: "",
    time: "",
    message: "",
    consent: false
  });

  // Honeypot: bots fill this, real users never see it (positioned off-screen, not display:none)
  const [honeypot, setHoneypot] = useState("");

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Simple client-side validation
  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) newErrors.name = "Please enter your name.";
    
    // Simple Indian phone number validation (typically starts with 6-9, 10 digits)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!formData.phone.trim()) {
      newErrors.phone = "Please enter your phone number.";
    } else if (!phoneRegex.test(formData.phone.replace(/[\s-+]/g, ""))) {
      newErrors.phone = "Please enter a valid 10-digit mobile number.";
    }

    // Optional email validation
    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = "Please enter a valid email address.";
      }
    }

    if (!formData.branch) newErrors.branch = "Please select a branch.";
    if (!formData.service) newErrors.service = "Please select a service.";
    if (!formData.date) newErrors.date = "Please select a preferred date.";
    if (!formData.time) newErrors.time = "Please select a preferred time.";
    if (!formData.consent) newErrors.consent = "You must agree to the Privacy Policy and Terms & Conditions.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target;
    const name = target.name;
    const value = target.type === "checkbox" ? (target as HTMLInputElement).checked : target.value;

    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error on change
    if (errors[name]) {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot check: if this hidden field is filled, it's a bot — silently do nothing
    if (honeypot) return;

    if (!validate()) return;

    // Map branch names to their specific WhatsApp numbers
    const branchPhones: { [key: string]: string } = {
      Kaduthuruthy: "919562514002",
      Ettumanoor: "919746914003",
      Peruva: "919544814003"
    };

    const targetPhone = branchPhones[formData.branch] || "919562514002";

    // Construct WhatsApp message
    const serviceName = servicesData.find((s) => s.id === formData.service)?.name || formData.service;
    const formattedMessage = `Hello Macbello Family Salon (${formData.branch}), I'd like to book an appointment.
*Name:* ${formData.name}
*Phone:* ${formData.phone}
*Branch:* ${formData.branch}
*Service:* ${serviceName}
*Date:* ${formData.date}
*Time:* ${formData.time}
${formData.message ? `*Message:* ${formData.message}` : ""}`;

    const encodedText = encodeURIComponent(formattedMessage);
    const whatsappUrl = `https://wa.me/${targetPhone}?text=${encodedText}`;

    // Display elegant success modal
    setShowSuccessModal(true);

    // Record appointment in database and send confirmation email if email is provided
    fetch("/api/booking/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        branch: formData.branch,
        service: serviceName, // The component maps ID to name
        serviceId: formData.service, // The actual ID for DB
        date: formData.date,
        time: formData.time,
        message: formData.message,
      }),
    }).catch((err) => console.error("Booking API failed:", err));

    // Open WhatsApp link in new tab
    setTimeout(() => {
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    }, 1200);
  };

  const closeModal = () => {
    setShowSuccessModal(false);
    // Reset Form
    setFormData({
      name: "",
      phone: "",
      email: "",
      branch: "",
      service: "",
      date: "",
      time: "",
      message: "",
      consent: false
    });
  };

  return (
    <section id="booking" className="relative py-10 md:py-28 bg-luxury-black overflow-hidden border-b border-gold-primary/10">
      {/* Background soft ambient radial light */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(circle,rgba(212,175,55,0.03),transparent_70%)] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-8 md:mb-16">
          <span className="text-[10px] md:text-xs uppercase tracking-[0.25em] text-gold-primary mb-3 font-medium block">
            Reservations
          </span>
          <h2 className="font-playfair text-3xl md:text-4xl text-white font-light tracking-wide mb-4">
            Bespoke Styling Appointment
          </h2>
          <p className="text-sm text-ivory/60 leading-relaxed font-light">
            Fill in your preferred details. Submitting this form opens a direct confirmation chat with our front desk on WhatsApp.
          </p>
        </div>

        {/* Booking Form Card */}
        <div className="border border-gold-primary/15 bg-white/[0.02] backdrop-blur-md p-5 md:p-12 relative shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
          {/* Decorative Gold Corner Borders */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-gold-primary/45" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-gold-primary/45" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-gold-primary/45" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-gold-primary/45" />

          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">

            {/* Honeypot anti-bot trap — visually hidden, tabindex=-1, autocomplete=off */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }}>
              <label htmlFor="hp_website">Website</label>
              <input
                id="hp_website"
                type="text"
                name="website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* Name field */}
              <div className="flex flex-col">
                <label className="text-[10px] uppercase tracking-[0.2em] text-gold-primary font-medium mb-2 flex items-center">
                  <User size={10} className="mr-1.5" />
                  <span>Full Name *</span>
                </label>
                <input
                  type="text"
                  name="name"
                  maxLength={100}
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Alessandro Macbello"
                  className={`bg-luxury-black border ${
                    errors.name ? "border-red-500/70" : "border-white/10 focus:border-gold-primary/50"
                  } px-4 py-3 text-xs tracking-wider text-white placeholder-ivory/20 rounded-none focus:outline-none transition-colors duration-300`}
                />
                {errors.name && (
                  <span className="text-[10px] text-red-400 mt-1.5 font-light tracking-wide">
                    {errors.name}
                  </span>
                )}
              </div>

              {/* Phone number field */}
              <div className="flex flex-col">
                <label className="text-[10px] uppercase tracking-[0.2em] text-gold-primary font-medium mb-2 flex items-center">
                  <Phone size={10} className="mr-1.5" />
                  <span>Phone Number *</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  maxLength={20}
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+91 95625 14002"
                  className={`bg-luxury-black border ${
                    errors.phone ? "border-red-500/70" : "border-white/10 focus:border-gold-primary/50"
                  } px-4 py-3 text-xs tracking-wider text-white placeholder-ivory/20 rounded-none focus:outline-none transition-colors duration-300`}
                />
                {errors.phone && (
                  <span className="text-[10px] text-red-400 mt-1.5 font-light tracking-wide">
                    {errors.phone}
                  </span>
                )}
              </div>

              {/* Email field (optional — for booking confirmation) */}
              <div className="flex flex-col md:col-span-2">
                <label className="text-[10px] uppercase tracking-[0.2em] text-gold-primary font-medium mb-2 flex items-center">
                  <Mail size={10} className="mr-1.5" />
                  <span>Email Address <span className="text-ivory/30 normal-case tracking-normal font-light">(optional — receive booking confirmation)</span></span>
                </label>
                <input
                  type="email"
                  name="email"
                  maxLength={254}
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="your@email.com"
                  className={`bg-luxury-black border ${
                    errors.email ? "border-red-500/70" : "border-white/10 focus:border-gold-primary/50"
                  } px-4 py-3 text-xs tracking-wider text-white placeholder-ivory/20 rounded-none focus:outline-none transition-colors duration-300`}
                />
                {errors.email && (
                  <span className="text-[10px] text-red-400 mt-1.5 font-light tracking-wide">
                    {errors.email}
                  </span>
                )}
              </div>

              {/* Branch Select field */}
              <div className="flex flex-col">
                <label className="text-[10px] uppercase tracking-[0.2em] text-gold-primary font-medium mb-2 flex items-center">
                  <MapPin size={10} className="mr-1.5" />
                  <span>Select Branch *</span>
                </label>
                <select
                  name="branch"
                  value={formData.branch}
                  onChange={handleChange}
                  className={`bg-luxury-black border ${
                    errors.branch ? "border-red-500/70" : "border-white/10 focus:border-gold-primary/50"
                  } px-4 py-3 text-xs tracking-wider text-white rounded-none focus:outline-none transition-colors duration-300 cursor-pointer appearance-none`}
                >
                  <option value="" disabled className="text-white/30 bg-luxury-black">
                    Choose location...
                  </option>
                  <option value="Kaduthuruthy" className="text-white bg-luxury-black">
                    Kaduthuruthy
                  </option>
                  <option value="Ettumanoor" className="text-white bg-luxury-black">
                    Ettumanoor
                  </option>
                  <option value="Peruva" className="text-white bg-luxury-black">
                    Peruva
                  </option>
                </select>
                {errors.branch && (
                  <span className="text-[10px] text-red-400 mt-1.5 font-light tracking-wide">
                    {errors.branch}
                  </span>
                )}
              </div>

              {/* Service Select field */}
              <div className="flex flex-col">
                <label className="text-[10px] uppercase tracking-[0.2em] text-gold-primary font-medium mb-2 flex items-center">
                  <Sparkles size={10} className="mr-1.5" />
                  <span>Select Service *</span>
                </label>
                <select
                  name="service"
                  value={formData.service}
                  onChange={handleChange}
                  className={`bg-luxury-black border ${
                    errors.service ? "border-red-500/70" : "border-white/10 focus:border-gold-primary/50"
                  } px-4 py-3 text-xs tracking-wider text-white rounded-none focus:outline-none transition-colors duration-300 cursor-pointer appearance-none`}
                >
                  <option value="" disabled className="text-white/30 bg-luxury-black">
                    Choose styling service...
                  </option>
                  {servicesData.map((service) => (
                    <option key={service.id} value={service.id} className="text-white bg-luxury-black">
                      {service.name}
                    </option>
                  ))}
                </select>
                {errors.service && (
                  <span className="text-[10px] text-red-400 mt-1.5 font-light tracking-wide">
                    {errors.service}
                  </span>
                )}
              </div>

              {/* Date pick field */}
              <div className="flex flex-col">
                <label className="text-[10px] uppercase tracking-[0.2em] text-gold-primary font-medium mb-2 flex items-center">
                  <Calendar size={10} className="mr-1.5" />
                  <span>Preferred Date *</span>
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  min={new Date().toISOString().split("T")[0]} // Disable past dates
                  className={`bg-luxury-black border ${
                    errors.date ? "border-red-500/70" : "border-white/10 focus:border-gold-primary/50"
                  } px-4 py-3 text-xs tracking-wider text-white rounded-none focus:outline-none transition-colors duration-300 cursor-pointer`}
                />
                {errors.date && (
                  <span className="text-[10px] text-red-400 mt-1.5 font-light tracking-wide">
                    {errors.date}
                  </span>
                )}
              </div>

              {/* Time pick field */}
              <div className="flex flex-col">
                <label className="text-[10px] uppercase tracking-[0.2em] text-gold-primary font-medium mb-2 flex items-center">
                  <Clock size={10} className="mr-1.5" />
                  <span>Preferred Time *</span>
                </label>
                <input
                  type="time"
                  name="time"
                  value={formData.time}
                  onChange={handleChange}
                  className={`bg-luxury-black border ${
                    errors.time ? "border-red-500/70" : "border-white/10 focus:border-gold-primary/50"
                  } px-4 py-3 text-xs tracking-wider text-white rounded-none focus:outline-none transition-colors duration-300 cursor-pointer`}
                />
                {errors.time && (
                  <span className="text-[10px] text-red-400 mt-1.5 font-light tracking-wide">
                    {errors.time}
                  </span>
                )}
              </div>

              {/* Message field */}
              <div className="flex flex-col md:col-span-2">
                <label className="text-[10px] uppercase tracking-[0.2em] text-gold-primary font-medium mb-2 flex items-center">
                  <MessageSquare size={10} className="mr-1.5" />
                  <span>Special Requests / Notes (Optional)</span>
                </label>
                <textarea
                  name="message"
                  maxLength={1000}
                  value={formData.message}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Let us know if you require specific treatments or have preferences..."
                  className="bg-luxury-black border border-white/10 focus:border-gold-primary/50 px-4 py-3 text-xs tracking-wider text-white placeholder-ivory/20 rounded-none focus:outline-none transition-colors duration-300 resize-none"
                />
              </div>
            </div>

            {/* Consent Checkbox */}
            <div className="flex flex-col pt-2">
              <label className="flex items-start space-x-3 cursor-pointer group">
                <div className="relative flex items-center justify-center mt-0.5">
                  <input
                    type="checkbox"
                    name="consent"
                    checked={formData.consent}
                    onChange={handleChange}
                    className="peer appearance-none w-4 h-4 border border-white/20 bg-luxury-black checked:bg-gold-primary checked:border-gold-primary transition-all cursor-pointer"
                  />
                  <svg
                    className="absolute w-3 h-3 pointer-events-none opacity-0 peer-checked:opacity-100 text-luxury-black transition-opacity"
                    viewBox="0 0 14 14"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M2.5 7.5L5.5 10.5L11.5 3.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <span className="text-[11px] text-ivory/60 font-light leading-relaxed group-hover:text-ivory/80 transition-colors">
                  I agree to the <a href="/privacy-policy" target="_blank" className="text-gold-primary hover:text-gold-light underline underline-offset-2">Privacy Policy</a> and <a href="/terms-and-conditions" target="_blank" className="text-gold-primary hover:text-gold-light underline underline-offset-2">Terms & Conditions</a>. *
                </span>
              </label>
              {errors.consent && (
                <span className="text-[10px] text-red-400 mt-1.5 font-light tracking-wide">
                  {errors.consent}
                </span>
              )}
            </div>

            {/* Submit CTA */}
            <div className="pt-4">
              <button
                type="submit"
                className="w-full text-center text-xs uppercase tracking-[0.2em] bg-gold-primary hover:bg-gold-dark text-luxury-black font-semibold py-4 rounded-none transition-all duration-300 shadow-[0_5px_20px_rgba(212,175,55,0.15)] hover:shadow-[0_10px_35px_rgba(212,175,55,0.35)] cursor-pointer"
              >
                Send Appointment Details on WhatsApp
              </button>
            </div>
          </form>

        </div>

      </div>

      {/* Luxury Success Overlay Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-luxury-black/95 backdrop-blur-xl flex items-center justify-center p-4"
          >
            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="relative max-w-md w-full border border-gold-primary/30 bg-luxury-black p-8 text-center shadow-[0_20px_50px_rgba(212,175,55,0.15)] flex flex-col items-center"
            >
              {/* Close Button */}
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 text-ivory/40 hover:text-gold-primary transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>

              {/* Animated Gold Checkmark */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                className="w-16 h-16 border-2 border-gold-primary rounded-full flex items-center justify-center text-gold-primary mb-6 shadow-[0_0_20px_rgba(212,175,55,0.25)]"
              >
                <motion.svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <motion.path
                    d="M20 6L9 17L4 12"
                    stroke="#D4AF37"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                  />
                </motion.svg>
              </motion.div>

              {/* Success Messages */}
              <h3 className="font-playfair text-xl md:text-2xl text-white font-medium mb-3 tracking-wide">
                Booking Details Prepared
              </h3>
              
              <p className="text-xs text-ivory/70 leading-relaxed font-light mb-6">
                Thank you for choosing Macbello Family Salon. Our team will contact you shortly to confirm your appointment.
              </p>

              <p className="text-[10px] text-gold-primary/60 uppercase tracking-[0.15em] font-light flex items-center space-x-1.5">
                <span className="w-1 h-1 bg-gold-primary rounded-full animate-ping" />
                <span>Redirecting to WhatsApp to complete chat...</span>
              </p>

              {/* Manual Proceed button */}
              <button
                onClick={closeModal}
                className="mt-8 text-xs uppercase tracking-[0.2em] border border-white/10 hover:border-gold-primary text-ivory hover:text-gold-primary px-6 py-3 transition-all duration-300 cursor-pointer"
              >
                Return to Site
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </section>
  );
}
