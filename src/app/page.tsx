import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ReviewMarquee from "@/components/ReviewMarquee";
import Stats from "@/components/Stats";
import About from "@/components/About";
import Services from "@/components/Services";
import Branches from "@/components/Branches";
import BeforeAfter from "@/components/BeforeAfter";
import Trust from "@/components/Trust";
import Booking from "@/components/Booking";
import Loyalty from "@/components/Loyalty";
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
        {/* Hero Banner - always first on desktop and mobile */}
        <Hero />

        {/* Dynamic Auto-Scrolling Review Marquee ribbon - Hidden on mobile */}
        <div className="max-md:hidden"><ReviewMarquee /></div>

        {/* Counter Statistics Section - Hidden on mobile */}
        <div className="max-md:hidden"><Stats /></div>

        {/* About Heritage & Storytelling Section */}
        <About />

        {/* Services Experience Grid (Preview mode) */}
        <Services featuredOnly={true} />

        {/* Interactive Before & After comparison slider */}
        <BeforeAfter />

        {/* Google Reviews Showcase Section (Preview mode) */}
        <Trust isHomepage={true} />

        {/* Our Branches — 3 locations with premium cards */}
        <Branches />

        {/* Booking Form with WhatsApp forwarding */}
        <Booking />

        {/* Loyalty Rewards balance checker - Hidden on mobile */}
        <div className="max-md:hidden"><Loyalty /></div>
      </main>

      {/* Footer Details */}
      <Footer />
    </>
  );
}
