import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Client Testimonials & Reviews | Macbello Family Salon",
  description: "Read what our customers are saying about Macbello Family Salon in Kaduthuruthy, Ettumanoor, and Peruva. Experience luxury hair and beauty treatments.",
  keywords: ["Salon Reviews", "Macbello Salon Feedback", "Best Hair Stylist Kaduthuruthy", "Ettumanoor Beauty Parlour Reviews"]
};

export default function ReviewsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
