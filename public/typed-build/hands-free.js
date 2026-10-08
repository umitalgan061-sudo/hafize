import { t as e } from "./rolldown-runtime-CtkjhSXr.js";
//#region public/typed/hands-free.ts
var t = /* @__PURE__ */ e(((e, t) => {
	(function(e, n) {
		let r = n();
		if (typeof t == "object" && t?.exports) {
			t.exports = r;
			return;
		}
		e.HafizeHandsFree = r;
		let i = () => r.installHandsFree(e.document, e);
		e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", i, { once: !0 }) : i();
	})(typeof globalThis < "u" ? globalThis : self, function() {
		let e = "hafize", t = 1500, n = 1800, r = 18e5, i = Object.freeze([
			2e3,
			5e3,
			15e3,
			3e4,
			6e4
		]), a = /* @__PURE__ */ new Set([
			"audio-capture",
			"not-allowed",
			"security",
			"service-not-allowed",
			"language-not-supported"
		]), o = "hafize:voice-input-state", s = "hafize:voice-output-state", c = "hafize:hands-free-revoke", l = /* @__PURE__ */ new WeakMap();
		function u(e) {
			return e?.SpeechRecognition || e?.webkitSpeechRecognition || null;
		}
		function d(e) {
			return typeof e == "string" ? e.normalize("NFKC").toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim() : "";
		}
		function f(t, n = e) {
			let r = d(t), i = d(n);
			return !r || !i ? !1 : i.includes(" ") ? ` ${r} `.includes(` ${i} `) : r.split(" ").includes(i);
		}
		function p(e) {
			if (!e?.results) return "";
			let t = [], n = Number.isInteger(e.resultIndex) ? e.resultIndex : 0;
			for (let r = n; r < e.results.length; r += 1) {
				let n = e.results[r]?.[0]?.transcript;
				typeof n == "string" && t.push(n);
			}
			return t.join(" ").trim();
		}
		function m(e) {
			return typeof e == "string" ? e.trim().toLocaleLowerCase("en-US").replace(/_/g, "-") : "unknown";
		}
		function ee(e) {
			let t = m(e);
			return t === "aborted" ? Object.freeze({
				code: t,
				kind: "aborted"
			}) : t === "no-speech" ? Object.freeze({
				code: t,
				kind: "idle"
			}) : t === "network" ? Object.freeze({
				code: t,
				kind: "network"
			}) : (a.has(t), Object.freeze({
				code: t,
				kind: "terminal"
			}));
		}
		function h(e) {
			return !Number.isInteger(e) || e < 1 ? 0 : i[Math.min(e, i.length) - 1];
		}
		function g(e) {
			return e === "audio-capture" ? "Eller serbest mikrofonu kullanamadı. Mikrofonu kontrol edip yeniden aç." : e === "not-allowed" || e === "service-not-allowed" || e === "security" ? "Eller serbest için mikrofon izni kullanılamıyor. İzni kontrol edip yeniden aç." : e === "language-not-supported" ? "Eller serbest konuşma dili bu tarayıcıda desteklenmiyor." : "Eller serbest konuşma tanıma hatası nedeniyle kapatıldı. Devam etmek için yeniden aç.";
		}
		function _(e, t) {
			return typeof e?.getAttribute == "function" ? e.getAttribute(t) : e?.attrs && Object.prototype.hasOwnProperty.call(e.attrs, t) ? String(e.attrs[t]) : null;
		}
		function v(e, t, n) {
			e && (n == null ? typeof e.removeAttribute == "function" ? e.removeAttribute(t) : e.attrs && delete e.attrs[t] : e.setAttribute?.(t, n));
		}
		function y(e, t) {
			return typeof e?.classList?.contains == "function" ? e.classList.contains(t) : null;
		}
		function b(e, t, n) {
			e && typeof n == "boolean" && (n ? e.classList?.add?.(t) : e.classList?.remove?.(t));
		}
		function te(e, t, n) {
			return Object.freeze({
				toggle: Object.freeze({
					disabled: !!e.disabled,
					textContent: e.textContent,
					ariaPressed: _(e, "aria-pressed")
				}),
				indicator: Object.freeze({
					hidden: !!t.hidden,
					textContent: t.textContent,
					listening: _(t, "data-listening"),
					handoffWaiting: _(t, "data-handoff-waiting"),
					coolingDown: _(t, "data-cooling-down"),
					voiceInputListening: _(t, "data-voice-input-listening"),
					voiceOutputSpeaking: _(t, "data-voice-output-speaking"),
					networkRetry: _(t, "data-network-retry")
				}),
				toast: n ? Object.freeze({
					textContent: n.textContent,
					hiddenClass: y(n, "hidden")
				}) : null
			});
		}
		function x(e, t, n, r) {
			e.disabled = r.toggle.disabled, e.textContent = r.toggle.textContent, v(e, "aria-pressed", r.toggle.ariaPressed), t.hidden = r.indicator.hidden, t.textContent = r.indicator.textContent, v(t, "data-listening", r.indicator.listening), v(t, "data-handoff-waiting", r.indicator.handoffWaiting), v(t, "data-cooling-down", r.indicator.coolingDown), v(t, "data-voice-input-listening", r.indicator.voiceInputListening), v(t, "data-voice-output-speaking", r.indicator.voiceOutputSpeaking), v(t, "data-network-retry", r.indicator.networkRetry), n && r.toast && (n.textContent = r.toast.textContent, b(n, "hidden", r.toast.hiddenClass));
		}
		function S(e, a) {
			let d = e?.querySelector?.("#handsFreeToggle"), m = e?.querySelector?.("#handsFreeIndicator"), _ = e?.querySelector?.("#micBtn"), v = e?.querySelector?.("#messageInput"), y = e?.querySelector?.("#toast") || null;
			if (!d || !m || !_ || !v) return null;
			if (l.has(d)) throw Error("HANDS_FREE_ALREADY_INSTALLED");
			let b = te(d, m, y), S = Object.freeze({});
			l.set(d, S);
			let C = u(a), w = !1, T = !1, E = null, D = null, O = null, k = null, A = null, j = !1, M = !1, N = !1, P = !1, F = 0, I = 350, L = "", R = !1, z = null, B = !1;
			function V(e) {
				y && e && (y.textContent = e, y.classList?.remove?.("hidden"));
			}
			function H() {
				R || (d.setAttribute?.("aria-pressed", String(w)), d.disabled = !C, d.textContent = w ? "Eller serbest açık" : "Eller serbest kapalı", m.hidden = !w, m.textContent = w ? N ? "○ Sesli giriş etkin" : j ? "○ Sesli giriş hazırlanıyor" : P ? "○ Hafize konuşuyor" : M ? "○ Yankı koruması etkin" : D && I > 350 ? "○ Konuşma servisine yeniden bağlanıyor" : T ? "● “Hafize” için dinliyor" : "○ Eller serbest beklemede" : "", m.setAttribute?.("data-listening", String(T)), m.setAttribute?.("data-handoff-waiting", String(j)), m.setAttribute?.("data-cooling-down", String(M)), m.setAttribute?.("data-voice-input-listening", String(N)), m.setAttribute?.("data-voice-output-speaking", String(P)), m.setAttribute?.("data-network-retry", String(F)));
			}
			function U() {
				D != null && typeof a?.clearTimeout == "function" && a.clearTimeout(D), D = null;
			}
			function W() {
				O != null && typeof a?.clearTimeout == "function" && a.clearTimeout(O), O = null, j = !1;
			}
			function G() {
				k != null && typeof a?.clearTimeout == "function" && a.clearTimeout(k), k = null;
			}
			function K() {
				A != null && typeof a?.clearTimeout == "function" && a.clearTimeout(A), A = null, M = !1;
			}
			function q() {
				F = 0, I = 350, L = "";
			}
			function J({ abort: e = !1 } = {}) {
				U();
				let t = E;
				if (E = null, T = !1, H(), t) try {
					e ? t.abort?.() : t.stop?.();
				} catch {}
			}
			function Y(t = I) {
				if (U(), R || !w || j || M || N || P || e.hidden || v.disabled) return;
				let n = Number.isFinite(t) && t >= 350 ? Math.min(t, i.at(-1)) : 350;
				I = n, typeof a?.setTimeout == "function" && (D = a.setTimeout(Q, n)), H();
			}
			function X(e) {
				w = !1, G(), W(), K(), U(), J({ abort: !0 }), H(), V(g(e));
			}
			function Z(e) {
				let t = ee(e);
				return L = t.code, t.kind === "aborted" ? t : t.kind === "idle" ? (I = 350, t) : t.kind === "network" ? (F += 1, F > i.length ? (X("network"), Object.freeze({
					code: t.code,
					kind: "terminal"
				})) : (I = h(F), F === 1 && V("Eller serbest konuşma servisine yeniden bağlanmayı deniyor."), t)) : (X(t.code), t);
			}
			function ne() {
				k = null, !R && w && (w = !1, W(), K(), J({ abort: !0 }), H(), V("Eller serbest dinleme 30 dakikalık güvenlik süresi sonunda kapatıldı. Devam etmek için yeniden aç."));
			}
			function re() {
				G(), w && !R && typeof a?.setTimeout == "function" && (k = a.setTimeout(ne, r));
			}
			function ie() {
				K(), w && !R && (M = !0, H(), typeof a?.setTimeout == "function" ? A = a.setTimeout(() => {
					A = null, !R && w && (M = !1, H(), Y());
				}, n) : (M = !1, H(), Y()));
			}
			function ae() {
				j && !N && !R && w && (typeof a?.setTimeout == "function" ? O = a.setTimeout(() => {
					O = null, j && !N && !R && w && (j = !1, H(), V("Sesli giriş başlatılamadı; “Hafize” dinlemesi yeniden açıldı."), Y());
				}, t) : (j = !1, H(), Y()));
			}
			function oe() {
				j || M || N || P || (j = !0, H(), J());
			}
			function Q() {
				if (U(), R || !w || !C || E || j || M || N || P || e.hidden || v.disabled) return;
				let t = new C();
				t.lang = e.documentElement?.lang || a?.navigator?.language || "tr-TR", t.continuous = !0, t.interimResults = !1, t.maxAlternatives = 1, E = t, t.onstart = () => {
					R || E !== t || (T = !0, L !== "network" && q(), H());
				}, t.onresult = (e) => {
					if (R || E !== t) return;
					let n = p(e);
					n && q(), !(M || P || !f(n)) && oe();
				}, t.onerror = (e) => {
					R || E !== t || Z(e?.error);
				}, t.onend = () => {
					R || (E === t && (E = null, T = !1), H(), w && (j ? (_.click?.(), j && !N && ae()) : Y()));
				};
				try {
					t.start();
				} catch {
					E = null, T = !1;
					let e = Z("unknown");
					H(), e.kind !== "terminal" && Y();
				}
			}
			function $(e) {
				if (R) return;
				let t = !!e && !!C;
				w !== t && (w = t, W(), K(), G(), q(), w ? (V("Eller serbest bu oturum için 30 dakika açıldı. Mikrofon görünür şekilde “Hafize” uyandırma ifadesini dinler; mesaj otomatik gönderilmez."), re(), Q()) : J({ abort: !0 }), H());
			}
			function se() {
				R || (C ? $(!w) : V("Eller serbest bu tarayıcıda desteklenmiyor."));
			}
			function ce() {
				R || (e.hidden ? (W(), K(), J({ abort: !0 })) : Y());
			}
			function le(e) {
				if (R) return;
				let t = e?.detail;
				t && t.source === "voice-input" && typeof t.listening == "boolean" && (N = t.listening, N ? (W(), K(), J({ abort: !0 })) : (W(), Y()), H());
			}
			function ue(e) {
				if (R) return;
				let t = e?.detail;
				if (!t || t.source !== "voice-output" || typeof t.speaking != "boolean") return;
				let n = P;
				P = t.speaking, P ? (K(), U(), J({ abort: !0 })) : n ? ie() : Y(), H();
			}
			function de() {
				!R && w && $(!1);
			}
			function fe() {
				B && (B = !1, d.removeEventListener?.("click", se), e.removeEventListener?.("visibilitychange", ce), e.removeEventListener?.(o, le), e.removeEventListener?.(s, ue), e.removeEventListener?.(c, de));
			}
			function pe() {
				l.get(d) === S && l.delete(d);
			}
			try {
				d.addEventListener?.("click", se), e.addEventListener?.("visibilitychange", ce), e.addEventListener?.(o, le), e.addEventListener?.(s, ue), e.addEventListener?.(c, de), B = !0;
				let t = a?.MutationObserver;
				z = typeof t == "function" ? new t(() => {
					R || (v.disabled ? (W(), K(), J({ abort: !0 })) : Y());
				}) : null, z?.observe?.(v, {
					attributes: !0,
					attributeFilter: ["disabled"]
				}), H();
			} catch (e) {
				throw R = !0, z?.disconnect?.(), fe(), G(), W(), K(), U(), E = null, T = !1, x(d, m, y, b), pe(), e;
			}
			return Object.freeze({
				isSupported: !!C,
				isEnabled: () => w,
				isListening: () => T,
				isHandoffWaiting: () => j,
				isCoolingDown: () => M,
				isVoiceInputListening: () => N,
				isVoiceOutputSpeaking: () => P,
				getNetworkErrorStreak: () => F,
				getRestartDelayMs: () => I,
				getLastRecognitionError: () => L,
				enable: () => $(!0),
				disable: () => $(!1),
				destroy() {
					if (R) return;
					R = !0, w = !1, N = !1, P = !1, q(), G(), W(), K(), U(), z?.disconnect?.();
					let e = E;
					if (E = null, T = !1, e) try {
						e.abort?.();
					} catch {}
					fe(), x(d, m, y, b), pe();
				}
			});
		}
		return Object.freeze({
			DEFAULT_WAKE_PHRASE: e,
			HANDOFF_TIMEOUT_MS: t,
			HANDS_FREE_REVOKE_EVENT: c,
			NETWORK_RETRY_DELAYS_MS: i,
			POST_OUTPUT_COOLDOWN_MS: n,
			RESTART_DELAY_MS: 350,
			SESSION_LIMIT_MS: r,
			VOICE_INPUT_STATE_EVENT: o,
			VOICE_OUTPUT_STATE_EVENT: s,
			classifyRecognitionError: ee,
			containsWakePhrase: f,
			getRecognitionConstructor: u,
			installHandsFree: S,
			networkRetryDelay: h,
			normalizeRecognitionError: m,
			normalizeSpeech: d,
			readRecognitionText: p,
			terminalRecognitionMessage: g
		});
	});
}));
//#endregion
export default t();

//# sourceMappingURL=hands-free.js.map