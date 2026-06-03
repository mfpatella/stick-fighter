import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { PwaInstallPrompt } from "./PwaInstallPrompt";

export function mountPwaInstallPrompt(target: HTMLElement) {
  createRoot(target).render(createElement(PwaInstallPrompt));
}
