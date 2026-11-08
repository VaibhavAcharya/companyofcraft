import { hydrateRoot } from "react-dom/client";
import Page from "./page.tsx";

hydrateRoot(document.getElementById("root") as HTMLElement, <Page />);
