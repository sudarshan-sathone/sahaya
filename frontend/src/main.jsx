import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./App.css";
import { Toaster } from "react-hot-toast";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        success: {
          duration: 3000,
          style: {
            background: "#0d1117",
            color: "#e8e8e8",
            border: "1px solid #1D9E75",
            borderRadius: "10px",
            fontSize: "14px",
            padding: "12px 16px",
          },
          iconTheme: { primary: "#1D9E75", secondary: "#0d1117" },
        },
        error: {
          duration: 5000,
          style: {
            background: "#0d1117",
            color: "#e8e8e8",
            border: "1px solid #E24B4A",
            borderRadius: "10px",
            fontSize: "14px",
            padding: "12px 16px",
          },
          iconTheme: { primary: "#E24B4A", secondary: "#0d1117" },
        },
        loading: {
          style: {
            background: "#0d1117",
            color: "#e8e8e8",
            border: "1px solid #378ADD",
            borderRadius: "10px",
            fontSize: "14px",
            padding: "12px 16px",
          },
        },
      }}
    />
  </React.StrictMode>
);

