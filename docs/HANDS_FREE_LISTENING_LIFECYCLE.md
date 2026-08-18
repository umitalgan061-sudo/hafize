# Hands-free listening lifecycle contract

## Purpose

Hafize hands-free mode listens only for the explicit wake phrase and must remain visibly user-controlled. This contract hardens the Web Speech recognition lifecycle against tight retry loops, microphone failures and false echo cooldowns without adding a new backend, provider, agent tool or persistent state.

The separate hands-free consent layer remains authoritative for activation. The lifecycle controller does not bypass the two-step user review/confirmation flow and does not make consent sticky across later activations.

## Recognition recovery policy

Normal recognition end or `no-speech` uses the existing short 350 ms restart delay while the mode is still enabled and all listening guards are satisfied.

A `network` recognition error is treated as transient but bounded. Consecutive network errors use this exact schedule:

1. 2 seconds
2. 5 seconds
3. 15 seconds
4. 30 seconds
5. 60 seconds

A sixth consecutive network failure disables hands-free mode. There is no infinite 350 ms reconnect loop. A real recognition transcript proves that the recognition service recovered and resets the network-error streak. Manual re-enablement also starts with a fresh recovery budget.

The following errors are terminal for the current activation and require a new explicit activation:

- `audio-capture`
- `not-allowed`
- `security`
- `service-not-allowed`
- `language-not-supported`
- unknown recognition errors

`aborted` is not presented as an unexpected failure because Hafize intentionally aborts recognition during visibility changes, TTS playback, voice-input handoff, disable and destroy flows.

## Fail-closed listening guards

Recognition may start or restart only while all existing guards remain true:

- hands-free is enabled;
- the controller is not destroyed;
- the document is visible;
- the message input is enabled;
- no voice-input handoff is pending;
- push-to-talk recognition is not active;
- Hafize TTS is not speaking;
- the post-output echo cooldown is not active.

Terminal failures clear pending restart state and disable the current hands-free activation. Hidden documents stop recognition and do not re-arm until visible again. Destroy removes event listeners, disconnects the observer, clears timers and aborts active recognition.

## TTS echo cooldown

`hafize:voice-output-state` is an event stream, not a command to cool down every time `speaking:false` appears.

The 1.8 second echo cooldown starts only after an observed transition from `speaking:true` to `speaking:false`. An initial or repeated `speaking:false` event does not create an artificial cooldown. This avoids delaying wake listening when the output component merely publishes an idle state.

While TTS is speaking, wake recognition is stopped. The existing voice-output implementation independently cancels TTS when push-to-talk begins, when the composer is submitted, or when the document is hidden, so this change preserves the existing barge-in boundary rather than replacing it.

## Public error policy

Recognition/provider details are not surfaced verbatim. Public messages are fixed, bounded text selected by error class. Unknown browser/provider exception text, stack traces, credentials, cookies and tokens are never copied into the toast.

Network recovery exposes only a generic reconnect status. The controller may expose bounded local diagnostic state (`networkErrorStreak`, current restart delay and normalized recognition error) to its own test/debug API; those values are not persisted and are not sent to an agent or backend.

## Privacy and data handling

This feature does not add:

- `fetch`, XHR, WebSocket, EventSource or `sendBeacon` calls;
- a Hafize API endpoint for microphone audio;
- localStorage, sessionStorage or IndexedDB persistence;
- cookie, Authorization header or credential reads;
- clipboard access;
- silent memory writes;
- automatic composer submission;
- shell, exec, spawn or terminal execution;
- new agent/tool permissions.

The browser or operating-system Web Speech implementation may still process audio using its own speech service. Hafize does not claim that Web Speech recognition is necessarily local-only.

## Agent and tool boundary

The active registry remains exactly four profiles: two selectors and two specialists. The hands-free controller is a UI runtime, not an agent tool. Model/provider selection does not grant device or external-write authority.

Backend tool policies remain deny-by-default. GitHub/Gmail/Canva writes, sends and merges retain their separate explicit-approval contracts. Secret values remain outside agent context and shared trace/task-ledger requirements remain unchanged.

## PWA delivery

`/hands-free.js` is already part of the PWA shell. Any change to its lifecycle behavior must advance the shell cache version so an installed PWA does not remain pinned to the previous retry logic. This change advances the cache from `hafize-shell-v87` to `hafize-shell-v88`.

API routes remain network-only under the service-worker policy. No microphone or recognition result is cached by this change.

## Definition of done

The implementation is complete only when regression coverage verifies all of the following:

- recognition error classification is exact and fail-closed;
- network retry delays are bounded and monotonic;
- the sixth consecutive network failure disables hands-free;
- terminal microphone/capture errors do not auto-restart;
- `no-speech` retains normal bounded restart behavior;
- a real transcript resets network recovery state;
- an initial `speaking:false` event does not trigger echo cooldown;
- `speaking:true -> false` does trigger the 1.8 second cooldown;
- hidden-document and push-to-talk transitions stop wake recognition;
- malformed or foreign voice-state events are ignored;
- unknown error detail is not reflected into public UI;
- consent, PWA, four-agent roster and default-deny security boundaries remain intact.

## Rollback

Rollback is local and schema-free: revert the hands-free lifecycle changes, the associated regression tests and this contract, then restore the previous PWA shell cache identifier. No data migration, credential migration, agent-registry migration or backend endpoint rollback is required.
