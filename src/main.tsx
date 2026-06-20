import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Proxy window.WebSocket at the very top to intercept and silence sandboxed Vite/HMR WebSocket connection failures
if (typeof window !== "undefined" && typeof window.WebSocket !== "undefined") {
  const OriginalWebSocket = window.WebSocket;
  const WebSocketProxy = new Proxy(OriginalWebSocket, {
    construct(target, args) {
      const [url, protocols] = args;
      const isViteWebsocket = 
        (protocols && (protocols === "vite-hmr" || (Array.isArray(protocols) && protocols.includes("vite-hmr")))) ||
        (typeof url === "string" && (url.includes("vite") || url.includes("hmr") || url.includes("websocket") || url.includes("ws://")));

      if (isViteWebsocket) {
        console.debug("Constructed silent fallback for Vite HMR WebSocket in sandboxed container.", url);
        // Create an EventTarget based mock that matches minimal WebSocket interface
        const mockWS = new EventTarget() as any;
        mockWS.url = url;
        mockWS.readyState = 0; // CONNECTING
        mockWS.send = () => {};
        mockWS.close = () => { mockWS.readyState = 3; };
        
        // Transition to CLOSED state gracefully without erroring out
        setTimeout(() => {
          mockWS.readyState = 3; // CLOSED
          const closeEvent = new CloseEvent("close", { code: 1000, reason: "Silenced in sandbox" });
          if (typeof mockWS.onclose === "function") {
            try { mockWS.onclose(closeEvent); } catch(e) {}
          }
          mockWS.dispatchEvent(closeEvent);
        }, 100);

        return mockWS;
      }
      return new (target as any)(...args);
    }
  });
  
  try {
    Object.defineProperty(window, "WebSocket", {
      value: WebSocketProxy,
      configurable: true,
      writable: true
    });
  } catch (e) {
    console.debug("Could not override window.WebSocket using defineProperty, trying direct assignment:", e);
    try {
      (window as any).WebSocket = WebSocketProxy;
    } catch (err) {
      console.warn("Could not override window.WebSocket in sandboxed window:", err);
    }
  }
}

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

