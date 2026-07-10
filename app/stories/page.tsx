import type { Metadata } from "next";
import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";
import Stories from "@/components/marketing/Stories";

export const metadata: Metadata = {
  title: "Stories | WanderStory",
  description:
    "Real travel stories from real adventurers — honest tales from the road.",
};

export default function StoriesPage() {
  return (
    <>
      <Navbar />
      <main>
        <Stories />
      </main>
      <Footer />
    </>
  );
}
