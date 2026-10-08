//#region public/conversation-workspace.ts
(() => {
	let e = "hafize.conversations.v1", t = "hafize.conversation-workspace.v1", n = "hafize:conversation-workspace-changed", r = 1048576, i = /* @__PURE__ */ new Set([
		"updated-desc",
		"updated-asc",
		"title-asc",
		"created-desc",
		"created-asc"
	]), a = /* @__PURE__ */ new Set([
		"all",
		"active",
		"archived",
		"pinned",
		"tagged"
	]), o = Object.freeze({
		filter: "all",
		sort: "updated-desc",
		tag: "",
		query: "",
		selected: []
	}), s = {
		block: document.querySelector(".history-block"),
		history: document.querySelector("#conversationList"),
		toast: document.querySelector("#toast")
	};
	if (!s.block || !s.history) return;
	function c(e) {
		return {
			filter: e.filter,
			sort: e.sort,
			tag: e.tag,
			query: e.query,
			selected: [...e.selected]
		};
	}
	function l(e) {
		return !e || typeof e != "object" ? c(o) : {
			filter: a.has(e.filter) ? e.filter : o.filter,
			sort: i.has(e.sort) ? e.sort : o.sort,
			tag: typeof e.tag == "string" ? p(e.tag).slice(0, 24) : "",
			query: typeof e.query == "string" ? p(e.query).slice(0, 120) : "",
			selected: Array.isArray(e.selected) ? e.selected.filter((e) => typeof e == "string").slice(0, 30) : []
		};
	}
	function u() {
		try {
			return l(JSON.parse(localStorage.getItem(t) || "{}"));
		} catch {
			return c(o);
		}
	}
	function d(e) {
		let n = l(e);
		try {
			localStorage.setItem(t, JSON.stringify(n));
		} catch {}
		return n;
	}
	let f = u();
	function p(e) {
		return typeof e == "string" ? e.replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR") : "";
	}
	function m(e) {
		return String(e ?? "").replace(/\s+/g, " ").trim().slice(0, 80) || "Yeni sohbet";
	}
	function h(e) {
		return String(e ?? "").replace(/\s+/g, " ").trim().replace(/^#+\s*/, "").slice(0, 24);
	}
	function g(t = localStorage) {
		try {
			let n = JSON.parse(t.getItem(e) || "[]");
			return Array.isArray(n) ? n.filter((e) => e && typeof e.id == "string") : [];
		} catch {
			return [];
		}
	}
	function _(e, t) {
		let n = Date.parse(e || "");
		return Number.isFinite(n) ? n : t;
	}
	function v(e) {
		return e === "assistant" ? "assistant" : "user";
	}
	function y(e, t) {
		if (!e || typeof e != "object") return null;
		let n = typeof e.content == "string" ? e.content.slice(0, 12e3) : "";
		if (!n) return null;
		let r = typeof e.id == "string" && e.id ? e.id.slice(0, 120) : `imported-${t}-${Date.now()}`, i = typeof e.at == "string" ? e.at : (/* @__PURE__ */ new Date()).toISOString(), a = {
			id: r,
			role: v(e.role),
			content: n,
			at: i
		};
		return Array.isArray(e.toolActivities) && (a.toolActivities = e.toolActivities.filter((e) => e && typeof e == "object").slice(0, 4).map((e) => ({
			label: typeof e.label == "string" ? e.label.slice(0, 80) : "Araç",
			state: [
				"running",
				"success",
				"failure"
			].includes(e.state) ? e.state : "success"
		}))), a;
	}
	function b(e, t = 0) {
		if (!e || typeof e != "object") return null;
		let n = typeof e.id == "string" ? e.id.trim().slice(0, 120) : "";
		if (!n) return null;
		let r = Date.now() - t, i = Array.isArray(e.messages) ? e.messages.slice(0, 200).map(y).filter(Boolean) : [], a = Array.isArray(e.tags) ? [...new Set(e.tags.map(h).filter(Boolean))].slice(0, 8) : [];
		return {
			id: n,
			title: m(e.title),
			agentId: typeof e.agentId == "string" ? e.agentId.slice(0, 120) : "",
			toolsEnabled: e.toolsEnabled === !0,
			archived: e.archived === !0,
			pinned: e.pinned === !0,
			tags: a,
			createdAt: new Date(_(e.createdAt, r)).toISOString(),
			updatedAt: new Date(_(e.updatedAt, r)).toISOString(),
			messages: i
		};
	}
	function x(e) {
		if (!Array.isArray(e)) return [];
		let t = /* @__PURE__ */ new Set(), n = [];
		for (let [r, i] of e.entries()) {
			let e = b(i, r);
			e && !t.has(e.id) && (t.add(e.id), n.push(e));
		}
		return n.slice(0, 30);
	}
	function S(t, r) {
		let i = x(t);
		try {
			return localStorage.setItem(e, JSON.stringify(i)), C(r), window.dispatchEvent(new CustomEvent(n, { detail: { reason: r } })), !0;
		} catch {
			return C("Sohbet verileri bu cihazda kaydedilemedi."), !1;
		}
	}
	function C(e) {
		s.toast && e && (s.toast.textContent = e, s.toast.classList.remove("hidden"), window.clearTimeout(C.timeoutId), C.timeoutId = window.setTimeout(() => s.toast.classList.add("hidden"), 3e3));
	}
	function w() {
		return Array.from(s.history.querySelectorAll(".conversation-row"));
	}
	function T(e) {
		return e.querySelector(".conversation-open")?.dataset?.conversationId || "";
	}
	function ee(e, t) {
		let n = [...e], r = new Intl.Collator("tr-TR", {
			sensitivity: "base",
			numeric: !0
		});
		return n.sort((e, n) => {
			if (t === "title-asc") return r.compare(m(e.title), m(n.title));
			let i = _(t.startsWith("created") ? e.createdAt : e.updatedAt, 0), a = _(t.startsWith("created") ? n.createdAt : n.updatedAt, 0);
			return t.endsWith("asc") ? i - a : a - i;
		}), n;
	}
	function E(e, t) {
		let n = t.filter;
		return !(n === "active" && e.archived === !0 || n === "archived" && e.archived !== !0 || n === "pinned" && e.pinned !== !0 || n === "tagged" && !Array.isArray(e.tags) || n === "tagged" && e.tags.length === 0 || t.tag && !(e.tags || []).some((e) => p(e) === t.tag) || t.query && !p([
			e.title,
			e.agentId,
			...Array.isArray(e.tags) ? e.tags : [],
			...Array.isArray(e.messages) ? e.messages.map((e) => e.content) : []
		].filter(Boolean).join(" ")).includes(t.query));
	}
	function D(e) {
		let t = /* @__PURE__ */ new Map();
		for (let n of e) for (let e of Array.isArray(n.tags) ? n.tags : []) {
			let n = h(e);
			if (!n) continue;
			let r = p(n), i = t.get(r) || {
				label: n,
				count: 0
			};
			i.count += 1, t.set(r, i);
		}
		return [...t.values()].sort((e, t) => t.count - e.count || e.label.localeCompare(t.label, "tr-TR"));
	}
	function O() {
		return f = d(f), f;
	}
	function k(e, t, n = "") {
		let r = document.createElement("button");
		return r.type = "button", r.textContent = e, r.setAttribute("aria-label", t), n && (r.className = n), r;
	}
	function A() {
		s.block.querySelector(".conversation-workspace")?.remove();
		let e = document.createElement("section");
		e.className = "conversation-workspace", e.setAttribute("aria-label", "Sohbet çalışma alanı yönetimi");
		let t = document.createElement("div");
		t.className = "conversation-workspace-head";
		let n = document.createElement("div");
		n.className = "conversation-workspace-title";
		let i = document.createElement("strong");
		i.textContent = "Sohbet çalışma alanı";
		let a = document.createElement("span");
		a.className = "conversation-workspace-status", a.id = "conversationWorkspaceStatus", a.setAttribute("role", "status"), a.setAttribute("aria-live", "polite"), n.append(i, a);
		let o = document.createElement("div");
		o.className = "conversation-workspace-actions";
		let c = k("Tümünü seç", "Görünen sohbetlerin tamamını seç", "workspace-ghost"), l = k("Seçimi temizle", "Sohbet seçimini temizle", "workspace-ghost");
		o.append(c, l), t.append(n, o);
		let u = document.createElement("div");
		u.className = "conversation-workspace-filters";
		let d = document.createElement("input");
		d.type = "search", d.className = "workspace-search", d.id = "conversationWorkspaceSearch", d.placeholder = "Başlık, etiket veya mesaj…", d.maxLength = 120, d.value = f.query, d.setAttribute("aria-label", "Sohbet çalışma alanında ara");
		let _ = document.createElement("select");
		_.className = "workspace-select", _.setAttribute("aria-label", "Sohbet filtresi");
		for (let [e, t] of [
			["all", "Tüm sohbetler"],
			["active", "Arşivlenmemiş"],
			["archived", "Arşivlenmiş"],
			["pinned", "Sabitlenmiş"],
			["tagged", "Etiketli"]
		]) _.append(new Option(t, e, !1, f.filter === e));
		let v = document.createElement("select");
		v.className = "workspace-select", v.setAttribute("aria-label", "Sohbet sıralaması");
		for (let [e, t] of [
			["updated-desc", "Son güncellenen"],
			["updated-asc", "En eski güncellenen"],
			["title-asc", "Başlığa göre"],
			["created-desc", "Yeni oluşturulan"],
			["created-asc", "Eski oluşturulan"]
		]) v.append(new Option(t, e, !1, f.sort === e));
		let y = document.createElement("select");
		y.className = "workspace-select workspace-tag-select", y.setAttribute("aria-label", "Etikete göre filtrele"), y.append(new Option("Tüm etiketler", ""));
		for (let e of D(g())) y.append(new Option(`${e.label} · ${e.count}`, p(e.label), !1, f.tag === p(e.label)));
		u.append(d, _, v, y);
		let b = document.createElement("div");
		b.className = "conversation-workspace-batch";
		let N = document.createElement("span");
		N.className = "workspace-batch-count";
		let P = k("Arşivle", "Seçili sohbetleri arşivle"), F = k("Arşivden çıkar", "Seçili sohbetleri arşivden çıkar"), I = k("Sabitle", "Seçili sohbetleri sabitle"), L = k("Sabitlemeyi kaldır", "Seçili sohbetlerin sabitlemesini kaldır"), R = k("Kopyala", "Seçili sohbetleri çoğalt"), z = k("Etiket ekle", "Seçili sohbetlere etiket ekle"), B = k("Sil", "Seçili sohbetleri kalıcı olarak sil", "workspace-danger");
		b.append(N, P, F, I, L, R, z, B);
		let V = document.createElement("div");
		V.className = "conversation-workspace-io";
		let H = k("Seçilenleri dışa aktar", "Seçili sohbetleri JSON olarak dışa aktar"), ne = k("Yedek içe aktar", "JSON sohbet yedeği içe aktar");
		V.append(H, ne);
		let U = document.createElement("div");
		U.className = "conversation-workspace-quota";
		let W = document.createElement("span");
		W.className = "workspace-quota-label";
		let G = document.createElement("div");
		G.className = "workspace-quota-bar";
		let K = document.createElement("span");
		K.className = "workspace-quota-fill", G.append(K), U.append(W, G), e.append(t, u, b, V, U), s.block.insertBefore(e, s.history);
		function q() {
			return g().filter((e) => f.selected.includes(e.id));
		}
		function J() {
			let e = g(), t = e.filter((e) => E(e, f)).length, n = q().length;
			a.textContent = `${t} sohbet · ${n} seçili`, N.textContent = `${n} seçili`;
			let r = n === 0;
			for (let e of [
				P,
				F,
				I,
				L,
				R,
				z,
				B,
				H
			]) e.disabled = r;
			l.disabled = n === 0;
			let i = Math.min(100, e.length / 30 * 100);
			W.textContent = `Yerel sınır: ${e.length}/30 sohbet · ${j(e)} KB`, K.style.width = `${i}%`, K.setAttribute("aria-valuenow", String(Math.round(i))), G.setAttribute("role", "progressbar"), G.setAttribute("aria-valuemin", "0"), G.setAttribute("aria-valuemax", "100");
		}
		function Y() {
			let e = g(), t = ee(e.filter((e) => E(e, f)), f.sort), n = new Map(t.map((e, t) => [e.id, t])), r = w();
			for (let e of r) {
				let t = T(e), r = n.has(t);
				e.hidden = !r, e.style.order = r ? String(n.get(t)) : "9999";
				let i = e.querySelector(".workspace-row-check");
				i && (i.checked = f.selected.includes(t), i.setAttribute("aria-checked", String(i.checked))), e.classList.toggle("workspace-selected", f.selected.includes(t));
			}
			let i = t.map((e) => e.id);
			f.selected = f.selected.filter((t) => i.includes(t) || e.some((e) => e.id === t)), O(), J();
		}
		function X() {
			let e = f.tag;
			y.replaceChildren(new Option("Tüm etiketler", ""));
			for (let t of D(g())) y.append(new Option(`${t.label} · ${t.count}`, p(t.label), !1, e === p(t.label)));
		}
		function re(e) {
			let t = w().filter((e) => !e.hidden), n = new Set(f.selected);
			for (let r of t) {
				let t = T(r);
				t && (e ? n.add(t) : n.delete(t));
			}
			f.selected = [...n].slice(0, 30), O(), Y();
		}
		function Z(e, t) {
			let n = g(), r = new Set(f.selected), i = !1;
			for (let t of n) r.has(t.id) && e(t) && (i = !0);
			i && (S(n, t), f.selected = [], O(), window.setTimeout(() => window.location.reload(), 50));
		}
		function Q(e) {
			Z((t) => t.archived !== e && (t.archived = e, t.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), !0), e ? "Seçili sohbetler arşivlendi." : "Seçili sohbetler arşivden çıkarıldı.");
		}
		function $(e) {
			Z((t) => t.pinned !== e && (t.pinned = e, !0), e ? "Seçili sohbetler sabitlendi." : "Sabitlenen sohbetler güncellendi.");
		}
		function ie() {
			let e = new Set(f.selected);
			if (!e.size) return;
			let t = g();
			globalThis.confirm(`${e.size} sohbet kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`) && (S(t.filter((t) => !e.has(t.id)), `${e.size} sohbet silindi.`), f.selected = [], O(), window.setTimeout(() => window.location.reload(), 50));
		}
		function ae() {
			let e = g(), t = new Set(f.selected), n = [];
			for (let r of e) {
				if (!t.has(r.id)) continue;
				if (e.length + n.length >= 30) break;
				let i = te(r);
				i && (i.id = M("copy"), i.title = m(`${m(r.title)} · kopya`), i.createdAt = (/* @__PURE__ */ new Date()).toISOString(), i.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), n.push(i));
			}
			if (!n.length) return C("Kopyalanacak sohbet bulunamadı veya yerel sınır dolu.");
			S([...n, ...e], `${n.length} sohbet kopyalandı.`), f.selected = n.map((e) => e.id), O(), window.setTimeout(() => window.location.reload(), 50);
		}
		function oe() {
			if (!q().length) return;
			let e = globalThis.prompt("Eklenecek etiket:", f.tag || "");
			if (e === null) return;
			let t = h(e);
			if (!t) return C("Etiket boş olamaz.");
			let n = g(), r = new Set(f.selected);
			for (let e of n) {
				if (!r.has(e.id)) continue;
				let n = Array.isArray(e.tags) ? e.tags.map(h).filter(Boolean) : [];
				n.some((e) => p(e) === p(t)) || n.push(t), e.tags = [...new Map(n.map((e) => [p(e), e])).values()].slice(0, 8);
			}
			S(n, "Etiket seçili sohbetlere eklendi."), f.selected = [], O(), X(), window.setTimeout(() => window.location.reload(), 50);
		}
		function se() {
			let e = q();
			if (!e.length) return C("Dışa aktarılacak seçili sohbet yok.");
			let t = JSON.stringify({
				format: "hafize-conversations",
				version: 2,
				exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
				conversations: e
			}, null, 2), n = new Blob([t], { type: "application/json;charset=utf-8" }), r = URL.createObjectURL(n), i = document.createElement("a");
			i.href = r, i.download = `hafize-sohbet-secili-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`, i.rel = "noopener", document.body.append(i), i.click(), i.remove(), window.setTimeout(() => URL.revokeObjectURL(r), 1e3), C(`${e.length} sohbet JSON olarak dışa aktarıldı.`);
		}
		function ce() {
			let e = document.createElement("input");
			e.type = "file", e.accept = "application/json,.json", e.hidden = !0, e.addEventListener("change", async () => {
				let t = e.files?.[0];
				if (e.remove(), t) {
					if (t.size <= 0 || t.size > r) return C("Yedek dosyası 1 MB sınırında olmalı.");
					try {
						let e = await t.text();
						if (e.length > r) return C("Yedek dosyası 1 MB sınırını aşıyor.");
						let n = JSON.parse(e), i = x(Array.isArray(n) ? n : n?.conversations);
						if (!i.length) return C("İçe aktarılabilir sohbet bulunamadı.");
						let a = g(), o = new Map(a.map((e) => [e.id, e])), s = [];
						for (let e of i) {
							if (s.length >= 30) break;
							let t = o.has(e.id) ? {
								...e,
								id: M("import")
							} : e;
							o.set(t.id, t), s.push(t);
						}
						if (!S([...s, ...a].slice(0, 30), `${s.length} sohbet içe aktarıldı.`)) return;
						f.selected = s.map((e) => e.id), O(), window.setTimeout(() => window.location.reload(), 50);
					} catch {
						C("Yedek dosyası okunamadı veya geçersiz JSON içeriyor.");
					}
				}
			}, { once: !0 }), document.body.append(e), e.click();
		}
		d.addEventListener("input", () => {
			f.query = p(d.value).slice(0, 120), O(), Y();
		}), d.addEventListener("keydown", (e) => {
			e.key === "Escape" && d.value && (e.preventDefault(), d.value = "", f.query = "", O(), Y());
		}), _.addEventListener("change", () => {
			f.filter = _.value, O(), Y();
		}), v.addEventListener("change", () => {
			f.sort = v.value, O(), Y();
		}), y.addEventListener("change", () => {
			f.tag = p(y.value).slice(0, 24), f.tag && (f.filter = "tagged"), O(), Y();
		}), c.addEventListener("click", () => re(!0)), l.addEventListener("click", () => {
			f.selected = [], O(), Y();
		}), P.addEventListener("click", () => Q(!0)), F.addEventListener("click", () => Q(!1)), I.addEventListener("click", () => $(!0)), L.addEventListener("click", () => $(!1)), R.addEventListener("click", ae), z.addEventListener("click", oe), B.addEventListener("click", ie), H.addEventListener("click", se), ne.addEventListener("click", ce), A.rowControls = {
			updateRows: Y,
			refreshTagOptions: X,
			updateStatus: J
		}, Y();
	}
	function j(e) {
		try {
			return Math.ceil(new Blob([JSON.stringify(e)]).size / 1024);
		} catch {
			return 0;
		}
	}
	function te(e) {
		try {
			return structuredClone(e);
		} catch {
			try {
				return JSON.parse(JSON.stringify(e));
			} catch {
				return null;
			}
		}
	}
	function M(e) {
		return `${e}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
	}
	function N() {
		for (let e of w()) {
			if (e.querySelector(".workspace-row-check")) continue;
			let t = T(e);
			if (!t) continue;
			let n = document.createElement("input");
			n.type = "checkbox", n.className = "workspace-row-check", n.checked = f.selected.includes(t), n.setAttribute("aria-label", "Sohbeti yönetim seçimine ekle"), n.setAttribute("aria-checked", String(n.checked)), n.addEventListener("click", (e) => {
				e.stopPropagation();
			}), n.addEventListener("change", () => {
				let r = new Set(f.selected);
				n.checked ? r.add(t) : r.delete(t), f.selected = [...r].slice(0, 30), O(), e.classList.toggle("workspace-selected", n.checked), A.rowControls?.updateStatus?.();
			}), e.prepend(n);
		}
	}
	function P() {
		let e = new Set(g().map((e) => e.id)), t = f.selected.filter((t) => e.has(t));
		t.length !== f.selected.length && (f.selected = t, O());
	}
	function F() {
		P(), N(), A.rowControls?.refreshTagOptions?.(), A.rowControls?.updateRows?.();
	}
	function I() {
		globalThis.HafizeConversationWorkspace = Object.freeze({
			readConversations: g,
			normalizeConversation: b,
			normalizeConversationList: x,
			normalizeState: l,
			estimateStorage: j,
			getState: () => c(f),
			refresh: F,
			constants: Object.freeze({
				STORAGE_KEY: e,
				WORKSPACE_KEY: t,
				MAX_CONVERSATIONS: 30,
				MAX_TITLE: 80,
				MAX_TAG: 24,
				MAX_TAGS: 8,
				MAX_IMPORT_BYTES: r,
				MAX_IMPORT_CONVERSATIONS: 30,
				MAX_IMPORT_MESSAGES: 200,
				MAX_MESSAGE_LENGTH: 12e3
			})
		});
	}
	A(), N(), I(), new MutationObserver(() => {
		N(), A.rowControls?.updateRows?.();
	}).observe(s.history, {
		childList: !0,
		subtree: !0
	}), window.addEventListener("storage", (n) => {
		(n.key === e || n.key === t) && F();
	}), window.addEventListener(n, () => F());
})();
//#endregion

//# sourceMappingURL=conversation-workspace.js.map