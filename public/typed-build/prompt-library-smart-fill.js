//#region public/prompt-library-smart-fill.ts
var e = globalThis, t = "hafize.prompt-library.smart-fill.v1", n = "promptLibraryCard", r = 1e3, i = 12, a = 6, o = 60, s = 8e3, c = () => e.HafizePromptLibrary, l = () => {
	try {
		return e.localStorage;
	} catch {
		return null;
	}
}, u = (e, t) => String(e ?? "").slice(0, t);
function d(e, t) {
	try {
		return JSON.parse(e);
	} catch {
		return t;
	}
}
function f(e) {
	return `${t}.${u(e, 120)}`;
}
function p(e) {
	let t = l();
	if (!t) return [];
	let n = null;
	try {
		n = t.getItem(f(e));
	} catch {
		return [];
	}
	let s = d(n || "[]", []);
	return Array.isArray(s) ? s.filter((e) => typeof e == "object" && !!e).slice(0, a).map((e) => ({
		id: u(e.id, 120),
		name: u(e.name, o).trim(),
		values: Object.freeze(Object.fromEntries(Object.entries(e.values && typeof e.values == "object" ? e.values : {}).slice(0, i).map(([e, t]) => [u(e, 32), u(t, r)])))
	})).filter((e) => !!(e.name && e.id)) : [];
}
function m(e, t) {
	let n = l();
	if (!n) return !1;
	try {
		return n.setItem(f(e), JSON.stringify(t.slice(0, a))), !0;
	} catch {
		return !1;
	}
}
function h(e) {
	let t = c()?.extractVariables?.(e) ?? [];
	return [...new Set(t.map((e) => u(e, 32)).filter(Boolean))].slice(0, i);
}
function g() {
	return e.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function _(e, t, n, r) {
	let i = e.createElement(t);
	return r && (i.className = r), n !== void 0 && (i.textContent = n), i;
}
function v(e, t, n = "soft-btn") {
	let r = _(e, "button", t, n);
	return r.type = "button", r;
}
function y(t = e.document, i = e) {
	let a = t?.getElementById(n);
	if (!t || !a || a.dataset.smartFillReady === "true") return null;
	a.dataset.smartFillReady = "true";
	let d = _(t, "section", void 0, "prompt-smart-fill");
	d.id = "promptLibrarySmartFill", d.hidden = !0, d.setAttribute("role", "dialog"), d.setAttribute("aria-modal", "true"), d.setAttribute("aria-labelledby", "promptSmartFillTitle"), d.setAttribute("aria-describedby", "promptSmartFillDescription");
	let f = _(t, "div", void 0, "prompt-smart-fill-shell"), y = _(t, "div", void 0, "prompt-smart-fill-head"), b = _(t, "strong", "İstemi doldur", "prompt-smart-fill-title");
	b.id = "promptSmartFillTitle";
	let x = v(t, "Kapat", "mini-btn");
	x.setAttribute("aria-label", "İstem doldurma panelini kapat"), y.append(b, x);
	let S = _(t, "p", "Değişken değerlerini gir. Önizlemeyi kontrol ettikten sonra istemi mesaj alanına aktar.");
	S.id = "promptSmartFillDescription";
	let C = _(t, "form", void 0, "prompt-smart-fill-form"), w = _(t, "div", void 0, "prompt-smart-fill-fields"), T = _(t, "div", void 0, "prompt-smart-fill-presets"), E = _(t, "div", "Önizleme", "prompt-smart-fill-preview-label"), D = _(t, "pre", "", "prompt-smart-fill-preview");
	D.setAttribute("aria-live", "polite");
	let O = _(t, "div", "", "prompt-smart-fill-errors");
	O.setAttribute("role", "alert");
	let k = _(t, "div", void 0, "prompt-smart-fill-actions"), A = v(t, "Önizlemeyi kopyala"), j = v(t, "Vazgeç"), M = v(t, "Mesaja aktar");
	k.append(A, j, M), C.append(w, T, E, D, O, k), f.append(y, S, C), d.append(f), a.append(d);
	let N = null, P = [], F = /* @__PURE__ */ new Map(), I = null, L = () => {
		d.hidden = !0, w.replaceChildren(), T.replaceChildren(), O.textContent = "", N = null, P = [], F = /* @__PURE__ */ new Map(), I instanceof HTMLElement && I.focus(), I = null;
	}, R = (e) => {
		O.textContent = u(e, 180);
	}, z = () => Object.fromEntries(P.map((e) => [e, u(F.get(e)?.value, r)])), B = () => {
		if (!N) return;
		let e = z();
		D.textContent = c()?.replaceVariables?.(N.body, e)?.slice(0, s) || N.body.slice(0, s);
	}, V = () => {
		if (T.replaceChildren(), !N || !P.length) return;
		let e = _(t, "select", void 0, "prompt-smart-fill-preset-select");
		e.setAttribute("aria-label", "Kaydedilmiş değişken seti");
		let n = _(t, "option", "Değişken seti seç…");
		n.value = "", e.append(n), p(N.id).forEach((n) => {
			let r = _(t, "option", n.name);
			r.value = n.id, e.append(r);
		});
		let r = v(t, "Seti kaydet", "mini-btn"), a = v(t, "Setleri temizle", "mini-btn");
		T.append(e, r, a), e.addEventListener("change", () => {
			if (!N) return;
			let t = p(N.id).find((t) => t.id === e.value);
			t && (P.forEach((e) => {
				let n = F.get(e);
				n && (n.value = t.values[e] || "");
			}), B());
		}), r.addEventListener("click", () => {
			if (!N) return;
			let e = i.prompt?.("Değişken seti adı:", "")?.trim?.() || "";
			if (!e) return;
			let t = Object.freeze({
				id: g(),
				name: u(e, o),
				values: Object.freeze(z())
			});
			m(N.id, [t, ...p(N.id)]) ? V() : R("Değişken seti kaydedilemedi.");
		}), a.addEventListener("click", () => {
			N && i.confirm?.("Bu istemin kaydedilmiş değişken setleri silinsin mi?") && (m(N.id, []), V());
		});
	}, H = (e) => {
		let t = c(), n = l();
		if (!t?.loadItems || !t.normalizeItem || !t.saveItems || !n) return;
		let r = t.loadItems(n), a = r.findIndex((t) => t.id === e);
		if (a < 0) return;
		let o = r.slice(), s = r[a];
		if (!s) return;
		let u = t.normalizeItem({
			...s,
			useCount: Number(s.useCount) + 1,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		});
		if (u && (o[a] = u, t.saveItems(n, o))) try {
			let e = {
				key: t.STORAGE_KEY,
				newValue: JSON.stringify(o),
				storageArea: n
			};
			typeof i.StorageEvent == "function" && i.dispatchEvent(new i.StorageEvent("storage", e));
		} catch {}
	}, U = () => {
		if (!N) return;
		let e = z(), n = P.filter((t) => (e[t] ?? "").trim().length === 0);
		if (n.length) return R(`Doldurulmamış değişkenler: ${n.map((e) => `{{${e}}}`).join(", ")}`);
		let r = c()?.replaceVariables?.(N.body, e)?.slice(0, s) || N.body.slice(0, s), i = t.querySelector("#messageInput");
		if (!i) return R("Mesaj alanı bulunamadı.");
		let a = N.id;
		i.value = r, i.dispatchEvent(new Event("input", { bubbles: !0 })), i.focus(), L(), H(a);
	}, W = (e) => {
		N = e, P = h(e.body), F = /* @__PURE__ */ new Map(), I = t.activeElement, w.replaceChildren(), O.textContent = "", P.forEach((e, n) => {
			let a = _(t, "label", void 0, "prompt-smart-fill-field"), o = _(t, "span", `{{${e}}}`, "prompt-smart-fill-label"), s = _(t, "input");
			s.type = "text", s.maxLength = r, s.autocomplete = "off", s.name = e, s.placeholder = `${e} değeri`, s.setAttribute("aria-label", `${e} değişken değeri`), s.addEventListener("input", B), s.addEventListener("keydown", (e) => {
				if (e.key !== "Enter" && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
				e.preventDefault();
				let t = [...F.values()], n = Math.max(0, t.indexOf(s));
				t[e.key === "ArrowUp" ? Math.max(0, n - 1) : Math.min(t.length - 1, n + 1)]?.focus();
			}), a.append(o, s), w.append(a), F.set(e, s), n === 0 && i.setTimeout?.(() => s.focus(), 0);
		}), V(), B(), d.hidden = !1, P.length || R("Bu istem değişken içermiyor. Doğrudan mesaja aktarılabilir.");
	}, G = (e) => {
		if (d.hidden) return;
		if (e.key === "Escape") {
			e.preventDefault(), L();
			return;
		}
		if (e.key !== "Tab") return;
		let n = [...d.querySelectorAll("button,input,select")].filter((e) => !e.hidden && !e.hasAttribute("disabled"));
		if (!n.length) return;
		let r = n[0], i = n[n.length - 1];
		r && i && (e.shiftKey && t.activeElement === r ? (e.preventDefault(), i.focus()) : !e.shiftKey && t.activeElement === i && (e.preventDefault(), r.focus()));
	}, K = (e) => {
		let t = e.target instanceof Element ? e.target.closest(".prompt-item-actions button") : null;
		if (!t || t.textContent?.trim() !== "Kullan") return;
		let n = t.closest(".prompt-item")?.dataset.promptId;
		if (!n) return;
		let r = c()?.loadItems?.(l())?.find((e) => e.id === n);
		r && h(r.body).length && (e.preventDefault(), e.stopImmediatePropagation(), W(r));
	};
	return x.addEventListener("click", L), j.addEventListener("click", L), A.addEventListener("click", async () => {
		try {
			await i.navigator?.clipboard?.writeText?.(D.textContent || ""), R("Önizleme panoya kopyalandı.");
		} catch {
			R("Önizleme panoya kopyalanamadı.");
		}
	}), M.addEventListener("click", U), d.addEventListener("keydown", G), a.addEventListener("click", K, !0), Object.freeze({
		mounted: !0,
		open: W,
		close: L,
		destroy: () => {
			a.removeEventListener("click", K, !0), L(), d.remove(), delete a.dataset.smartFillReady;
		}
	});
}
e.HafizePromptLibrarySmartFill = Object.freeze({
	STORAGE_KEY: t,
	mount: y,
	readPresets: p,
	writePresets: m,
	variableNames: h
});
var b = () => {
	e.document && y(e.document, e);
};
e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", b, { once: !0 }) : b();
//#endregion
export { p as readPresets, h as variableNames, m as writePresets };

//# sourceMappingURL=prompt-library-smart-fill.js.map