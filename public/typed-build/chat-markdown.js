import { t as e } from "./rolldown-runtime-CtkjhSXr.js";
//#region public/chat-markdown.ts
var t = /* @__PURE__ */ e(((e, t) => {
	(function(e, n) {
		let r = n(e);
		typeof t == "object" && t?.exports ? t.exports = r : e.HafizeChatMarkdown = r;
	})(typeof globalThis < "u" ? globalThis : self, function(e) {
		let t = 1400, n = /* @__PURE__ */ new WeakMap(), r = /* @__PURE__ */ new WeakMap();
		function i() {
			let t = e.HafizeMarkdown;
			return t && typeof t.renderMarkdownInto == "function" ? t : null;
		}
		function a(e) {
			let t = n.get(e);
			if (!t) return null;
			n.delete(e);
			let r = i(), { text: a, options: o } = t;
			return !r || o.plain ? r ? r.renderPlainInto(e, a, o) ? { rendered: !1 } : null : (e.textContent = a || o.placeholder || "", { rendered: !1 }) : r.renderMarkdownInto(e, a, o);
		}
		function o(t) {
			let n = r.get(t);
			n !== void 0 && (r.delete(t), typeof e.cancelAnimationFrame == "function" && e.cancelAnimationFrame(n));
		}
		function s(t) {
			if (r.has(t)) return;
			if (typeof e.requestAnimationFrame != "function") {
				a(t);
				return;
			}
			let n = e.requestAnimationFrame(() => {
				r.delete(t), a(t);
			});
			r.set(t, n);
		}
		function c(e, t, r = {}) {
			if (!e) return null;
			if (n.set(e, {
				text: typeof t == "string" ? t : "",
				options: r
			}), r.streaming) return e.setAttribute?.("aria-busy", "true"), s(e), null;
			o(e);
			let i = a(e);
			return e.removeAttribute?.("aria-busy"), i;
		}
		function l(t) {
			let n = e.HafizeMarkdown;
			return (typeof n?.sourceFor == "function" ? n.sourceFor(t) : "") || t?.textContent || "";
		}
		function u(t) {
			let n = e.HafizeMarkdown;
			if (typeof n?.toPlainText == "function" && typeof n?.sourceFor == "function") {
				let e = n.toPlainText(n.sourceFor(t));
				if (e) return e;
			}
			return t?.textContent ?? "";
		}
		function d(e) {
			return (e?.closest?.(".md-code"))?.querySelector?.(".md-code-body code")?.textContent ?? "";
		}
		async function f(t) {
			if (!t) return !1;
			try {
				if (e.navigator?.clipboard?.writeText) return await e.navigator.clipboard.writeText(t), !0;
			} catch {}
			let n = e.document;
			if (!n?.body) return !1;
			let r = n.createElement("textarea");
			r.value = t, r.setAttribute("aria-hidden", "true"), r.style.position = "fixed", r.style.opacity = "0", n.body.append(r), r.select();
			let i = !1;
			try {
				i = n.execCommand("copy");
			} catch {
				i = !1;
			}
			return r.remove(), i;
		}
		function p(n, r) {
			n.setAttribute("data-state", r), e.clearTimeout?.(Number(n.dataset.resetHandle));
			let i = e.setTimeout?.(() => n.setAttribute("data-state", "idle"), t);
			i !== void 0 && (n.dataset.resetHandle = String(i));
		}
		async function m(e) {
			let t = e.target?.closest?.("[data-md-copy=\"code\"]");
			t && (e.preventDefault(), p(t, await f(d(t)) ? "copied" : "failed"));
		}
		function h(t) {
			let n = t ?? e.document?.querySelector?.("#messages");
			return !n || n.dataset?.mdCopyBound === "true" ? !1 : (n.addEventListener("click", m), n.dataset && (n.dataset.mdCopyBound = "true"), !0);
		}
		return e.document?.querySelector && h(), Object.freeze({
			paint: c,
			sourceFor: l,
			plainTextFor: u,
			copyText: f,
			codeTextFor: d,
			init: h,
			COPY_FEEDBACK_MS: t
		});
	});
}));
//#endregion
export default t();

//# sourceMappingURL=chat-markdown.js.map