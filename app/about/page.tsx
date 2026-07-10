import type { Metadata } from "next";
import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";
import About from "@/components/marketing/About";

export const metadata: Metadata = {
  title: "About | WanderStory",
  description:
    "Every journey tells a story. Learn about WanderStory's mission to connect travellers with honest, experience-driven routes.",
};

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main>
        <About />
      </main>
      <Footer />
    </>
  );
}
