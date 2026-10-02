//#region public/typed/chat-history-management.ts
(() => {
	let e = "hafize.conversations.v1", t = ".conversation-row", n = "history-manage", r = "history-rename", i = "data-history-delete-bound", a = {
		list: document.querySelector("#conversationList"),
		toast: document.querySelector("#toast")
	};
	if (!a.list) return;
	function o(e) {
		a.toast && e && (a.toast.textContent = e, a.toast.classList.remove("hidden"), window.clearTimeout(o.timeoutId), o.timeoutId = window.setTimeout(() => a.toast.classList.add("hidden"), 2600));
	}
	function s() {
		try {
			let t = JSON.parse(localStorage.getItem(e) || "[]");
			return Array.isArray(t) ? t : [];
		} catch {
			return [];
		}
	}
	function c(t) {
		try {
			return localStorage.setItem(e, JSON.stringify(t.slice(0, 30))), !0;
		} catch {
			return o("Sohbet geçmişi bu cihazda güncellenemedi."), !1;
		}
	}
	function l(e) {
		return s().find((t) => t?.id === e) || null;
	}
	function u(e, t) {
		let n = s(), r = n.find((t) => t?.id === e);
		return r ? (t(r), c(n)) : !1;
	}
	function d(e) {
		return e?.querySelector?.(".conversation-open")?.dataset?.conversationId || "";
	}
	function f(e, t) {
		e.forEach((e, n) => {
			if (d(e)) return;
			let r = t[n];
			r?.id && e.querySelector(".conversation-open")?.setAttribute("data-conversation-id", r.id);
		});
	}
	function p(e, t) {
		let n = e.querySelector(".conversation-open");
		n && typeof t?.title == "string" && (n.dataset.conversationId = t.id, n.classList.add("conversation-title"), n.textContent = t.title || "Yeni sohbet", n.title = t.title || "Yeni sohbet");
	}
	function m(e, t) {
		let n = document.createElement("button");
		return n.type = "button", n.className = "history-manage-btn", n.textContent = e, n.setAttribute("aria-label", t), n;
	}
	function h(e) {
		e.querySelector(`.${r}`)?.remove();
	}
	function g(e, t) {
		let n = e.querySelector(".conversation-delete");
		n && n.dataset[i] !== "true" && (n.dataset[i] = "true", n.addEventListener("click", (e) => {
			let n = (l(t.id) || t).title || "Yeni sohbet";
			window.confirm(`"${n}" sohbeti silinsin mi? Bu işlem geri alınamaz.`) || (e.preventDefault(), e.stopImmediatePropagation());
		}, !0));
	}
	function _(e, t) {
		h(e);
		let n = document.createElement("div");
		n.className = r, n.setAttribute("role", "group"), n.setAttribute("aria-label", "Sohbet adını düzenle");
		let i = document.createElement("input");
		i.type = "text", i.maxLength = 80, i.value = t.title || "Yeni sohbet", i.setAttribute("aria-label", "Yeni sohbet adı");
		let a = document.createElement("div");
		a.className = "history-rename-actions";
		let s = m("Vazgeç", "Sohbet adını değiştirmeyi iptal et"), c = m("Kaydet", "Sohbet adını kaydet");
		c.classList.add("primary");
		let l = () => {
			let n = i.value.trim().replace(/\s+/g, " ").slice(0, 80);
			if (!n) return o("Sohbet adı boş olamaz.");
			u(t.id, (e) => {
				e.title = n;
			}) && (p(e, {
				...t,
				title: n
			}), h(e), o("Sohbet adı güncellendi."));
		};
		s.addEventListener("click", () => h(e)), c.addEventListener("click", l), i.addEventListener("keydown", (t) => {
			t.key === "Enter" && (t.preventDefault(), l()), t.key === "Escape" && (t.preventDefault(), h(e));
		}), a.append(s, c), n.append(i, a), e.append(n), i.focus(), i.select();
	}
	function v(e, t) {
		if (!e || !t?.id) return;
		let r = e.querySelector(".conversation-open");
		if (!r) return;
		r.dataset.conversationId = t.id, e.classList.toggle("pinned", t.pinned === !0), p(e, t), g(e, t), e.querySelector(`.${n}`)?.remove();
		let i = document.createElement("div");
		i.className = n, i.setAttribute("aria-label", "Sohbet işlemleri");
		let a = m(t.pinned === !0 ? "◆" : "◇", t.pinned === !0 ? "Sohbet sabitlemesini kaldır" : "Sohbeti sabitle");
		a.setAttribute("aria-pressed", String(t.pinned === !0)), a.title = t.pinned === !0 ? "Sabitlemeyi kaldır" : "Sohbeti sabitle";
		let s = m("✎", "Sohbet adını değiştir");
		s.title = "Sohbet adını değiştir", a.addEventListener("click", (e) => {
			e.preventDefault(), e.stopPropagation();
			let n = !l(t.id)?.pinned;
			u(t.id, (e) => {
				e.pinned = n;
			}) && (b(), o(n ? "Sohbet sabitlendi." : "Sohbet sabitlemesi kaldırıldı."));
		}), s.addEventListener("click", (n) => {
			n.preventDefault(), n.stopPropagation();
			let r = l(t.id);
			r && _(e, r);
		}), i.append(a, s), e.append(i);
	}
	function y() {
		let e = Array.from(a.list.querySelectorAll(t));
		e.sort((e, t) => Number(t.classList.contains("pinned")) - Number(e.classList.contains("pinned"))), e.forEach((e) => a.list.append(e));
	}
	function b() {
		let e = s();
		if (!e.length) return;
		let n = Array.from(a.list.querySelectorAll(t));
		f(n, e);
		let r = new Map(e.map((e) => [e.id, e]));
		for (let e of n) {
			let t = r.get(d(e));
			t && v(e, t);
		}
		y();
	}
	new MutationObserver(() => b()).observe(a.list, {
		childList: !0,
		subtree: !0
	}), b(), window.addEventListener("storage", (t) => {
		t.key === e && b();
	});
})();
//#endregion

//# sourceMappingURL=chat-history-management.js.map