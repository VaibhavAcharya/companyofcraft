import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

const SITE_URL = "https://companyofcraft.com";

const DROPPED = new Set(["form", "img", "nav", "picture", "script", "svg"]);

type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

export function markdownPath(path: string): string {
  return path === "/" ? "/index.md" : `${path.replace(/\/$/, "")}.md`;
}

export function pagePath(markdownFile: string): string | undefined {
  const path = markdownFile === "/index.md" ? "/" : markdownFile.slice(0, -3);
  return existsSync(htmlFile(path)) ? path : undefined;
}

function htmlFile(path: string): string {
  return path === "/" ? "index.html" : `${path.slice(1)}.html`;
}

export async function pageMarkdown(path: string): Promise<string> {
  const processor = unified()
    .use(rehypeParse)
    .use(selectMain)
    .use(rehypeRemark)
    .use(absoluteLinks)
    .use(remarkStringify, { bullet: "-", rule: "-" });
  return String(await processor.process(await readFile(htmlFile(path))));
}

function selectMain() {
  return (tree: HastNode) => {
    const main = find(tree, "main");
    if (main === undefined) {
      throw new Error("The page has no <main>");
    }
    clean(main);
    tree.children = [main];
  };
}

function find(node: HastNode, tagName: string): HastNode | undefined {
  if (node.tagName === tagName) {
    return node;
  }
  for (const child of node.children ?? []) {
    const found = find(child, tagName);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function clean(node: HastNode) {
  const children = (node.children ?? []).filter(
    (child) =>
      !DROPPED.has(child.tagName ?? "") && child.properties?.hidden !== true,
  );
  for (const child of children) {
    if (child.type === "text") {
      child.value = child.value?.replace(/\s+/g, " ");
    }
  }
  trimText(children[0], (value) => value.trimStart());
  trimText(children.at(-1), (value) => value.trimEnd());
  node.children = children.filter(
    (child) => child.type !== "text" || child.value !== "",
  );
  for (const child of node.children) {
    if (child.tagName === "summary") {
      child.tagName = "h3";
    }
    clean(child);
  }
}

function trimText(node: HastNode | undefined, trim: (value: string) => string) {
  if (node?.type === "text" && node.value !== undefined) {
    node.value = trim(node.value);
  }
}

function absoluteLinks() {
  return (tree: { type: string; url?: string; children?: unknown[] }) => {
    const visit = (node: {
      type: string;
      url?: string;
      children?: unknown[];
    }) => {
      if (node.type === "link" && node.url?.startsWith("/")) {
        const [path, hash] = node.url.split("#");
        const target = pagePath(markdownPath(path)) ? markdownPath(path) : path;
        node.url = `${SITE_URL}${target}${hash === undefined ? "" : `#${hash}`}`;
      }
      for (const child of node.children ?? []) {
        visit(child as typeof node);
      }
    };
    visit(tree);
  };
}
