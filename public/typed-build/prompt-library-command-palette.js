//#region public/prompt-library-command-palette.ts
var e = globalThis, t = "messageInput", n = "promptLibraryCommandPalette", r = 12, i = 120;
function a(e, t, n, r) {
	let i = e.createElement(t);
	return r && (i.className = r), n !== void 0 && (i.textContent = n), i;
}
function o() {
	try {
		return e.HafizePromptLibrary?.loadItems?.(e.localStorage) ?? [];
	} catch {
		return [];
	}
}
function s(e, t) {
	let n = t.toLocaleLowerCase("tr-TR").trim();
	if (!n) return 0;
	let r = String(e.title || "").toLocaleLowerCase("tr-TR"), i = (e.tags || []).join(" ").toLocaleLowerCase("tr-TR"), a = String(e.body || "").toLocaleLowerCase("tr-TR");
	return r === n ? 100 : r.startsWith(n) ? 80 : r.includes(n) ? 60 : i.includes(n) ? 45 : a.includes(n) ? 20 : 0;
}
function c(e) {
	let t = String(e || "").slice(0, i);
	return o().map((e) => ({
		item: e,
		score: s(e, t)
	})).filter((e) => e.score > 0).sort((e, t) => t.score - e.score || Number(!!t.item.favorite) - Number(!!e.item.favorite) || String(t.item.updatedAt || "").localeCompare(String(e.item.updatedAt || ""))).slice(0, r).map((e) => e.item);
}
function l(t) {
	return e.HafizePromptLibrary?.extractVariables?.(t.body)?.length ?? 0;
}
function u(r = e.document, s = e) {
	let u = r?.getElementById(t);
	if (!r || !u || r.getElementById(n)) return null;
	let d = a(r, "section", void 0, "prompt-command-palette");
	d.id = n, d.hidden = !0, d.setAttribute("role", "dialog"), d.setAttribute("aria-modal", "false"), d.setAttribute("aria-label", "İstem seçici");
	let f = a(r, "div", void 0, "prompt-command-palette-head");
	f.append(a(r, "strong", "İstem seçici"), a(r, "span", "↑ ↓ seç · Enter ekle · Esc kapat", "prompt-command-palette-hint"));
	let p = a(r, "input");
	p.type = "search", p.maxLength = i, p.placeholder = "İstem ara…", p.setAttribute("aria-label", "İstem seçicide ara");
	let m = a(r, "div", void 0, "prompt-command-palette-list");
	m.setAttribute("role", "listbox");
	let h = a(r, "div", "", "prompt-command-palette-status");
	h.setAttribute("role", "status"), h.setAttribute("aria-live", "polite"), d.append(f, p, m, h), r.body.append(d);
	let g = 0, _ = [], v = -1, y = null, b = () => {
		d.hidden = !0, p.value = "", m.replaceChildren(), _ = [], g = 0, v = -1, y instanceof HTMLElement && y.focus(), y = null;
	}, x = (e) => {
		let t = u.value, n = v >= 0 ? v : 0, r = t.slice(0, n).replace(/\/prompt(?:\s+[^\n]*)?$/, "");
		if (l(e) && s.HafizePromptLibrarySmartFill?.open) {
			b(), s.HafizePromptLibrarySmartFill.open(e);
			return;
		}
		u.value = `${r}${e.body}`, u.dispatchEvent(new Event("input", { bubbles: !0 })), u.focus(), b(), s.dispatchEvent(new CustomEvent("hafize:prompt-command-inserted", { detail: {
			id: e.id,
			title: e.title
		} }));
	}, S = () => {
		_ = c(p.value), m.replaceChildren(), g = Math.min(g, Math.max(0, _.length - 1)), h.textContent = _.length ? `${_.length} istem bulundu.` : o().length ? "Eşleşen istem bulunamadı." : "Kütüphanede istem yok.", _.forEach((e, t) => {
			let n = a(r, "button", void 0, "prompt-command-palette-item");
			n.type = "button", n.dataset.promptId = e.id, n.setAttribute("role", "option"), n.setAttribute("aria-selected", String(t === g)), n.append(a(r, "span", e.title, "prompt-command-palette-name"), a(r, "span", `${e.favorite ? "★ " : ""}${e.tags?.slice(0, 2).join(" · ") || "etiketsiz"}${l(e) ? ` · ${l(e)} değişken` : ""}`, "prompt-command-palette-meta")), n.addEventListener("click", () => x(e)), m.append(n);
		}), m.children[g]?.scrollIntoView?.({ block: "nearest" });
	}, C = (e) => {
		y = r.activeElement, v = Math.max(0, e), d.hidden = !1, p.value = "", g = 0, S(), p.focus();
	}, w = (e) => {
		_.length && (g = (g + e + _.length) % _.length, [...m.children].forEach((e, t) => e.setAttribute("aria-selected", String(t === g))), m.children[g]?.scrollIntoView?.({ block: "nearest" }));
	}, T = () => {
		let e = u.selectionStart ?? u.value.length;
		return u.value.slice(0, e).match(/(^|\s)\/prompt(?:\s+([^\n]*))?$/i);
	}, E = (e) => {
		let t = T(), n = u.selectionStart ?? u.value.length;
		if (t) {
			if (!e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && [
				"ArrowDown",
				"ArrowUp",
				"Enter"
			].includes(e.key)) {
				d.hidden && C(n - t[0].length + +!!t[1]), e.key === "ArrowDown" && (e.preventDefault(), w(1)), e.key === "ArrowUp" && (e.preventDefault(), w(-1));
				let r = _[g];
				e.key === "Enter" && r && (e.preventDefault(), x(r));
			} else d.hidden && !e.ctrlKey && !e.metaKey && e.key === " " && C(n - t[0].length + +!!t[1]);
		}
	}, D = () => {
		let e = T();
		if (!e) {
			d.hidden || b();
			return;
		}
		let t = u.selectionStart ?? u.value.length;
		d.hidden && C(t - e[0].length + +!!e[1]), p.value = (e[2] || "").slice(0, i), g = 0, S();
	}, O = () => {
		g = 0, S();
	}, k = (e) => {
		let t = _[g];
		e.key === "Escape" ? (e.preventDefault(), b()) : e.key === "ArrowDown" ? (e.preventDefault(), w(1)) : e.key === "ArrowUp" ? (e.preventDefault(), w(-1)) : e.key === "Enter" && t && (e.preventDefault(), x(t));
	}, A = (e) => {
		(e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "o" && (e.preventDefault(), d.hidden ? C(u.selectionStart ?? u.value.length) : b());
	};
	return u.addEventListener("keydown", E), u.addEventListener("input", D), p.addEventListener("input", O), d.addEventListener("keydown", k), s.addEventListener("keydown", A), Object.freeze({
		mounted: !0,
		open: C,
		close: b,
		search: c,
		destroy: () => {
			b(), u.removeEventListener("keydown", E), u.removeEventListener("input", D), p.removeEventListener("input", O), d.removeEventListener("keydown", k), s.removeEventListener("keydown", A), d.remove();
		}
	});
}
e.PromptLibraryCommandPalette = Object.freeze({
	mount: u,
	results: c
});
var d = () => {
	e.document && u(e.document, e);
};
e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", d, { once: !0 }) : d();
//#endregion
export { c as searchPromptLibrary };

//# sourceMappingURL=prompt-library-command-palette.js.map