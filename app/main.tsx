import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Workbench from "./workbench";
import "./globals.css";
import "./v2.css";
import "./assets.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Workbench />
  </StrictMode>,
);
