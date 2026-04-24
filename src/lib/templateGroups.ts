// This file is kept for backwards compatibility
// New templates use lifeStreams.ts instead
import { Tracker, ProblemWhen } from "@/types/tracker";

export interface TemplateGroup {
  id: string;
  title: string;
  description: string;
  templates: Array<{
    id: string;
    title: string;
    questionText: string;
    category: Tracker["category"];
    subcategory?: string;
    periodDays: number;
    threshold: number;
    problemWhen: ProblemWhen;
    adviceAboveThreshold: string;
  }>;
}

export const TEMPLATE_GROUPS: TemplateGroup[] = [
  {
    id: "emotions-mind",
    title: "Emotions & Mind",
    description: "Track how often your emotional state becomes really difficult.",
    templates: [
      {
        id: "low-mood-days",
        title: "Low mood days",
        subcategory: "Low energy",
        questionText: "Was your mood very low for most of the day?",
        category: "Emotions",
        periodDays: 50,
        threshold: 25,
        problemWhen: "yes",
        adviceAboveThreshold:
          "Many days with very low mood noticed. Consider talking to a mental health professional for support.",
      },
      {
        id: "no-energy-days",
        title: "No energy days",
        subcategory: "Low energy",
        questionText: "Did you feel exhausted and without energy for most of the day?",
        category: "Emotions",
        periodDays: 30,
        threshold: 15,
        problemWhen: "yes",
        adviceAboveThreshold:
          "Frequent low-energy days emerging. This could signal burnout or stress. Consider slowing down and asking for support.",
      },
      {
        id: "anxiety-days",
        title: "Anxiety days",
        subcategory: "Anxiety",
        questionText: "Did you feel anxious or on edge most of the day?",
        category: "Emotions",
        periodDays: 30,
        threshold: 12,
        problemWhen: "yes",
        adviceAboveThreshold:
          "Anxiety appearing often. It might be helpful to talk to a therapist or doctor.",
      },
    ],
  },
  {
    id: "connections-love",
    title: "Connections & Love",
    description: "Notice patterns in how your close relationships feel.",
    templates: [
      {
        id: "arguments-partner",
        title: "Arguments with partner",
        subcategory: "Partner",
        questionText: "Did you have a serious argument with your partner today?",
        category: "Connections",
        periodDays: 30,
        threshold: 10,
        problemWhen: "yes",
        adviceAboveThreshold:
          "Frequent arguments noticed. It may be time to talk openly together or consider couples therapy.",
      },
      {
        id: "feeling-close-partner",
        title: "Feeling close to partner",
        subcategory: "Partner",
        questionText: "Did you feel emotionally close to your partner today?",
        category: "Connections",
        periodDays: 30,
        threshold: 15,
        problemWhen: "no",
        adviceAboveThreshold:
          "Many days feeling distant. It may be worth talking honestly about needs and expectations.",
      },
      {
        id: "quality-time-family",
        title: "Family quality time",
        subcategory: "Family",
        questionText: "Did you spend any real quality time with your family today?",
        category: "Connections",
        periodDays: 30,
        threshold: 20,
        problemWhen: "no",
        adviceAboveThreshold:
          "Almost no quality time together recently. Small changes in routine may help you reconnect.",
      },
    ],
  },
  {
    id: "voice-work",
    title: "Voice & Work",
    description: "Understand how your job is affecting you over time.",
    templates: [
      {
        id: "want-to-work",
        title: "Do I want to go to work?",
        subcategory: "Motivation",
        questionText: "Did you genuinely want to go to work today?",
        category: "Voice",
        periodDays: 30,
        threshold: 20,
        problemWhen: "no",
        adviceAboveThreshold:
          "Most days you didn't want to go to work. It might be time to rethink your job, workload or environment.",
      },
      {
        id: "burnout-evenings",
        title: "Burned out after work",
        subcategory: "Burnout",
        questionText: "Did you feel completely burned out after work today?",
        category: "Voice",
        periodDays: 30,
        threshold: 12,
        problemWhen: "yes",
        adviceAboveThreshold:
          "Frequent burnout evenings emerging. Your workload, boundaries or role may need attention.",
      },
      {
        id: "overtime-days",
        title: "Overtime days",
        subcategory: "Overload",
        questionText: "Did you work significantly longer than planned today?",
        category: "Voice",
        periodDays: 30,
        threshold: 10,
        problemWhen: "yes",
        adviceAboveThreshold:
          "Constant overtime is rarely sustainable. Consider discussing expectations or protecting your time.",
      },
    ],
  },
  {
    id: "health-body",
    title: "Health & Body",
    description: "Track recurring physical issues and helpful habits.",
    templates: [
      {
        id: "migraine-days",
        title: "Migraine days",
        subcategory: "Headache / Migraine",
        questionText: "Did you have a migraine today?",
        category: "Health",
        periodDays: 90,
        threshold: 15,
        problemWhen: "yes",
        adviceAboveThreshold:
          "Migraines appearing very often. Consider talking to a neurologist about preventive treatment.",
      },
      {
        id: "poor-sleep",
        title: "Poor sleep nights",
        subcategory: "Sleep",
        questionText: "Did you sleep poorly or less than 6 hours last night?",
        category: "Health",
        periodDays: 30,
        threshold: 15,
        problemWhen: "yes",
        adviceAboveThreshold:
          "Frequent poor sleep can affect mood, focus and health. Consider improving sleep habits or consulting a specialist.",
      },
      {
        id: "movement-exercise",
        title: "Moved my body",
        subcategory: "Movement",
        questionText: "Did you intentionally move your body today (walk, exercise, stretch)?",
        category: "Health",
        periodDays: 30,
        threshold: 18,
        problemWhen: "no",
        adviceAboveThreshold:
          "Most days pass without intentional movement. Starting with small, gentle activity could already help.",
      },
    ],
  },
  {
    id: "habits-substances",
    title: "Habits & substances",
    description: "Notice patterns in alcohol, screens and other habits.",
    templates: [
      {
        id: "alcohol-days",
        title: "Alcohol days",
        subcategory: "Alcohol",
        questionText: "Did you drink alcohol today?",
        category: "Health",
        periodDays: 30,
        threshold: 12,
        problemWhen: "yes",
        adviceAboveThreshold:
          "Alcohol present on many days. It may be helpful to reconsider your habits or talk to a professional.",
      },
      {
        id: "late-bedtime",
        title: "After-midnight bedtime",
        subcategory: "Bedtime",
        questionText: "Did you go to bed after midnight today?",
        category: "Health",
        periodDays: 30,
        threshold: 18,
        problemWhen: "yes",
        adviceAboveThreshold:
          "Frequently going to bed very late. Small changes to evening routines can help.",
      },
      {
        id: "doomscrolling",
        title: "Doomscrolling evenings",
        subcategory: "Screen time",
        questionText: "Did you spend a lot of time doomscrolling or stuck in social media tonight?",
        category: "Social",
        periodDays: 30,
        threshold: 15,
        problemWhen: "yes",
        adviceAboveThreshold:
          "Most evenings end in doomscrolling. It might be helpful to set gentle limits or replace it with something calming.",
      },
    ],
  },
  {
    id: "curious-fun",
    title: "Curious & Fun",
    description: "Light-weight trackers for curiosity or playful experiments.",
    templates: [
      {
        id: "dog-accidents",
        title: "Dog accidents at home",
        subcategory: "User-defined",
        questionText: "Did your dog pee or poop at home today?",
        category: "Curious",
        periodDays: 30,
        threshold: 10,
        problemWhen: "yes",
        adviceAboveThreshold:
          "Frequent accidents noticed. May be time to check health, routine or training.",
      },
      {
        id: "met-someone-new",
        title: "Met someone new",
        subcategory: "User-defined",
        questionText: "Did you meet a new person today that you actually spoke with?",
        category: "Curious",
        periodDays: 30,
        threshold: 3,
        problemWhen: "no",
        adviceAboveThreshold:
          "Want more connection but rarely meet new people? Try changing a small routine or activity.",
      },
      {
        id: "creative-day",
        title: "Creative days",
        subcategory: "User-defined",
        questionText: "Did you do anything creative today (writing, drawing, music, ideas)?",
        category: "Curious",
        periodDays: 30,
        threshold: 15,
        problemWhen: "no",
        adviceAboveThreshold:
          "Creativity is important to you but happens rarely. Blocking even 15 minutes can make a difference.",
      },
    ],
  },
];
