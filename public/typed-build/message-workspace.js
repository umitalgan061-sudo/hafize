//#region public/typed/message-workspace.ts
(() => {
	let e = "hafize.message-workspace.v1", t = "hafize:message-workspace-changed", n = /* @__PURE__ */ new Set([
		"up",
		"down",
		""
	]), r = /* @__PURE__ */ new Set([
		"newest",
		"oldest",
		"feedback",
		"notes"
	]), i = Object.freeze({
		query: "",
		filter: "all",
		sort: "newest",
		selected: []
	}), a = /* @__PURE__ */ new Set([
		"all",
		"saved",
		"feedback",
		"notes",
		"user",
		"assistant",
		"tag"
	]), o = {
		messages: document.querySelector("#messages"),
		rail: document.querySelector(".utility-rail"),
		toast: document.querySelector("#toast")
	};
	if (!o.messages || !o.rail) return;
	let s = {
		records: h(),
		state: _(),
		observer: null,
		refreshTimer: 0,
		toastTimer: 0,
		panel: null,
		search: null,
		filter: null,
		sort: null,
		status: null,
		resultList: null,
		clearButton: null,
		exportButton: null,
		selectionButton: null,
		selectionClearButton: null
	};
	function c() {
		return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	}
	function l(e) {
		return String(e ?? "").replace(/\s+/g, " ").trim();
	}
	function u(e) {
		return l(e).replace(/^#+/, "").slice(0, 24);
	}
	function d(e) {
		return String(e ?? "").replace(/\r\n?/g, "\n").trim().slice(0, 600);
	}
	function f(e) {
		return n.has(e) ? e : "";
	}
	function p(e) {
		if (!e || typeof e != "object" || typeof e.conversationId != "string" || !e.conversationId || typeof e.messageId != "string" || !e.messageId) return null;
		let t = Array.isArray(e.tags) ? [...new Set(e.tags.map(u).filter(Boolean))].slice(0, 8) : [];
		return {
			id: typeof e.id == "string" && e.id ? e.id.slice(0, 120) : `${e.conversationId}:${e.messageId}`,
			conversationId: e.conversationId.slice(0, 120),
			messageId: e.messageId.slice(0, 120),
			saved: e.saved === !0,
			feedback: f(e.feedback),
			note: d(e.note),
			tags: t,
			createdAt: m(e.createdAt) ? new Date(e.createdAt).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
			updatedAt: m(e.updatedAt) ? new Date(e.updatedAt).toISOString() : (/* @__PURE__ */ new Date()).toISOString()
		};
	}
	function m(e) {
		let t = new Date(e || "");
		return Number.isFinite(t.getTime());
	}
	function h(t = localStorage) {
		try {
			let n = JSON.parse(t.getItem(e) || "[]");
			if (!Array.isArray(n)) return [];
			let r = /* @__PURE__ */ new Set();
			return n.map(p).filter((e) => !e || r.has(e.id) ? !1 : (r.add(e.id), e.saved || e.feedback || e.note || e.tags.length)).slice(0, 240);
		} catch {
			return [];
		}
	}
	function g(e) {
		return !e || typeof e != "object" ? {
			...i,
			selected: []
		} : {
			query: typeof e.query == "string" ? l(e.query).toLocaleLowerCase("tr-TR").slice(0, 120) : "",
			filter: a.has(e.filter) ? e.filter : "all",
			sort: r.has(e.sort) ? e.sort : "newest",
			selected: Array.isArray(e.selected) ? e.selected.filter((e) => typeof e == "string").slice(0, 100) : []
		};
	}
	function _(t = localStorage) {
		try {
			return g(JSON.parse(t.getItem(`${e}.state`) || "{}"));
		} catch {
			return {
				...i,
				selected: []
			};
		}
	}
	function v() {
		s.state = g(s.state);
		try {
			localStorage.setItem(`${e}.state`, JSON.stringify(s.state));
		} catch {}
	}
	function y(n = "updated") {
		s.records = s.records.map(p).filter(Boolean).filter((e) => e.saved || e.feedback || e.note || e.tags.length).sort((e, t) => t.updatedAt.localeCompare(e.updatedAt)).slice(0, 240);
		try {
			localStorage.setItem(e, JSON.stringify(s.records));
		} catch {
			return b("Mesaj notları bu cihazda kaydedilemedi."), !1;
		}
		return window.dispatchEvent(new CustomEvent(t, { detail: { reason: n } })), b(n === "deleted" ? "Mesaj kaydı kaldırıldı." : "Mesaj çalışma alanı güncellendi."), !0;
	}
	function b(e) {
		o.toast && e && (o.toast.textContent = e, o.toast.classList.remove("hidden"), window.clearTimeout(s.toastTimer), s.toastTimer = window.setTimeout(() => o.toast.classList.add("hidden"), 2600));
	}
	function x(e, t) {
		return s.records.find((n) => n.conversationId === e && n.messageId === t) || null;
	}
	function S(e) {
		if (!e) return null;
		let t = e.dataset.messageId, n = C();
		return !t || !n ? null : x(n, t);
	}
	function C() {
		return document.querySelector(".conversation-row.active .conversation-open")?.dataset?.conversationId || "";
	}
	function w(e) {
		let t = C(), n = e?.dataset?.messageId || "";
		if (!t || !n) return null;
		let r = x(t, n);
		return r || (r = {
			id: c(),
			conversationId: t,
			messageId: n,
			saved: !1,
			feedback: "",
			note: "",
			tags: [],
			createdAt: (/* @__PURE__ */ new Date()).toISOString(),
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		}, s.records.push(r)), r;
	}
	function T(e) {
		e && (e.saved || e.feedback || e.note || e.tags.length || (s.records = s.records.filter((t) => t.id !== e.id)));
	}
	function E(e) {
		return e?.classList.contains("assistant") ? "assistant" : "user";
	}
	function D(e) {
		let t = e?.querySelector(".content");
		return l((window.HafizeChatMarkdown?.plainTextFor?.(t) ?? t?.textContent) || "").slice(0, 12e3);
	}
	function O(e) {
		if (!e || e.querySelector(".message-workspace-actions")) return e?.querySelector(".message-workspace-actions");
		let t = document.createElement("div");
		t.className = "message-workspace-actions", t.setAttribute("aria-label", "Mesaj araçları");
		let n = k("☆", "Mesajı kaydet", "message-save"), r = k("↑", "Yanıtı beğen", "message-feedback-up"), i = k("↓", "Yanıtı beğenme", "message-feedback-down"), a = k("▤", "Mesaja not ekle", "message-note"), o = k("#", "Mesaja etiket ekle", "message-tag"), s = k("⋯", "Mesaj çalışma alanı seçenekleri", "message-more");
		return n.addEventListener("click", () => P(e)), r.addEventListener("click", () => F(e, "up")), i.addEventListener("click", () => F(e, "down")), a.addEventListener("click", () => I(e)), o.addEventListener("click", () => L(e)), s.addEventListener("click", () => R(e)), t.append(n, r, i, a, o, s), e.append(t), t;
	}
	function k(e, t, n) {
		let r = document.createElement("button");
		return r.type = "button", r.className = `message-workspace-action ${n}`, r.textContent = e, r.setAttribute("aria-label", t), r.title = t, r;
	}
	function A(e, t = S(e)) {
		let n = O(e);
		if (!n) return;
		let r = n.querySelector(".message-save"), i = n.querySelector(".message-feedback-up"), a = n.querySelector(".message-feedback-down"), o = n.querySelector(".message-note"), s = n.querySelector(".message-tag");
		r?.classList.toggle("active", t?.saved === !0), r?.setAttribute("aria-pressed", String(t?.saved === !0)), r && (r.textContent = t?.saved ? "★" : "☆"), i?.classList.toggle("active", t?.feedback === "up"), i?.setAttribute("aria-pressed", String(t?.feedback === "up")), a?.classList.toggle("active", t?.feedback === "down"), a?.setAttribute("aria-pressed", String(t?.feedback === "down")), o?.classList.toggle("active", !!t?.note), s?.classList.toggle("active", !!t?.tags?.length), e.querySelector(".message-workspace-summary")?.remove();
		let c = [];
		if (t?.note && c.push(`Not: ${t.note.slice(0, 80)}`), t?.tags?.length && c.push(`Etiket: ${t.tags.join(", ")}`), c.length) {
			let t = document.createElement("div");
			t.className = "message-workspace-summary", t.textContent = c.join(" · "), t.title = c.join(" · "), e.append(t);
		}
		e.classList.toggle("message-workspace-saved", !!t?.saved);
	}
	function j(e) {
		e instanceof HTMLElement && e.dataset.messageId && (O(e), A(e));
	}
	function M() {
		o.messages.querySelectorAll(".message[data-message-id]").forEach(j);
	}
	function N(e, t, n) {
		let r = w(e);
		r && (n(r), r.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), T(r), y(t), A(e, x(C(), e.dataset.messageId)), X());
	}
	function P(e) {
		N(e, (e) => {
			e.saved = !e.saved;
		}, "saved");
	}
	function F(e, t) {
		N(e, (e) => {
			e.feedback = e.feedback === t ? "" : t;
		}, "feedback");
	}
	function I(e) {
		let t = w(e);
		if (!t) return;
		let n = globalThis.prompt("Bu mesaja kısa bir not ekle (en fazla 600 karakter):", t.note || "");
		n !== null && (t.note = d(n), t.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), T(t), y("note"), A(e, x(C(), e.dataset.messageId)), X());
	}
	function L(e) {
		let t = w(e);
		if (!t) return;
		let n = globalThis.prompt("Etiketleri virgülle ayır (en fazla 8 etiket):", (t.tags || []).join(", "));
		n !== null && (t.tags = [...new Set(String(n).split(",").map(u).filter(Boolean))].slice(0, 8), t.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), T(t), y("tag"), A(e, x(C(), e.dataset.messageId)), X());
	}
	function R(e) {
		let t = S(e), n = globalThis.prompt("Mesaj işlemi: 1=Kaydı kaldır, 2=Notu temizle, 3=Etiketleri temizle, 4=Seçime ekle", "");
		if (n) {
			if (n === "1") {
				if (!t) return b("Bu mesaj için kayıt yok.");
				t.saved = !1, t.feedback = "", t.note = "", t.tags = [], T(t), y("deleted"), A(e, null), X();
				return;
			}
			if (n === "2" && t) {
				t.note = "", t.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), T(t), y("note"), A(e, x(C(), e.dataset.messageId)), X();
				return;
			}
			if (n === "3" && t) {
				t.tags = [], t.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), T(t), y("tag"), A(e, x(C(), e.dataset.messageId)), X();
				return;
			}
			n === "4" && U(t?.id);
		}
	}
	function z(e) {
		return Number(e?.saved) + Number(!!e?.feedback) + Number(!!e?.note) + Number(e?.tags?.length);
	}
	function B(e) {
		let t = e.record, n = s.state.filter;
		return !(n === "saved" && !t.saved || n === "feedback" && !t.feedback || n === "notes" && !t.note || n === "tag" && !t.tags.length || n === "user" && e.role !== "user" || n === "assistant" && e.role !== "assistant" || s.state.query && !`${e.text} ${t.note} ${t.tags.join(" ")}`.toLocaleLowerCase("tr-TR").includes(s.state.query));
	}
	function V() {
		let e = [], t = C();
		for (let n of s.records) {
			if (n.conversationId !== t) continue;
			let r = o.messages.querySelector(`[data-message-id="${CSS.escape(n.messageId)}"]`);
			e.push({
				record: n,
				article: r,
				role: E(r),
				text: D(r)
			});
		}
		return e.filter((e) => e.text || e.record.note).filter(B);
	}
	function H(e) {
		return [...e].sort((e, t) => s.state.sort === "oldest" ? e.record.updatedAt.localeCompare(t.record.updatedAt) : s.state.sort === "feedback" ? z(t.record) - z(e.record) || t.record.updatedAt.localeCompare(e.record.updatedAt) : s.state.sort === "notes" && Number(!!t.record.note) - Number(!!e.record.note) || t.record.updatedAt.localeCompare(e.record.updatedAt));
	}
	function U(e) {
		if (!e) return;
		let t = new Set(s.state.selected);
		t.has(e) ? t.delete(e) : t.size < 100 && t.add(e), s.state.selected = [...t], v(), X();
	}
	function W() {
		s.state.selected = [], v(), X();
	}
	function G() {
		let e = document.querySelector("#messageWorkspacePanel");
		e && e.remove();
		let t = document.createElement("section");
		t.id = "messageWorkspacePanel", t.className = "message-workspace-panel utility-card", t.setAttribute("aria-labelledby", "messageWorkspaceTitle");
		let n = document.createElement("div");
		n.className = "message-workspace-panel-head";
		let r = document.createElement("div");
		r.className = "utility-head";
		let i = document.createElement("span");
		i.className = "mini-icon", i.textContent = "★";
		let a = document.createElement("strong");
		a.id = "messageWorkspaceTitle", a.textContent = "Mesaj çalışma alanı", r.append(i, a);
		let c = document.createElement("button");
		c.type = "button", c.className = "mini-btn", c.textContent = "?", c.setAttribute("aria-label", "Mesaj çalışma alanı yardımı"), c.addEventListener("click", () => b("Mesajları kaydedebilir, yanıtı değerlendirebilir, not ve etiket ekleyebilir; aşağıdaki aramayla kayıtlarını bulabilirsin.")), n.append(r, c);
		let u = document.createElement("input");
		u.type = "search", u.className = "message-workspace-search", u.maxLength = 120, u.placeholder = "Kayıtlı mesajlarda ara…", u.setAttribute("aria-label", "Kayıtlı mesajlarda ara"), u.value = s.state.query, u.addEventListener("input", () => {
			s.state.query = l(u.value).toLocaleLowerCase("tr-TR").slice(0, 120), v(), X();
		});
		let d = document.createElement("div");
		d.className = "message-workspace-controls";
		let f = document.createElement("select");
		f.className = "message-workspace-select", f.setAttribute("aria-label", "Mesaj filtresi"), [
			["all", "Tümü"],
			["saved", "Kaydedilen"],
			["feedback", "Geri bildirimli"],
			["notes", "Notlu"],
			["user", "Senin mesajların"],
			["assistant", "Hafize yanıtları"],
			["tag", "Etiketli"]
		].forEach(([e, t]) => f.append(new Option(t, e, !1, s.state.filter === e))), f.addEventListener("change", () => {
			s.state.filter = f.value, v(), X();
		});
		let p = document.createElement("select");
		p.className = "message-workspace-select", p.setAttribute("aria-label", "Mesaj sıralaması"), [
			["newest", "Güncellenen"],
			["oldest", "Eski"],
			["feedback", "Etkileşimli"],
			["notes", "Notlular"]
		].forEach(([e, t]) => p.append(new Option(t, e, !1, s.state.sort === e))), p.addEventListener("change", () => {
			s.state.sort = p.value, v(), X();
		}), d.append(f, p);
		let m = document.createElement("div");
		m.className = "message-workspace-batch";
		let h = document.createElement("span");
		h.className = "message-workspace-count";
		let g = K("Görünenleri seç");
		g.addEventListener("click", q);
		let _ = K("Seçimi temizle");
		_.addEventListener("click", W);
		let y = K("JSON dışa aktar");
		y.addEventListener("click", $), m.append(h, g, _, y);
		let x = document.createElement("div");
		x.className = "message-workspace-status", x.setAttribute("role", "status"), x.setAttribute("aria-live", "polite");
		let S = document.createElement("div");
		return S.className = "message-workspace-results", t.append(n, u, d, m, x, S), o.rail.prepend(t), s.panel = t, s.search = u, s.filter = f, s.sort = p, s.status = x, s.resultList = S, s.clearButton = _, s.exportButton = y, s.selectionButton = g, s.selectionClearButton = _, t;
	}
	function K(e) {
		let t = document.createElement("button");
		return t.type = "button", t.className = "soft-btn", t.textContent = e, t;
	}
	function q() {
		let e = V().map((e) => e.record.id).slice(0, 100);
		s.state.selected = [...new Set(e)], v(), X();
	}
	function J(e) {
		let t = document.createElement("article");
		t.className = "message-workspace-result";
		let n = document.createElement("input");
		n.type = "checkbox", n.checked = s.state.selected.includes(e.record.id), n.setAttribute("aria-label", "Mesajı dışa aktarma seçimine ekle"), n.addEventListener("change", () => U(e.record.id));
		let r = document.createElement("div");
		r.className = "message-workspace-result-body";
		let i = document.createElement("div");
		i.className = "message-workspace-result-meta", i.textContent = `${e.role === "assistant" ? "Hafize" : "Sen"} · ${Y(e.record.updatedAt)}`;
		let a = document.createElement("p");
		if (a.className = "message-workspace-result-text", a.textContent = e.text || "Notlu mesaj", r.append(i, a), e.record.note) {
			let t = document.createElement("div");
			t.className = "message-workspace-result-note", t.textContent = e.record.note, r.append(t);
		}
		if (e.record.tags.length) {
			let t = document.createElement("div");
			t.className = "message-workspace-result-tags", t.textContent = e.record.tags.map((e) => `#${e}`).join(" "), r.append(t);
		}
		let o = document.createElement("div");
		o.className = "message-workspace-result-actions";
		let c = K("Mesaja git");
		c.addEventListener("click", () => Z(e));
		let l = K("Kaydı kaldır");
		return l.addEventListener("click", () => Q(e.record.id)), o.append(c, l), t.append(n, r, o), t;
	}
	function Y(e) {
		try {
			return new Intl.DateTimeFormat("tr-TR", {
				dateStyle: "short",
				timeStyle: "short"
			}).format(new Date(e));
		} catch {
			return "";
		}
	}
	function X() {
		if (!s.resultList) return;
		let e = H(V());
		s.resultList.replaceChildren();
		let t = V().length;
		if (e.length) e.forEach((e) => s.resultList.append(J(e)));
		else {
			let e = document.createElement("p");
			e.className = "message-workspace-empty", e.textContent = "Bu görünümde kayıtlı mesaj yok.", s.resultList.append(e);
		}
		let n = s.state.selected.length;
		s.status.textContent = `${t} kayıt · ${n} seçili`, s.exportButton.disabled = n === 0, s.selectionClearButton.disabled = n === 0;
	}
	function Z(e) {
		let t = e.article || o.messages.querySelector(`[data-message-id="${CSS.escape(e.record.messageId)}"]`);
		if (!t) return b("Mesaj artık görünür değil; kayıt yerel geçmişte kaldı.");
		t.scrollIntoView({
			behavior: "smooth",
			block: "center"
		}), t.classList.add("message-workspace-focus"), window.setTimeout(() => t.classList.remove("message-workspace-focus"), 1400);
	}
	function Q(e) {
		s.records = s.records.filter((t) => t.id !== e), s.state.selected = s.state.selected.filter((t) => t !== e), v(), y("deleted"), M(), X();
	}
	function $() {
		let e = new Set(s.state.selected), t = V().filter((t) => e.has(t.record.id)).slice(0, 100);
		if (!t.length) return b("Önce en az bir mesaj seç.");
		let n = {
			schema: "hafize-message-workspace/v1",
			exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
			records: t.map((e) => ({
				record: e.record,
				role: e.role,
				content: e.text.slice(0, 12e3)
			}))
		}, r = new Blob([JSON.stringify(n, null, 2)], { type: "application/json" }), i = URL.createObjectURL(r), a = document.createElement("a");
		a.href = i, a.download = `hafize-messages-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`, a.click(), URL.revokeObjectURL(i), b(`${t.length} mesaj dışa aktarıldı.`);
	}
	function ee(e) {
		if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
		let t = e.key.toLowerCase();
		t === "b" && (e.preventDefault(), s.search?.focus(), s.search?.select()), t === "k" && (e.preventDefault(), q(), b("Görünen mesaj kayıtları seçildi.")), t === "x" && (e.preventDefault(), W());
	}
	function te(t) {
		t.key === e && (s.records = h(), M(), X()), t.key === `${e}.state` && (s.state = _(), ne(), X());
	}
	function ne() {
		s.search && (s.search.value = s.state.query, s.filter.value = s.state.filter, s.sort.value = s.state.sort);
	}
	function re() {
		let e = new Set([...o.messages.querySelectorAll(".message[data-message-id]")].map((e) => e.dataset.messageId)), t = C();
		if (!t) return;
		let n = s.records.length;
		s.records = s.records.filter((n) => n.conversationId !== t || e.has(n.messageId)), s.records.length !== n && y("cleanup");
	}
	function ie() {
		s.observer = new MutationObserver(() => {
			window.clearTimeout(s.refreshTimer), s.refreshTimer = window.setTimeout(() => {
				M(), X();
			}, 0);
		}), s.observer.observe(o.messages, {
			childList: !0,
			subtree: !0
		});
	}
	function ae() {
		G(), M(), X(), ie(), document.addEventListener("keydown", ee), window.addEventListener("storage", te), window.addEventListener(t, () => {
			s.records = h(), M(), X();
		}), window.addEventListener("hafize:conversation-workspace-changed", () => {
			s.records = h(), M(), X();
		}), window.setInterval(re, 12e3);
	}
	ae();
})();
//#endregion

//# sourceMappingURL=message-workspace.js.map