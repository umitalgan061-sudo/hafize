import { t as e } from "./rolldown-runtime-CtkjhSXr.js";
//#region public/typed/hands-free-background-guard.ts
var t = /* @__PURE__ */ e(((e, t) => {
	(function(e, n) {
		let r = n();
		if (typeof t == "object" && t?.exports) {
			t.exports = r;
			return;
		}
		e.HafizeHandsFreeBackgroundGuard = r;
		let i = () => r.installHandsFreeBackgroundGuard(e.document, e);
		e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", i, { once: !0 }) : i();
	})(typeof globalThis < "u" ? globalThis : self, function() {
		let e = "hafize:hands-free-revoke", t = "data-background-revoked", n = "Eller serbest, uygulama arka plana geçtiği, mikrofon izni kaldırıldığı veya kullanılabilir mikrofon kalmadığı için kapatıldı. Yeniden dinlemek için mikrofonu ve izni kontrol edip Eller serbest düğmesinden tekrar onay ver.", r = "microphone-permission-withdrawn", i = "microphone-device-unavailable", a = /* @__PURE__ */ new WeakMap();
		function o(e) {
			return e?.getAttribute?.("aria-pressed") === "true";
		}
		function s(e) {
			return e === "granted" || e === "prompt" || e === "denied" ? e : "unknown";
		}
		function c(e) {
			return Array.isArray(e) ? e.some((e) => e?.kind === "audioinput") : null;
		}
		function l(t, n) {
			let r = Object.freeze({
				source: "hands-free-background-guard",
				reason: typeof n == "string" && n ? n : "background"
			});
			return typeof t?.CustomEvent == "function" ? new t.CustomEvent(e, { detail: r }) : {
				type: e,
				detail: r
			};
		}
		function u(e, u) {
			let d = e?.querySelector?.("#handsFreeToggle"), f = e?.querySelector?.("#toast") || null;
			if (!d) return null;
			if (a.has(d)) throw Error("HANDS_FREE_BACKGROUND_GUARD_ALREADY_INSTALLED");
			let p = Object.freeze({
				revokedPresent: !!d.hasAttribute?.(t),
				revokedValue: d.getAttribute?.(t) ?? null
			}), m = !1, h = "", g = !1, _ = null, v = null, y = "unavailable", b = 0, x = 0, S = "unavailable", C = !1;
			function w() {
				p.revokedPresent ? d.setAttribute?.(t, p.revokedValue ?? "") : d.removeAttribute?.(t);
			}
			function T() {
				return m || !g || e.hidden === !0 || !f ? !1 : (g = !1, f.textContent = n, f.classList?.remove?.("hidden"), !0);
			}
			function E() {
				return h = "revocation-failed", g = !1, d.setAttribute?.(t, h), !1;
			}
			function D(t) {
				return typeof e?.dispatchEvent == "function" && (e.dispatchEvent(l(u, t)), !0);
			}
			function O(e) {
				if (m || !o(d)) return !1;
				let n = typeof e == "string" && e ? e : "background";
				try {
					if (!D(n)) return E();
				} catch {
					return E();
				}
				return o(d) ? E() : (h = n, d.setAttribute?.(t, h), g = h !== "explicit-guard", !0);
			}
			function k() {
				if (m || y === "unavailable" || y === "unknown" || y === "granted" || !o(d)) return !1;
				let e = O(r);
				return e && T(), e;
			}
			function A() {
				!m && v && (y = s(v.state), k());
			}
			function j() {
				v && v.removeEventListener?.("change", A), v = null;
			}
			async function M() {
				let e = u?.navigator?.permissions;
				if (typeof e?.query != "function") return !1;
				let t = ++b, n;
				try {
					n = await e.query({ name: "microphone" });
				} catch {
					return !m && t === b && (y = "unavailable"), !1;
				}
				return m || t !== b ? !1 : (j(), v = n || null, y = s(v?.state), v?.addEventListener?.("change", A), k(), !!v);
			}
			async function N() {
				let e = u?.navigator?.mediaDevices;
				if (typeof e?.enumerateDevices != "function") return S = "unavailable", !1;
				if (!o(d)) return S = "inactive", !1;
				let t = ++x, n;
				try {
					n = await e.enumerateDevices();
				} catch {
					return !m && t === x && (S = "unavailable"), !1;
				}
				if (m || t !== x) return !1;
				let r = c(n);
				return r == null ? (S = "unknown", !1) : (S = r ? "available" : "missing", !r && o(d) && O(i) && T(), r);
			}
			function P() {
				!m && o(d) && N();
			}
			function F() {
				let e = u?.navigator?.mediaDevices;
				return C || typeof e?.addEventListener != "function" || typeof e?.enumerateDevices != "function" ? !1 : (e.addEventListener("devicechange", P), C = !0, o(d) && N(), !0);
			}
			function I() {
				C && (u?.navigator?.mediaDevices?.removeEventListener?.("devicechange", P), C = !1, x += 1);
			}
			function L() {
				e.hidden === !0 ? O("hidden") : T();
			}
			function R() {
				O("pagehide");
			}
			function z() {
				T();
			}
			function B() {
				O("window-blur");
			}
			function V() {
				T();
			}
			function H() {
				O("freeze");
			}
			try {
				e.addEventListener?.("visibilitychange", L, !0), e.addEventListener?.("freeze", H, !0), u?.addEventListener?.("pagehide", R, !0), u?.addEventListener?.("pageshow", z, !0), u?.addEventListener?.("blur", B, !0), u?.addEventListener?.("focus", V, !0), e.hidden === !0 && O("hidden-at-install"), M(), F();
			} catch (t) {
				throw b += 1, x += 1, j(), I(), e.removeEventListener?.("visibilitychange", L, !0), e.removeEventListener?.("freeze", H, !0), u?.removeEventListener?.("pagehide", R, !0), u?.removeEventListener?.("pageshow", z, !0), u?.removeEventListener?.("blur", B, !0), u?.removeEventListener?.("focus", V, !0), w(), t;
			}
			return _ = Object.freeze({
				isRevoked: () => !m && !!h,
				hasPendingNotice: () => !m && g,
				getLastReason: () => m ? "" : h,
				getMicrophonePermissionState: () => m ? "unavailable" : y,
				getMicrophoneDeviceAvailability: () => m ? "unavailable" : S,
				revoke: () => O("explicit-guard"),
				announce: T,
				refreshMicrophonePermission: () => m ? Promise.resolve(!1) : M(),
				refreshMicrophoneDevices: () => m ? Promise.resolve(!1) : N(),
				destroy() {
					m || (m = !0, g = !1, b += 1, x += 1, j(), I(), y = "unavailable", S = "unavailable", e.removeEventListener?.("visibilitychange", L, !0), e.removeEventListener?.("freeze", H, !0), u?.removeEventListener?.("pagehide", R, !0), u?.removeEventListener?.("pageshow", z, !0), u?.removeEventListener?.("blur", B, !0), u?.removeEventListener?.("focus", V, !0), w(), a.get(d) === _ && a.delete(d));
				}
			}), a.set(d, _), _;
		}
		return Object.freeze({
			HANDS_FREE_REVOKE_EVENT: e,
			MICROPHONE_DEVICE_REASON: i,
			MICROPHONE_PERMISSION_REASON: r,
			REVOKED_ATTR: t,
			REVOCATION_NOTICE: n,
			createRevokeEvent: l,
			hasAudioInput: c,
			isHandsFreeEnabled: o,
			installHandsFreeBackgroundGuard: u,
			normalizePermissionState: s
		});
	});
}));
//#endregion
export default t();

//# sourceMappingURL=hands-free-background-guard.js.map