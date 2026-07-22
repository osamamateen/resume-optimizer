"use client";

import { LandingHeader } from "@/components/landing/LandingHeader";
import { Hero } from "@/components/landing/Hero";
import { Solution } from "@/components/landing/Solution";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingFooter } from "@/components/landing/LandingFooter";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <LandingHeader />
      <Hero />
      <Solution />
      <Features />
      <HowItWorks />
      <LandingFooter />
    </div>
  );
}
