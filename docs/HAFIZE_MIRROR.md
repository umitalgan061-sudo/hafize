# Hafize'nin Aynası (self-portrait studio)

Hafize designs the living image on the home "Sesli asistan" card itself.

## Flow

1. **Imagine**: the server asks Hafize's routed model (expert `team-ux`) to describe, in the first person, how it wants to look. The prompt lists the earlier looks that were someone else's idea so that Hafize does not repeat them. The output is a concept JSON with a name, essence, form, palette and the four states.
2. **Code**: Hafize writes the look as one GLSL ES 1.00 function, `vec4 hafizePortrait(vec2 p)`, using expert `team-ui` and a streamed reply. Static rules in `lib/self-portrait.ts` reject anything outside the contract (no uniforms, textures, `#` lines, `while`, unbounded loops or `main`). Violations go back to the model automatically.
3. **See**: the owner's browser (`public/typed/hafize-mirror.ts`) compiles the code with WebGL through `window.HafizePortrait` (`public/home-voice-luminous-core.js`). Compiler errors go back for repair. The browser then shows the look live and photographs all four states on both themes as one JPEG sheet.
4. **Reflect**: the browser also measures every frame: how much of the card the figure fills, how far it reaches, its contrast against the card, and how different the states are. A vision model (`HAFIZE_MIRROR_VISION_MODELS`) looks at the sheet as Hafize and scores it from 0 to 10.
   - The measurements are facts. Objective problems (too small, too faint, flooding the card, identical states) always become fixes, cap the score at 7 and work even when no vision model answers.
   - 8 or more with no objective problem approves the look.
   - A lower score sends the fixes back into a revision.
   - After 4 looks, Hafize picks its best one.
   - The job result lists each vision model's outcome (`visionAttempts`).
5. **Ship**: the server commits `public/hafize-self-portrait.json` on a `hafize/auto-self-portrait-*` branch and opens a PR. It waits for green CI, then merges through the existing `github_release` tool. It waits for the main `quality.yml` run and asks for a Render release, using the deploy hook first and the `hafize-render-release.yml` dispatch as a fallback. A failed CI run is re-run once, since a single timeout is not a broken portrait. A retried publish continues on the same branch and PR. Firebase Hosting follows the push to main on its own.

## Boundaries

- The routes under `/api/self-portrait/*` are owner-only. They need an authenticated owner session, the same check the Model Lab uses.
- The browser never sends code. Publishing takes a candidate id, and the server commits only GLSL that its own model produced, validated and that the mirror rendered.
- `releasePathAllowed` admits exactly `public/hafize-self-portrait.json` in addition to the existing source scopes. `lib/self-portrait.test.ts` validates the committed file in CI.
- A fragment shader cannot reach the DOM, storage or network.
- If the published portrait does not compile on a device, the card falls back to the original dot sphere.
- The full-screen voice orb (`voice-orb.ts` / `voice-visual.ts`) is not affected.
