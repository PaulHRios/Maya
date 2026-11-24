# Optional Web Push

Keep `MAYA_PUSH_BASE` blank in `js/push-config.js` unless the HTTPS scheduler is deployed and verified. With a blank value, the app uses foreground reminders only and does not contact a scheduler.

The scheduler receives the browser's push subscription for delivery; pending jobs contain only random IDs and delivery/expiration timestamps. The app does not send names, logs, photos, reminder categories or notification text to the scheduler. The service worker constructs the private text locally. Opt in from Home or Settings → Reminders after adding the app to the Home Screen on iOS 16.4+. On a signed-in family device, tap Enable notifications and accept the operating system prompt. The app obtains the required enrollment authorization privately without asking the user to enter anything. Never place enrollment credentials or a private VAPID key in public source.

API: GET `/v1/public-key`; POST `/v1/devices` for enrollment; PUT `/v1/devices/:id/jobs` to replace the outstanding jobs; DELETE `/v1/devices/:id` to revoke. A short expiry and local cancellation reduce stale-message races. Safari expects a visible notification per valid push event. Do not use push as a silent data transport.

Reminders reflect the records this device has seen. Entries on another phone cannot cancel a pending reminder until this device syncs. Current-week photo notification is scheduled once per occurrence starting on day four, defers during quiet hours, expires at the baby-age week rollover, and cancels on the photo record. No prior weeks are replayed. If Maya remains closed into another week it cannot schedule that new week until reopened.

Run `node --test tests/*.test.cjs` for mocked scheduler, quiet-hour, rollover and cancellation tests. Verify true closed-app delivery and cancellation on an installed iPhone with a synthetic account before advertising Web Push as working.
