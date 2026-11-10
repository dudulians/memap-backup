// Generated from the tips research (Nov 8 2026): marketing/research/sources.md and the studies it lists.
// Each tip points at a library question (lifeStreams / research / body templates).
// The source stays here for checks and is not shown in the app (her content audit, Nov 10 2026); `review` says
// how a tip was checked: rewritten, needs-source-check, or held (not shown until a direct source is found).
import type { ObserveTip } from "@/lib/observeTips";

export const OBSERVE_TIPS: ObserveTip[] = [
  {
    "id": "coffee-after-2pm",
    "templateId": "coffee-late",
    "en": {
      "title": "Late coffee",
      "line": "Caffeine close to bedtime can affect sleep, even if you don't notice it. Compare nights after late coffee."
    },
    "ru": {
      "title": "Кофе ближе к вечеру",
      "line": "Кофеин незадолго до сна может влиять на его качество, даже если ты этого не замечаешь. Сравни ночи после позднего кофе."
    },
    "source": {
      "name": "Drake et al., J Clin Sleep Med 2013",
      "url": "https://doi.org/10.5664/jcsm.3170"
    },
    "review": {
      "status": "rewritten",
      "limits": "The study timed caffeine against bedtime (0, 3 and 6 hours before), not a clock time: no universal 2 pm cutoff. The question still asks about caffeine after 2 pm.",
      "date": "2026-11-10",
      "source": "VERIFIED",
      "sourceNote": "RCT, n=12, 400 mg at 0/3/6 h before bed; subjective sleep not affected at 6 h. Question: after 2 pm is a wider proxy."
    }
  },
  {
    "id": "same-wake-time",
    "templateId": "same-wake-time",
    "en": {
      "title": "Same wake-up time",
      "line": "Irregular sleep and wake times are linked to poorer sleep. See whether a steadier routine makes a difference for you."
    },
    "ru": {
      "title": "Подъём в одно время",
      "line": "Нестабильный режим сна связан с его худшим качеством. Посмотри, как спится при более постоянном времени подъёма."
    },
    "source": {
      "name": "Bei et al., Sleep Med Rev 2016",
      "url": "https://doi.org/10.1016/j.smrv.2015.06.003"
    },
    "review": {
      "status": "rewritten",
      "limits": "Review of observational studies: irregular sleep goes with poorer sleep; no proven effect of wake time alone on mood.",
      "date": "2026-11-10",
      "source": "VERIFIED",
      "sourceNote": "Systematic review of 53 mostly observational studies; reducing variability experimentally was inconclusive."
    }
  },
  {
    "id": "bedtime-worries",
    "templateId": "racing-thoughts-in-bed",
    "en": {
      "title": "Worries at bedtime",
      "line": "Stress and worries at bedtime have been linked to poorer sleep. Notice how your nights go after restless evenings."
    },
    "ru": {
      "title": "Тревожные мысли перед сном",
      "line": "Стресс и тревожные мысли перед сном связаны с худшим сном. Посмотри, как проходят ночи после беспокойных вечеров."
    },
    "source": {
      "name": "Åkerstedt et al., Sleep Med 2012",
      "url": "https://doi.org/10.1016/j.sleep.2011.12.013"
    },
    "review": {
      "status": "rewritten",
      "limits": "One diary study; not a universal predictor.",
      "date": "2026-11-10",
      "source": "VERIFIED",
      "sourceNote": "Diary study, n=50. Question mixes worry with the sleep outcome (kept you awake)."
    }
  },
  {
    "id": "morning-daylight",
    "templateId": "saw-daylight",
    "en": {
      "title": "Morning daylight",
      "line": "Earlier daylight exposure has been linked to some aspects of sleep. Notice whether nights after mornings outdoors feel different."
    },
    "ru": {
      "title": "Дневной свет утром",
      "line": "Утренний дневной свет может быть связан с особенностями сна. Посмотри, отличаются ли ночи после времени на улице утром."
    },
    "source": {
      "name": "Wams et al., Sleep 2017",
      "url": "https://doi.org/10.1093/sleep/zsx165"
    },
    "review": {
      "status": "rewritten",
      "limits": "Small study; no general improvement in sleep quality shown. Check that the question asks about morning daylight.",
      "date": "2026-11-10",
      "source": "PARTIAL",
      "sourceNote": "n=20 students; measured first light >10 lux from any source, not outdoor daylight; causality unconfirmed."
    }
  },
  {
    "id": "short-nights-mood",
    "templateId": "slept-enough",
    "en": {
      "title": "Sleep and mood",
      "line": "How you sleep and how you feel the next day are closely connected. Compare your mood after nights when you felt you had enough sleep."
    },
    "ru": {
      "title": "Сон и настроение",
      "line": "Сон и настроение на следующий день тесно связаны. Сравни своё настроение после ночей, когда удалось выспаться."
    },
    "source": {
      "name": "Triantafillou et al., JMIR Mental Health 2019",
      "url": "https://doi.org/10.2196/12613"
    },
    "review": {
      "status": "needs-source-check",
      "limits": "The cited study looked mainly at sleep quality, not short sleep: check that the source still matches the question.",
      "date": "2026-11-10",
      "source": "PARTIAL",
      "sourceNote": "Study used self-rated sleep quality, not hours; the 7+ hours question needs a sleep-length source. 71% screened positive for depression/anxiety."
    }
  },
  {
    "id": "time-for-hobby",
    "templateId": "hobby-time",
    "en": {
      "title": "Time for a hobby",
      "line": "Making time for something you enjoy may support your well-being. Notice how days with a hobby feel."
    },
    "ru": {
      "title": "Время на хобби",
      "line": "Время на любимое дело может положительно влиять на самочувствие. Посмотри, как проходят дни, когда находится время на хобби."
    },
    "source": {
      "name": "NICE guideline NG222",
      "url": "https://www.nice.org.uk/guidance/ng222"
    },
    "review": {
      "status": "held",
      "limits": "The NICE guideline does not directly support this tip: not shown until a directly relevant source is found.",
      "date": "2026-11-10",
      "source": "MISMATCH",
      "sourceNote": "NICE NG222 is a depression treatment guideline with nothing on hobbies. Candidate opened by the checker: Mak et al., Nat Med 2023, doi 10.1038/s41591-023-02506-1 (adults 65+ only, observational) — not applied."
    }
  },
  {
    "id": "green-places",
    "templateId": "time-in-nature",
    "en": {
      "title": "Time in nature",
      "line": "Spending time around natural surroundings has been linked to better mood. Notice how days outdoors feel for you."
    },
    "ru": {
      "title": "Время на природе",
      "line": "Время среди природы связано с более хорошим настроением. Замечай, как проходят дни, когда удаётся побыть на свежем воздухе."
    },
    "source": {
      "name": "Bakolis et al., BioScience 2018",
      "url": "https://doi.org/10.1093/biosci/bix149"
    },
    "review": {
      "status": "rewritten",
      "limits": "Association, not proof that nature itself lifts mood.",
      "date": "2026-11-10",
      "source": "VERIFIED",
      "sourceNote": "n=108 self-selected, mostly university-educated; outcome was momentary well-being; 'by water' showed no consistent effect."
    }
  },
  {
    "id": "good-moments",
    "templateId": "felt-grateful",
    "en": {
      "title": "Noticing good moments",
      "line": "Taking a moment to appreciate good things may give a small boost to well-being. See if you notice a difference."
    },
    "ru": {
      "title": "Замечать хорошее",
      "line": "Если уделять немного времени хорошим моментам и чувству благодарности, самочувствие может немного улучшиться. Проверь, замечаешь ли ты разницу."
    },
    "source": {
      "name": "Davis et al., J Couns Psychol 2016",
      "url": "https://doi.org/10.1037/cou0000107"
    },
    "review": {
      "status": "rewritten",
      "limits": "Evidence is about gratitude practices, not simply noticing something pleasant.",
      "date": "2026-11-10",
      "source": "VERIFIED",
      "sourceNote": "Meta-analysis of gratitude interventions (d=.31 vs controls); the question 'noticed something good' is a looser proxy."
    }
  },
  {
    "id": "water-through-day",
    "templateId": "drank-water",
    "en": {
      "title": "Water through the day",
      "line": "Even mild dehydration can be linked to tiredness and headaches. Notice how you feel on days when you drink less water."
    },
    "ru": {
      "title": "Вода в течение дня",
      "line": "Даже лёгкое обезвоживание может сопровождаться усталостью и головной болью. Посмотри, как чувствуешь себя в дни, когда пьёшь меньше воды."
    },
    "source": {
      "name": "Armstrong et al., J Nutr 2012",
      "url": "https://doi.org/10.3945/jn.111.142000"
    },
    "review": {
      "status": "rewritten",
      "limits": "Not a universal personal hydration requirement.",
      "date": "2026-11-10",
      "source": "PARTIAL",
      "sourceNote": "Lab experiment, n=25 young women, exercise-induced dehydration; the 1.5 L threshold in the question is not from this study."
    }
  },
  {
    "id": "drained-days",
    "templateId": "felt-fatigued",
    "en": {
      "title": "Drained days",
      "line": "Sleep, stress and daily demands can all contribute to tiredness. Tracking low-energy days may help you notice patterns."
    },
    "ru": {
      "title": "Дни без сил",
      "line": "На усталость могут влиять сон, стресс и повседневная нагрузка. Отмечай дни без сил, чтобы замечать возможные закономерности."
    },
    "source": {
      "name": "NHS: Tiredness and fatigue",
      "url": "https://www.nhs.uk/symptoms/tiredness-and-fatigue/"
    },
    "review": {
      "status": "rewritten",
      "limits": "Tracking does not reveal the cause of fatigue.",
      "date": "2026-11-10",
      "source": "VERIFIED",
      "sourceNote": "NHS page (reviewed June 2023) lists sleep, stress, life challenges as common causes."
    }
  },
  {
    "id": "late-naps",
    "templateId": "napped",
    "en": {
      "title": "Daytime naps",
      "line": "The timing of a daytime nap may affect sleep later that night. See how nights after naps compare."
    },
    "ru": {
      "title": "Дневной сон",
      "line": "Время дневного сна может влиять на ночной сон. Посмотри, отличаются ли ночи после дней, когда удаётся поспать днём."
    },
    "source": {
      "name": "Mograss et al., J Sleep Res 2022",
      "url": "https://doi.org/10.1111/jsr.13578"
    },
    "review": {
      "status": "rewritten",
      "limits": "Source is about late naps; the question records any nap.",
      "date": "2026-11-10",
      "source": "PARTIAL",
      "sourceNote": "Observational, n=62; about naps within 7 h of bedtime; the question doesn't record timing."
    }
  },
  {
    "id": "evening-drink",
    "templateId": "drank-alcohol",
    "en": {
      "title": "Alcohol in the evening",
      "line": "Alcohol may make it easier to fall asleep but can disrupt sleep later in the night. Compare the mornings after."
    },
    "ru": {
      "title": "Алкоголь вечером",
      "line": "Алкоголь может помочь быстрее уснуть, но нарушать сон во второй половине ночи. Сравни, как проходят утра после таких вечеров."
    },
    "source": {
      "name": "Ebrahim et al., Alcohol Clin Exp Res 2013",
      "url": "https://doi.org/10.1111/acer.12006"
    },
    "review": {
      "status": "rewritten",
      "limits": "General information; alcohol is not a sleep aid.",
      "date": "2026-11-10",
      "source": "VERIFIED",
      "sourceNote": "Review of lab studies, all doses."
    }
  },
  {
    "id": "four-plus-coffees",
    "templateId": "caffeine-4-plus",
    "en": {
      "title": "Several coffees a day",
      "line": "Higher doses of caffeine may increase anxiety for some people. Notice whether days with several coffees feel different."
    },
    "ru": {
      "title": "Несколько чашек кофе в день",
      "line": "Большие дозы кофеина могут усиливать тревогу у некоторых людей. Посмотри, отличаются ли дни, когда пьёшь много кофе."
    },
    "source": {
      "name": "Liu et al., Front Psychol 2024",
      "url": "https://doi.org/10.3389/fpsyg.2024.1270246"
    },
    "review": {
      "status": "rewritten",
      "limits": "The meta-analysis is about caffeine doses (around 400 mg), not four cups; the question counts 4+ coffees as a personal variable.",
      "date": "2026-11-10",
      "source": "PARTIAL",
      "sourceNote": "Meta-analysis of 8 small studies (546 people, I²≈95%), mostly single lab doses; strongest above 400 mg; 4 strong teas is well under that."
    }
  },
  {
    "id": "gaps-without-food",
    "templateId": "skipped-meal",
    "en": {
      "title": "Skipped meals and headaches",
      "line": "Some people with migraine report skipped meals as a possible trigger. Notice whether missed meals and headaches coincide for you."
    },
    "ru": {
      "title": "Пропуск еды и головная боль",
      "line": "Некоторые люди с мигренью называют пропуск еды возможным триггером. Посмотри, совпадают ли у тебя такие дни с головной болью."
    },
    "source": {
      "name": "Kelman, Cephalalgia 2007",
      "url": "https://doi.org/10.1111/j.1468-2982.2007.01303.x"
    },
    "review": {
      "status": "rewritten",
      "limits": "Self-reported triggers, not causation; not everyone has migraine.",
      "date": "2026-11-10",
      "source": "VERIFIED",
      "sourceNote": "n=1,207 migraine patients, 57% named not eating as a trigger (self-report)."
    }
  },
  {
    "id": "late-big-meals",
    "templateId": "ate-late",
    "en": {
      "title": "Meals before bed",
      "line": "Eating close to bedtime can make heartburn worse for some people. Notice whether the timing of your evening meal matters."
    },
    "ru": {
      "title": "Еда перед сном",
      "line": "Еда незадолго до сна может усиливать изжогу. Посмотри, имеет ли для тебя значение время ужина."
    },
    "source": {
      "name": "NHS: Heartburn and acid reflux",
      "url": "https://www.nhs.uk/conditions/heartburn-and-acid-reflux/"
    },
    "review": {
      "status": "rewritten",
      "limits": "NHS guidance on reflux and heartburn, not a universal 3–4 hour rule.",
      "date": "2026-11-10",
      "source": "VERIFIED",
      "sourceNote": "NHS page (review due 20 Nov 2026) says 3–4 h; the EN question has no time limit while the RU question says <2 h."
    }
  },
  {
    "id": "about-7000-steps",
    "templateId": "walked-a-lot",
    "en": {
      "title": "Walking more",
      "line": "Higher daily step counts have been linked to lower long-term health risks. Notice how often you make time to walk more."
    },
    "ru": {
      "title": "Больше ходьбы",
      "line": "Большее количество шагов в день связано с меньшими долгосрочными рисками для здоровья. Посмотри, как часто получается больше ходить."
    },
    "source": {
      "name": "Ding et al., Lancet Public Health 2025",
      "url": "https://doi.org/10.1016/S2468-2667(25)00164-1"
    },
    "review": {
      "status": "rewritten",
      "limits": "The study measured step counts; the question is about walking in general — no step number.",
      "date": "2026-11-10",
      "source": "VERIFIED",
      "sourceNote": "Meta-analysis of device-measured steps (erratum 2025;10(9):e731); usual daily average, not a single day."
    }
  },
  {
    "id": "workouts-and-mood",
    "templateId": "exercised",
    "en": {
      "title": "Workouts and mood",
      "line": "Physical activity is often followed by a more positive mood. Notice how you feel on days when you exercise."
    },
    "ru": {
      "title": "Тренировки и настроение",
      "line": "После физической активности настроение нередко становится лучше. Посмотри, как чувствуешь себя в дни с тренировкой."
    },
    "source": {
      "name": "Liao et al., Front Psychol 2015",
      "url": "https://doi.org/10.3389/fpsyg.2015.01975"
    },
    "review": {
      "status": "rewritten",
      "limits": "Energy claim removed.",
      "date": "2026-11-10",
      "source": "VERIFIED",
      "sourceNote": "Review of 14 everyday-life studies; positive mood over the next hours."
    }
  },
  {
    "id": "hard-workouts-late",
    "templateId": "trained-hard",
    "en": {
      "title": "Hard workouts and sleep",
      "line": "How hard and how late you exercise may affect your sleep. Notice how you sleep after more intense workout days."
    },
    "ru": {
      "title": "Интенсивные тренировки и сон",
      "line": "Интенсивность и время тренировки могут влиять на сон. Посмотри, как спится после дней с высокой нагрузкой."
    },
    "source": {
      "name": "Stutz et al., Sports Med 2019",
      "url": "https://doi.org/10.1007/s40279-018-1015-0"
    },
    "review": {
      "status": "rewritten",
      "limits": "The question may not record workout timing.",
      "date": "2026-11-10",
      "source": "PARTIAL",
      "sourceNote": "Main finding: evening exercise did not harm sleep; only vigorous exercise ending ≤1 h before bed might; the question has no timing."
    }
  },
  {
    "id": "screens-before-sleep",
    "templateId": "screens-before-bed",
    "en": {
      "title": "Screens before sleep",
      "line": "Screen use before bed has been linked to poorer sleep, though cause and effect aren't clear. Look for patterns in your own nights."
    },
    "ru": {
      "title": "Экран перед сном",
      "line": "Использование экрана перед сном связано с худшим сном, хотя причинная связь неясна. Понаблюдай, есть ли такая закономерность у тебя."
    },
    "source": {
      "name": "Brautsch et al., Sleep Med Rev 2023",
      "url": "https://doi.org/10.1016/j.smrv.2022.101742"
    },
    "review": {
      "status": "rewritten",
      "limits": "Causation unclear.",
      "date": "2026-11-10",
      "source": "PARTIAL",
      "sourceNote": "Review of 42 observational studies, ages 16–25 only; not for TV, consoles or tablets."
    }
  },
  {
    "id": "social-media-time",
    "templateId": "social-media-hour",
    "en": {
      "title": "Time on social media",
      "line": "Limiting social media use has shown small benefits for well-being in some studies. See if less scrolling makes a difference for you."
    },
    "ru": {
      "title": "Время в соцсетях",
      "line": "В некоторых исследованиях ограничение соцсетей немного улучшало самочувствие. Проверь, замечаешь ли ты разницу, когда проводишь в них меньше времени."
    },
    "source": {
      "name": "Burnell et al., SSM – Mental Health 2025 (meta-analysis of 32 articles)",
      "url": "https://doi.org/10.1016/j.ssmmh.2025.100459"
    },
    "review": {
      "status": "rewritten",
      "limits": "Small, mixed effects.",
      "date": "2026-11-10",
      "source": "PARTIAL",
      "sourceNote": "Meta-analysis of RCTs, g=0.17 (small), mean age 23; the 1-hour threshold was not studied."
    }
  },
  {
    "id": "too-much-news",
    "templateId": "doomscrolled-news",
    "en": {
      "title": "Too much news",
      "line": "News you experience as negative may be linked to a lower mood. Notice how you feel after following the news."
    },
    "ru": {
      "title": "Слишком много новостей",
      "line": "Новости, которые воспринимаются негативно, могут быть связаны с ухудшением настроения. Замечай, как чувствуешь себя после их чтения."
    },
    "source": {
      "name": "de Hoog & Verboon, Br J Psychol 2020",
      "url": "https://doi.org/10.1111/bjop.12389"
    },
    "review": {
      "status": "rewritten",
      "limits": "Not proof that longer news sessions cause low mood.",
      "date": "2026-11-10",
      "source": "PARTIAL",
      "sourceNote": "n=63; effect of how negative news felt, not time spent; sports feeds not studied."
    }
  },
  {
    "id": "stress-lingers",
    "templateId": "felt-stressed",
    "en": {
      "title": "Stress that lingers",
      "line": "A stressful day can still affect how you feel the following day. Notice what tends to follow your harder days."
    },
    "ru": {
      "title": "Стресс, который не отпускает",
      "line": "Стрессовый день может влиять на настроение и на следующий день. Посмотри, что обычно следует за особенно напряжёнными днями."
    },
    "source": {
      "name": "Leger et al., Psychol Sci 2018",
      "url": "https://doi.org/10.1177/0956797618763097"
    },
    "review": {
      "status": "rewritten",
      "date": "2026-11-10",
      "source": "VERIFIED",
      "sourceNote": "US national diary sample, N=1,155."
    }
  },
  {
    "id": "constant-interruptions",
    "templateId": "many-interruptions",
    "en": {
      "title": "Constant interruptions",
      "line": "In one experiment, interruptions made people work faster but also feel more stressed and frustrated. Notice how interrupted days feel for you."
    },
    "ru": {
      "title": "Постоянные отвлечения",
      "line": "В одном эксперименте из-за отвлечений люди работали быстрее, но испытывали больше стресса и раздражения. Понаблюдай за своими днями с частыми отвлечениями."
    },
    "source": {
      "name": "Mark et al., CHI 2008",
      "url": "https://doi.org/10.1145/1357054.1357072"
    },
    "review": {
      "status": "rewritten",
      "limits": "One lab experiment.",
      "date": "2026-11-10",
      "source": "VERIFIED",
      "sourceNote": "Lab experiment, 48 mostly students, 20-minute email task; meetings and whole days not studied."
    }
  },
  {
    "id": "drained-after-work",
    "templateId": "burned-out-after-work",
    "en": {
      "title": "Drained after work",
      "line": "A small study found that some parents withdrew more from their children after stressful workdays. Notice how work stress affects your evenings."
    },
    "ru": {
      "title": "Без сил после работы",
      "line": "В небольшом исследовании после напряжённых рабочих дней некоторые родители меньше общались с детьми. Посмотри, как рабочий стресс отражается на твоих вечерах."
    },
    "source": {
      "name": "Repetti & Wood, J Fam Psychol 1997",
      "url": "https://doi.org/10.1037/0893-3200.11.1.90"
    },
    "review": {
      "status": "rewritten",
      "limits": "Small study of working mothers of preschool children.",
      "date": "2026-11-10",
      "source": "PARTIAL",
      "sourceNote": "30 working mothers of preschoolers (1989–90); measured workload and work conflict, not feeling drained; only relevant to parents."
    }
  },
  {
    "id": "calm-minutes",
    "templateId": "meditated",
    "en": {
      "title": "A few calm minutes",
      "line": "Mindfulness meditation apps have shown small reductions in stress in studies. Notice whether days with meditation feel calmer for you."
    },
    "ru": {
      "title": "Несколько спокойных минут",
      "line": "В исследованиях приложения для медитации помогали немного снизить стресс. Посмотри, спокойнее ли проходят дни с медитацией."
    },
    "source": {
      "name": "Gál et al., J Affect Disord 2021",
      "url": "https://doi.org/10.1016/j.jad.2020.09.134"
    },
    "review": {
      "status": "rewritten",
      "limits": "Small effects; not guaranteed.",
      "date": "2026-11-10",
      "source": "PARTIAL",
      "sourceNote": "Meta-analysis of 34 RCTs of multi-week app programs (stress g≈0.46); one day of slow breathing was not tested."
    }
  },
  {
    "id": "seeing-people",
    "templateId": "saw-friends",
    "en": {
      "title": "Seeing people in person",
      "line": "Positive in-person interactions have been linked to less loneliness. Notice how you feel after spending time with people."
    },
    "ru": {
      "title": "Встречи вживую",
      "line": "Приятное общение вживую связано с меньшим чувством одиночества. Посмотри, как чувствуешь себя после встреч с людьми."
    },
    "source": {
      "name": "Silva et al., J Soc Pers Relat 2023",
      "url": "https://doi.org/10.1177/02654075231181709"
    },
    "review": {
      "status": "rewritten",
      "limits": "Quality of the interaction matters.",
      "date": "2026-11-10",
      "source": "VERIFIED",
      "sourceNote": "14-day diary, 269 adults; in-person contact with anyone."
    }
  },
  {
    "id": "real-conversations",
    "templateId": "deep-conversation",
    "en": {
      "title": "Real conversations",
      "line": "Meaningful conversations have been linked to greater well-being and connection. Notice how days with deeper conversations feel."
    },
    "ru": {
      "title": "Разговоры по душам",
      "line": "Содержательные разговоры связаны с лучшим самочувствием и ощущением близости. Посмотри, как проходят дни с разговорами по душам."
    },
    "source": {
      "name": "Sun, Harris & Vazire, JPSP 2020",
      "url": "https://doi.org/10.1037/pspp0000272"
    },
    "review": {
      "status": "rewritten",
      "limits": "Small talk is not bad.",
      "date": "2026-11-10",
      "source": "VERIFIED",
      "sourceNote": "N=256, one week, likely students."
    }
  },
  {
    "id": "arguments-after-bad-nights",
    "templateId": "argued-with-partner",
    "en": {
      "title": "Arguments after bad nights",
      "line": "Poor sleep has been linked to more conflict and difficulties resolving disagreements. Notice how conversations go after restless nights."
    },
    "ru": {
      "title": "Ссоры после плохой ночи",
      "line": "Плохой сон связан с более частыми конфликтами и сложностями в разрешении разногласий. Посмотри, как проходят разговоры после беспокойных ночей."
    },
    "source": {
      "name": "Gordon & Chen, Soc Psychol Personal Sci 2014",
      "url": "https://doi.org/10.1177/1948550613488952"
    },
    "review": {
      "status": "rewritten",
      "limits": "Observational.",
      "date": "2026-11-10",
      "source": "VERIFIED",
      "sourceNote": "Diary + lab, young couples; sleep self-reported."
    }
  },
  {
    "id": "help-with-kids",
    "templateId": "got-help-with-kids",
    "en": {
      "title": "Help with the kids",
      "line": "Parenting burnout has been linked to high demands and insufficient support. Notice whether days with help feel different."
    },
    "ru": {
      "title": "Помощь с детьми",
      "line": "Родительское выгорание связано с высокой нагрузкой и недостатком поддержки. Посмотри, отличаются ли дни, когда есть помощь."
    },
    "source": {
      "name": "Mikolajczak et al., Curr Dir Psychol Sci 2023",
      "url": "https://doi.org/10.1177/09637214221142777"
    },
    "review": {
      "status": "rewritten",
      "limits": "Several factors, not lack of help alone.",
      "date": "2026-11-10",
      "source": "VERIFIED",
      "sourceNote": "Meta-analysis k=49, mostly cross-sectional; perceived support, not daily help."
    }
  },
  {
    "id": "painkiller-days",
    "templateId": "took-painkiller",
    "en": {
      "title": "Painkiller days",
      "line": "Frequent use of headache medication can sometimes contribute to recurring headaches. Tracking medication days may help you notice a pattern worth discussing with a doctor."
    },
    "ru": {
      "title": "Дни с обезболивающим",
      "line": "Частый приём лекарств от головной боли иногда может поддерживать повторяющиеся приступы. Отмечай дни приёма, чтобы замечать закономерности, которые стоит обсудить с врачом."
    },
    "source": {
      "name": "International Headache Society, ICHD-3",
      "url": "https://ichd-3.org/8-headache-attributed-to-a-substance-or-its-withdrawal/8-2-medication-overuse-headache-moh/"
    },
    "review": {
      "status": "rewritten",
      "limits": "Counting days does not diagnose medication-overuse headache; the question may include painkillers for other pain.",
      "date": "2026-11-10",
      "source": "VERIFIED",
      "sourceNote": "ICHD-3 8.2 classification; 'discuss with a doctor' is the app's own line."
    }
  },
  {
    "id": "neck-and-migraine",
    "templateId": "neck-pain",
    "en": {
      "title": "Neck pain and migraine",
      "line": "Neck pain is often reported around migraine attacks. Sometimes it may be an early symptom rather than a trigger."
    },
    "ru": {
      "title": "Боль в шее и мигрень",
      "line": "Боль в шее часто отмечают рядом с приступами мигрени. Иногда она может быть ранним симптомом, а не триггером."
    },
    "source": {
      "name": "Goadsby et al., Eur J Neurol 2021 (Migraine Buddy data)",
      "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9291858"
    },
    "review": {
      "status": "rewritten",
      "limits": "General education, not a personal interpretation.",
      "date": "2026-11-10",
      "source": "PARTIAL",
      "sourceNote": "Migraine Buddy app data, 90% female, self-labelled episodes; 'early symptom' is the authors' speculation. Candidate opened: Giffin et al., Neurology 2003, doi 10.1212/01.wnl.0000052998.58526.a9 (n=97 with warning symptoms) — not applied."
    }
  },
  {
    "id": "headaches-and-periods",
    "templateId": "period-day",
    "en": {
      "title": "Headaches and periods",
      "line": "For some people with migraine, attacks are more common just before and during the first days of a period."
    },
    "ru": {
      "title": "Мигрень и месячные",
      "line": "У некоторых людей с мигренью приступы чаще случаются незадолго до месячных и в первые дни цикла."
    },
    "source": {
      "name": "MacGregor & Hackshaw, Neurology 2004",
      "url": "https://doi.org/10.1212/01.wnl.0000133134.68143.2e"
    },
    "review": {
      "status": "rewritten",
      "limits": "Not every headache around a period is migraine.",
      "date": "2026-11-10",
      "source": "PARTIAL",
      "sourceNote": "155 women, likely specialist clinic; the 2 days before a period are only visible looking back."
    }
  },
  {
    "id": "stress-and-stomach",
    "templateId": "stomach-issues",
    "en": {
      "title": "Stress and your stomach",
      "line": "In a study of people with irritable bowel syndrome, stress and symptoms often increased together. Notice whether stress and stomach discomfort coincide for you."
    },
    "ru": {
      "title": "Стресс и живот",
      "line": "В исследовании людей с синдромом раздражённого кишечника стресс и симптомы часто усиливались одновременно. Посмотри, совпадают ли у тебя стресс и дискомфорт в животе."
    },
    "source": {
      "name": "Yunusova et al., Clin Gastroenterol Hepatol 2026",
      "url": "https://doi.org/10.1016/j.cgh.2026.05.008"
    },
    "review": {
      "status": "held",
      "limits": "Study specific to irritable bowel syndrome: held until it can be shown without a misleadingly broad meaning (brief section 5).",
      "date": "2026-11-10",
      "source": "PARTIAL",
      "sourceNote": "IBS patients only (N=357), author with a declared conflict of interest; the question goes to everyone."
    }
  },
  {
    "id": "evening-nicotine",
    "templateId": "smoked",
    "en": {
      "title": "Nicotine and sleep",
      "line": "Evening nicotine use has been linked to more disrupted sleep. Notice how nights after nicotine use compare."
    },
    "ru": {
      "title": "Никотин и сон",
      "line": "Употребление никотина вечером связано с более прерывистым сном. Посмотри, отличаются ли ночи после вечеров с никотином."
    },
    "source": {
      "name": "Spadola et al., Sleep 2019",
      "url": "https://doi.org/10.1093/sleep/zsz136"
    },
    "review": {
      "status": "rewritten",
      "limits": "Not equally shown for all vaping products; the question may not separate evening use.",
      "date": "2026-11-10",
      "source": "PARTIAL",
      "sourceNote": "785 African American adults, mean age 64; nicotine within 4 h of bed, small effects; the question counts any time of day; vaping not separate."
    }
  },
  {
    "id": "putting-things-off",
    "templateId": "procrastinated",
    "en": {
      "title": "Putting things off",
      "line": "Tasks that feel unpleasant or difficult are often easier to postpone. Notice what your procrastination days have in common."
    },
    "ru": {
      "title": "Откладывание дел",
      "line": "Неприятные и сложные задачи часто хочется отложить. Посмотри, что общего у дней, когда дела постоянно откладываются."
    },
    "source": {
      "name": "Steel, Psychol Bull 2007",
      "url": "https://doi.org/10.1037/0033-2909.133.1.65"
    },
    "review": {
      "status": "rewritten",
      "date": "2026-11-10",
      "source": "VERIFIED",
      "sourceNote": "Meta-analysis of 691 correlations; 'difficult' fits only loosely."
    }
  },
  {
    "id": "less-coffee-than-usual",
    "templateId": "less-caffeine-than-usual",
    "en": {
      "title": "Less coffee than usual",
      "line": "Suddenly reducing caffeine can bring headaches and tiredness for a few days. Notice how you feel when your intake changes."
    },
    "ru": {
      "title": "Кофе меньше обычного",
      "line": "Резкое сокращение кофеина может на несколько дней вызвать головную боль и усталость. Посмотри, как меняется самочувствие, когда пьёшь его меньше обычного."
    },
    "source": {
      "name": "Juliano & Griffiths, Psychopharmacology 2004",
      "url": "https://doi.org/10.1007/s00213-004-2000-x"
    },
    "review": {
      "status": "rewritten",
      "limits": "Withdrawal does not happen to everyone.",
      "date": "2026-11-10",
      "source": "VERIFIED",
      "sourceNote": "Review of 57 experiments + 9 surveys; symptoms 2–9 days, mostly after stopping completely."
    }
  }
];
