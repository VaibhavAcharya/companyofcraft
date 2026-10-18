import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

const highlighter = createHighlighterCore({
  themes: [
    import("shiki/themes/github-light-default.mjs"),
    import("shiki/themes/github-dark-default.mjs"),
  ],
  langs: [
    import("shiki/langs/json.mjs"),
    import("shiki/langs/javascript.mjs"),
    import("shiki/langs/shellscript.mjs"),
  ],
  engine: createJavaScriptRegexEngine(),
});

export async function highlight(pre: HTMLElement) {
  const lang = pre.dataset.lang;
  if (!lang) {
    return;
  }
  const { tokens } = (await highlighter).codeToTokens(pre.textContent ?? "", {
    lang,
    themes: { light: "github-light-default", dark: "github-dark-default" },
    defaultColor: false,
  });
  pre.replaceChildren(
    ...tokens.flatMap((line, index) => [
      ...(index === 0 ? [] : ["\n"]),
      ...line.map((token) => {
        const span = document.createElement("span");
        span.textContent = token.content;
        for (const [name, value] of Object.entries(token.htmlStyle ?? {})) {
          span.style.setProperty(name, value);
        }
        return span;
      }),
    ]),
  );
  pre.classList.add("highlighted");
}
