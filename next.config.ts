import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  // pdf-parse pulls in pdfjs-dist, which doesn't bundle cleanly through webpack
  // in a server route (throws at module init). Loading it natively avoids that.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "puppeteer"],
  // handlebars.service.ts reads .hbs files via a dynamic fs path (built from
  // the templates registry), so Next's file tracer can't discover them on
  // its own and omits them from the serverless bundle. Include explicitly.
  outputFileTracingIncludes: {
    "/api/resume/render": ["./lib/templates/**/*.hbs"],
  },
};

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
});

export default withSerwist(nextConfig);
