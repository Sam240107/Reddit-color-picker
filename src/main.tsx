import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Silence expected sandboxed WebSocket and Vite HMR connection errors/rejections from triggering disruptive fullscreen overlays
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason?.message || String(event.reason);
    if (
      reason.includes("WebSocket") || 
      reason.includes("vite") || 
      reason.includes("websocket") || 
      reason.includes("HMR")
    ) {
      event.preventDefault();
      event.stopPropagation();
      console.debug("Ignored expected sandboxed websocket/HMR rejection:", reason);
    }
  });

  window.addEventListener("error", (event) => {
    const msg = event.message || "";
    if (
      msg.includes("WebSocket") || 
      msg.includes("vite") || 
      msg.includes("websocket") || 
      msg.includes("HMR")
    ) {
      event.preventDefault();
      event.stopPropagation();
      console.debug("Ignored expected sandboxed websocket/HMR runtime error:", msg);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

