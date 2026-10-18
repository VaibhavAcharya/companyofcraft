export function readTags(html: string, tagName: string) {
  return Array.from(
    html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "gi")),
    ([tag]) => readAttributes(tag),
  );
}

export function readMetaTags(html: string): [string, string][] {
  const tags: [string, string][] = [];
  for (const attrs of readTags(html, "meta")) {
    const name = (attrs.property ?? attrs.name)?.toLowerCase();
    if (name && attrs.content !== undefined) {
      tags.push([name, decodeEntities(attrs.content).trim()]);
    }
  }
  return tags;
}

export function readTitle(html: string) {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? decodeEntities(title).trim() : undefined;
}

export function readAttributes(tag: string) {
  const attrs: Record<string, string> = {};
  for (const match of tag.matchAll(
    /([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g,
  )) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4];
  }
  return attrs;
}

export function decodeEntities(value: string) {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|#39|nbsp);/gi,
    (entity, code: string) => {
      const lower = code.toLowerCase();
      if (lower.startsWith("#x")) {
        return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
      }
      if (lower.startsWith("#")) {
        return String.fromCodePoint(Number(lower.slice(1)));
      }
      return (
        { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[
          lower
        ] ?? entity
      );
    },
  );
}
