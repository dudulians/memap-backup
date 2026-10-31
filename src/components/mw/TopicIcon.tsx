// Hand-drawn "sticker" icons for questions (Malu's world, 1.9). Same
// brown line as the lambs, pastel fills, nothing from an icon library,
// so the app stops looking like every other generated UI. The kind is
// picked from the door or from words in the title (EN + RU).
import { cn } from "@/lib/utils";
import type { DoorId } from "@/lib/doors";

export type TopicKind =
  | "fight" | "migraine" | "drink" | "kid" | "mood" | "anxious" | "sleep" | "tired"
  | "food" | "sun" | "move" | "heart" | "cry" | "phone" | "drop" | "pill" | "talk" | "star";

const has = (t: string, words: string[]) => words.some((w) => t.includes(w));

export const topicKind = (title: string, door?: DoorId): TopicKind => {
  if (door === "fights") return "fight";
  if (door === "migraine") return "migraine";
  if (door === "drinking") return "drink";
  if (door === "kid") return "kid";
  if (door === "mood") return "mood";
  const t = title.toLowerCase();
  if (has(t, ["argu", "fight", "ссор", "ругал", "поссор"])) return "fight";
  if (has(t, ["migraine", "headache", "мигрен", "голов"])) return "migraine";
  if (has(t, ["alcohol", "drank", "wine", "beer", "алкогол", "выпил", "вино", "пив"])) return "drink";
  if (has(t, ["kid", "child", "yelled", "ребён", "ребен", "дет", "сорвал", "крич"])) return "kid";
  if (has(t, ["anxi", "worr", "panic", "тревог", "тревож", "волнов", "паник"])) return "anxious";
  if (has(t, ["sleep", "slept", "nap", "спал", "сон", "сну"])) return "sleep";
  if (has(t, ["tired", "fatigue", "exhaust", "energy", "устал", "выжат", "энерг", "сил"])) return "tired";
  if (has(t, ["cried", "cry", "tears", "плакал", "плач", "слёз", "слез"])) return "cry";
  if (has(t, ["depress", "low", "sad", "mood", "подавлен", "грус", "настроен", "плохо"])) return "mood";
  if (has(t, ["ate", "meal", "food", "lunch", "breakfast", "sugar", "ел(", "ела", "еда", "обед", "завтрак", "сладк"])) return "food";
  if (has(t, ["outside", "sun", "walk", "nature", "на улиц", "солнц", "гулял", "прогул", "природ"])) return "sun";
  if (has(t, ["move", "exercise", "sport", "train", "danc", "трениров", "спорт", "двигал", "танц", "зарядк"])) return "move";
  if (has(t, ["period", "cycle", "pms", "water", "месячн", "цикл", "пмс", "вод"])) return "drop";
  if (has(t, ["pill", "medic", "таблет", "лекарств"])) return "pill";
  if (has(t, ["phone", "scroll", "screen", "social", "телефон", "соцсет", "экран", "листал"])) return "phone";
  if (has(t, ["love", "partner", "hug", "kiss", "sex", "together", "любим", "партнёр", "партнер", "обним", "близост", "вдвоём", "вдвоем"])) return "heart";
  if (has(t, ["said", "spoke", "voice", "call", "сказал", "голос", "звонил", "говорил"])) return "talk";
  return "star";
};

// Door topics use their washi-tape colour (see malu.css --tape-*).
export const FILL: Record<TopicKind, string> = {
  fight: "#FF9AAE", migraine: "#CFC3F5", drink: "#FFE08A", kid: "#FFC7A6", mood: "#A9DCF0",
  anxious: "#D9D0F7", sleep: "#C9CEF2", tired: "#FFF1C4", food: "#FFD9B0", sun: "#FFE08A",
  move: "#CFE6C4", heart: "#FFB3C1", cry: "#C9E8F7", phone: "#D9D0F7", drop: "#FFB8C6",
  pill: "#D8EED8", talk: "#FFF1C4", star: "#FFE08A",
};

/** Tape colour variable for a topic, for strips and picked cards. */
export const tapeVar = (kind: TopicKind): string =>
  kind === "fight" ? "var(--tape-fights)" : kind === "migraine" ? "var(--tape-migraine)" : kind === "drink" ? "var(--tape-drinking)"
    : kind === "kid" ? "var(--tape-kid)" : kind === "mood" ? "var(--tape-mood)" : "var(--tape-other)";

// 32x32 drawings. `f` = filled shape, `l` = line only.
const ART: Record<TopicKind, { f?: string; l?: string; dot?: [number, number, number][] }> = {
  fight: {
    f: "M4.5 7.5c0-1.8 1.4-3 3.1-3h10.6c1.8 0 3.2 1.3 3.2 3.1v6.1c0 1.8-1.4 3.1-3.2 3.1h-6.7l-4.2 3.3.6-3.3H7.6c-1.7 0-3.1-1.3-3.1-3.1zM14 15.6h9.6c1.7 0 3.1 1.3 3.1 3.1v5.5c0 1.8-1.4 3.1-3.1 3.1h-1.1l.6 3-3.9-3H14c-1.7 0-3.1-1.3-3.1-3.1v-2.4",
    l: "M8.5 10.9l2.6-2.3 2.2 2.6 2.6-2.4 2 2.1",
  },
  migraine: {
    f: "M8.3 19.4c-2.7 0-4.4-1.8-4.4-4.1 0-2.1 1.6-3.8 3.7-4 .6-3.4 3.4-5.8 6.9-5.8 3.2 0 5.8 2 6.6 4.9 2.9-.1 5.2 2.1 5.2 4.6 0 2.5-2 4.4-4.6 4.4z",
    l: "M16.9 17.4l-3 5h4.2l-2.6 5.3",
  },
  drink: {
    f: "M8.6 4.8h14.8c.3 5.8-2 10.3-7.4 10.6-5.4-.3-7.7-4.8-7.4-10.6z",
    l: "M16 15.6v9.6M10.6 26.8c1.8-.7 3.6-1 5.4-1s3.6.3 5.4 1M9.4 9.4c4 .9 9 .8 13.2 0",
  },
  kid: {
    f: "M16 7.2c4.9 0 8.6 3.6 8.6 8.6 0 5.3-3.8 9.3-8.6 9.3s-8.6-4-8.6-9.3c0-5 3.7-8.6 8.6-8.6z",
    l: "M7.6 13.3c-2.4-.6-4.2.4-4.4 2.3 1.4 1 3.2 1 4.6.4M24.4 13.3c2.4-.6 4.2.4 4.4 2.3-1.4 1-3.2 1-4.6.4M11.8 9.2c.4-1.6 1.6-2.5 2.6-2.3M15.2 8.4c.3-1.6 1.5-2.6 2.6-2.4M18.6 9.1c.6-1.5 1.8-2.2 2.8-1.8M14.4 20c1 .8 2.2.8 3.2 0",
    dot: [[12.8, 16.6, 1.25], [19.2, 16.6, 1.25]],
  },
  mood: {
    f: "M16 4.6c6.4 0 11.2 4.8 11.2 11.3S22.4 27.4 16 27.4 4.8 22.4 4.8 15.9 9.6 4.6 16 4.6z",
    l: "M11.5 19.6c2.6 2.5 6.4 2.5 9 0",
    dot: [[12, 13.6, 1.5], [20, 13.6, 1.5]],
  },
  anxious: {
    f: "M16 4.6c6.4 0 11.2 4.8 11.2 11.3S22.4 27.4 16 27.4 4.8 22.4 4.8 15.9 9.6 4.6 16 4.6z",
    l: "M10.5 20.4c1.1-1.2 2.2-1.2 3.3 0s2.2 1.2 3.3 0 2.2-1.2 3.3 0",
    dot: [[12, 13.4, 1.5], [20, 13.4, 1.5]],
  },
  sleep: {
    f: "M19.6 4.8c-5.9.9-9.6 5.6-9.1 11.3.5 5.8 5.6 10 11.4 9.4 2-.2 3.8-1 5.2-2.2-7.4-.6-11.9-10.1-7.5-18.5z",
    l: "M6 7.4h4.2L6 12h4.2",
  },
  tired: {
    f: "M4.8 10.4h19.6c1 0 1.8.8 1.8 1.8v7.6c0 1-.8 1.8-1.8 1.8H4.8c-1 0-1.8-.8-1.8-1.8v-7.6c0-1 .8-1.8 1.8-1.8z",
    l: "M28.6 13.8v4.4M6.8 14v4",
  },
  food: {
    f: "M4.6 15.4h22.8c-.4 6-5.1 10.4-11.4 10.4S5 21.4 4.6 15.4z",
    l: "M10.8 11.6c-1-1.6.9-2.6 0-4.4M16 11.6c-1-1.6.9-2.6 0-4.4M21.2 11.6c-1-1.6.9-2.6 0-4.4",
  },
  sun: {
    f: "M16 9.6c3.6 0 6.4 2.8 6.4 6.4s-2.8 6.4-6.4 6.4-6.4-2.8-6.4-6.4 2.8-6.4 6.4-6.4z",
    l: "M16 3.2v2.6M16 26.2v2.6M3.2 16h2.6M26.2 16h2.6M6.9 6.9l1.9 1.9M23.2 23.2l1.9 1.9M6.9 25.1l1.9-1.9M23.2 8.8l1.9-1.9",
  },
  move: {
    f: "M5.2 20.2c0-1.5 1.1-2.6 2.6-2.6 2.5 0 3.6-1.2 4.6-3.6l1.1-2.6 4.4 1.2c1.6 3.4 4.2 4.6 7.6 5.1 1.6.2 2.4 1.4 2.4 2.8v1.4c0 .8-.6 1.4-1.4 1.4H6.6c-.8 0-1.4-.6-1.4-1.4z",
    l: "M14.4 15.2l2 .6M13.4 17.8l2 .6",
  },
  heart: {
    f: "M16 26.2C6.8 20.4 3.6 15.4 5 10.8c1.3-4.3 6.6-5.5 11 .2 4.4-5.7 9.7-4.5 11-.2 1.4 4.6-1.8 9.6-11 15.4z",
  },
  cry: {
    f: "M16 4.4c4.4 6 7.8 10.2 7.8 14.4 0 4.6-3.4 8-7.8 8s-7.8-3.4-7.8-8c0-4.2 3.4-8.4 7.8-14.4z",
    l: "M12.4 19.6c.4 2 1.8 3.2 3.6 3.4",
  },
  phone: {
    f: "M10.4 3.8h11.2c1.3 0 2.2.9 2.2 2.2v20c0 1.3-.9 2.2-2.2 2.2H10.4c-1.3 0-2.2-.9-2.2-2.2V6c0-1.3.9-2.2 2.2-2.2z",
    l: "M14 24.4h4M13.6 7.2h4.8",
  },
  drop: {
    f: "M16 4.4c4.4 6 7.8 10.2 7.8 14.4 0 4.6-3.4 8-7.8 8s-7.8-3.4-7.8-8c0-4.2 3.4-8.4 7.8-14.4z",
  },
  pill: {
    f: "M7 18.6l9.2-9.2c2.6-2.6 6.2-2.6 8.2-.6s2 5.6-.6 8.2L14.6 26.2c-2.6 2.6-6.2 2.6-8.2.6s-2-5.6.6-8.2z",
    l: "M11.6 13.8l6.6 6.6",
  },
  talk: {
    f: "M5 9c0-2 1.6-3.6 3.6-3.6h14.8c2 0 3.6 1.6 3.6 3.6v8.6c0 2-1.6 3.6-3.6 3.6h-7.2l-5.6 4.6.8-4.6H8.6C6.6 21.2 5 19.6 5 17.6z",
    dot: [[11.4, 13.4, 1.4], [16, 13.4, 1.4], [20.6, 13.4, 1.4]],
  },
  star: {
    f: "M16 4.2l3.4 7.2 7.8 1-5.7 5.4 1.4 7.8L16 21.8l-6.9 3.8 1.4-7.8-5.7-5.4 7.8-1z",
  },
};

export const TopicIcon = ({
  kind,
  className,
  size = 32,
  sticker,
  style,
}: {
  kind: TopicKind;
  className?: string;
  size?: number;
  /** Die-cut: a white edge around the drawing, for stickers on paper. */
  sticker?: boolean;
  style?: React.CSSProperties;
}) => {
  const a = ART[kind];
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox={sticker ? "-3 -3 38 38" : "0 0 32 32"}
      className={cn("shrink-0", sticker && "mw-sticker-img", className)}
      style={style}
      fill="none"
      stroke="#5A3624"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {sticker && (
        <g stroke="#fff" strokeWidth={6.5} fill="#fff">
          {a.f && <path d={a.f} />}
          {a.l && <path d={a.l} fill="none" />}
        </g>
      )}
      {a.f && <path d={a.f} fill={FILL[kind]} />}
      {a.l && <path d={a.l} />}
      {a.dot?.map(([x, y, r]) => <circle key={`${x}${y}`} cx={x} cy={y} r={r} fill="#5A3624" stroke="none" />)}
    </svg>
  );
};

/** "It didn't happen": a small pencil curl, not a judgement. */
export const PencilCurl = ({ size = 18, className }: { size?: number; className?: string }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 20 20" className={cn("shrink-0", className)}>
    <path d="M3 12.5c2.2-4.6 5.2-6.4 6.6-4.6 1.3 1.7-1.7 4.6-.3 5.5 1.5 1 4.3-2.4 7.7-5.4" fill="none" stroke="hsl(var(--mw-curl))" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
