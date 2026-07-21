import type { TemplateDefinition } from "./base.template";

const templates: Record<string, TemplateDefinition> = {
  modern: {
    id: "modern",
    name: "Modern",
    description: "Clean layout with subtle color accents and strong typography",
    thumbnail: "/templates/modern/preview.png",
    templatePath: "lib/templates/modern/template.hbs",
  },
  // minimal: {
  //   id: "minimal",
  //   name: "Minimal",
  //   description: "Pure black and white, maximum whitespace, traditional structure",
  //   thumbnail: "/templates/minimal/preview.png",
  //   templatePath: "lib/templates/minimal/template.hbs",
  // },
};

export function getTemplate(id: string): TemplateDefinition {
  const template = templates[id];
  if (!template) throw new Error(`Template not found: ${id}`);
  return template;
}

export function listTemplates() {
  return Object.values(templates).map(({ id, name, description, thumbnail }) => ({
    id,
    name,
    description,
    thumbnail,
  }));
}
