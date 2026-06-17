import puppeteer from "puppeteer";
import { compileTemplate } from "./handlebars.service";
import type { ResumeData } from "../../types/resume.types";

// TODO: swap to @sparticuz/chromium + puppeteer-core for Vercel deployment
export async function renderResumePDF(
  data: ResumeData,
  templateId: string = "modern"
): Promise<Buffer> {
  const html = await compileTemplate(templateId, data);

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "1.2cm", right: "1.5cm", bottom: "1.2cm", left: "1.5cm" },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
