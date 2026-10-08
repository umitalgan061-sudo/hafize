import { t as e } from "./hafize-api-EobSHD72.js";
var t = 12e3;
function n(e, n = 3, r = t) {
	if (!Array.isArray(e) || n <= 0 || r <= 0) return [];
	let i = [], a = /* @__PURE__ */ new Set();
	for (let t of e) {
		if (typeof t != "string") continue;
		let e = t.trim().slice(0, r);
		if (e && !a.has(e) && (a.add(e), i.push(e), i.length >= n)) break;
	}
	return i;
}
function r(e, r, i = 3, a = t) {
	let o = typeof r == "string" ? r.trim().slice(0, a) : "", s = n(e, i, a);
	return o ? [o, ...s.filter((e) => e !== o)].slice(0, i) : s;
}
function i(e, i, a = 3, o = t) {
	let s = typeof e == "string" ? e.trim().slice(0, o) : "", c = n(i, a, o);
	if (!c.length) return null;
	let [l, ...u] = c;
	return l ? {
		current: l,
		alternates: r(u, s, a, o)
	} : null;
}
function a(e, t) {
	if (!Array.isArray(e) || !Number.isInteger(t) || t < 1 || t !== e.length - 1) return !1;
	let n = e[t];
	return !!(n && typeof n == "object" && n.role === "assistant" && typeof n.content == "string" && String(n.content).trim());
}
function o(e, t, n, r, i = (/* @__PURE__ */ new Date()).toISOString()) {
	let a = Number.isFinite(Number(r)) && Number(r) >= 0 ? Math.min(6e5, Math.floor(Number(r))) : null;
	return Object.freeze({
		model: typeof e == "string" ? e.trim().slice(0, 160) : "",
		agentId: typeof t == "string" ? t.trim().slice(0, 120) : "",
		toolsEnabled: n === !0,
		generatedAt: typeof i == "string" ? i.slice(0, 40) : (/* @__PURE__ */ new Date()).toISOString(),
		durationMs: a
	});
}
function s(e, r, i = t) {
	let a = typeof e == "string" ? e.trim().slice(0, i) : "", o = n(r, 3, i), s = [];
	return a && s.push({
		index: 0,
		kind: "current",
		content: a
	}), o.forEach((e, t) => s.push({
		index: s.length,
		kind: "previous",
		content: e
	})), s;
}
function c(e, r, i, a = t) {
	let o = s(e, r, a);
	if (!Number.isInteger(i) || i <= 0 || i >= o.length) return null;
	let c = o[i];
	if (!c) return null;
	let l = o.filter((e, t) => t !== 0 && t !== i).map((e) => e.content);
	return {
		current: c.content,
		alternates: n([o[0]?.content || "", ...l], 3, a)
	};
}
//#endregion
//#region public/typed/response-variants-ui.ts
var l = "hafizeResponseVariantsDialog", u = 8e3;
function d(e, t, n = "", r = "") {
	let i = e.createElement(t);
	return r && (i.className = r), n && (i.textContent = n), i;
}
function f(e, t) {
	e.getElementById(l)?.remove(), t?.focus?.();
}
function p(e, t, n, r) {
	let i = d(e, "article", "", "response-variant-card");
	i.dataset.variantIndex = String(t.index), n && (i.dataset.active = "true");
	let a = d(e, "div", "", "response-variant-card-head"), o = d(e, "strong", t.kind === "current" ? "Mevcut yanıt" : "Önceki yanıt"), s = d(e, "span", String(t.index + 1), "response-variant-index");
	a.append(o, s);
	let c = d(e, "pre", "", "response-variant-preview");
	c.setAttribute("aria-label", "Yanıt varyantı önizlemesi"), c.textContent = t.content.slice(0, u);
	let l = d(e, "button", n ? "Mevcut" : "Bu yanıtı kullan", "message-action");
	return l.type = "button", l.disabled = n, l.setAttribute("aria-label", n ? "Mevcut yanıt" : "Bu yanıt varyantını mevcut yanıt yap"), l.addEventListener("click", r), i.append(a, c, l), i;
}
function m(e) {
	let t = e.documentRef ?? document;
	if (t.getElementById(l)?.remove(), s(e.current, e.alternates).length <= 1) return;
	let n = d(t, "div", "", "response-variant-dialog");
	n.id = l, n.setAttribute("role", "dialog"), n.setAttribute("aria-modal", "true"), n.setAttribute("aria-labelledby", "hafizeResponseVariantsTitle"), n.tabIndex = -1;
	let r = d(t, "div", "", "response-variant-panel"), i = d(t, "div", "", "response-variant-panel-head"), a = d(t, "h3", "Yanıt varyantları");
	a.id = "hafizeResponseVariantsTitle";
	let o = d(t, "button", "Kapat", "message-action");
	o.type = "button", o.setAttribute("aria-label", "Yanıt varyantları panelini kapat"), i.append(a, o);
	let u = d(t, "p", "Önceki üretimleri incele ve istediğin yanıtı mevcut cevap olarak seç.", "response-variant-help"), m = d(t, "div", "", "response-variant-list");
	m.setAttribute("role", "list");
	let h = () => {
		m.replaceChildren(), s(e.current, e.alternates).forEach((n) => {
			let r = p(t, n, n.index === 0, () => {
				let r = c(e.current, e.alternates, n.index);
				r && (e.onSelect(r.current, r.alternates), f(t, e.trigger));
			});
			r.setAttribute("role", "listitem"), m.append(r);
		});
	};
	o.addEventListener("click", () => f(t, e.trigger)), n.addEventListener("keydown", (n) => {
		n.key === "Escape" && (n.preventDefault(), f(t, e.trigger));
	}), n.addEventListener("click", (r) => {
		r.target === n && f(t, e.trigger);
	});
	let g = d(t, "div", "", "response-variant-dialog-actions"), _ = d(t, "button", "Vazgeç", "message-action");
	_.type = "button", _.addEventListener("click", () => f(t, e.trigger)), g.append(_), r.append(i, u, m, g), n.append(r), (t.body ?? t.documentElement).append(n), h();
	let v = () => [...n.querySelectorAll("button:not([disabled]), textarea, input, select")];
	n.addEventListener("keydown", (e) => {
		if (e.key !== "Tab") return;
		let n = v();
		if (!n.length) return;
		let r = n.indexOf(t.activeElement);
		e.shiftKey && r <= 0 ? (e.preventDefault(), n.at(-1)?.focus()) : !e.shiftKey && r === n.length - 1 && (e.preventDefault(), n[0]?.focus());
	}), o.focus();
}
//#endregion
//#region public/typed/response-regeneration-options.ts
var h = Object.freeze([
	Object.freeze({
		id: "concise",
		label: "Daha kısa",
		instruction: "Aynı soruyu yanıtla; önceki cevabı daha kısa, doğrudan ve gereksiz tekrarları azaltılmış biçimde yeniden yaz."
	}),
	Object.freeze({
		id: "detailed",
		label: "Daha detaylı",
		instruction: "Aynı soruyu yanıtla; önceki cevabı daha ayrıntılı, gerekçeli ve gerekli bağlamı eklenmiş biçimde yeniden yaz."
	}),
	Object.freeze({
		id: "formal",
		label: "Daha resmi",
		instruction: "Aynı soruyu yanıtla; önceki cevabı daha resmi, profesyonel ve nötr bir dille yeniden yaz."
	}),
	Object.freeze({
		id: "bullets",
		label: "Madde madde",
		instruction: "Aynı soruyu yanıtla; önceki cevabı mümkün olduğunca okunabilir başlıklar ve madde işaretleri kullanarak yeniden yaz."
	})
]);
function g(e) {
	return typeof e == "string" ? e.replace(/\0/g, "").trim().slice(0, 600) : "";
}
function _(e, t) {
	if (!Array.isArray(e)) return [];
	let n = [];
	for (let t of e) {
		if (!t || typeof t != "object") continue;
		let e = t.role, r = t.content;
		if (e !== "user" && e !== "assistant" && e !== "system" || typeof r != "string") continue;
		let i = r.trim().slice(0, 12e3);
		i && n.push({
			role: e,
			content: i
		});
	}
	let r = g(t);
	return r && n.push({
		role: "user",
		content: r
	}), n;
}
//#endregion
//#region public/typed/response-regeneration-options-ui.ts
var v = "hafizeRegenerationOptionsDialog";
function y(e, t, n = "", r = "") {
	let i = e.createElement(t);
	return r && (i.className = r), n && (i.textContent = n), i;
}
function b(e = document) {
	e.getElementById(v)?.remove();
}
function ee(e) {
	let t = e.documentRef ?? document;
	b(t);
	let n = y(t, "div", "", "response-regeneration-options");
	n.id = v, n.setAttribute("role", "dialog"), n.setAttribute("aria-modal", "true"), n.setAttribute("aria-labelledby", "hafizeRegenerationOptionsTitle"), n.tabIndex = -1;
	let r = y(t, "div", "", "response-regeneration-options-panel"), i = y(t, "div", "", "response-regeneration-options-head"), a = y(t, "h3", "Yeniden üretme seçenekleri");
	a.id = "hafizeRegenerationOptionsTitle";
	let o = y(t, "button", "Kapat", "message-action");
	o.type = "button", o.setAttribute("aria-label", "Yeniden üretme seçeneklerini kapat"), i.append(a, o);
	let s = y(t, "p", "Yeni cevabı hangi yönde değiştirmek istediğini seç. Bu yönerge sohbete ayrı bir mesaj olarak kaydedilmez.", "response-regeneration-options-help"), c = y(t, "div", "", "response-regeneration-preset-list");
	c.setAttribute("role", "list");
	let l = (n) => {
		let r = g(n);
		r && (e.onSelect(r), b(t), e.trigger?.focus?.());
	};
	for (let e of h) {
		let n = y(t, "div", "", "response-regeneration-preset");
		n.setAttribute("role", "listitem");
		let r = y(t, "button", e.label, "message-action");
		r.type = "button", r.setAttribute("aria-label", e.label + " yönergesiyle yeniden üret"), r.addEventListener("click", () => l(e.instruction)), n.append(r), c.append(n);
	}
	let u = y(t, "label", "Özel yönerge", "response-regeneration-custom-label"), d = y(t, "textarea");
	d.rows = 3, d.maxLength = 600, d.placeholder = "Örn. Daha teknik yaz, kısa bir özet ekle, belirsizlikleri açıkça belirt…", d.setAttribute("aria-label", "Özel yeniden üretme yönergesi");
	let f = y(t, "button", "Özel yönergeyle yeniden üret", "message-action");
	f.type = "button", f.addEventListener("click", () => l(d.value));
	let p = y(t, "div", "", "response-regeneration-options-footer"), m = y(t, "button", "Vazgeç", "message-action");
	m.type = "button", m.addEventListener("click", () => {
		b(t), e.trigger?.focus?.();
	}), p.append(m), r.append(i, s, c, u, d, f, p), n.append(r), (t.body ?? t.documentElement).append(n), o.addEventListener("click", () => {
		b(t), e.trigger?.focus?.();
	}), n.addEventListener("click", (r) => {
		r.target === n && (b(t), e.trigger?.focus?.());
	}), n.addEventListener("keydown", (r) => {
		if (r.key === "Escape") {
			r.preventDefault(), b(t), e.trigger?.focus?.();
			return;
		}
		if (r.key !== "Tab") return;
		let i = [...n.querySelectorAll("button:not([disabled]), textarea")];
		if (!i.length) return;
		let a = i.indexOf(t.activeElement);
		r.shiftKey && a <= 0 ? (r.preventDefault(), i.at(-1)?.focus()) : !r.shiftKey && a === i.length - 1 && (r.preventDefault(), i[0]?.focus());
	}), d.addEventListener("input", () => {
		f.disabled = g(d.value).length === 0;
	}), f.disabled = !0, o.focus();
}
//#endregion
//#region public/typed/model-preferences.ts
var x = "hafize.model-preferences.v1", S = Object.freeze({
	maxProfiles: 6,
	maxName: 48,
	maxModel: 180,
	maxAgentId: 140,
	maxImport: 2e5,
	maxExport: 2e5
}), C = () => (/* @__PURE__ */ new Date()).toISOString(), w = (e, t) => typeof e == "string" ? e.trim().slice(0, t) : "", T = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
function E(e) {
	if (!e || typeof e != "object" || Array.isArray(e)) return null;
	let t = e, n = w(t.model, S.maxModel), r = w(t.agentId, S.maxAgentId);
	if (!n || !r) return null;
	let i = w(t.createdAt, 40) || C(), a = w(t.updatedAt, 40) || i, o = Number(t.useCount), s = Number.isFinite(o) && o >= 0 ? Math.min(9999, Math.floor(o)) : 0;
	return Object.freeze({
		id: w(t.id, 120) || T(),
		name: w(t.name, S.maxName) || "Yeni profil",
		model: n,
		agentId: r,
		toolsEnabled: t.toolsEnabled === !0,
		useCount: s,
		createdAt: i,
		updatedAt: a
	});
}
function D(e) {
	let t = e && typeof e == "object" && !Array.isArray(e) ? e : {}, n = Array.isArray(t.profiles) ? t.profiles : [], r = /* @__PURE__ */ new Set(), i = [];
	for (let e of n) {
		let t = E(e);
		if (t && !r.has(t.id) && (r.add(t.id), i.push(t), i.length >= S.maxProfiles)) break;
	}
	return Object.freeze({
		version: 1,
		selectedModel: w(t.selectedModel, S.maxModel),
		selectedAgentId: w(t.selectedAgentId, S.maxAgentId),
		profiles: i,
		updatedAt: w(t.updatedAt, 40) || C()
	});
}
function O(e = globalThis.localStorage) {
	try {
		let t = e?.getItem(x);
		return D(t ? JSON.parse(t) : null);
	} catch {
		return D(null);
	}
}
function k(e, t = globalThis.localStorage) {
	try {
		let n = D(e);
		return t?.setItem(x, JSON.stringify(n)), !0;
	} catch {
		return !1;
	}
}
function A(e, t) {
	return D({
		...e,
		selectedModel: w(t.model, S.maxModel),
		selectedAgentId: w(t.agentId, S.maxAgentId),
		updatedAt: C()
	});
}
function j(e, t, n, r = !1) {
	return E({
		id: T(),
		name: e,
		model: t,
		agentId: n,
		toolsEnabled: r,
		useCount: 0,
		createdAt: C(),
		updatedAt: C()
	});
}
function M(e, t) {
	let n = E(t);
	if (!n) return D(e);
	let r = e.profiles.findIndex((e) => e.id === n.id), i = e.profiles.slice();
	return r >= 0 ? i.splice(r, 1, n) : i.unshift(n), D({
		...e,
		profiles: i,
		updatedAt: C()
	});
}
function N(e, t) {
	let n = e.profiles.filter((e) => e.id !== t);
	return D({
		...e,
		profiles: n,
		updatedAt: C()
	});
}
function te(e, t) {
	let n = e.profiles.find((e) => e.id === t);
	return n ? M(e, {
		...n,
		useCount: Math.min(9999, n.useCount + 1),
		updatedAt: C()
	}) : D(e);
}
function ne(e, t) {
	return e.profiles.slice().sort((e, n) => {
		let r = +(e.model === t.model && e.agentId === t.agentId), i = +(n.model === t.model && n.agentId === t.agentId);
		return r === i ? e.useCount === n.useCount ? n.updatedAt.localeCompare(e.updatedAt) : n.useCount - e.useCount : i - r;
	});
}
function P(e) {
	let t = {
		version: 1,
		source: "hafize-model-preferences",
		exportedAt: C(),
		selectedModel: e.selectedModel,
		selectedAgentId: e.selectedAgentId,
		profiles: D(e).profiles
	}, n = JSON.stringify(t, null, 2);
	return n.length <= S.maxExport ? n : JSON.stringify({
		...t,
		profiles: t.profiles.slice(0, 3)
	}, null, 2);
}
function F(e, t) {
	let n = t && typeof t == "object" && !Array.isArray(t) ? t : {}, r = Array.isArray(t) ? t : Array.isArray(n.profiles) ? n.profiles : [], i = D(e), a = new Set(i.profiles.map((e) => e.id)), o = 0, s = 0, c = 0;
	for (let e of r) {
		let t = E(e);
		t ? (o += 1, a.has(t.id) && (c += 1)) : s += 1;
	}
	let l = Math.max(0, S.maxProfiles - i.profiles.length);
	return {
		candidateCount: r.length,
		validCount: o,
		rejectedCount: s,
		collisionCount: c,
		capacityRemaining: l,
		willImport: Math.min(o, l)
	};
}
function I(e, t) {
	let n = t && typeof t == "object" && !Array.isArray(t) ? t : {}, r = Array.isArray(t) ? t : Array.isArray(n.profiles) ? n.profiles : [], i = D(e), a = 0, o = 0, s = new Set(i.profiles.map((e) => e.id));
	for (let e of r) {
		let t = E(e);
		if (!t) {
			o += 1;
			continue;
		}
		let n = t;
		for (; s.has(n.id);) n = Object.freeze({
			...n,
			id: T()
		});
		s.add(n.id);
		let r = i.profiles.concat(n);
		if (i = D({
			...i,
			profiles: r,
			updatedAt: C()
		}), a += 1, i.profiles.length >= S.maxProfiles) break;
	}
	return {
		state: i,
		imported: a,
		rejected: o
	};
}
function L(e, t, n) {
	let r = e.profiles.find((e) => e.id === t);
	if (!r) return D(e);
	let i = w(n, S.maxName);
	return i ? M(e, {
		...r,
		name: i,
		updatedAt: C()
	}) : D(e);
}
function re(e, t, n = "") {
	let r = e.profiles.find((e) => e.id === t);
	if (!r || e.profiles.length >= S.maxProfiles) return D(e);
	let i = j(n || (r.name + " kopyası").slice(0, S.maxName), r.model, r.agentId, r.toolsEnabled);
	return i ? M(e, i) : D(e);
}
//#endregion
//#region public/typed/model-preferences-ui.ts
var R = "modelPreferencesPanel", ie = "modelPreferencesButton", z = "hafize.model-preferences.v1";
function B(e, t = "mini-btn") {
	let n = document.createElement("button");
	return n.type = "button", n.className = t, n.textContent = e, n;
}
function V(e) {
	let t = document.createElement("span");
	return t.textContent = e, t;
}
function ae() {
	let e = document.createElement("section");
	e.id = R, e.className = "model-preferences-panel", e.hidden = !0, e.setAttribute("role", "dialog"), e.setAttribute("aria-modal", "false"), e.setAttribute("aria-labelledby", "modelPreferencesTitle");
	let t = document.createElement("div");
	t.className = "model-preferences-head";
	let n = document.createElement("strong");
	n.id = "modelPreferencesTitle", n.textContent = "Model ve ajan tercihleri";
	let r = B("Kapat");
	r.setAttribute("aria-label", "Model ve ajan tercihlerini kapat"), t.append(n, r);
	let i = document.createElement("div");
	i.className = "model-preferences-body";
	let a = document.createElement("div");
	a.className = "model-preferences-actions";
	let o = B("Mevcut seçimi profil olarak kaydet", "soft-btn"), s = B("Dışa aktar", "soft-btn"), c = B("İçe aktar", "soft-btn"), l = B("Tercihleri sıfırla", "soft-btn");
	a.append(o, s, c, l);
	let u = document.createElement("input");
	return u.type = "file", u.accept = "application/json,.json", u.hidden = !0, e.append(t, i, a, u), {
		panel: e,
		body: i,
		close: r,
		add: o,
		exportButton: s,
		importButton: c,
		clear: l,
		file: u
	};
}
function oe(e, t, n, r, i, a, o, s) {
	e.replaceChildren();
	let c = document.createElement("p");
	c.className = "model-preferences-summary", c.textContent = t.profiles.length ? `${t.profiles.length}/${S.maxProfiles} profil kayıtlı.` : "Henüz kaydedilmiş profil yok.", e.append(c);
	let l = document.createElement("div");
	l.className = "model-preferences-current", l.append(V(`Model: ${n.model || "seçilmedi"}`), V(`Ajan: ${r.agents.find((e) => e.id === n.agentId)?.label || n.agentId || "seçilmedi"}`), V(n.toolsEnabled ? "Araçlar açık" : "Araçlar kapalı")), e.append(l);
	let u = document.createElement("div");
	u.className = "model-preferences-list", u.setAttribute("role", "list");
	let d = ne(t, n);
	if (!d.length) {
		let e = document.createElement("div");
		e.className = "model-preferences-empty", e.textContent = "Model ve ajan seçimini profil olarak kaydettiğinde burada hızlı geçiş yapabilirsin.", u.append(e);
	}
	for (let e of d) {
		let t = document.createElement("article");
		t.className = "model-preference-row", t.dataset.profileId = e.id, t.setAttribute("role", "listitem");
		let c = document.createElement("div");
		c.className = "model-preference-main";
		let l = document.createElement("strong");
		l.textContent = e.name;
		let d = document.createElement("small"), f = r.agents.find((t) => t.id === e.agentId)?.label || e.agentId;
		d.textContent = `${e.model} · ${f} · ${e.toolsEnabled ? "araçlar açık" : "araçlar kapalı"} · ${e.useCount} kullanım`, c.append(l, d);
		let p = document.createElement("div");
		p.className = "model-preference-row-actions";
		let m = B("Uygula", "soft-btn");
		m.disabled = n.model === e.model && n.agentId === e.agentId && n.toolsEnabled === e.toolsEnabled, m.addEventListener("click", () => i(e));
		let h = B("Adlandır", "mini-btn");
		h.setAttribute("aria-label", `${e.name} profilini yeniden adlandır`), h.addEventListener("click", () => a(e));
		let g = B("Çoğalt", "mini-btn");
		g.setAttribute("aria-label", `${e.name} profilini çoğalt`), g.addEventListener("click", () => o(e));
		let _ = B("Sil", "mini-btn");
		_.setAttribute("aria-label", `${e.name} profilini sil`), _.addEventListener("click", () => s(e)), p.append(m, h, g, _), t.append(c, p), u.append(t);
	}
	e.append(u);
}
function se(e) {
	if (!e.modelSelect || !e.agentSelect || !e.toolModeButton || document.getElementById(R)) return null;
	let t = e.modelSelect.closest(".model-wrap")?.parentElement || e.modelSelect.parentElement;
	if (!t) return null;
	let n = B("Tercihler", "mini-btn");
	n.id = ie, n.setAttribute("aria-expanded", "false"), n.setAttribute("aria-controls", R), n.title = "Model ve ajan tercihleri", t.append(n);
	let r = ae();
	t.parentElement?.append(r.panel);
	let i = O(), a = null, o = (e) => {
		let t = document.getElementById("toast");
		t && (t.textContent = e.slice(0, 180), t.classList.remove("hidden"), window.setTimeout(() => t.classList.add("hidden"), 3e3));
	}, s = () => e.getCurrent(), c = () => e.getChoices(), l = () => {
		i = A(i, s()), k(i);
	}, u = () => oe(r.body, i, s(), c(), (t) => {
		e.apply({
			model: t.model,
			agentId: t.agentId,
			toolsEnabled: t.toolsEnabled
		}), i = te(i, t.id), i = A(i, s()), k(i), u(), o(`“${t.name}” uygulandı.`);
	}, (e) => {
		let t = globalThis.prompt("Yeni profil adı:", e.name);
		t !== null && t.trim() && (i = L(i, e.id, t), k(i), u(), o("Profil yeniden adlandırıldı."));
	}, (e) => {
		if (i.profiles.length >= S.maxProfiles) return o("En fazla 6 profil kaydedebilirsin.");
		i = re(i, e.id), k(i), u(), o("Profil çoğaltıldı.");
	}, (e) => {
		globalThis.confirm(`“${e.name}” profili silinsin mi?`) && (i = N(i, e.id), k(i), u(), o("Profil silindi."));
	}), d = () => {
		r.panel.hidden = !0, n.setAttribute("aria-expanded", "false"), a?.focus(), a = null;
	}, f = () => {
		a = document.activeElement instanceof HTMLElement ? document.activeElement : n, i = O(), u(), r.panel.hidden = !1, n.setAttribute("aria-expanded", "true"), r.close.focus();
	};
	n.addEventListener("click", f), r.close.addEventListener("click", d), r.add.addEventListener("click", () => {
		let e = s(), t = e.model ? `${e.model.split("/").at(-1) || e.model.slice(0, 24)} profili` : "Yeni profil", n = globalThis.prompt("Profil adı:", t);
		if (n === null) return;
		if (i.profiles.length >= S.maxProfiles) return o("En fazla 6 profil kaydedebilirsin.");
		let r = j(n, e.model, e.agentId, e.toolsEnabled);
		if (!r) return o("Model ve ajan seçimi olmadan profil kaydedilemez.");
		i = M(i, r), i = A(i, e), k(i), u(), o("Profil kaydedildi.");
	}), r.clear.addEventListener("click", () => {
		globalThis.confirm("Tüm model/ajan profilleri ve son seçim temizlensin mi?") && (i = {
			version: 1,
			selectedModel: "",
			selectedAgentId: "",
			profiles: [],
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		}, k(i), u(), o("Model ve ajan tercihleri sıfırlandı."));
	}), r.exportButton.addEventListener("click", () => {
		let e = P(i), t = new Blob([e], { type: "application/json;charset=utf-8" }), n = URL.createObjectURL(t), r = document.createElement("a");
		r.href = n, r.download = "hafize-model-tercihleri.json", r.click(), window.setTimeout(() => URL.revokeObjectURL(n), 0), o("Tercihler dışa aktarıldı.");
	}), r.importButton.addEventListener("click", () => r.file.click()), r.file.addEventListener("change", async () => {
		let e = r.file.files?.[0];
		if (r.file.value = "", e) {
			if (e.size > S.maxImport) return o("Tercih yedeği 200 KB sınırını aşamaz.");
			try {
				let t = await e.text(), n = JSON.parse(t), r = F(i, n);
				if (!r.willImport) return o(r.candidateCount ? "Import için kullanılabilir kapasite veya geçerli profil yok." : "Import dosyasında profil bulunamadı.");
				if (!globalThis.confirm(r.willImport + " profil alınacak; " + r.rejectedCount + " kayıt reddedilecek; " + r.collisionCount + " ID çakışması yeni ID ile korunacak. " + r.capacityRemaining + " kapasite mevcut. Devam edilsin mi?")) return o("Import iptal edildi.");
				let a = I(i, n);
				i = a.state, k(i), u(), o(a.imported + " profil içe aktarıldı; " + a.rejected + " kayıt reddedildi.");
			} catch {
				o("Geçersiz model tercihleri yedeği.");
			}
		}
	});
	let p = () => Array.from(r.panel.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])")), m = (e) => {
		if (e.key === "Escape" && !r.panel.hidden) e.preventDefault(), d();
		else if (e.key === "Tab" && !r.panel.hidden) {
			let t = p();
			if (!t.length) return;
			let n = t[0], r = t[t.length - 1];
			e.shiftKey && document.activeElement === n ? (e.preventDefault(), r.focus()) : !e.shiftKey && document.activeElement === r && (e.preventDefault(), n.focus());
		} else (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "m" && (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement || document.activeElement instanceof HTMLSelectElement || (e.preventDefault(), r.panel.hidden ? f() : d()));
	}, h = () => {
		l(), r.panel.hidden || u();
	};
	e.modelSelect.addEventListener("change", h), e.agentSelect.addEventListener("change", h), e.toolModeButton.addEventListener("click", h);
	let g = (e) => {
		e.key === z && (i = O(), r.panel.hidden || u());
	};
	return document.addEventListener("keydown", m), globalThis.addEventListener("storage", g), Object.freeze({
		refresh: () => {
			i = O(), r.panel.hidden || u();
		},
		destroy: () => {
			n.remove(), r.panel.remove(), e.modelSelect.removeEventListener("change", h), e.agentSelect.removeEventListener("change", h), e.toolModeButton.removeEventListener("click", h), document.removeEventListener("keydown", m), globalThis.removeEventListener("storage", g);
		}
	});
}
var H = () => {
	document.querySelector("#modelSelect"), document.querySelector("#agentSelect"), document.querySelector("#toolModeBtn");
};
typeof document < "u" && (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", H, { once: !0 }) : H());
//#endregion
//#region public/typed/hafize-sse.ts
var U = 6e4, W = 3e5, G = 131072, K = 262144, q = 2e4, J = class extends Error {
	code;
	status;
	traceId;
	retryable;
	constructor(e, t = {}) {
		super(e), this.name = "HafizeSseError", this.code = (t.code || "SSE_ERROR").slice(0, 100), this.status = Number.isInteger(t.status) ? t.status : 0, this.traceId = t.traceId ?? null, this.retryable = t.retryable === !0, "cause" in t && Object.defineProperty(this, "cause", {
			value: t.cause,
			enumerable: !1
		});
	}
};
function Y(e) {
	let t = e.headers.get("X-Hafize-Trace-Id");
	return t ? t.slice(0, 120) : null;
}
async function ce(e) {
	try {
		return await e.clone().json();
	} catch {
		return null;
	}
}
function X(e, t) {
	let n = t && typeof t == "object" && !Array.isArray(t) ? t : {}, r = typeof n.error == "string" ? n.error : "SSE_HTTP_ERROR", i = typeof n.message == "string" ? n.message : e.statusText || "Akış başlatılamadı.", a = e.status === 408 || e.status === 425 || e.status === 429 || e.status >= 500;
	return new J(i.slice(0, 240), {
		code: r,
		status: e.status,
		traceId: Y(e),
		retryable: a
	});
}
function Z(e, t, n) {
	return Number.isFinite(e) ? Math.min(n, Math.max(1, Math.floor(e))) : t;
}
function le(e) {
	return !e || !/^\d+$/.test(e) ? null : Math.min(36e5, Number(e));
}
function Q(e, t = G) {
	if (e.length > t) throw new J("SSE veri çerçevesi izin verilen boyutu aştı.", { code: "SSE_FRAME_TOO_LARGE" });
	let n = "message", r = null, i = null, a = [];
	for (let t of e.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")) {
		if (!t || t.startsWith(":")) continue;
		let e = t.indexOf(":"), o = e >= 0 ? t.slice(0, e) : t, s = e >= 0 ? t.slice(e + 1).replace(/^ /, "") : "";
		o === "event" ? n = s.slice(0, 100) || "message" : o === "id" ? r = s.slice(0, 120) || null : o === "retry" ? i = le(s) : o === "data" && a.push(s);
	}
	let o = a.join("\n");
	if (!o && r === null && i === null) return null;
	if (o === "[DONE]") return Object.freeze({
		type: n,
		data: o,
		payload: null,
		id: r,
		retry: i
	});
	let s = o || null;
	if (o) try {
		s = JSON.parse(o);
	} catch {
		s = o;
	}
	return Object.freeze({
		type: n,
		data: o,
		payload: s,
		id: r,
		retry: i
	});
}
async function ue(e, t = {}) {
	let n = /* @__PURE__ */ new Date(), r = Z(t.maxFrameChars, G, 1e6), i = Z(t.maxBufferChars, K, 2e6), a = Z(t.maxEvents, q, 1e5), o = Y(e);
	if (!e.ok) throw X(e, await ce(e));
	if (!e.body) throw new J("SSE yanıt gövdesi bulunamadı.", {
		code: "SSE_BODY_MISSING",
		status: e.status,
		traceId: o
	});
	let s = e.body.getReader(), c = () => {
		s.cancel(t.signal?.reason);
	};
	t.signal?.addEventListener("abort", c, { once: !0 }), t.signal?.aborted && c();
	let l = new TextDecoder("utf-8", { fatal: !1 }), u = "", d = 0, f = 0, p = !1, m = async (n) => {
		if (!n.trim()) return;
		let i = Q(n, r);
		if (i) {
			if (f += 1, f > a) throw new J("SSE akışındaki olay sayısı sınırı aşıldı.", {
				code: "SSE_EVENT_LIMIT",
				status: e.status,
				traceId: o
			});
			i.data === "[DONE]" ? p = !0 : await t.onEvent?.(i);
		}
	};
	try {
		for (; !p;) {
			if (t.signal?.aborted) throw new J("SSE akışı iptal edildi.", {
				code: "SSE_ABORTED",
				status: e.status,
				traceId: o,
				retryable: !1
			});
			let n = await s.read();
			if (t.signal?.aborted) {
				let n = t.signal.reason;
				throw n instanceof DOMException && n.name === "TimeoutError" ? new J("SSE akışı zaman aşımına uğradı.", {
					code: "SSE_TIMEOUT",
					status: e.status,
					traceId: o,
					retryable: !0,
					cause: n
				}) : new J("SSE akışı iptal edildi.", {
					code: "SSE_ABORTED",
					status: e.status,
					traceId: o,
					retryable: !1,
					cause: n
				});
			}
			if (d += n.value?.byteLength || 0, u += l.decode(n.value || /* @__PURE__ */ new Uint8Array(), { stream: !n.done }).replace(/\r\n/g, "\n").replace(/\r/g, "\n"), u.length > i) throw new J("SSE tamponu izin verilen boyutu aştı.", {
				code: "SSE_BUFFER_TOO_LARGE",
				status: e.status,
				traceId: o
			});
			let r = u.split("\n\n");
			u = r.pop() || "";
			for (let e of r) await m(e);
			if (n.done) {
				let e = u;
				u = "", e && await m(e);
				break;
			}
		}
	} catch (t) {
		try {
			await s.cancel(t);
		} catch {}
		throw t instanceof J ? t : t instanceof DOMException && t.name === "TimeoutError" ? new J("SSE akışı zaman aşımına uğradı.", {
			code: "SSE_TIMEOUT",
			status: e.status,
			traceId: o,
			retryable: !0,
			cause: t
		}) : t instanceof DOMException && t.name === "AbortError" ? new J("SSE akışı iptal edildi.", {
			code: "SSE_ABORTED",
			status: e.status,
			traceId: o,
			retryable: !1,
			cause: t
		}) : new J(t instanceof Error ? t.message : "SSE akışı okunamadı.", {
			code: "SSE_READ_ERROR",
			status: e.status,
			traceId: o,
			retryable: !0,
			cause: t
		});
	} finally {
		t.signal?.removeEventListener("abort", c), s.releaseLock();
	}
	let h = /* @__PURE__ */ new Date();
	return Object.freeze({
		status: e.status,
		traceId: o,
		startedAt: n.toISOString(),
		finishedAt: h.toISOString(),
		durationMs: Math.max(0, h.getTime() - n.getTime()),
		bytesRead: d,
		events: f,
		done: p
	});
}
var de = class {
	baseUrl;
	fetchImpl;
	constructor(e = "", t = globalThis.fetch.bind(globalThis)) {
		this.baseUrl = e.replace(/\/+$/, ""), this.fetchImpl = t;
	}
	url(e) {
		return `${this.baseUrl}${e.startsWith("/") ? e : `/${e}`}`;
	}
	async open(e, t, n = {}) {
		let r = Math.min(W, Math.max(1e3, Math.floor(n.timeoutMs ?? U))), i = new AbortController(), a = globalThis.setTimeout(() => i.abort(new DOMException("Request timeout", "TimeoutError")), r), o = n.signal, s = () => i.abort(o?.reason ?? new DOMException("Aborted", "AbortError"));
		try {
			o?.aborted ? s() : o?.addEventListener("abort", s, { once: !0 });
			let r = new Headers(n.headers);
			r.set("Accept", "text/event-stream"), r.set("Content-Type", r.get("Content-Type") || "application/json");
			let a = await Promise.race([this.fetchImpl(this.url(e), {
				method: "POST",
				headers: r,
				body: JSON.stringify(t),
				signal: i.signal
			}), new Promise((e, t) => {
				let n = () => t(i.signal.reason ?? new DOMException("Aborted", "AbortError"));
				i.signal.aborted ? n() : i.signal.addEventListener("abort", n, { once: !0 }), i.signal.addEventListener("abort", () => i.signal.removeEventListener("abort", n), { once: !0 });
			})]);
			if (!a.ok) throw X(a, await ce(a));
			return a;
		} catch (e) {
			if (e instanceof J) throw e;
			let t = e instanceof DOMException && e.name === "TimeoutError" ? "SSE_TIMEOUT" : "SSE_NETWORK_ERROR";
			throw new J(e instanceof Error ? e.message : "SSE isteği başarısız.", {
				code: t,
				retryable: !0,
				cause: e
			});
		} finally {
			globalThis.clearTimeout(a), o?.removeEventListener("abort", s);
		}
	}
	async stream(e, t, n = {}) {
		let r = Math.min(W, Math.max(1e3, Math.floor(n.timeoutMs ?? U))), i = new AbortController(), a = globalThis.setTimeout(() => i.abort(new DOMException("Request timeout", "TimeoutError")), r), o = n.signal, s = () => i.abort(o?.reason ?? new DOMException("Aborted", "AbortError"));
		try {
			return o?.aborted ? s() : o?.addEventListener("abort", s, { once: !0 }), await ue(await this.open(e, t, {
				...n,
				signal: i.signal
			}), {
				...n,
				signal: i.signal
			});
		} catch (e) {
			throw e instanceof J ? e : new J(e instanceof Error ? e.message : "SSE akışı başarısız.", {
				code: e instanceof DOMException && e.name === "TimeoutError" ? "SSE_TIMEOUT" : "SSE_STREAM_ERROR",
				retryable: !0,
				cause: e
			});
		} finally {
			globalThis.clearTimeout(a), o?.removeEventListener("abort", s);
		}
	}
};
//#endregion
//#region public/typed/hafize-stream-state.ts
function fe(e) {
	return e instanceof Error ? e.message.slice(0, 240) : typeof e == "string" ? e.slice(0, 240) : e == null ? null : "Akış beklenmedik biçimde sonlandı.";
}
function pe(e) {
	return e && typeof e == "object" && "code" in e && typeof e.code == "string" ? String(e.code).slice(0, 100) : e instanceof DOMException ? e.name.slice(0, 100) : e ? "STREAM_ERROR" : null;
}
var $ = () => Object.freeze({
	phase: "idle",
	sequence: 0,
	startedAt: null,
	endedAt: null,
	durationMs: null,
	bytesRead: 0,
	events: 0,
	traceId: null,
	errorCode: null,
	errorMessage: null
});
function me() {
	let e = $(), t = !1, n = /* @__PURE__ */ new Set();
	function r(r) {
		if (!t) {
			e = Object.freeze(r);
			for (let t of n) try {
				t(e);
			} catch {}
		}
	}
	function i(t = null) {
		let n = e.sequence + 1;
		return r({
			phase: "connecting",
			sequence: n,
			startedAt: Date.now(),
			endedAt: null,
			durationMs: null,
			bytesRead: 0,
			events: 0,
			traceId: t?.slice(0, 120) || null,
			errorCode: null,
			errorMessage: null
		}), n;
	}
	function a(t, n = 1) {
		(e.phase === "connecting" || e.phase === "streaming") && r({
			...e,
			phase: "streaming",
			bytesRead: e.bytesRead + Math.max(0, Math.floor(Number.isFinite(t) ? t : 0)),
			events: e.events + Math.max(0, Math.floor(Number.isFinite(n) ? n : 0))
		});
	}
	function o(t, n, i = null) {
		if (e.phase === "idle" || e.phase === "completed" || e.phase === "aborted" || e.phase === "failed") return;
		let a = Date.now(), o = i ? pe(i) : typeof n.errorCode == "string" ? n.errorCode.slice(0, 100) : null, s = i ? fe(i) : typeof n.errorMessage == "string" ? n.errorMessage.slice(0, 240) : null;
		r({
			...e,
			...n,
			phase: t,
			endedAt: a,
			durationMs: e.startedAt === null ? null : Math.max(0, a - e.startedAt),
			bytesRead: Math.max(e.bytesRead, Number.isFinite(n.bytesRead) ? Math.floor(n.bytesRead) : e.bytesRead),
			events: Math.max(e.events, Number.isFinite(n.events) ? Math.floor(n.events) : e.events),
			traceId: typeof n.traceId == "string" ? n.traceId.slice(0, 120) : e.traceId,
			errorCode: o,
			errorMessage: s
		});
	}
	return Object.freeze({
		snapshot: () => e,
		begin: i,
		chunk: a,
		complete: (e = {}) => o("completed", e),
		fail: (e, t = {}) => o("failed", t, e),
		abort: (e) => o("aborted", {}, e ?? new DOMException("Aborted", "AbortError")),
		reset: () => r({
			...$(),
			sequence: e.sequence
		}),
		subscribe: (r) => {
			if (t) return () => void 0;
			n.add(r);
			try {
				r(e);
			} catch {}
			return () => n.delete(r);
		},
		destroy: () => {
			t = !0, n.clear();
		}
	});
}
function he(e) {
	switch (e) {
		case "connecting": return "Bağlanıyor";
		case "streaming": return "Yanıt geliyor";
		case "completed": return "Tamamlandı";
		case "aborted": return "İptal edildi";
		case "failed": return "Hata";
		default: return "";
	}
}
function ge(e) {
	switch (e) {
		case "connecting":
		case "streaming": return "active";
		case "completed": return "success";
		case "aborted": return "warning";
		case "failed": return "error";
		default: return "neutral";
	}
}
function _e(e) {
	if (!Number.isFinite(e) || e === null) return "—";
	let t = Math.max(0, Math.floor(e));
	return t < 1e3 ? `${t} ms` : `${(t / 1e3).toFixed(+(t < 1e4))} sn`;
}
function ve(e) {
	let t = Math.max(0, Math.floor(Number.isFinite(e) ? e : 0));
	if (t < 1024) return `${t} B`;
	if (t < 1048576) {
		let e = t / 1024;
		return `${e === 1 ? "1" : e < 10 ? e.toFixed(1) : Math.round(e)} KB`;
	}
	return `${(t / 1048576).toFixed(1)} MB`;
}
//#endregion
//#region public/typed/app-shell.ts
(() => {
	let t = "hafize.conversations.v1", s = globalThis.navigator?.onLine !== !1, c = new de(), l = me(), u = null, d, f = {
		sidebar: document.querySelector("#sidebar"),
		sidebarToggle: document.querySelector("#sidebarToggle"),
		newChatBtn: document.querySelector("#newChatBtn"),
		clearHistoryBtn: document.querySelector("#clearHistoryBtn"),
		conversationList: document.querySelector("#conversationList"),
		composer: document.querySelector("#composer"),
		messageInput: document.querySelector("#messageInput"),
		messages: document.querySelector("#messages"),
		welcome: document.querySelector("#welcome"),
		installBtn: document.querySelector("#installBtn"),
		toast: document.querySelector("#toast"),
		modelSelect: document.querySelector("#modelSelect"),
		agentSelect: document.querySelector("#agentSelect"),
		toolModeBtn: document.querySelector("#toolModeBtn")
	}, p = null, h = !1, g = k(), v = g[0]?.id ?? null, y = !1, b = [], x = "", S = null, C = null;
	function w() {
		return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	}
	function T(e, t, { role: n = "assistant", streaming: r = !1 } = {}) {
		if (!e) return;
		let i = typeof t == "string" ? t : "", a = window.HafizeChatMarkdown;
		a?.paint ? a.paint(e, i, {
			placeholder: "…",
			plain: n !== "assistant",
			streaming: r
		}) : e.textContent = i || "…";
	}
	function E(e) {
		if (!e || typeof e != "object" || Array.isArray(e)) return null;
		let t = e;
		if (t.role !== "user" && t.role !== "assistant" || typeof t.content != "string") return null;
		let r = t.content.slice(0, 12e3);
		if (!r) return null;
		let i = n(t.alternates), a = t.feedback === "positive" || t.feedback === "negative" ? t.feedback : void 0, o = t.generation && typeof t.generation == "object" ? {
			model: typeof t.generation.model == "string" ? t.generation.model.slice(0, 160) : "",
			agentId: typeof t.generation.agentId == "string" ? t.generation.agentId.slice(0, 120) : "",
			toolsEnabled: t.generation.toolsEnabled === !0,
			generatedAt: typeof t.generation.generatedAt == "string" ? t.generation.generatedAt.slice(0, 40) : "",
			durationMs: Number.isFinite(t.generation.durationMs) && t.generation.durationMs >= 0 ? Math.min(6e5, Math.floor(t.generation.durationMs)) : null
		} : void 0;
		return {
			id: typeof t.id == "string" && t.id ? t.id.slice(0, 120) : w(),
			role: t.role,
			content: r,
			at: typeof t.at == "string" ? t.at.slice(0, 40) : (/* @__PURE__ */ new Date()).toISOString(),
			...i.length ? { alternates: i } : {},
			...a ? { feedback: a } : {},
			...o ? { generation: o } : {},
			...Array.isArray(t.toolActivities) ? { toolActivities: t.toolActivities.filter((e) => e && typeof e == "object" && typeof e.label == "string").slice(0, 4).map((e) => ({
				label: e.label.slice(0, 80),
				state: e.state === "running" || e.state === "failure" ? e.state : "success"
			})) } : {}
		};
	}
	function D(e) {
		if (!e || typeof e != "object" || Array.isArray(e)) return null;
		let t = e;
		if (typeof t.id != "string" || typeof t.title != "string") return null;
		let n = Array.isArray(t.messages) ? t.messages.map((e) => E(e)).filter(Boolean).slice(-100) : [], r = (/* @__PURE__ */ new Date()).toISOString();
		return {
			id: t.id.slice(0, 120),
			title: t.title.trim().slice(0, 80) || "Yeni sohbet",
			agentId: typeof t.agentId == "string" ? t.agentId.slice(0, 120) : "",
			toolsEnabled: t.toolsEnabled === !0,
			createdAt: typeof t.createdAt == "string" ? t.createdAt.slice(0, 40) : r,
			updatedAt: typeof t.updatedAt == "string" ? t.updatedAt.slice(0, 40) : r,
			messages: n,
			...typeof t.forkOf == "string" && t.forkOf ? { forkOf: t.forkOf.slice(0, 120) } : {},
			...typeof t.forkMessageId == "string" && t.forkMessageId ? { forkMessageId: t.forkMessageId.slice(0, 120) } : {},
			...Number.isFinite(t.forkDepth) && t.forkDepth >= 1 ? { forkDepth: Math.min(4, Math.floor(t.forkDepth)) } : {},
			...typeof t.forkNote == "string" && t.forkNote ? { forkNote: t.forkNote.slice(0, 400) } : {}
		};
	}
	function k() {
		try {
			let e = JSON.parse(localStorage.getItem(t) || "[]");
			return Array.isArray(e) ? e.map((e) => D(e)).filter(Boolean).slice(0, 30) : [];
		} catch {
			return [];
		}
	}
	function A() {
		try {
			return g = g.map((e) => D(e)).filter(Boolean).slice(0, 30), localStorage.setItem(t, JSON.stringify(g)), h = !1, !0;
		} catch {
			return h || (h = !0, K("Yerel sohbet geçmişi bu cihazda kalıcı olarak kaydedilemedi.")), !1;
		}
	}
	function j() {
		return g.find((e) => e.id === v) ?? null;
	}
	function M(e = j()) {
		let t = typeof e?.agentId == "string" ? e.agentId : "";
		return b.some((e) => e.id === t) ? t : x;
	}
	function N() {
		let e = {
			id: w(),
			title: "Yeni sohbet",
			agentId: x,
			toolsEnabled: !1,
			createdAt: (/* @__PURE__ */ new Date()).toISOString(),
			updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
			messages: []
		};
		g.unshift(e), v = e.id, A(), G(), f.messageInput.focus();
	}
	function te(e) {
		if (y) return K("Yanıt sürerken sohbet silinemez.");
		g = g.filter((t) => t.id !== e), v === e && (v = g[0]?.id ?? null), A(), G();
	}
	function ne() {
		if (y) return K("Yanıt sürerken geçmiş temizlenemez.");
		g.length && globalThis.confirm("Tüm yerel sohbet geçmişi silinsin mi?") && (g = [], v = null, S = null, A(), G());
	}
	function P(e, t, { persist: n = !0 } = {}) {
		let r = j();
		r ||= (N(), j());
		let i = {
			id: w(),
			role: e,
			content: t,
			at: (/* @__PURE__ */ new Date()).toISOString()
		};
		return r.messages.push(i), r.messages.length > 100 && (r.messages = r.messages.slice(-100)), r.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), r.title === "Yeni sohbet" && e === "user" && (r.title = t.trim().replace(/\s+/g, " ").slice(0, 48) || "Yeni sohbet"), g.sort((e, t) => t.updatedAt.localeCompare(e.updatedAt)), n && A(), G(), i.id;
	}
	function F(e, t, { persist: n = !1 } = {}) {
		let r = j(), i = r?.messages.find((t) => t.id === e);
		if (!i) return;
		i.content = t, r.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
		let a = f.messages.querySelector(`[data-message-id="${CSS.escape(e)}"] .content`);
		a && T(a, t, {
			role: i.role,
			streaming: !n
		}), n && A();
	}
	function I(e) {
		let t = j();
		if (!t || typeof e != "string") return null;
		let n = t.messages.findIndex((t) => t?.id === e && t?.role === "user");
		return n < 0 ? null : {
			conversation: t,
			index: n,
			message: t.messages[n]
		};
	}
	function L() {
		let e = f.composer.querySelector(".composer-editing");
		if (!S) {
			e?.remove();
			return;
		}
		if (!I(S)) {
			S = null, e?.remove();
			return;
		}
		e || (e = document.createElement("div"), e.className = "composer-editing", e.setAttribute("role", "status"), f.composer.insertBefore(e, f.composer.querySelector(".composer-row"))), e.replaceChildren();
		let t = document.createElement("span");
		t.textContent = "Mesaj düzenleniyor";
		let n = document.createElement("button");
		n.type = "button", n.className = "message-action", n.textContent = "Vazgeç", n.setAttribute("aria-label", "Mesaj düzenlemeyi iptal et"), n.addEventListener("click", R), e.append(t, n);
	}
	function re(e) {
		if (y) return K("Yanıt sürerken mesaj düzenlenemez.");
		let t = I(e);
		if (!t) return K("Düzenlenecek kullanıcı mesajı bulunamadı.");
		S = e, f.messageInput.value = t.message.content || "", f.messageInput.focus(), f.messageInput.select(), q(), L(), K("Mesajını düzenleyip gönder; bu noktadan sonraki yanıtlar yeniden oluşturulacak.");
	}
	function R() {
		S && (S = null, f.messageInput.value = "", f.messageInput.dispatchEvent(new Event("input", { bubbles: !0 })), L(), f.messageInput.focus());
	}
	function ie(e, t) {
		let n = I(e);
		if (!n) return null;
		n.conversation.messages = n.conversation.messages.slice(0, n.index);
		let r = {
			id: w(),
			role: "user",
			content: t,
			at: (/* @__PURE__ */ new Date()).toISOString()
		};
		return n.conversation.messages.push(r), n.conversation.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), n.conversation.title === "Yeni sohbet" && (n.conversation.title = t.trim().replace(/\s+/g, " ").slice(0, 48) || "Yeni sohbet"), g.sort((e, t) => t.updatedAt.localeCompare(e.updatedAt)), A(), S = null, L(), G(), r.id;
	}
	function z(e) {
		if (!e || typeof e != "object" || typeof e.label != "string") return null;
		let t = e.label.trim().slice(0, 80);
		return t ? e.state === "running" ? {
			label: t,
			state: "running"
		} : typeof e.ok == "boolean" ? {
			label: t,
			state: e.ok ? "success" : "failure"
		} : e.state === "success" || e.state === "failure" ? {
			label: t,
			state: e.state
		} : null : null;
	}
	function B(e) {
		return Array.isArray(e?.toolActivities) ? e.toolActivities.map((e) => z(e)).filter(Boolean).slice(0, 4) : [];
	}
	function V(e, t) {
		e.replaceChildren();
		for (let n of t) {
			let t = document.createElement("span");
			t.className = `tool-activity${n.state === "failure" ? " failed" : ""}`, t.textContent = n.label, e.append(t);
		}
		e.hidden = t.length === 0;
	}
	function ae(e, t) {
		let n = z(t);
		if (!n) return;
		let r = j(), i = r?.messages.find((t) => t.id === e);
		if (!i || i.role !== "assistant") return;
		let a = B(i), o;
		if (n.state === "running") {
			if (a.some((e) => e.label === n.label && e.state === n.state) || a.length >= 4) return;
			o = [...a, n];
		} else {
			let e = -1;
			for (let t = a.length - 1; t >= 0; --t) if (a[t].state === "running") {
				e = t;
				break;
			}
			if (e >= 0) o = [...a], o[e] = n;
			else {
				if (a.some((e) => e.label === n.label && e.state === n.state) || a.length >= 4) return;
				o = [...a, n];
			}
		}
		i.toolActivities = o, r.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
		let s = f.messages.querySelector(`[data-message-id="${CSS.escape(e)}"] .tool-activities`);
		s && V(s, i.toolActivities);
	}
	function oe() {
		if (f.conversationList.replaceChildren(), !g.length) {
			let e = document.createElement("div");
			e.className = "history-empty", e.textContent = "Henüz sohbet yok.", f.conversationList.append(e);
		} else for (let e of g) {
			let t = document.createElement("div");
			t.className = `conversation-row${e.id === v ? " active" : ""}`;
			let n = document.createElement("button");
			n.type = "button", n.className = "conversation-open", n.textContent = e.title, n.title = e.title, n.addEventListener("click", () => {
				if (y) return K("Yanıt sürerken sohbet değiştirilemez.");
				S && R(), v = e.id, G(), window.innerWidth <= 900 && f.sidebar.classList.remove("open");
			});
			let r = document.createElement("button");
			r.type = "button", r.className = "conversation-delete", r.textContent = "×", r.setAttribute("aria-label", `${e.title} sohbetini sil`), r.addEventListener("click", () => te(e.id)), t.append(n, r), f.conversationList.append(t);
		}
	}
	function H() {
		f.messages.replaceChildren();
		let e = j();
		f.messages.dataset.conversationId = e?.id ?? "", f.messages.setAttribute("aria-busy", String(y));
		let t = e?.messages ?? [];
		f.welcome.classList.toggle("hidden", t.length > 0);
		for (let e of t) {
			let n = document.createElement("article");
			n.className = `message ${e.role}`, n.dataset.messageId = e.id;
			let r = document.createElement("div");
			r.className = "meta", r.textContent = e.role === "user" ? "Sen" : "Hafize";
			let i = document.createElement("div");
			if (i.className = "content", T(i, e.content, { role: e.role }), n.append(r), e.role === "assistant") {
				let t = document.createElement("div");
				t.className = "tool-activities", t.setAttribute("aria-label", "Araç etkinlikleri"), t.setAttribute("aria-live", "polite"), V(t, B(e)), n.append(t);
			}
			if (n.append(i), e.role === "assistant") {
				let r = document.createElement("div");
				r.className = "assistant-message-actions", r.setAttribute("aria-label", "Yanıt işlemleri");
				let i = document.createElement("button");
				i.type = "button", i.className = "message-action", i.textContent = "Yeniden üret", i.setAttribute("aria-label", "Bu asistan yanıtını yeniden üret"), i.disabled = y || e.id !== t.at(-1)?.id, i.title = e.id === t.at(-1)?.id ? "Bu yanıt için yeni bir varyant üret" : "Yalnızca son yanıt yeniden üretilebilir", i.addEventListener("click", () => ye(e.id)), r.append(i);
				let a = document.createElement("button");
				a.type = "button", a.className = "message-action", a.textContent = "Yönergeyle yeniden üret", a.setAttribute("aria-label", "Özel yönergeyle bu asistan yanıtını yeniden üret"), a.disabled = y || e.id !== t.at(-1)?.id, a.title = a.disabled ? "Yalnızca son yanıt için kullanılabilir" : "Yeni yanıtın yönünü seç", a.addEventListener("click", () => {
					ee({
						trigger: a,
						onSelect: (t) => {
							ye(e.id, t);
						}
					});
				}), r.append(a);
				let o = document.createElement("button");
				o.type = "button", o.className = "message-action" + (e.feedback === "positive" ? " selected" : ""), o.textContent = "👍", o.setAttribute("aria-label", "Yanıtı beğenildi olarak işaretle"), o.setAttribute("aria-pressed", String(e.feedback === "positive")), o.disabled = y, o.addEventListener("click", () => pe(e.id, e.feedback === "positive" ? void 0 : "positive"));
				let s = document.createElement("button");
				s.type = "button", s.className = "message-action" + (e.feedback === "negative" ? " selected" : ""), s.textContent = "👎", s.setAttribute("aria-label", "Yanıtı beğenilmedi olarak işaretle"), s.setAttribute("aria-pressed", String(e.feedback === "negative")), s.disabled = y, s.addEventListener("click", () => pe(e.id, e.feedback === "negative" ? void 0 : "negative")), r.append(o, s);
				let c = document.createElement("button");
				if (c.type = "button", c.className = "message-action", c.textContent = "Kopyala", c.setAttribute("aria-label", "Asistan yanıtını panoya kopyala"), c.disabled = !e.content || y, c.addEventListener("click", async () => {
					try {
						await navigator.clipboard?.writeText?.(e.content || ""), K("Asistan yanıtı panoya kopyalandı.");
					} catch {
						K("Yanıt panoya kopyalanamadı.");
					}
				}), r.append(c), e.alternates?.length) {
					let t = document.createElement("button");
					t.type = "button", t.className = "message-action", t.textContent = "Varyantlar", t.setAttribute("aria-label", "Yanıt varyantlarını görüntüle"), t.disabled = y, t.addEventListener("click", () => {
						m({
							current: e.content,
							alternates: e.alternates,
							trigger: t,
							onSelect: (t, n) => {
								e.content = t, e.alternates = n, A(), G(), K("Seçilen yanıt mevcut cevap yapıldı.");
							}
						});
					}), r.append(t);
					let n = document.createElement("button");
					n.type = "button", n.className = "message-action", n.textContent = "Önceki yanıtı getir (" + e.alternates.length + ")", n.setAttribute("aria-label", "Önceki asistan yanıtını geri getir"), n.disabled = y, n.addEventListener("click", () => be(e.id)), r.append(n);
				}
				let l = e.generation;
				if (l?.model || l?.agentId) {
					let e = document.createElement("span");
					e.className = "assistant-message-generation";
					let t = l.model || "Model bilinmiyor", n = l.agentId || "Ajan bilinmiyor";
					e.textContent = t + " · " + n + (l.toolsEnabled ? " · araçlar" : ""), e.title = l.durationMs === null ? "Üretim bağlamı" : "Üretim süresi: " + l.durationMs + " ms", r.append(e);
				}
				n.append(r);
			}
			f.messages.append(n);
		}
		requestAnimationFrame(() => window.scrollTo({
			top: document.body.scrollHeight,
			behavior: "smooth"
		}));
	}
	function U() {
		let e = M();
		f.agentSelect.disabled = y || b.length === 0, e && f.agentSelect.value !== e && (f.agentSelect.value = e);
		let t = b.find((t) => t.id === e);
		f.agentSelect.title = t?.description || "Hafize ajanı";
	}
	function W() {
		let e = !!j()?.toolsEnabled;
		f.toolModeBtn.disabled = y || !M(), f.toolModeBtn.setAttribute("aria-pressed", String(e)), f.toolModeBtn.textContent = e ? "⌘ Araçlar açık" : "⌘ Araçlar", f.toolModeBtn.title = e ? "Araç çağrıları backend izin politikasıyla etkin" : "Bu sohbet için backend tool-calling modunu aç";
	}
	function G() {
		oe(), H(), U(), W(), L();
	}
	function K(e) {
		f.toast.textContent = e, f.toast.classList.remove("hidden"), window.clearTimeout(K.timeoutId), K.timeoutId = window.setTimeout(() => f.toast.classList.add("hidden"), 3200);
	}
	function q() {
		f.messageInput.style.height = "auto", f.messageInput.style.height = `${Math.min(f.messageInput.scrollHeight, 180)}px`;
	}
	async function J() {
		f.modelSelect.replaceChildren(new Option("NVIDIA modelleri yükleniyor…", ""));
		try {
			let t = (await e.models()).models;
			if (f.modelSelect.replaceChildren(), !t.length) {
				f.modelSelect.append(new Option("NVIDIA modeli bulunamadı", ""));
				return;
			}
			for (let e of t) f.modelSelect.append(new Option(e, e));
			let n = O();
			n.selectedModel && t.includes(n.selectedModel) && (f.modelSelect.value = n.selectedModel), C?.refresh();
		} catch (e) {
			f.modelSelect.replaceChildren(new Option("NVIDIA NIM bağlantısı bekleniyor", "")), e instanceof Error && e.message !== "NVIDIA_NOT_CONFIGURED" && K("NVIDIA model listesi alınamadı.");
		}
	}
	async function Y() {
		f.agentSelect.disabled = !0, f.agentSelect.replaceChildren(new Option("Ajanlar yükleniyor…", ""));
		try {
			let t = await e.agents(), n = t.agents, r = t.defaultAgent;
			if (!n.length || !n.some((e) => e.id === r)) throw Error("INVALID_AGENT_LIST");
			b = n, x = r, f.agentSelect.replaceChildren(...b.map((e) => new Option(e.kind === "specialist" ? `${e.name} · uzman` : e.name, e.id)));
			let i = new Set(b.map((e) => e.id)), a = !1;
			for (let e of g) i.has(e.agentId) || (e.agentId = x, a = !0);
			a && A();
			let o = O();
			if (!j()?.agentId && o.selectedAgentId && i.has(o.selectedAgentId)) {
				let e = j();
				e && (e.agentId = o.selectedAgentId);
			}
			U(), W(), C?.refresh();
		} catch {
			b = [], x = "", f.agentSelect.replaceChildren(new Option("Ajan listesi kullanılamıyor", "")), f.agentSelect.disabled = !0, K("Hafize ajan listesi alınamadı.");
		}
	}
	function ce() {
		return u && document.body.contains(u) || (u = document.createElement("div"), u.className = "stream-status", u.hidden = !0, u.setAttribute("role", "status"), u.setAttribute("aria-live", "polite"), u.setAttribute("aria-atomic", "true"), f.composer.insertBefore(u, f.composer.querySelector(".composer-row"))), u;
	}
	function X(e = l.snapshot()) {
		let t = ce();
		if (!t) return;
		globalThis.clearTimeout(d);
		let n = e.phase !== "idle";
		if (t.hidden = !n, t.dataset.phase = e.phase, t.dataset.tone = ge(e.phase), !n) {
			t.textContent = "";
			return;
		}
		let r = e.phase === "completed" ? ` · ${_e(e.durationMs)} · ${ve(e.bytesRead)}` : e.phase === "failed" ? ` · ${e.errorCode || "akış hatası"}` : e.phase === "aborted" ? " · kullanıcı tarafından durduruldu" : "";
		t.textContent = `${he(e.phase)}${r}`, (e.phase === "completed" || e.phase === "failed" || e.phase === "aborted") && (d = globalThis.setTimeout(() => {
			l.reset(), X();
		}, 5e3));
	}
	l.subscribe(X);
	function Z(e = j()) {
		return (e?.messages ?? []).filter((e) => e.content).map(({ role: e, content: t }) => ({
			role: e,
			content: t
		}));
	}
	function le(e, t, n) {
		if (e.type === "hafize-tool-activity") {
			ae(t, e.payload);
			return;
		}
		if (e.type !== "message" || !e.payload || typeof e.payload != "object") return;
		let r = e.payload;
		if (typeof r.error == "string" && r.error) throw Error(r.error);
		let i = r.choices?.[0]?.delta?.content;
		typeof i == "string" && i && n(i);
	}
	async function Q(e, t, n, r) {
		let i = "";
		l.begin(), X();
		try {
			let a = await c.stream(e, t, {
				timeoutMs: 6e4,
				maxFrameChars: 131072,
				maxBufferChars: 262144,
				maxEvents: 2e4,
				onEvent: (e) => {
					l.chunk(0, 1), le(e, n, (e) => {
						i += e, F(n, i);
					}), X();
				}
			});
			return l.complete({
				traceId: a.traceId,
				bytesRead: a.bytesRead,
				events: a.events,
				durationMs: a.durationMs,
				endedAt: Date.now()
			}), X(), F(n, i || r, { persist: !0 }), a;
		} catch (e) {
			let t = e && typeof e == "object" && "code" in e ? String(e.code || "SSE_ERROR") : "";
			throw t === "SSE_ABORTED" || t === "AbortError" ? l.abort(e) : l.fail(e), X(), e;
		}
	}
	async function ue() {
		let e = f.modelSelect.value;
		if (!e) throw Error("MODEL_REQUIRED");
		let t = j(), n = M(t);
		if (!n) throw Error("AGENT_REQUIRED");
		let r = Z(t), i = performance.now(), a = P("assistant", "", { persist: !1 }), o = await Q("/api/chat", {
			model: e,
			agentId: n,
			messages: r,
			max_tokens: 2048
		}, a, "NVIDIA modeli boş bir yanıt döndürdü."), s = t.messages.find((e) => e.id === a);
		s && (s.generation = {
			model: e,
			agentId: n,
			toolsEnabled: !1,
			generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
			durationMs: Math.max(0, Math.round(o.durationMs || performance.now() - i))
		}, A());
	}
	async function fe() {
		let e = f.modelSelect.value;
		if (!e) throw Error("MODEL_REQUIRED");
		let t = j(), n = M(t);
		if (!n) throw Error("AGENT_REQUIRED");
		let r = Z(t), i = performance.now(), a = P("assistant", "", { persist: !1 }), o = await Q("/api/agent/run", {
			model: e,
			agentId: n,
			messages: r,
			max_tokens: 2048
		}, a, "Ajan araçları çalıştırdı ancak model boş bir yanıt döndürdü."), s = t.messages.find((e) => e.id === a);
		s && (s.generation = {
			model: e,
			agentId: n,
			toolsEnabled: !0,
			generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
			durationMs: Math.max(0, Math.round(o.durationMs || performance.now() - i))
		}, A());
	}
	function pe(e, t) {
		if (y) return;
		let n = j()?.messages.find((t) => t.id === e && t.role === "assistant");
		n && (t === "positive" || t === "negative" ? n.feedback = t : delete n.feedback, A(), G(), K(t === "positive" ? "Yanıt beğenildi." : t === "negative" ? "Yanıt beğenilmedi." : "Yanıt geri bildirim etiketi kaldırıldı."));
	}
	function $(e) {
		f.messages.setAttribute("aria-busy", String(e)), f.messageInput.disabled = e, f.agentSelect.disabled = e, f.toolModeBtn.disabled = e, e || (U(), W());
	}
	async function ye(e, t = "") {
		if (y) return;
		if (!s) return K("İnternet bağlantısı yok; yanıt yeniden üretilemez.");
		let n = j();
		if (!n) return;
		let i = n.messages.findIndex((t) => t.id === e && t.role === "assistant");
		if (i < 0) return K("Yeniden üretilecek asistan yanıtı bulunamadı.");
		if (!a(n.messages, i)) return K("Yalnızca konuşmadaki son asistan yanıtı yeniden üretilebilir.");
		let c = f.modelSelect.value;
		if (!c) return K("Önce NVIDIA NIM bağlantısının hazır olması gerekiyor.");
		let l = M(n);
		if (!l) return K("Önce Hafize ajan listesinin hazır olması gerekiyor.");
		let u = n.messages[i], d = u.content, p = _(n.messages.slice(0, i), t), m = performance.now();
		u.content = "", u.toolActivities = [], y = !0, $(!0), G();
		try {
			await Q(n.toolsEnabled ? "/api/agent/run" : "/api/chat", {
				model: c,
				agentId: l,
				messages: p,
				max_tokens: 2048
			}, u.id, n.toolsEnabled ? "Ajan araçları çalıştırdı ancak model boş bir yanıt döndürdü." : "NVIDIA modeli boş bir yanıt döndürdü."), u.alternates = r(u.alternates, d), u.generation = o(c, l, n.toolsEnabled, performance.now() - m), A(), G(), K("Yeni asistan yanıtı üretildi. Önceki yanıt geri alınabilir.");
		} catch (e) {
			u.content = d, u.toolActivities = [], A(), G(), K("Yanıt yeniden üretilemedi: " + (e?.message || "bilinmeyen hata"));
		} finally {
			y = !1, $(!1), f.messageInput.focus();
		}
	}
	function be(e) {
		if (y) return;
		let t = j()?.messages.find((t) => t.id === e && t.role === "assistant");
		if (!t || !Array.isArray(t.alternates) || !t.alternates.length) return;
		let n = i(t.content, t.alternates);
		n && (t.content = n.current, t.alternates = n.alternates, t.generation = o(t.generation?.model || "", t.generation?.agentId || "", t.generation?.toolsEnabled === !0, t.generation?.durationMs ?? null), A(), G(), K("Önceki asistan yanıtı geri getirildi."));
	}
	async function xe(e) {
		let t = e.trim();
		if (t && !y) {
			if (!s) K("İnternet bağlantısı yok. Bağlantı geri geldiğinde tekrar deneyebilirsin.");
			else if (!f.modelSelect.value) K("Önce NVIDIA NIM bağlantısının hazır olması gerekiyor.");
			else if (!M()) K("Önce Hafize ajan listesinin hazır olması gerekiyor.");
			else {
				if (S) {
					if (!ie(S, t)) return;
				} else P("user", t);
				f.messageInput.value = "", q(), y = !0, $(!0);
				try {
					j()?.toolsEnabled ? await fe() : await ue();
				} catch (e) {
					let t = e?.message === "OFFLINE" ? "İnternet bağlantısı bulunamadı." : e?.message === "MODEL_REQUIRED" ? "Bir NVIDIA modeli seçilmedi." : e?.message === "AGENT_REQUIRED" ? "Bir Hafize ajanı seçilmedi." : `NVIDIA yanıtı alınamadı: ${e?.message || "bilinmeyen hata"}`, n = j()?.messages.at(-1);
					n?.role === "assistant" && !n.content ? F(n.id, t, { persist: !0 }) : P("assistant", t);
				} finally {
					y = !1, $(!1), f.messageInput.focus();
				}
			}
		}
	}
	function Se() {
		s = !0, K("Bağlantı geri geldi."), J(), Y();
	}
	function Ce() {
		s = !1, K("İnternet bağlantısı kesildi.");
	}
	function we() {
		y || A();
	}
	window.addEventListener("online", Se), window.addEventListener("offline", Ce), window.addEventListener("beforeunload", () => {
		we(), l.destroy();
	}), document.addEventListener("visibilitychange", () => {
		document.hidden && we();
	}), window.addEventListener("hafize:edit-message", (e) => re(e.detail?.messageId)), window.addEventListener("hafize:open-conversation", (e) => {
		if (y) return K("Yanıt sürerken sohbet değiştirilemez.");
		let t = typeof e.detail?.conversationId == "string" ? e.detail.conversationId : "";
		t && g.some((e) => e.id === t) && (S && R(), v = t, G(), window.innerWidth <= 900 && f.sidebar.classList.remove("open"), f.messageInput.focus());
	}), f.sidebarToggle.addEventListener("click", () => f.sidebar.classList.toggle("open")), f.newChatBtn.addEventListener("click", () => {
		if (y) return K("Yanıt sürerken yeni sohbet açılamaz.");
		N();
	}), f.clearHistoryBtn.addEventListener("click", ne), f.agentSelect.addEventListener("change", () => {
		if (y) return U();
		let e = f.agentSelect.value;
		if (!b.some((t) => t.id === e)) return U();
		j() || N();
		let t = j();
		t.agentId = e, A(), U(), W();
	}), f.toolModeBtn.addEventListener("click", () => {
		if (y || !M()) return W();
		j() || N();
		let e = j();
		e.toolsEnabled = !e.toolsEnabled, A(), W(), K(e.toolsEnabled ? "Araç modu açık: uygun çağrılar backend izin politikasıyla çalışır." : "Araç modu kapalı: gerçek zamanlı SSE sohbetine dönüldü.");
	}), f.messageInput.addEventListener("input", q), f.messageInput.addEventListener("keydown", (e) => {
		e.key === "Enter" && !e.shiftKey && (e.preventDefault(), f.composer.requestSubmit()), e.key === "Escape" && S && (e.preventDefault(), R());
	}), f.composer.addEventListener("submit", (e) => {
		e.preventDefault(), xe(f.messageInput.value);
	}), document.querySelectorAll("[data-prompt]").forEach((e) => {
		e.addEventListener("click", () => xe(e.dataset.prompt || ""));
	}), document.querySelector("#attachBtn").addEventListener("click", () => K("Dosya ekleme sonraki küçük geliştirme turunda etkinleştirilecek.")), document.querySelector("#micBtn").addEventListener("click", () => K("Sesli giriş sonraki küçük geliştirme turunda etkinleştirilecek.")), window.addEventListener("beforeinstallprompt", (e) => {
		e.preventDefault(), p = e, f.installBtn.hidden = !1;
	}), f.installBtn.addEventListener("click", async () => {
		p && (await p.prompt(), p = null, f.installBtn.hidden = !0);
	}), "serviceWorker" in navigator && window.addEventListener("load", () => {
		navigator.serviceWorker.register("/typed-build/sw.js", { type: "module" }).catch(() => void 0);
	}), v ? G() : N(), C = se({
		modelSelect: f.modelSelect,
		agentSelect: f.agentSelect,
		toolModeButton: f.toolModeBtn,
		getCurrent: () => ({
			model: f.modelSelect.value,
			agentId: M(),
			toolsEnabled: !!j()?.toolsEnabled
		}),
		getChoices: () => ({
			models: [...f.modelSelect.options].filter((e) => e.value).map((e) => ({
				id: e.value,
				label: e.textContent || e.value
			})),
			agents: b.map((e) => ({
				id: e.id,
				label: e.name
			}))
		}),
		apply: (e) => {
			if (y) return K("Yanıt sürerken model veya ajan profili uygulanamaz.");
			e.model && [...f.modelSelect.options].some((t) => t.value === e.model) && (f.modelSelect.value = e.model), j() || N();
			let t = j();
			t && b.some((t) => t.id === e.agentId) && (t.agentId = e.agentId, t.toolsEnabled = e.toolsEnabled === !0, A(), U(), W(), H());
		}
	}), J(), Y();
})();
//#endregion

//# sourceMappingURL=app-shell.js.map