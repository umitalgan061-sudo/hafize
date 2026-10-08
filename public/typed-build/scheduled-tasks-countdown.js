//#region public/scheduled-tasks-countdown.ts
var e = globalThis, t = "scheduledTasksWorkspace", n = 1e3, r, i;
function a(e) {
	let t = Date.parse(e || "");
	if (!Number.isFinite(t)) return "";
	let n = t - Date.now();
	if (n <= 0) return "Şimdi çalışması bekleniyor";
	let r = Math.floor(n / 6e4), i = Math.floor(r / 60), a = Math.floor(i / 24);
	return a > 0 ? `${a} gün ${i % 24} saat kaldı` : i > 0 ? `${i} saat ${r % 60} dk kaldı` : `${Math.max(1, r)} dk kaldı`;
}
function o(n = e.document) {
	let r = n?.getElementById(t);
	r && !r.hidden && r.querySelectorAll(".scheduled-task-row").forEach((e) => {
		if (e.dataset.status !== "scheduled") {
			e.querySelector(".scheduled-task-countdown")?.remove();
			return;
		}
		let t = e.querySelector(".scheduled-task-meta"), r = e.dataset.runAt || "";
		if (!t || !r) return;
		let i = e.querySelector(".scheduled-task-countdown");
		i || (i = n.createElement("span"), i.className = "scheduled-task-countdown", t.append(" · ", i)), i.textContent = a(r);
	});
}
function s() {
	r !== void 0 && (e.clearInterval(r), r = void 0);
}
function c() {
	s();
	let i = e.document?.getElementById(t);
	i && !i.hidden && (r = e.setInterval(() => o(e.document), n), o(e.document));
}
function l() {
	e.document && (e.addEventListener("hafize:scheduled-tasks-open", c), e.addEventListener("hafize:scheduled-tasks-close", s), i = new MutationObserver(() => {
		let n = e.document.getElementById(t);
		n && !n.hidden && c(), n?.hidden && s();
	}), i.observe(e.document.documentElement, {
		childList: !0,
		subtree: !0,
		attributes: !0,
		attributeFilter: ["hidden"]
	}), e.addEventListener("beforeunload", () => {
		i?.disconnect(), s(), e.removeEventListener("hafize:scheduled-tasks-open", c), e.removeEventListener("hafize:scheduled-tasks-close", s);
	}, { once: !0 }));
}
e.ScheduledTaskCountdown = Object.freeze({
	label: a,
	refresh: () => o(e.document),
	start: c,
	stop: s
}), e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", l, { once: !0 }) : l();
//#endregion
export { a as countdownLabel, o as refreshCountdowns };

//# sourceMappingURL=scheduled-tasks-countdown.js.map