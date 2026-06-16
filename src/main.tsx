import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { cleanupPreviewServiceWorkers } from "@/utils/serviceWorkerCleanup";

cleanupPreviewServiceWorkers();

// eslint-disable-next-line no-console
console.log('Current Origin:', window.location.origin);

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
