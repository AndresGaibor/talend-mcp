import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { AppRouter, APP_ROUTES } from "./app";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRouter routes={APP_ROUTES} />
  </React.StrictMode>,
);
