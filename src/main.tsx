import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { migrateLegacyKeys } from "./utils/cacheManager";

// Run cache migration on app startup
migrateLegacyKeys();

createRoot(document.getElementById("root")!).render(<App />);
