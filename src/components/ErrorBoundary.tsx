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
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console so the dev tools / Capacitor remote inspector captures it.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] render crash:", error, info?.componentStack);
    this.setState({ info });
  }

  private handleReload = () => {
    this.setState({ error: null, info: null });
    window.location.reload();
  };

  private handleReset = () => {
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

    const stack = info?.componentStack || error.stack || "";

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
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
          Что-то пошло не так
        </h1>
        <p style={{ fontSize: 14, color: "#555", maxWidth: 480, margin: 0 }}>
          Приложение упало с ошибкой. Можно перезагрузить страницу или сбросить
          данные (трекеры и записи) — язык сохранится.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={this.handleReload}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid #bbb",
              background: "#fff",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Перезагрузить
          </button>
          <button
            onClick={this.handleReset}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid #c33",
              background: "#fff0f0",
              color: "#a00",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Сбросить данные
          </button>
        </div>
        <details style={{ marginTop: 16, maxWidth: 560, width: "100%" }}>
          <summary style={{ cursor: "pointer", fontSize: 12, color: "#888" }}>
            Детали ошибки (для разработчика)
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
      </div>
    );
  }
}
