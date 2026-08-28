import { useEffect, useRef } from "react";

export function usePosBarcodeScanner(scanCode: (raw: string) => Promise<void>) {
  const scanCodeRef = useRef(scanCode);
  scanCodeRef.current = scanCode;

  useEffect(() => {
    let buf = "";
    let lastAt = 0;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = Boolean(
        target?.closest("input, textarea, select, [contenteditable='true']"),
      );
      if (inField) return;
      if (e.key === "Enter") {
        if (buf.length >= 3) {
          e.preventDefault();
          void scanCodeRef.current(buf);
        }
        buf = "";
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const now = Date.now();
        if (now - lastAt > 80) buf = "";
        buf += e.key;
        lastAt = now;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
