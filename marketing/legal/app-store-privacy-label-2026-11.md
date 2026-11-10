# App Store privacy label (App Privacy) — answers for 2.0, Nov 10 2026

Сверено с кодом приложения 10 ноября 2026 (ветка `design/aurora-ux`, метка `aurora/v119`): `src/lib/analytics.ts` (Mixpanel), `src/lib/sentry.ts` (Sentry), `src/lib/speech.ts` + `ios/App/App/AppDelegate.swift` (диктовка), `package.json` (плагины). Политика на сайте — `docs/PRIVACY_POLICY.html` (обновлена тем же днём, ещё не выложена).

Где менять: App Store Connect → MeMap → App Privacy → Edit.

## Do you or your third-party partners collect data from this app?
**Yes.**

## Data types to declare

| Data type (как в App Store Connect) | Что это у нас | Used for | Linked to the user? | Tracking? |
|---|---|---|---|---|
| **Usage Data → Product Interaction** | события Mixpanel: экраны, «вечер пройден», «открыта связь», «начата проверка», «сделан отчёт» | Analytics | **No** | **No** |
| **Health & Fitness → Health** | в событиях есть темы, выбранные в начале («sleep», «migraine»), открытый остров, id совета «Worth watching». Это сведения о здоровье, хоть и без ответов | Analytics | **No** | **No** |
| **Location → Coarse Location** | Mixpanel определяет страну и город по IP (`ip: true`) | Analytics | **No** | **No** |
| **Identifiers → Device ID** | случайный id Mixpanel, создаётся на телефоне (не рекламный IDFA) | Analytics | **No** | **No** |
| **Diagnostics → Crash Data** | отчёты Sentry о сбоях | App Functionality | **No** | **No** |
| **Diagnostics → Other Diagnostic Data** | ошибки без падения, модель телефона, версия системы (Sentry) | App Functionality | **No** | **No** |

## Не объявлять (не собираем мы)
- **Audio Data**: диктовка идёт через распознавание речи телефона (на устройстве, где можно; иначе Apple). Мы звук не получаем и не храним.
- **Health & Fitness → Fitness**, **Contacts**, **User Content** (вопросы, ответы, заметки остаются на телефоне), **Contact Info**, **Purchases**, **Financial**, **Browsing/Search History**, **Precise Location**, **Sensitive Info**: нет.
- Отчёт PDF, резервная копия и картинка «Мой мир» уходят только туда, куда человек сам отправит. Это не сбор данных разработчиком.

## Tracking
**No.** Данные не соединяются с данными других компаний и не используются для рекламы; IDFA не запрашиваем (поэтому окна App Tracking Transparency нет).

## Что ещё проверить в Connect
- Privacy Policy URL: `https://memap-tracker.netlify.app/PRIVACY_POLICY.html`. Новый текст начнёт работать, когда папку `docs` снова перетащат на Netlify Drop.
- В описании версии/скринах не обещать «no analytics» или «nothing leaves your phone» — правда звучит так: «your answers and notes stay on your phone».
- «Тема здоровья» в аналитике — решение осознанное (по ней видно, кому что помогает). Если хочется не объявлять Health вовсе, тогда из событий `door_selected`, `onboarding_questions`, `island_opened`, `observe_tip_added` надо убрать названия тем: это правка в коде.
