"use client";

import { useEffect, useRef, useState } from "react";

type TurnstileWidgetProps = {
  siteKey: string;
  action: string;
  resetSignal?: number;
  onTokenChange: (token: string) => void;
};

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "dark";
      size: "normal" | "flexible";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    }
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const turnstileScriptSrc = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export default function TurnstileWidget({
  siteKey,
  action,
  resetSignal = 0,
  onTokenChange,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (window.turnstile) {
      queueMicrotask(() => setScriptReady(true));
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${turnstileScriptSrc}"]`
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => setScriptReady(true), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = turnstileScriptSrc;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => setScriptReady(true), { once: true });
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!scriptReady || !window.turnstile || !containerRef.current || widgetIdRef.current) {
      return;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      theme: "dark",
      size: "flexible",
      callback: onTokenChange,
      "expired-callback": () => onTokenChange(""),
      "error-callback": () => onTokenChange(""),
    });

    return () => {
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action, onTokenChange, scriptReady, siteKey]);

  useEffect(() => {
    if (window.turnstile && widgetIdRef.current) {
      window.turnstile.reset(widgetIdRef.current);
      onTokenChange("");
    }
  }, [onTokenChange, resetSignal]);

  return (
    <div style={{ display: "flex", justifyContent: "center", minHeight: "65px" }}>
      <div ref={containerRef} />
    </div>
  );
}
