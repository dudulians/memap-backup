// Malu inside the app (Malu's world, 1.9). One component for every
// pose, so screens just say which mood they need. Tapping her gives a
// little squish and a haptic tick: something to play with that isn't
// a form. Never covered with props: those float around in the art.
import { useState } from "react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import wave from "@/assets/malu/malu-wave.webp";
import happy from "@/assets/malu/malu-happy.webp";
import cheer from "@/assets/malu/malu-cheer.webp";
import heart from "@/assets/malu/malu-heart.webp";
import sleepy from "@/assets/malu/malu-sleepy.webp";
import think from "@/assets/malu/malu-think.webp";
import wink from "@/assets/malu/malu-wink.webp";
import shy from "@/assets/malu/malu-shy.webp";
import sit from "@/assets/malu/malu-sit.webp";
import hug from "@/assets/malu/malu-hug.webp";
import hmph from "@/assets/malu/malu-hmph.webp";
import mom from "@/assets/malu/malu-mom.webp";
import mood from "@/assets/malu/malu-mood.webp";
import glass from "@/assets/malu/malu-glass.webp";
import cloud from "@/assets/malu/malu-cloud.webp";

export const MALU = { wave, happy, cheer, heart, sleepy, think, wink, shy, sit, hug, hmph, mom, mood, glass, cloud };
export type MaluPose = keyof typeof MALU;
/** Scenes with two lambs are 3:2, single poses are square. */
const WIDE: MaluPose[] = ["hug", "hmph", "mom"];

export const Malu = ({
  pose,
  size = 120,
  className,
  bob,
  tappable = true,
}: {
  pose: MaluPose;
  /** Height in px; wide scenes get 1.5x the width. */
  size?: number;
  className?: string;
  bob?: boolean;
  tappable?: boolean;
}) => {
  const [boop, setBoop] = useState(0);
  const wide = WIDE.includes(pose);
  const img = (
    <img
      key={boop}
      src={MALU[pose]}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{ height: size, width: wide ? size * 1.5 : size }}
      className={cn("select-none object-contain mw-sticker-img", boop > 0 && "mw-boop")}
    />
  );
  if (!tappable) return <span className={cn("inline-block", bob && "mw-bob", className)}>{img}</span>;
  return (
    <button
      type="button"
      aria-hidden="true"
      tabIndex={-1}
      onClick={() => {
        setBoop((n) => n + 1);
        haptics.tap();
      }}
      className={cn("inline-block bg-transparent p-0 border-0", bob && "mw-bob", className)}
      style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
    >
      {img}
    </button>
  );
};

/** Malu with a speech bubble to her right (or above on narrow lines). */
export const MaluSays = ({
  pose,
  children,
  size = 96,
  className,
}: {
  pose: MaluPose;
  children: React.ReactNode;
  size?: number;
  className?: string;
}) => (
  <div className={cn("flex items-end gap-1", className)}>
    <Malu pose={pose} size={size} className="shrink-0 -mb-1" />
    <div className="mw-bubble mb-7 text-[17px] leading-snug">{children}</div>
  </div>
);
