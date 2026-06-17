import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  // pdf-parse pulls in pdfjs-dist, which doesn't bundle cleanly through webpack
  // in a server route (throws at module init). Loading it natively avoids that.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "puppeteer"],
};

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
});

export default withSerwist(nextConfig);
