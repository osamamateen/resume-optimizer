import JSZip from "jszip";
import { XMLParser, XMLBuilder } from "fast-xml-parser";

// that round-tripped a real resume through Word: trimValues:false (parser default
// silently eats inter-run spaces), suppressEmptyNode:true (the builder's
// `unpairedTags` option does not actually self-close tags in preserveOrder mode,
// corrupting <w:br/> et al.), tab/break segmentation (treating a whole paragraph as
// one text blob destroys tab-aligned layouts like "Title <tab> Date"), and
// hyperlink/pass-through flattening (runs inside <w:hyperlink> are not direct
// paragraph children and get silently skipped otherwise).

const PARSER_OPTS = {
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: false,
};

const BUILDER_OPTS = {
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  suppressEmptyNode: true,
};

const PASS_THROUGH_TAGS = ["w:hyperlink", "w:ins", "w:del", "w:smartTag"];

type XmlNode = Record<string, unknown>;

function findTagNodes(node: unknown, tagName: string, results: XmlNode[] = []): XmlNode[] {
  if (Array.isArray(node)) {
    for (const child of node) findTagNodes(child, tagName, results);
  } else if (node && typeof node === "object") {
    for (const key of Object.keys(node as XmlNode)) {
      if (key === tagName) {
        results.push(node as XmlNode);
      } else if (key !== ":@") {
        findTagNodes((node as XmlNode)[key], tagName, results);
      }
    }
  }
  return results;
}

function getParagraphRunSequence(paragraphNode: XmlNode): XmlNode[] {
  const runs: XmlNode[] = [];
  const walk = (arr: unknown) => {
    if (!Array.isArray(arr)) return;
    for (const node of arr) {
      if (!node || typeof node !== "object") continue;
      const n = node as XmlNode;
      if ("w:r" in n) {
        runs.push(n);
      } else {
        for (const tag of PASS_THROUGH_TAGS) {
          if (tag in n) walk(n[tag]);
        }
      }
    }
  };
  walk(paragraphNode["w:p"]);
  return runs;
}

// Splits a paragraph's runs into segments at <w:tab/> / <w:br/> boundaries so
// tab-separated layouts are optimized and written back as independent text units
// instead of being merged into one run (which silently erases the others).
function getParagraphSegments(paragraphNode: XmlNode): XmlNode[][] {
  const runs = getParagraphRunSequence(paragraphNode);
  const segments: XmlNode[][] = [];
  let current: XmlNode[] = [];
  for (const run of runs) {
    const isBreak = findTagNodes(run["w:r"], "w:tab").length > 0 || findTagNodes(run["w:r"], "w:br").length > 0;
    if (isBreak) {
      if (current.length) segments.push(current);
      current = [];
      continue;
    }
    const tNodes = findTagNodes(run["w:r"], "w:t");
    if (tNodes.length) current.push(...tNodes);
  }
  if (current.length) segments.push(current);
  return segments;
}

function getNodeText(tNode: XmlNode): string {
  const children = tNode["w:t"];
  if (!Array.isArray(children)) return "";
  return children
    .map((c) => (c && typeof c === "object" && "#text" in (c as XmlNode) ? String((c as XmlNode)["#text"]) : ""))
    .join("");
}

function setNodeText(tNode: XmlNode, text: string): void {
  tNode["w:t"] = text === "" ? [] : [{ "#text": text }];
  const attrs = (tNode[":@"] as XmlNode) ?? {};
  attrs["@_xml:space"] = "preserve";
  tNode[":@"] = attrs;
}

export interface DocxSegment {
  id: string;
  text: string;
}

export interface ParsedDocx {
  zip: JSZip;
  ast: unknown;
  segments: DocxSegment[];
  segmentNodes: Map<string, XmlNode[]>;
}

export async function parseDocx(buffer: Buffer): Promise<ParsedDocx> {
  const zip = await JSZip.loadAsync(buffer);
  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) throw new Error("Not a valid .docx file: missing word/document.xml");
  const xml = await docXmlFile.async("string");

  const ast = new XMLParser(PARSER_OPTS).parse(xml);
  const paragraphs = findTagNodes(ast, "w:p");

  const segments: DocxSegment[] = [];
  const segmentNodes = new Map<string, XmlNode[]>();
  let counter = 0;

  for (const p of paragraphs) {
    for (const tNodes of getParagraphSegments(p)) {
      const text = tNodes.map(getNodeText).join("");
      if (!text.trim()) continue;
      const id = `seg-${counter++}`;
      segments.push({ id, text });
      segmentNodes.set(id, tNodes);
    }
  }

  return { zip, ast, segments, segmentNodes };
}

// Writes rewritten text back into the original document, keyed by segment id.
// Each segment's first run absorbs the new text; the rest are cleared, which
// preserves paragraph-level formatting but drops sub-segment (e.g. mid-sentence
// bold/italic) formatting — an accepted MVP trade-off.
export async function rewriteDocx(parsed: ParsedDocx, rewrites: Map<string, string>): Promise<Buffer> {
  for (const [id, tNodes] of parsed.segmentNodes) {
    const newText = rewrites.get(id);
    if (newText === undefined) continue;
    setNodeText(tNodes[0], newText);
    for (let i = 1; i < tNodes.length; i++) setNodeText(tNodes[i], "");
  }

  const newXml = new XMLBuilder(BUILDER_OPTS).build(parsed.ast);
  parsed.zip.file("word/document.xml", newXml);
  return parsed.zip.generateAsync({ type: "nodebuffer" });
}
