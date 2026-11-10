# Throwaway notification inbox prototype

Decision: https://github.com/marcplatt/softwareFact1/issues/5

Planning artifact only. No winner or reading policy has been confirmed.

Run `npm run dev -- --port 5175`, then open `/courses?variant=A`.
Use an existing seeded development database; choose a user in DevUI to see the normal account controls.

- A: account-adjacent trigger and compact inbox dialog.
- B: top-right trigger and full-height right drawer.
- C: inbox embedded in the current workspace.

Switch with the floating arrows or left/right keys. Test role-specific synthetic samples, arrival popups, unread counts, mark read/unread, archive, empty inbox, and destination previews. All activity state is in memory; changing placement may reset it. Preview roles do not change authentication or permissions. Destinations are previews, never real mutations. The compact dialog uses modal focus handling; this is also a behavior to evaluate. Popup timing (eight seconds) is illustrative, not a resolved policy.

Typecheck and the existing suite (405 tests) pass. `/courses?variant=A` serves HTTP 200. Browser interaction has not been automated. The prototype and switcher render only in development and only when `variant` is present.
