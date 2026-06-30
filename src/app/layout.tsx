import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import Spotlight from "@/components/Spotlight";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://macbello.com"),
  title: "Macbello Family Salon | Premium Salon in Kaduthuruthy, Ettumanoor & Peruva",
  description: "Luxury hair styling, beauty treatments, hair botox, grooming and bridal services across 3 branches — Kaduthuruthy, Ettumanoor & Peruva, Kerala.",
  keywords: [
    "Best Salon in Kaduthuruthy",
    "Salon Ettumanoor",
    "Salon Peruva",
    "Family Salon Kaduthuruthy",
    "Beauty Parlour Kottayam",
    "Hair Botox Kerala",
    "Bridal Makeup Kaduthuruthy",
    "Hair Salon Near Me",
    "Hair Coloring Kerala",
    "Macbello Family Salon"
  ],
  authors: [{ name: "Macbello Family Salon" }],
  openGraph: {
    title: "Macbello Family Salon | Premium Salon in Kaduthuruthy, Ettumanoor & Peruva",
    description: "Luxury hair styling, beauty treatments, hair botox, grooming and bridal services across 3 branches in Kerala.",
    url: "https://macbello.com",
    siteName: "Macbello Family Salon",
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: "https://macbello.com/images/hero/hero_salon.webp",
        width: 1200,
        height: 630,
        alt: "Macbello Family Salon Luxury Interior",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Macbello Family Salon | Premium Salon in Kaduthuruthy, Ettumanoor & Peruva",
    description: "Luxury hair styling, beauty treatments and bridal services across 3 branches in Kerala.",
    images: ["https://macbello.com/images/hero/hero_salon.webp"],
  },
  alternates: {
    canonical: "https://macbello.com",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    "name": "Macbello Family Salon",
    "image": "https://macbello.com/images/hero/hero_salon.webp",
    "@id": "https://macbello.com/#salon",
    "url": "https://macbello.com",
    "telephone": "+919562514002",
    "priceRange": "$$",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Market Junction",
      "addressLocality": "Kaduthuruthy",
      "addressRegion": "Kerala",
      "postalCode": "686604",
      "addressCountry": "IN"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 9.773539,
      "longitude": 76.471694
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday"
      ],
      "opens": "09:30",
      "closes": "20:30"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "781"
    }
  };

  return (
    <html
      lang="en"
      className={`${playfair.variable} ${inter.variable} scroll-smooth`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
      </head>
      <body className="bg-luxury-black text-ivory antialiased min-h-screen relative font-sans">
        <Spotlight />
        {children}
      </body>
    </html>
  );
}
