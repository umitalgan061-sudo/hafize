//#region public/sw-policy.ts
var e = "hafize-shell-", t = `${e}v54`, n = Object.freeze(/* @__PURE__ */ "/,/index.html,/offline.html,/styles.css,/premium.css,/voice-output.css,/screen-share.css,/hands-free.css,/workspace-navigation.css,/chat-composer-features.css,/chat-history-search.css,/chat-history-export.css,/settings-workspace.css,/chat-history-management.css,/chat-drafts.css,/conversation-workspace.css,/conversation-workspace-keyboard.css,/conversation-forks.css,/message-workspace.css,/prompt-library.css,/system-readiness.css,/prompt-library-smart-views.css,/prompt-library-smart-views-extras.css,/prompt-library-smart-views-safety.css,/prompt-library-smart-fill.css,/prompt-library-command-palette.css,/composer-history.css,/scheduled-tasks.css,/scheduled-task-preview.css,/scheduled-task-duplicate.css,/scheduled-task-templates.css,/scheduled-task-planning.css,/scheduled-task-templates-backup.css,/scheduled-task-status-summary.css,/scheduled-task-preview-activity.css,/scheduled-task-template-presets.css,/scheduled-task-draft.css,/scheduled-task-insights.css,/scheduled-task-actions.css,/scheduled-task-detail.css,/hafize-runtime.css,/prompt-library-collections.css,/prompt-library-revisions.css,/github-workspace.css,/github-workspace-extra.css,/github-workspace-actions.css,/github-workspace-details.css,/github-workspace-write.css,/connector-hub.css,/model-preferences.css,/workspace-backup.css,/settings-privacy.css,/typed-build/auth.js,/typed-build/app-shell.js,/typed-build/markdown-renderer.js,/typed-build/conversation-workspace.js,/typed-build/conversation-forks.js,/typed-build/message-workspace.js,/typed-build/prompt-library.js,/typed-build/prompt-library-smart-fill.js,/typed-build/prompt-library-command-palette.js,/typed-build/github-workspace.js,/typed-build/github-workspace-extra.js,/typed-build/github-workspace-actions.js,/typed-build/github-workspace-details.js,/typed-build/github-workspace-write.js,/typed-build/prompt-library-smart-fill-hints.js,/typed-build/scheduled-tasks.js,/typed-build/scheduled-tasks-countdown.js,/typed-build/voice-input.js,/typed-build/voice-output.js,/typed-build/ui-shell.js,/typed-build/app-runtime.js,/typed-build/workspace-backup.js,/typed-build/system-readiness-panel.js,/typed-build/legacy-app.js,/manifest.webmanifest,/hafize.jpeg".split(",")), r = new Set(n);
function i(e, t) {
	if (!e) return "";
	if (typeof e.get == "function") return e.get(t) || "";
	let n = t.toLowerCase();
	for (let [t, r] of Object.entries(e)) if (t.toLowerCase() === n) return String(r ?? "");
	return "";
}
function a(e, t) {
	if (!t) return !1;
	try {
		return new URL(e, t).origin === t;
	} catch {
		return !1;
	}
}
function o(e, t) {
	try {
		return new URL(e, t).pathname;
	} catch {
		return "";
	}
}
function s(e, t) {
	if (!e || String(e.method || "GET").toUpperCase() !== "GET" || !a(e.url, t) || i(e.headers, "range")) return "ignore";
	let n = o(e.url, t);
	return n ? n.startsWith("/api/") ? "network-only" : e.mode === "navigate" || i(e.headers, "accept").toLowerCase().includes("text/html") ? "navigation" : r.has(n) ? "shell" : "network-only" : "ignore";
}
function c(n) {
	return typeof n == "string" && n.startsWith(e) && n !== t;
}
Object.freeze({
	cacheVersion: t,
	assetCount: n.length
});
//#endregion
//#region public/sw.ts
async function l(e) {
	return await (await caches.open(t)).match(e, { ignoreSearch: !0 }) || fetch(e);
}
async function u(e) {
	try {
		return await fetch(e);
	} catch {
		let e = await caches.open(t);
		return await e.match("/index.html") || await e.match("/offline.html") || Response.error();
	}
}
self.addEventListener("install", (e) => {
	e.waitUntil(caches.open(t).then((e) => e.addAll(n)).then(() => self.skipWaiting()));
}), self.addEventListener("activate", (e) => {
	e.waitUntil(caches.keys().then((e) => Promise.all(e.filter(c).map((e) => caches.delete(e))))), self.clients.claim();
}), self.addEventListener("fetch", (e) => {
	let t = s(e.request, self.location.origin);
	if (t === "navigation") {
		e.respondWith(u(e.request));
		return;
	}
	t === "shell" && e.respondWith(l(e.request));
});
//#endregion

//# sourceMappingURL=sw.js.map