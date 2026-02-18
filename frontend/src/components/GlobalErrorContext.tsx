import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

type GlobalErrorContextValue = {
  message: string | null;
  showError: (message: string, durationMs?: number) => void;
  clearError: () => void;
};

const GlobalErrorContext = createContext<GlobalErrorContextValue | undefined>(undefined);

export function GlobalErrorProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearError = useCallback(() => {
    setMessage(null);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const showError = useCallback((nextMessage: string, durationMs = 7000) => {
    setMessage(nextMessage);

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = window.setTimeout(() => {
      setMessage(null);
      timerRef.current = null;
    }, durationMs);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const value = useMemo(
    () => ({ message, showError, clearError }),
    [message, showError, clearError]
  );

  return (
    <GlobalErrorContext.Provider value={value}>
      {message && (
        <div className="global-error-banner" role="alert" aria-live="assertive">
          <span className="global-error-banner-message">{message}</span>
          <button type="button" className="global-error-banner-close" onClick={clearError} aria-label="Dismiss error">
            Dismiss
          </button>
        </div>
      )}
      {children}
    </GlobalErrorContext.Provider>
  );
}

export function useGlobalError() {
  const context = useContext(GlobalErrorContext);
  if (!context) {
    throw new Error("useGlobalError must be used within a GlobalErrorProvider");
  }
  return context;
}
