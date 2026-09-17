//#region public/prompt-library-smart-fill-hints.ts
var e = globalThis, t = "promptLibraryCard", n = "promptLibrarySmartFill", r = 1e3, i = 8e3, a = null, o = !1;
function s(e, t, n = "", r = "") {
	let i = e.createElement(t);
	return r && (i.className = r), i.textContent = n, i;
}
function c(e) {
	if (!e || e.hidden) return;
	e.querySelectorAll(".prompt-smart-fill-field input").forEach((t) => {
		let n = t.nextElementSibling;
		n?.classList.contains("prompt-smart-fill-count") || (n = s(e.ownerDocument, "small", "", "prompt-smart-fill-count"), t.after(n));
		let i = Math.min(r, String(t.value || "").length);
		n.textContent = `${i}/${r}`, n.setAttribute("aria-label", `${i} / ${r} karakter`);
	});
	let t = e.querySelector(".prompt-smart-fill-preview");
	if (!t) return;
	let n = e.querySelector(".prompt-smart-fill-preview-count");
	n || (n = s(e.ownerDocument, "small", "", "prompt-smart-fill-preview-count"), t.after(n));
	let a = Math.min(i, String(t.textContent || "").length);
	n.textContent = `${a}/${i} karakter`;
}
function l() {
	if (o || !e.document) return;
	let r = e.document.getElementById(t), i = e.document.getElementById(n);
	if (!r || !i) return;
	o = !0;
	let s = () => e.requestAnimationFrame?.(() => c(i));
	a = typeof MutationObserver == "function" ? new MutationObserver(s) : null, a?.observe(i, {
		childList: !0,
		subtree: !0,
		characterData: !0,
		attributes: !0
	}), i.addEventListener("input", s), e.addEventListener("beforeunload", () => {
		a?.disconnect(), a = null, i.removeEventListener("input", s);
	}, { once: !0 }), c(i);
}
e.HafizePromptSmartFillHints = Object.freeze({
	mount: l,
	paint: c
}), e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", l, { once: !0 }) : l();
//#endregion
export { c as paintSmartFillHints };

//# sourceMappingURL=prompt-library-smart-fill-hints.js.map