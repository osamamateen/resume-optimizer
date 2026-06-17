import Handlebars from "handlebars";
import { readFileSync } from "fs";
import { join } from "path";
import { getTemplate } from "../templates/registry";
import type { ResumeData } from "../../types/resume.types";

Handlebars.registerHelper("joinArray", (arr: string[] | undefined, separator: string) => {
  if (!Array.isArray(arr)) return "";
  return arr.join(separator);
});

Handlebars.registerHelper("ifExists", function (
  this: unknown,
  value: unknown,
  options: Handlebars.HelperOptions
) {
  if (value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0)) {
    return options.fn(this);
  }
  return options.inverse(this);
});

Handlebars.registerHelper("formatDateRange", (startDate: string, endDate: string) => {
  return `${startDate} – ${endDate}`;
});

export async function compileTemplate(templateId: string, data: ResumeData): Promise<string> {
  const template = getTemplate(templateId);
  const templatePath = join(process.cwd(), template.templatePath);
  const source = readFileSync(templatePath, "utf-8");
  const compiled = Handlebars.compile(source);
  return compiled(data);
}
