import { t as e } from "./rolldown-runtime-CtkjhSXr.js";
//#region public/typed/workspace-navigation.ts
var t = /* @__PURE__ */ e(((e, t) => {
	(function(e, n) {
		let r = n();
		if (typeof t == "object" && t?.exports) {
			t.exports = r;
			return;
		}
		e.HafizeWorkspaceNavigation = r;
		let i = () => r.mount(e.document, e);
		e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", i, { once: !0 }) : i();
	})(typeof globalThis < "u" ? globalThis : self, function() {
		let e = Object.freeze([
			"chat",
			"tasks",
			"connections"
		]), t = Object.freeze({
			chat: 0,
			tasks: 1,
			connections: 2
		}), n = Object.freeze({
			tasks: Object.freeze(["scheduleRuntimeCard", "scheduleListCard"]),
			connections: Object.freeze([
				"accountConnectionCard",
				"gmailConnectionCard",
				"canvaConnectionCard",
				"githubWriteReadinessCard"
			])
		}), r = "workspaceNavigationIntro", i = "workspaceNavigationStyle", a = "/workspace-navigation.css", o = "hafize:workspace-changed", s = /* @__PURE__ */ new WeakSet(), c = Object.freeze({
			tasks: Object.freeze({
				eyebrow: "Bulut görevleri",
				title: "Görevler",
				description: "Planlanmış ajan çalışmalarını, çalışma motorunun durumunu ve geçmiş görevleri tek yerde yönet."
			}),
			connections: Object.freeze({
				eyebrow: "Güvenli bağlantılar",
				title: "Bağlantılar",
				description: "Hesap, Gmail, Canva ve GitHub bağlantı sınırlarını tek çalışma alanında kontrol et."
			})
		});
		function l(t) {
			return typeof t == "string" && e.includes(t) ? t : "chat";
		}
		function u(e) {
			let t = l(e);
			return n[t] || Object.freeze([]);
		}
		function d(e, t) {
			let n = typeof e?.id == "string" ? e.id : "";
			return !!(n && u(t).includes(n));
		}
		function f(e) {
			let t = l(e);
			return c[t] || null;
		}
		function p(n) {
			let r = n?.querySelector?.(".nav-list"), i = Array.from(r?.querySelectorAll?.(".nav-item") || []);
			if (i.length < e.length) return null;
			let a = Object.fromEntries(e.map((e) => [e, i[t[e]]]));
			return e.every((e) => a[e]) ? Object.freeze(a) : null;
		}
		function m(e, t) {
			let n = e?.getAttribute?.(t);
			return Object.freeze({
				present: n != null,
				value: n
			});
		}
		function h(e, t, n) {
			e && n && (n.present ? e.setAttribute?.(t, n.value ?? "") : e.removeAttribute?.(t));
		}
		function g(e) {
			if (!e?.head || typeof e.createElement != "function") return null;
			let t = e.getElementById?.(i);
			if (t) return Object.freeze({
				node: t,
				owned: !1
			});
			let n = e.createElement("link");
			return n.id = i, n.rel = "stylesheet", n.href = a, n.setAttribute("data-hafize-workspace-navigation-style", "1"), e.head.append(n), Object.freeze({
				node: n,
				owned: !0
			});
		}
		function _(e) {
			let t = e.createElement("section");
			t.id = r, t.className = "workspace-navigation-intro", t.hidden = !0, t.tabIndex = -1, t.setAttribute("aria-live", "polite");
			let n = e.createElement("span");
			n.className = "workspace-navigation-eyebrow";
			let i = e.createElement("h1");
			i.className = "workspace-navigation-title";
			let a = e.createElement("p");
			return a.className = "workspace-navigation-description", t.append(n, i, a), Object.freeze({
				section: t,
				eyebrow: n,
				title: i,
				description: a
			});
		}
		function v(e, t) {
			if (typeof e?.dispatchEvent != "function") return !1;
			let n = Object.freeze({ workspace: l(t) });
			try {
				let t = e.CustomEvent || globalThis.CustomEvent;
				if (typeof t == "function") return e.dispatchEvent(new t(o, { detail: n })), !0;
			} catch {
				return !1;
			}
			return !1;
		}
		function y({ documentRef: t = globalThis.document, rootRef: n = globalThis, MutationObserverImpl: i = n?.MutationObserver } = {}) {
			if (!t || typeof t.querySelector != "function" || typeof t.createElement != "function") throw Error("INVALID_WORKSPACE_NAVIGATION_DOCUMENT");
			let a = t.querySelector(".main"), o = t.querySelector(".primary-column"), c = t.querySelector(".utility-rail"), u = p(t);
			if (!a || !o || !c || !u) throw Error("WORKSPACE_NAVIGATION_HOST_UNAVAILABLE");
			let y = !1, b = !1, x = "chat", S = null, C = null, w = null, T = !1, E = [], D = /* @__PURE__ */ new Set(), O = /* @__PURE__ */ new Map(), k = Object.freeze({
				mainWorkspace: m(a, "data-workspace"),
				railLabel: m(c, "aria-label"),
				primaryHidden: !!o.hidden,
				nav: Object.freeze(Object.fromEntries(e.map((e) => {
					let t = u[e];
					return [e, Object.freeze({
						disabled: !!t.disabled,
						active: t.classList?.contains?.("active") === !0,
						current: m(t, "aria-current")
					})];
				})))
			});
			function A(e, t, n) {
				if (typeof e?.addEventListener != "function" || typeof e?.removeEventListener != "function") throw Error("WORKSPACE_NAVIGATION_EVENT_TARGET_UNSAFE");
				e.addEventListener(t, n), E.push(() => e.removeEventListener(t, n));
			}
			function j(e) {
				e && e !== w?.section && !O.has(e) && (O.set(e, Object.freeze({ hidden: !!e.hidden })), D.add(e));
			}
			function M() {
				for (let e of D) {
					let t = O.get(e);
					t && (e.hidden = t.hidden);
				}
			}
			function N() {
				let e = Array.from(c.children || []);
				for (let t of e) j(t);
				if (x === "chat") M();
				else for (let e of D) e && e !== w?.section && (e.hidden = !d(e, x));
			}
			function P() {
				if (!w) return;
				let e = f(x);
				e ? (w.eyebrow.textContent = e.eyebrow, w.title.textContent = e.title, w.description.textContent = e.description, w.section.hidden = !1) : w.section.hidden = !0;
			}
			function F() {
				for (let t of e) {
					let e = t === x;
					u[t].classList?.toggle?.("active", e), e ? u[t].setAttribute?.("aria-current", "page") : u[t].removeAttribute?.("aria-current");
				}
			}
			function I({ focus: e = !1 } = {}) {
				a.setAttribute?.("data-workspace", x), o.hidden = x !== "chat", c.setAttribute?.("aria-label", x === "chat" ? k.railLabel.value || "Hafize yardımcı araçları" : x === "tasks" ? "Hafize görevler çalışma alanı" : "Hafize bağlantılar çalışma alanı"), F(), P(), N(), e && x !== "chat" && w?.section?.focus?.();
			}
			function L(e, { focus: t = !1, emit: r = !0 } = {}) {
				if (b) return !1;
				let i = l(e);
				return i === x ? (I({ focus: t }), !1) : (x = i, I({ focus: t }), r && v(n, x), !0);
			}
			function R() {
				let e = t.getElementById?.("sidebar"), n = t.getElementById?.("sidebarToggle");
				e?.classList?.contains?.("open") === !0 && typeof n?.click == "function" && n.click();
			}
			function z(e) {
				return (t) => {
					t?.preventDefault?.(), !u[e].disabled && (L(e, { focus: e !== "chat" }), R());
				};
			}
			function B() {
				if (y || b || s.has(a) || (C = g(t), !C) || t.getElementById?.(r)) return !1;
				w = _(t);
				try {
					if (c.prepend?.(w.section), !w.section.parentNode && typeof c.insertBefore == "function" && c.insertBefore(w.section, c.firstChild || null), !w.section.parentNode) throw Error("WORKSPACE_NAVIGATION_INTRO_ATTACH_FAILED");
					T = !0;
					for (let t of e) A(u[t], "click", z(t));
				} catch {
					for (; E.length;) try {
						E.pop()();
					} catch {}
					return T && w.section.remove?.(), C?.owned && C.node.remove?.(), w = null, C = null, T = !1, !1;
				}
				return s.add(a), y = !0, u.tasks.disabled = !1, u.connections.disabled = !1, x = "chat", I(), typeof i == "function" && (S = new i(() => {
					b || N();
				}), S.observe(c, { childList: !0 })), !0;
			}
			function V() {
				if (!y || b) return !1;
				for (b = !0, S?.disconnect?.(), S = null; E.length;) try {
					E.pop()();
				} catch {}
				M(), T && w?.section?.remove?.(), C?.owned && C.node.remove?.(), h(a, "data-workspace", k.mainWorkspace), h(c, "aria-label", k.railLabel), o.hidden = k.primaryHidden;
				for (let t of e) {
					let e = k.nav[t];
					u[t].disabled = e.disabled, u[t].classList?.toggle?.("active", e.active), h(u[t], "aria-current", e.current);
				}
				return s.delete(a), y = !1, !0;
			}
			return Object.freeze({
				mount: B,
				destroy: V,
				setWorkspace: L,
				getWorkspace: () => x,
				syncCards: N
			});
		}
		function b(e, t) {
			try {
				let n = y({
					documentRef: e,
					rootRef: t,
					MutationObserverImpl: t?.MutationObserver
				});
				return n.mount() ? n : null;
			} catch {
				return null;
			}
		}
		return Object.freeze({
			WORKSPACES: e,
			NAV_INDEX: t,
			CARD_IDS: n,
			INTRO_ID: r,
			STYLE_ID: i,
			STYLE_PATH: a,
			CHANGE_EVENT: o,
			normalizeWorkspace: l,
			allowedCardIds: u,
			isWorkspaceCard: d,
			workspaceCopy: f,
			resolveNavigation: p,
			createController: y,
			mount: b
		});
	});
}));
//#endregion
export default t();

//# sourceMappingURL=workspace-navigation.js.map