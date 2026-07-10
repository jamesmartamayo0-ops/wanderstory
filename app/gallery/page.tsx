import type { Metadata } from "next";
import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";
import Gallery from "@/components/marketing/Gallery";

export const metadata: Metadata = {
  title: "Gallery | WanderStory",
  description:
    "Browse our collection of visual stories from destinations around the world.",
};

export default function GalleryPage() {
  return (
    <>
      <Navbar />
      <main>
        <Gallery />
      </main>
      <Footer />
    </>
  );
}
