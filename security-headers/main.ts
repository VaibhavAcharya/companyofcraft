import {
  type Check,
  checkList,
  definitionList,
  el,
  fetched,
  runLookup,
  summary,
} from "../lib/tool.ts";

type Report = {
  url: string;
  status: number;
  headers: [string, string][];
  policy: [string, string][];
  checks: Check[];
};

runLookup<Report>(
  "/api/security-headers",
  "Too many checks. Try again in a minute.",
  render,
);

function render(report: Report) {
  return [
    fetched(report.status, report.url),
    summary(report.checks),
    el("h2", "", ["Checks"]),
    checkList(report.checks),
    el("h2", "", ["Content-Security-Policy"]),
    report.policy.length === 0
      ? el("p", "empty", ["No Content-Security-Policy on this page."])
      : definitionList(report.policy),
    el("h2", "", ["Response headers"]),
    definitionList(report.headers),
  ];
}
