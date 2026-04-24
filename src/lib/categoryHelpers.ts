import { Tracker } from "@/types/tracker";
import {
  Brain, Sparkles, Heart, MessageCircle, Activity, Search, Drama, Smartphone,
  Cloud, Pill, Zap, Bandage, HeartCrack, Handshake, MessageSquare, Volume2,
  Moon, Dumbbell, Droplet, Coffee, Utensils, BookOpen, Leaf, Clover, RefreshCw,
  Laugh, Star, Music, Camera, PhoneOff, Users, Mic, LucideIcon
} from "lucide-react";

export const getCategoryEmoji = (category: Tracker["category"]): string => {
  const emojiMap = {
    Emotions: "🧠",
    Body: "✨",
    Connections: "❤️",
    Voice: "🗣️",
    Health: "🏃",
    Curious: "🔍",
    Fun: "🎭",
    Social: "📱",
  };
  return emojiMap[category];
};

export const getCategoryColor = (category: Tracker["category"]): string => {
  const colorMap = {
    Emotions: "mood",
    Body: "health",
    Connections: "relationships",
    Voice: "work",
    Health: "health",
    Curious: "custom",
    Fun: "custom",
    Social: "work",
  };
  return colorMap[category];
};

export const getTrackerEmoji = (title: string): string => {
  const lowerTitle = title.toLowerCase();
  
  // Emotions & Mind
  if (lowerTitle.includes("mood") || lowerTitle.includes("anxiety") || lowerTitle.includes("cry")) return "🧠";
  if (lowerTitle.includes("fog") || lowerTitle.includes("creative")) return "💭";
  
  // Body & Sensations
  if (lowerTitle.includes("headache") || lowerTitle.includes("migraine")) return "💊";
  if (lowerTitle.includes("energy")) return "⚡";
  if (lowerTitle.includes("stomach") || lowerTitle.includes("pain")) return "🩹";
  if (lowerTitle.includes("body")) return "✨";
  
  // Connections & Love
  if (lowerTitle.includes("love") || lowerTitle.includes("partner")) return "❤️";
  if (lowerTitle.includes("argument") || lowerTitle.includes("lonely")) return "💔";
  if (lowerTitle.includes("quality time") || lowerTitle.includes("reach")) return "🤝";
  
  // Voice & Behavior
  if (lowerTitle.includes("truth") || lowerTitle.includes("spoke")) return "🗣️";
  if (lowerTitle.includes("sorry") || lowerTitle.includes("interrupt")) return "💬";
  if (lowerTitle.includes("no") || lowerTitle.includes("voice")) return "🔊";
  
  // Health & Routine
  if (lowerTitle.includes("sleep")) return "💤";
  if (lowerTitle.includes("move") || lowerTitle.includes("exercise")) return "🏃";
  if (lowerTitle.includes("water")) return "💧";
  if (lowerTitle.includes("caffeine") || lowerTitle.includes("drink")) return "☕";
  if (lowerTitle.includes("ate") || lowerTitle.includes("meal")) return "🍽️";
  
  // Curious & Random
  if (lowerTitle.includes("learn")) return "📚";
  if (lowerTitle.includes("kind") || lowerTitle.includes("random")) return "✨";
  if (lowerTitle.includes("nature")) return "🌿";
  if (lowerTitle.includes("lucky")) return "🍀";
  if (lowerTitle.includes("mind") || lowerTitle.includes("change")) return "🔄";
  
  // Fun & Weird
  if (lowerTitle.includes("laugh")) return "😂";
  if (lowerTitle.includes("dream")) return "💫";
  if (lowerTitle.includes("joke") || lowerTitle.includes("made")) return "🎭";
  if (lowerTitle.includes("color") || lowerTitle.includes("wore")) return "🎨";
  if (lowerTitle.includes("sang") || lowerTitle.includes("sing")) return "🎵";
  
  // Social & Digital
  if (lowerTitle.includes("scroll") || lowerTitle.includes("doom")) return "📱";
  if (lowerTitle.includes("post")) return "📸";
  if (lowerTitle.includes("phone")) return "📵";
  if (lowerTitle.includes("compare")) return "👥";
  if (lowerTitle.includes("voice note")) return "🎙️";
  
  // Fallback to category emoji
  return getCategoryEmoji(title as any) || "⭐";
};

export const getCategoryIcon = (category: Tracker["category"]): LucideIcon => {
  const map: Record<Tracker["category"], LucideIcon> = {
    Emotions: Brain,
    Body: Sparkles,
    Connections: Heart,
    Voice: MessageCircle,
    Health: Activity,
    Curious: Search,
    Fun: Drama,
    Social: Smartphone,
  };
  return map[category] ?? Star;
};

export const getTrackerIcon = (
  title: string,
  category?: Tracker["category"]
): LucideIcon => {
  const t = title.toLowerCase();

  if (t.includes("mood") || t.includes("anxiety") || t.includes("anxious")) return Brain;
  if (t.includes("cry") || t.includes("cried") || t.includes("empty") || t.includes("disappear") || t.includes("lonely")) return HeartCrack;
  if (t.includes("fog") || t.includes("creative") || t.includes("inspired") || t.includes("imagined")) return Cloud;

  if (t.includes("headache") || t.includes("migraine") || t.includes("pill") || t.includes("medication") || t.includes("side effect")) return Pill;
  if (t.includes("energy") || t.includes("energiz")) return Zap;
  if (t.includes("stomach") || t.includes("pain") || t.includes("cramp") || t.includes("hurt") || t.includes("back")) return Bandage;
  if (t.includes("rested") || t.includes("woke up") || t.includes("good") || t.includes("beautiful")) return Sparkles;
  if (t.includes("dizzy") || t.includes("stumbled") || t.includes("tired") || t.includes("trip")) return Cloud;

  if (t.includes("love") || t.includes("partner") || t.includes("gratitude") || t.includes("close") || t.includes("hug") || t.includes("flower") || t.includes("smile")) return Heart;
  if (t.includes("argument") || t.includes("argued")) return HeartCrack;
  if (t.includes("quality time") || t.includes("reach") || t.includes("family") || t.includes("friend") || t.includes("called")) return Handshake;

  if (t.includes("truth") || t.includes("spoke") || t.includes("speak") || t.includes("compliment")) return MessageCircle;
  if (t.includes("sorry") || t.includes("interrupt") || t.includes("swore") || t.includes("calm") || t.includes("react")) return MessageSquare;
  if (t.includes("voice") && !t.includes("voice note")) return Volume2;
  if (t.includes("said no") || t.includes("raised my voice")) return Volume2;

  if (t.includes("sleep") || t.includes("slept")) return Moon;
  if (t.includes("move") || t.includes("exercise") || t.includes("danced") || t.includes("dance")) return Dumbbell;
  if (t.includes("water") || t.includes("hydrat")) return Droplet;
  if (t.includes("caffeine") || t.includes("drink")) return Coffee;
  if (t.includes("ate") || t.includes("meal") || t.includes("eating")) return Utensils;

  if (t.includes("learn") || t.includes("read")) return BookOpen;
  if (t.includes("kind") || t.includes("random")) return Sparkles;
  if (t.includes("nature")) return Leaf;
  if (t.includes("lucky") || t.includes("found") || t.includes("déjà")) return Clover;
  if (t.includes("changed my mind") || t.includes("new life")) return RefreshCw;

  if (t.includes("laugh")) return Laugh;
  if (t.includes("dream")) return Moon;
  if (t.includes("joke") || t.includes("made") || t.includes("meme")) return Drama;
  if (t.includes("color") || t.includes("wore") || t.includes("bright")) return Star;
  if (t.includes("sang") || t.includes("sing") || t.includes("music")) return Music;

  if (t.includes("voice note")) return Mic;
  if (t.includes("scroll") || t.includes("doom")) return Smartphone;
  if (t.includes("post") || t.includes("like") || t.includes("comment")) return Camera;
  if (t.includes("phone")) return PhoneOff;
  if (t.includes("compare") || t.includes("ex's") || t.includes("ex profile") || t.includes("checked ex")) return Users;

  if (t.includes("child") || t.includes("baby")) return Heart;

  // Fallback: use category icon so we never show a generic orphan star
  if (category) return getCategoryIcon(category);
  return Star;
};
