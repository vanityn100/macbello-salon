import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ReviewMarquee from "@/components/ReviewMarquee";
import Stats from "@/components/Stats";
import About from "@/components/About";
import Services from "@/components/Services";
import BeforeAfter from "@/components/BeforeAfter";
import Trust from "@/components/Trust";
import Gallery from "@/components/Gallery";
import Booking from "@/components/Booking";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";

export default function Home() {
  return (
    <>
      {/* Floating CTA / Sticky Bottom Bar */}
      <FloatingActions />

      {/* Header Navigation */}
      <Navbar />

      <main className="flex flex-col min-h-screen">
        {/* Hero Banner */}
        <Hero />

        {/* Dynamic Auto-Scrolling Review Marquee ribbon */}
        <ReviewMarquee />

        {/* Counter Statistics Section */}
        <Stats />

        {/* About Heritage & Storytelling Section */}
        <About />

        {/* Services Experience Grid */}
        <Services />

        {/* Interactive Before & After comparison slider */}
        <BeforeAfter />

        {/* Google Reviews Showcase Section */}
        <Trust />

        {/* Masonry Portfolio Gallery Section */}
        <Gallery />

        {/* Booking Form with WhatsApp forwarding */}
        <Booking />

        {/* Contact info & Interactive Map */}
        <Contact />
      </main>

      {/* Footer Details */}
      <Footer />
    </>
  );
}
