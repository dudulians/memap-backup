/**
 * Speaking a note (her ask, Nov 2 2026: "нужно просить доступ к микрофону и
 * спокойно при нажатии наговаривать ноут"). Plain speech-to-text, no AI.
 *
 *   iOS / Android app → our own SpeechDictation plugin (AppDelegate.swift,
 *                       SpeechDictationPlugin.java): asks for the mic once,
 *                       then listens on the device whenever it can.
 *   Browser           → the Web Speech API where it exists (Chrome, Safari).
 *
 * listen() sends the words of this take so far (the whole take, not a
 * piece), so the caller just puts them after what was written before.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { getLanguage } from "@/lib/i18n";

interface SpeechDictationPlugin {
  isAvailable(o: { lang: string }): Promise<{ available: boolean }>;
  requestAccess(): Promise<{ granted: boolean }>;
  start(o: { lang: string }): Promise<void>;
  stop(): Promise<void>;
  addListener(event: "partial", fn: (d: { text: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: "end", fn: () => void): Promise<PluginListenerHandle>;
}

const Native = registerPlugin<SpeechDictationPlugin>("SpeechDictation");

type WebRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
};
const WebRec = (): (new () => WebRecognition) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => WebRecognition; webkitSpeechRecognition?: new () => WebRecognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const lang = () => (getLanguage() === "ru" ? "ru-RU" : "en-US");
const native = () => Capacitor.isNativePlatform();

/** Can this device turn speech into text at all? (Hides the mic if not.) */
export const canDictate = (): boolean => native() || !!WebRec();

export type ListenResult = "listening" | "denied" | "unavailable";

/** A running take; stop() ends it (the last words still arrive). */
export interface Take {
  stop: () => void;
}

/**
 * Ask for the microphone (only the first time shows a prompt), then listen.
 * onWords gets the whole take so far; onEnd fires once when it stops.
 */
export const listen = async (onWords: (text: string) => void, onEnd: () => void): Promise<{ result: ListenResult; take?: Take }> => {
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    onEnd();
  };

  if (native()) {
    try {
      const { granted } = await Native.requestAccess();
      if (!granted) return { result: "denied" };
      const handles = await Promise.all([
        Native.addListener("partial", (d) => onWords(d.text)),
        Native.addListener("end", () => {
          handles.forEach((h) => h.remove());
          end();
        }),
      ]);
      await Native.start({ lang: lang() });
      return {
        result: "listening",
        take: {
          stop: () => {
            Native.stop().catch(() => undefined);
            // iOS sends "end" after stop; Android may not if nothing was said.
            window.setTimeout(() => { handles.forEach((h) => h.remove()); end(); }, 1500);
          },
        },
      };
    } catch {
      return { result: "unavailable" };
    }
  }

  const R = WebRec();
  if (!R) return { result: "unavailable" };
  const r = new R();
  r.lang = lang();
  r.continuous = true;
  r.interimResults = true;
  r.onresult = (e) => {
    let said = "";
    for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
    onWords(said.trim());
  };
  let denied = false;
  r.onerror = (e) => { if (e?.error === "not-allowed" || e?.error === "service-not-allowed") denied = true; };
  r.onend = () => end();
  try {
    r.start();
  } catch {
    return { result: "unavailable" };
  }
  // A refused microphone shows up as an error right after start.
  await new Promise((ok) => window.setTimeout(ok, 350));
  if (denied) return { result: "denied" };
  return { result: "listening", take: { stop: () => { try { r.stop(); } catch { end(); } } } };
};
