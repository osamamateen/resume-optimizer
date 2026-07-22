import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  // pdf-parse pulls in pdfjs-dist, which doesn't bundle cleanly through webpack
  // in a server route (throws at module init). Loading it natively avoids that.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "puppeteer", "puppeteer-core", "@sparticuz/chromium"],
  // handlebars.service.ts reads .hbs files via a dynamic fs path (built from
  // the templates registry), and @sparticuz/chromium resolves its compressed
  // Chromium binaries via a computed dirname join — neither is discoverable
  // by Next's file tracer, so both get dropped from the serverless bundle
  // unless included explicitly.
  outputFileTracingIncludes: {
    "/api/resume/render": [
      "./lib/templates/**/*.hbs",
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
  },
};

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
});

export default withSerwist(nextConfig);
