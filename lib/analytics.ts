type EventData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: { track: (event: string, data?: EventData) => void };
  }
}

export function track(event: string, data?: EventData) {
  window.umami?.track(event, data);
}

export function trackFaqOpens(tool: string) {
  for (const details of document.querySelectorAll<HTMLDetailsElement>(
    ".faq details",
  )) {
    details.addEventListener("toggle", () => {
      if (details.open) {
        const question = details.querySelector("summary")?.textContent ?? "";
        track("faq-open", { tool, question });
      }
    });
  }
}
