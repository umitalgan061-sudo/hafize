import { t as e } from "./rolldown-runtime-CtkjhSXr.js";
//#endregion
//#region public/typed/legacy/prompt-library-usage.ts
(() => {
	let e = {
		block: document.querySelector(".history-block"),
		history: document.querySelector("#conversationList"),
		toast: document.querySelector("#toast")
	};
	if (!e.block || !e.history) return;
	function t(n) {
		e.toast && n && (e.toast.textContent = n, e.toast.classList.remove("hidden"), window.clearTimeout(t.timeoutId), t.timeoutId = window.setTimeout(() => e.toast.classList.add("hidden"), 3200));
	}
	function n() {
		try {
			let e = JSON.parse(globalThis.localStorage?.getItem("hafize.conversations.v1") || "[]");
			return Array.isArray(e) ? e : [];
		} catch {
			return [];
		}
	}
	function r(e) {
		return typeof e == "string" ? e : "";
	}
	function i(e) {
		let t = [
			"# Hafize sohbet geçmişi",
			"",
			`Dışa aktarma tarihi: ${(/* @__PURE__ */ new Date()).toLocaleString("tr-TR")}`,
			""
		];
		for (let [n, i] of e.entries()) {
			t.push(`## ${n + 1}. ${r(i?.title) || "Yeni sohbet"}`), t.push("");
			let e = Array.isArray(i?.messages) ? i.messages : [];
			for (let n of e) {
				let e = n?.role === "assistant" ? "Hafize" : "Sen", i = r(n?.content).trim();
				i && (t.push(`### ${e}`), t.push(""), t.push(i), t.push(""));
			}
			t.push("---", "");
		}
		return t.join("\n");
	}
	function a(e) {
		return JSON.stringify({
			exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
			version: 1,
			conversations: e
		}, null, 2);
	}
	function o(e, t, n) {
		try {
			let r = new Blob([e], { type: n }), i = URL.createObjectURL(r), a = document.createElement("a");
			return a.href = i, a.download = t, a.rel = "noopener", document.body.append(a), a.click(), a.remove(), window.setTimeout(() => URL.revokeObjectURL(i), 1e3), !0;
		} catch {
			return !1;
		}
	}
	function s() {
		e.block.querySelector(".history-export")?.remove();
		let r = document.createElement("div");
		r.className = "history-export";
		let s = document.createElement("span");
		s.className = "history-export-label", s.textContent = "Dışa aktar";
		let c = document.createElement("div");
		c.className = "history-export-actions";
		for (let e of ["md", "json"]) {
			let r = document.createElement("button");
			r.type = "button", r.className = "history-export-btn", r.textContent = e === "md" ? "Markdown" : "JSON", r.setAttribute("aria-label", `Sohbet geçmişini ${e === "md" ? "Markdown" : "JSON"} olarak dışa aktar`), r.addEventListener("click", () => {
				let r = n();
				if (!r.length) return t("Dışa aktarılacak sohbet geçmişi yok.");
				t(o(e === "md" ? i(r) : a(r), `hafize-sohbet-gecmisi-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.${e}`, e === "md" ? "text/markdown;charset=utf-8" : "application/json;charset=utf-8") ? `${e === "md" ? "Markdown" : "JSON"} dosyası hazırlandı.` : "Dışa aktarma başlatılamadı.");
			}), c.append(r);
		}
		r.append(s, c), e.block.insertBefore(r, e.history);
	}
	s(), new MutationObserver(() => {
		e.block.querySelector(".history-export") || s();
	}).observe(e.block, { childList: !0 }), Object.freeze({
		buildMarkdown: i,
		buildJson: a,
		download: o
	});
})(), (() => {
	let e = "hafize.chat-drafts.v1", t = "hafize.conversations.v1", n = "chatDraftStatus", r = document.querySelector("#messageInput"), i = document.querySelector("#composer"), a = document.querySelector("#conversationList");
	if (!r || !i || !a) return;
	let o = 0, s = "", c = "", l = "";
	function u() {
		try {
			let t = JSON.parse(localStorage.getItem(e) || "{}");
			return t && typeof t == "object" && !Array.isArray(t) ? t : {};
		} catch {
			return {};
		}
	}
	function d() {
		try {
			let e = JSON.parse(localStorage.getItem(t) || "[]");
			return Array.isArray(e) ? new Set(e.map((e) => typeof e?.id == "string" ? e.id : "").filter(Boolean)) : /* @__PURE__ */ new Set();
		} catch {
			return /* @__PURE__ */ new Set();
		}
	}
	function f(e) {
		return typeof e == "string" ? e.slice(0, 12e3) : "";
	}
	function p(e) {
		let t = d(), n = Object.entries(e).filter(([e, n]) => t.has(e) && f(n).length > 0).map(([e, t]) => [e, f(t)]).slice(-30);
		return Object.fromEntries(n);
	}
	function m(t) {
		try {
			return localStorage.setItem(e, JSON.stringify(p(t))), !0;
		} catch {
			return !1;
		}
	}
	function h() {
		let e = u(), t = p(e);
		return JSON.stringify(e) !== JSON.stringify(t) && m(t);
	}
	function g() {
		return a.querySelector(".conversation-row.active")?.querySelector(".conversation-open")?.dataset?.conversationId || "";
	}
	function _(e = g()) {
		return e ? f(u()[e]) : "";
	}
	function v(e = g()) {
		return !!_(e).trim();
	}
	function y() {
		let e = document.getElementById(n);
		return e || (e = document.createElement("span"), e.id = n, e.className = "chat-draft-status", e.setAttribute("role", "status"), e.setAttribute("aria-live", "polite"), i.append(e), e);
	}
	function b(e) {
		let t = y();
		t.textContent = e, t.hidden = !e;
	}
	function x() {
		return l ? `Taslak kaydedildi · ${new Intl.DateTimeFormat("tr-TR", {
			hour: "2-digit",
			minute: "2-digit"
		}).format(new Date(l))}` : "Taslak kaydedildi";
	}
	function S() {
		return o ? (window.clearTimeout(o), o = 0, C({ silent: !0 })) : !1;
	}
	function C({ silent: e = !1 } = {}) {
		let t = g();
		if (!t) return !1;
		let n = f(r.value), i = u();
		n.trim() ? i[t] = n : delete i[t];
		let a = m(i);
		return a && (c = n, l = (/* @__PURE__ */ new Date()).toISOString()), !e && a && b(n.trim() ? x() : "Taslak temizlendi"), !a && !e && b("Taslak bu cihazda kaydedilemedi"), s = t, a;
	}
	function w(e = g()) {
		if (!e) return !1;
		let t = u();
		if (!Object.prototype.hasOwnProperty.call(t, e)) return !0;
		delete t[e];
		let n = m(t);
		return n && (c = ""), n;
	}
	function T() {
		let e = g();
		if (!e || e === s) return;
		S();
		let t = _(e);
		t ? (r.value || (r.value = t, r.dispatchEvent(new Event("input", { bubbles: !0 })), b(`Taslak geri yüklendi · ${t.length} karakter`)), c = t, l = "", s = e) : (r.value = "", b(""), c = "", l = "", s = e);
	}
	function E() {
		window.clearTimeout(o), o = window.setTimeout(() => {
			o = 0, C();
		}, 250);
	}
	function D() {
		if (E(), !r.value.trim()) return b("");
		b("Taslak kaydediliyor…");
	}
	function O() {
		S(), w(), b("");
	}
	function k() {
		h(), T();
	}
	r.addEventListener("input", D), i.addEventListener("submit", O, !0), new MutationObserver(k).observe(a, {
		childList: !0,
		subtree: !0
	}), window.addEventListener("storage", (n) => {
		(n.key === e || n.key === t) && k();
	}), window.addEventListener("pagehide", S, { capture: !0 }), window.addEventListener("beforeunload", S, { capture: !0 }), document.addEventListener("visibilitychange", () => {
		document.visibilityState === "hidden" && S();
	}), h(), k(), Object.freeze({
		saveDraft: C,
		clearDraft: w,
		restoreDraft: T,
		cleanupStaleDrafts: h,
		getDraft: _,
		hasDraft: v,
		getLastPersistedDraft: () => c
	});
})(), (() => {
	let e = Object.freeze({
		selectAll: {
			key: "a",
			shift: !0
		},
		clearSelection: {
			key: "x",
			shift: !0
		},
		focusSearch: {
			key: "u",
			shift: !0
		},
		escape: {
			key: "Escape",
			shift: !1
		}
	}), t = {
		workspace: document.querySelector(".conversation-workspace"),
		search: document.querySelector("#conversationWorkspaceSearch"),
		selectAll: document.querySelector(".conversation-workspace-actions .workspace-ghost"),
		clearSelection: document.querySelectorAll(".conversation-workspace-actions .workspace-ghost")?.[1],
		status: document.querySelector("#conversationWorkspaceStatus")
	};
	if (!t.workspace || !t.search) return;
	function n(e) {
		if (!e || typeof e != "object") return !1;
		let t = String(e.tagName || "").toUpperCase();
		return [
			"INPUT",
			"TEXTAREA",
			"SELECT"
		].includes(t) ? !0 : e.isContentEditable === !0;
	}
	function r(e) {
		return !!(e?.ctrlKey || e?.metaKey);
	}
	function i(e, t) {
		return !e || !t || !r(e) || e.altKey || !!e.shiftKey != !!t.shift ? !1 : String(e.key || "").toLowerCase() === t.key.toLowerCase();
	}
	function a(e) {
		t.status && e && (t.status.textContent = e);
	}
	function o(e, t) {
		return !e || e.disabled ? !1 : (e.click(), a(t), !0);
	}
	function s() {
		t.search.focus(), t.search.select(), a("Sohbet çalışma alanı araması odakta.");
	}
	function c(e) {
		return !l(e) || document.activeElement !== t.search || !t.search.value ? !1 : (e.preventDefault(), t.search.value = "", t.search.dispatchEvent(new Event("input", { bubbles: !0 })), a("Çalışma alanı araması temizlendi."), !0);
	}
	function l(t) {
		return String(t?.key || "") === e.escape.key && !t.ctrlKey && !t.metaKey && !t.altKey;
	}
	function u(a) {
		a && !a.isComposing && (c(a) || r(a) && (n(a.target) && a.target !== t.search || (i(a, e.selectAll) ? (a.preventDefault(), o(t.selectAll, "Görünen sohbetler seçildi.")) : i(a, e.clearSelection) ? (a.preventDefault(), o(t.clearSelection, "Sohbet seçimi temizlendi.")) : i(a, e.focusSearch) && (a.preventDefault(), s()))));
	}
	function d() {
		if (t.workspace.querySelector(".conversation-workspace-shortcuts")) return;
		let e = document.createElement("div");
		e.className = "conversation-workspace-shortcuts", e.setAttribute("role", "note"), e.setAttribute("aria-label", "Çalışma alanı klavye kısayolları");
		let n = document.createElement("span");
		n.className = "workspace-shortcuts-title", n.textContent = "Kısayollar";
		let r = document.createElement("div");
		r.className = "workspace-shortcuts-list";
		for (let [e, t] of [
			["Ctrl / ⌘ + Shift + A", "Görünenleri seç"],
			["Ctrl / ⌘ + Shift + X", "Seçimi temizle"],
			["Ctrl / ⌘ + Shift + U", "Aramaya geç"],
			["Esc", "Aramayı temizle"]
		]) {
			let n = document.createElement("span");
			n.className = "workspace-shortcut-item";
			let i = document.createElement("kbd");
			i.textContent = e;
			let a = document.createElement("span");
			a.textContent = t, n.append(i, a), r.append(n);
		}
		e.append(n, r), t.workspace.append(e);
	}
	function f() {
		document.querySelectorAll(".workspace-row-check:checked").length === 0 ? t.clearSelection?.setAttribute("aria-disabled", "true") : t.clearSelection?.removeAttribute("aria-disabled");
	}
	new MutationObserver(() => {
		f(), d();
	}).observe(t.workspace, {
		childList: !0,
		subtree: !0
	}), document.addEventListener("keydown", u), t.search.addEventListener("focus", () => a("Sohbet araması. Esc ile temizleyebilirsin.")), d(), f(), window.HafizeConversationWorkspaceKeyboard = Object.freeze({
		SHORTCUTS: e,
		isTextEditingTarget: n,
		isModifierPressed: r,
		matches: i,
		matchesEscape: l,
		focusSearch: s
	});
})(), (/* @__PURE__ */ e(((e, t) => {
	(function(e, n) {
		let r = n();
		typeof t == "object" && t?.exports ? t.exports = r : e.HafizeMessageWorkspacePolicy = r;
	})(typeof globalThis < "u" ? globalThis : self, function() {
		let e = /* @__PURE__ */ new Set([
			"up",
			"down",
			""
		]), t = /* @__PURE__ */ new Set([
			"all",
			"saved",
			"feedback",
			"notes",
			"user",
			"assistant",
			"tag"
		]), n = /* @__PURE__ */ new Set([
			"newest",
			"oldest",
			"feedback",
			"notes"
		]);
		function r(e) {
			return String(e ?? "").replace(/\s+/g, " ").trim();
		}
		function i(e) {
			return r(e).replace(/^#+\s*/, "").slice(0, 24);
		}
		function a(e) {
			return String(e ?? "").replace(/\r\n?/g, "\n").trim().slice(0, 600);
		}
		function o(t) {
			return e.has(t) ? t : "";
		}
		function s(e, t = (/* @__PURE__ */ new Date()).toISOString()) {
			let n = new Date(e || "");
			return Number.isFinite(n.getTime()) ? n.toISOString() : t;
		}
		function c(e, t) {
			return Object.prototype.hasOwnProperty.call(e, t) ? e[t] : void 0;
		}
		function l(e) {
			if (!e || typeof e != "object") return null;
			let t = c(e, "conversationId"), n = c(e, "messageId"), r = c(e, "id"), l = c(e, "tags"), u = typeof t == "string" ? t.trim().slice(0, 120) : "", d = typeof n == "string" ? n.trim().slice(0, 120) : "";
			if (!u || !d) return null;
			let f = Array.isArray(l) ? [...new Set(l.filter((e) => typeof e == "string").map(i).filter(Boolean))].slice(0, 8) : [];
			return Object.freeze({
				id: typeof r == "string" && r ? r.slice(0, 120) : `${u}:${d}`,
				conversationId: u,
				messageId: d,
				saved: c(e, "saved") === !0,
				feedback: o(c(e, "feedback")),
				note: a(c(e, "note")),
				tags: f,
				createdAt: s(c(e, "createdAt")),
				updatedAt: s(c(e, "updatedAt"))
			});
		}
		function u(e) {
			if (!Array.isArray(e)) return [];
			let t = /* @__PURE__ */ new Set(), n = [];
			for (let r of e) {
				let e = l(r);
				if (e && !t.has(e.id) && (t.add(e.id), (e.saved || e.feedback || e.note || e.tags.length) && (n.push(e), n.length >= 240))) break;
			}
			return n;
		}
		function d(e) {
			let i = e && typeof e == "object" ? e : {};
			return {
				query: typeof i.query == "string" ? r(i.query).toLocaleLowerCase("tr-TR").slice(0, 120) : "",
				filter: t.has(i.filter) ? i.filter : "all",
				sort: n.has(i.sort) ? i.sort : "newest",
				selected: Array.isArray(i.selected) ? [...new Set(i.selected.filter((e) => typeof e == "string").slice(0, 100))] : []
			};
		}
		function f(e, t) {
			let n = new Set(Array.isArray(t) ? t : []);
			return u(e).filter((e) => n.has(e.id)).slice(0, 100);
		}
		function p(e) {
			return !e || typeof e != "object" ? "" : r([
				e.content,
				e.note,
				...Array.isArray(e.tags) ? e.tags : []
			].filter(Boolean).join(" ")).toLocaleLowerCase("tr-TR").slice(0, 12e3);
		}
		function m(e, t) {
			if (!e || !e.record) return !1;
			let n = e.record;
			return !(t.filter === "saved" && !n.saved || t.filter === "feedback" && !n.feedback || t.filter === "notes" && !n.note || t.filter === "tag" && !n.tags.length || t.filter === "user" && e.role !== "user" || t.filter === "assistant" && e.role !== "assistant" || t.query && !p({
				content: e.content,
				note: n.note,
				tags: n.tags
			}).includes(t.query));
		}
		function h(e, t) {
			let n = [...e];
			return n.sort((e, n) => t === "oldest" ? e.updatedAt.localeCompare(n.updatedAt) : t === "feedback" ? Number(!!n.feedback) - Number(!!e.feedback) || n.updatedAt.localeCompare(e.updatedAt) : t === "notes" && Number(!!n.note) - Number(!!e.note) || n.updatedAt.localeCompare(e.updatedAt)), n;
		}
		function g(e, t) {
			return l({
				...e,
				...t,
				updatedAt: (/* @__PURE__ */ new Date()).toISOString()
			});
		}
		function _(e) {
			return g(e, { saved: !e.saved });
		}
		function v(e, t) {
			return g(e, { feedback: e.feedback === t ? "" : o(t) });
		}
		function y(e, t) {
			return g(e, { note: a(t) });
		}
		function b(e, t) {
			return g(e, { tags: [...new Set((Array.isArray(t) ? t : String(t ?? "").split(",")).map(i).filter(Boolean))].slice(0, 8) });
		}
		function x(e) {
			return !e || !e.saved && !e.feedback && !e.note && !e.tags.length;
		}
		return Object.freeze({
			MAX_RECORDS: 240,
			MAX_NOTE: 600,
			MAX_TAG: 24,
			MAX_TAGS: 8,
			MAX_QUERY: 120,
			MAX_EXPORT: 100,
			text: r,
			tag: i,
			note: a,
			feedback: o,
			normalizeRecord: l,
			normalizeRecords: u,
			normalizeState: d,
			canExport: f,
			searchableText: p,
			matches: m,
			sort: h,
			createPatch: g,
			toggleSaved: _,
			toggleFeedback: v,
			replaceNote: y,
			replaceTags: b,
			isEmpty: x
		});
	});
})))(), (function(e) {
	let t = Object.freeze([
		[
			"Metin editörü",
			"Aşağıdaki metni {{baglam}} bağlamına uygun biçimde daha akıcı ve profesyonel hâle getir.\n\nMetin:\n{{metin}}",
			["yazma", "düzenleme"]
		],
		[
			"Kısa özet",
			"{{icerik}} içeriğini {{uzunluk}} seviyesinde özetle. Ana fikirleri ve kritik ayrıntıları koru.",
			["özet", "öğrenme"]
		],
		[
			"Kod incelemesi",
			"{{dil}} kodunu doğruluk, güvenlik, performans ve okunabilirlik açısından incele. Önce kritik bulguları sırala.\n\n{{kod}}",
			["kod", "inceleme"]
		],
		[
			"Toplantı notu",
			"Bu notları kararlar, sorumlular, açık sorular ve sonraki adımlar başlıklarıyla düzenle.\n\n{{notlar}}",
			["iş", "not"]
		],
		[
			"Araştırma çerçevesi",
			"{{konu}} hakkında araştırma planı hazırla. Ana soruları, güvenilir kaynak türlerini, karşılaştırma ölçütlerini ve belirsizlikleri belirt.",
			["araştırma", "planlama"]
		],
		[
			"Planlayıcı",
			"{{hedef}} için {{sure}} günlük uygulanabilir plan çıkar. Her gün tek ana hedef, ölçülebilir çıktı ve risk azaltma adımı ver.",
			["planlama", "günlük"]
		],
		[
			"Karar matrisi",
			"{{secenekler}} seçeneklerini şu kriterlerle karşılaştır: {{kriterler}}. 1-5 puan ver ve varsayımları belirt.",
			["karar", "analiz"]
		],
		[
			"E-posta taslağı",
			"{{amac}} amacıyla {{ton}} tonda kısa ve net bir e-posta yaz. Alıcı bağlamı: {{alici}}.",
			["e-posta", "iletişim"]
		],
		[
			"Test senaryoları",
			"{{ozellik}} için mutlu yol, sınır durumları, hata yolları ve güvenlik kontrollerini içeren test senaryoları yaz.",
			["test", "yazılım"]
		],
		[
			"Fikirden gereksinime",
			"{{fikir}} fikrini kullanıcı hikâyeleri, kabul kriterleri, veri modeli, riskler ve MVP kapsamına dönüştür.",
			["ürün", "MVP"]
		]
	]);
	function n({ force: n = !1 } = {}) {
		let r = e.HafizePromptLibrary, i = e.localStorage;
		if (!r || !i || typeof r.loadItems != "function" || typeof r.saveItems != "function") return !1;
		let a = r.loadItems(i);
		if (a.length && !n) return !1;
		let o = (/* @__PURE__ */ new Date()).toISOString(), s = new Set(a.map((e) => e.title)), c = t.filter(([e]) => !s.has(e)).map(([e, t, n], i) => r.normalizeItem({
			id: `starter-${i + 1}-${Date.now()}`,
			title: e,
			body: t,
			tags: n,
			favorite: !1,
			useCount: 0,
			createdAt: o,
			updatedAt: o
		})).filter(Boolean);
		return c.length ? r.saveItems(i, [...c, ...a]) : !1;
	}
	e.HafizePromptLibraryStarters = Object.freeze({
		STARTERS: t,
		seed: n
	}), e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", () => n(), { once: !0 }) : n();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = !1, n = null, r = [], i = e.HafizePromptLibrary, a = () => e.localStorage, o = () => i?.loadItems?.(a()) || [], s = (e) => i?.saveItems?.(a(), e) === !0, c = (t) => {
		let n = e.document?.querySelector?.("#promptLibraryCard .prompt-library-status");
		if (!n) return;
		let r = String(t ?? "").slice(0, 180);
		n.textContent = r, e.setTimeout?.(() => {
			n.textContent === r && (n.textContent = "");
		}, 3200);
	}, l = (t, n) => {
		let r = e.document.createElement("button");
		return r.type = "button", r.className = "soft-btn prompt-enhancement-action", r.textContent = t, r.dataset.promptEnhancement = n, r.setAttribute("aria-label", t), r;
	}, u = () => e.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	function d() {
		try {
			let t = {
				key: "hafize.prompt-library.v1",
				newValue: JSON.stringify(o()),
				storageArea: a()
			};
			typeof e.StorageEvent == "function" ? e.dispatchEvent(new e.StorageEvent("storage", t)) : e.dispatchEvent(new e.Event("hafize:prompt-library-refresh"));
		} catch {
			e.dispatchEvent?.(new e.Event("hafize:prompt-library-refresh"));
		}
	}
	function f(t) {
		let n = e.navigator?.clipboard?.writeText?.(t.body);
		if (!n?.then) return c("Panoya kopyalama kullanılamıyor.");
		n.then(() => c("İstem panoya kopyalandı.")).catch(() => c("Panoya kopyalama kullanılamıyor."));
	}
	function p(e) {
		let t = o();
		if (t.length >= 120) return c("Kütüphane sınırı dolu.");
		let n = i.normalizeItem({
			...e,
			id: u(),
			title: `${e.title} kopyası`,
			createdAt: (/* @__PURE__ */ new Date()).toISOString(),
			updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
			favorite: !1,
			useCount: 0
		});
		if (!n || !s([n, ...t])) return c("İstem çoğaltılamadı.");
		d(), c("İstem çoğaltıldı.");
	}
	function m() {
		let t = e.HafizePromptLibraryStarters;
		if (!t?.seed) return c("Başlangıç seti modülü kullanılamıyor.");
		let n = t.seed({ force: !0 });
		d(), c(n ? "Eksik başlangıç istemleri eklendi." : "Başlangıç istemlerinin tamamı zaten mevcut.");
	}
	function h() {
		let t = {
			query: "",
			tag: "all",
			favoriteOnly: !1,
			sort: "updated-desc"
		};
		i.saveState(a(), t), e.dispatchEvent?.(new e.CustomEvent("hafize:prompt-library-state-changed", { detail: t })), c("İstem filtreleri sıfırlandı.");
	}
	function g(e) {
		return [...e.querySelectorAll("[data-prompt-selection]:checked")].map((e) => e.dataset.promptSelection).filter(Boolean).slice(0, 40);
	}
	function _(t) {
		let n = t.target?.closest?.("[data-prompt-enhancement]");
		if (!n) return;
		let r = n.dataset.promptEnhancement, i = e.document.querySelector("#promptLibraryCard");
		if (!i) return;
		let a = () => o().find((e) => e.id === n.closest(".prompt-item")?.dataset.promptId);
		if (r === "copy") {
			let e = a();
			e && f(e);
		} else if (r === "duplicate") {
			let e = a();
			e && p(e);
		} else {
			if (r === "restore-starters") return m();
			if (r === "clear-filters") return h();
			if (r === "bulk-clear") i.querySelectorAll("[data-prompt-selection]").forEach((e) => {
				e.checked = !1;
			}), v();
			else if (r === "bulk-delete") {
				let t = new Set(g(i));
				if (!t.size) return c("Seçili istem yok.");
				if (!e.confirm?.(`${t.size} istem silinsin mi?`)) return;
				if (!s(o().filter((e) => !t.has(e.id)))) return c("Seçilen istemler silinemedi.");
				d(), c("Seçilen istemler silindi.");
			}
		}
	}
	function v() {
		let t = e.document?.querySelector?.("#promptLibraryCard"), n = t?.querySelector?.("#promptLibraryList");
		if (!t || !n) return;
		let i = t.querySelector(".prompt-library-enhancement-toolbar");
		i || (i = e.document.createElement("div"), i.className = "prompt-library-enhancement-toolbar", i.append(l("Filtreleri sıfırla", "clear-filters"), l("Başlangıç seti", "restore-starters")), t.querySelector(".prompt-library-filters")?.after(i), i.addEventListener("click", _), r.push(() => i.removeEventListener("click", _))), n.querySelectorAll(".prompt-item").forEach((e) => {
			let t = e.dataset.promptId, n = e.querySelector(".prompt-item-actions");
			t && n && !n.querySelector("[data-prompt-enhancement=\"copy\"]") && (n.append(l("Kopyala", "copy"), l("Çoğalt", "duplicate")), e.querySelector("input[type=\"checkbox\"]")?.setAttribute("data-prompt-selection", t));
		});
		let a = g(t).length > 0, o = n.querySelector(".prompt-library-enhancement-bulk");
		if (a && !o) {
			let t = e.document.createElement("div");
			t.className = "prompt-library-enhancement-bulk", t.append(l("Seçilenleri sil", "bulk-delete"), l("Seçimi kaldır", "bulk-clear")), n.prepend(t), t.addEventListener("click", _);
		} else a || o?.remove();
	}
	function y(t, n, r) {
		if (!e.document.querySelector(`script[${n}="${r}"]`)) {
			let i = e.document.createElement("script");
			i.src = t, i.defer = !0, i.setAttribute(n, r), (e.document.body || e.document.documentElement)?.append(i);
		}
	}
	function b(t, n, r) {
		if (!e.document.querySelector(`link[${n}="${r}"]`)) {
			let i = e.document.createElement("link");
			i.rel = "stylesheet", i.href = t, i.setAttribute(n, r), (e.document.head || e.document.documentElement)?.append(i);
		}
	}
	function x() {
		if (t || !i || !e.document) return;
		let a = e.document.querySelector("#promptLibraryCard");
		a && (t = !0, n = new MutationObserver(v), n.observe(a, {
			childList: !0,
			subtree: !0
		}), v(), e.addEventListener?.("hafize:prompt-library-changed", d), r.push(() => e.removeEventListener("hafize:prompt-library-changed", d)), b("/prompt-library-smart-insert.css", "data-hafize-prompt-smart-insert-css", "true"), b("/prompt-library-smart-insert-center.css", "data-hafize-prompt-smart-insert-center-css", "true"), b("/prompt-library-smart-insert-history.css", "data-hafize-prompt-smart-insert-history-css", "true"), b("/prompt-library-smart-insert-suggestions.css", "data-hafize-prompt-smart-insert-suggestions-css", "true"), b("/prompt-library-smart-insert-activity.css", "data-hafize-prompt-smart-insert-activity-css", "true"), y("/prompt-library-smart-insert.js", "data-hafize-prompt-smart-insert", "true"), y("/prompt-library-smart-insert-center.js", "data-hafize-prompt-smart-insert-center", "true"), y("/prompt-library-smart-insert-history.js", "data-hafize-prompt-smart-insert-history", "true"), y("/prompt-library-smart-insert-history-bridge.js", "data-hafize-prompt-smart-insert-history-bridge", "true"), y("/prompt-library-smart-insert-suggestions.js", "data-hafize-prompt-smart-insert-suggestions", "true"), y("/prompt-library-smart-insert-shortcuts.js", "data-hafize-prompt-smart-insert-shortcuts", "true"), y("/prompt-library-smart-insert-presets.js", "data-hafize-prompt-smart-insert-presets", "true"), y("/prompt-library-smart-insert-validation.js", "data-hafize-prompt-smart-insert-validation", "true"), y("/prompt-library-smart-insert-activity.js", "data-hafize-prompt-smart-insert-activity", "true"));
	}
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", x, { once: !0 }) : x(), e.addEventListener?.("beforeunload", () => {
		n?.disconnect?.();
		for (let e of r.splice(0)) e();
	});
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = !1;
	function n() {
		if (t || !e.document) return;
		let n = e.document.querySelector("#promptLibraryCard");
		n && (t = !0, e.document.addEventListener("keydown", (t) => {
			if (!(t.ctrlKey || t.metaKey) || !t.shiftKey) return;
			let r = t.key.toLowerCase();
			if (r === "p") {
				let n = e.document.querySelector("#promptLibrarySearch");
				if (!n) return;
				t.preventDefault(), n.focus(), n.select();
			} else if (r === "n") {
				let e = n.querySelector(".prompt-library-actions .soft-btn");
				if (!e) return;
				t.preventDefault(), e.click();
			}
		}, { passive: !1 }));
	}
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", n, { once: !0 }) : n();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "hafize.prompt-library.v1", n = "promptLibraryUsageInsights", r = (e, t, n) => {
		let r = e.createElement("span");
		return n && (r.className = n), r.textContent = String(t ?? ""), r;
	}, i = (e, t) => {
		let n = e.createElement("button");
		return n.type = "button", n.className = "mini-btn prompt-library-usage-toggle", n.textContent = t, n;
	};
	function a(e) {
		try {
			let n = e.localStorage?.getItem(t) || "[]", r = JSON.parse(n);
			return Array.isArray(r) ? r.filter((e) => e && typeof e == "object") : [];
		} catch {
			return [];
		}
	}
	function o(e) {
		return ((typeof e.title == "string" ? e.title.trim() : "") || "İsimsiz istem").slice(0, 72);
	}
	function s(e) {
		let t = Number(e.useCount);
		return Number.isFinite(t) && t >= 0 ? Math.min(9999, Math.floor(t)) : 0;
	}
	function c(e) {
		let t = Date.parse(typeof e.updatedAt == "string" ? e.updatedAt : "");
		return Number.isFinite(t) ? t : 0;
	}
	function l(e) {
		let t = e.filter((e) => typeof e.id == "string"), n = t.reduce((e, t) => e + s(t), 0), r = t.filter((e) => s(e) > 0), i = r.slice().sort((e, t) => s(t) - s(e) || c(t) - c(e)).slice(0, 5), a = r.slice().sort((e, t) => c(t) - c(e) || s(t) - s(e)).slice(0, 5);
		return {
			total: t.length,
			usedCount: r.length,
			totalUses: n,
			top: i,
			recent: a
		};
	}
	function u(c = e.document, u = e) {
		let d = c?.getElementById?.("promptLibraryCard");
		if (!c || !d || c.getElementById(n)) return null;
		let f = c.createElement("section");
		f.id = n, f.className = "prompt-library-usage-insights", f.setAttribute("aria-labelledby", "promptLibraryUsageTitle");
		let p = c.createElement("div");
		p.className = "prompt-library-usage-head";
		let m = c.createElement("strong");
		m.id = "promptLibraryUsageTitle", m.textContent = "Kullanım istatistikleri";
		let h = i(c, "Gizle");
		h.setAttribute("aria-expanded", "true"), p.append(m, h);
		let g = c.createElement("div");
		g.className = "prompt-library-usage-body", p.append(g), f.append(p, g), d.append(f);
		let _ = (e, t) => {
			let n = c.createElement("div");
			return n.className = "prompt-library-usage-list", n.setAttribute("role", "list"), e.length ? (e.forEach((e, t) => {
				let i = c.createElement("div");
				i.className = "prompt-library-usage-row", i.setAttribute("role", "listitem"), i.append(r(c, `${t + 1}.`, "prompt-library-usage-rank"), r(c, o(e), "prompt-library-usage-name"), r(c, `${s(e)} kullanım`, "prompt-library-usage-count")), n.append(i);
			}), n) : (n.append(r(c, t, "prompt-library-usage-empty")), n);
		}, v = () => {
			if (!c.getElementById(n)) return;
			let e = l(a(u));
			g.replaceChildren();
			let t = c.createElement("div");
			t.className = "prompt-library-usage-stats";
			for (let [n, i] of [
				["Kayıt", e.total],
				["Kullanılan", e.usedCount],
				["Toplam kullanım", e.totalUses]
			]) {
				let e = c.createElement("div");
				e.className = "prompt-library-usage-stat", e.append(r(c, String(i), "prompt-library-usage-value"), r(c, n, "prompt-library-usage-label")), t.append(e);
			}
			let i = r(c, "En çok kullanılan", "prompt-library-usage-subtitle"), o = r(c, "Son kullanılan", "prompt-library-usage-subtitle");
			g.append(t, i, _(e.top, "Henüz kullanılan istem yok."), o, _(e.recent, "Son kullanım verisi bulunmuyor."));
		}, y = !1;
		h.addEventListener("click", () => {
			y = !y, g.hidden = y, h.textContent = y ? "Göster" : "Gizle", h.setAttribute("aria-expanded", String(!y));
		});
		let b = 0, x = typeof MutationObserver == "function" ? new MutationObserver(() => {
			u.clearTimeout?.(b), b = u.setTimeout?.(v, 80) || 0;
		}) : null, S = c.getElementById("promptLibraryList");
		x?.observe(S || d, {
			childList: !0,
			subtree: !0
		});
		let C = (e) => {
			e.key === t && v();
		};
		return u.addEventListener?.("storage", C), v(), Object.freeze({
			mounted: !0,
			refresh: v,
			summarize: () => l(a(u)),
			destroy: () => {
				u.clearTimeout?.(b), x?.disconnect(), u.removeEventListener?.("storage", C), f.remove();
			}
		});
	}
	e.HafizePromptLibraryUsage = Object.freeze({
		STORAGE_KEY: t,
		mount: u,
		summarize: l,
		usageOf: s
	});
	let d = () => u(e.document, e);
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", d, { once: !0 }) : d();
})(typeof globalThis < "u" ? globalThis : self);
//#endregion
//#region public/typed/legacy/prompt-library-smart-insert-validation.ts
function t(e) {
	let t = 1e3, n = 8e3, r = /^([a-zA-Z0-9_-]{1,32})$/, i = (e) => String(e ?? "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32), a = (e) => String(e ?? "").replace(/\0/g, "").slice(0, t);
	function o(t, o = {}) {
		let s = String(t || "").slice(0, n), c = e.HafizePromptLibrary?.extractVariables?.(s) || [], l = Object.create(null), u = [], d = [];
		for (let e of c) {
			let t = i(e);
			if (!r.test(t)) {
				d.push(t);
				continue;
			}
			let n = a(o[t]);
			l[t] = n, n.trim() || u.push(t);
		}
		return Object.freeze({
			names: c,
			normalized: l,
			missing: u,
			invalid: d,
			valid: d.length === 0 && u.length === 0
		});
	}
	function s(t, r) {
		let i = o(t, r);
		if (!i.valid) return Object.freeze({
			text: String(t || "").slice(0, n),
			...i
		});
		let a = e.HafizePromptLibrary?.replaceVariables?.(t, i.normalized) || String(t || "");
		return Object.freeze({
			text: a.slice(0, n),
			...i
		});
	}
	function c(t) {
		return (e.HafizePromptLibrary?.extractVariables?.(t) || []).filter((e) => !r.test(i(e)));
	}
	function l(e, t, n, r) {
		if (!e || !r) return null;
		let i = s(t, n);
		r.replaceChildren();
		let a = e.createElement("span");
		a.className = "prompt-smart-insert-validation-status", a.textContent = i.valid ? "Tüm değişkenler hazır." : `Eksik: ${i.missing.join(", ") || "yok"}`;
		let o = e.createElement("pre");
		return o.className = "prompt-smart-insert-validation-preview", o.textContent = i.text, r.append(a, o), i;
	}
	e.HafizePromptLibrarySmartInsertValidation = Object.freeze({
		MAX_NAME: 32,
		MAX_VALUE: t,
		MAX_BODY: n,
		cleanVariable: i,
		cleanValue: a,
		inspect: o,
		resolve: s,
		unresolved: c,
		preview: l
	});
}
t(globalThis);
//#endregion
//#region public/typed/legacy/prompt-library-smart-insert.ts
function n(e) {
	let t = "promptLibraryCard", n = "hafize.prompt-library.variable-profiles.v1", r = 1e3, i = 8e3, a = 3e5, o = null, s = () => e.HafizePromptLibrary, c = () => e.document?.querySelector?.("#messageInput"), l = (t, n, r) => {
		let i = e.document.createElement(t);
		return r && (i.className = r), n !== void 0 && (i.textContent = n), i;
	}, u = (e) => String(e ?? "").replace(/\0/g, "").slice(0, r), d = (e) => String(e ?? "").trim().slice(0, 60), f = () => e.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`, p = (e) => s()?.extractVariables?.(e) || [];
	function m(e) {
		if (!e || typeof e != "object") return null;
		let t = d(e.name);
		if (!t) return null;
		let n = Object.create(null), r = 0;
		for (let [t, i] of Object.entries(e.values && typeof e.values == "object" ? e.values : {})) {
			let e = String(t).trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
			!e || r >= 12 || (n[e] = u(i), r += 1);
		}
		return {
			id: String(e.id || f()).slice(0, 120),
			name: t,
			values: n,
			updatedAt: String(e.updatedAt || (/* @__PURE__ */ new Date()).toISOString()).slice(0, 40)
		};
	}
	function h(e) {
		if (!Array.isArray(e)) return [];
		let t = [], n = /* @__PURE__ */ new Set();
		for (let r of e.slice(0, 48)) {
			let e = m(r);
			if (e && !n.has(e.id) && (n.add(e.id), t.push(e), t.length >= 24)) break;
		}
		return t;
	}
	function g() {
		try {
			return h(JSON.parse(e.localStorage?.getItem(n) || "[]"));
		} catch {
			return [];
		}
	}
	function _(t) {
		let r = h(t);
		try {
			return e.localStorage?.setItem(n, JSON.stringify(r)), e.dispatchEvent?.(new Event("hafize:prompt-library-variable-profiles-changed")), !0;
		} catch {
			return !1;
		}
	}
	function v(e) {
		let t = JSON.stringify({
			version: 1,
			source: "hafize-prompt-variable-profiles",
			exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
			profiles: h(e)
		}, null, 2);
		return t.length <= a ? t : JSON.stringify({
			version: 1,
			source: "hafize-prompt-variable-profiles",
			profiles: []
		}, null, 2);
	}
	function y(e) {
		let t = String(e || "");
		if (t.length > a) throw Error("oversize");
		let n = JSON.parse(t);
		return h(Array.isArray(n) ? n : n?.profiles);
	}
	function b(e, t) {
		let n = h(e), r = new Map(n.map((e) => [e.name.toLocaleLowerCase("tr-TR"), e]));
		for (let e of h(t)) {
			let t = e.name.toLocaleLowerCase("tr-TR"), i = r.get(t);
			if (i) {
				let t = {
					...i,
					values: {
						...i.values,
						...e.values
					},
					updatedAt: (/* @__PURE__ */ new Date()).toISOString()
				}, r = n.findIndex((e) => e.id === i.id);
				r >= 0 && n.splice(r, 1, m(t));
			} else if (n.length < 24) {
				let i = m({
					...e,
					id: f()
				});
				i && (n.push(i), r.set(t, i));
			}
		}
		return h(n);
	}
	function x(e) {
		let t = Object.create(null);
		for (let { name: n, input: r } of e) t[n] = u(r.value);
		return t;
	}
	function S(n = "cancel") {
		if (!o) return;
		let { dialog: r, trigger: i } = o;
		o = null, r.remove(), e.document.getElementById(t)?.removeAttribute("aria-busy"), i?.focus?.(), e.dispatchEvent?.(new CustomEvent("hafize:prompt-library-variable-dialog", { detail: { reason: n } }));
	}
	function C(t, n, r) {
		try {
			let i = new Blob([t], { type: r }), a = URL.createObjectURL(i), o = l("a");
			return o.href = a, o.download = n, o.click(), e.setTimeout?.(() => URL.revokeObjectURL(a), 0), !0;
		} catch {
			return !1;
		}
	}
	function w(t, n, r) {
		let i = l("div", void 0, "prompt-library-profile-tools"), s = l("label", "Değişken profili", "prompt-library-variable-label"), c = e.document.createElement("select");
		c.setAttribute("aria-label", "Değişken profili seç");
		let u = l("option", "Profil seçmeden devam et");
		u.value = "", c.append(u);
		for (let e of g()) {
			let t = l("option", e.name);
			t.value = e.id, c.append(t);
		}
		let p = l("div", void 0, "prompt-library-profile-actions"), h = l("button", "Profili kaydet", "mini-btn");
		h.type = "button";
		let S = l("button", "Profili sil", "mini-btn");
		S.type = "button";
		let w = l("button", "Profilleri dışa aktar", "mini-btn");
		w.type = "button";
		let D = l("button", "Profilleri içe aktar", "mini-btn");
		D.type = "button";
		let O = e.document.createElement("input");
		return O.type = "file", O.accept = "application/json,.json", O.hidden = !0, p.append(h, S, w, D, O), i.append(s, c, p), c.addEventListener("change", () => {
			let e = g().find((e) => e.id === c.value);
			for (let { name: t, input: n } of r) n.value = e?.values?.[t] || "";
			o.profileId = e?.id || "", o.updatePreview?.();
		}), h.addEventListener("click", () => {
			let t = c.value && g().find((e) => e.id === c.value)?.name || "", n = e.prompt?.("Profil adı:", t) ?? "", i = d(n);
			if (!i) return;
			let a = x(r), s = g(), l = s.find((e) => e.name.toLocaleLowerCase("tr-TR") === i.toLocaleLowerCase("tr-TR")), u = m({
				id: l?.id || f(),
				name: i,
				values: a,
				updatedAt: (/* @__PURE__ */ new Date()).toISOString()
			});
			u && _(l ? s.map((e) => e.id === l.id ? u : e) : [u, ...s].slice(0, 24)) && (o.profileId = u.id, T(c), c.value = u.id, E("Değişken profili kaydedildi."));
		}), S.addEventListener("click", () => {
			if (!c.value) return E("Önce silinecek profili seç.");
			e.confirm?.("Seçili değişken profili silinsin mi?") && _(g().filter((e) => e.id !== c.value)) && (o.profileId = "", c.value = "", E("Değişken profili silindi."));
		}), w.addEventListener("click", () => {
			E(C(v(g()), "hafize-variable-profiles.json", "application/json;charset=utf-8") ? "Değişken profilleri dışa aktarıldı." : "Profil yedeği oluşturulamadı.");
		}), D.addEventListener("click", () => O.click()), O.addEventListener("change", () => {
			let e = O.files?.[0];
			if (O.value = "", !e || e.size > a) return E("Profil dosyası 300 KB sınırını aşamaz.");
			let t = new FileReader();
			t.onload = () => {
				try {
					let e = y(String(t.result || ""));
					if (!_(b(g(), e))) return E("Profil yedeği kaydedilemedi.");
					E(`${e.length} profil içe aktarıldı.`), T(c);
				} catch {
					E("Geçersiz değişken profil yedeği.");
				}
			}, t.onerror = () => E("Profil yedeği okunamadı."), t.readAsText(e);
		}), T(c), i;
	}
	function T(e) {
		let t = e.value, n = l("option", "Profil seçmeden devam et");
		n.value = "", e.replaceChildren(n);
		for (let t of g()) {
			let n = l("option", t.name);
			n.value = t.id, e.append(n);
		}
		e.value = g().some((e) => e.id === t) ? t : "";
	}
	function E(t) {
		let n = e.document?.querySelector?.("#promptLibraryCard .prompt-library-status");
		n && (n.textContent = String(t || "").slice(0, 180));
	}
	function D(n) {
		if (!n || o || !e.document) return;
		let a = p(n.body), u = e.document.getElementById(t);
		if (!u) return;
		if (!a.length) {
			let e = c();
			if (!e) return E("Mesaj alanı bulunamadı.");
			e.value = n.body, e.dispatchEvent(new Event("input", { bubbles: !0 })), e.focus();
			return;
		}
		let d = l("div", void 0, "prompt-library-variable-dialog");
		d.id = "promptLibraryVariableDialog", d.setAttribute("role", "dialog"), d.setAttribute("aria-modal", "true"), d.setAttribute("aria-labelledby", "promptLibraryVariableTitle"), d.tabIndex = -1;
		let f = l("div", void 0, "prompt-library-variable-panel"), m = l("div", void 0, "prompt-library-variable-heading"), h = l("h3", "Akıllı istem doldurma");
		h.id = "promptLibraryVariableTitle";
		let g = l("button", "Kapat", "mini-btn");
		g.type = "button", m.append(h, g);
		let _ = l("p", `${n.title || "İsimsiz istem"} için ${a.length} değişkeni doldur.`, "prompt-library-variable-help"), v = l("div", void 0, "prompt-library-variable-form"), y = [], b = l("pre", void 0, "prompt-library-variable-preview");
		b.setAttribute("aria-label", "Doldurulmuş istem önizlemesi");
		let C = () => {
			let e = x(y);
			b.textContent = (s()?.replaceVariables?.(n.body, e) || n.body).slice(0, i);
		};
		for (let t of a) {
			let n = l("label", t, "prompt-library-variable-label");
			n.htmlFor = `promptVariable-${t}`;
			let i = e.document.createElement("textarea");
			i.id = `promptVariable-${t}`, i.name = t, i.rows = 2, i.maxLength = r, i.placeholder = `{{${t}}} değerini gir`, i.setAttribute("aria-label", `${t} değişkeni`), i.required = !0, i.addEventListener("input", C), y.push({
				name: t,
				input: i
			}), v.append(n, i);
		}
		let T = w(f, a, y), D = l("div", void 0, "prompt-library-variable-actions"), O = l("button", "Composer’a aktar", "soft-btn");
		O.type = "button";
		let k = l("button", "Vazgeç", "soft-btn");
		k.type = "button";
		let A = l("button", "Alanları temizle", "soft-btn");
		A.type = "button", D.append(O, k, A), f.append(m, _, T, v, l("h4", "Önizleme"), b, D), d.append(f), (e.document.body || e.document.documentElement).append(d), o = {
			dialog: d,
			fields: y,
			trigger: e.document.activeElement,
			updatePreview: C,
			profileId: ""
		}, u.setAttribute("aria-busy", "true"), C();
		let j = () => [...d.querySelectorAll("textarea,select,button:not([disabled])")].filter((e) => !e.hidden);
		O.addEventListener("click", () => {
			let e = x(y), t = a.filter((t) => !e[t].trim());
			if (t.length) {
				E(`Eksik değişken: ${t.join(", ")}`), y.find((e) => e.name === t[0])?.input.focus();
				return;
			}
			let r = c();
			if (!r) return S("composer-missing");
			r.value = s()?.replaceVariables?.(n.body, e) || n.body, r.dispatchEvent(new Event("input", { bubbles: !0 })), r.focus(), S("insert"), E("İstem composer alanına aktarıldı; otomatik gönderim yapılmadı.");
		}), k.addEventListener("click", () => S()), g.addEventListener("click", () => S()), A.addEventListener("click", () => {
			for (let { input: e } of y) e.value = "";
			C(), y[0]?.input.focus();
		}), d.addEventListener("keydown", (t) => {
			if (t.key === "Escape") {
				t.preventDefault(), S();
				return;
			}
			if (t.key === "Enter" && (t.ctrlKey || t.metaKey)) {
				t.preventDefault(), O.click();
				return;
			}
			if (t.key !== "Tab") return;
			let n = j();
			if (!n.length) return;
			let r = n.indexOf(e.document.activeElement);
			t.shiftKey && r <= 0 ? (t.preventDefault(), n.at(-1).focus()) : !t.shiftKey && r === n.length - 1 && (t.preventDefault(), n[0].focus());
		}), d.addEventListener("click", (e) => {
			e.target === d && S("backdrop");
		}), y[0]?.input.focus();
	}
	function O() {
		let n = e.document?.getElementById?.(t), r = n?.querySelector?.("#promptLibraryList");
		n && r && r.querySelectorAll(".prompt-item").forEach((t) => {
			let n = t.querySelector(".prompt-item-actions"), r = t.dataset.promptId;
			if (!n || !r || n.querySelector("[data-prompt-smart-insert]")) return;
			let i = l("button", "Akıllı doldur", "soft-btn prompt-smart-insert");
			i.type = "button", i.dataset.promptSmartInsert = r, i.setAttribute("aria-label", "Değişkenleri doldurarak kullan"), n.append(i), i.addEventListener("click", () => {
				let t = s()?.loadItems?.(e.localStorage).find((e) => e.id === r);
				t && D(t);
			});
		});
	}
	function k() {
		if (!e.document) return;
		let n = () => {
			O();
			let n = e.document.getElementById(t);
			if (n && e.MutationObserver) {
				let t = new e.MutationObserver(O);
				t.observe(n, {
					childList: !0,
					subtree: !0
				}), e.addEventListener?.("beforeunload", () => {
					S("unload"), t.disconnect();
				});
			}
		};
		e.document.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", n, { once: !0 }) : n();
	}
	e.HafizePromptLibrarySmartInsert = Object.freeze({
		PROFILE_KEY: n,
		limits: Object.freeze({
			MAX_PROFILES: 24,
			MAX_PROFILE_NAME: 60,
			MAX_VARIABLES: 12,
			MAX_VARIABLE: 32,
			MAX_VALUE: r,
			MAX_PREVIEW: i,
			MAX_IMPORT: a
		}),
		normalizeProfile: m,
		normalizeProfiles: h,
		loadProfiles: g,
		saveProfiles: _,
		exportProfiles: v,
		importProfilesText: y,
		mergeProfiles: b,
		variableNames: p,
		replace: (e, t) => s()?.replaceVariables?.(e, t) || String(e || ""),
		open: D,
		close: S
	}), k();
}
n(globalThis);
//#endregion
//#region public/typed/legacy/prompt-library-smart-insert-history.ts
function r(e) {
	let t = "hafize.prompt-library.smart-insert-history.v1", n = (e, t) => String(e ?? "").replace(/\0/g, "").trim().slice(0, t), r = () => (/* @__PURE__ */ new Date()).toISOString(), i = () => e.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	function a(e) {
		if (!e || typeof e != "object") return null;
		let t = n(e.promptId, 120);
		if (!t) return null;
		let a = n(e.usedAt, 40) || r();
		return Object.freeze({
			id: n(e.id, 120) || i(),
			promptId: t,
			label: n(e.label, 100) || "İsimsiz istem",
			usedAt: a,
			reason: n(e.reason, 100) || "insert"
		});
	}
	function o(e) {
		if (!Array.isArray(e)) return [];
		let t = [], n = /* @__PURE__ */ new Set();
		for (let r of e.slice(0, 120)) {
			let e = a(r);
			if (e && !n.has(e.id) && (n.add(e.id), t.push(e), t.length >= 40)) break;
		}
		return t.sort((e, t) => t.usedAt.localeCompare(e.usedAt));
	}
	function s() {
		try {
			return o(JSON.parse(e.localStorage?.getItem(t) || "[]"));
		} catch {
			return [];
		}
	}
	function c(n) {
		try {
			let r = o(n).slice(0, 40);
			return e.localStorage?.setItem(t, JSON.stringify(r)), e.dispatchEvent?.(new Event("hafize:prompt-library-smart-insert-history-changed")), !0;
		} catch {
			return !1;
		}
	}
	function l(e, t, i = "insert") {
		let o = n(e, 120);
		if (!o) return !1;
		let l = s(), u = a({
			promptId: o,
			label: t,
			reason: i,
			usedAt: r()
		});
		return u ? c([u, ...l.filter((e) => e.promptId !== o)]) : !1;
	}
	function u(e) {
		let t = n(e, 120);
		return c(s().filter((e) => e.promptId !== t));
	}
	function d() {
		return c([]);
	}
	function f(e = 8) {
		let t = Math.max(0, Math.min(40, Number(e) || 0));
		return s().slice(0, t);
	}
	function p(e) {
		let t = n(e, 120);
		return s().filter((e) => e.promptId === t).length;
	}
	function m(t, n, r) {
		if (!t || !n) return;
		n.replaceChildren();
		let i = f();
		if (i.length) for (let a of i) {
			let i = t.createElement("div");
			i.className = "prompt-smart-insert-history-row", i.setAttribute("role", "listitem"), i.dataset.promptId = a.promptId;
			let o = t.createElement("span");
			o.className = "prompt-smart-insert-history-label", o.textContent = a.label;
			let s = t.createElement("span");
			s.className = "prompt-smart-insert-history-date", s.textContent = new Intl.DateTimeFormat("tr-TR", {
				day: "2-digit",
				month: "short",
				hour: "2-digit",
				minute: "2-digit"
			}).format(new Date(a.usedAt));
			let c = t.createElement("button");
			c.type = "button", c.className = "mini-btn", c.textContent = "Tekrar aç", c.setAttribute("aria-label", `${a.label} istemini tekrar aç`), c.addEventListener("click", () => {
				let t = r?.(a.promptId);
				t && e.HafizePromptLibrarySmartInsert?.open?.(t);
			});
			let l = t.createElement("button");
			l.type = "button", l.className = "mini-btn", l.textContent = "Kaldır", l.setAttribute("aria-label", `${a.label} kullanım kaydını kaldır`), l.addEventListener("click", () => {
				u(a.promptId), m(t, n, r);
			}), i.append(o, s, c, l), n.append(i);
		}
		else {
			let e = t.createElement("div");
			e.className = "prompt-smart-insert-history-empty", e.textContent = "Henüz Smart Insert kullanımı yok.", n.append(e);
		}
	}
	function h(t = e.document) {
		let n = t?.getElementById?.("promptLibraryCard");
		if (!t || !n || t.getElementById("promptLibrarySmartInsertHistory")) return null;
		let r = t.createElement("section");
		r.id = "promptLibrarySmartInsertHistory", r.className = "prompt-smart-insert-history", r.setAttribute("aria-labelledby", "promptSmartInsertHistoryTitle");
		let i = t.createElement("div");
		i.className = "prompt-smart-insert-history-head";
		let a = t.createElement("strong");
		a.id = "promptSmartInsertHistoryTitle", a.textContent = "Son Smart Insert kullanımları";
		let o = t.createElement("button");
		o.type = "button", o.className = "mini-btn", o.textContent = "Temizle", o.setAttribute("aria-label", "Smart Insert kullanım geçmişini temizle"), i.append(a, o);
		let c = t.createElement("div");
		c.className = "prompt-smart-insert-history-list", c.setAttribute("role", "list");
		let u = t.createElement("div");
		u.className = "prompt-smart-insert-history-status", u.setAttribute("role", "status"), u.setAttribute("aria-live", "polite"), r.append(i, c, u), n.append(r);
		let p = (t) => e.HafizePromptLibrary?.loadItems?.(e.localStorage).find((e) => e.id === t), h = () => m(t, c, p);
		return o.addEventListener("click", () => {
			e.confirm?.("Smart Insert kullanım geçmişi temizlensin mi?") && (d() && (u.textContent = "Kullanım geçmişi temizlendi."), h());
		}), e.addEventListener?.("hafize:prompt-library-smart-insert-history-changed", h), h(), Object.freeze({
			record: l,
			loadHistory: s,
			recent: f,
			render: h,
			clear: d,
			destroy: () => {
				e.removeEventListener?.("hafize:prompt-library-smart-insert-history-changed", h), r.remove();
			}
		});
	}
	e.HafizePromptLibrarySmartInsertHistory = Object.freeze({
		HISTORY_KEY: t,
		limits: Object.freeze({
			MAX_ENTRIES: 40,
			MAX_ID: 120,
			MAX_LABEL: 100,
			MAX_REASON: 100
		}),
		normalizeEntry: a,
		normalizeHistory: o,
		loadHistory: s,
		saveHistory: c,
		record: l,
		remove: u,
		clear: d,
		recent: f,
		countFor: p,
		renderList: m,
		mount: h
	});
	let g = () => h();
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", g, { once: !0 }) : g();
}
r(globalThis);
//#endregion
//#region public/typed/legacy/prompt-library-smart-insert-history-bridge.ts
function i(e) {
	let t = null, n = !1;
	function r() {
		if (n || !e.document || !e.HafizePromptLibrarySmartInsertHistory) return;
		let r = e.document.getElementById("promptLibraryCard");
		r && (n = !0, r.addEventListener("click", (e) => {
			let n = e.target?.closest?.("[data-prompt-smart-insert]");
			if (!n) return;
			let r = n.closest(".prompt-item")?.querySelector(".prompt-item-header strong")?.textContent || "İsimsiz istem";
			t = {
				promptId: n.dataset.promptSmartInsert,
				label: String(r).slice(0, 100)
			};
		}), e.addEventListener?.("hafize:prompt-library-variable-dialog", (n) => {
			if (n.detail?.reason !== "insert" || !t) return;
			let r = t;
			t = null, e.HafizePromptLibrarySmartInsertHistory.record(r.promptId, r.label, "smart-insert");
		}), e.addEventListener?.("beforeunload", () => {
			t = null;
		}, { once: !0 }));
	}
	let i = () => {
		r(), n || e.setTimeout?.(r, 0);
	};
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", i, { once: !0 }) : i(), e.addEventListener?.("load", r, { once: !0 });
}
i(globalThis);
//#endregion
//#region public/typed/legacy/prompt-library-smart-insert-presets.ts
function a(e) {
	let t = "hafize.prompt-library.variable-presets.v1", n = 1e3, r = (e, t) => String(e ?? "").replace(/\0/g, "").trim().slice(0, t), i = () => e.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`, a = (e) => r(e, 60).toLocaleLowerCase("tr-TR");
	function o(e) {
		if (!e || typeof e != "object") return null;
		let t = r(e.name, 60);
		if (!t) return null;
		let a = Object.create(null), o = 0;
		for (let [t, i] of Object.entries(e.values && typeof e.values == "object" ? e.values : {})) {
			let e = String(t).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
			!e || o >= 12 || (a[e] = r(i, n), o += 1);
		}
		return {
			id: r(e.id, 120) || i(),
			name: t,
			values: a,
			favorite: e.favorite === !0,
			updatedAt: r(e.updatedAt, 40) || (/* @__PURE__ */ new Date()).toISOString()
		};
	}
	function s(e) {
		if (!Array.isArray(e)) return [];
		let t = [], n = /* @__PURE__ */ new Set();
		for (let r of e.slice(0, 64)) {
			let e = o(r);
			if (e && !n.has(e.id) && (n.add(e.id), t.push(e), t.length >= 32)) break;
		}
		return t;
	}
	function c() {
		try {
			return s(JSON.parse(e.localStorage?.getItem(t) || "[]"));
		} catch {
			return [];
		}
	}
	function l(n) {
		try {
			return e.localStorage?.setItem(t, JSON.stringify(s(n))), e.dispatchEvent?.(new Event("hafize:prompt-library-variable-presets-changed")), !0;
		} catch {
			return !1;
		}
	}
	function u(e, t, n = !1) {
		let s = r(e, 60);
		if (!s) return null;
		let u = c(), d = u.find((e) => a(e.name) === a(s)), f = o({
			id: d?.id || i(),
			name: s,
			values: t,
			favorite: d?.favorite || n,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		});
		return f && l(d ? u.map((e) => e.id === d.id ? f : e) : [f, ...u].slice(0, 32)) ? f : null;
	}
	function d(e) {
		let t = r(e, 120);
		return l(c().filter((e) => e.id !== t));
	}
	function f(e, t) {
		return l(c().map((n) => n.id === e ? o({
			...n,
			favorite: t === void 0 ? !n.favorite : t,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		}) : n));
	}
	function p(e, t) {
		let n = r(t, 80).toLocaleLowerCase("tr-TR");
		return !n || [e.name, ...Object.keys(e.values)].join(" ").toLocaleLowerCase("tr-TR").includes(n);
	}
	function m(e = "") {
		return c().filter((t) => p(t, e)).sort((e, t) => Number(t.favorite) - Number(e.favorite) || t.updatedAt.localeCompare(e.updatedAt));
	}
	function h(e, t) {
		let i = Array.isArray(t) ? t : Object.keys(e?.values || {}), a = Object.create(null);
		for (let t of i) a[t] = r(e?.values?.[t], n);
		return a;
	}
	function g(e, t) {
		return (Array.isArray(t) ? t : []).filter((t) => !r(e?.values?.[t], n));
	}
	function _() {
		return JSON.stringify({
			version: 1,
			source: "hafize-prompt-variable-presets",
			exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
			presets: c()
		}, null, 2);
	}
	function v(e) {
		let t = String(e || "");
		if (t.length > 3e5) throw Error("oversize");
		let n = JSON.parse(t), r = s(Array.isArray(n) ? n : n?.presets), u = c(), d = new Map(u.map((e) => [a(e.name), e])), f = u.slice();
		for (let e of r) {
			let t = d.get(a(e.name));
			if (t) {
				let n = f.findIndex((e) => e.id === t.id), r = o({
					...t,
					values: {
						...t.values,
						...e.values
					},
					favorite: t.favorite || e.favorite,
					updatedAt: (/* @__PURE__ */ new Date()).toISOString()
				});
				n >= 0 && f.splice(n, 1, r);
			} else if (f.length < 32) {
				let t = o({
					...e,
					id: i()
				});
				t && (f.push(t), d.set(a(t.name), t));
			}
		}
		if (!l(f)) throw Error("save");
		return r.length;
	}
	function y(e, t, n, r) {
		if (!e || !t) return null;
		let i = e.createElement("select");
		i.setAttribute("aria-label", "Değişken ön ayarı");
		let a = e.createElement("option");
		a.value = "", a.textContent = "Ön ayar seç", i.append(a);
		let o = m("");
		for (let t of o) {
			let n = e.createElement("option");
			n.value = t.id, n.textContent = t.favorite ? `★ ${t.name}` : t.name, i.append(n);
		}
		let s = e.createElement("button");
		return s.type = "button", s.className = "mini-btn", s.textContent = "Uygula", s.addEventListener("click", () => {
			let e = c().find((e) => e.id === i.value);
			e && r?.(h(e, n), e);
		}), t.append(i, s), {
			select: i,
			apply: s,
			refresh: () => {
				let t = i.value;
				i.replaceChildren(a);
				for (let t of m("")) {
					let n = e.createElement("option");
					n.value = t.id, n.textContent = t.favorite ? `★ ${t.name}` : t.name, i.append(n);
				}
				i.value = t;
			}
		};
	}
	e.HafizePromptLibrarySmartInsertPresets = Object.freeze({
		PRESET_KEY: t,
		limits: Object.freeze({
			MAX_PRESETS: 32,
			MAX_NAME: 60,
			MAX_VALUES: 12,
			MAX_KEY: 32,
			MAX_VALUE: n,
			MAX_QUERY: 80
		}),
		normalizePreset: o,
		normalizePresets: s,
		load: c,
		save: l,
		upsert: u,
		remove: d,
		favorite: f,
		matches: p,
		search: m,
		valuesForPreset: h,
		diffMissing: g,
		exportText: _,
		importText: v,
		renderPicker: y
	});
}
a(globalThis);
//#endregion
//#region public/typed/legacy/prompt-library-smart-insert-suggestions.ts
function o(e) {
	let t = (e) => String(e ?? "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
	function n(e) {
		let t = Object.create(null);
		for (let [n, r] of Object.entries(e?.values || {})) t[n] = String(r ?? "").slice(0, 1e3);
		return t;
	}
	function r(e, n) {
		if (!e || !n) return 0;
		let r = new Set((e.variables || []).map(t)), i = Object.keys(n.values || {}).map(t), a = 0;
		for (let e of i) r.has(e) && (a += 100);
		let o = t(e.title), s = t(n.name);
		return s && o.includes(s) && (a += 20), Math.min(1e3, a);
	}
	function i(e, t) {
		return e.map((e, n) => ({
			item: e,
			score: r(e, t),
			index: n
		})).filter((e) => e.score > 0).sort((e, t) => t.score - e.score || e.index - t.index).slice(0, 5).map((e) => e.item);
	}
	function a(t, n) {
		return i(Array.isArray(n) ? n : e.HafizePromptLibrary?.loadItems?.(e.localStorage) || [], t);
	}
	function o(e, t) {
		if (!e) return Object.create(null);
		let r = n(t), i = Object.create(null);
		for (let t of e.variables || []) i[t] = r[t] || "";
		return i;
	}
	function s(e, t) {
		return (e?.variables || []).some((e) => !String(t?.values?.[e] ?? "").trim());
	}
	function c(e, t, n, r, i) {
		if (!e || !t || !n) return;
		t.replaceChildren();
		let o = e.createElement("div");
		o.className = "prompt-smart-insert-suggestions-title", o.textContent = `${n.name} için önerilen istemler`, t.append(o);
		let c = e.createElement("div");
		c.className = "prompt-smart-insert-suggestions-list", c.setAttribute("role", "list");
		let l = a(n, r);
		if (l.length) l.forEach((t) => {
			let r = e.createElement("div");
			r.className = "prompt-smart-insert-suggestion-row", r.setAttribute("role", "listitem");
			let a = e.createElement("span");
			a.className = "prompt-smart-insert-suggestion-name", a.textContent = t.title || "İsimsiz istem";
			let o = e.createElement("span");
			o.className = "prompt-smart-insert-suggestion-status", o.textContent = s(t, n) ? "Eksik değer" : "Hazır";
			let l = e.createElement("button");
			l.type = "button", l.className = "mini-btn", l.textContent = "Akıllı doldur", l.setAttribute("aria-label", `${t.title || "İsimsiz istem"} için akıllı doldurmayı aç`), l.addEventListener("click", () => i?.(t)), r.append(a, o, l), c.append(r);
		});
		else {
			let t = e.createElement("div");
			t.className = "prompt-smart-insert-suggestions-empty", t.textContent = "Bu profil ile eşleşen değişkenli istem bulunamadı.", c.append(t);
		}
		t.append(c);
	}
	function l() {
		let t = e.document?.getElementById?.("promptLibrarySmartInsertCenter");
		if (!t || e.document.getElementById("promptLibrarySmartInsertSuggestions")) return null;
		let n = e.document.createElement("section");
		n.id = "promptLibrarySmartInsertSuggestions", n.className = "prompt-smart-insert-suggestions", n.setAttribute("aria-labelledby", "promptSmartInsertSuggestionsTitle");
		let r = e.document.createElement("strong");
		r.id = "promptSmartInsertSuggestionsTitle", r.textContent = "Profil önerileri";
		let i = e.document.createElement("div");
		i.className = "prompt-smart-insert-suggestions-host", n.append(r, i), t.append(n);
		let a = () => {
			let t = e.HafizePromptLibrarySmartInsertCenter?.loadProfiles?.() || [], n = t.find((e) => e.favorite) || t[0];
			c(e.document, i, n, null, (t) => e.HafizePromptLibrarySmartInsert?.open?.(t));
		};
		e.addEventListener?.("hafize:prompt-library-variable-profiles-changed", a);
		let o = () => e.removeEventListener?.("hafize:prompt-library-variable-profiles-changed", a);
		return e.addEventListener?.("beforeunload", o, { once: !0 }), a(), Object.freeze({
			render: a,
			destroy: () => {
				o(), n.remove();
			}
		});
	}
	e.HafizePromptLibrarySmartInsertSuggestions = Object.freeze({
		MAX_SUGGESTIONS: 5,
		normalize: t,
		variableMap: n,
		score: r,
		rank: i,
		recommend: a,
		fillValues: o,
		hasMissing: s,
		render: c,
		mount: l
	});
	let u = () => l();
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", u, { once: !0 }) : u();
}
o(globalThis);
//#endregion
//#region public/typed/legacy/prompt-library-smart-insert-activity.ts
function s(e) {
	let t = "hafize.prompt-library.smart-insert-history.v1", n = "promptLibrarySmartInsertActivity", r = (t, n, r) => {
		let i = e.document.createElement(t);
		return r && (i.className = r), n !== void 0 && (i.textContent = n), i;
	};
	function i() {
		try {
			let n = JSON.parse(e.localStorage?.getItem(t) || "[]");
			return Array.isArray(n) ? n.filter((e) => e && typeof e == "object" && typeof e.promptId == "string") : [];
		} catch {
			return [];
		}
	}
	function a(e) {
		let t = /* @__PURE__ */ new Map();
		for (let n of e) {
			let e = String(n.promptId || "").slice(0, 120);
			if (!e) continue;
			let r = t.get(e) || {
				promptId: e,
				label: String(n.label || "İsimsiz istem").slice(0, 100),
				count: 0,
				latest: ""
			};
			r.count += 1, (!r.latest || String(n.usedAt || "") > r.latest) && (r.latest = String(n.usedAt || "")), t.set(e, r);
		}
		return [...t.values()].sort((e, t) => t.count - e.count || t.latest.localeCompare(e.latest));
	}
	function o(e, t = 14) {
		let n = Math.max(1, Math.min(14, Number(t) || 14)), r = /* @__PURE__ */ new Date(), i = /* @__PURE__ */ new Map();
		for (let e = 0; e < n; e += 1) {
			let t = new Date(r);
			t.setHours(0, 0, 0, 0), t.setDate(r.getDate() - e);
			let n = t.toISOString().slice(0, 10);
			i.set(n, 0);
		}
		for (let t of e) {
			let e = new Date(String(t.usedAt || "")).toISOString?.().slice(0, 10);
			i.has(e) && i.set(e, i.get(e) + 1);
		}
		return [...i.entries()].sort(([e], [t]) => e.localeCompare(t));
	}
	function s(e = i()) {
		let t = a(e), n = o(e);
		return Object.freeze({
			totalEntries: e.length,
			uniquePrompts: t.length,
			topPrompt: t[0] || null,
			activeDays: n.filter(([, e]) => e > 0).length,
			daily: n
		});
	}
	function c(e = i()) {
		return JSON.stringify({
			version: 1,
			source: "hafize-prompt-smart-insert-activity",
			exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
			summary: s(e),
			usage: a(e).slice(0, 20)
		}, null, 2);
	}
	function l(t, n) {
		try {
			let i = new Blob([t], { type: "application/json;charset=utf-8" }), a = URL.createObjectURL(i), o = r("a");
			return o.href = a, o.download = n, o.click(), e.setTimeout?.(() => URL.revokeObjectURL(a), 0), !0;
		} catch {
			return !1;
		}
	}
	function u(t = e.document) {
		let u = t?.getElementById?.("promptLibraryCard");
		if (!t || !u || t.getElementById(n)) return null;
		let d = r("section", void 0, "prompt-smart-insert-activity");
		d.id = n, d.setAttribute("aria-labelledby", "promptSmartInsertActivityTitle");
		let f = r("div", void 0, "prompt-smart-insert-activity-head"), p = r("strong", "Smart Insert etkinliği");
		p.id = "promptSmartInsertActivityTitle";
		let m = r("button", "Özeti dışa aktar", "mini-btn");
		m.type = "button";
		let h = r("button", "Yenile", "mini-btn");
		h.type = "button", f.append(p, h, m);
		let g = r("div", void 0, "prompt-smart-insert-activity-stats"), _ = r("div", void 0, "prompt-smart-insert-activity-top"), v = r("div", void 0, "prompt-smart-insert-activity-daily");
		v.setAttribute("role", "list");
		let y = r("div", "", "prompt-smart-insert-activity-status");
		y.setAttribute("role", "status"), y.setAttribute("aria-live", "polite"), d.append(f, g, _, v, y), u.append(d);
		function b() {
			let e = s(i());
			g.replaceChildren();
			for (let [t, n] of [
				["Aktivite", e.totalEntries],
				["Farklı istem", e.uniquePrompts],
				["Aktif gün", e.activeDays]
			]) {
				let e = r("div", void 0, "prompt-smart-insert-activity-stat");
				e.append(r("strong", String(n)), r("span", t)), g.append(e);
			}
			_.replaceChildren(), e.topPrompt ? _.append(r("span", "En sık kullanılan", "prompt-smart-insert-activity-label"), r("strong", `${e.topPrompt.label} · ${e.topPrompt.count} kullanım`, "prompt-smart-insert-activity-value")) : _.append(r("span", "Henüz etkinlik yok.", "prompt-smart-insert-activity-label")), v.replaceChildren();
			for (let [t, n] of e.daily.slice(-7)) {
				let e = r("div", void 0, "prompt-smart-insert-activity-day");
				e.setAttribute("role", "listitem"), e.append(r("span", t), r("strong", String(n))), v.append(e);
			}
		}
		h.addEventListener("click", b), m.addEventListener("click", () => {
			y.textContent = l(c(), "hafize-smart-insert-activity.json") ? "Etkinlik özeti dışa aktarıldı." : "Etkinlik özeti oluşturulamadı.";
		});
		let x = () => b();
		return e.addEventListener?.("hafize:prompt-library-smart-insert-history-changed", x), b(), Object.freeze({
			summary: s,
			usageFor: a,
			dailyFor: o,
			exportDigest: c,
			render: b,
			destroy: () => {
				e.removeEventListener?.("hafize:prompt-library-smart-insert-history-changed", x), d.remove();
			}
		});
	}
	e.HafizePromptLibrarySmartInsertActivity = Object.freeze({
		HISTORY_KEY: t,
		MAX_DAYS: 14,
		MAX_ROWS: 7,
		usageFor: a,
		dailyFor: o,
		summary: s,
		exportDigest: c,
		mount: u
	});
	let d = () => u();
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", d, { once: !0 }) : d();
}
s(globalThis);
//#endregion
//#region public/typed/legacy/prompt-library-smart-insert-center.ts
function c(e) {
	let t = "promptLibrarySmartInsertCenter", n = "hafize.prompt-library.variable-profiles.v1", r = `${n}.center-state`, i = 1e3, a = Object.freeze([
		"recent",
		"name",
		"favorite"
	]), o = !1, s = (t, n, r) => {
		let i = e.document.createElement(t);
		return r && (i.className = r), n !== void 0 && (i.textContent = n), i;
	}, c = (e, t) => {
		let n = s("button", e, "mini-btn prompt-profile-center-action");
		return n.type = "button", n.dataset.profileCenterAction = t, n.setAttribute("aria-label", e), n;
	}, l = (e) => String(e ?? "").replace(/\0/g, "").trim().slice(0, 60), u = (e) => String(e ?? "").replace(/\0/g, "").slice(0, i), d = () => e.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`, f = (e) => String(e || "").toLocaleLowerCase("tr-TR");
	function p(e) {
		if (!e || typeof e != "object") return null;
		let t = l(e.name);
		if (!t) return null;
		let n = Object.create(null), r = 0;
		for (let [t, i] of Object.entries(e.values && typeof e.values == "object" ? e.values : {})) {
			let e = String(t).trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
			!e || r >= 12 || (n[e] = u(i), r += 1);
		}
		return {
			id: String(e.id || d()).slice(0, 120),
			name: t,
			values: n,
			favorite: e.favorite === !0,
			updatedAt: String(e.updatedAt || (/* @__PURE__ */ new Date()).toISOString()).slice(0, 40)
		};
	}
	function m(e) {
		if (!Array.isArray(e)) return [];
		let t = [], n = /* @__PURE__ */ new Set();
		for (let r of e.slice(0, 48)) {
			let e = p(r);
			if (e && !n.has(e.id) && (n.add(e.id), t.push(e), t.length >= 24)) break;
		}
		return t;
	}
	function h() {
		try {
			return m(JSON.parse(e.localStorage?.getItem(n) || "[]"));
		} catch {
			return [];
		}
	}
	function g(t) {
		try {
			return e.localStorage?.setItem(n, JSON.stringify(m(t))), e.dispatchEvent?.(new Event("hafize:prompt-library-variable-profiles-changed")), !0;
		} catch {
			return !1;
		}
	}
	function _() {
		try {
			let t = JSON.parse(e.localStorage?.getItem(r) || "{}");
			return {
				query: String(t.query || "").slice(0, 80),
				sort: a.includes(t.sort) ? t.sort : "recent"
			};
		} catch {
			return {
				query: "",
				sort: "recent"
			};
		}
	}
	function v(t) {
		try {
			e.localStorage?.setItem(r, JSON.stringify({
				query: String(t.query || "").slice(0, 80),
				sort: a.includes(t.sort) ? t.sort : "recent"
			}));
		} catch {}
	}
	function y(e, t) {
		if (!t.query) return !0;
		let n = t.query.toLocaleLowerCase("tr-TR");
		return [e.name, ...Object.keys(e.values)].join(" ").toLocaleLowerCase("tr-TR").includes(n);
	}
	function b(e, t) {
		let n = e.slice();
		return t === "name" ? n.sort((e, t) => e.name.localeCompare(t.name, "tr")) : n.sort((e, t) => Number(t.favorite) - Number(e.favorite) || t.updatedAt.localeCompare(e.updatedAt));
	}
	function x(n) {
		let r = e.document.querySelector(`#${t} .prompt-profile-center-status`);
		r && (r.textContent = String(n || "").slice(0, 180));
	}
	function S(t = "") {
		return l(e.prompt?.("Profil adı:", t) ?? "");
	}
	function C() {
		let e = h();
		if (e.length >= 24) return x("Profil sınırı dolu.");
		let t = S();
		if (!t) return;
		if (e.some((e) => f(e.name) === f(t))) return x("Bu isimde bir profil zaten var.");
		let n = p({
			name: t,
			values: {},
			favorite: !1,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		});
		n && g([n, ...e]) && x("Yeni profil oluşturuldu.");
	}
	function w(e) {
		let t = h();
		if (t.length >= 24) return x("Profil sınırı dolu.");
		let n = `${e.name} kopyası`, r = 2;
		for (; t.some((e) => f(e.name) === f(n));) n = `${e.name} kopyası ${r++}`;
		let i = p({
			...e,
			id: d(),
			name: n,
			favorite: !1,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		});
		if (!i || !g([i, ...t])) return x("Profil çoğaltılamadı.");
		x("Profil çoğaltıldı.");
	}
	function T(e) {
		let t = S(e.name);
		if (!t || f(t) === f(e.name)) return;
		let n = h();
		if (n.some((n) => n.id !== e.id && f(n.name) === f(t))) return x("Bu isimde bir profil zaten var.");
		if (!g(n.map((n) => n.id === e.id ? p({
			...n,
			name: t,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		}) : n))) return x("Profil yeniden adlandırılamadı.");
		x("Profil yeniden adlandırıldı.");
	}
	function E(e) {
		g(h().map((t) => t.id === e.id ? p({
			...t,
			favorite: !t.favorite,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		}) : t)) || x("Profil favorisi güncellenemedi.");
	}
	function D(t) {
		if (e.confirm?.(`“${t.name}” profili silinsin mi?`)) {
			if (!g(h().filter((e) => e.id !== t.id))) return x("Profil silinemedi.");
			x("Profil silindi.");
		}
	}
	function O(e) {
		if (!e) return;
		if (e.size > 3e5) return x("Profil yedeği 300 KB sınırını aşamaz.");
		let t = new FileReader();
		t.onload = () => {
			try {
				let e = JSON.parse(String(t.result || "")), n = m(Array.isArray(e) ? e : e?.profiles), r = h(), i = new Map(r.map((e) => [f(e.name), e])), a = r.slice();
				for (let e of n) {
					let t = i.get(f(e.name));
					if (t) {
						let n = a.findIndex((e) => e.id === t.id), r = p({
							...t,
							values: {
								...t.values,
								...e.values
							},
							favorite: t.favorite || e.favorite,
							updatedAt: (/* @__PURE__ */ new Date()).toISOString()
						});
						n >= 0 && a.splice(n, 1, r);
					} else if (a.length < 24) {
						let t = p({
							...e,
							id: d()
						});
						t && (a.push(t), i.set(f(t.name), t));
					}
				}
				if (!g(a)) return x("Profil yedeği kaydedilemedi.");
				x(`${n.length} profil işlendi.`);
			} catch {
				x("Geçersiz profil yedeği.");
			}
		}, t.onerror = () => x("Profil yedeği okunamadı."), t.readAsText(e);
	}
	function k() {
		try {
			let t = JSON.stringify({
				version: 2,
				source: "hafize-prompt-variable-profiles",
				exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
				profiles: h()
			}, null, 2), n = new Blob([t], { type: "application/json;charset=utf-8" }), r = URL.createObjectURL(n), i = s("a");
			i.href = r, i.download = "hafize-variable-profiles.json", i.click(), e.setTimeout?.(() => URL.revokeObjectURL(r), 0), x("Profil yedeği dışa aktarıldı.");
		} catch {
			x("Profil yedeği oluşturulamadı.");
		}
	}
	function A(n) {
		let r = n.target?.closest?.("[data-profile-center-action]");
		if (!r) return;
		let i = r.dataset.profileCenterAction, a = r.closest("[data-profile-id]")?.dataset.profileId, o = a ? h().find((e) => e.id === a) : null;
		if (i === "new") return C();
		if (i === "favorite" && o) return E(o);
		if (i === "duplicate" && o) return w(o);
		if (i === "rename" && o) return T(o);
		if (i === "delete" && o) return D(o);
		if (i === "import") return e.document.getElementById(t)?.querySelector("[data-profile-center-file]")?.click();
		if (i === "export") return k();
		if (i === "clear-search") {
			let e = _();
			e.query = "", v(e), M();
		}
	}
	function j(e) {
		let t = s("article", void 0, "prompt-profile-center-row");
		t.dataset.profileId = e.id, t.setAttribute("role", "listitem");
		let n = s("strong", e.name, "prompt-profile-center-name"), r = Object.keys(e.values), i = s("span", r.length ? `${r.length} değişken` : "Değişken değeri yok", "prompt-profile-center-meta"), a = s("div", void 0, "prompt-profile-center-row-actions");
		return a.append(c(e.favorite ? "★" : "☆", "favorite"), c("Çoğalt", "duplicate"), c("Adlandır", "rename"), c("Sil", "delete")), t.append(n, i, a), t;
	}
	function M() {
		let n = e.document.getElementById(t);
		if (!n) return;
		let r = _(), i = h(), a = b(i.filter((e) => y(e, r)), r.sort);
		n.replaceChildren();
		let o = s("div", void 0, "prompt-profile-center-head");
		o.append(s("strong", "Değişken profilleri", "prompt-profile-center-title"), s("span", `${a.length}/${i.length}`, "prompt-profile-center-count"));
		let l = s("div", void 0, "prompt-profile-center-toolbar"), u = e.document.createElement("input");
		u.type = "search", u.value = r.query, u.maxLength = 80, u.placeholder = "Profil ara…", u.dataset.profileCenterSearch = "true", u.setAttribute("aria-label", "Değişken profillerinde ara");
		let d = e.document.createElement("select");
		d.setAttribute("aria-label", "Profilleri sırala");
		for (let [e, t] of [
			["recent", "Son güncellenen"],
			["favorite", "Favoriler"],
			["name", "Ada göre"]
		]) {
			let n = s("option", t);
			n.value = e, d.append(n);
		}
		d.value = r.sort, l.append(u, d, c("＋ Yeni profil", "new"), c("İçe aktar", "import"), c("Dışa aktar", "export"));
		let f = s("div", void 0, "prompt-profile-center-list");
		f.setAttribute("role", "list"), a.length ? a.forEach((e) => f.append(j(e))) : f.append(s("div", "Kayıtlı değişken profili yok.", "prompt-profile-center-empty"));
		let p = e.document.createElement("input");
		p.type = "file", p.accept = "application/json,.json", p.hidden = !0, p.dataset.profileCenterFile = "true";
		let m = s("div", "", "prompt-profile-center-status");
		m.setAttribute("role", "status"), m.setAttribute("aria-live", "polite"), n.append(o, l, f, p, m), n.addEventListener("click", A), u.addEventListener("input", () => {
			let t = _();
			t.query = String(u.value).slice(0, 80), v(t), M(), e.requestAnimationFrame?.(() => e.document.querySelector("[data-profile-center-search]")?.focus());
		}), d.addEventListener("change", () => {
			let e = _();
			e.sort = d.value, v(e), M();
		}), p.addEventListener("change", () => {
			let e = p.files?.[0];
			p.value = "", O(e);
		});
	}
	function N() {
		if (o || !e.document) return;
		let n = e.document.getElementById("promptLibraryCard");
		if (!n) return;
		let r = s("section", void 0, "prompt-profile-center");
		r.id = t, r.setAttribute("aria-labelledby", "promptProfileCenterTitle"), n.append(r), o = !0, M(), e.addEventListener?.("hafize:prompt-library-variable-profiles-changed", M), e.addEventListener?.("beforeunload", () => e.removeEventListener?.("hafize:prompt-library-variable-profiles-changed", M), { once: !0 });
	}
	e.HafizePromptLibrarySmartInsertCenter = Object.freeze({
		PROFILE_KEY: n,
		STATE_KEY: r,
		limits: Object.freeze({
			MAX_PROFILES: 24,
			MAX_PROFILE_NAME: 60,
			MAX_VARIABLES: 12,
			MAX_VARIABLE: 32,
			MAX_VALUE: i,
			MAX_QUERY: 80
		}),
		normalizeProfile: p,
		normalizeProfiles: m,
		loadProfiles: h,
		saveProfiles: g,
		loadState: _,
		saveState: v,
		matches: y,
		sortProfiles: b,
		mount: N,
		render: M
	}), e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", N, { once: !0 }) : N();
}
c(globalThis);
//#endregion
//#region public/typed/legacy/prompt-library-smart-insert-shortcuts.ts
function l(e) {
	let t = (e) => {
		if (!e) return !1;
		let t = e.tagName?.toLowerCase?.();
		return t === "input" || t === "textarea" || e.isContentEditable === !0;
	};
	function n() {
		let t = e.document?.getElementById?.("promptLibrarySmartInsertCenter");
		if (!t) return !1;
		t.scrollIntoView?.({
			block: "nearest",
			behavior: "smooth"
		});
		let n = t.querySelector("[data-profile-center-search]");
		return n?.focus?.(), n?.select?.(), !0;
	}
	function r() {
		let t = e.document?.querySelector?.("#promptLibraryCard [data-prompt-smart-insert]");
		return t ? (t.click(), !0) : !1;
	}
	function i() {
		let t = e.document?.getElementById?.("promptLibrarySmartInsertHistory");
		if (!t) return !1;
		let n = t.querySelector(".prompt-smart-insert-history-list"), r = n?.hidden === !0;
		return n && (n.hidden = !r), !0;
	}
	function a(t) {
		let n = e.document?.querySelector?.("#promptLibraryCard .prompt-library-status");
		n && (n.textContent = String(t || "").slice(0, 180));
	}
	function o(e) {
		if (!(e.ctrlKey || e.metaKey) || e.altKey || !e.shiftKey || t(e.target)) return;
		let o = e.key.toLowerCase();
		o === "i" ? (e.preventDefault(), a(r() ? "Smart Insert açıldı." : "Açılacak değişkenli istem bulunamadı.")) : o === "l" ? (e.preventDefault(), a(n() ? "Değişken profilleri açıldı." : "Profil merkezi hazır değil.")) : o === "h" && (e.preventDefault(), a(i() ? "Smart Insert geçmişi değiştirildi." : "Smart Insert geçmişi hazır değil."));
	}
	function s() {
		e.document && !e.HafizePromptLibrarySmartInsertShortcuts && (e.document.addEventListener("keydown", o), e.HafizePromptLibrarySmartInsertShortcuts = Object.freeze({
			openCenter: n,
			openFirstSmartInsert: r,
			toggleHistory: i,
			isTyping: t,
			destroy: () => e.document.removeEventListener("keydown", o)
		}));
	}
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", s, { once: !0 }) : s();
}
l(globalThis);
//#endregion
//#region public/typed/legacy/prompt-library-bulk-organizer.ts
function u(e) {
	let t = "promptLibraryCard", n = () => e.HafizePromptLibrary, r = !1, i = null, a = (t, n, r) => {
		let i = e.document.createElement(t);
		return r && (i.className = r), n !== void 0 && (i.textContent = n), i;
	}, o = (e, t = "soft-btn") => {
		let n = a("button", e, t);
		return n.type = "button", n;
	}, s = (e) => String(e || "").trim().slice(0, 24).replace(/[,\r\n]/g, " "), c = (n) => {
		let r = e.document.querySelector(`#${t} .prompt-library-status`);
		r && (r.textContent = String(n || "").slice(0, 180));
	}, l = () => [...e.document.querySelectorAll(`#${t} [data-prompt-selection]:checked`)].map((e) => e.dataset.promptSelection).filter(Boolean).slice(0, 40);
	function u() {
		return n()?.loadItems?.(e.localStorage) || [];
	}
	function d(t) {
		let r = n();
		if (!r?.saveItems || !r.saveItems(e.localStorage, t)) return !1;
		try {
			e.dispatchEvent?.(new e.StorageEvent("storage", {
				key: "hafize.prompt-library.v1",
				newValue: JSON.stringify(t),
				storageArea: e.localStorage
			}));
		} catch {
			e.dispatchEvent?.(new e.Event("hafize:prompt-library-refresh"));
		}
		return !0;
	}
	function f(e) {
		let t = /* @__PURE__ */ new Set(), n = [];
		for (let r of e) {
			let e = s(r), i = e.toLocaleLowerCase("tr-TR");
			if (e && !t.has(i) && (t.add(i), n.push(e), n.length >= 8)) break;
		}
		return n;
	}
	function p() {
		i?.remove(), i = null;
	}
	function m(e) {
		let t = new Set(l()), r = i?.querySelector?.("[data-bulk-tags]"), a = f(String(r?.value || "").split(",")), o = i?.querySelector?.("[data-bulk-favorite]")?.value || "keep";
		if (!t.size) return c("Seçili istem yok.");
		if ((e === "add-tags" || e === "replace-tags") && !a.length) return c("En az bir etiket gir.");
		if (!d(u().map((r) => {
			if (!t.has(r.id)) return r;
			let i = e === "replace-tags" ? a : e === "remove-tags" ? r.tags.filter((e) => !a.some((t) => t.toLocaleLowerCase("tr-TR") === e.toLocaleLowerCase("tr-TR"))) : f([...r.tags, ...a]);
			return n().normalizeItem({
				...r,
				tags: i,
				favorite: o === "keep" ? r.favorite : o === "on",
				updatedAt: (/* @__PURE__ */ new Date()).toISOString()
			});
		}))) return c("Toplu değişiklik kaydedilemedi.");
		p(), c(`${t.size} istem güncellendi.`);
	}
	function h() {
		let t = e.document;
		i = a("div", void 0, "prompt-library-bulk-organizer"), i.id = "promptLibraryBulkOrganizer", i.setAttribute("role", "dialog"), i.setAttribute("aria-modal", "true"), i.setAttribute("aria-labelledby", "promptLibraryBulkTitle"), g(i, -1);
		let n = a("section", void 0, "prompt-library-bulk-panel"), r = a("div", void 0, "prompt-library-bulk-header"), s = a("h3", "Toplu düzenle");
		s.id = "promptLibraryBulkTitle";
		let c = o("Kapat", "mini-btn");
		r.append(s, c);
		let u = a("p", `${l().length} istem seçildi.`, "prompt-library-bulk-count"), d = a("label", "Etiketler"), f = a("input");
		f.type = "text", f.maxLength = 220, f.placeholder = "etiket1, etiket2", f.dataset.bulkTags = "true", f.setAttribute("aria-label", "Toplu etiketler"), d.htmlFor = "promptBulkTags", f.id = "promptBulkTags";
		let h = a("div", "Etiket ekle/çıkar için virgülle ayır. En fazla 8 etiket tutulur.", "prompt-library-bulk-help"), _ = a("label", "Favori durumu"), v = a("select");
		v.id = "promptBulkFavorite", v.setAttribute("aria-label", "Toplu favori durumu"), v.dataset.bulkFavorite = "true";
		for (let [e, t] of [
			["keep", "Mevcut durumu koru"],
			["on", "Favoriye al"],
			["off", "Favoriden çıkar"]
		]) {
			let n = a("option", t);
			n.value = e, v.append(n);
		}
		_.htmlFor = v.id;
		let y = a("div", void 0, "prompt-library-bulk-actions"), b = o("Etiket ekle"), x = o("Etiketleri değiştir"), S = o("Etiketleri çıkar"), C = o("Vazgeç");
		y.append(b, x, S, C), n.append(r, u, d, f, h, _, v, y), i.append(n), t.body.append(i), c.addEventListener("click", p), C.addEventListener("click", p), b.addEventListener("click", () => m("add-tags")), x.addEventListener("click", () => m("replace-tags")), S.addEventListener("click", () => m("remove-tags")), i.addEventListener("keydown", (e) => {
			e.key === "Escape" && (e.preventDefault(), p());
		}), e.setTimeout?.(() => f.focus(), 0);
	}
	function g(e, t) {
		e.tabIndex = t;
	}
	function _() {
		let n = e.document.querySelector(`#${t} .prompt-library-enhancement-toolbar`);
		if (!n || n.querySelector("[data-bulk-organizer]")) return;
		let r = o("Toplu düzenle");
		r.dataset.bulkOrganizer = "true", r.setAttribute("aria-label", "Seçili istemleri toplu düzenle"), r.addEventListener("click", () => {
			if (!l().length) return c("Önce istem seç.");
			p(), h();
		}), n.append(r);
	}
	function v() {
		let n = e.document.getElementById(t);
		if (!n) return null;
		let r = typeof e.MutationObserver == "function" ? new e.MutationObserver(_) : null;
		return r?.observe(n, {
			childList: !0,
			subtree: !0
		}), _(), r;
	}
	function y() {
		if (r || !e.document || !n() || !e.document.getElementById(t)) return null;
		r = !0;
		let i = v();
		return Object.freeze({
			open: h,
			close: p,
			normalizeTags: f,
			apply: m,
			destroy: () => {
				i?.disconnect?.(), p(), r = !1;
			}
		});
	}
	e.HafizePromptLibraryBulkOrganizer = Object.freeze({
		mount: y,
		normalizeTags: f,
		LIMITS: Object.freeze({
			MAX_SELECTION: 40,
			MAX_TAGS: 8,
			MAX_TAG: 24
		})
	});
	let b = () => y();
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", b, { once: !0 }) : b();
}
//#endregion
//#region public/typed/legacy/scheduled-task-export.ts
u(globalThis), (function(e) {
	let t = "hafize.prompt-library.collections.v1", n = "promptLibraryCollections", r = (e, t, n = "") => {
		let r = e.createElement("span");
		return n && (r.className = n), r.textContent = String(t ?? ""), r;
	}, i = (e, t, n = "mini-btn") => {
		let r = e.createElement("button");
		return r.type = "button", r.className = n, r.textContent = t, r;
	}, a = () => e.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`, o = () => (/* @__PURE__ */ new Date()).toISOString(), s = (e, t) => typeof e == "string" ? e.trim().slice(0, t) : "";
	function c(e) {
		if (!e || typeof e != "object") return null;
		let t = s(e.name, 80);
		if (!t) return null;
		let n = Array.isArray(e.promptIds) ? [...new Set(e.promptIds.filter((e) => typeof e == "string").map((e) => e.slice(0, 120)))].slice(0, 120) : [], r = s(e.createdAt, 40) || o(), i = s(e.updatedAt, 40) || r;
		return {
			id: s(e.id, 120) || a(),
			name: t,
			description: s(e.description, 240),
			color: s(e.color, 32) || "default",
			promptIds: n,
			createdAt: r,
			updatedAt: i
		};
	}
	function l(e) {
		if (!Array.isArray(e)) return [];
		let t = [], n = /* @__PURE__ */ new Set();
		for (let r of e.slice(0, 80)) {
			let e = c(r);
			if (e && !n.has(e.id) && (n.add(e.id), t.push(e), t.length >= 40)) break;
		}
		return t;
	}
	function u(n = e.localStorage) {
		try {
			let e = n?.getItem?.(t);
			return l(e ? JSON.parse(e) : []);
		} catch {
			return [];
		}
	}
	function d(e, n) {
		try {
			return e?.setItem?.(t, JSON.stringify(l(n))), !0;
		} catch {
			return !1;
		}
	}
	function f(t = e.localStorage) {
		try {
			let e = t?.getItem?.("hafize.prompt-library.v1"), n = e ? JSON.parse(e) : [];
			return new Set(Array.isArray(n) ? n.filter((e) => e && typeof e.id == "string").map((e) => e.id) : []);
		} catch {
			return /* @__PURE__ */ new Set();
		}
	}
	function p(e, t) {
		let n = f(t);
		return l(e).map((e) => c({
			...e,
			promptIds: e.promptIds.filter((e) => n.has(e))
		}));
	}
	function m(t, n = e.localStorage) {
		let r = p(u(n), n);
		if (r.length >= 40) return null;
		let i = c({
			...t,
			id: a(),
			createdAt: o(),
			updatedAt: o()
		});
		if (!i) return null;
		let s = i.name.toLocaleLowerCase("tr-TR");
		return r.some((e) => e.name.toLocaleLowerCase("tr-TR") === s) ? null : (r.unshift(i), d(n, r) ? i : null);
	}
	function h(t, n, r = e.localStorage) {
		let i = p(u(r), r), a = i.findIndex((e) => e.id === t);
		if (a < 0) return null;
		let s = i[a], l = c({
			...s,
			...n,
			id: s.id,
			updatedAt: o()
		});
		if (!l) return null;
		let f = l.name.toLocaleLowerCase("tr-TR");
		return i.some((e, t) => t !== a && e.name.toLocaleLowerCase("tr-TR") === f) ? null : (i.splice(a, 1, l), d(r, i) ? l : null);
	}
	function g(t, n = e.localStorage) {
		let r = p(u(n), n), i = r.filter((e) => e.id !== t);
		return i.length !== r.length && d(n, i);
	}
	function _(t, n, r = e.localStorage) {
		let i = p(u(r), r), a = i.findIndex((e) => e.id === t);
		if (a < 0) return null;
		let s = f(r), l = [...new Set(Array.isArray(n) ? n : [])].filter((e) => typeof e == "string" && s.has(e)).slice(0, 120), m = c({
			...i[a],
			promptIds: l,
			updatedAt: o()
		});
		return i.splice(a, 1, m), d(r, i) ? m : null;
	}
	function v(t, n, r = e.localStorage) {
		let i = p(u(r), r).find((e) => e.id === t);
		return i ? _(t, [...i.promptIds, ...Array.isArray(n) ? n : []], r) : null;
	}
	function y(t, n, r = e.localStorage) {
		let i = u(r).find((e) => e.id === t);
		if (!i) return null;
		let a = new Set(Array.isArray(n) ? n : []);
		return _(t, i.promptIds.filter((e) => !a.has(e)), r);
	}
	function b(e, t) {
		if (!t) return !0;
		let n = t.toLocaleLowerCase("tr-TR");
		return [e.name, e.description].join("\n").toLocaleLowerCase("tr-TR").includes(n);
	}
	function x(t = e.localStorage) {
		let n = p(u(t), t);
		return JSON.stringify({
			version: 1,
			source: "hafize-prompt-library-collections",
			exportedAt: o(),
			collections: n
		}, null, 2);
	}
	function S(t, n = e.localStorage) {
		if (!t || typeof t != "object") return {
			imported: 0,
			skipped: 0
		};
		let r = l(t.collections), i = p(u(n), n), s = new Set(i.map((e) => e.name.toLocaleLowerCase("tr-TR"))), f = 0, m = 0;
		for (let e of r) {
			if (i.length >= 40 || s.has(e.name.toLocaleLowerCase("tr-TR"))) {
				m += 1;
				continue;
			}
			let t = c({
				...e,
				id: a(),
				createdAt: o(),
				updatedAt: o()
			});
			i.push(t), s.add(t.name.toLocaleLowerCase("tr-TR")), f += 1;
		}
		return d(n, i), {
			imported: f,
			skipped: m
		};
	}
	function C() {
		try {
			e.dispatchEvent?.(new e.CustomEvent("hafize:prompt-library-collections-changed"));
		} catch {}
	}
	function w(e) {
		return [...e.querySelectorAll("#promptLibraryList .prompt-item[data-prompt-id]")];
	}
	function T(t = e.document, a = e) {
		let o = t?.getElementById?.("promptLibraryCard");
		if (!t || !o || t.getElementById(n)) return null;
		let c = t.createElement("section");
		c.id = n, c.className = "prompt-library-collections", c.setAttribute("aria-labelledby", "promptLibraryCollectionsTitle");
		let l = t.createElement("div");
		l.className = "prompt-library-collections-head";
		let d = t.createElement("strong");
		d.id = "promptLibraryCollectionsTitle", d.textContent = "Koleksiyonlar";
		let f = r(t, "", "prompt-library-collections-status"), p = i(t, "Gizle");
		p.setAttribute("aria-expanded", "true"), l.append(d, f, p);
		let _ = t.createElement("div");
		_.className = "prompt-library-collections-body";
		let T = t.createElement("input");
		T.type = "search", T.maxLength = 100, T.placeholder = "Koleksiyon ara…", T.setAttribute("aria-label", "Koleksiyonlarda ara");
		let E = i(t, "＋ Koleksiyon"), D = i(t, "Dışa aktar"), O = i(t, "İçe aktar"), k = t.createElement("div");
		k.className = "prompt-library-collections-toolbar", k.append(T, E, D, O);
		let A = t.createElement("div");
		A.className = "prompt-library-collections-list", A.setAttribute("role", "list");
		let j = t.createElement("div");
		j.className = "prompt-library-collections-assignment", j.hidden = !0;
		let M = r(t, "Seçili istemleri koleksiyona ekle", "prompt-library-collections-assignment-title"), N = t.createElement("select");
		N.setAttribute("aria-label", "Hedef koleksiyon");
		let P = i(t, "Ekle"), F = i(t, "Çıkar");
		j.append(M, N, P, F), _.append(k, A, j), c.append(l, _), o.append(c);
		let I = !1, L = "", R = [], z = null;
		function B(e) {
			f.textContent = s(e, 160), a.setTimeout?.(() => {
				f.textContent === e && (f.textContent = "");
			}, 2600);
		}
		function V() {
			return [...o.querySelectorAll("[data-prompt-selection]:checked")].map((e) => e.dataset.promptSelection).filter(Boolean).slice(0, 40);
		}
		function H() {
			R = V(), j.hidden = !R.length, N.replaceChildren();
			for (let e of u()) {
				let n = t.createElement("option");
				n.value = e.id, n.textContent = e.name, N.append(n);
			}
		}
		function U() {
			let e = s(T.value, 100), n = u().filter((t) => b(t, e));
			if (A.replaceChildren(), !n.length) A.append(r(t, e ? "Eşleşen koleksiyon yok." : "Henüz koleksiyon yok.", "prompt-library-collections-empty")), H();
			else {
				for (let e of n) {
					let n = t.createElement("article");
					n.className = `prompt-library-collection-row${L === e.id ? " is-active" : ""}`, n.dataset.collectionId = e.id, n.setAttribute("role", "listitem");
					let o = t.createElement("div");
					o.className = "prompt-library-collection-info", o.append(r(t, e.name, "prompt-library-collection-name")), e.description && o.append(r(t, e.description, "prompt-library-collection-description")), o.append(r(t, `${e.promptIds.length} istem`, "prompt-library-collection-count"));
					let s = t.createElement("div");
					s.className = "prompt-library-collection-actions";
					let c = i(t, L === e.id ? "Filtreyi kaldır" : "Filtrele"), l = i(t, "Düzenle"), u = i(t, "Sil");
					s.append(c, l, u), n.append(o, s), A.append(n), c.addEventListener("click", () => {
						L = L === e.id ? "" : e.id;
						let n = w(t);
						for (let t of n) t.hidden = !!L && !e.promptIds.includes(t.dataset.promptId);
						U(), B(L ? `“${e.name}” filtresi etkin.` : "Koleksiyon filtresi kaldırıldı.");
					}), l.addEventListener("click", () => {
						let t = a.prompt?.("Koleksiyon adı:", e.name);
						if (t == null) return;
						let n = a.prompt?.("Açıklama:", e.description || "");
						if (n != null) {
							if (!h(e.id, {
								name: t,
								description: n
							})) return B("Koleksiyon güncellenemedi.");
							C(), U(), B("Koleksiyon güncellendi.");
						}
					}), u.addEventListener("click", () => {
						if (a.confirm?.(`“${e.name}” silinsin mi?`)) {
							if (!g(e.id)) return B("Koleksiyon silinemedi.");
							L === e.id && (L = ""), C(), U(), B("Koleksiyon silindi.");
						}
					});
				}
				H();
			}
		}
		E.addEventListener("click", () => {
			let e = a.prompt?.("Koleksiyon adı:", "Yeni koleksiyon");
			if (e == null) return;
			let t = a.prompt?.("Açıklama:", "");
			if (t != null) {
				if (!m({
					name: e,
					description: t
				})) return B("Koleksiyon oluşturulamadı. Ad benzersiz ve gerekli.");
				C(), U(), B("Koleksiyon oluşturuldu.");
			}
		}), P.addEventListener("click", () => {
			if (N.value && R.length) {
				if (!v(N.value, R)) return B("İstemler eklenemedi.");
				C(), U(), B(`${R.length} istem koleksiyona eklendi.`);
			}
		}), F.addEventListener("click", () => {
			if (N.value && R.length) {
				if (!y(N.value, R)) return B("İstemler çıkarılamadı.");
				C(), U(), B(`${R.length} istem koleksiyondan çıkarıldı.`);
			}
		}), T.addEventListener("input", U), D.addEventListener("click", () => {
			let e = new Blob([x(a.localStorage)], { type: "application/json;charset=utf-8" }), n = URL.createObjectURL(e), r = t.createElement("a");
			r.href = n, r.download = "hafize-prompt-collections.json", r.click(), a.setTimeout?.(() => URL.revokeObjectURL(n), 0), B("Koleksiyonlar dışa aktarıldı.");
		}), O.addEventListener("click", () => {
			z ||= t.createElement("input"), z.type = "file", z.accept = "application/json,.json", z.onchange = async () => {
				let e = z.files?.[0];
				if (!e || e.size > 5e5) return B("Koleksiyon yedeği 500 KB sınırını aşamaz.");
				try {
					let t = S(JSON.parse(await e.text()), a.localStorage);
					C(), U(), B(`${t.imported} koleksiyon içe aktarıldı.`);
				} catch {
					B("Geçersiz koleksiyon yedeği.");
				}
				z.value = "";
			}, z.click();
		}), p.addEventListener("click", () => {
			I = !I, _.hidden = I, p.textContent = I ? "Göster" : "Gizle", p.setAttribute("aria-expanded", String(!I));
		});
		let W = () => H(), G = () => U(), K = typeof MutationObserver == "function" ? new MutationObserver(W) : null;
		return K?.observe(o, {
			childList: !0,
			subtree: !0
		}), a.addEventListener?.("hafize:prompt-library-collections-changed", G), U(), Object.freeze({
			mounted: !0,
			refresh: U,
			getCollections: () => u(a.localStorage),
			destroy: () => {
				K?.disconnect(), a.removeEventListener?.("hafize:prompt-library-collections-changed", G), c.remove();
			}
		});
	}
	e.HafizePromptLibraryCollections = Object.freeze({
		STORAGE_KEY: t,
		MAX_COLLECTIONS: 40,
		MAX_MEMBERS: 120,
		normalizeCollection: c,
		normalizeCollections: l,
		readCollections: u,
		saveCollections: d,
		pruneMembers: p,
		createCollection: m,
		updateCollection: h,
		deleteCollection: g,
		setMembership: _,
		addMembers: v,
		removeMembers: y,
		exportPayload: x,
		importPayload: S,
		mount: T
	});
	let E = () => T(e.document, e);
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", E, { once: !0 }) : E();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "#promptLibraryCollections", n = !1, r = null, i = [], a = () => e.HafizePromptLibraryCollections, o = () => e.localStorage, s = () => e.document, c = () => a()?.readCollections?.(o()) || [], l = () => [...s()?.querySelectorAll?.("#promptLibraryList [data-prompt-selection]:checked") || []].map((e) => e.dataset.promptSelection).filter(Boolean).slice(0, 40), u = (n) => {
		let r = s()?.querySelector?.(`${t} .prompt-library-collections-status`);
		r && (r.textContent = String(n ?? "").slice(0, 160), e.setTimeout?.(() => {
			r.textContent === String(n ?? "").slice(0, 160) && (r.textContent = "");
		}, 2600));
	}, d = (e, t, n = "mini-btn") => {
		let r = s().createElement("button");
		return r.type = "button", r.className = n, r.textContent = e, r.dataset.promptCollectionAction = t, r.setAttribute("aria-label", e), r;
	};
	function f() {
		try {
			e.dispatchEvent?.(new e.CustomEvent("hafize:prompt-library-collections-changed", { detail: { key: "hafize.prompt-library.collections.v1" } }));
		} catch {}
	}
	function p() {
		s()?.querySelectorAll?.("#promptLibraryList [data-prompt-selection]").forEach((e) => {
			e.checked = !1;
		}), _();
	}
	function m() {
		let t = l();
		if (!t.length) return u("Önce istem seç.");
		let n = e.prompt?.("Koleksiyon adı:", "Seçili istemler");
		if (n == null) return;
		let r = a()?.createCollection?.({
			name: n,
			description: `${t.length} seçili istem`
		}, o());
		if (!r) return u("Koleksiyon oluşturulamadı.");
		a()?.setMembership?.(r.id, t, o()), f(), p(), u("Seçili istemlerden koleksiyon oluşturuldu.");
	}
	function h(e) {
		if (c().length >= (a()?.MAX_COLLECTIONS || 40)) return u("Koleksiyon sınırı dolu.");
		let t = a()?.createCollection?.({
			name: `${e.name} kopyası`,
			description: e.description,
			color: e.color,
			promptIds: e.promptIds
		}, o());
		if (!t) return u("Koleksiyon çoğaltılamadı.");
		a()?.setMembership?.(t.id, e.promptIds, o()), f(), u("Koleksiyon çoğaltıldı.");
	}
	function g(e) {
		let t = e.target?.closest?.("[data-prompt-collection-action]");
		if (!t) return;
		let n = t.dataset.promptCollectionAction, r = t.closest("[data-collection-id]"), i = r ? c().find((e) => e.id === r.dataset.collectionId) : null;
		if (n === "create-from-selection") return m();
		if (n === "clear-selection") return p();
		if (n === "duplicate" && i) return h(i);
		if (n === "select-all") {
			let e = [...s().querySelectorAll("#promptLibraryList .prompt-item [data-prompt-selection]")].slice(0, 40);
			return e.forEach((e) => {
				e.checked = !0;
			}), _(), u(`${e.length} istem seçildi.`);
		}
	}
	function _() {
		let e = s()?.querySelector?.(t);
		if (!e) return;
		let n = e.querySelector(".prompt-library-collections-enhancement-toolbar");
		n || (n = s().createElement("div"), n.className = "prompt-library-collections-enhancement-toolbar", e.querySelector(".prompt-library-collections-body")?.prepend(n), n.addEventListener("click", g), i.push(() => n.removeEventListener("click", g))), n.replaceChildren(d("Seçilenlerden koleksiyon", "create-from-selection"), d("Tümünü seç", "select-all"), d("Seçimi kaldır", "clear-selection")), e.querySelectorAll("[data-collection-id]").forEach((e) => {
			let t = e.querySelector(".prompt-library-collection-actions");
			t && !t.querySelector("[data-prompt-collection-action=\"duplicate\"]") && t.append(d("Çoğalt", "duplicate"));
		});
	}
	function v() {
		if (n || !a() || !s()) return;
		let o = s().querySelector(t);
		o && (n = !0, r = typeof MutationObserver == "function" ? new MutationObserver(() => _()) : null, r?.observe(o, {
			childList: !0,
			subtree: !0
		}), e.addEventListener?.("hafize:prompt-library-collections-changed", _), i.push(() => e.removeEventListener?.("hafize:prompt-library-collections-changed", _)), e.addEventListener?.("keydown", y), i.push(() => e.removeEventListener?.("keydown", y)), _());
	}
	function y(e) {
		(e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "l" && ((s()?.activeElement)?.matches?.("input,textarea,select,[contenteditable=\"true\"]") || (e.preventDefault(), s()?.querySelector?.(`${t} input[type="search"]`)?.focus?.()));
	}
	s()?.readyState === "loading" ? s().addEventListener("DOMContentLoaded", v, { once: !0 }) : v(), e.addEventListener?.("beforeunload", () => {
		r?.disconnect?.();
		for (let e of i.splice(0)) e();
	});
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "hafize.prompt-library.v1", n = "hafize.prompt-library.revisions.v1", r = "promptLibraryRevisions", i = (e) => JSON.parse(JSON.stringify(e)), a = () => (/* @__PURE__ */ new Date()).toISOString(), o = (e, t) => typeof e == "string" ? e.trim().slice(0, t) : "", s = () => e.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	function c(n = e.localStorage) {
		try {
			let e = n?.getItem?.(t), r = e ? JSON.parse(e) : [];
			return Array.isArray(r) ? r.filter((e) => e && typeof e == "object" && typeof e.id == "string") : [];
		} catch {
			return [];
		}
	}
	function l(e) {
		if (!e || typeof e != "object" || typeof e.id != "string") return null;
		let t = typeof e.body == "string" ? e.body.slice(0, 8e3).replace(/\0/g, "") : "";
		if (!t) return null;
		let n = Array.isArray(e.tags) ? [...new Set(e.tags.filter((e) => typeof e == "string").map((e) => o(e, 24)).filter(Boolean))].slice(0, 8) : [];
		return Object.freeze({
			id: o(e.id, 120),
			title: o(e.title, 100) || "İsimsiz istem",
			body: t,
			tags: n,
			favorite: e.favorite === !0,
			useCount: Number.isFinite(e.useCount) && e.useCount >= 0 ? Math.min(9999, Math.floor(e.useCount)) : 0,
			createdAt: o(e.createdAt, 40) || a(),
			updatedAt: o(e.updatedAt, 40) || a()
		});
	}
	function u(e) {
		if (!e || typeof e != "object") return null;
		let t = l(e.snapshot);
		return t ? {
			id: o(e.id, 120) || s(),
			promptId: o(e.promptId, 120) || t.id,
			createdAt: o(e.createdAt, 40) || a(),
			reason: o(e.reason, 160),
			snapshot: t
		} : null;
	}
	function d(t = e.localStorage) {
		try {
			let e = t?.getItem?.(n), r = e ? JSON.parse(e) : [];
			return Array.isArray(r) ? r.map(u).filter(Boolean).slice(0, 600) : [];
		} catch {
			return [];
		}
	}
	function f(e, t) {
		try {
			return e?.setItem?.(n, JSON.stringify(t.slice(0, 600))), !0;
		} catch {
			return !1;
		}
	}
	function p(t, n = e.localStorage) {
		return d(n).filter((e) => e.promptId === t).sort((e, t) => t.createdAt.localeCompare(e.createdAt));
	}
	function m(e, t) {
		return !e || !t ? !1 : e.title === t.title && e.body === t.body && JSON.stringify(e.tags || []) === JSON.stringify(t.tags || []) && e.favorite === t.favorite;
	}
	function h(t, n = "edit", r = e.localStorage) {
		let o = l(t);
		if (!o) return !1;
		let s = d(r), c = p(o.id, r)[0];
		if (c && m(c.snapshot, o)) return !1;
		let h = u({
			promptId: o.id,
			snapshot: i(o),
			reason: n,
			createdAt: a()
		});
		if (!h) return !1;
		let g = s.filter((e) => e.promptId === o.id).slice(0, 19), _ = s.filter((e) => e.promptId !== o.id);
		return f(r, [
			h,
			...g,
			..._
		].slice(0, 600));
	}
	function g(t, n = e.localStorage) {
		let r = d(n), i = r.filter((e) => e.promptId !== t);
		return i.length === r.length || f(n, i);
	}
	function _(t = e.localStorage) {
		let n = new Set(c(t).map((e) => e.id)), r = d(t), i = r.filter((e) => n.has(e.promptId));
		return i.length === r.length || f(t, i);
	}
	function v(n, r, i = e.localStorage) {
		let o = d(i).find((e) => e.promptId === n && e.id === r);
		if (!o) return null;
		let s = c(i), l = s.findIndex((e) => e.id === n);
		if (l < 0) return null;
		let u = s[l];
		h(u, "before-restore", i);
		let f = {
			...o.snapshot,
			id: n,
			createdAt: u.createdAt,
			updatedAt: a(),
			useCount: u.useCount
		};
		s.splice(l, 1, f);
		try {
			i?.setItem?.(t, JSON.stringify(s));
		} catch {
			return null;
		}
		return h(f, "restore", i), f;
	}
	function y(t, n = e.localStorage) {
		let r = p(t, n);
		return JSON.stringify({
			version: 1,
			source: "hafize-prompt-library-revisions",
			exportedAt: a(),
			promptId: t,
			revisions: r
		}, null, 2);
	}
	function b(e) {
		return {
			id: e.id,
			promptId: e.promptId,
			createdAt: e.createdAt,
			reason: e.reason,
			title: e.snapshot.title,
			preview: e.snapshot.body.replace(/\s+/g, " ").slice(0, 140)
		};
	}
	let x = (e, t, n = "") => {
		let r = e.createElement("span");
		return n && (r.className = n), r.textContent = String(t ?? ""), r;
	}, S = (e, t, n = "mini-btn") => {
		let r = e.createElement("button");
		return r.type = "button", r.className = n, r.textContent = t, r;
	};
	function C(i = e.document, a = e) {
		let s = i?.getElementById?.("promptLibraryCard");
		if (!i || !s || i.getElementById(r)) return null;
		let l = i.createElement("section");
		l.id = r, l.className = "prompt-library-revisions", l.setAttribute("aria-labelledby", "promptLibraryRevisionsTitle");
		let u = i.createElement("div");
		u.className = "prompt-library-revisions-head";
		let d = i.createElement("strong");
		d.id = "promptLibraryRevisionsTitle", d.textContent = "Sürüm geçmişi";
		let f = x(i, "", "prompt-library-revisions-status"), b = S(i, "Gizle");
		b.setAttribute("aria-expanded", "true"), u.append(d, f, b);
		let C = i.createElement("div");
		C.className = "prompt-library-revisions-body";
		let w = i.createElement("select");
		w.setAttribute("aria-label", "Sürüm geçmişi için istem seç");
		let T = S(i, "Yenile"), E = i.createElement("div");
		E.className = "prompt-library-revisions-toolbar", E.append(w, T);
		let D = i.createElement("div");
		D.className = "prompt-library-revisions-list", D.setAttribute("role", "list"), C.append(E, D), l.append(u, C), s.append(l);
		let O = "", k = !1;
		function A(e) {
			f.textContent = o(e, 160), a.setTimeout?.(() => {
				f.textContent === e && (f.textContent = "");
			}, 2600);
		}
		function j() {
			let e = c(a.localStorage), t = O;
			w.replaceChildren();
			for (let t of e) {
				let e = i.createElement("option");
				e.value = t.id, e.textContent = o(t.title, 100) || "İsimsiz istem", w.append(e);
			}
			O = e.some((e) => e.id === t) ? t : e[0]?.id || "", O && (w.value = O);
		}
		function M() {
			if (_(a.localStorage), j(), O = w.value || "", D.replaceChildren(), !O) {
				D.append(x(i, "Sürüm geçmişi için kayıtlı istem yok.", "prompt-library-revisions-empty"));
				return;
			}
			let e = p(O, a.localStorage);
			if (!e.length) D.append(x(i, "Bu istem için henüz sürüm geçmişi yok.", "prompt-library-revisions-empty"));
			else for (let t of e) {
				let e = i.createElement("article");
				e.className = "prompt-library-revision-row", e.dataset.revisionId = t.id, e.setAttribute("role", "listitem");
				let n = x(i, `${new Intl.DateTimeFormat("tr-TR", {
					dateStyle: "medium",
					timeStyle: "short"
				}).format(new Date(t.createdAt))} · ${t.reason || "değişiklik"}`, "prompt-library-revision-meta"), r = x(i, t.snapshot.title, "prompt-library-revision-title"), o = x(i, t.snapshot.body.replace(/\s+/g, " ").slice(0, 140), "prompt-library-revision-preview"), s = i.createElement("div");
				s.className = "prompt-library-revision-actions";
				let c = S(i, "Geri yükle"), l = S(i, "JSON");
				s.append(c, l), e.append(n, r, o, s), D.append(e), c.addEventListener("click", () => {
					if (a.confirm?.(`“${t.snapshot.title}” sürümünü geri yüklemek istediğine emin misin?`)) {
						if (!v(O, t.id, a.localStorage)) return A("Sürüm geri yüklenemedi.");
						try {
							a.dispatchEvent?.(new a.CustomEvent("hafize:prompt-library-changed"));
						} catch {}
						M(), A("Sürüm geri yüklendi.");
					}
				}), l.addEventListener("click", () => {
					let e = new Blob([y(O, a.localStorage)], { type: "application/json;charset=utf-8" }), t = URL.createObjectURL(e), n = i.createElement("a");
					n.href = t, n.download = `hafize-prompt-revisions-${O}.json`, n.click(), a.setTimeout?.(() => URL.revokeObjectURL(t), 0), A("Sürüm geçmişi dışa aktarıldı.");
				});
			}
		}
		w.addEventListener("change", M), T.addEventListener("click", M);
		let N = (e) => {
			(e.key === t || e.key === n) && M();
		};
		a.addEventListener?.("storage", N);
		let P = JSON.stringify(c(a.localStorage)), F = typeof MutationObserver == "function" ? new MutationObserver(() => {
			let e = JSON.stringify(c(a.localStorage));
			if (e !== P) {
				try {
					let t = JSON.parse(P), n = JSON.parse(e), r = new Map(t.map((e) => [e.id, e]));
					for (let e of n) r.has(e.id) && !m(r.get(e.id), e) && h(e, "edit", a.localStorage), r.has(e.id) || h(e, "create", a.localStorage);
					for (let e of t) n.some((t) => t.id === e.id) || g(e.id, a.localStorage);
				} catch {}
				P = e, M();
			}
		}) : null;
		return F?.observe(s, {
			childList: !0,
			subtree: !0
		}), b.addEventListener("click", () => {
			k = !k, C.hidden = k, b.textContent = k ? "Göster" : "Gizle", b.setAttribute("aria-expanded", String(!k));
		}), M(), Object.freeze({
			mounted: !0,
			refresh: M,
			revisionsFor: (e) => p(e, a.localStorage),
			export: (e) => y(e, a.localStorage),
			destroy: () => {
				F?.disconnect(), a.removeEventListener?.("storage", N), l.remove();
			}
		});
	}
	e.HafizePromptLibraryRevisions = Object.freeze({
		PROMPT_KEY: t,
		REVISION_KEY: n,
		MAX_REVISIONS_PER_PROMPT: 20,
		MAX_REVISIONS_TOTAL: 600,
		normalizeSnapshot: l,
		normalizeRevision: u,
		readRevisions: d,
		saveRevisions: f,
		revisionsFor: p,
		sameContent: m,
		capture: h,
		removePromptRevisions: g,
		pruneOrphans: _,
		restore: v,
		exportPromptRevisions: y,
		summarizeRevision: b,
		mount: C
	});
	let w = () => C(e.document, e);
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", w, { once: !0 }) : w();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "#promptLibraryRevisions", n = !1, r = null, i = [], a = () => e.document, o = () => e.HafizePromptLibraryRevisions, s = () => e.localStorage;
	function c(e) {
		let n = a()?.querySelector?.(`${t} .prompt-library-revisions-status`);
		n && (n.textContent = String(e ?? "").slice(0, 160));
	}
	function l(e, t) {
		let n = a().createElement("button");
		return n.type = "button", n.className = "mini-btn prompt-library-revision-enhancement", n.textContent = e, n.dataset.promptRevisionAction = t, n.setAttribute("aria-label", e), n;
	}
	function u(e) {
		let t = a()?.querySelector?.(`#promptLibraryList .prompt-item[data-prompt-id="${CSS.escape(e)}"]`);
		t?.scrollIntoView?.({ block: "nearest" }), t?.querySelector?.("button")?.focus?.();
	}
	function d(n) {
		let r = n.target?.closest?.("[data-prompt-revision-action]");
		if (r) {
			if (r.dataset.promptRevisionAction === "open-current") {
				let e = a().querySelector(`${t} select`);
				e?.value && u(e.value);
			} else if (r.dataset.promptRevisionAction === "clear-history") {
				let n = a().querySelector(`${t} select`);
				if (!n?.value) return c("Önce bir istem seç.");
				if (!e.confirm?.("Bu istemin sürüm geçmişi temizlensin mi?")) return;
				if (!o()?.removePromptRevisions?.(n.value, s())) return c("Sürüm geçmişi temizlenemedi.");
				o()?.mount, e.dispatchEvent?.(new e.Event("storage")), c("Sürüm geçmişi temizlendi.");
			}
		}
	}
	function f() {
		let e = a()?.querySelector?.(t);
		if (!e) return;
		let n = e.querySelector(".prompt-library-revisions-enhancement-toolbar");
		n || (n = a().createElement("div"), n.className = "prompt-library-revisions-enhancement-toolbar", e.querySelector(".prompt-library-revisions-body")?.prepend(n), n.addEventListener("click", d), i.push(() => n.removeEventListener("click", d))), n.replaceChildren(l("Mevcut isteme git", "open-current"), l("Geçmişi temizle", "clear-history"));
	}
	function p() {
		if (n || !o() || !a()) return;
		let s = a().querySelector(t);
		s && (n = !0, r = typeof MutationObserver == "function" ? new MutationObserver(f) : null, r?.observe(s, {
			childList: !0,
			subtree: !0
		}), f(), e.addEventListener?.("hafize:prompt-library-changed", f), i.push(() => e.removeEventListener?.("hafize:prompt-library-changed", f)));
	}
	let m = () => p();
	a()?.readyState === "loading" ? a().addEventListener("DOMContentLoaded", m, { once: !0 }) : m(), e.addEventListener?.("beforeunload", () => {
		r?.disconnect?.();
		for (let e of i.splice(0)) e();
	});
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "hafize.chat-markdown.bootstrap.v1", n = "/chat-markdown.css", r = /* @__PURE__ */ new Set();
	function i(n) {
		try {
			if (e.sessionStorage?.getItem?.(t + n) === "1") return !1;
			e.sessionStorage?.setItem?.(t + n, "1");
		} catch {}
		return !0;
	}
	function a() {
		if (!e.document || !i("style") || r.has(n)) return;
		let t = e.document.createElement("link");
		t.rel = "stylesheet", t.href = n, t.setAttribute("data-hafize-chat-markdown", "style"), e.document.head?.append(t), r.add(n);
	}
	function o(t, n) {
		if (!e.document || r.has(t)) return;
		let i = e.document.createElement("script");
		i.src = t, i.defer = !0, i.dataset.hafizeChatMarkdown = "true", n && i.addEventListener("load", n, { once: !0 }), e.document.head?.append(i), r.add(t);
	}
	function s() {
		a(), o("/markdown-renderer.js", () => o("/chat-markdown.js"));
	}
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", s, { once: !0 }) : s();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "hafize.prompt-library.v1", n = "hafize.prompt-library.collections.v1", r = "hafize.prompt-library.revisions.v1", i = "hafize.prompt-library.quarantine.v1", a = "hafize.prompt-library.repair-backup.v1", o = e.HafizePromptLibrary, s = e.HafizePromptLibraryCollections, c = e.HafizePromptLibraryRevisions, l = () => e.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`, u = (e, t) => typeof e == "string" ? e.trim().slice(0, t) : "";
	function d(e, t, n) {
		try {
			let r = e?.getItem?.(t);
			return r ? JSON.parse(r) : n;
		} catch {
			return n;
		}
	}
	function f(e, t, n) {
		try {
			return e?.setItem?.(t, JSON.stringify(n)), !0;
		} catch {
			return !1;
		}
	}
	function p(n = e.localStorage) {
		try {
			let e = n?.getItem?.(t);
			return {
				raw: e,
				parsed: e ? JSON.parse(e) : []
			};
		} catch (e) {
			return {
				raw: n?.getItem?.(t) || "",
				parsed: null,
				error: e
			};
		}
	}
	function m(e) {
		return Array.isArray(e) ? e : e && typeof e == "object" && Array.isArray(e.items) ? e.items : [];
	}
	function h(e) {
		let t = m(e), n = [], r = [], i = /* @__PURE__ */ new Set(), a = 0;
		for (let e of t.slice(0, 240)) {
			let s = o?.normalizeItem?.(e);
			s ? i.has(s.id) ? (a += 1, n.push({
				item: s,
				duplicate: !0
			})) : (n.push({
				item: s,
				duplicate: !1
			}), i.add(s.id)) : r.push({
				index: t.indexOf(e),
				reason: !e || typeof e != "object" ? "nesne değil" : e.body ? "model sınırlarına uymuyor" : "body boş"
			});
		}
		return {
			sourceCount: t.length,
			normalized: n,
			invalidCount: r.length,
			duplicateIds: a
		};
	}
	function g(e) {
		return !e || typeof e != "object" || !Array.isArray(e.prompts) ? null : {
			version: 1,
			source: "hafize-prompt-library-recovery",
			exportedAt: u(e.exportedAt, 40),
			items: e.prompts
		};
	}
	function _(t = e.localStorage) {
		let n = w(t);
		return {
			rawCount: n.report.rawCount,
			normalizedCount: n.normalizedItems.length,
			invalidCount: n.report.invalidIndexes.length,
			duplicateCount: n.duplicateIds.length,
			collectionCount: n.report.collections.count,
			orphanCollectionMembers: n.report.collections.orphanMembers,
			revisionCount: n.report.revisions.count,
			orphanRevisionRefs: n.report.revisions.orphanPromptRefs,
			rewrites: {
				prompts: n.willRewritePrompts,
				collections: n.willRewriteCollections,
				revisions: n.willRewriteRevisions
			}
		};
	}
	function v(e, t = [], n = {}) {
		let r = o?.normalizeCollection?.(t) || [], i = h(e), a = new Set(r.map((e) => e.id)), s = [], c = 0, d = 0;
		for (let e of i.normalized) {
			if (s.length + r.length >= 120) {
				d += 1;
				continue;
			}
			let t = e.item, n = t.id;
			for (; a.has(n);) c += 1, n = l();
			n !== t.id && (t = Object.freeze({
				...t,
				id: n
			})), a.add(t.id), s.push(t);
		}
		let f = s.slice(0, n.previewLimit || 8).map((e) => ({
			id: e.id,
			title: u(e.title, 100),
			tags: Array.isArray(e.tags) ? e.tags.slice(0, 8) : [],
			bodyPreview: String(e.body || "").replace(/\s+/g, " ").slice(0, 140),
			rekeyed: r.some((t) => t.id === e.id) === !1
		}));
		return {
			version: 1,
			currentCount: r.length,
			sourceCount: i.sourceCount,
			validCount: i.normalized.length,
			invalidCount: i.invalidCount,
			duplicateIds: i.duplicateIds,
			collisions: c,
			acceptedCount: s.length,
			capacitySkipped: d,
			preview: f,
			items: s,
			meta: e && typeof e == "object" ? {
				source: u(e.source, 80),
				exportedAt: u(e.exportedAt, 40)
			} : {}
		};
	}
	function y(t = e.localStorage) {
		return o?.loadItems?.(t) || [];
	}
	function b(t, n = e.localStorage) {
		if (!t || !Array.isArray(t.items)) return {
			imported: 0,
			skipped: 0,
			ok: !1,
			reason: "INVALID_PLAN"
		};
		let r = o?.mergeImportedItems?.(y(n), t.items);
		if (!r) return {
			imported: 0,
			skipped: t.items.length,
			ok: !1,
			reason: "MERGE_FAILED"
		};
		if (o?.saveItems?.(n, r.items) !== !0) return {
			imported: 0,
			skipped: t.items.length,
			ok: !1,
			reason: "STORAGE_FAILED"
		};
		try {
			e.dispatchEvent?.(new e.CustomEvent("hafize:prompt-library-changed")), e.dispatchEvent?.(new e.CustomEvent("hafize:prompt-library-safety-changed"));
		} catch {}
		return {
			imported: r.imported,
			skipped: t.items.length - r.imported,
			ok: !0,
			reason: ""
		};
	}
	function x(t = e.localStorage, r = /* @__PURE__ */ new Set()) {
		let i = d(t, n, []), a = s?.normalizeCollections?.(i), o = Array.isArray(a) ? a : [], c = /* @__PURE__ */ new Set(), l = 0, u = 0;
		for (let e of o) c.has(e.id) && (l += 1), c.add(e.id), u += e.promptIds.filter((e) => !r.has(e)).length;
		return {
			rawValid: Array.isArray(i),
			count: o.length,
			duplicateIds: l,
			orphanMembers: u,
			collections: o
		};
	}
	function S(t = e.localStorage, n = /* @__PURE__ */ new Set()) {
		let i = d(t, r, []), a = c?.readRevisions?.(t) || [], o = a.filter((e) => !n.has(e.promptId)).length, s = a.filter((e) => e.snapshot?.id !== e.promptId).length;
		return {
			rawValid: Array.isArray(i),
			count: a.length,
			orphanPromptRefs: o,
			snapshotMismatches: s,
			revisions: a
		};
	}
	function C(t = e.localStorage) {
		let n = p(t), r = n.parsed, i = Array.isArray(r) ? r : [], a = o?.normalizeCollection?.(i) || [], s = /* @__PURE__ */ new Set(), c = [], l = [], u = 0, d = 0;
		i.forEach((e, t) => {
			if (!e || typeof e != "object") {
				l.push(t);
				return;
			}
			let n = typeof e.id == "string" ? e.id : "";
			n && s.has(n) && c.push(n), n && s.add(n), (typeof e.body != "string" || !e.body) && (u += 1), (!Number.isFinite(e.useCount) || e.useCount < 0) && (d += 1), o?.normalizeItem?.(e) || l.push(t);
		});
		let f = new Set(a.map((e) => e.id)), m = x(t, f), h = S(t, f);
		return {
			storageReadable: n.parsed !== null,
			rawIsArray: Array.isArray(r),
			rawCount: i.length,
			normalizedCount: a.length,
			overCapacity: i.length > 120,
			duplicateIds: c,
			invalidSamples: invalid.slice(0, 6),
			invalidIndexes: [...new Set(l)],
			invalidBodies: u,
			invalidUseCounts: d,
			collections: m,
			revisions: h
		};
	}
	function w(t = e.localStorage) {
		let n = C(t), r = p(t), i = Array.isArray(r.parsed) ? r.parsed : [], a = [], u = /* @__PURE__ */ new Set(), d = /* @__PURE__ */ new Set();
		for (let e of i.slice(0, 240)) {
			let t = o?.normalizeItem?.(e);
			if (t) {
				if (u.has(t.id)) for (d.add(t.id), t = Object.freeze({
					...t,
					id: l()
				}); u.has(t.id);) t = Object.freeze({
					...t,
					id: l()
				});
				if (u.add(t.id), a.push(t), a.length >= 120) break;
			}
		}
		let f = new Set(a.map((e) => e.id)), m = s?.pruneMembers?.(s?.readCollections?.(t) || [], t) || [], h = c?.readRevisions?.(t) || [], g = h.filter((e) => f.has(e.promptId));
		return {
			report: n,
			normalizedItems: a,
			duplicateIds: [...d],
			collections: m,
			revisions: g,
			willRewritePrompts: JSON.stringify(i) !== JSON.stringify(a),
			willRewriteCollections: JSON.stringify(s?.readCollections?.(t) || []) !== JSON.stringify(m),
			willRewriteRevisions: JSON.stringify(h) !== JSON.stringify(g)
		};
	}
	function T(t = e.localStorage) {
		let n = M(t);
		return n ? f(t, a, {
			version: 1,
			createdAt: (/* @__PURE__ */ new Date()).toISOString(),
			payload: n
		}) : !1;
	}
	function E(t = e.localStorage) {
		let n = d(t, a, null);
		return !!(n && typeof n.payload == "string" && n.payload);
	}
	function D(i = e.localStorage) {
		let o = d(i, a, null);
		if (!o || typeof o.payload != "string") return {
			ok: !1,
			reason: "NO_REPAIR_CHECKPOINT"
		};
		let s;
		try {
			s = JSON.parse(o.payload);
		} catch {
			return {
				ok: !1,
				reason: "CHECKPOINT_CORRUPT"
			};
		}
		if (!s || !Array.isArray(s.prompts)) return {
			ok: !1,
			reason: "CHECKPOINT_INVALID"
		};
		if (!f(i, t, s.prompts)) return {
			ok: !1,
			reason: "PROMPT_RESTORE_FAILED"
		};
		Array.isArray(s.collections) && f(i, n, s.collections), Array.isArray(s.revisions) && f(i, r, s.revisions), f(i, a, null);
		try {
			e.dispatchEvent?.(new e.CustomEvent("hafize:prompt-library-safety-changed"));
		} catch {}
		return {
			ok: !0,
			restored: s.prompts.length
		};
	}
	function O(n = e.localStorage, r = {}) {
		let i = w(n);
		if (!i.report.storageReadable) return {
			ok: !1,
			reason: "PROMPT_STORAGE_UNREADABLE"
		};
		if (!T(n)) return {
			ok: !1,
			reason: "REPAIR_CHECKPOINT_FAILED"
		};
		if (!f(n, t, i.normalizedItems)) return {
			ok: !1,
			reason: "PROMPT_STORAGE_FAILED"
		};
		r.collections !== !1 && s?.saveCollections && s.saveCollections(n, i.collections), r.revisions !== !1 && c?.saveRevisions && c.saveRevisions(n, i.revisions);
		try {
			e.dispatchEvent?.(new e.CustomEvent("hafize:prompt-library-safety-changed"));
		} catch {}
		return {
			ok: !0,
			normalized: i.normalizedItems.length,
			duplicateIdsRekeyed: i.duplicateIds.length,
			collections: i.collections.length,
			revisions: i.revisions.length
		};
	}
	function k(t = e.localStorage) {
		let n = d(t, i, {
			version: 1,
			createdAt: "",
			items: []
		});
		return n && typeof n == "object" && Array.isArray(n.items) ? n : {
			version: 1,
			createdAt: "",
			items: []
		};
	}
	function A(n = e.localStorage, r = []) {
		let a = p(n);
		if (!Array.isArray(a.parsed)) return {
			ok: !1,
			reason: "PROMPT_STORAGE_INVALID",
			count: 0
		};
		let o = new Set(r.filter((e) => Number.isInteger(e) && e >= 0));
		if (!o.size) return {
			ok: !1,
			reason: "NO_INVALID_ITEMS",
			count: 0
		};
		let s = a.parsed.filter(function(e, t) {
			return o.has(t);
		}), c = a.parsed.filter(function(e, t) {
			return !o.has(t);
		}), l = k(n), u = {
			version: 1,
			createdAt: l.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
			items: l.items.concat(s).slice(-80)
		};
		if (JSON.stringify(u).length > 1e6) return {
			ok: !1,
			reason: "QUARANTINE_TOO_LARGE",
			count: 0
		};
		if (!f(n, i, u)) return {
			ok: !1,
			reason: "QUARANTINE_WRITE_FAILED",
			count: 0
		};
		if (!f(n, t, c)) return {
			ok: !1,
			reason: "PROMPT_WRITE_FAILED",
			count: 0
		};
		try {
			e.dispatchEvent?.(new e.CustomEvent("hafize:prompt-library-safety-changed"));
		} catch {}
		return {
			ok: !0,
			reason: "",
			count: s.length
		};
	}
	function j(t = e.localStorage) {
		let n = k(t);
		if (!n.items.length) return {
			ok: !1,
			reason: "QUARANTINE_EMPTY",
			imported: 0
		};
		let r = o?.mergeImportedItems?.(y(t), n.items);
		if (!r || o?.saveItems?.(t, r.items) !== !0) return {
			ok: !1,
			reason: "RESTORE_FAILED",
			imported: 0
		};
		if (!f(t, i, {
			version: 1,
			createdAt: (/* @__PURE__ */ new Date()).toISOString(),
			items: []
		})) return {
			ok: !1,
			reason: "QUARANTINE_CLEAR_FAILED",
			imported: 0
		};
		try {
			e.dispatchEvent?.(new e.CustomEvent("hafize:prompt-library-safety-changed"));
		} catch {}
		return {
			ok: !0,
			reason: "",
			imported: r.imported
		};
	}
	function M(t = e.localStorage) {
		let i = {
			version: 1,
			source: "hafize-prompt-library-recovery",
			exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
			prompts: p(t).parsed,
			collections: d(t, n, []),
			revisions: d(t, r, [])
		}, a = JSON.stringify(i, null, 2);
		return a.length > 15e5 ? "" : a;
	}
	e.HafizePromptLibrarySafety = Object.freeze({
		PROMPT_KEY: t,
		COLLECTION_KEY: n,
		REVISION_KEY: r,
		QUARANTINE_KEY: i,
		REPAIR_BACKUP_KEY: a,
		MAX_IMPORT_BYTES: 1e6,
		MAX_ITEMS: 120,
		MAX_PREVIEW: 8,
		readRawPrompts: p,
		buildImportPlan: v,
		normalizeRecoveryPayload: g,
		buildRepairPreview: _,
		applyImportPlan: b,
		analyzeLibrary: C,
		buildSafeRepair: w,
		applySafeRepair: O,
		exportRecoverySnapshot: M,
		readQuarantine: k,
		quarantineInvalidItems: A,
		restoreQuarantine: j,
		createRepairCheckpoint: T,
		hasRepairCheckpoint: E,
		undoLastRepair: D
	});
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "promptLibraryCard", n = "promptLibraryImportPreview", r = function() {
		return e.HafizePromptLibrarySafety;
	}, i = function(e, t) {
		return typeof e == "string" ? e.trim().slice(0, t) : "";
	}, a = function(e, t, n, r) {
		let i = e.createElement(t);
		return r && (i.className = r), n !== void 0 && (i.textContent = String(n)), i;
	}, o = function() {
		return e.HafizePromptLibrary;
	}, s = function(e) {
		return o() && o().normalizeImportedPayload ? o().normalizeImportedPayload(e) : {
			items: [],
			meta: {}
		};
	}, c = function(e, t) {
		return o() && o().mergeImportedItems ? o().mergeImportedItems(e, t) : null;
	}, l = function(e, t, n) {
		let r = a(e, "button", t, n || "mini-btn");
		return r.type = "button", r;
	};
	function u(o = e.document, u = e) {
		let d = o && o.getElementById ? o.getElementById(t) : null;
		if (!o || !d || !r() || o.getElementById(n)) return null;
		let f = null, p = null, m = null, h = null;
		function g() {
			return h && h.isConnected || (h = d.querySelector("input[type=\"file\"][accept*=\"json\"]")), h;
		}
		function _() {
			h && (h.value = "");
		}
		function v() {
			if (!f) return;
			f.hidden = !0, f.setAttribute("aria-hidden", "true"), m = null, u.document && u.document.body && u.document.body.classList.remove("prompt-library-import-open");
			let e = p;
			p = null, _(), e && typeof e.focus == "function" && e.focus();
		}
		function y(e) {
			f || S(), f.hidden = !1, f.setAttribute("aria-hidden", "false"), f.querySelector(".prompt-import-preview-message").textContent = i(e, 180), f.querySelector(".prompt-import-preview-body").replaceChildren(), f.querySelector(".prompt-import-preview-list").replaceChildren(), f.querySelector("[data-import-confirm]").disabled = !0, f.querySelector("[data-import-cancel]").focus();
		}
		function b(e, t) {
			let n = f.querySelector(".prompt-import-preview-body"), r = f.querySelector(".prompt-import-preview-message"), s = f.querySelector(".prompt-import-preview-list"), c = f.querySelector("[data-import-confirm]");
			r.textContent = e.validCount + " uygun, " + e.invalidCount + " geçersiz, " + e.collisions + " id çakışması, " + e.capacitySkipped + " kapasite dışında.", n.replaceChildren(), s.replaceChildren(), [
				["Kaynak türü", e.meta?.source === "hafize-prompt-library-recovery" ? "Recovery yedeği" : "Prompt Library yedeği"],
				["Dosya", i(t && t.name, 120) || "JSON yedeği"],
				["Dosya boyutu", Math.ceil((t && t.size || 0) / 1024) + " KB"],
				["Mevcut kayıt", e.currentCount],
				["Dosyadaki kayıt", e.sourceCount],
				["Aktarılacak", e.acceptedCount],
				["Çakışan id", e.collisions],
				["Geçersiz kayıt", e.invalidCount],
				["Kapasite dışında", e.capacitySkipped]
			].forEach(function(e) {
				let t = a(o, "div", void 0, "prompt-import-preview-stat");
				t.append(a(o, "span", e[0], "prompt-import-preview-label")), t.append(a(o, "strong", e[1], "prompt-import-preview-value")), n.append(t);
			}), e.invalidSamples && e.invalidSamples.length && (n.append(a(o, "h4", "Atlanan kayıt örnekleri", "prompt-import-preview-subtitle")), e.invalidSamples.forEach(function(e) {
				let t = a(o, "div", void 0, "prompt-import-preview-invalid");
				t.append(a(o, "span", "Kayıt #" + (Number(e.index) + 1), "prompt-import-preview-invalid-index")), t.append(a(o, "span", e.reason, "prompt-import-preview-invalid-reason")), n.append(t);
			})), e.preview.length && (n.append(a(o, "h4", "İlk aktarılacak istemler", "prompt-import-preview-subtitle")), e.preview.forEach(function(e) {
				let t = a(o, "article", void 0, "prompt-import-preview-item");
				t.append(a(o, "strong", e.title, "prompt-import-preview-item-title")), t.append(a(o, "span", e.bodyPreview, "prompt-import-preview-item-body")), e.tags && e.tags.length && t.append(a(o, "span", e.tags.join(" · "), "prompt-import-preview-item-tags")), s.append(t);
			})), c.disabled = e.acceptedCount === 0, f.querySelector("[data-import-cancel]").focus();
		}
		function x(e) {
			!e || e.size > 1e6 ? y("İçe aktarma dosyası 1 MB sınırını aşamaz.") : e.text().then(function(t) {
				let n;
				try {
					n = JSON.parse(t);
				} catch {
					y("Geçersiz JSON istem yedeği.");
					return;
				}
				let i = r().normalizeRecoveryPayload?.(n) || s(n), a = u.HafizePromptLibrary && u.HafizePromptLibrary.loadItems ? u.HafizePromptLibrary.loadItems(u.localStorage) : [];
				c(a, i.items) ? (m = r().buildImportPlan(i, a), p = o.activeElement, f || S(), f.hidden = !1, f.setAttribute("aria-hidden", "false"), u.document && u.document.body && u.document.body.classList.add("prompt-library-import-open"), b(m, e)) : y("İstem yedeği mevcut veri modeliyle uyumlu değil.");
			}).catch(function() {
				y("İstem yedeği okunamadı.");
			});
		}
		function S() {
			f = a(o, "section", void 0, "prompt-library-import-dialog"), f.id = n, f.setAttribute("role", "dialog"), f.setAttribute("aria-modal", "true"), f.setAttribute("aria-hidden", "true"), f.setAttribute("aria-labelledby", "promptImportPreviewTitle");
			let e = a(o, "div", void 0, "prompt-import-preview-panel"), t = a(o, "div", void 0, "prompt-import-preview-head"), i = a(o, "h3", "İçe aktarma önizlemesi", "prompt-import-preview-title");
			i.id = "promptImportPreviewTitle";
			let s = l(o, "Kapat", "prompt-import-preview-close");
			t.append(i, s);
			let c = a(o, "p", "Dosya henüz seçilmedi.", "prompt-import-preview-message"), d = a(o, "div", void 0, "prompt-import-preview-body"), p = a(o, "div", void 0, "prompt-import-preview-list"), h = a(o, "div", void 0, "prompt-import-preview-actions"), g = l(o, "İptal", "prompt-import-preview-cancel"), _ = l(o, "İçe aktar", "prompt-import-preview-confirm");
			g.dataset.importCancel = "true", _.dataset.importConfirm = "true", h.append(g, _), e.append(t, c, d, p, h), f.append(e), o.body.append(f), s.addEventListener("click", v), g.addEventListener("click", v), _.addEventListener("click", function() {
				if (m) {
					if (!r().applyImportPlan(m, u.localStorage).ok) y("İçe aktarma kaydedilemedi. Mevcut kayıtlar korunuyor.");
					else {
						try {
							typeof u.StorageEvent == "function" && u.dispatchEvent(new u.StorageEvent("storage", {
								key: u.HafizePromptLibrary?.STORAGE_KEY || "hafize.prompt-library.v1",
								newValue: u.localStorage?.getItem?.(u.HafizePromptLibrary?.STORAGE_KEY || "hafize.prompt-library.v1") || null,
								storageArea: u.localStorage
							}));
						} catch {}
						v();
					}
				}
			}), f.addEventListener("keydown", function(e) {
				if (e.key === "Escape") {
					e.preventDefault(), v();
					return;
				}
				if (e.key !== "Tab") return;
				let t = Array.from(f.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])"));
				if (!t.length) return;
				let n = t[0], r = t[t.length - 1];
				e.shiftKey && o.activeElement === n ? (e.preventDefault(), r.focus()) : !e.shiftKey && o.activeElement === r && (e.preventDefault(), n.focus());
			});
		}
		function C(e) {
			let t = g();
			if (!t || e.target !== t) return;
			e.preventDefault(), e.stopImmediatePropagation();
			let n = t.files && t.files[0];
			n && x(n);
		}
		o.addEventListener("change", C, !0);
		let w = new MutationObserver(g);
		w.observe(d, {
			childList: !0,
			subtree: !0
		});
		let T = v;
		return u.addEventListener && u.addEventListener("beforeunload", T), g(), Object.freeze({
			mounted: !0,
			open: x,
			close: v,
			destroy: function() {
				w.disconnect(), o.removeEventListener("change", C, !0), u.removeEventListener && u.removeEventListener("beforeunload", T), f && f.remove();
			}
		});
	}
	e.HafizePromptLibraryImportPreview = Object.freeze({ mount: u });
	let d = function() {
		e.document && e.document.getElementById && e.document.getElementById(t) && u(e.document, e);
	};
	e.document && e.document.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", d, { once: !0 }) : d();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "promptLibraryDiagnostics", n = "promptLibraryCard", r = function() {
		return e.HafizePromptLibrarySafety;
	}, i = function(t, n) {
		return t === e ? e.confirm?.(n) : t.confirm?.(n);
	}, a = function(e, t, n) {
		let r = e.createElement("span");
		return n && (r.className = n), r.textContent = String(t ?? ""), r;
	}, o = function(e, t, n) {
		let r = e.createElement("button");
		return r.type = "button", r.className = n || "mini-btn", r.textContent = t, r;
	};
	function s(s = e.document, c = e) {
		let l = s && s.getElementById ? s.getElementById(n) : null;
		if (!s || !l || !r() || s.getElementById(t)) return null;
		let u = s.createElement("section");
		u.id = t, u.className = "prompt-library-diagnostics", u.setAttribute("aria-labelledby", "promptLibraryDiagnosticsTitle");
		let d = s.createElement("div");
		d.className = "prompt-library-diagnostics-head";
		let f = a(s, "Kütüphane sağlığı", "prompt-library-diagnostics-title");
		f.id = "promptLibraryDiagnosticsTitle";
		let p = o(s, "Tara"), m = o(s, "Gizle");
		m.setAttribute("aria-expanded", "true"), m.setAttribute("aria-controls", "promptLibraryDiagnosticsBody"), d.append(f, p, m);
		let h = s.createElement("div");
		h.className = "prompt-library-diagnostics-body", h.id = "promptLibraryDiagnosticsBody";
		let g = a(s, "Henüz taranmadı.", "prompt-library-diagnostics-status"), _ = s.createElement("div");
		_.className = "prompt-library-diagnostics-report", _.setAttribute("role", "list");
		let v = s.createElement("div");
		v.className = "prompt-library-diagnostics-repair-preview", v.setAttribute("aria-live", "polite");
		let y = o(s, "Yedek indir"), b = o(s, "Güvenli onarımı uygula");
		b.dataset.diagnosticsRepair = "true";
		let x = o(s, "Geçersiz kayıtları kaldır", "mini-btn prompt-library-diagnostics-danger"), S = o(s, "Karantinayı geri al"), C = o(s, "Son onarımı geri al"), w = o(s, "Raporu kopyala"), T = o(s, "Onarım planını kopyala"), E = s.createElement("div");
		E.className = "prompt-library-diagnostics-actions", E.append(y, b, x, S, C, w, T), h.append(g, _, v, E), u.append(d, h), l.append(u);
		let D = null, O = !1;
		function k(e, t, n) {
			let r = s.createElement("div");
			return r.className = "prompt-library-diagnostics-metric" + (n ? " " + n : ""), r.append(a(s, e, "prompt-library-diagnostics-label")), r.append(a(s, t, "prompt-library-diagnostics-value")), r;
		}
		function A(e) {
			D = e, _.replaceChildren();
			let t = [
				["Bozuk/uygunsuz kayıt", e.invalidIndexes.length],
				["Yinelenen id", e.duplicateIds.length],
				["Geçersiz kullanım sayacı", e.invalidUseCounts],
				["Koleksiyon yetim üyesi", e.collections.orphanMembers],
				["Revizyon yetim referansı", e.revisions.orphanPromptRefs],
				["Snapshot uyuşmazlığı", e.revisions.snapshotMismatches]
			];
			_.append(k("Kayıt", e.rawCount, "is-neutral")), _.append(k("Normalize edilebilir", e.normalizedCount, "is-neutral")), _.append(k("Kapasite aşıldı", e.overCapacity ? "Evet" : "Hayır", e.overCapacity ? "is-warning" : "is-ok")), t.forEach(function(e) {
				_.append(k(e[0], e[1], e[1] ? "is-warning" : "is-ok"));
			}), b.disabled = !e.storageReadable, x.disabled = !e.invalidIndexes.length, S.disabled = r().readQuarantine(c.localStorage).items.length === 0, C.disabled = !r().hasRepairCheckpoint(c.localStorage);
			try {
				let e = r().buildRepairPreview(c.localStorage);
				v.textContent = "";
				let t = [
					["Onarım sonrası kayıt", e.normalizedCount],
					["Yinelenen ID yeniden anahtarlama", e.duplicateCount],
					["Koleksiyon yetimi budama", e.orphanCollectionMembers],
					["Revizyon yetimi budama", e.orphanRevisionRefs],
					["Checkpoint gerekecek", Object.values(e.rewrites).some(Boolean) ? "Evet" : "Hayır"]
				], n = s.createElement("strong");
				n.textContent = "Onarım önizlemesi", v.append(n), t.forEach(function(e) {
					let t = s.createElement("div");
					t.className = "prompt-library-diagnostics-repair-item", t.append(a(s, e[0], "prompt-library-diagnostics-label")), t.append(a(s, e[1], "prompt-library-diagnostics-value")), v.append(t);
				});
			} catch {
				v.textContent = "Onarım önizlemesi üretilemedi.";
			}
			g.textContent = e.storageReadable ? "Tarama tamamlandı; güvenli onarım geçerli kayıtları normalize eder ve yetim ilişkileri budar." : "İstem verisi okunamıyor; otomatik onarım yapılmadı.";
		}
		m.addEventListener("click", function() {
			O = !O, h.hidden = O, m.textContent = O ? "Göster" : "Gizle", m.setAttribute("aria-expanded", String(!O));
		});
		function j() {
			try {
				A(r().analyzeLibrary(c.localStorage));
			} catch {
				g.textContent = "Sağlık taraması başarısız.";
			}
		}
		S.disabled = !0, y.addEventListener("click", function() {
			let e = r().exportRecoverySnapshot(c.localStorage);
			if (!e) {
				g.textContent = "Kurtarma yedeği üretilemedi veya boyutu sınırı aşıyor.";
				return;
			}
			let t = new Blob([e], { type: "application/json;charset=utf-8" }), n = URL.createObjectURL(t), i = s.createElement("a");
			i.href = n, i.download = "hafize-prompt-library-recovery.json", i.click(), c.setTimeout?.(function() {
				URL.revokeObjectURL(n);
			}, 0), g.textContent = "Kurtarma yedeği indirildi.";
		}), T.addEventListener("click", function() {
			let e;
			try {
				e = r().buildRepairPreview(c.localStorage);
			} catch {
				g.textContent = "Onarım planı üretilemedi.";
				return;
			}
			let t = {
				generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
				rawCount: e.rawCount,
				normalizedCount: e.normalizedCount,
				invalidCount: e.invalidCount,
				duplicateCount: e.duplicateCount,
				orphanCollectionMembers: e.orphanCollectionMembers,
				orphanRevisionRefs: e.orphanRevisionRefs,
				rewrites: e.rewrites
			}, n = c.navigator?.clipboard?.writeText;
			typeof n == "function" ? Promise.resolve(n.call(c.navigator.clipboard, JSON.stringify(t, null, 2))).then(function() {
				g.textContent = "Onarım planı panoya kopyalandı.";
			}).catch(function() {
				g.textContent = "Onarım planı kopyalanamadı.";
			}) : g.textContent = "Onarım planı kopyalama kullanılamıyor.";
		}), w.addEventListener("click", function() {
			if (D || j(), !D) return;
			let e = {
				generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
				rawCount: D.rawCount,
				normalizedCount: D.normalizedCount,
				overCapacity: D.overCapacity,
				invalidCount: D.invalidIndexes.length,
				duplicateIdCount: D.duplicateIds.length,
				invalidUseCount: D.invalidUseCounts,
				orphanCollectionMembers: D.collections.orphanMembers,
				orphanRevisionRefs: D.revisions.orphanPromptRefs,
				snapshotMismatches: D.revisions.snapshotMismatches
			}, t = JSON.stringify(e, null, 2), n = c.navigator?.clipboard?.writeText;
			typeof n == "function" ? Promise.resolve(n.call(c.navigator.clipboard, t)).then(function() {
				g.textContent = "Rapor panoya kopyalandı.";
			}).catch(function() {
				g.textContent = "Rapor kopyalanamadı.";
			}) : g.textContent = "Rapor kopyalama kullanılamıyor.";
		}), C.addEventListener("click", function() {
			if (!c.confirm || !c.confirm("Son güvenli onarım geri alınsın mı?")) return;
			let e = r().undoLastRepair(c.localStorage);
			e.ok ? (g.textContent = String(e.restored) + " kayıt son checkpoint üzerinden geri alındı.", j()) : g.textContent = "Son onarım geri alınamadı: " + e.reason;
		}), S.addEventListener("click", function() {
			if (!c.confirm || !c.confirm("Karantinadaki geçersiz kayıtlar yeniden kütüphaneye aktarılsın mı?")) return;
			let e = r().restoreQuarantine(c.localStorage);
			e.ok ? (g.textContent = e.imported + " karantina kaydı geri alındı.", j()) : g.textContent = "Karantina geri yüklenemedi: " + e.reason;
		}), p.addEventListener("click", j), b.addEventListener("click", function() {
			if (D || j(), !D || !c.confirm || !c.confirm("Normalize edilebilir kayıtlar ve yetim ilişkiler güvenli biçimde onarılsın mı?")) return;
			let e = r().applySafeRepair(c.localStorage);
			g.textContent = e.ok ? "Güvenli onarım tamamlandı." : "Onarım başarısız: " + e.reason, j();
		}), x.addEventListener("click", function() {
			if (!D || !D.invalidIndexes.length || !i(c, String(D.invalidIndexes.length) + " geçersiz kayıt karantinaya alınsın mı?")) return;
			let e = r().quarantineInvalidItems(c.localStorage, D.invalidIndexes);
			g.textContent = e.ok ? String(e.count) + " kayıt karantinaya alındı; geri alınabilir." : "Karantina başarısız: " + e.reason, j();
		});
		let M = function(e) {
			[
				r().PROMPT_KEY,
				r().COLLECTION_KEY,
				r().REVISION_KEY
			].includes(e.key) && j();
		};
		return c.addEventListener && c.addEventListener("storage", M), j(), Object.freeze({
			mounted: !0,
			scan: j,
			getReport: function() {
				return D;
			},
			destroy: function() {
				c.removeEventListener && c.removeEventListener("storage", M), u.remove();
			}
		});
	}
	e.HafizePromptLibraryDiagnostics = Object.freeze({ mount: s });
	let c = function() {
		e.document && e.document.getElementById && e.document.getElementById(n) && s(e.document, e);
	};
	e.document && e.document.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", c, { once: !0 }) : c();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "promptLibraryCard", n = "promptLibrarySmartViews", r = "hafize.prompt-library.smart-views.v1", i = `${r}.state`, a = 3e5, o = Object.freeze({
		query: "",
		sort: "updated-desc",
		collapsed: !1,
		activeId: ""
	}), s = (e, t, n) => {
		let r = e.createElement("span");
		return n && (r.className = n), r.textContent = String(t ?? ""), r;
	}, c = (e, t, n = "mini-btn") => {
		let r = e.createElement("button");
		return r.type = "button", r.className = n, r.textContent = t, r;
	}, l = () => e.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`, u = (e, t) => String(e ?? "").replace(/\\0/g, "").trim().slice(0, t), d = (e) => String(e ?? "").toLocaleLowerCase("tr-TR");
	function f(e) {
		return !e || typeof e != "object" ? { ...o } : {
			query: u(e.query, 180),
			sort: ["recent", "name"].includes(e.sort) ? e.sort : o.sort,
			collapsed: e.collapsed === !0,
			activeId: u(e.activeId, 120)
		};
	}
	function p(e) {
		if (!e || typeof e != "object") return null;
		let t = u(e.name, 72);
		if (!t) return null;
		let n = u(e.query, 180), r = u(e.description, 180), i = e.core && typeof e.core == "object" ? e.core : {}, a = [
			"updated-desc",
			"favorite-first",
			"created-desc",
			"title-asc"
		].includes(i.sort) ? i.sort : "updated-desc", o = i.tag === "all" ? "all" : u(i.tag, 24) || "all";
		return Object.freeze({
			id: u(e.id, 120) || l(),
			name: t,
			description: r,
			query: n,
			favoriteOnly: i.favoriteOnly === !0,
			tag: o,
			sort: a,
			minUse: Number.isFinite(Number(e.minUse)) ? Math.max(0, Math.min(9999, Math.floor(Number(e.minUse)))) : 0,
			maxUse: Number.isFinite(Number(e.maxUse)) ? Math.max(0, Math.min(9999, Math.floor(Number(e.maxUse)))) : 9999,
			hasVariables: e.hasVariables === !0,
			pinned: e.pinned === !0,
			createdAt: u(e.createdAt, 40) || (/* @__PURE__ */ new Date()).toISOString(),
			updatedAt: u(e.updatedAt, 40) || (/* @__PURE__ */ new Date()).toISOString()
		});
	}
	function m(e) {
		if (!Array.isArray(e)) return [];
		let t = [], n = /* @__PURE__ */ new Set();
		for (let r of e.slice(0, 48)) {
			let e = p(r);
			if (e && !n.has(e.id) && (n.add(e.id), t.push(e), t.length >= 24)) break;
		}
		return t;
	}
	function h(t = e.localStorage) {
		try {
			return m(JSON.parse(t?.getItem?.(r) || "[]"));
		} catch {
			return [];
		}
	}
	function g(t, n = e.localStorage) {
		try {
			return n?.setItem?.(r, JSON.stringify(m(t))), e.dispatchEvent?.(new e.CustomEvent("hafize:prompt-library-smart-views-changed")), !0;
		} catch {
			return !1;
		}
	}
	function _(t = e.localStorage) {
		try {
			return f(JSON.parse(t?.getItem?.(i) || "{}"));
		} catch {
			return { ...o };
		}
	}
	function v(t, n = e.localStorage) {
		try {
			return n?.setItem?.(i, JSON.stringify(f(t))), !0;
		} catch {
			return !1;
		}
	}
	function y(e) {
		return {
			query: u((e.querySelector("#promptLibrarySearch") || e.querySelector(".prompt-library-toolbar input[type=\"search\"]") || e.querySelector("input[type=\"search\"]"))?.value || "", 180),
			tag: e.querySelector(".prompt-library-filters select")?.value || "all",
			favoriteOnly: e.querySelector("#promptLibraryFavoriteFilter")?.getAttribute("aria-pressed") === "true",
			sort: e.querySelector(".prompt-library-toolbar select")?.value || "updated-desc"
		};
	}
	function b(e) {
		let t = String(e || "").match(/^(>=|<=|=|>|<)?\\s*(\\d{1,4})$/);
		return t ? {
			op: t[1] || ">=",
			value: Math.min(9999, Number(t[2]))
		} : null;
	}
	function x(e) {
		let t = u(e, 180), n = [], r = "", i = !1;
		for (let e of t) e === "\"" && (r === "" || !r.endsWith("\\\\")) ? (i = !i, r += e) : e === " " && !i ? (r && n.push(r), r = "") : r += e;
		r && n.push(r);
		let a = {
			text: [],
			includeTags: [],
			excludeTags: [],
			favorite: null,
			hasVariables: null,
			usage: []
		};
		for (let e of n) {
			let t = e.replace(/^"|"$/g, ""), n = d(t);
			if (n.startsWith("tag:")) {
				let e = u(t.slice(4), 24);
				e && a.includeTags.push(e);
			} else if (n.startsWith("-tag:")) {
				let e = u(t.slice(5), 24);
				e && a.excludeTags.push(e);
			} else if (n === "is:favorite" || n === "favorite:true") a.favorite = !0;
			else if (n === "is:not-favorite" || n === "favorite:false") a.favorite = !1;
			else if (n === "has:variable" || n === "has:variables") a.hasVariables = !0;
			else if (n === "has:no-variable" || n === "has:no-variables") a.hasVariables = !1;
			else if (n.startsWith("used:")) {
				let e = b(t.slice(5));
				e ? a.usage.push(e) : a.text.push(t);
			} else if (n.startsWith("usage:")) {
				let e = b(t.slice(6));
				e ? a.usage.push(e) : a.text.push(t);
			} else n.startsWith("sort:") || t && a.text.push(t);
		}
		return a;
	}
	function S(e, t) {
		return t.op === ">" ? e > t.value : t.op === ">=" ? e >= t.value : t.op === "<" ? e < t.value : t.op === "<=" ? e <= t.value : e === t.value;
	}
	function C(e, t) {
		if (!e || !t || t.favorite !== null && e.favorite !== t.favorite) return !1;
		let n = Array.isArray(e.variables) ? e.variables : [];
		if (t.hasVariables !== null && n.length > 0 !== t.hasVariables) return !1;
		let r = Array.isArray(e.tags) ? e.tags : [], i = new Set(r.map(d));
		if (t.includeTags.some((e) => !i.has(d(e))) || t.excludeTags.some((e) => i.has(d(e))) || t.usage.some((t) => !S(Number(e.useCount) || 0, t))) return !1;
		if (t.text.length) {
			let i = d([
				e.title,
				e.body,
				...r,
				...n
			].join(" "));
			if (t.text.some((e) => !i.includes(d(e)))) return !1;
		}
		return !0;
	}
	function w(e, t) {
		let n = x(t?.query || ""), r = Math.max(0, Number(t?.minUse) || 0), i = Math.max(r, Number(t?.maxUse) || 9999), a = t?.hasVariables === !0 || n.hasVariables, o = {
			...n,
			hasVariables: a
		};
		return (Array.isArray(e) ? e : []).filter((e) => {
			if (!C(e, o)) return !1;
			let n = Number(e.useCount) || 0;
			return !(n < r || n > i || t?.favoriteOnly === !0 && e.favorite !== !0 || t?.tag && t.tag !== "all" && !(e.tags || []).some((e) => d(e) === d(t.tag)));
		});
	}
	function T(e) {
		let t = y(e);
		return {
			name: "",
			description: "",
			query: "",
			favoriteOnly: t.favoriteOnly,
			tag: t.tag,
			sort: t.sort,
			minUse: 0,
			maxUse: 9999,
			hasVariables: !1,
			pinned: !1,
			createdAt: (/* @__PURE__ */ new Date()).toISOString(),
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
	}
	function E(e, t) {
		let n = u(e, 72);
		n ||= "Yeni görünüm";
		let r = new Set(t.map((e) => d(e.name)));
		if (!r.has(d(n))) return n;
		let i = 2;
		for (; r.has(d(`${n} ${i}`));) i += 1;
		return u(`${n} ${i}`, 72);
	}
	function D(e, t) {
		let n = e.slice();
		return t === "name" ? n.sort((e, t) => e.name.localeCompare(t.name, "tr")) : n.sort((e, t) => Number(t.pinned) - Number(e.pinned) || t.updatedAt.localeCompare(e.updatedAt));
	}
	function O(e) {
		let t = {
			version: 1,
			source: "hafize-prompt-library-smart-views",
			exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
			views: m(e)
		}, n = JSON.stringify(t, null, 2);
		return n.length <= a ? n : JSON.stringify({
			version: 1,
			source: t.source,
			views: m(e).slice(0, 8)
		}, null, 2);
	}
	function k(e, t = h()) {
		let n = m(Array.isArray(e) ? e : e?.views), r = t.slice(), i = new Set(r.map((e) => d(e.name))), a = 0, o = 0;
		for (let e of n) {
			if (r.length >= 24 || i.has(d(e.name))) {
				o += 1;
				continue;
			}
			let t = p({
				...e,
				id: l(),
				createdAt: (/* @__PURE__ */ new Date()).toISOString(),
				updatedAt: (/* @__PURE__ */ new Date()).toISOString()
			});
			r.push(t), i.add(d(t.name)), a += 1;
		}
		return {
			views: m(r),
			imported: a,
			skipped: o
		};
	}
	function A(e, t) {
		if (!e || !t) return;
		let n = x(e.query || ""), r = t.querySelector("#promptLibrarySearch") || t.querySelector("input[type=\"search\"]"), i = t.querySelector(".prompt-library-filters select"), a = t.querySelector("#promptLibraryFavoriteFilter"), o = t.querySelector(".prompt-library-toolbar select"), s = n.text.join(" ");
		r && (r.value = s, r.dispatchEvent(new Event("input", { bubbles: !0 }))), i && e.tag && (i.value = e.tag, i.dispatchEvent(new Event("change", { bubbles: !0 })));
		let c = n.favorite === null ? e.favoriteOnly === !0 : n.favorite;
		a && a.getAttribute("aria-pressed") !== String(c) && a.click(), o && e.sort && (o.value = e.sort, o.dispatchEvent(new Event("change", { bubbles: !0 })));
	}
	function j(t, n) {
		let r = e.HafizePromptLibrary?.loadItems?.(e.localStorage) || [], i = [...n.querySelectorAll(".prompt-item[data-prompt-id]")], a = new Set(w(r, t).map((e) => e.id));
		for (let e of i) e.hidden = !a.size || !a.has(e.dataset.promptId);
		let o = n.querySelector(".prompt-library-status");
		o && (o.textContent = `${a.size}/${r.length} kayıt görünümle eşleşti.`);
	}
	function M(e, t) {
		e ? j(e, t) : t.querySelectorAll(".prompt-item[data-prompt-id]").forEach((e) => {
			e.hidden = !1;
		});
	}
	function N(e, t, n, r, i = "text") {
		let a = e.createElement("label");
		a.className = "prompt-smart-view-field", a.append(s(e, t, "prompt-smart-view-field-label"));
		let o = e.createElement("input");
		return o.type = i, o.value = n ?? "", o.maxLength = r, i === "number" && (o.min = "0", o.max = "9999", o.inputMode = "numeric"), a.append(o), {
			wrap: a,
			input: o
		};
	}
	function P(o = e.document, f = e) {
		let m = o?.getElementById?.(t);
		if (!o || !m || o.getElementById(n)) return null;
		let b = o.createElement("section");
		b.id = n, b.className = "prompt-library-smart-views", b.setAttribute("aria-labelledby", "promptLibrarySmartViewsTitle");
		let S = o.createElement("div");
		S.className = "prompt-smart-views-head";
		let C = s(o, "Akıllı görünümler", "prompt-smart-views-title");
		C.id = "promptLibrarySmartViewsTitle";
		let j = s(o, "0", "prompt-smart-views-count"), P = c(o, "Gizle");
		P.setAttribute("aria-expanded", "true"), P.setAttribute("aria-controls", "promptSmartViewsBody"), S.append(C, j, P);
		let F = o.createElement("div");
		F.id = "promptSmartViewsBody", F.className = "prompt-smart-views-body";
		let I = o.createElement("input");
		I.type = "search", I.maxLength = 180, I.placeholder = "Görünüm ara…", I.setAttribute("aria-label", "Akıllı görünümlerde ara");
		let L = o.createElement("select");
		L.setAttribute("aria-label", "Görünümleri sırala");
		for (let [e, t] of [["recent", "Son kullanılan"], ["name", "Ada göre"]]) {
			let n = s(o, t);
			n.value = e, L.append(n);
		}
		let R = o.createElement("div");
		R.className = "prompt-smart-views-toolbar";
		let z = c(o, "＋ Mevcut durumu kaydet"), B = c(o, "Hazır görünümler"), V = c(o, "Dışa aktar"), H = c(o, "İçe aktar");
		R.append(I, L, z, B, V, H);
		let U = o.createElement("div");
		U.className = "prompt-smart-views-list", U.setAttribute("role", "list");
		let W = o.createElement("div");
		W.className = "prompt-smart-view-editor", W.hidden = !0;
		let G = s(o, "", "prompt-smart-views-status");
		G.setAttribute("role", "status"), G.setAttribute("aria-live", "polite"), F.append(R, U, W, G), b.append(S, F), m.append(b);
		let K = _(f.localStorage), q = null;
		function J(e) {
			G.textContent = u(e, 180);
		}
		function Y() {
			let e = h(f.localStorage), t = e.find((e) => e.id === K.activeId), n = f.HafizePromptLibrary?.loadItems?.(f.localStorage) || [];
			j.textContent = t ? `${w(n, t).length}/${n.length}` : `${e.length} görünüm`;
		}
		function X(e) {
			W.replaceChildren(), W.hidden = !1;
			let t = N(o, "Ad", e?.name || "", 72), n = N(o, "Açıklama", e?.description || "", 180), r = N(o, "Gelişmiş sorgu", e?.query || "", 180), i = N(o, "En az kullanım", String(e?.minUse ?? 0), 4, "number"), a = N(o, "En fazla kullanım", String(e?.maxUse ?? 9999), 4, "number"), u = o.createElement("select");
			u.setAttribute("aria-label", "Değişkenli istem filtresi");
			for (let [e, t] of [
				["all", "Değişken filtresi yok"],
				["with", "Değişkenli"],
				["without", "Değişkensiz"]
			]) {
				let n = o.createElement("option");
				n.value = e, n.textContent = t, u.append(n);
			}
			u.value = e?.hasVariables === !0 ? "with" : "all";
			let d = s(o, "Operatörler: tag:etiket, -tag:etiket, is:favorite, has:variable, used:>=3 ve normal metin.", "prompt-smart-view-help"), _ = o.createElement("div");
			_.className = "prompt-smart-view-editor-actions";
			let b = c(o, "Kaydet"), x = c(o, "Vazgeç");
			_.append(b, x), W.append(t.wrap, n.wrap, r.wrap, i.wrap, a.wrap, u, d, _), r.input.addEventListener("input", () => {
				J(`Önizleme: ${w(f.HafizePromptLibrary?.loadItems?.(f.localStorage) || [], {
					...T(m),
					query: r.input.value,
					minUse: Number(i.input.value) || 0,
					maxUse: Number(a.input.value) || 9999,
					hasVariables: u.value === "with"
				}).length} kayıt.`);
			}), x.addEventListener("click", () => {
				W.hidden = !0, W.replaceChildren();
			}), b.addEventListener("click", () => {
				let o = E(t.input.value, h(f.localStorage).filter((t) => t.id !== (e?.id || ""))), s = Math.max(0, Math.min(9999, Number(i.input.value) || 0)), c = Math.max(s, Math.min(9999, Number(a.input.value) || 9999)), d = u.value, _ = y(m), b = p({
					id: e?.id || l(),
					name: o,
					description: n.input.value,
					query: r.input.value,
					favoriteOnly: _.favoriteOnly,
					tag: _.tag,
					sort: _.sort,
					minUse: s,
					maxUse: c,
					hasVariables: d === "with",
					pinned: e?.pinned === !0,
					createdAt: e?.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
					updatedAt: (/* @__PURE__ */ new Date()).toISOString()
				}), x = h(f.localStorage).filter((e) => e.id !== b.id);
				if (x.unshift(b), !g(x.slice(0, 24), f.localStorage)) return J("Görünüm kaydedilemedi.");
				K = {
					...K,
					activeId: b.id
				}, v(K, f.localStorage), W.hidden = !0, W.replaceChildren(), Q(), J("Akıllı görünüm kaydedildi.");
			}), t.input.focus();
		}
		function Z() {
			let e = h(f.localStorage), t = [
				{
					name: "Favori istemler",
					query: "is:favorite"
				},
				{
					name: "Sık kullanılanlar",
					query: "used:>=3"
				},
				{
					name: "Değişkenli istemler",
					query: "has:variable"
				},
				{
					name: "Etiketli istemler",
					query: "tag:"
				}
			], n = 0;
			for (let r of t) {
				if (e.some((e) => d(e.name) === d(r.name))) continue;
				let t = p({
					...T(m),
					...r,
					description: "Hafize başlangıç akıllı görünümü",
					updatedAt: (/* @__PURE__ */ new Date()).toISOString()
				});
				if (t.query !== "tag:" && (e.push(t), n += 1, e.length >= 24)) break;
			}
			g(e.slice(0, 24), f.localStorage) && (Q(), J(n ? `${n} hazır görünüm eklendi.` : "Hazır görünümler zaten mevcut."));
		}
		function Q() {
			K = _(f.localStorage);
			let e = D(h(f.localStorage).filter((e) => d(e.name).includes(d(I.value))), L.value || K.sort);
			if (j.textContent = e.length ? `${e.length} görünüm` : "0 görünüm", U.replaceChildren(), !e.length) U.append(s(o, I.value ? "Eşleşen görünüm yok." : "Henüz kaydedilmiş görünüm yok.", "prompt-smart-views-empty")), Y();
			else {
				for (let t of e) {
					let e = o.createElement("article");
					e.className = "prompt-smart-view-row", e.dataset.smartViewId = t.id, e.setAttribute("role", "listitem");
					let n = o.createElement("div");
					n.className = "prompt-smart-view-info", n.append(s(o, t.pinned ? "★" : "☆", "prompt-smart-view-pin")), n.append(s(o, t.name, "prompt-smart-view-name")), t.description && n.append(s(o, t.description, "prompt-smart-view-description"));
					let r = s(o, t.query || "Temel filtreler", "prompt-smart-view-query");
					n.append(r);
					let i = f.HafizePromptLibrary?.loadItems?.(f.localStorage) || [];
					n.append(s(o, `${w(i, t).length} kayıt`, "prompt-smart-view-match"));
					let a = o.createElement("div");
					a.className = "prompt-smart-view-actions";
					let u = c(o, K.activeId === t.id ? "Aktifi kaldır" : "Uygula"), d = c(o, "Düzenle"), _ = c(o, t.pinned ? "Sabitlemeyi kaldır" : "Sabitle"), y = c(o, "Çoğalt"), b = c(o, "Sil");
					a.append(u, d, _, y, b), e.append(n, a), U.append(e), u.addEventListener("click", () => {
						K.activeId === t.id ? (K = {
							...K,
							activeId: ""
						}, v(K, f.localStorage), M(null, m), J("Akıllı görünüm kapatıldı."), Q()) : (K = {
							...K,
							activeId: t.id
						}, v(K, f.localStorage), A(t, m), M(t, m), J(`“${t.name}” görünümü uygulandı.`), f.dispatchEvent?.(new f.CustomEvent("hafize:prompt-library-smart-view-applied", { detail: {
							id: t.id,
							name: t.name
						} })), Q());
					}), d.addEventListener("click", () => {
						t.id, X(t);
					}), _.addEventListener("click", () => {
						g(h(f.localStorage).map((e) => e.id === t.id ? p({
							...e,
							pinned: !e.pinned,
							updatedAt: (/* @__PURE__ */ new Date()).toISOString()
						}) : e), f.localStorage), Q();
					}), y.addEventListener("click", () => {
						let e = h(f.localStorage);
						if (e.length >= 24) return J("Akıllı görünüm sınırı dolu.");
						let n = E(`${t.name} kopyası`, e);
						g([p({
							...t,
							id: l(),
							name: n,
							createdAt: (/* @__PURE__ */ new Date()).toISOString(),
							updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
							pinned: !1
						}), ...e].slice(0, 24), f.localStorage), Q(), J("Akıllı görünüm çoğaltıldı.");
					}), b.addEventListener("click", () => {
						f.confirm?.(`“${t.name}” görünümü silinsin mi?`) && (g(h(f.localStorage).filter((e) => e.id !== t.id), f.localStorage), K.activeId === t.id && (K = {
							...K,
							activeId: ""
						}, v(K, f.localStorage), M(null, m)), Q(), J("Akıllı görünüm silindi."));
					});
				}
				Y();
			}
		}
		z.addEventListener("click", () => X(T(m))), B.addEventListener("click", Z), V.addEventListener("click", () => {
			let e = O(h(f.localStorage)), t = new Blob([e], { type: "application/json;charset=utf-8" }), n = URL.createObjectURL(t), r = o.createElement("a");
			r.href = n, r.download = "hafize-prompt-smart-views.json", r.click(), f.setTimeout?.(() => URL.revokeObjectURL(n), 0), J("Akıllı görünümler dışa aktarıldı.");
		}), H.addEventListener("click", () => {
			q ||= o.createElement("input"), q.type = "file", q.accept = "application/json,.json", q.onchange = async () => {
				let e = q.files?.[0];
				if (q.value = "", !e || e.size > a) return J("Görünüm yedeği 300 KB sınırını aşamaz.");
				try {
					let t = k(JSON.parse(await e.text()), h(f.localStorage));
					g(t.views, f.localStorage) ? (Q(), J(`${t.imported} görünüm içe aktarıldı.`)) : J("Görünüm yedeği kaydedilemedi.");
				} catch {
					J("Geçersiz akıllı görünüm yedeği.");
				}
			}, q.click();
		}), I.addEventListener("input", Q), L.addEventListener("change", Q), P.addEventListener("click", () => {
			K = {
				...K,
				collapsed: !K.collapsed
			}, v(K, f.localStorage), F.hidden = K.collapsed, P.textContent = K.collapsed ? "Göster" : "Gizle", P.setAttribute("aria-expanded", String(!K.collapsed));
		});
		let $ = typeof MutationObserver == "function" ? new MutationObserver(() => {
			let e = h(f.localStorage).find((e) => e.id === K.activeId);
			e && M(e, m);
		}) : null;
		$?.observe(m, {
			childList: !0,
			subtree: !0
		});
		let ee = (e) => {
			(e.key === r || e.key === i || e.key === f.HafizePromptLibrary?.STORAGE_KEY) && Q();
		};
		return f.addEventListener?.("storage", ee), K.collapsed = K.collapsed === !0, F.hidden = K.collapsed, P.textContent = K.collapsed ? "Göster" : "Gizle", Q(), Object.freeze({
			mounted: !0,
			refresh: Q,
			evaluate: w,
			parseQuery: x,
			normalizeView: p,
			load: () => h(f.localStorage),
			destroy: () => {
				$?.disconnect(), f.removeEventListener?.("storage", ee), b.remove();
			}
		});
	}
	e.HafizePromptLibrarySmartViews = Object.freeze({
		STORAGE_KEY: r,
		STATE_KEY: i,
		MAX_VIEWS: 24,
		MAX_NAME: 72,
		MAX_DESCRIPTION: 180,
		MAX_QUERY: 180,
		MAX_EXPORT: a,
		normalizeView: p,
		normalizeViews: m,
		parseQuery: x,
		matches: C,
		evaluate: w,
		sortViews: D,
		load: h,
		save: g,
		loadState: _,
		saveState: v,
		exportPayload: O,
		importPayload: k,
		applyView: A,
		mount: P
	});
	let F = () => {
		e.document?.getElementById?.(t) && P(e.document, e);
	};
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", F, { once: !0 }) : F();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "promptLibrarySmartViewHistory", n = "hafize.prompt-library.smart-views-history.v1", r = (e, t, n) => {
		let r = e.createElement("span");
		return n && (r.className = n), r.textContent = String(t ?? ""), r;
	}, i = (e, t) => {
		let n = e.createElement("button");
		return n.type = "button", n.className = "mini-btn prompt-smart-view-history-action", n.textContent = t, n;
	}, a = (e, t) => String(e ?? "").replace(/\0/g, "").trim().slice(0, t), o = (e) => String(e ?? "").toLocaleLowerCase("tr-TR");
	function s(e) {
		if (!e || typeof e != "object") return null;
		let t = a(e.viewId, 120), n = a(e.name, 72);
		if (!t || !n) return null;
		let r = Number(e.count);
		return Object.freeze({
			id: a(e.id, 120) || String(Date.now()) + "-" + Math.random().toString(16).slice(2),
			viewId: t,
			name: n,
			count: Number.isFinite(r) && r > 0 ? Math.min(9999, Math.floor(r)) : 1,
			appliedAt: a(e.appliedAt, 40) || (/* @__PURE__ */ new Date()).toISOString()
		});
	}
	function c(e) {
		if (!Array.isArray(e)) return [];
		let t = [], n = /* @__PURE__ */ new Set();
		for (let r of e.slice(0, 40)) {
			let e = s(r);
			if (e && !n.has(e.id) && (n.add(e.id), t.push(e), t.length >= 20)) break;
		}
		return t;
	}
	function l(t = e.localStorage) {
		try {
			return c(JSON.parse(t?.getItem?.(n) || "[]"));
		} catch {
			return [];
		}
	}
	function u(t, r = e.localStorage) {
		try {
			return r?.setItem?.(n, JSON.stringify(c(t))), e.dispatchEvent?.(new e.CustomEvent("hafize:prompt-library-smart-view-history-changed")), !0;
		} catch {
			return !1;
		}
	}
	function d(t, n = e.localStorage) {
		if (!t?.id || !t?.name) return !1;
		let r = l(n), i = r[0];
		return i?.viewId === t.id ? u([s({
			...i,
			name: t.name,
			count: i.count + 1,
			appliedAt: (/* @__PURE__ */ new Date()).toISOString()
		}), ...r.slice(1)], n) : u([s({
			viewId: t.id,
			name: t.name,
			count: 1,
			appliedAt: (/* @__PURE__ */ new Date()).toISOString()
		}), ...r].slice(0, 20), n);
	}
	function f(t = e.localStorage) {
		return u([], t);
	}
	function p(t, n = e.localStorage) {
		return u(l(n).filter((e) => e.viewId !== t), n);
	}
	function m(t) {
		return e.HafizePromptLibrarySmartViews?.load?.(e.localStorage)?.find?.((e) => e.id === t) || null;
	}
	function h(t, n) {
		let r = m(t.viewId), i = e.HafizePromptLibrarySmartViews;
		if (!r || !i || !n) return !1;
		i.applyView(r, n);
		let a = i.loadState(e.localStorage);
		i.saveState({
			...a,
			activeId: r.id
		}, e.localStorage);
		let o = e.HafizePromptLibrary?.loadItems?.(e.localStorage) || [], s = new Set(i.evaluate(o, r).map((e) => e.id));
		n.querySelectorAll(".prompt-item[data-prompt-id]").forEach((e) => {
			e.hidden = !s.has(e.dataset.promptId);
		});
		try {
			typeof e.StorageEvent == "function" && e.dispatchEvent(new e.StorageEvent("storage", {
				key: i.STATE_KEY,
				newValue: e.localStorage?.getItem?.(i.STATE_KEY) || null,
				storageArea: e.localStorage
			}));
		} catch {}
		return d(r), !0;
	}
	function g(n = e.document, s = e) {
		let c = n?.getElementById?.("promptLibraryCard");
		if (!n || !c || n.getElementById(t)) return null;
		let u = n.createElement("section");
		u.id = t, u.className = "prompt-library-smart-view-history", u.setAttribute("aria-labelledby", "promptSmartViewHistoryTitle");
		let m = n.createElement("div");
		m.className = "prompt-smart-view-history-head";
		let g = r(n, "Son kullanılan görünümler", "prompt-smart-view-history-title");
		g.id = "promptSmartViewHistoryTitle";
		let _ = r(n, "0", "prompt-smart-view-history-count"), v = i(n, "Gizle");
		v.setAttribute("aria-expanded", "true"), v.setAttribute("aria-controls", "promptSmartViewHistoryBody"), m.append(g, _, v);
		let y = n.createElement("div");
		y.id = "promptSmartViewHistoryBody", y.className = "prompt-smart-view-history-body";
		let b = n.createElement("div");
		b.className = "prompt-smart-view-history-toolbar";
		let x = n.createElement("input");
		x.type = "search", x.maxLength = 80, x.placeholder = "Geçmişte ara…", x.setAttribute("aria-label", "Görünüm geçmişinde ara");
		let S = i(n, "Geçmişi temizle");
		b.append(x, S);
		let C = n.createElement("div");
		C.className = "prompt-smart-view-history-list", C.setAttribute("role", "list");
		let w = r(n, "", "prompt-smart-view-history-status");
		w.setAttribute("role", "status"), w.setAttribute("aria-live", "polite"), y.append(b, C, w), u.append(m, y), c.append(u);
		let T = !1;
		function E(e) {
			w.textContent = a(e, 160);
		}
		function D() {
			let e = l(s.localStorage), t = e.filter((e) => o(e.name).includes(o(x.value)));
			if (_.textContent = t.length + "/" + e.length, C.replaceChildren(), !t.length) C.append(r(n, e.length ? "Eşleşen kullanım kaydı yok." : "Henüz görünüm kullanılmadı.", "prompt-smart-view-history-empty"));
			else for (let e of t) {
				let t = n.createElement("article");
				t.className = "prompt-smart-view-history-row", t.dataset.smartViewHistoryId = e.viewId, t.setAttribute("role", "listitem");
				let a = n.createElement("div");
				a.className = "prompt-smart-view-history-info", a.append(r(n, e.name, "prompt-smart-view-history-name"));
				let o = new Intl.DateTimeFormat("tr-TR", {
					dateStyle: "medium",
					timeStyle: "short"
				}).format(new Date(e.appliedAt));
				a.append(r(n, e.count + " kullanım · " + o, "prompt-smart-view-history-meta"));
				let l = n.createElement("div");
				l.className = "prompt-smart-view-history-actions";
				let u = i(n, "Uygula"), d = i(n, "Kaldır");
				l.append(u, d), t.append(a, l), C.append(t), u.addEventListener("click", () => {
					if (!h(e, c)) return E("Bu görünüm artık mevcut değil.");
					E("Görünüm yeniden uygulandı."), D();
				}), d.addEventListener("click", () => {
					p(e.viewId, s.localStorage), E("Geçmiş kaydı kaldırıldı."), D();
				});
			}
		}
		x.addEventListener("input", D), S.addEventListener("click", () => {
			s.confirm?.("Akıllı görünüm kullanım geçmişi temizlensin mi?") && (f(s.localStorage), E("Görünüm geçmişi temizlendi."), D());
		});
		let O = (t) => {
			let n = a(t.detail?.id, 120), r = e.HafizePromptLibrarySmartViews?.load?.(s.localStorage)?.find?.((e) => e.id === n);
			r && d(r, s.localStorage);
		}, k = D;
		return s.addEventListener?.("hafize:prompt-library-smart-view-applied", O), s.addEventListener?.("hafize:prompt-library-smart-view-history-changed", k), v.addEventListener("click", () => {
			T = !T, y.hidden = T, v.textContent = T ? "Göster" : "Gizle", v.setAttribute("aria-expanded", String(!T));
		}), D(), Object.freeze({
			mounted: !0,
			refresh: D,
			load: l,
			record: d,
			clear: f,
			remove: p,
			destroy: () => {
				s.removeEventListener?.("hafize:prompt-library-smart-view-applied", O), s.removeEventListener?.("hafize:prompt-library-smart-view-history-changed", k), u.remove();
			}
		});
	}
	e.HafizePromptLibrarySmartViewsHistory = Object.freeze({
		STORAGE_KEY: n,
		MAX_ITEMS: 20,
		normalizeEntry: s,
		normalizeHistory: c,
		load: l,
		save: u,
		record: d,
		clear: f,
		remove: p,
		applyFromHistory: h,
		mount: g
	});
	let _ = () => g(e.document, e);
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", _, { once: !0 }) : _();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "promptLibrarySmartViewBuilder", n = (e, t, n) => {
		let r = e.createElement("span");
		return n && (r.className = n), r.textContent = String(t ?? ""), r;
	}, r = (e, t) => {
		let n = e.createElement("button");
		return n.type = "button", n.className = "mini-btn prompt-smart-view-builder-action", n.textContent = t, n;
	}, i = (e, t) => String(e ?? "").replace(/\0/g, "").trim().slice(0, t), a = (e) => String(e ?? "").toLocaleLowerCase("tr-TR");
	function o(e) {
		return {
			favoriteOnly: e.querySelector("#promptLibraryFavoriteFilter")?.getAttribute("aria-pressed") === "true",
			tag: e.querySelector(".prompt-library-filters select")?.value || "all",
			sort: e.querySelector(".prompt-library-toolbar select")?.value || "updated-desc"
		};
	}
	function s() {
		let t = e.HafizePromptLibrary?.loadItems?.(e.localStorage) || [], n = /* @__PURE__ */ new Map();
		for (let e of t) for (let t of Array.isArray(e.tags) ? e.tags : []) {
			let e = a(t);
			n.has(e) || n.set(e, t);
		}
		return [...n.values()].sort((e, t) => e.localeCompare(t, "tr")).slice(0, 40);
	}
	function c(e, t, n, r, a, o) {
		let s = [], c = i(e, 120);
		return c && s.push(c.includes(" ") ? "\"" + c + "\"" : c), t && t !== "all" && s.push("tag:" + i(t, 24)), n === "yes" && s.push("is:favorite"), n === "no" && s.push("is:not-favorite"), r === "yes" && s.push("has:variable"), r === "no" && s.push("has:no-variable"), Number(a) > 0 && s.push("used:>=" + Math.min(9999, Math.floor(Number(a)))), Number(o) < 9999 && s.push("used:<=" + Math.max(0, Math.floor(Number(o)))), s.join(" ").slice(0, 180);
	}
	function l(t) {
		let n = e.HafizePromptLibrary?.loadItems?.(e.localStorage) || [], r = e.HafizePromptLibrarySmartViews;
		return r ? r.evaluate(n, t).length : 0;
	}
	function u(t, n) {
		let r = e.HafizePromptLibrarySmartViews;
		if (!r || !n) return !1;
		r.applyView(t, n), r.saveState({
			...r.loadState(e.localStorage),
			activeId: ""
		}, e.localStorage);
		let i = e.HafizePromptLibrary?.loadItems?.(e.localStorage) || [], a = new Set(r.evaluate(i, t).map((e) => e.id));
		return n.querySelectorAll(".prompt-item[data-prompt-id]").forEach((e) => {
			e.hidden = !a.has(e.dataset.promptId);
		}), !0;
	}
	function d(d = e.document, f = e) {
		let p = d?.getElementById?.("promptLibraryCard");
		if (!d || !p || d.getElementById(t)) return null;
		let m = d.createElement("section");
		m.id = t, m.className = "prompt-library-smart-view-builder", m.setAttribute("aria-labelledby", "promptSmartViewBuilderTitle");
		let h = d.createElement("div");
		h.className = "prompt-smart-view-builder-head";
		let g = n(d, "Hızlı sorgu oluşturucu", "prompt-smart-view-builder-title");
		g.id = "promptSmartViewBuilderTitle";
		let _ = n(d, "0 kayıt", "prompt-smart-view-builder-count"), v = r(d, "Gizle");
		v.setAttribute("aria-expanded", "true"), v.setAttribute("aria-controls", "promptSmartViewBuilderBody"), h.append(g, _, v);
		let y = d.createElement("div");
		y.id = "promptSmartViewBuilderBody", y.className = "prompt-smart-view-builder-body";
		let b = d.createElement("input");
		b.type = "search", b.maxLength = 120, b.placeholder = "Metin…", b.setAttribute("aria-label", "Sorguda aranacak metin");
		let x = d.createElement("select");
		x.setAttribute("aria-label", "Sorgu etiketi");
		let S = d.createElement("option");
		S.value = "all", S.textContent = "Tüm etiketler", x.append(S), s().forEach((e) => {
			let t = d.createElement("option");
			t.value = e, t.textContent = e, x.append(t);
		});
		let C = d.createElement("select");
		C.setAttribute("aria-label", "Favori filtresi"), [
			["all", "Favori filtresi yok"],
			["yes", "Yalnız favoriler"],
			["no", "Favori olmayanlar"]
		].forEach(([e, t]) => {
			let n = d.createElement("option");
			n.value = e, n.textContent = t, C.append(n);
		});
		let w = d.createElement("select");
		w.setAttribute("aria-label", "Değişken filtresi"), [
			["all", "Değişken filtresi yok"],
			["yes", "Değişkenli"],
			["no", "Değişkensiz"]
		].forEach(([e, t]) => {
			let n = d.createElement("option");
			n.value = e, n.textContent = t, w.append(n);
		});
		let T = d.createElement("input");
		T.type = "number", T.min = "0", T.max = "9999", T.value = "0", T.inputMode = "numeric", T.setAttribute("aria-label", "En az kullanım");
		let E = d.createElement("input");
		E.type = "number", E.min = "0", E.max = "9999", E.value = "9999", E.inputMode = "numeric", E.setAttribute("aria-label", "En fazla kullanım");
		let D = d.createElement("input");
		D.type = "text", D.maxLength = 180, D.placeholder = "Açıklama (isteğe bağlı)…", D.setAttribute("aria-label", "Görünüm açıklaması");
		let O = d.createElement("div");
		O.className = "prompt-smart-view-builder-grid", O.append(L(d, "Metin", b), L(d, "Etiket", x), L(d, "Favori", C), L(d, "Değişken", w), L(d, "Min. kullanım", T), L(d, "Maks. kullanım", E));
		let k = n(d, "Sorgu: —", "prompt-smart-view-builder-query"), A = n(d, "Sonuç anında hesaplanır; gerçek sohbet gönderimi yapılmaz.", "prompt-smart-view-builder-help"), j = d.createElement("div");
		j.className = "prompt-smart-view-builder-actions";
		let M = r(d, "Uygula"), N = r(d, "Görünüm olarak kaydet"), P = r(d, "Temizle");
		j.append(M, N, P);
		let F = n(d, "", "prompt-smart-view-builder-status");
		F.setAttribute("role", "status"), F.setAttribute("aria-live", "polite"), y.append(O, D, k, A, j, F), m.append(h, y), p.append(m);
		let I = !1;
		function L(e, t, r) {
			let i = e.createElement("label");
			return i.className = "prompt-smart-view-builder-field", i.append(n(e, t, "prompt-smart-view-builder-label"), r), i;
		}
		function R() {
			let e = Math.max(0, Math.min(9999, Number(T.value) || 0)), t = Math.max(e, Math.min(9999, Number(E.value) || 9999)), n = o(p);
			return {
				name: "",
				description: i(D.value, 180),
				query: c(b.value, x.value, C.value, w.value, e, t),
				favoriteOnly: C.value === "yes",
				tag: x.value,
				sort: n.sort,
				minUse: e,
				maxUse: t,
				hasVariables: w.value === "yes"
			};
		}
		function z(e) {
			F.textContent = i(e, 160);
		}
		function B() {
			let e = R();
			_.textContent = l(e) + " kayıt", k.textContent = "Sorgu: " + (e.query || "—");
		}
		function V() {
			b.value = "", x.value = "all", C.value = "all", w.value = "all", T.value = "0", E.value = "9999", D.value = "", B(), b.focus();
		}
		[
			b,
			x,
			C,
			w,
			T,
			E
		].forEach((e) => {
			e.addEventListener("input", B), e.addEventListener("change", B);
		}), D.addEventListener("input", () => {
			D.value = i(D.value, 180);
		}), M.addEventListener("click", () => {
			u(R(), p) && (z("Geçici akıllı görünüm uygulandı."), f.dispatchEvent?.(new f.CustomEvent("hafize:prompt-library-smart-view-applied", { detail: {
				id: "",
				name: "Hızlı sorgu"
			} })));
		}), N.addEventListener("click", () => {
			let e = f.HafizePromptLibrarySmartViews;
			if (!e) return z("Akıllı görünüm modülü bulunamadı.");
			let t = e.load(f.localStorage);
			if (t.length >= e.MAX_VIEWS) return z("Akıllı görünüm sınırı dolu.");
			let n = R(), r = i(D.value, 180) || "Yeni akıllı görünüm", o = r, s = new Set(t.map((e) => a(e.name))), c = 2;
			for (; s.has(a(o));) o = i(r + " " + c++, 72);
			let l = e.normalizeView({
				...n,
				id: f.crypto?.randomUUID?.() || String(Date.now()),
				name: o,
				description: i(D.value, 180),
				createdAt: (/* @__PURE__ */ new Date()).toISOString(),
				updatedAt: (/* @__PURE__ */ new Date()).toISOString()
			});
			if (!l) return z("Görünüm oluşturulamadı.");
			if (!e.save([l, ...t].slice(0, e.MAX_VIEWS), f.localStorage)) return z("Görünüm kaydedilemedi.");
			let u = e.loadState(f.localStorage);
			e.saveState({
				...u,
				activeId: l.id
			}, f.localStorage), z("Akıllı görünüm kaydedildi."), typeof f.StorageEvent == "function" && f.dispatchEvent?.(new f.StorageEvent("storage", {
				key: e.STATE_KEY,
				newValue: f.localStorage?.getItem?.(e.STATE_KEY) || null,
				storageArea: f.localStorage
			}));
		}), P.addEventListener("click", V), v.addEventListener("click", () => {
			I = !I, y.hidden = I, v.textContent = I ? "Göster" : "Gizle", v.setAttribute("aria-expanded", String(!I));
		});
		let H = (e) => {
			(e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "q" && (e.target?.matches?.("input,textarea,select,[contenteditable=\"true\"]") || (e.preventDefault(), b.focus(), b.select()));
		};
		return d.addEventListener("keydown", H), B(), Object.freeze({
			mounted: !0,
			refresh: B,
			viewFromForm: R,
			buildQuery: c,
			destroy: () => d.removeEventListener("keydown", H)
		});
	}
	e.HafizePromptLibrarySmartViewBuilder = Object.freeze({
		buildQuery: c,
		previewCount: l,
		mount: d
	});
	let f = () => d(e.document, e);
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", f, { once: !0 }) : f();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "promptLibrarySmartViewSafety", n = "hafize.prompt-library.smart-views.v1", r = n + ".repair-checkpoint", i = 3e5, a = (e, t, n) => {
		let r = e.createElement("span");
		return n && (r.className = n), r.textContent = String(t ?? ""), r;
	}, o = (e, t, n = "mini-btn") => {
		let r = e.createElement("button");
		return r.type = "button", r.className = n, r.textContent = t, r;
	}, s = (t = e.localStorage) => {
		try {
			let e = t?.getItem?.(n);
			return {
				readable: !0,
				value: e ? JSON.parse(e) : []
			};
		} catch {
			return {
				readable: !1,
				value: []
			};
		}
	}, c = (t, r = e.localStorage) => {
		try {
			return r?.setItem?.(n, JSON.stringify(t)), e.dispatchEvent?.(new e.CustomEvent("hafize:prompt-library-smart-views-changed")), !0;
		} catch {
			return !1;
		}
	}, l = (t, n = e.localStorage) => {
		try {
			let e = JSON.stringify({
				version: 1,
				createdAt: (/* @__PURE__ */ new Date()).toISOString(),
				views: t
			});
			return e.length > i ? !1 : (n?.setItem?.(r, e), !0);
		} catch {
			return !1;
		}
	}, u = (t = e.localStorage) => {
		try {
			let e = JSON.parse(t?.getItem?.(r) || "null");
			return e && Array.isArray(e.views) ? e : null;
		} catch {
			return null;
		}
	}, d = (t = e.localStorage) => {
		try {
			return t?.removeItem?.(r), !0;
		} catch {
			return !1;
		}
	};
	function f(e) {
		if (!e || typeof e != "object") return "Geçersiz nesne";
		let t = [];
		(typeof e.name != "string" || !e.name.trim()) && t.push("boş ad"), typeof e.name == "string" && e.name.length > 72 && t.push("uzun ad"), typeof e.query == "string" && e.query.length > 180 && t.push("uzun sorgu"), Number.isFinite(Number(e.minUse)) && Number.isFinite(Number(e.maxUse)) && Number(e.minUse) > Number(e.maxUse) && t.push("kullanım aralığı ters");
		let n = e.sort || e.core?.sort || "";
		return n && ![
			"updated-desc",
			"favorite-first",
			"created-desc",
			"title-asc"
		].includes(n) && t.push("geçersiz sıralama"), t.join(", ");
	}
	function p(t = e.localStorage) {
		let n = s(t);
		if (!n.readable) return {
			readable: !1,
			rawCount: 0,
			validCount: 0,
			invalidCount: 0,
			duplicateIds: [],
			duplicateNames: [],
			overCapacity: !1,
			issues: []
		};
		let r = Array.isArray(n.value) ? n.value : [], i = [], a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Map();
		r.forEach((e, t) => {
			let n = f(e);
			n && i.push({
				index: t,
				reason: n
			});
			let r = typeof e?.id == "string" ? e.id : "", s = typeof e?.name == "string" ? e.name.trim().toLocaleLowerCase("tr-TR") : "";
			r && a.set(r, (a.get(r) || 0) + 1), s && o.set(s, (o.get(s) || 0) + 1);
		});
		let c = [...a.entries()].filter(([, e]) => e > 1).map(([e]) => e).slice(0, 24), l = [...o.entries()].filter(([, e]) => e > 1).map(([e]) => e).slice(0, 24), u = [
			...i.map((e) => "#" + (e.index + 1) + ": " + e.reason),
			...c.map((e) => "Yinelenen id: " + e),
			...l.map((e) => "Yinelenen ad: " + e),
			...r.length > 24 ? ["Kapasite: " + r.length + "/24"] : []
		];
		return {
			readable: !0,
			rawCount: r.length,
			validCount: Math.max(0, r.length - i.length),
			invalidCount: i.length,
			invalid: i,
			duplicateIds: c,
			duplicateNames: l,
			overCapacity: r.length > 24,
			issues: u.slice(0, 80)
		};
	}
	function m(t = e.localStorage) {
		let n = s(t);
		if (!n.readable) return {
			ok: !1,
			reason: "STORAGE_UNREADABLE",
			views: [],
			repaired: 0
		};
		let r = e.HafizePromptLibrarySmartViews, i = Array.isArray(n.value) ? n.value : [], a = [], o = /* @__PURE__ */ new Set(), c = /* @__PURE__ */ new Set(), l = 0;
		for (let t of i.slice(0, 48)) {
			let n = r?.normalizeView?.(t);
			if (!n) {
				l += 1;
				continue;
			}
			let s = n.id;
			for (; o.has(s);) s = e.crypto?.randomUUID?.() || String(Date.now()) + "-" + Math.random().toString(16).slice(2), l += 1;
			let u = n.name, d = 2;
			for (; c.has(u.toLocaleLowerCase("tr-TR"));) u = (n.name + " " + d++).slice(0, 72), l += 1;
			if ((s !== n.id || u !== n.name) && (n = {
				...n,
				id: s,
				name: u,
				updatedAt: (/* @__PURE__ */ new Date()).toISOString()
			}), o.add(n.id), c.add(n.name.toLocaleLowerCase("tr-TR")), a.push(n), a.length >= 24) {
				i.length > a.length && (l += i.length - a.length);
				break;
			}
		}
		return {
			ok: !0,
			reason: "",
			views: a,
			repaired: l
		};
	}
	function h(t = e.localStorage) {
		let n = s(t);
		if (!n.readable) return "";
		let r = {
			version: 1,
			source: "hafize-prompt-smart-views-recovery",
			exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
			views: Array.isArray(n.value) ? n.value : []
		}, a = JSON.stringify(r, null, 2);
		return a.length <= i ? a : "";
	}
	function g(t = e.localStorage) {
		let n = s(t);
		if (!n.readable) return {
			ok: !1,
			reason: "STORAGE_UNREADABLE",
			views: [],
			repaired: 0
		};
		let r = m(t);
		return r.ok ? l(Array.isArray(n.value) ? n.value : [], t) ? c(r.views, t) ? (e.dispatchEvent?.(new e.CustomEvent("hafize:prompt-library-smart-views-repaired", { detail: { repaired: r.repaired } })), r) : {
			ok: !1,
			reason: "WRITE_FAILED",
			views: [],
			repaired: 0
		} : {
			ok: !1,
			reason: "CHECKPOINT_FAILED",
			views: [],
			repaired: 0
		} : r;
	}
	function _(t = e.localStorage) {
		let n = u(t);
		return n ? c(n.views, t) ? (d(t), {
			ok: !0,
			reason: "",
			restored: n.views.length
		}) : {
			ok: !1,
			reason: "RESTORE_FAILED"
		} : {
			ok: !1,
			reason: "NO_CHECKPOINT"
		};
	}
	function v(t, n) {
		try {
			let r = new Blob([t], { type: "application/json;charset=utf-8" }), i = URL.createObjectURL(r), a = e.document.createElement("a");
			return a.href = i, a.download = n, a.click(), e.setTimeout?.(() => URL.revokeObjectURL(i), 0), !0;
		} catch {
			return !1;
		}
	}
	function y(i = e.document, s = e) {
		let c = i?.getElementById?.("promptLibraryCard");
		if (!i || !c || i.getElementById(t)) return null;
		let l = i.createElement("section");
		l.id = t, l.className = "prompt-library-smart-view-safety", l.setAttribute("aria-labelledby", "promptSmartViewSafetyTitle");
		let d = i.createElement("div");
		d.className = "prompt-smart-view-safety-head";
		let f = a(i, "Görünüm sağlığı", "prompt-smart-view-safety-title");
		f.id = "promptSmartViewSafetyTitle";
		let m = a(i, "", "prompt-smart-view-safety-status"), y = o(i, "Gizle");
		y.setAttribute("aria-expanded", "true"), y.setAttribute("aria-controls", "promptSmartViewSafetyBody"), d.append(f, m, y);
		let b = i.createElement("div");
		b.id = "promptSmartViewSafetyBody", b.className = "prompt-smart-view-safety-body";
		let x = i.createElement("div");
		x.className = "prompt-smart-view-safety-metrics";
		let S = i.createElement("div");
		S.className = "prompt-smart-view-safety-issues", S.setAttribute("role", "list");
		let C = i.createElement("div");
		C.className = "prompt-smart-view-safety-actions";
		let w = o(i, "Tara"), T = o(i, "Yedek indir"), E = o(i, "Güvenli onarım"), D = o(i, "Son onarımı geri al");
		C.append(w, T, E, D), b.append(x, S, C), l.append(d, b), c.append(l);
		let O = !1, k = null;
		function A(e, t) {
			let n = i.createElement("div");
			return n.className = "prompt-smart-view-safety-metric", n.append(a(i, e, "prompt-smart-view-safety-label")), n.append(a(i, t, "prompt-smart-view-safety-value")), n;
		}
		function j(e) {
			if (k = e, x.replaceChildren(), S.replaceChildren(), !e.readable) {
				m.textContent = "Görünüm storage alanı okunamıyor; onarım yapılmadı.", E.disabled = !0, D.disabled = !0;
				return;
			}
			let t = e.invalidCount + e.duplicateIds.length + e.duplicateNames.length + +!!e.overCapacity;
			x.append(A("Kayıt", e.rawCount), A("Geçerli", e.validCount), A("Sorun", t), A("Kapasite", e.rawCount + "/24")), e.issues.length ? e.issues.slice(0, 16).forEach((e) => {
				let t = a(i, e, "prompt-smart-view-safety-issue");
				t.setAttribute("role", "listitem"), S.append(t);
			}) : S.append(a(i, "Sorun bulunmadı.", "prompt-smart-view-safety-ok")), E.disabled = t === 0, D.disabled = !u(s.localStorage), m.textContent = t ? "Tarama sorunlar buldu; güvenli onarım checkpoint oluşturur." : "Tarama tamamlandı; görünüm verisi tutarlı.";
		}
		w.addEventListener("click", () => j(p(s.localStorage))), T.addEventListener("click", () => {
			let e = h(s.localStorage);
			if (!e) return m.textContent = "Kurtarma yedeği üretilemedi veya boyut sınırı aşıldı.";
			m.textContent = v(e, "hafize-prompt-smart-views-recovery.json") ? "Kurtarma yedeği indirildi." : "Kurtarma yedeği indirilemedi.";
		}), E.addEventListener("click", () => {
			if (k || j(p(s.localStorage)), !k || !s.confirm?.("Sorunlu görünüm kayıtları güvenli biçimde normalize edilsin mi?")) return;
			let e = g(s.localStorage);
			m.textContent = e.ok ? e.repaired + " düzeltme uygulandı." : "Onarım başarısız: " + e.reason, j(p(s.localStorage));
		}), D.addEventListener("click", () => {
			if (!s.confirm?.("Son görünüm onarımı geri alınsın mı?")) return;
			let e = _(s.localStorage);
			m.textContent = e.ok ? e.restored + " görünüm geri yüklendi." : "Geri alma başarısız: " + e.reason, j(p(s.localStorage));
		}), y.addEventListener("click", () => {
			O = !O, b.hidden = O, y.textContent = O ? "Göster" : "Gizle", y.setAttribute("aria-expanded", String(!O));
		});
		let M = (e) => {
			(e.key === n || e.key === r) && j(p(s.localStorage));
		};
		return s.addEventListener?.("storage", M), j(p(s.localStorage)), Object.freeze({
			mounted: !0,
			scan: () => j(p(s.localStorage)),
			analyze: () => p(s.localStorage),
			applyRepair: () => g(s.localStorage),
			undoRepair: () => _(s.localStorage),
			destroy: () => {
				s.removeEventListener?.("storage", M), l.remove();
			}
		});
	}
	e.HafizePromptLibrarySmartViewsSafety = Object.freeze({
		STORAGE_KEY: n,
		CHECKPOINT_KEY: r,
		MAX_VIEWS: 24,
		MAX_QUERY: 180,
		MAX_NAME: 72,
		MAX_CHECKPOINT: i,
		analyze: p,
		normalizeRepair: m,
		exportCheckpoint: h,
		applyRepair: g,
		undoRepair: _,
		readCheckpoint: u,
		mount: y
	});
	let b = () => y(e.document, e);
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", b, { once: !0 }) : b();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "/api/health", n = "/api/connectors/gmail/status", r = "/api/connectors/canva/status", i = "hafize.connector-hub.v1", a = Object.freeze([
		"accountConnectionCard",
		"gmailConnectionCard",
		"canvaConnectionCard",
		"githubWriteReadinessCard"
	]), o = "connectorHubStyle", s = "hafize:connector-hub-changed", c = Object.freeze({
		github: Object.freeze([
			"repository.read",
			"directory.read",
			"compare.read",
			"commit.read",
			"pull.read"
		]),
		gmail: Object.freeze(["gmail.read"]),
		canva: Object.freeze([
			"profile.read",
			"asset.read",
			"design.meta.read",
			"design.content.read"
		])
	}), l = Object.freeze({
		github: Object.freeze({
			label: "GitHub",
			description: "Repository okuma ve çalışma alanı verileri.",
			detail: "Tarayıcı GitHub tokenı görmez; yazma işlemleri bu yüzeyde etkin değildir."
		}),
		gmail: Object.freeze({
			label: "Google / Gmail",
			description: "Gmail salt-okunur erişimi.",
			detail: "Bağlantı durumu sunucudan kontrol edilir; OAuth tokenı tarayıcı storageına yazılmaz."
		}),
		canva: Object.freeze({
			label: "Canva",
			description: "Canva salt-okunur varlık ve tasarım verileri.",
			detail: "Bağlantı durumu kullanıcı oturumu üzerinden sunucuda sorgulanır."
		})
	});
	function u(e, t, n) {
		let r = e.createElement("span");
		return n && (r.className = n), r.textContent = String(t ?? ""), r;
	}
	function d(e, t, n) {
		let r = e.createElement("button");
		return r.type = "button", r.className = n || "connector-hub-btn", r.textContent = t, r;
	}
	function f(e) {
		try {
			return e.sessionStorage || null;
		} catch {
			return null;
		}
	}
	function p(e) {
		try {
			let t = f(e)?.getItem(i), n = JSON.parse(t || "{}");
			return n && typeof n == "object" && n.collapsed === !0;
		} catch {
			return !1;
		}
	}
	function m(e, t) {
		try {
			f(e)?.setItem(i, JSON.stringify({ collapsed: t === !0 }));
		} catch {}
	}
	function h(e) {
		if (!e?.head || typeof e.createElement != "function") return null;
		let t = e.getElementById(o);
		if (t) return Object.freeze({
			owned: !1,
			node: t
		});
		let n = e.createElement("link");
		return n.id = o, n.rel = "stylesheet", n.href = "/connector-hub.css", e.head.append(n), Object.freeze({
			owned: !0,
			node: n
		});
	}
	function g(e, t, n, r, i) {
		let a = e.createElement("div");
		return a.className = "connector-hub-status-row", a.dataset.connector = t, a.append(u(e, n, "connector-hub-provider"), u(e, r, "connector-hub-state"), u(e, i, "connector-hub-detail")), a;
	}
	function _(e, t, n, r) {
		let i = e.createElement("section");
		i.id = t, i.className = "utility-card connector-hub-card", i.setAttribute("aria-labelledby", t + "Title");
		let a = e.createElement("div");
		a.className = "connector-hub-head";
		let o = e.createElement("strong");
		o.id = t + "Title", o.textContent = n;
		let s = u(e, "Bekleniyor", "connector-hub-badge");
		return a.append(o, s), i.append(a, u(e, r, "connector-hub-description")), Object.freeze({
			section: i,
			head: a,
			badge: s
		});
	}
	function v(i = e.document, a = e) {
		let o = i?.querySelector?.(".utility-rail");
		if (!i || !o || typeof i.createElement != "function" || i.getElementById("connectorHubMarker")) return null;
		let f = i.createElement("span");
		f.id = "connectorHubMarker", f.hidden = !0, f.setAttribute("aria-hidden", "true"), o.prepend(f);
		let v = h(i);
		if (!v) return f.remove(), null;
		let y = [], b = [], x = !1, S = !1, C = 0, w = p(a);
		function T(e, t, n) {
			e?.addEventListener && e?.removeEventListener && (e.addEventListener(t, n), y.push(() => e.removeEventListener(t, n)));
		}
		let E = _(i, "accountConnectionCard", "Bağlantılar", "Kullanıcı oturumuna bağlı connector durumlarını tek yerde gör."), D = _(i, "gmailConnectionCard", l.gmail.label, l.gmail.description), O = _(i, "canvaConnectionCard", l.canva.label, l.canva.description), k = _(i, "githubWriteReadinessCard", l.github.label, l.github.description);
		b.push(E.section, D.section, O.section, k.section);
		let A = i.createElement("div");
		A.id = "connectorHubBody", A.className = "connector-hub-body";
		let j = Object.freeze({
			health: null,
			gmail: null,
			canva: null
		}), M = u(i, "Kimlik bilgileri tarayıcıda gösterilmez; durum sorguları GET ile yapılır.", "connector-hub-privacy"), N = d(i, "Durumları yenile", "connector-hub-btn connector-hub-refresh"), P = d(i, "Tanı özetini kopyala"), F = i.createElement("div");
		F.className = "connector-hub-summary-actions", F.append(M, N, P);
		let I = u(i, "Henüz yenilenmedi.", "connector-hub-last");
		A.append(F, I);
		let L = d(i, w ? "Göster" : "Gizle");
		L.className = "connector-hub-btn connector-hub-toggle", L.setAttribute("aria-expanded", String(!w)), L.setAttribute("aria-controls", "connectorHubBody"), E.head.append(L), E.section.append(A);
		let R = i.createElement("div");
		R.className = "connector-hub-provider-body", D.section.append(R);
		let z = i.createElement("div");
		z.className = "connector-hub-provider-body", O.section.append(z);
		let B = i.createElement("div");
		B.className = "connector-hub-provider-body", B.append(g(i, "github", "Salt-okunur erişim", "Bekleniyor", "Sunucu yapılandırması kontrol ediliyor."), u(i, "Yazma, branch oluşturma, commit ve PR merge işlemleri bu panelden çalıştırılmaz.", "connector-hub-note")), k.section.append(B), o.prepend(E.section, D.section, O.section, k.section);
		function V(e, t, n) {
			e.badge.textContent = t, e.badge.dataset.state = String(n || t).toLowerCase();
		}
		function H(e, t) {
			let n = c[t] || [], r = i.createElement("div");
			r.className = "connector-hub-capabilities";
			for (let e of n) {
				let t = u(i, e, "connector-hub-capability");
				t.setAttribute("role", "note"), r.append(t);
			}
			return r;
		}
		function U(e, t, n, r, a) {
			e.replaceChildren(g(i, n, "Bağlantı", r, a), u(i, "İzinli yetenekler", "connector-hub-capability-title"), H(e, n)), V(t, r, r);
		}
		function W(e) {
			e?.error === "AUTH_REQUIRED" ? U(R, D, "gmail", "Oturum gerekli", "Uygulama oturumu olmadan durum okunamaz.") : e?.linked === !0 ? U(R, D, "gmail", "Bağlı", l.gmail.detail) : e?.error === "GMAIL_NOT_CONFIGURED" ? U(R, D, "gmail", "Devre dışı", "Sunucu connector kimliği yapılandırılmamış.") : U(R, D, "gmail", "Bağlı değil", "Google hesabı bağlantısı bulunmuyor.");
		}
		function G(e) {
			e?.error === "AUTH_REQUIRED" ? U(z, O, "canva", "Oturum gerekli", "Uygulama oturumu olmadan durum okunamaz.") : e?.linked === !0 ? U(z, O, "canva", "Bağlı", l.canva.detail) : e?.error === "CANVA_NOT_CONFIGURED" ? U(z, O, "canva", "Devre dışı", "Sunucu Canva connector kimliği yapılandırılmamış.") : U(z, O, "canva", "Bağlı değil", "Canva hesabı bağlantısı bulunmuyor.");
		}
		function K(e) {
			let t = [
				[
					"github",
					"GitHub",
					e?.githubReadConfigured === !0
				],
				[
					"gmail",
					"Google / Gmail",
					e?.gmailReadConfigured === !0
				],
				[
					"canva",
					"Canva",
					e?.canvaReadConfigured === !0
				]
			];
			E.section.querySelectorAll(".connector-hub-status-row").forEach((e) => {
				e.remove();
			});
			let n = i.createDocumentFragment();
			for (let e of t) n.append(g(i, e[0], e[1], e[2] ? "Hazır" : "Kapalı", e[2] ? "Sunucu connector kapasitesi hazır." : "Sunucu connector kapasitesi kapalı."));
			E.head.after(n);
			let r = t.filter((e) => e[2]).length;
			return V(E, r + "/" + t.length + " hazır", r + "/" + t.length), r;
		}
		function q() {
			try {
				return new Intl.DateTimeFormat("tr-TR", {
					hour: "2-digit",
					minute: "2-digit",
					second: "2-digit"
				}).format(/* @__PURE__ */ new Date());
			} catch {
				return "şimdi";
			}
		}
		async function J(e) {
			if (typeof a.fetch != "function") return Object.freeze({ error: "FETCH_UNAVAILABLE" });
			let t = a.AbortController, n = typeof t == "function" ? new t() : null, r = n ? a.setTimeout(() => n.abort(), 8e3) : 0;
			try {
				let t = await a.fetch(e, {
					method: "GET",
					credentials: "same-origin",
					headers: { accept: "application/json" },
					signal: n?.signal
				});
				if (!t?.ok) {
					let e = {};
					try {
						e = await t.json();
					} catch {}
					return Object.freeze({ error: e?.error || "HTTP_" + String(t?.status || 0) });
				}
				return await t.json();
			} catch (e) {
				return Object.freeze({ error: e?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR" });
			} finally {
				r && a.clearTimeout(r);
			}
		}
		async function Y({ force: e = !1 } = {}) {
			let i = Date.now();
			if (S || !e && i - C < 900) return !1;
			S = !0, C = i, N.disabled = !0, N.textContent = "Yenileniyor…";
			let o, c, l;
			try {
				if ([o, c, l] = await Promise.all([
					J(t),
					J(n),
					J(r)
				]), x) return !1;
				K(o), W(c), G(l), j = Object.freeze({
					health: o,
					gmail: c,
					canva: l
				});
				let e = [
					o,
					c,
					l
				].filter((e) => e?.error && ![
					"AUTH_REQUIRED",
					"GMAIL_NOT_CONFIGURED",
					"CANVA_NOT_CONFIGURED"
				].includes(e.error)), i = [c?.linked === !0, l?.linked === !0].filter(Boolean).length;
				E.section.dataset.connectedCount = String(i), I.textContent = e.length ? "Bazı durumlar okunamadı · " + q() : "Son yenileme · " + q();
				let u = a.CustomEvent || globalThis.CustomEvent;
				return typeof u == "function" && a.dispatchEvent?.(new u(s, { detail: {
					connected: i,
					failures: e.length
				} })), e.length === 0;
			} finally {
				x || (N.disabled = !1, N.textContent = "Durumları yenile", S = !1);
			}
		}
		function X() {
			A.hidden = w, L.textContent = w ? "Göster" : "Gizle", L.setAttribute("aria-expanded", String(!w));
		}
		function Z() {
			w = !w, m(a, w), X();
		}
		async function Q() {
			let e = j, t = [
				"Hafize Bağlantılar Tanı Özeti",
				"GitHub: " + (e.health?.githubReadConfigured === !0 ? "hazır" : "kapalı"),
				"Google / Gmail: " + (e.gmail?.linked === !0 ? "bağlı" : "bağlı değil"),
				"Canva: " + (e.canva?.linked === !0 ? "bağlı" : "bağlı değil"),
				"Zaman: " + q()
			];
			try {
				if (typeof a.navigator?.clipboard?.writeText != "function") return;
				await a.navigator.clipboard.writeText(t.join("\\n")), I.textContent = "Tanı özeti panoya kopyalandı · " + q();
			} catch {
				I.textContent = "Tanı özeti panoya kopyalanamadı · " + q();
			}
		}
		return T(L, "click", Z), T(N, "click", () => {
			Y({ force: !0 });
		}), T(a, "hafize:workspace-changed", (e) => {
			!x && e?.detail?.workspace === "connections" && Y();
		}), T(P, "click", () => {
			Q();
		}), T(a, s, () => {
			x || Y();
		}), X(), Y({ force: !0 }), X(), Y({ force: !0 }), Object.freeze({
			mount: !0,
			refresh: Y,
			getState: () => Object.freeze({
				collapsed: w,
				refreshing: S
			}),
			getSnapshot: () => j,
			destroy: () => {
				if (!x) {
					for (x = !0; y.length;) try {
						y.pop()();
					} catch {}
					b.forEach((e) => e.remove()), f.remove(), v.owned && v.node.remove();
				}
			}
		});
	}
	let y = Object.freeze({
		HEALTH_URL: t,
		GMAIL_STATUS_URL: n,
		CANVA_STATUS_URL: r,
		SESSION_KEY: i,
		CARD_IDS: a,
		PROVIDERS: l,
		CAPABILITIES: c,
		createController: v,
		mount: function(e, t) {
			try {
				return v(e, t);
			} catch {
				return null;
			}
		}
	});
	e.HafizeConnectorHub = y;
	let b = () => {
		let t = y.mount(e.document, e);
		return t && (e.HafizeConnectorHubController = t), t;
	};
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", b, { once: !0 }) : b();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "hafize.composer-history.v1", n = "hafize.composer-history.settings.v1", r = 12e3, i = Object.freeze([
		0,
		10,
		20,
		40
	]), a = (e) => String(e ?? "").replace(/\0/g, "").slice(0, r), o = () => {
		try {
			let t = JSON.parse(e.localStorage?.getItem?.(n) || "{}");
			return {
				enabled: t.enabled !== !1,
				maxItems: i.includes(t.maxItems) ? t.maxItems : 40
			};
		} catch {
			return {
				enabled: !0,
				maxItems: 40
			};
		}
	}, s = (r) => {
		let a = {
			enabled: r?.enabled !== !1,
			maxItems: i.includes(r?.maxItems) ? r.maxItems : 40
		};
		try {
			return e.localStorage?.setItem?.(n, JSON.stringify(a)), (!a.enabled || a.maxItems === 0) && e.localStorage?.removeItem?.(t), !0;
		} catch {
			return !1;
		}
	};
	function c() {
		let r = e.document, i = r?.getElementById?.("messageInput");
		if (!r || !i || i.dataset.historyReady === "true") return null;
		i.dataset.historyReady = "true";
		let o = e.HafizeComposerHistory, s = o.loadSettings(), c = o.load(), l = -1, u = "", d = !1, f = !1, p = () => i.dispatchEvent(new Event("input", { bubbles: !0 })), m = (e) => {
			i.value = a(e), p();
		}, h = () => {
			l === -1 && (u = a(i.value));
		}, g = () => {
			d || (l = -1), d = !1;
		}, _ = () => {
			s = o.loadSettings(), c = o.load(), l >= c.length && (l = -1), e.dispatchEvent?.(new e.CustomEvent("hafize:composer-history-changed", { detail: { size: c.length } }));
		}, v = (t) => {
			let n = a(t).trim();
			n && s.enabled && s.maxItems !== 0 && (c = [n, ...c.filter((e) => e !== n)].slice(0, s.maxItems), o.save(c), e.dispatchEvent?.(new e.CustomEvent("hafize:composer-history-changed", { detail: { size: c.length } })));
		}, y = (e) => {
			c.length && (h(), d = !0, l = l === -1 ? e < 0 ? 0 : c.length - 1 : Math.max(0, Math.min(c.length - 1, l + e)), m(c[l]), d = !1);
		}, b = () => {
			l = -1, m(u);
		}, x = () => g(), S = (e) => {
			e.isComposing || f || !s.enabled || e.key !== "ArrowUp" && e.key !== "ArrowDown" || (i.selectionStart === 0 || i.selectionStart === i.value.length) && (e.key === "ArrowUp" ? (e.preventDefault(), y(-1)) : l < 0 || (e.preventDefault(), l >= c.length - 1 ? b() : y(1)));
		}, C = (e) => {
			f = e.type === "compositionstart";
		}, w = () => {
			v(i.value), l = -1, u = "";
		}, T = (e) => {
			(e.key === t || e.key === n) && _();
		}, E = (t) => {
			s = o.loadSettings(), c = o.load(), t?.detail?.clear && (c = [], o.save(c)), e.dispatchEvent?.(new e.CustomEvent("hafize:composer-history-changed", { detail: { size: c.length } }));
		};
		i.addEventListener("input", x), i.addEventListener("keydown", S), i.addEventListener("compositionstart", C), i.addEventListener("compositionend", C), i.closest("form")?.addEventListener("submit", w), e.addEventListener?.("storage", T), e.addEventListener?.("hafize:composer-history-settings-changed", E);
		let D = Object.freeze({
			getItems: () => c.slice(),
			add: v,
			navigate: y,
			getCursor: () => l,
			clear: () => {
				c = [], o.save(c), e.dispatchEvent?.(new e.CustomEvent("hafize:composer-history-changed", { detail: { size: 0 } }));
			},
			getSettings: () => ({ ...s }),
			setSettings: (t) => {
				let n = {
					...s,
					...t
				};
				o.saveSettings(n), s = o.loadSettings(), c = o.load(), (!s.enabled || s.maxItems === 0) && (c = []), e.dispatchEvent?.(new e.CustomEvent("hafize:composer-history-settings-changed", { detail: { ...s } }));
			},
			destroy: () => {
				i.removeEventListener("input", x), i.removeEventListener("keydown", S), i.removeEventListener("compositionstart", C), i.removeEventListener("compositionend", C), i.closest("form")?.removeEventListener("submit", w), e.removeEventListener?.("storage", T), e.removeEventListener?.("hafize:composer-history-settings-changed", E), delete i.dataset.historyReady, delete e.HafizeComposerHistoryController;
			}
		});
		return e.HafizeComposerHistoryController = D, D;
	}
	e.HafizeComposerHistory = Object.freeze({
		STORAGE_KEY: t,
		SETTINGS_KEY: n,
		MAX_ITEMS: 40,
		MAX_TEXT: r,
		RETENTION_VALUES: i,
		normalize: a,
		loadSettings: o,
		saveSettings: s,
		mount: c,
		load() {
			try {
				let n = o();
				if (!n.enabled || n.maxItems === 0) return [];
				let r = JSON.parse(e.localStorage?.getItem?.(t) || "[]");
				return Array.isArray(r) ? r.filter((e) => typeof e == "string" && e.trim()).map(a).slice(0, Math.min(40, n.maxItems)) : [];
			} catch {
				return [];
			}
		},
		save(n) {
			let r = o();
			if (!r.enabled || r.maxItems === 0) try {
				return e.localStorage?.removeItem?.(t), !0;
			} catch {
				return !1;
			}
			try {
				return e.localStorage?.setItem?.(t, JSON.stringify(n.slice(0, Math.min(40, r.maxItems)))), !0;
			} catch {
				return !1;
			}
		}
	}), e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", c, { once: !0 }) : c();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "composerHistoryPanel";
	function n() {
		return e.HafizeComposerHistory;
	}
	function r() {
		return e.HafizeComposerHistoryController;
	}
	function i(e, t, n, r) {
		let i = e.createElement(t);
		return r && (i.className = r), n !== void 0 && (i.textContent = String(n)), i;
	}
	function a(e, t, n) {
		let r = i(e, "button", t, n || "mini-btn");
		return r.type = "button", r.textContent = t, r;
	}
	function o(e) {
		return n()?.normalize?.(e) || String(e ?? "").slice(0, 12e3);
	}
	function s() {
		let s = e.document, c = s?.getElementById?.("messageInput"), l = c?.closest?.("form");
		if (!s || !c || !l || s.getElementById(t)) return null;
		let u = a(s, "Geçmiş", "composer-history-toggle");
		u.id = "composerHistoryToggle", u.setAttribute("aria-expanded", "false"), u.setAttribute("aria-controls", t), u.title = "Yerel gönderim geçmişini aç", (l.querySelector(".composer-tools") || l.querySelector(".composer-row"))?.prepend(u);
		let d = i(s, "section", void 0, "composer-history-panel");
		d.id = t, d.hidden = !0, d.setAttribute("aria-labelledby", "composerHistoryTitle");
		let f = i(s, "div", void 0, "composer-history-head"), p = i(s, "strong", "Gönderim geçmişi");
		p.id = "composerHistoryTitle";
		let m = a(s, "Kapat");
		f.append(p, m);
		let h = i(s, "input");
		h.type = "search", h.maxLength = 80, h.placeholder = "Geçmişte ara…", h.setAttribute("aria-label", "Gönderim geçmişinde ara");
		let g = i(s, "div", "", "composer-history-meta"), _ = i(s, "div", void 0, "composer-history-list");
		_.setAttribute("role", "list");
		let v = i(s, "div", void 0, "composer-history-footer"), y = a(s, "Geçmişi temizle");
		v.append(y), d.append(f, h, g, _, v), l.after(d);
		let b = "", x = !1, S = 0, C = (e) => {
			x = !!e, d.hidden = !x, u.setAttribute("aria-expanded", String(x)), x && (h.focus(), h.select(), E());
		}, w = () => {
			let e = r()?.getItems?.() || n()?.load?.() || [], t = b.toLocaleLowerCase("tr-TR");
			return e.filter((e) => !t || e.toLocaleLowerCase("tr-TR").includes(t)).slice(0, 40);
		}, T = (e) => {
			c.value = o(e), c.dispatchEvent(new Event("input", { bubbles: !0 })), c.focus(), C(!1);
		}, E = () => {
			if (!d || !s.getElementById(t)) return;
			_.replaceChildren();
			let e = r()?.getItems?.().length || 0, n = w();
			g.textContent = b ? `${n.length}/${e} kayıt gösteriliyor` : `${e} kayıt`, n.length ? n.forEach((e, t) => {
				let n = i(s, "article", void 0, "composer-history-row");
				n.setAttribute("role", "listitem");
				let o = i(s, "div", e.replace(/\s+/g, " ").slice(0, 180), "composer-history-text");
				o.title = e;
				let c = a(s, "Kullan", "mini-btn");
				c.addEventListener("click", () => T(e));
				let l = a(s, "Sil", "mini-btn");
				l.setAttribute("aria-label", `Geçmiş kaydını sil: ${e.slice(0, 60)}`), l.addEventListener("click", () => {
					let t = (r()?.getItems?.() || []).filter((t) => t !== e);
					r()?.clear?.(), t.slice().reverse().forEach((e) => r()?.add?.(e)), E();
				});
				let u = i(s, "span", `${t + 1}.`, "composer-history-rank");
				n.append(u, o, c, l), _.append(n);
			}) : _.append(i(s, "div", e ? "Arama sonucu yok." : "Henüz gönderilmiş bir mesaj yok.", "composer-history-empty"));
		}, D = () => {
			e.clearTimeout?.(S), S = e.setTimeout?.(E, 40) || 0;
		}, O = () => D(), k = () => {
			b = String(h.value || "").trim().slice(0, 80), E();
		}, A = (e) => {
			e.key === "Escape" && x && (e.preventDefault(), C(!1), u.focus()), e.key.toLowerCase() === "h" && (e.ctrlKey || e.metaKey) && e.shiftKey && (e.preventDefault(), C(!x));
		}, j = () => C(!x), M = () => C(!1), N = () => {
			r()?.getItems?.().length && e.confirm?.("Yerel gönderim geçmişinin tamamı silinsin mi?") && (r()?.clear?.(), b = "", h.value = "", E());
		};
		return u.addEventListener("click", j), m.addEventListener("click", M), h.addEventListener("input", k), y.addEventListener("click", N), s.addEventListener("keydown", A), e.addEventListener?.("storage", O), e.addEventListener?.("hafize:composer-history-changed", O), E(), e.HafizeComposerHistoryPanel = Object.freeze({
			open: () => C(!0),
			close: () => C(!1),
			refresh: E,
			getQuery: () => b,
			destroy: () => {
				e.clearTimeout?.(S), u.removeEventListener("click", j), m.removeEventListener("click", M), h.removeEventListener("input", k), y.removeEventListener("click", N), s.removeEventListener("keydown", A), e.removeEventListener?.("storage", O), e.removeEventListener?.("hafize:composer-history-changed", O), u.remove(), d.remove(), delete e.HafizeComposerHistoryPanel;
			}
		}), e.HafizeComposerHistoryPanel;
	}
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", s, { once: !0 }) : s();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = 512e3, n = () => e.HafizeComposerHistory, r = () => e.HafizeComposerHistoryController, i = (e) => (Array.isArray(e) ? e : []).filter((e) => typeof e == "string" && e.trim()).map((e) => n()?.normalize?.(e) || String(e).slice(0, 12e3));
	function a() {
		let e = i(r()?.getItems?.() || []);
		return JSON.stringify({
			version: 1,
			source: "hafize-composer-history",
			exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
			items: e
		}, null, 2).slice(0, 512e3);
	}
	function o(e) {
		if (typeof e != "string" || e.length > t) return {
			ok: !1,
			reason: "size"
		};
		try {
			let t = JSON.parse(e), a = i(Array.isArray(t) ? t : t?.items);
			if (!a.length) return {
				ok: !0,
				items: []
			};
			let o = i(r()?.getItems?.() || []);
			return {
				ok: !0,
				items: [...a, ...o.filter((e) => !a.includes(e))].slice(0, n()?.MAX_ITEMS || 40)
			};
		} catch {
			return {
				ok: !1,
				reason: "json"
			};
		}
	}
	function s(e) {
		let t = i(e);
		return r() ? (r().clear(), t.slice().reverse().forEach((e) => r().add(e)), !0) : !1;
	}
	function c() {
		let t = e.document, n = new Blob([a()], { type: "application/json;charset=utf-8" }), r = URL.createObjectURL(n), i = t.createElement("a");
		i.href = r, i.download = "hafize-composer-history.json", i.click(), e.setTimeout?.(() => URL.revokeObjectURL(r), 0);
	}
	function l() {
		let n = e.document, r = n?.getElementById?.("composer");
		if (!n || !r || n.getElementById("composerHistoryBackup")) return null;
		let i = n.createElement("div");
		i.id = "composerHistoryBackup", i.className = "composer-history-backup";
		let l = n.createElement("button");
		l.type = "button", l.className = "mini-btn", l.textContent = "Yedeği indir";
		let u = n.createElement("button");
		u.type = "button", u.className = "mini-btn", u.textContent = "Yedeği yükle";
		let d = n.createElement("input");
		return d.type = "file", d.accept = "application/json,.json", d.hidden = !0, d.setAttribute("aria-label", "Gönderim geçmişi yedeği seç"), i.append(l, u, d), n.getElementById("composerHistoryPanel")?.querySelector(".composer-history-footer")?.prepend(i) || r.after(i), l.addEventListener("click", c), u.addEventListener("click", () => d.click()), d.addEventListener("change", () => {
			let n = d.files?.[0];
			if (d.value = "", !n || n.size > t) return;
			let r = new FileReader();
			r.onload = () => {
				let t = o(String(r.result || ""));
				t.ok && (s(t.items), e.dispatchEvent?.(new e.CustomEvent("hafize:composer-history-changed", { detail: { size: t.items.length } })));
			}, r.readAsText(n);
		}), e.HafizeComposerHistoryBackup = Object.freeze({
			exportPayload: a,
			importPayload: o,
			persistItems: s,
			download: c,
			destroy: () => i.remove()
		}), e.HafizeComposerHistoryBackup;
	}
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", l, { once: !0 }) : l();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	function t() {
		let t = e.document, n = t?.getElementById?.("composer"), r = t?.getElementById?.("messageInput");
		if (!t || !n || !r || t.getElementById("composerHistoryHelp")) return null;
		let i = t.createElement("small");
		return i.id = "composerHistoryHelp", i.className = "composer-history-help", i.textContent = "Geçmiş: ↑ / ↓ · Panel: Ctrl/⌘ + Shift + H", i.setAttribute("aria-label", "Gönderim geçmişi kısayolları: yukarı ve aşağı oklarla gezin, kontrol veya komut artı shift artı H ile paneli aç"), n.querySelector(".composer-row")?.after(i) || n.append(i), e.HafizeComposerHistoryHelp = Object.freeze({
			element: i,
			destroy: () => {
				i.remove(), delete e.HafizeComposerHistoryHelp;
			}
		}), e.HafizeComposerHistoryHelp;
	}
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", t, { once: !0 }) : t();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "composerHistorySettings", n = () => e.HafizeComposerHistoryController, r = () => e.HafizeComposerHistory;
	function i() {
		let i = e.document, a = i?.getElementById?.("composer");
		if (!i || !a || i.getElementById(t)) return null;
		let o = i.createElement("details");
		o.id = t, o.className = "composer-history-settings";
		let s = i.createElement("summary");
		s.textContent = "Geçmiş gizlilik ayarları";
		let c = i.createElement("div");
		c.className = "composer-history-settings-body";
		let l = i.createElement("label"), u = i.createElement("input");
		u.type = "checkbox", u.id = "composerHistoryEnabled", l.append(u, i.createTextNode(" Gönderim geçmişini cihazda sakla"));
		let d = i.createElement("label");
		d.append(i.createTextNode(" Saklama limiti "));
		let f = i.createElement("select");
		f.id = "composerHistoryRetention", f.setAttribute("aria-label", "Gönderim geçmişi saklama limiti");
		for (let e of r()?.RETENTION_VALUES || [
			0,
			10,
			20,
			40
		]) {
			let t = i.createElement("option");
			t.value = String(e), t.textContent = e === 0 ? "Kapalı" : `${e} kayıt`, f.append(t);
		}
		d.append(f);
		let p = i.createElement("small");
		p.textContent = "Geçmiş yalnızca bu cihazdaki localStorage alanında tutulur; sunucuya gönderilmez.", c.append(l, d, p), o.append(s, c), a.after(o);
		let m = () => {
			let e = n()?.getSettings?.() || r()?.loadSettings?.() || {
				enabled: !0,
				maxItems: 40
			};
			u.checked = e.enabled, f.value = String(e.maxItems);
		}, h = () => {
			n()?.setSettings?.({
				enabled: u.checked,
				maxItems: Number(f.value)
			}), m();
		};
		return u.addEventListener("change", h), f.addEventListener("change", h), e.addEventListener?.("hafize:composer-history-settings-changed", m), m(), e.HafizeComposerHistorySettings = Object.freeze({
			panel: o,
			refresh: m,
			destroy: () => {
				u.removeEventListener("change", h), f.removeEventListener("change", h), e.removeEventListener?.("hafize:composer-history-settings-changed", m), o.remove(), delete e.HafizeComposerHistorySettings;
			}
		}), e.HafizeComposerHistorySettings;
	}
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", i, { once: !0 }) : i();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "scheduledTasksWorkspace", n = Object.freeze([
		["Günlük özet", "Bugünkü önemli gelişmeleri özetle ve öncelikli maddeleri belirt."],
		["Satış özeti", "Satış verilerini incele; önemli sapmaları ve takip edilmesi gereken noktaları çıkar."],
		["Kod incelemesi", "Projede son değişiklikleri gözden geçir; riskleri, regresyonları ve iyileştirmeleri özetle."],
		["Araştırma özeti", "Belirtilen konu için güvenilir kaynakları incele ve kısa bir karar notu hazırla."],
		["Haftalık plan", "Önümüzdeki hafta için işleri önceliklendir ve uygulanabilir bir çalışma planı çıkar."],
		["Kontrol listesi", "Verilen görev için tamamlanma kontrol listesi oluştur ve kritik adımları işaretle."]
	]), r = (t, n, r) => {
		let i = e.document.createElement(t);
		return r && (i.className = r), n !== void 0 && (i.textContent = String(n)), i;
	};
	function i(n, r = "") {
		let i = e.document.querySelector(`#${t} .scheduled-tasks-status`);
		i && (i.textContent = String(n).slice(0, 220), i.dataset.tone = r);
	}
	function a(e) {
		if (e.querySelector(".scheduled-tasks-template-section")) return;
		let t = e.querySelector(".scheduled-tasks-create");
		if (!t) return;
		let i = r("div", void 0, "scheduled-tasks-template-section");
		i.append(r("div", "Hızlı şablonlar", "scheduled-tasks-section-title"));
		let a = r("div", void 0, "scheduled-tasks-templates");
		n.forEach(([e, t]) => {
			let n = r("button", void 0, "scheduled-task-template");
			n.type = "button", n.dataset.templateTask = t, n.append(r("strong", e), r("span", t)), a.append(n);
		}), i.append(a), t.insertBefore(i, t.querySelector(".scheduled-tasks-form-grid") || null);
	}
	function o(t) {
		let n = t.querySelector(".scheduled-tasks-list-section");
		if (!n || n.querySelector(".scheduled-tasks-filter")) return;
		let i = r("div", void 0, "scheduled-tasks-filter"), a = e.document.createElement("select");
		a.setAttribute("aria-label", "Görevleri duruma göre filtrele"), [
			["all", "Tüm durumlar"],
			["scheduled", "Planlandı"],
			["running", "Çalışıyor"],
			["completed", "Tamamlandı"],
			["failed", "Başarısız"],
			["cancelled", "İptal edildi"]
		].forEach(([e, t]) => {
			let n = r("option", t);
			n.value = e, a.append(n);
		});
		let o = r("span", "", "scheduled-tasks-filter-info");
		i.append(a, o), n.insertBefore(i, n.querySelector(".scheduled-tasks-list")), a.addEventListener("change", () => s(t, a.value, o));
	}
	function s(e, t, n) {
		let r = [...e.querySelectorAll(".scheduled-task-row")], i = 0;
		r.forEach((e) => {
			let n = t === "all" || e.dataset.status === t;
			e.hidden = !n, n && (i += 1);
		}), n && (n.textContent = `${i} görev gösteriliyor.`);
	}
	function c(n) {
		let r = n.target?.closest?.("[data-template-task]");
		if (!r) return;
		let a = e.document.querySelector(`#${t} .scheduled-tasks-create textarea`);
		a && (a.value = r.dataset.templateTask || "", a.focus(), i("Şablon görev metnine aktarıldı.", "info"));
	}
	function l(e) {
		a(e), o(e);
		let t = e.querySelector(".scheduled-tasks-filter select"), n = e.querySelector(".scheduled-tasks-filter-info");
		t && n && s(e, t.value, n);
	}
	function u() {
		if (!e.document) return;
		let n = new MutationObserver(() => {
			let n = e.document.getElementById(t);
			n && n.dataset.enhanced !== "true" && (n.dataset.enhanced = "true", l(n), n.addEventListener("click", c));
		});
		n.observe(e.document.documentElement, {
			childList: !0,
			subtree: !0
		}), e.addEventListener("beforeunload", () => n.disconnect(), { once: !0 });
	}
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", u, { once: !0 }) : u();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = (t) => {
		if (!(t.ctrlKey || t.metaKey) || !t.shiftKey || t.altKey || t.key.toLowerCase() !== "t" || t.target?.matches?.("input,textarea,select,[contenteditable=\"true\"]")) return;
		let n = e.ScheduledTasksWorkspace;
		n?.open && (t.preventDefault(), n.open());
	}, n = () => e.document?.addEventListener?.("keydown", t);
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", n, { once: !0 }) : n(), e.addEventListener?.("beforeunload", () => e.document?.removeEventListener?.("keydown", t), { once: !0 });
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "data-preview-submit-bypass", n = 2e4, r = null, i = null, a = null, o = null, s = null, c = !1, l = 0, u = [], d = function() {
		return e.document;
	}, f = function(e, t) {
		return String(e ?? "").trim().slice(0, t || 240);
	}, p = function(e, t, n) {
		let r = d().createElement(e);
		return n && (r.className = n), t !== void 0 && (r.textContent = String(t)), r;
	}, m = function(e, t, n) {
		let r = p("button", e, n || "soft-btn");
		return r.type = "button", t && (r.dataset.previewAction = t), r;
	};
	function h(e) {
		let t = new Date(e);
		return Number.isNaN(t.getTime()) ? "Geçersiz tarih" : new Intl.DateTimeFormat("tr-TR", {
			dateStyle: "full",
			timeStyle: "short"
		}).format(t);
	}
	function g(e) {
		return e && e.selectedOptions && e.selectedOptions[0] ? e.selectedOptions[0].textContent.trim() || e.value : e && e.value || "Belirtilmedi";
	}
	function _(e) {
		let t = e.querySelector("#scheduledTaskAgent"), r = e.querySelector("textarea"), i = e.querySelector("input[type=\"datetime-local\"]"), a = e.querySelector("select[aria-label=\"Maksimum deneme sayısı\"]");
		return {
			agentId: f(t && t.value, 120),
			agentLabel: f(g(t), 120),
			task: f(r && r.value, n),
			localWhen: f(i && i.value, 40),
			attempts: Math.max(1, Math.min(5, Number(a && a.value) || 1))
		};
	}
	function v(e) {
		let t = [];
		e.agentId || t.push("Geçerli bir ajan seçmelisin."), e.task || t.push("Görev metni boş olamaz."), e.localWhen || t.push("Çalıştırma zamanı seçilmelidir.");
		let r = Date.parse(e.localWhen);
		return (!Number.isFinite(r) || r <= Date.now()) && t.push("Çalıştırma zamanı gelecekte olmalı."), e.task.length > n && t.push("Görev metni sınırı aşıldı."), t;
	}
	function y(e) {
		return {
			agentId: e.agentId,
			task: e.task,
			runAt: new Date(e.localWhen).toISOString(),
			maxAttempts: e.attempts
		};
	}
	function b(e) {
		let t = Date.parse(e || "");
		if (!Number.isFinite(t)) return "Zaman hesaplanamadı";
		let n = Math.max(0, t - Date.now()), r = Math.floor(n / 1e3), i = Math.floor(r / 86400), a = Math.floor(r % 86400 / 3600), o = Math.floor(r % 3600 / 60), s = r % 60;
		return i ? "T-" + i + " gün " + a + " saat" : a ? "T-" + a + " saat " + o + " dk" : o ? "T-" + o + " dk " + s + " sn" : "T-" + s + " sn";
	}
	function x(e) {
		let t = a && a.querySelector(".scheduled-task-preview-countdown");
		t && (t.textContent = b(e));
	}
	function S(t) {
		clearInterval(l), x(t), l = e.setInterval ? e.setInterval(function() {
			x(t);
		}, 1e3) : 0;
	}
	function C() {
		clearInterval(l), l = 0;
	}
	function w(t) {
		try {
			e.dispatchEvent?.(new e.CustomEvent("hafize:scheduled-preview-activity", { detail: { label: String(t).slice(0, 120) } }));
		} catch {}
	}
	function T(e, t) {
		let n = a && a.querySelector(".scheduled-task-preview-status");
		n && (n.textContent = f(e, 220), n.dataset.tone = t || "");
	}
	function E(e) {
		let t = a && a.querySelector("[role=\"dialog\"]");
		if (!t) return;
		let n = Array.from(t.querySelectorAll("button,input,select,textarea,[tabindex]:not([tabindex=\"-1\"])")).filter(function(e) {
			return !e.disabled && !e.hidden;
		});
		if (!n.length) return;
		let r = n[0], i = n[n.length - 1];
		e.shiftKey && d().activeElement === r ? (e.preventDefault(), i.focus()) : !e.shiftKey && d().activeElement === i && (e.preventDefault(), r.focus());
	}
	function D() {
		if (!a) return;
		a.hidden = !0, C(), w("Önizleme kapatıldı.");
		let e = s;
		s = null, o = null, e && e.focus && e.focus();
	}
	function O() {
		if (!o) return;
		let e = o.form, n = _(e), r = v(n);
		if (r.length) {
			k(n), T(r[0], "error");
			return;
		}
		e.setAttribute(t, "true"), w("Planlama onaylandı.");
		let i = d().activeElement;
		D();
		try {
			typeof e.requestSubmit == "function" ? e.requestSubmit() : e.dispatchEvent(new Event("submit", {
				bubbles: !0,
				cancelable: !0
			}));
		} catch {
			e.removeAttribute(t), s = i, A(), a.hidden = !1, T("Görev gönderimi başlatılamadı.", "error"), a.querySelector("[data-preview-action=\"confirm\"]") && a.querySelector("[data-preview-action=\"confirm\"]").focus();
		}
	}
	function k(e) {
		let t = {
			task: e.task || "—",
			agent: e.agentLabel || e.agentId || "—",
			when: h(e.localWhen),
			attempts: String(e.attempts)
		};
		Object.keys(t).forEach(function(e) {
			let n = a && a.querySelector("[data-preview-field=\"" + e + "\"]");
			n && (n.textContent = t[e]);
		});
		let n = a && a.querySelector(".scheduled-task-preview-payload");
		n && (n.textContent = JSON.stringify(y(e), null, 2));
		let r = v(e), i = a && a.querySelector("[data-preview-action=\"confirm\"]");
		i && (i.disabled = r.length > 0);
	}
	function A() {
		if (a || !d() || !d().body) return a;
		a = p("div", void 0, "scheduled-task-preview-overlay"), a.id = "scheduledTaskPreviewDialog", a.hidden = !0;
		let t = p("section");
		t.className = "scheduled-task-preview-shell", t.setAttribute("role", "dialog"), t.setAttribute("aria-modal", "true"), t.setAttribute("aria-labelledby", "scheduledTaskPreviewTitle"), t.setAttribute("aria-describedby", "scheduledTaskPreviewDescription");
		let n = p("div", void 0, "scheduled-task-preview-head"), r = p("h2", "Görev planlama önizlemesi", "scheduled-task-preview-title");
		r.id = "scheduledTaskPreviewTitle", n.append(r, m("Kapat", "close", "mini-btn"));
		let i = p("p", "Bu özet onaylanana kadar sunucuya görev gönderilmez.", "scheduled-task-preview-description");
		i.id = "scheduledTaskPreviewDescription";
		let o = p("div", void 0, "scheduled-task-preview-summary"), s = p("div", void 0, "scheduled-task-preview-task");
		s.append(p("strong", "Görev metni")), s.append(p("p", "", "scheduled-task-preview-task-value"));
		let c = p("dl", void 0, "scheduled-task-preview-meta");
		[
			["Ajan", "agent"],
			["Çalıştırma", "when"],
			["Maksimum deneme", "attempts"]
		].forEach(function(e) {
			c.append(p("dt", e[0]), p("dd", "", "scheduled-task-preview-" + e[1]));
		});
		let l = p("div", "", "scheduled-task-preview-countdown");
		l.setAttribute("aria-live", "polite");
		let f = p("div", "", "scheduled-task-preview-timezone");
		f.setAttribute("aria-live", "polite"), f.textContent = "Zaman dilimi: " + (Intl.DateTimeFormat().resolvedOptions().timeZone || "yerel");
		let h = p("pre", "", "scheduled-task-preview-payload");
		h.hidden = !0;
		let g = m("İstek ayrıntılarını göster", "toggle-payload", "mini-btn"), _ = m("Güvenli özeti kopyala", "copy", "mini-btn");
		o.append(s, c, l, f, g, h, _);
		let v = p("div", "", "scheduled-task-preview-status");
		v.setAttribute("role", "status"), v.setAttribute("aria-live", "polite");
		let y = p("div", void 0, "scheduled-task-preview-actions");
		return y.append(m("Düzenle", "back", "mini-btn"), m("Onayla ve planla", "confirm", "soft-btn")), y.lastElementChild.classList.add("primary"), t.append(n, i, o, v, y), a.append(t), d().body.append(a), a.addEventListener("click", async function(t) {
			let n = t.target && t.target.closest ? t.target.closest("[data-preview-action]") : null, r = n && n.dataset.previewAction;
			if (r === "close" || r === "back") w(r === "back" ? "Düzenlemeye dönüldü." : "Önizleme kapatıldı."), D();
			else if (r === "confirm") O();
			else if (r === "toggle-payload") {
				let e = a.querySelector(".scheduled-task-preview-payload"), t = a.querySelector("[data-preview-action=\"toggle-payload\"]");
				e && (e.hidden = !e.hidden), t && (t.textContent = e?.hidden ? "İstek ayrıntılarını göster" : "İstek ayrıntılarını gizle");
			} else if (r === "copy") {
				let t = a.querySelector(".scheduled-task-preview-payload");
				try {
					await e.navigator?.clipboard?.writeText?.(t?.textContent || ""), T("Güvenli görev özeti panoya kopyalandı.", "info");
				} catch {
					T("Özet panoya kopyalanamadı.", "error");
				}
			} else t.target === a && D();
		}), a.addEventListener("keydown", function(e) {
			a.hidden || (e.key === "Escape" ? (e.preventDefault(), D()) : e.key === "Enter" && (e.ctrlKey || e.metaKey) ? (e.preventDefault(), O()) : e.key === "Tab" && E(e));
		}), u.push(function() {
			a.remove();
		}), a;
	}
	function j(e) {
		let t = _(e);
		o = {
			form: e,
			data: t
		}, s = d().activeElement, A(), k(t), a.hidden = !1, S(t.localWhen), w("Önizleme açıldı.");
		let n = v(t);
		T(n.length ? n[0] : "Onaydan önce görev özetini kontrol et.", n.length ? "error" : "info");
		let r = a.querySelector("[data-preview-action=\"confirm\"]"), i = a.querySelector("[data-preview-action=\"back\"]");
		n.length ? (i || r).focus() : r.focus();
	}
	function M(e) {
		let n = e.currentTarget;
		n.getAttribute(t) === "true" ? n.removeAttribute(t) : (e.preventDefault(), e.stopImmediatePropagation(), j(n));
	}
	function N(e) {
		e && r !== e && !c && (r = e, e.addEventListener("submit", M, !0), u.push(function() {
			e.removeEventListener("submit", M, !0);
		}));
	}
	function P() {
		if (c) return;
		let e = d() && d().querySelector("#scheduledTasksWorkspace .scheduled-tasks-create");
		e && N(e);
	}
	function F() {
		c || (c = !0, i && i.disconnect(), i = null, C(), D(), u.splice(0).forEach(function(e) {
			e();
		}), r = null, a = null);
	}
	function I() {
		d() && !c && (P(), i = typeof MutationObserver == "function" ? new MutationObserver(P) : null, i && i.observe(d().documentElement, {
			childList: !0,
			subtree: !0
		}), e.addEventListener && e.addEventListener("beforeunload", F, { once: !0 }));
	}
	e.ScheduledTaskPreview = Object.freeze({
		mount: I,
		open: function() {
			r && j(r);
		},
		close: D,
		validate: v,
		collect: _,
		destroy: F
	}), d() && d().readyState === "loading" ? d().addEventListener("DOMContentLoaded", I, { once: !0 }) : I();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "scheduledTasksWorkspace", n = ".scheduled-task-row[data-schedule-id]", r = !1, i = null, a = [], o = function() {
		return e.document;
	}, s = function(e, t, n) {
		let r = o().createElement(e);
		return n && (r.className = n), t !== void 0 && (r.textContent = String(t)), r;
	}, c = function(e) {
		let t = s("button", e, "mini-btn scheduled-task-duplicate-button");
		return t.type = "button", t.dataset.scheduledDuplicate = "true", t.setAttribute("aria-label", e), t;
	};
	function l(e) {
		let t = Date.now() + 3e5, n = Date.parse(e || ""), r = Number.isFinite(n) ? Math.max(t, n + 3e5) : t, i = new Date(r), a = function(e) {
			return String(e).padStart(2, "0");
		};
		return i.getFullYear() + "-" + a(i.getMonth() + 1) + "-" + a(i.getDate()) + "T" + a(i.getHours()) + ":" + a(i.getMinutes());
	}
	function u(e) {
		let n = o().getElementById(t), r = n && n.querySelector(".scheduled-tasks-create");
		if (!r) return !1;
		let i = r.querySelector("#scheduledTaskAgent"), a = r.querySelector("textarea"), s = r.querySelector("input[type=\"datetime-local\"]"), c = r.querySelector("select[aria-label=\"Maksimum deneme sayısı\"]");
		if (i && e.dataset.agentId && (i.value = e.dataset.agentId), a) {
			let t = e.querySelector(".scheduled-task-row-head strong");
			a.value = String(t?.textContent || "").slice(0, 2e4), a.focus();
		}
		return s && (s.value = l(e.dataset.runAt)), c && (c.value = String(Math.max(1, Math.min(5, Number(e.dataset.maxAttempts) || 1)))), !0;
	}
	function d(t) {
		t && e.ScheduledTasksWorkspace?.open && (e.ScheduledTasksWorkspace.open(), e.setTimeout?.(function() {
			u(t) && e.ScheduledTaskPreview?.open?.();
		}, 0));
	}
	function f(e) {
		let t = e.target?.closest?.("[data-scheduled-duplicate]");
		t && (e.preventDefault(), e.stopPropagation(), d(t.closest(n)));
	}
	function p() {
		let e = o()?.getElementById?.(t);
		e && e.querySelectorAll(n).forEach(function(e) {
			let t = e.querySelector(".scheduled-task-actions");
			t && !t.querySelector("[data-scheduled-duplicate]") && [
				"scheduled",
				"completed",
				"failed",
				"cancelled"
			].includes(e.dataset.status) && t.append(c("Tekrar planla"));
		});
	}
	function m() {
		i?.disconnect(), i = null, a.splice(0).forEach(function(e) {
			e();
		}), r = !1;
	}
	function h() {
		!r && o() && (r = !0, i = typeof MutationObserver == "function" ? new MutationObserver(p) : null, i?.observe(o().documentElement, {
			childList: !0,
			subtree: !0
		}), o().addEventListener("click", f, !0), a.push(function() {
			o().removeEventListener("click", f, !0);
		}), e.addEventListener?.("beforeunload", m, { once: !0 }), p());
	}
	e.ScheduledTaskDuplicate = Object.freeze({
		mount: h,
		futureTime: l,
		duplicate: d,
		destroy: m
	}), o()?.readyState === "loading" ? o().addEventListener("DOMContentLoaded", h, { once: !0 }) : h();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "hafize.scheduled-task-templates.v1", n = "scheduledTasksWorkspace", r = "scheduledTaskTemplates", i = 5e3, a = !1, o = null, s = null, c = [], l = function() {
		return e.document;
	}, u = function(e, t) {
		return String(e ?? "").trim().slice(0, t);
	};
	function d(e) {
		if (!e || typeof e != "object") return null;
		let t = u(e.name, 60), n = u(e.task, i), r = u(e.agentId, 120);
		return !t || !n || !r ? null : Object.freeze({
			id: u(e.id, 120) || String(Date.now()) + "-" + Math.random().toString(16).slice(2),
			name: t,
			task: n,
			agentId: r,
			maxAttempts: Math.max(1, Math.min(5, Number(e.maxAttempts) || 1))
		});
	}
	function f() {
		try {
			let n = e.localStorage?.getItem(t) || "[]", r = JSON.parse(n);
			if (!Array.isArray(r)) return [];
			let i = /* @__PURE__ */ new Set(), a = /* @__PURE__ */ new Set(), o = [];
			return r.slice(0, 24).forEach(function(e) {
				let t = d(e), n = t?.name.toLocaleLowerCase("tr-TR");
				!t || i.has(t.id) || a.has(n) || (i.add(t.id), a.add(n), o.push(t));
			}), o.slice(0, 12);
		} catch {
			return [];
		}
	}
	function p(n) {
		try {
			return e.localStorage?.setItem(t, JSON.stringify(m(n))), !0;
		} catch {
			return !1;
		}
	}
	function m(e) {
		let t = [], n = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set();
		for (let i of Array.isArray(e) ? e : []) {
			let e = d(i), a = e?.name.toLocaleLowerCase("tr-TR");
			if (!(!e || n.has(e.id) || r.has(a)) && (n.add(e.id), r.add(a), t.push(e), t.length >= 12)) break;
		}
		return t;
	}
	function h(e) {
		let t = d(e);
		if (!t) return null;
		let n = f();
		return n.length >= 12 || n.some(function(e) {
			return e.name.toLocaleLowerCase("tr-TR") === t.name.toLocaleLowerCase("tr-TR");
		}) ? null : p([t].concat(n)) ? t : null;
	}
	function g(e) {
		let t = f(), n = t.filter(function(t) {
			return t.id !== e;
		});
		return n.length !== t.length && p(n);
	}
	function _() {
		return (l()?.getElementById?.(n))?.querySelector?.(".scheduled-tasks-create") || null;
	}
	function v() {
		let e = _();
		if (!e) return null;
		let t = e.querySelector("#scheduledTaskAgent"), n = e.querySelector("textarea"), r = e.querySelector("select[aria-label=\"Maksimum deneme sayısı\"]");
		return {
			agentId: u(t?.value, 120),
			agentLabel: t?.selectedOptions?.[0]?.textContent?.trim() || t?.value || "",
			task: u(n?.value, i),
			maxAttempts: Math.max(1, Math.min(5, Number(r?.value) || 1))
		};
	}
	function y(t) {
		let n = _();
		if (!n || !t) return !1;
		let r = n.querySelector("#scheduledTaskAgent"), i = n.querySelector("textarea"), a = n.querySelector("select[aria-label=\"Maksimum deneme sayısı\"]");
		return r && (r.value = t.agentId), i && (i.value = t.task, i.focus(), i.dispatchEvent(new Event("input", { bubbles: !0 }))), a && (a.value = String(t.maxAttempts)), e.ScheduledTaskPreview?.close?.(), !0;
	}
	let b = function(e, t, n) {
		let r = l().createElement(e);
		return n && (r.className = n), t !== void 0 && (r.textContent = String(t)), r;
	}, x = function(e, t, n) {
		let r = b("button", e, n || "mini-btn");
		return r.type = "button", t && (r.dataset.templateAction = t), r;
	};
	function S(e) {
		let t = s?.querySelector?.(".scheduled-tasks-status");
		t && (t.textContent = u(e, 200));
	}
	function C() {
		if (!s) return;
		let e = s.querySelector("select[data-template-select]")?.value || "", t = f(), n = l().getElementById(r);
		if (!n) return;
		let i = n.querySelector("select[data-template-select]"), a = n.querySelector("[data-template-list]");
		i && a && (i.replaceChildren(), i.append(b("option", "Kayıtlı şablon seç")), i.firstElementChild.value = "", t.forEach(function(e) {
			let t = b("option", e.name);
			t.value = e.id, i.append(t);
		}), i.value = t.some(function(t) {
			return t.id === e;
		}) ? e : "", a.replaceChildren(), t.forEach(function(e) {
			let t = b("div", void 0, "scheduled-task-template-row");
			t.append(b("strong", e.name), b("span", e.agentId + " · deneme " + e.maxAttempts)), a.append(t);
		}));
	}
	function w() {
		if (s || !l()) return;
		let t = l().querySelector("#" + n + " .scheduled-tasks-create");
		if (!t) return;
		s = b("section", void 0, "scheduled-task-template-panel"), s.id = r, s.setAttribute("aria-labelledby", "scheduledTaskTemplatesTitle");
		let i = b("strong", "Kayıtlı görev şablonları", "scheduled-task-template-title");
		i.id = "scheduledTaskTemplatesTitle";
		let a = l().createElement("input");
		a.type = "text", a.maxLength = 60, a.placeholder = "Yeni şablon adı", a.setAttribute("aria-label", "Yeni görev şablonu adı");
		let o = x("Mevcut görevi kaydet", "save"), d = l().createElement("select");
		d.setAttribute("data-template-select", "true"), d.setAttribute("aria-label", "Kayıtlı görev şablonu");
		let p = x("Uygula", "apply"), m = x("Sil", "remove"), _ = b("div", void 0, "scheduled-task-template-toolbar");
		_.append(a, o, d, p, m);
		let w = b("div", void 0, "scheduled-task-template-list");
		w.dataset.templateList = "true", w.setAttribute("role", "list"), s.append(i, _, w);
		let T = t.querySelector(".scheduled-tasks-form-grid");
		T ? t.insertBefore(s, T) : t.append(s);
		let E = function(t) {
			let n = t.target?.closest?.("[data-template-action]");
			if (!n) return;
			let r = n.dataset.templateAction, i = f().find(function(e) {
				return e.id === d.value;
			});
			if (r === "save") {
				let e = v(), t = u(a.value, 60);
				if (!e?.agentId || !e.task || !t) return S("Şablon adı, ajan ve görev metni gerekli.");
				let n = h({
					name: t,
					task: e.task,
					agentId: e.agentId,
					maxAttempts: e.maxAttempts
				});
				if (!n) return S("Şablon eklenemedi; ad benzersiz ve kapasite uygun olmalı.");
				a.value = "", C(), d.value = n.id, S("Görev şablonu cihaza kaydedildi.");
			} else if (r === "apply") {
				if (!i) return S("Uygulanacak şablon seçilmedi.");
				if (!y(i)) return S("Görev formu bulunamadı.");
				S("Şablon görev formuna aktarıldı.");
			} else if (r === "remove") {
				if (!i) return S("Silinecek şablon seçilmedi.");
				if (!e.confirm?.("Bu görev şablonu silinsin mi?")) return;
				g(i.id) && (C(), S("Görev şablonu silindi."));
			}
		};
		_.addEventListener("click", E), c.push(function() {
			_.removeEventListener("click", E);
		}), C();
	}
	function T() {
		s || w(), s && !l().getElementById(r) && (s = null), s || w();
	}
	function E() {
		o?.disconnect(), o = null, c.splice(0).forEach(function(e) {
			e();
		}), l()?.getElementById?.(r)?.remove?.(), s = null, a = !1;
	}
	function D() {
		!a && l() && (a = !0, T(), o = typeof MutationObserver == "function" ? new MutationObserver(T) : null, o?.observe(l().documentElement, {
			childList: !0,
			subtree: !0
		}), e.addEventListener?.("beforeunload", E, { once: !0 }));
	}
	e.ScheduledTaskTemplates = Object.freeze({
		STORAGE_KEY: t,
		MAX_TEMPLATES: 12,
		load: f,
		add: h,
		remove: g,
		setForm: y,
		currentForm: v,
		boot: D,
		destroy: E
	}), l()?.readyState === "loading" ? l().addEventListener("DOMContentLoaded", D, { once: !0 }) : D();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = !1, n = null, r = function() {
		return e.document;
	}, i = function(e, t, n) {
		let i = r().createElement(e);
		return n && (i.className = n), t !== void 0 && (i.textContent = String(t)), i;
	};
	function a(e) {
		return String(e).padStart(2, "0");
	}
	function o(e) {
		let t = new Date(Date.now() + e * 60 * 1e3);
		return t.getFullYear() + "-" + a(t.getMonth() + 1) + "-" + a(t.getDate()) + "T" + a(t.getHours()) + ":" + a(t.getMinutes());
	}
	function s(e) {
		let t = /* @__PURE__ */ new Date();
		return t.setDate(t.getDate() + 1), t.setHours(e, 0, 0, 0), t.getFullYear() + "-" + a(t.getMonth() + 1) + "-" + a(t.getDate()) + "T" + a(t.getHours()) + ":" + a(t.getMinutes());
	}
	function c(e) {
		let t = e.querySelector(".scheduled-tasks-create"), n = t?.querySelector("input[type=\"datetime-local\"]"), r = t?.querySelector("[data-task-action=\"create\"]");
		if (!t || !n || t.querySelector(".scheduled-task-quick-times")) return;
		let a = i("div", void 0, "scheduled-task-quick-times");
		a.append(i("span", "Hızlı zaman", "scheduled-task-quick-title")), [
			["5 dk", 5],
			["30 dk", 30],
			["1 saat", 60]
		].forEach(function(e) {
			let t = i("button", e[0], "mini-btn scheduled-task-quick-time");
			t.type = "button", t.addEventListener("click", function() {
				n.value = o(e[1]), n.focus();
			}), a.append(t);
		});
		let c = i("button", "Yarın 09:00", "mini-btn scheduled-task-quick-time");
		c.type = "button", c.addEventListener("click", function() {
			n.value = s(9), n.focus();
		}), a.append(c), r && t.insertBefore(a, r);
	}
	function l(e) {
		let t = e.querySelector(".scheduled-tasks-list-section"), n = e.querySelector(".scheduled-tasks-list");
		if (!t || !n || t.querySelector(".scheduled-task-list-controls")) return;
		let a = i("div", void 0, "scheduled-task-list-controls"), o = r().createElement("input");
		o.type = "search", o.maxLength = 120, o.placeholder = "Görevlerde ara…", o.setAttribute("aria-label", "Planlanmış görevlerde ara");
		let s = r().createElement("select");
		s.setAttribute("aria-label", "Görevleri sırala"), [
			["run-asc", "Yakın tarih"],
			["run-desc", "Uzak tarih"],
			["status", "Duruma göre"],
			["task", "Göreve göre"]
		].forEach(function(e) {
			let t = i("option", e[1]);
			t.value = e[0], s.append(t);
		});
		let c = i("span", "", "scheduled-task-list-info"), l = i("button", "Filtreyi temizle", "mini-btn scheduled-task-list-clear");
		l.type = "button", a.append(o, s, l, c), t.insertBefore(a, n);
		function u() {
			let e = String(o.value || "").trim().toLocaleLowerCase("tr-TR").slice(0, 120), t = s.value, r = Array.from(n.querySelectorAll(".scheduled-task-row"));
			r.forEach(function(t) {
				let n = ((t.querySelector(".scheduled-task-row-head strong")?.textContent || "") + " " + (t.dataset.agentId || "") + " " + (t.dataset.status || "")).toLocaleLowerCase("tr-TR");
				t.dataset.searchMatch = !e || n.includes(e) ? "true" : "false";
			}), r.sort(function(e, n) {
				if (t === "task") return (e.querySelector(".scheduled-task-row-head strong")?.textContent || "").localeCompare(n.querySelector(".scheduled-task-row-head strong")?.textContent || "", "tr");
				if (t === "status") return String(e.dataset.status || "").localeCompare(String(n.dataset.status || ""), "tr") || String(e.dataset.runAt || "").localeCompare(String(n.dataset.runAt || ""));
				let r = Date.parse(e.dataset.runAt || ""), i = Date.parse(n.dataset.runAt || "");
				return t === "run-desc" ? i - r : r - i;
			}), r.forEach(function(e) {
				n.append(e);
			});
			let i = r.filter(function(e) {
				return e.dataset.searchMatch === "true" && !e.hidden;
			}).length;
			c.textContent = i + " görev gösteriliyor.";
		}
		o.addEventListener("input", u), s.addEventListener("change", u), l.addEventListener("click", function() {
			o.value = "", s.value = "run-asc", u(), o.focus();
		}), u();
	}
	function u() {
		let e = r()?.getElementById?.("scheduledTasksWorkspace");
		e && (c(e), l(e));
	}
	function d() {
		!t && r() && (t = !0, n = typeof MutationObserver == "function" ? new MutationObserver(u) : null, n?.observe(r().documentElement, {
			childList: !0,
			subtree: !0
		}), e.addEventListener?.("beforeunload", function() {
			n?.disconnect();
		}, { once: !0 }), u());
	}
	e.ScheduledTaskPlanning = Object.freeze({
		mount: d,
		localValueFromNow: o,
		tomorrowAt: s
	}), r()?.readyState === "loading" ? r().addEventListener("DOMContentLoaded", d, { once: !0 }) : d();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "hafize.scheduled-task-templates.v1", n = !1, r = null, i = null, a = [], o = function() {
		return e.document;
	}, s = function(e, t) {
		return String(e ?? "").trim().slice(0, t);
	}, c = function(e) {
		return Array.isArray(e) ? e.filter(function(e) {
			return e && typeof e == "object";
		}).slice(0, 12) : [];
	}, l = function() {
		try {
			let n = JSON.parse(e.localStorage?.getItem(t) || "[]");
			return Array.isArray(n) ? c(n) : [];
		} catch {
			return [];
		}
	}, u = function(n) {
		try {
			return e.localStorage?.setItem(t, JSON.stringify(c(n))), !0;
		} catch {
			return !1;
		}
	}, d = function(e, t, n) {
		let r = o().createElement(e);
		return n && (r.className = n), t !== void 0 && (r.textContent = String(t)), r;
	}, f = function(e, t) {
		let n = d("button", e, "mini-btn scheduled-task-template-backup-button");
		return n.type = "button", n.dataset.templateBackupAction = t, n;
	};
	function p(e) {
		let t = [], n = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set();
		for (let i of c(e)) {
			let e = s(i.name, 60), a = s(i.task, 5e3), o = s(i.agentId, 120);
			if (!e || !a || !o) continue;
			let c = e.toLocaleLowerCase("tr-TR"), l = s(i.id, 120);
			if (!(n.has(c) || l && r.has(l)) && (n.add(c), l && r.add(l), t.push({
				id: l || String(Date.now()) + "-" + Math.random().toString(16).slice(2),
				name: e,
				task: a,
				agentId: o,
				maxAttempts: Math.max(1, Math.min(5, Number(i.maxAttempts) || 1))
			}), t.length >= 12)) break;
		}
		return t;
	}
	function m() {
		let e = {
			version: 1,
			source: "hafize-scheduled-task-templates",
			exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
			templates: p(l())
		};
		return JSON.stringify(e, null, 2);
	}
	function h(e) {
		let t = p(e?.templates), n = p(l()), r = new Set(n.map(function(e) {
			return e.name.toLocaleLowerCase("tr-TR");
		})), i = 0;
		for (let e of t) {
			if (n.length >= 12) break;
			let t = e.name.toLocaleLowerCase("tr-TR");
			r.has(t) || (n.push({
				...e,
				id: String(Date.now()) + "-" + Math.random().toString(16).slice(2)
			}), r.add(t), i += 1);
		}
		return u(n) ? i : 0;
	}
	function g(t) {
		let n = e.document?.querySelector?.("#scheduledTasksWorkspace .scheduled-tasks-status");
		n && (n.textContent = s(t, 200));
	}
	function _() {
		return i || (i = o().createElement("input"), i.type = "file", i.accept = "application/json,.json", i.hidden = !0, i.addEventListener("change", function() {
			let e = i.files?.[0];
			e && (e.size > 2e5 ? (g("Şablon yedeği 200 KB sınırını aşamaz."), i.value = "") : e.text().then(function(e) {
				let t;
				try {
					t = JSON.parse(e);
				} catch {
					g("Geçersiz şablon yedeği.");
					return;
				}
				let n = h(t);
				v(), g(n + " görev şablonu geri yüklendi.");
			}).catch(function() {
				g("Şablon yedeği okunamadı.");
			}).finally(function() {
				i.value = "";
			}));
		}), o().body.append(i), a.push(function() {
			i?.remove?.(), i = null;
		}), i);
	}
	function v() {
		if (!r) return;
		let e = r.querySelector(".scheduled-task-template-backup-count");
		e && (e.textContent = l().length + "/12 şablon");
	}
	function y() {
		if (n || !o() || (n = !0, r = o().getElementById("scheduledTaskTemplates"), !r)) return;
		let t = r.querySelector(".scheduled-task-template-toolbar");
		if (!t || t.querySelector("[data-template-backup-action]")) return;
		t.append(f("Yedeği indir", "export"), f("Yedeği içe aktar", "import"), d("span", "", "scheduled-task-template-backup-count"));
		let i = function(t) {
			let n = t.target?.closest?.("[data-template-backup-action]");
			if (n) {
				if (n.dataset.templateBackupAction === "export") {
					let t = new Blob([m()], { type: "application/json;charset=utf-8" }), n = URL.createObjectURL(t), r = o().createElement("a");
					r.href = n, r.download = "hafize-scheduled-task-templates.json", r.click(), e.setTimeout?.(function() {
						URL.revokeObjectURL(n);
					}, 0), g("Görev şablonları yedeklendi.");
				} else _().click();
			}
		};
		t.addEventListener("click", i), a.push(function() {
			t.removeEventListener("click", i);
		}), v();
	}
	function b() {
		a.splice(0).forEach(function(e) {
			e();
		}), r = null, n = !1;
	}
	e.ScheduledTaskTemplateBackup = Object.freeze({
		boot: y,
		read: l,
		write: u,
		exportPayload: m,
		importPayload: h,
		destroy: b
	}), o()?.readyState === "loading" ? o().addEventListener("DOMContentLoaded", y, { once: !0 }) : y();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "scheduledTaskStatusSummary", n = [
		["scheduled", "Planlandı"],
		["running", "Çalışıyor"],
		["completed", "Tamamlandı"],
		["failed", "Başarısız"],
		["cancelled", "İptal edildi"]
	], r = null, i = !1, a = 0, o = function() {
		return e.document;
	}, s = function(e, t, n) {
		let r = o().createElement(e);
		return n && (r.className = n), t !== void 0 && (r.textContent = String(t)), r;
	};
	function c() {
		let e = o()?.getElementById?.("scheduledTasksWorkspace"), r = e?.querySelector?.(".scheduled-tasks-list");
		if (!e || !r) return;
		let i = e.querySelector("#" + t);
		i || (i = s("div", void 0, "scheduled-task-status-summary"), i.id = t, i.setAttribute("aria-label", "Görev durum özeti"), e.querySelector(".scheduled-tasks-filter")?.before(i));
		let a = new Map(n.map(function(e) {
			return [e[0], 0];
		}));
		r.querySelectorAll(".scheduled-task-row").forEach(function(e) {
			a.has(e.dataset.status) && a.set(e.dataset.status, a.get(e.dataset.status) + 1);
		}), i.replaceChildren(), n.forEach(function(t) {
			let n = s("button", void 0, "scheduled-task-status-summary-item");
			n.type = "button", n.dataset.summaryStatus = t[0], n.dataset.status = t[0], n.append(s("strong", String(a.get(t[0]) || 0)), s("span", t[1])), n.addEventListener("click", function() {
				let n = e.querySelector(".scheduled-tasks-filter select");
				n && (n.value = t[0], n.dispatchEvent(new Event("change", { bubbles: !0 })));
			}), i.append(n);
		});
	}
	function l() {
		e.clearTimeout?.(a), a = e.setTimeout?.(c, 50) || 0;
	}
	function u() {
		!i && o() && (i = !0, r = typeof MutationObserver == "function" ? new MutationObserver(l) : null, r?.observe(o().documentElement, {
			childList: !0,
			subtree: !0
		}), e.addEventListener?.("beforeunload", d, { once: !0 }), c());
	}
	function d() {
		r?.disconnect(), e.clearTimeout?.(a), r = null, i = !1;
	}
	e.ScheduledTaskStatusSummary = Object.freeze({
		boot: u,
		render: c,
		destroy: d
	}), o()?.readyState === "loading" ? o().addEventListener("DOMContentLoaded", u, { once: !0 }) : u();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "scheduledTaskPreviewDialog", n = [], r = null, i = !1, a = function() {
		return e.document;
	}, o = function(e, t, n) {
		let r = a().createElement(e);
		return n && (r.className = n), t !== void 0 && (r.textContent = String(t)), r;
	};
	function s(e) {
		n = [{
			label: String(e).slice(0, 120),
			at: (/* @__PURE__ */ new Date()).toISOString()
		}, ...n].slice(0, 8), c();
	}
	function c() {
		let e = a()?.getElementById?.(t);
		if (!e) return;
		let r = e.querySelector(".scheduled-task-preview-activity");
		r || (r = o("div", void 0, "scheduled-task-preview-activity"), r.setAttribute("aria-live", "polite"), e.querySelector(".scheduled-task-preview-status")?.after(r)), r.replaceChildren(), n.forEach(function(e) {
			let t = o("div", void 0, "scheduled-task-preview-activity-row");
			t.append(o("span", e.label), o("time", new Intl.DateTimeFormat("tr-TR", { timeStyle: "short" }).format(new Date(e.at)))), r.append(t);
		});
	}
	function l(e) {
		let t = e.detail?.label;
		typeof t == "string" && t.trim() && s(t);
	}
	function u() {
		let e = a()?.getElementById?.(t);
		e && e.dataset.activityReady !== "true" && (e.dataset.activityReady = "true", s("Önizleme hazırlandı."));
	}
	function d() {
		!i && a() && (i = !0, r = typeof MutationObserver == "function" ? new MutationObserver(u) : null, r?.observe(a().documentElement, {
			childList: !0,
			subtree: !0
		}), e.addEventListener?.("hafize:scheduled-preview-activity", l), e.addEventListener?.("beforeunload", f, { once: !0 }), u());
	}
	function f() {
		r?.disconnect(), e.removeEventListener?.("hafize:scheduled-preview-activity", l), r = null, n = [], i = !1;
	}
	e.ScheduledTaskPreviewActivity = Object.freeze({
		boot: d,
		push: s,
		render: c,
		destroy: f
	}), a()?.readyState === "loading" ? a().addEventListener("DOMContentLoaded", d, { once: !0 }) : d();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = Object.freeze([
		["Günlük haber özeti", "Günün önemli gelişmelerini güvenilir kaynaklardan derle ve kısa bir önceliklendirilmiş özet hazırla."],
		["Haftalık plan", "Önümüzdeki haftanın işleri için uygulanabilir bir plan, öncelikler ve riskler çıkar."],
		["Kod incelemesi", "Son kod değişikliklerini incele; regresyon, güvenlik ve bakım risklerini maddeler halinde belirt."],
		["Araştırma notu", "Belirtilen konuyu araştır; temel bulguları, belirsizlikleri ve takip sorularını kısa bir karar notuna dönüştür."],
		["Toplantı özeti", "Toplantı notlarını eylem maddeleri, sorumlular ve son tarihler halinde düzenle."],
		["Kontrol listesi", "Verilen işi tamamlamak için doğrulanabilir adımlardan oluşan bir kontrol listesi oluştur."]
	]), n = !1, r = null, i = () => e.document, a = (e, t, n) => {
		let r = i().createElement(e);
		return n && (r.className = n), t !== void 0 && (r.textContent = String(t)), r;
	};
	function o() {
		return (i()?.querySelector?.("#scheduledTasksWorkspace .scheduled-tasks-create"))?.querySelector("#scheduledTaskAgent")?.value || "";
	}
	function s(e) {
		let t = i()?.querySelector?.("#scheduledTasksWorkspace .scheduled-tasks-status");
		t && (t.textContent = String(e).slice(0, 200));
	}
	function c(t, n) {
		let r = e.ScheduledTaskTemplates;
		if (!r?.add) return s("Görev şablonu modülü kullanılamıyor.");
		let i = o();
		if (!i) return s("Önce bir ajan seçmelisin.");
		s(r.add({
			name: t,
			task: n,
			agentId: i,
			maxAttempts: 1
		}) ? "Başlangıç şablonu kaydedildi." : "Bu şablon zaten var veya kapasite dolu."), e.setTimeout?.(() => e.ScheduledTaskTemplateBackup?.boot?.(), 0);
	}
	function l() {
		if (r || (r = i()?.getElementById?.("scheduledTaskTemplates"), !r || r.querySelector(".scheduled-task-template-presets"))) return;
		let e = a("div", void 0, "scheduled-task-template-presets");
		e.append(a("strong", "Başlangıç şablonları", "scheduled-task-template-presets-title"));
		let n = a("div", void 0, "scheduled-task-template-presets-grid");
		t.forEach(function(e) {
			let t = a("button", void 0, "mini-btn scheduled-task-template-preset");
			t.type = "button", t.dataset.presetName = e[0], t.dataset.presetTask = e[1], t.append(a("strong", e[0]), a("span", e[1])), n.append(t);
		}), e.append(n), r.append(e), e.addEventListener("click", function(e) {
			let t = e.target?.closest?.("[data-preset-name]");
			t && c(t.dataset.presetName, t.dataset.presetTask);
		});
	}
	function u() {
		!n && i() && (n = !0, l(), e.addEventListener?.("beforeunload", d, { once: !0 }));
	}
	function d() {
		r?.querySelector?.(".scheduled-task-template-presets")?.remove?.(), r = null, n = !1;
	}
	e.ScheduledTaskTemplatePresets = Object.freeze({
		boot: u,
		presets: t,
		destroy: d
	}), i()?.readyState === "loading" ? i().addEventListener("DOMContentLoaded", u, { once: !0 }) : u();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "hafize.scheduled-task-draft.v1", n = "scheduledTasksWorkspace", r = 2e4, i = !1, a = null, o = [], s = () => e.document, c = (e, t, n) => {
		let r = s().createElement(e);
		return n && (r.className = n), t !== void 0 && (r.textContent = String(t)), r;
	};
	function l() {
		try {
			let n = JSON.parse(e.localStorage?.getItem(t) || "null");
			if (!n || typeof n != "object") return null;
			let i = Date.parse(n.savedAt || "");
			return !Number.isFinite(i) || i + 864e5 < Date.now() ? (e.localStorage?.removeItem(t), null) : {
				agentId: typeof n.agentId == "string" ? n.agentId.slice(0, 120) : "",
				task: typeof n.task == "string" ? n.task.slice(0, r) : "",
				maxAttempts: Math.max(1, Math.min(5, Number(n.maxAttempts) || 1)),
				savedAt: n.savedAt
			};
		} catch {
			return null;
		}
	}
	function u() {
		try {
			e.localStorage?.removeItem(t);
		} catch {}
	}
	function d() {
		return s()?.querySelector?.("#" + n + " .scheduled-tasks-create") || null;
	}
	function f() {
		let e = d();
		return e ? {
			agentId: String(e.querySelector("#scheduledTaskAgent")?.value || "").slice(0, 120),
			task: String(e.querySelector("textarea")?.value || "").slice(0, r),
			maxAttempts: Math.max(1, Math.min(5, Number(e.querySelector("select[aria-label=\"Maksimum deneme sayısı\"]")?.value) || 1))
		} : null;
	}
	function p(e) {
		let t = s()?.querySelector?.("#" + n + " .scheduled-tasks-status");
		t && (t.textContent = String(e).slice(0, 180));
	}
	function m() {
		let n = f();
		if (!n || !n.task.trim() && !n.agentId) return !1;
		try {
			return e.localStorage?.setItem(t, JSON.stringify({
				...n,
				savedAt: (/* @__PURE__ */ new Date()).toISOString()
			})), p("Görev taslağı cihaza kaydedildi."), !0;
		} catch {
			return p("Görev taslağı kaydedilemedi."), !1;
		}
	}
	function h() {
		let e = l(), t = d();
		if (!e || !t) return !1;
		let n = t.querySelector("#scheduledTaskAgent"), r = t.querySelector("textarea"), i = t.querySelector("select[aria-label=\"Maksimum deneme sayısı\"]");
		return n && e.agentId && (n.value = e.agentId), r && (r.value = e.task, r.dispatchEvent(new Event("input", { bubbles: !0 }))), i && (i.value = String(e.maxAttempts)), p("Yerel görev taslağı geri yüklendi."), !0;
	}
	function g() {
		if (a = d(), !a || a.querySelector(".scheduled-task-draft-tools")) return;
		let e = c("div", void 0, "scheduled-task-draft-tools"), t = c("span", "Yerel taslak", "scheduled-task-draft-title"), n = c("button", "Taslağı kaydet", "mini-btn"), r = c("button", "Taslağı geri yükle", "mini-btn"), i = c("button", "Taslağı sil", "mini-btn");
		n.type = r.type = i.type = "button", e.append(t, n, r, i);
		let l = a.querySelector(".scheduled-tasks-form-grid");
		l ? a.insertBefore(e, l) : a.append(e);
		let f = () => m(), g = () => h(), _ = () => {
			u(), p("Yerel görev taslağı silindi.");
		};
		n.addEventListener("click", f), r.addEventListener("click", g), i.addEventListener("click", _);
		let v = (e) => {
			(e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "s" && (e.target?.matches?.("input,textarea,select,[contenteditable=\"true\"]") || (e.preventDefault(), m()));
		};
		s().addEventListener("keydown", v), o.push(() => n.removeEventListener("click", f)), o.push(() => r.removeEventListener("click", g)), o.push(() => i.removeEventListener("click", _)), o.push(() => s().removeEventListener("keydown", v));
	}
	function _() {
		o.splice(0).forEach((e) => e()), a = null, i = !1;
	}
	function v() {
		if (i || !s()) return;
		i = !0, g();
		let t = typeof MutationObserver == "function" ? new MutationObserver(g) : null;
		t?.observe(s().documentElement, {
			childList: !0,
			subtree: !0
		}), e.addEventListener?.("beforeunload", () => t?.disconnect?.(), { once: !0 });
	}
	e.ScheduledTaskDraft = Object.freeze({
		STORAGE_KEY: t,
		boot: v,
		values: f,
		readDraft: l,
		saveDraft: m,
		restoreDraft: h,
		clearDraft: u,
		destroy: _
	}), s()?.readyState === "loading" ? s().addEventListener("DOMContentLoaded", v, { once: !0 }) : v();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "scheduledTaskInsights", n = !1, r = null, i = 0, a = () => e.document, o = (e, t, n) => {
		let r = a().createElement(e);
		return n && (r.className = n), t !== void 0 && (r.textContent = String(t)), r;
	};
	function s(e) {
		return Array.from(e.querySelectorAll(".scheduled-task-row"));
	}
	function c(e) {
		let t = Date.parse(e.dataset.runAt || "");
		return Number.isFinite(t) ? t : 2 ** 53 - 1;
	}
	function l() {
		let e = a()?.getElementById?.("scheduledTasksWorkspace");
		if (!e) return;
		let n = e.querySelector("#" + t);
		if (!n) {
			n = o("section", void 0, "scheduled-task-insights"), n.id = t, n.setAttribute("aria-label", "Görev planlama özeti");
			let r = o("strong", "Planlama özeti", "scheduled-task-insights-title"), i = o("div", void 0, "scheduled-task-insights-body");
			n.append(r, i), e.querySelector(".scheduled-tasks-list-section")?.before(n);
		}
		let r = n.querySelector(".scheduled-task-insights-body");
		if (!r) return;
		let i = s(e), l = {
			scheduled: 0,
			running: 0,
			completed: 0,
			failed: 0,
			cancelled: 0
		};
		i.forEach((e) => {
			l[e.dataset.status] !== void 0 && (l[e.dataset.status] += 1);
		});
		let u = i.filter((e) => e.dataset.status === "scheduled").sort((e, t) => c(e) - c(t)).slice(0, 3);
		r.replaceChildren(), [
			["Toplam", i.length],
			["Yaklaşan", l.scheduled],
			["Çalışıyor", l.running],
			["Başarısız", l.failed]
		].forEach(function(e) {
			let t = o("div", void 0, "scheduled-task-insight-stat");
			t.append(o("strong", String(e[1])), o("span", e[0])), r.append(t);
		});
		let d = o("div", void 0, "scheduled-task-insights-upcoming");
		d.append(o("span", u.length ? "Yaklaşan görevler" : "Yaklaşan görev yok", "scheduled-task-insights-subtitle")), u.forEach(function(e) {
			let t = e.querySelector(".scheduled-task-row-head strong")?.textContent || "Görev", n = o("div", void 0, "scheduled-task-insight-next");
			n.append(o("span", t), o("time", e.dataset.runAt ? new Date(e.dataset.runAt).toLocaleString("tr-TR", {
				dateStyle: "short",
				timeStyle: "short"
			}) : "Tarih yok")), d.append(n);
		}), r.append(d);
	}
	function u() {
		e.clearTimeout?.(i), i = e.setTimeout?.(l, 60) || 0;
	}
	function d() {
		!n && a() && (n = !0, r = typeof MutationObserver == "function" ? new MutationObserver(u) : null, r?.observe(a().documentElement, {
			childList: !0,
			subtree: !0
		}), e.addEventListener?.("beforeunload", f, { once: !0 }), l());
	}
	function f() {
		r?.disconnect(), e.clearTimeout?.(i), r = null, n = !1;
	}
	e.ScheduledTaskInsights = Object.freeze({
		boot: d,
		render: l,
		destroy: f
	}), a()?.readyState === "loading" ? a().addEventListener("DOMContentLoaded", d, { once: !0 }) : d();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "scheduledTasksWorkspace", n = !1, r = [], i = () => e.document, a = (e, t) => {
		let n = i().createElement("button");
		return n.type = "button", n.className = "mini-btn scheduled-task-quick-action", n.textContent = e, n.dataset.scheduleQuickAction = t, n.setAttribute("aria-label", e), n;
	};
	function o(e) {
		let n = i()?.querySelector?.("#" + t + " .scheduled-tasks-status");
		n && (n.textContent = String(e).slice(0, 180));
	}
	async function s(t, n) {
		try {
			await e.navigator?.clipboard?.writeText?.(String(t || "")), o(n);
		} catch {
			o("Panoya kopyalama kullanılamıyor.");
		}
	}
	function c() {
		let e = i()?.getElementById?.(t);
		e && e.querySelectorAll(".scheduled-task-row").forEach((e) => {
			let t = e.querySelector(".scheduled-task-actions");
			if (!t || t.querySelector("[data-schedule-quick-action]")) return;
			let n = e.querySelector(".scheduled-task-row-head strong")?.textContent || "", r = e.querySelector("[data-task-action=\"trace\"]")?.getAttribute("title") || "";
			n && t.append(a("Görevi kopyala", "copy-task")), r && t.append(a("Trace kopyala", "copy-trace"));
		});
	}
	function l(e) {
		let t = e.target?.closest?.("[data-schedule-quick-action]");
		if (!t) return;
		e.preventDefault();
		let n = t.closest(".scheduled-task-row");
		if (n) {
			if (t.dataset.scheduleQuickAction === "copy-task") return s(n.querySelector(".scheduled-task-row-head strong")?.textContent || "", "Görev metni panoya kopyalandı.");
			if (t.dataset.scheduleQuickAction === "copy-trace") return s(n.querySelector("[data-task-action=\"trace\"]")?.getAttribute("title") || "", "Trace ID panoya kopyalandı.");
		}
	}
	function u() {
		if (n || !i()) return;
		n = !0;
		let t = typeof MutationObserver == "function" ? new MutationObserver(c) : null;
		t?.observe(i().documentElement, {
			childList: !0,
			subtree: !0
		}), i().addEventListener("click", l), r.push(() => i().removeEventListener("click", l)), e.addEventListener?.("beforeunload", () => t?.disconnect(), { once: !0 }), c();
	}
	function d() {
		r.splice(0).forEach((e) => e()), n = !1;
	}
	e.ScheduledTaskActions = Object.freeze({
		boot: u,
		copy: s,
		destroy: d
	}), i()?.readyState === "loading" ? i().addEventListener("DOMContentLoaded", u, { once: !0 }) : u();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = null, n = null, r = !1, i = () => e.document, a = (e, t, n) => {
		let r = i().createElement(e);
		return n && (r.className = n), t !== void 0 && (r.textContent = String(t)), r;
	}, o = (e, t, n = "mini-btn") => {
		let r = a("button", e, n);
		return r.type = "button", r.dataset.detailAction = t, r;
	};
	function s(e) {
		if (!e) return;
		t || l(), n = i().activeElement;
		let r = {
			task: e.querySelector(".scheduled-task-row-head strong")?.textContent || "",
			status: e.querySelector(".scheduled-task-status")?.textContent || e.dataset.status || "",
			agent: e.dataset.agentId || "",
			runAt: e.dataset.runAt ? new Date(e.dataset.runAt).toLocaleString("tr-TR", {
				dateStyle: "full",
				timeStyle: "short"
			}) : "Bilinmiyor",
			attempts: (e.dataset.maxAttempts || "1") + " deneme",
			trace: e.querySelector("[data-task-action=\"trace\"]")?.getAttribute("title") || "",
			error: e.querySelector(".scheduled-task-row p")?.textContent || ""
		};
		Object.entries(r).forEach(([e, n]) => {
			let r = t.querySelector("[data-detail-field=\"" + e + "\"]");
			r && (r.textContent = n || "—");
		}), t.hidden = !1, t.querySelector("[data-detail-action=\"close\"]")?.focus();
	}
	function c() {
		t && (t.hidden = !0, n?.focus?.(), n = null);
	}
	function l() {
		t = a("div", void 0, "scheduled-task-detail-overlay"), t.id = "scheduledTaskDetailDialog", t.hidden = !0;
		let e = a("section", void 0, "scheduled-task-detail-shell");
		e.setAttribute("role", "dialog"), e.setAttribute("aria-modal", "true"), e.setAttribute("aria-labelledby", "scheduledTaskDetailTitle");
		let n = a("h2", "Görev ayrıntıları", "scheduled-task-detail-title");
		n.id = "scheduledTaskDetailTitle";
		let r = o("Kapat", "close"), s = a("div", void 0, "scheduled-task-detail-head");
		s.append(n, r);
		let l = a("dl", void 0, "scheduled-task-detail-body");
		[
			["Görev", "task"],
			["Durum", "status"],
			["Ajan", "agent"],
			["Çalıştırma", "runAt"],
			["Deneme", "attempts"],
			["Trace ID", "trace"],
			["Son hata", "error"]
		].forEach(function(e) {
			l.append(a("dt", e[0]), a("dd", "", "scheduled-task-detail-" + e[1])), l.lastElementChild.dataset.detailField = e[1];
		}), e.append(s, l), t.append(e), i().body.append(t), t.addEventListener("click", function(e) {
			(e.target?.closest?.("[data-detail-action=\"close\"]") || e.target === t) && c();
		}), t.addEventListener("keydown", function(e) {
			e.key === "Escape" && (e.preventDefault(), c());
		});
	}
	function u() {
		let e = i()?.getElementById?.("scheduledTasksWorkspace");
		e && e.querySelectorAll(".scheduled-task-row").forEach((e) => {
			let t = e.querySelector(".scheduled-task-actions");
			if (!t || t.querySelector("[data-scheduled-detail]")) return;
			let n = o("Ayrıntı", "", "mini-btn scheduled-task-detail-button");
			n.dataset.scheduledDetail = "true", n.removeAttribute("data-detail-action"), t.append(n);
		});
	}
	function d(e) {
		let t = e.target?.closest?.("[data-scheduled-detail]");
		t && (e.preventDefault(), e.stopPropagation(), s(t.closest(".scheduled-task-row")));
	}
	function f() {
		if (r || !i()) return;
		r = !0, l();
		let t = typeof MutationObserver == "function" ? new MutationObserver(u) : null;
		t?.observe(i().documentElement, {
			childList: !0,
			subtree: !0
		}), i().addEventListener("click", d, !0), e.addEventListener?.("beforeunload", () => t?.disconnect?.(), { once: !0 }), u();
	}
	e.ScheduledTaskDetail = Object.freeze({
		boot: f,
		open: s,
		close: c
	}), i()?.readyState === "loading" ? i().addEventListener("DOMContentLoaded", f, { once: !0 }) : f();
})(typeof globalThis < "u" ? globalThis : self), (function(e) {
	let t = "scheduledTasksWorkspace", n = !1, r = () => e.document, i = (e, t, n) => {
		let i = r().createElement(e);
		return n && (i.className = n), t !== void 0 && (i.textContent = String(t)), i;
	};
	function a() {
		let e = r()?.getElementById?.(t);
		return e ? Array.from(e.querySelectorAll(".scheduled-task-row")).filter((e) => !e.hidden).map((e) => ({
			scheduleId: e.dataset.scheduleId || "",
			status: e.dataset.status || "",
			agentId: e.dataset.agentId || "",
			task: e.querySelector(".scheduled-task-row-head strong")?.textContent || "",
			runAt: e.dataset.runAt || "",
			maxAttempts: Number(e.dataset.maxAttempts) || 1
		})).slice(0, 128) : [];
	}
	function o() {
		return JSON.stringify({
			version: 1,
			source: "hafize-scheduled-tasks-visible",
			exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
			schedules: a()
		}, null, 2);
	}
	function s(e) {
		let n = r()?.querySelector?.("#" + t + " .scheduled-tasks-status");
		n && (n.textContent = String(e).slice(0, 180));
	}
	function c() {
		let t = o();
		if (t.length > 25e4) return s("Dışa aktarma sınırı aşıldı.");
		let n = new Blob([t], { type: "application/json;charset=utf-8" }), i = URL.createObjectURL(n), c = r().createElement("a");
		c.href = i, c.download = "hafize-scheduled-tasks.json", c.click(), e.setTimeout?.(() => URL.revokeObjectURL(i), 0), s(a().length + " görev dışa aktarıldı.");
	}
	function l() {
		if (n || !r()) return;
		n = !0;
		let e = r().getElementById(t);
		if (!e) return;
		let a = e.querySelector(".scheduled-tasks-list-section");
		if (!a || a.querySelector("[data-scheduled-export]")) return;
		let o = i("button", "Görünenleri dışa aktar", "mini-btn scheduled-task-export-button");
		o.type = "button", o.dataset.scheduledExport = "true", o.setAttribute("aria-label", "Görünen görevleri JSON olarak dışa aktar"), a.querySelector(".scheduled-task-list-controls")?.after(o), o.parentElement || a.prepend(o), o.addEventListener("click", c);
	}
	e.ScheduledTaskExport = Object.freeze({
		boot: l,
		readVisible: a,
		payload: o,
		exportVisible: c
	}), r()?.readyState === "loading" ? r().addEventListener("DOMContentLoaded", l, { once: !0 }) : l();
})(typeof globalThis < "u" ? globalThis : self);
//#endregion
//#region public/typed/legacy/screen-share.ts
var d = /* @__PURE__ */ e(((e, t) => {
	(function(e, n) {
		let r = n();
		typeof t == "object" && t?.exports ? t.exports = r : (e.HafizeScreenShare = r, e.document && r.mountScreenShare({ root: e }));
	})(typeof globalThis < "u" ? globalThis : self, function() {
		function e(e) {
			for (let t of e?.getTracks?.() || []) try {
				t.stop();
			} catch {}
		}
		function t(e, t) {
			let n = Number.isFinite(e) && e > 0 ? e : 1, r = Number.isFinite(t) && t > 0 ? t : 1, i = Math.min(1, 1280 / n, 720 / r);
			return {
				width: Math.max(1, Math.round(n * i)),
				height: Math.max(1, Math.round(r * i))
			};
		}
		function n(e) {
			return e.videoWidth > 0 && e.videoHeight > 0 ? Promise.resolve() : new Promise((t, n) => {
				let r = () => {
					e.removeEventListener("loadedmetadata", i), e.removeEventListener("error", a);
				}, i = () => {
					r(), t();
				}, a = () => {
					r(), n(/* @__PURE__ */ Error("SCREEN_CAPTURE_VIDEO_FAILED"));
				};
				e.addEventListener("loadedmetadata", i, { once: !0 }), e.addEventListener("error", a, { once: !0 });
			});
		}
		function r(e) {
			return new Promise((t, n) => {
				e.toBlob((e) => {
					if (!e || e.type !== "image/jpeg") return n(/* @__PURE__ */ Error("SCREEN_CAPTURE_ENCODE_FAILED"));
					t(e);
				}, "image/jpeg", .82);
			});
		}
		async function i({ mediaDevices: i, document: a, explicitUserIntent: o = !1 }) {
			if (o !== !0) throw Error("SCREEN_CAPTURE_REQUIRES_EXPLICIT_USER_INTENT");
			if (typeof i?.getDisplayMedia != "function" || !a?.createElement) throw Error("SCREEN_CAPTURE_UNSUPPORTED");
			let s;
			try {
				if (s = await i.getDisplayMedia({
					video: { frameRate: {
						ideal: 1,
						max: 5
					} },
					audio: !1
				}), !s?.getVideoTracks?.()[0]) throw Error("SCREEN_CAPTURE_NO_VIDEO");
				let e = a.createElement("video");
				e.muted = !0, e.playsInline = !0, e.srcObject = s, await e.play(), await n(e);
				let o = t(e.videoWidth, e.videoHeight), c = a.createElement("canvas");
				c.width = o.width, c.height = o.height;
				let l = c.getContext("2d", { alpha: !1 });
				if (!l) throw Error("SCREEN_CAPTURE_CANVAS_FAILED");
				l.drawImage(e, 0, 0, o.width, o.height);
				let u = await r(c);
				return e.srcObject = null, Object.freeze({
					blob: u,
					width: o.width,
					height: o.height,
					mimeType: u.type,
					metadata: Object.freeze({
						explicitUserIntent: !0,
						mimeType: u.type,
						byteLength: u.size,
						width: o.width,
						height: o.height
					})
				});
			} catch (e) {
				throw e?.name === "NotAllowedError" || e?.name === "AbortError" ? Error("SCREEN_CAPTURE_CANCELLED") : e;
			} finally {
				e(s);
			}
		}
		function a({ root: e = globalThis } = {}) {
			let t = e.document, n = t?.querySelector?.("#screenShareBtn"), r = t?.querySelector?.("#screenSharePreview"), a = t?.querySelector?.("#screenShareImage"), o = t?.querySelector?.("#screenShareStatus"), s = t?.querySelector?.("#screenShareRemove");
			if (!n || !r || !a || !o || !s) return null;
			let c = null, l = null;
			function u() {
				c && e.URL?.revokeObjectURL?.(c), c = null, l = null, a.removeAttribute("src"), r.hidden = !0, n.setAttribute("aria-pressed", "false"), o.textContent = "Ekran görüntüsü tutulmuyor.";
			}
			async function d() {
				if (!n.disabled) {
					n.disabled = !0, o.textContent = "Paylaşılacak pencere veya ekranı sen seçiyorsun…";
					try {
						let s = await i({
							mediaDevices: e.navigator?.mediaDevices,
							document: t,
							explicitUserIntent: !0
						});
						u(), l = s, c = e.URL?.createObjectURL?.(s.blob) || "", c && (a.src = c), r.hidden = !1, n.setAttribute("aria-pressed", "true"), o.textContent = `${s.width}×${s.height} ekran görüntüsü yalnız bu sekmede hazır; Hafize'ye gönderilmedi.`, e.dispatchEvent?.(new e.CustomEvent("hafize:screen-capture-ready", { detail: { ...s.metadata } }));
					} catch (e) {
						e?.message === "SCREEN_CAPTURE_CANCELLED" ? o.textContent = "Ekran paylaşımı iptal edildi." : e?.message === "SCREEN_CAPTURE_UNSUPPORTED" ? o.textContent = "Bu tarayıcı ekran paylaşımını desteklemiyor." : o.textContent = "Ekran görüntüsü alınamadı.";
					} finally {
						n.disabled = !1;
					}
				}
			}
			return n.addEventListener("click", d), s.addEventListener("click", u), e.addEventListener?.("pagehide", u, { once: !0 }), Object.freeze({
				clearCapture: u,
				requestCapture: d,
				getCapture: () => l
			});
		}
		return Object.freeze({
			boundedSize: t,
			captureScreenFrame: i,
			mountScreenShare: a,
			stopStream: e
		});
	});
})), f = /* @__PURE__ */ e(((e, t) => {
	(function(e, n) {
		let r = n();
		if (typeof t == "object" && t?.exports) t.exports = r;
		else {
			e.HafizeSettingsWorkspace = r;
			let t = () => r.mount(e.document, e);
			e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", t, { once: !0 }) : t();
		}
	})(typeof globalThis < "u" ? globalThis : self, function() {
		let e = "hafize.theme.v1", t = "hafize.reduced-motion.v1", n = "hafize.conversations.v1", r = "settingsWorkspaceStyle", i = "settingsWorkspace";
		function a(t, n) {
			let r = t?.getItem?.(e);
			return r === "light" || r === "dark" ? r : n ? "dark" : "light";
		}
		function o(e) {
			return e?.getItem?.(t) === "true";
		}
		function s(e, t, n) {
			try {
				return n === null ? e?.removeItem?.(t) : e?.setItem?.(t, n), !0;
			} catch {
				return !1;
			}
		}
		function c(e) {
			try {
				let t = JSON.parse(e?.getItem?.(n) || "[]");
				return Array.isArray(t) ? t : [];
			} catch {
				return [];
			}
		}
		function l(e) {
			let t = c(e), n = t.reduce((e, t) => e + (Array.isArray(t?.messages) ? t.messages.length : 0), 0);
			return {
				conversations: t.length,
				messages: n
			};
		}
		function u(e) {
			if (!e?.head || !e.createElement) return !1;
			if (e.getElementById?.(r)) return !0;
			let t = e.createElement("link");
			return t.id = r, t.rel = "stylesheet", t.href = "/settings-workspace.css", e.head.append(t), !0;
		}
		function d(e, t, n) {
			let r = e.createElement("section");
			r.className = "settings-panel";
			let i = e.createElement("h2");
			i.textContent = t;
			let a = e.createElement("p");
			return a.textContent = n, r.append(i, a), r;
		}
		function f(e, t, n) {
			let r = e.createElement("div");
			r.className = "settings-row";
			let i = e.createElement("div");
			i.className = "settings-copy";
			let a = e.createElement("span");
			a.className = "settings-label", a.textContent = t;
			let o = e.createElement("p");
			o.textContent = n, i.append(a, o);
			let s = e.createElement("div");
			return s.className = "settings-control", r.append(i, s), {
				row: r,
				control: s
			};
		}
		function p(e, t, n) {
			let r = e.createElement("select");
			for (let i of t) {
				let t = e.createElement("option");
				t.value = i.value, t.textContent = i.label, t.selected = i.value === n, r.append(t);
			}
			return r;
		}
		function m(e, t, n = "") {
			let r = e.createElement("button");
			return r.type = "button", r.textContent = t, n && r.classList.add(n), r;
		}
		function h(e, t, n) {
			let r = e.createElement("label");
			r.className = "settings-switch";
			let i = e.createElement("input");
			i.type = "checkbox", i.checked = n;
			let a = e.createElement("span");
			return a.textContent = t, r.append(i, a), {
				wrap: r,
				input: i
			};
		}
		function g(r, a, u) {
			let g = r.createElement("section");
			g.id = i, g.className = "settings-workspace", g.hidden = !0, g.tabIndex = -1, g.setAttribute("aria-labelledby", `${i}Title`);
			let _ = d(r, "Görünüm", "Hafize’nin görünümünü ve hareket davranışını bu cihazda yerel olarak ayarla."), v = _.querySelector("h2");
			v.id = `${i}Title`;
			let y = f(r, "Tema", "Açık, koyu veya sistem temasını kullan."), b = a?.getItem?.(e), x = p(r, [
				{
					value: "system",
					label: "Sistem"
				},
				{
					value: "light",
					label: "Açık"
				},
				{
					value: "dark",
					label: "Koyu"
				}
			], b === "light" || b === "dark" ? b : "system");
			y.control.append(x);
			let S = f(r, "Azaltılmış hareket", "Animasyonları ve geçişleri mümkün olduğunca azalt."), C = h(r, "Etkin", o(a));
			S.control.append(C.wrap), _.append(y.row, S.row);
			let w = d(r, "Yerel sohbet verileri", "Sohbet geçmişi bu tarayıcının yerel depolamasında tutulur; bu ekran sunucuya veri göndermez."), T = f(r, "Depolama özeti", "Tarayıcıdaki mevcut yerel sohbet ve mesaj sayısını gösterir."), E = r.createElement("span");
			E.className = "settings-stat", T.control.append(E);
			let D = r.createElement("div");
			D.className = "settings-actions";
			let O = m(r, "Özeti yenile"), k = m(r, "Tüm sohbet geçmişini sil", "settings-danger");
			D.append(O, k), w.append(T.row, D);
			let A = d(r, "Uygulama", "PWA kurulumu ve temel klavye kısayolları."), j = f(r, "PWA", "Tarayıcın destekliyorsa Hafize’yi uygulama olarak kur."), M = m(r, "Uygulamayı yükle");
			j.control.append(M);
			let N = f(r, "Klavye", "Sohbet aramasına hızlıca geçmek için"), P = r.createElement("span");
			P.className = "settings-kbd", P.textContent = "Ctrl / ⌘ + Shift + F", N.control.append(P), A.append(j.row, N.row), g.append(_, w, A);
			function F(e) {
				let t = r.querySelector("#toast");
				t && e && (t.textContent = e, t.classList.remove("hidden"), u?.setTimeout?.(() => t.classList.add("hidden"), 2600));
			}
			function I(e) {
				let t = e === "dark" || e === "system" && u?.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
				r.documentElement.dataset.theme = t ? "dark" : "light", r.querySelector("#themeToggle")?.setAttribute("aria-pressed", String(t)), r.querySelector("meta[name=\"theme-color\"]")?.setAttribute("content", t ? "#202122" : "#f7f5f0");
			}
			function L() {
				let e = l(a);
				E.textContent = `${e.conversations} sohbet · ${e.messages} mesaj`;
			}
			function R() {
				let t = x.value;
				s(a, e, t === "system" ? null : t), I(t), F(`Tema: ${x.options[x.selectedIndex]?.textContent || t}`);
			}
			function z() {
				let e = C.input.checked;
				s(a, t, e ? "true" : "false"), r.documentElement.dataset.reducedMotion = String(e), F(e ? "Azaltılmış hareket açıldı." : "Azaltılmış hareket kapatıldı.");
			}
			function B() {
				if (!c(a).length) return F("Silinecek yerel sohbet geçmişi yok.");
				if (u?.confirm?.("Tüm yerel sohbet geçmişi silinsin mi? Bu işlem geri alınamaz.")) {
					try {
						a?.removeItem?.(n);
					} catch {
						return F("Yerel geçmiş silinemedi.");
					}
					if (typeof u?.location?.reload == "function") return u.location.reload();
					L(), r.querySelector("#conversationList")?.replaceChildren?.(), F("Yerel sohbet geçmişi silindi.");
				}
			}
			function V() {
				let e = r.querySelector("#installBtn"), t = e?.hidden === !1;
				e?.click?.(), t || F("Kurulum bu tarayıcıda şu anda kullanılamıyor.");
			}
			return x.addEventListener("change", R), C.input.addEventListener("change", z), O.addEventListener("click", L), k.addEventListener("click", B), M.addEventListener("click", V), L(), r.documentElement.dataset.reducedMotion = String(o(a)), g;
		}
		function _(e = globalThis.document, t = globalThis) {
			if (!e || !e.querySelector?.(".main")) return null;
			let n = e.getElementById?.(i);
			if (n) return n;
			u(e);
			let r = e.querySelector(".utility-rail"), a = e.querySelector(".primary-column"), o = e.querySelector(".main");
			if (!r || !a || !o) return null;
			let s = t?.localStorage, c = g(e, s, t);
			r.prepend(c);
			let d = Array.from(e.querySelectorAll(".nav-item")), f = d[3];
			f?.removeAttribute?.("disabled");
			function p(e) {
				d.forEach((t, n) => {
					let r = e ? n === 3 : t.classList.contains("active");
					t.classList.toggle("active", r), r ? t.setAttribute("aria-current", "page") : t.removeAttribute("aria-current");
				});
			}
			function m() {
				c.hidden = !1, a.hidden = !0, o.setAttribute("data-workspace", "settings");
				let t = e.querySelector("#workspaceNavigationIntro");
				t && (t.hidden = !0);
				for (let e of Array.from(r.children || [])) e !== c && e !== t && (e.hidden = !0);
				r.setAttribute("aria-label", "Hafize ayarlar çalışma alanı"), p(!0), c.focus();
			}
			function h(e) {
				e?.detail?.workspace === "settings" ? m() : c.hidden = !0, e?.detail?.workspace !== "settings" && p(!1);
			}
			return f?.addEventListener("click", (t) => {
				t.preventDefault(), m();
				let n = e.querySelector("#sidebar"), r = e.querySelector("#sidebarToggle");
				n?.classList?.contains("open") && typeof r?.click == "function" && r.click();
			}), t?.addEventListener?.("hafize:workspace-changed", h), c.hidden = !0, Object.freeze({
				view: c,
				showSettings: m,
				refresh: () => l(s)
			});
		}
		return Object.freeze({
			THEME_KEY: e,
			REDUCED_MOTION_KEY: t,
			STORAGE_KEY: n,
			readTheme: a,
			readReducedMotion: o,
			readConversations: c,
			formatCount: l,
			mount: _
		});
	});
}));
d(), f();
var p = 52;
//#endregion
export { p as HAFIZE_LEGACY_BROWSER_MODULE_COUNT };

//# sourceMappingURL=legacy-app.js.map