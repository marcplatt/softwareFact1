# Notification capability research

Research for [ticket #3](https://github.com/marcplatt/softwareFact1/issues/3), part of [map #1](https://github.com/marcplatt/softwareFact1/issues/1). Verified against official sources on 2026-11-10. Repository baseline: `08ed53f3339705b0d2f2c72366be3de95d75bbac`. Planning only; no application changes or delivery tests.

## Capability boundaries

| Surface | Feasible behavior | Prerequisites and limits |
| --- | --- | --- |
| Persistent in-app inbox | Stored per-user history, unread/read state, links and counts, fetched when Cadence opens | Application/service persistence and authenticated access. No browser notification permission or installation needed. Does not itself alert someone outside Cadence. |
| Foreground popup | Render incoming activity in the open app, with a link to its inbox item | Active page plus polling or real-time transport. An HTML toast needs no OS notification permission. A popup is transient; durable history requires the inbox. |
| Browser/phone system notification | Alert outside the page using Web Push and system notification UI | HTTPS, browser support, explicit permission, a subscription/token, sender integration and generally a service worker. iPhone/iPad require a Home Screen web app. Delivery, banner style, sound and vibration remain subject to the browser and OS. |

The first two rows are application-design inferences from ordinary page rendering and the stored-feed/realtime APIs described below. They do not imply that Cadence already implements these features. Push and notification presentation are separate technologies; a foreground toast does not create a background delivery channel. [Google platform overview](https://web.dev/articles/push-notifications-overview).

## Existing foundations and service readiness

Read-only inspection of the baseline found:

- [README.md](../../README.md#signing-up-later) explicitly anticipates a Knock Developer account for notifications, with keys in gitignored `.env`. This documents intent, not proof of an active account, correct credentials, configured channels or capacity.
- [package.json](../../package.json) has React 19, React Router 8, SQLite/Drizzle and Sonner; no Knock or Firebase SDK dependency. [layout.app.tsx](../../app/routes/layout.app.tsx) renders Sonner bottom-right. [settings.tsx](../../app/routes/settings.tsx) uses it for immediate profile-save feedback; it currently has profile/refund settings, no category controls.
- [sidebar.tsx](../../app/components/sidebar.tsx) places account/settings controls at the bottom. Inbox placement and incoming-popup placement remain design decisions.
- [schema.ts](../../app/db/schema.ts) has Student/Instructor/Admin user roles, separate team-member roles, lessons/courses and threaded comments. No notification inbox, preference or push-subscription tables were found. The precise meaning of admins, messages, deadlines and recipients belongs to domain/product decisions.
- Repository searches found no service-worker registration, web-app manifest, push transport, Knock calls, Firebase setup or notification scheduler. Root metadata links only a favicon and fonts. No secret values were read, copied or validated.

**Readiness conclusion:** the repository has UI/database foundations and names the intended orchestration service, but does not demonstrate an operational notification stack. An existing Knock account could cover inbox storage, realtime and scheduling; background browser delivery additionally needs provider setup and client integration. An account/credentials/configuration audit and end-to-end device delivery remain separate readiness work.

## What Knock can supply

Knock feeds store workflow-generated per-recipient messages and expose seen/read/interacted/archived state and counts. This can supply durable inbox state rather than requiring Cadence's own inbox tables; retention requirements still need verification against the selected plan/configuration. [Knock feeds](https://docs.knock.app/in-app-ui/feeds/overview).

Its managed websocket service reports new in-app activity and SDKs manage reconnects. This can drive incoming popups while the application is connected; it cannot replace OS push when the page is closed. [Knock realtime service](https://docs.knock.app/in-app-ui/feeds/socket-behavior), [Google transport distinction](https://web.dev/articles/push-notifications-faq).

The React package offers feed/popover/badge components. Integration requires an account, feed channel, workflow, public environment key and feed channel ID. Production feeds should enable enhanced security and use signed user tokens. Cadence must identify its authenticated users correctly and enforce recipient/source-link access. [Knock React feed](https://docs.knock.app/in-app-ui/react/feed).

Knock preference sets can opt users out by category, channel or workflow and are checked during workflow execution. These can support Settings category toggles; defaults, which surfaces each toggle affects and mandatory categories remain product decisions. Browser permission is a separate device/browser setting. [Knock preferences](https://docs.knock.app/concepts/preferences).

Knock schedules support one-off UTC timestamps and recurring, recipient-timezone-aware workflow runs. They can support deadline reminders without assuming another cron service is necessary. Cadence still needs to create/update/cancel schedules when authoritative deadlines or recipients change. [Knock schedules](https://docs.knock.app/concepts/schedules).

**Knock does not have a first-party web push channel.** Its documented browser-push route uses Firebase Cloud Messaging: configure an FCM channel in Knock; install Firebase SDK; supply Firebase project configuration and a public VAPID key; obtain permission and a browser token; save that token as Knock channel data; and implement service-worker/background handling. Tokens can be removed to stop application delivery without changing browser permission. This is additional setup, not something a Knock API key alone supplies. [Knock web-push tutorial](https://docs.knock.app/tutorials/sending-web-push-notifications-with-fcm).

Firebase's web client also requires a Firebase project/app, HTTPS, supported browser Push APIs, web credentials and service-worker setup. Feature detection and real devices must verify the intended browser matrix. Native APNs integration is a different delivery path; this project does not need a native application merely to send supported browser push. [Firebase web setup](https://firebase.google.com/docs/cloud-messaging/web/get-started), [Knock push integrations](https://docs.knock.app/integrations/push/overview).

## Browser and installation matrix

| Environment | Practical support boundary |
| --- | --- |
| Desktop Chromium/Firefox | Web Push can reach a subscribed browser with the Cadence tab closed. Installing Cadence is not a general Push API requirement. Fully quitting the browser is a separate, platform-dependent case. |
| Android supporting browsers | OS can wake the browser/service worker for push even when its UI is closed. Home Screen installation is not a universal prerequisite; permission and a valid subscription are. Force-stop, offline and OS restrictions must be tested. |
| macOS Safari | Standards Web Push introduced in Safari 16/macOS Ventura. Apple's system integration wakes the appropriate application for incoming messages; no Apple Developer Program membership required. |
| iOS/iPadOS | Web Push supported from 16.4 for apps added to Home Screen; an ordinary browser tab is insufficient. Request permission from a direct user action in the installed web app. Manifest `display: standalone` or `fullscreen` supports the web-app launch mode. |
| Unsupported/restricted browsers or denied permission | Inbox and foreground HTML UI remain possible; no claim of system delivery. |

Sources: [Push API standard](https://www.w3.org/TR/push-api/), [Google FAQ](https://web.dev/articles/push-notifications-faq), [Mozilla current push documentation](https://support.mozilla.org/en-US/kb/push-notifications-firefox), [WebKit macOS implementation](https://webkit.org/blog/12945/meet-web-push/), [WebKit iOS requirements](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

“Cadence closed” must mean its page/app UI closed, not a guarantee for every fully terminated browser. Google's FAQ distinguishes background-running desktop Chrome from fully quit Chrome. Mozilla currently documents closed-Firefox notifications on supported Windows installations, while ordinary delivery requires Firefox open elsewhere. Do not turn either statement into a universal desktop guarantee. [Google FAQ](https://web.dev/articles/push-notifications-faq), [Mozilla](https://support.mozilla.org/en-US/kb/push-notifications-firefox).

### Current service-worker nuance

The conventional cross-browser implementation registers an HTTPS service worker, obtains a PushSubscription and stores its endpoint/key data, then sends encrypted authenticated Web Push from the server via the browser vendor's push service. A push wakes event handling; the worker is not a permanently running process or reliable timer. Permission/subscription can expire or be revoked. [Push API](https://www.w3.org/TR/push-api/), [Google overview](https://web.dev/articles/push-notifications-overview).

Newer Safari also offers **Declarative Web Push**, allowing subscription and visible notification delivery without an installed service worker: iOS/iPadOS 18.4+, Safari 18.5+ on macOS. It can coexist with a conventional worker, but does not remove iOS installation/permission requirements. This is an available technical option, not evidence Knock's FCM tutorial implements it or that all target browsers do. [WebKit introduction](https://webkit.org/blog/16535/meet-declarative-web-push/), [Apple WWDC25 guidance](https://developer.apple.com/videos/play/wwdc2025/235/).

WebKit requires visible notifications for conventional push; silent background sync through push can revoke a subscription. Do not suppress all notification display merely because a foreground popup also appears. Coordinate surfaces within provider/platform constraints. [WebKit user-visible requirement](https://webkit.org/blog/12945/meet-web-push/).

## Sound, vibration and OS controls

System notification sound/haptics are governed by platform conventions, notification settings and modes such as Focus. A web app can request supported options such as `silent` or a vibration pattern, but cannot promise an audible alert, vibration or a heads-up banner, or bypass OS preferences. The standard deliberately allows platform-dependent presentation. [Notifications standard](https://notifications.spec.whatwg.org/), [WebKit Focus integration](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

`navigator.vibrate()` is separate page-controlled tactile feedback, not background push. The current W3C draft requires a visible document and prior user activation, and permits implementations to decline. It is implemented in Chromium; WebKit opposes it and Firefox removed its implementation in version 129. A successful call is not proof a device physically vibrated. Therefore app-controlled vibration cannot be a cross-platform requirement, particularly on iPhone. [W3C Vibration API, status and processing rules](https://www.w3.org/TR/vibration/).

## Fallbacks and implications for a later specification

These are feasible implementation options and constraints, not selected product policies:

- A stored inbox can remain the recovery surface when push is unsupported, declined, expired, delayed or disabled. Fetch/reconcile it on app opening/reconnection; popup dismissal and OS dismissal need not imply inbox read state.
- Offer a deliberate enable-notifications action. Represent unsupported, needs-install, not-enabled and enabled/subscribed states separately. A category toggle cannot grant browser permission; denied permission requires browser/OS settings recovery.
- For iOS explain Home Screen installation before permission enrollment. Elsewhere do not impose installation unless a chosen provider/browser needs it.
- Treat outside-app alerts as best effort. Push services may shorten retention, messages expire at TTL and subscriptions can expire. A provider accepting a request does not prove the person saw it. [RFC 8030, sections 5.2 and 7](https://www.rfc-editor.org/info/rfc8030/).
- A self-hosted inbox/polling or realtime implementation is technically possible; a direct Web Push sender is another option. Neither is already present. Using Knock's feed/scheduler and FCM's browser delivery is the documented managed route, subject to the separate architecture/readiness decision.
- Students, Instructors and admins, lesson availability/course changes/replies/deadlines/supervised comment-message activity and Settings category toggles are the planning scope. Recipient eligibility, defaults, event timing, retention, sensitive lock-screen content, duplicates, retries and popup placement remain unresolved product/architecture decisions.

Before implementation is declared ready, verify configured services without exposing keys, authenticated feed access, permission denial/revocation, iOS installation, reconnect/inbox recovery, notification clicks with expired sessions, multi-device subscriptions, duplicate foreground/background alerts, OS Focus/silent behavior, and closed-page versus fully quit browser behavior on actual target devices. This research did not execute those tests or change the application.
