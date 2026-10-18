import {
  type Check,
  checkList,
  el,
  fetched,
  runLookup,
  summary,
} from "../lib/tool.ts";

type Report = {
  url: string;
  status: number;
  crawlers: { name: string; owner: string; allowed: boolean }[];
  llmsTxt: string | null;
  checks: Check[];
};

runLookup<Report>(
  "/api/agent-readability",
  "Too many checks. Try again in a minute.",
  render,
);

function render(report: Report) {
  return [
    fetched(report.status, report.url),
    summary(report.checks),
    el("h2", "", ["Checks"]),
    checkList(report.checks),
    el("h2", "", ["AI crawlers"]),
    checkList(
      report.crawlers.map((crawler) => ({
        ok: crawler.allowed,
        label: crawler.name,
        detail: `${crawler.allowed ? "Allowed" : "Blocked"}. ${crawler.owner}`,
      })),
    ),
    el("h2", "", ["llms.txt"]),
    report.llmsTxt === null
      ? el("p", "empty", ["No llms.txt on this site."])
      : el("pre", "file", [report.llmsTxt]),
  ];
}
