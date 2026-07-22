import type { Browser } from "puppeteer-core";
import { compileTemplate } from "./handlebars.service";
import type { ResumeData } from "../../types/resume.types";

// Full `puppeteer` bundles its own Chrome download, which lives outside
// node_modules (~/.cache/puppeteer) and never makes it into the deployed
// serverless function. In production we launch the Lambda-sized Chromium
// build from @sparticuz/chromium via puppeteer-core instead.
const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

async function launchBrowser(): Promise<Browser> {
  if (isServerless) {
    const [{ default: chromium }, { launch }] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
    ]);
    return launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const { launch } = await import("puppeteer");
  const browser = await launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  });
  return browser as unknown as Browser;
}

export async function renderResumePDF(
  data: ResumeData,
  templateId: string = "modern"
): Promise<Buffer> {
  const html = await compileTemplate(templateId, data);

  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0.3cm", right: "0.3cm", bottom: "0.3cm", left: "0.3cm" },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
