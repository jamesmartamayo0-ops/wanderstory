import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";
import Hero from "@/components/marketing/Hero";
import FeaturedDestinations from "@/components/marketing/FeaturedDestinations";
import HowItWorks from "@/components/marketing/HowItWorks";

export default function Home() {
  return (
    <>
      <Navbar />

      <main>
        <Hero />

        <FeaturedDestinations />

        <HowItWorks />
      </main>

      <Footer />
    </>
  );
}