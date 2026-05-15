import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

/**
 * Last-resort error boundary. Without this, any render crash in the tree
 * (e.g. a bad localStorage payload, an i18n lookup failure, a stale tracker
 * field) unmounts the whole React root and the user sees only the body
 * gradient — which looks exactly like "the app disappeared". We'd much
 * rather show the error text + a reload/reset button so the user can recover.
 *
 * Production polish (1.7.4):
 *  - Stack trace details are HIDDEN entirely in prod builds — only DEV
 *    sees them. Apple App Review and end users see only the friendly
 *    "Something went wrong" UI.
 *  - Localised to user's current language (RU or EN). Reads
 *    memap_language from localStorage (set by lib/i18n.ts).
 *  - Reset button gets a confirm() prompt to prevent accidental data
 *    loss from a stray tap.
 */

// We can't use the useTranslation hook in a class component, but the
// ErrorBoundary is the LAST thing standing — i18n itself might have
// crashed. Use a tiny inline lookup based on the language saved in
// localStorage so we don't depend on the i18n module being functional.
const getLang = (): "ru" | "en" => {
  try {
    const v = localStorage.getItem("memap_language");
    if (v && v.toLowerCase().startsWith("ru")) return "ru";
  } catch {
    /* ignore */
  }
  return "en";
};

const COPY = {
  ru: {
    title: "Что-то пошло не так",
    body:
      "Приложение упало с ошибкой. Можно перезагрузить страницу или сбросить данные (трекеры и записи) — язык сохранится.",
    reload: "Перезагрузить",
    reset: "Сбросить данные",
    confirm:
      "Точно сбросить все данные? Все трекеры и записи будут удалены. Это нельзя отменить.",
    detailsLabel: "Технические детали (DEV)",
  },
  en: {
    title: "Something went wrong",
    body:
      "The app crashed unexpectedly. You can reload the page or reset your data (questions and entries). Your language preference will be kept.",
    reload: "Reload",
    reset: "Reset data",
    confirm:
      "Reset all data? All your questions and entries will be deleted. This cannot be undone.",
    detailsLabel: "Technical details (DEV)",
  },
} as const;

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console so the dev tools / Capacitor remote inspector captures it.
    // Sentry (lib/sentry.ts) auto-captures uncaught errors via its own hooks,
    // so this is just for local debugging.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] render crash:", error, info?.componentStack);
    this.setState({ info });
  }

  private handleReload = () => {
    this.setState({ error: null, info: null });
    window.location.reload();
  };

  private handleReset = () => {
    const t = COPY[getLang()];
    if (!window.confirm(t.confirm)) return;
    try {
      // Keep language so the reset UI isn't jarring.
      const lang = localStorage.getItem("memap_language");
      const chose = localStorage.getItem("memap_language_chosen");
      localStorage.clear();
      if (lang) localStorage.setItem("memap_language", lang);
      if (chose) localStorage.setItem("memap_language_chosen", chose);
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    const t = COPY[getLang()];
    const stack = info?.componentStack || error.stack || "";
    // DEV-only: show stack trace details. In production, end users
    // see only the friendly message + reload/reset buttons.
    const isDev = import.meta.env.DEV;

    return (
      <div
        style={{
          minHeight: "100vh",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          fontFamily: "system-ui, sans-serif",
          color: "#1a1a1a",
          background: "#fbf8f2",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>{t.title}</h1>
        <p style={{ fontSize: 15, color: "#555", maxWidth: 480, margin: 0, lineHeight: 1.5 }}>
          {t.body}
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            onClick={this.handleReload}
            style={{
              padding: "10px 18px",
              borderRadius: 12,
              border: "1px solid #bbb",
              background: "#fff",
              cursor: "pointer",
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            {t.reload}
          </button>
          <button
            onClick={this.handleReset}
            style={{
              padding: "10px 18px",
              borderRadius: 12,
              border: "1px solid #c33",
              background: "#fff0f0",
              color: "#a00",
              cursor: "pointer",
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            {t.reset}
          </button>
        </div>
        {isDev && (
          <details style={{ marginTop: 20, maxWidth: 560, width: "100%" }}>
            <summary style={{ cursor: "pointer", fontSize: 12, color: "#888" }}>
              {t.detailsLabel}
            </summary>
            <pre
              style={{
                marginTop: 8,
                padding: 12,
                background: "#f3f0e8",
                border: "1px solid #ddd",
                borderRadius: 8,
                fontSize: 11,
                textAlign: "left",
                overflow: "auto",
                maxHeight: 240,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {String(error.message)}
              {stack ? "\n\n" + stack : ""}
            </pre>
          </details>
        )}
      </div>
    );
  }
}
