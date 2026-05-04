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

  // Each branch lists ENGLISH keywords first, then RUSSIAN word stems
  // (1.7.3+). Without the ru stems, a tracker stored as "Сегодня
  // голова болела" wouldn't match any English keyword and fell
  // through to the category fallback — which for Body returns
  // Sparkles (looks like a star), confusing users into thinking
  // the icon was wrong. Stems use prefixes (e.g. "болел", "болит")
  // so they catch all gendered/declined forms.

  if (t.includes("mood") || t.includes("anxiety") || t.includes("anxious")
      || t.includes("настроен") || t.includes("тревож") || t.includes("тревог")) return Brain;
  if (t.includes("cry") || t.includes("cried") || t.includes("empty") || t.includes("disappear") || t.includes("lonely")
      || t.includes("плакал") || t.includes("плач") || t.includes("одинок") || t.includes("пустот")) return HeartCrack;
  if (t.includes("fog") || t.includes("creative") || t.includes("inspired") || t.includes("imagined")
      || t.includes("туман") || t.includes("творч") || t.includes("вдохнов") || t.includes("представ")) return Cloud;

  if (t.includes("headache") || t.includes("migraine") || t.includes("pill") || t.includes("medication") || t.includes("side effect")
      || t.includes("голов") || t.includes("мигрен") || t.includes("таблет") || t.includes("лекарств") || t.includes("побочн")) return Pill;
  if (t.includes("energy") || t.includes("energiz")
      || t.includes("энерг") || t.includes("бодр")) return Zap;
  if (t.includes("stomach") || t.includes("pain") || t.includes("cramp") || t.includes("hurt") || t.includes("back")
      || t.includes("живот") || t.includes("спин") || t.includes("суста") || t.includes("болит") || t.includes("болел") || t.includes("спазм")) return Bandage;
  if (t.includes("rested") || t.includes("woke up") || t.includes("good") || t.includes("beautiful")
      || t.includes("отдохн") || t.includes("выспал") || t.includes("красив")) return Sparkles;
  if (t.includes("dizzy") || t.includes("stumbled") || t.includes("tired") || t.includes("trip")
      || t.includes("кружил") || t.includes("устал") || t.includes("истощ") || t.includes("выжат")) return Cloud;

  if (t.includes("love") || t.includes("partner") || t.includes("gratitude") || t.includes("close") || t.includes("hug") || t.includes("flower") || t.includes("smile")
      || t.includes("любим") || t.includes("партнёр") || t.includes("партнер") || t.includes("близост") || t.includes("обним") || t.includes("обнял") || t.includes("улыбн")) return Heart;
  if (t.includes("argument") || t.includes("argued")
      || t.includes("ссор") || t.includes("поссорил") || t.includes("ругал")) return HeartCrack;
  if (t.includes("quality time") || t.includes("reach") || t.includes("family") || t.includes("friend") || t.includes("called")
      || t.includes("друз") || t.includes("подруг") || t.includes("семь") || t.includes("звонил") || t.includes("позвон") || t.includes("связал")) return Handshake;

  if (t.includes("truth") || t.includes("spoke") || t.includes("speak") || t.includes("compliment")
      || t.includes("правд") || t.includes("сказал") || t.includes("комплимент")) return MessageCircle;
  if (t.includes("sorry") || t.includes("interrupt") || t.includes("swore") || t.includes("calm") || t.includes("react")
      || t.includes("извинил") || t.includes("перебивал") || t.includes("матом") || t.includes("спокойн") || t.includes("реагир")) return MessageSquare;
  if (t.includes("voice") && !t.includes("voice note")) return Volume2;
  if (t.includes("said no") || t.includes("raised my voice")
      || t.includes("повышал голос") || t.includes("крич") || t.includes("сказал нет")) return Volume2;

  if (t.includes("sleep") || t.includes("slept")
      || t.includes("спал") || t.includes("сну") || t.includes("сон")) return Moon;
  if (t.includes("move") || t.includes("exercise") || t.includes("danced") || t.includes("dance")
      || t.includes("двигал") || t.includes("трениров") || t.includes("зарядк") || t.includes("танцевал")) return Dumbbell;
  if (t.includes("water") || t.includes("hydrat")
      || t.includes("воду") || t.includes("воды")) return Droplet;
  if (t.includes("caffeine") || t.includes("drink")
      || t.includes("кофе") || t.includes("кофеин")) return Coffee;
  if (t.includes("ate") || t.includes("meal") || t.includes("eating")
      || t.includes("ел(а)") || t.includes("ел ") || t.includes("ела ") || t.includes("обед") || t.includes("завтрак") || t.includes("ужин") || t.includes("осознанн")) return Utensils;

  if (t.includes("learn") || t.includes("read")
      || t.includes("учил") || t.includes("узнал") || t.includes("читал") || t.includes("книг")) return BookOpen;
  if (t.includes("kind") || t.includes("random")
      || t.includes("доброт") || t.includes("случайн доброт")) return Sparkles;
  if (t.includes("nature")
      || t.includes("природ")) return Leaf;
  if (t.includes("lucky") || t.includes("found") || t.includes("déjà")
      || t.includes("удач") || t.includes("дежавю") || t.includes("нашёл") || t.includes("нашла")) return Clover;
  if (t.includes("changed my mind") || t.includes("new life")
      || t.includes("поменял мнен") || t.includes("новую жизн")) return RefreshCw;

  if (t.includes("laugh")
      || t.includes("смеял") || t.includes("смех") || t.includes("рассмеш")) return Laugh;
  if (t.includes("dream")
      || t.includes("снил") || t.includes("сновид")) return Moon;
  if (t.includes("joke") || t.includes("made") || t.includes("meme")
      || t.includes("шутк") || t.includes("мем")) return Drama;
  if (t.includes("color") || t.includes("wore") || t.includes("bright")
      || t.includes("ярк") || t.includes("надел")) return Star;
  if (t.includes("sang") || t.includes("sing") || t.includes("music")
      || t.includes("пел") || t.includes("музык")) return Music;

  if (t.includes("voice note")
      || t.includes("голосов")) return Mic;
  if (t.includes("scroll") || t.includes("doom")
      || t.includes("залип") || t.includes("скролл")) return Smartphone;
  if (t.includes("post") || t.includes("like") || t.includes("comment")
      || t.includes("выложил") || t.includes("выставил") || t.includes("лайк") || t.includes("коммент")) return Camera;
  if (t.includes("phone")
      || t.includes("телефон") || t.includes("телефона")) return PhoneOff;
  if (t.includes("compare") || t.includes("ex's") || t.includes("ex profile") || t.includes("checked ex")
      || t.includes("сравнивал") || t.includes("бывш") || t.includes("профил")) return Users;

  if (t.includes("child") || t.includes("baby")
      || t.includes("ребёнк") || t.includes("ребенк") || t.includes("ребёнок") || t.includes("ребенок") || t.includes("малыш")) return Heart;

  // Fallback: use category icon so we never show a generic orphan star
  if (category) return getCategoryIcon(category);
  return Star;
};
