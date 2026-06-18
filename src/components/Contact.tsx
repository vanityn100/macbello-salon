"use client";

import { Phone, MapPin, Clock, MessageSquare, Compass, ArrowUpRight } from "lucide-react";


export default function Contact() {
  const phone = "+91 95625 14002";
  const address = "Market Junction, Kaduthuruthy, Kerala 686604";
  const mapsEmbedUrl = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m12!1m3!1d3931.258759714856!2d76.46950531120287!3d9.773539090280975!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3b0877a5ab0f7cf7%3A0xfb6efadca3d73507!2sMacbello%20Family%20Salon!5e0!3m2!1sen!2sin!4v1718816999999!5m2!1sen!2sin";
  const directionsUrl = "https://www.google.com/maps/dir/?api=1&destination=Macbello+Family+Salon+Market+Junction+Kaduthuruthy+Kerala";
  const whatsappUrl = `https://wa.me/919562514002?text=${encodeURIComponent(
    "Hi Macbello Family Salon, I'd like to book an appointment."
  )}`;

  return (
    <section id="contact" className="relative py-20 md:py-28 bg-luxury-black overflow-hidden border-b border-gold-primary/10">
      {/* Background soft light */}
      <div className="absolute top-[30%] left-[5%] w-[450px] h-[450px] bg-[radial-gradient(circle,rgba(212,175,55,0.02),transparent_70%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-[10px] md:text-xs uppercase tracking-[0.25em] text-gold-primary mb-3 font-medium block">
            Location
          </span>
          <h2 className="font-playfair text-3xl md:text-4xl text-white font-light tracking-wide">
            Visit The Salon
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
          
          {/* Left: Contact Info details */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-8">
            <div className="space-y-6">
              <span className="text-[10px] md:text-xs uppercase tracking-[0.25em] text-gold-primary font-medium block">
                Contact Directory
              </span>

              {/* Address card */}
              <div className="flex items-start space-x-4">
                <div className="p-3 border border-gold-primary/20 bg-gold-primary/5 text-gold-primary mt-1 shrink-0">
                  <MapPin size={16} />
                </div>
                <div>
                  <h4 className="text-xs uppercase tracking-[0.15em] text-gold-light font-semibold mb-1">
                    Salon Address
                  </h4>
                  <p className="text-xs md:text-sm text-ivory/80 leading-relaxed font-light">
                    Macbello Family Salon<br />
                    {address}
                  </p>
                </div>
              </div>

              {/* Phone card */}
              <div className="flex items-start space-x-4">
                <div className="p-3 border border-gold-primary/20 bg-gold-primary/5 text-gold-primary mt-1 shrink-0">
                  <Phone size={16} />
                </div>
                <div>
                  <h4 className="text-xs uppercase tracking-[0.15em] text-gold-light font-semibold mb-1">
                    Phone Reservations
                  </h4>
                  <a
                    href={`tel:${phone.replace(/\s/g, "")}`}
                    className="text-sm md:text-base text-white hover:text-gold-primary transition-colors font-medium tracking-wide"
                  >
                    {phone}
                  </a>
                  <span className="text-[10px] text-ivory/40 block mt-1 font-light">
                    One-tap direct call line
                  </span>
                </div>
              </div>

              {/* Opening Hours card */}
              <div className="flex items-start space-x-4">
                <div className="p-3 border border-gold-primary/20 bg-gold-primary/5 text-gold-primary mt-1 shrink-0">
                  <Clock size={16} />
                </div>
                <div>
                  <h4 className="text-xs uppercase tracking-[0.15em] text-gold-light font-semibold mb-1">
                    Salon Hours
                  </h4>
                  <p className="text-xs md:text-sm text-ivory/80 font-light">
                    Monday – Sunday: 9:30 AM – 8:30 PM
                  </p>
                  <span className="text-[10px] text-gold-primary/50 block mt-1 font-light">
                    Open 7 Days a week including Sundays
                  </span>
                </div>
              </div>
            </div>

            {/* Direct Conversion Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-white/5">
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center space-x-2 text-xs uppercase tracking-[0.2em] bg-gold-primary hover:bg-gold-dark text-luxury-black font-semibold py-4 transition-all duration-300"
              >
                <Compass size={14} />
                <span>Get Directions</span>
              </a>
              
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center space-x-2 text-xs uppercase tracking-[0.2em] border border-gold-primary/30 hover:border-gold-primary text-gold-primary hover:text-luxury-black hover:bg-gold-primary py-4 transition-all duration-300 bg-white/5"
              >
                <MessageSquare size={14} />
                <span>WhatsApp Desk</span>
              </a>
            </div>
          </div>

          {/* Right: Map Embed in Luxury Frame */}
          <div className="lg:col-span-7 relative flex items-center h-[350px] lg:h-auto min-h-[350px]">
            <div className="absolute inset-0 border border-gold-primary/25 bg-white/[0.01] p-3 shadow-[0_15px_40px_rgba(0,0,0,0.6)] flex items-stretch">
              
              {/* Gold borders inside the card */}
              <div className="absolute top-1.5 left-1.5 bottom-1.5 right-1.5 border border-gold-primary/10 pointer-events-none" />

              <iframe
                title="Macbello Family Salon Location Map"
                src={mapsEmbedUrl}
                className="w-full h-full border-0 filter grayscale invert contrast-125 opacity-75 focus:outline-none"
                allowFullScreen={false}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />

              {/* Float Map Overlay Label */}
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-6 right-6 z-10 flex items-center space-x-1.5 bg-luxury-dark/90 text-gold-primary border border-gold-primary/30 px-4 py-2 text-[10px] uppercase tracking-wider backdrop-blur-sm group"
              >
                <span>Google Maps View</span>
                <ArrowUpRight size={10} className="group-hover:rotate-45 transition-transform duration-300" />
              </a>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
