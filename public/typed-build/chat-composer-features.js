//#region public/typed/chat-composer-features.ts
(() => {
	let e = 9e3, t = /\.(?:txt|md|markdown|json|csv|tsv|html?|css|js|mjs|cjs|jsx|tsx|py|java|c|h|cpp|hpp|xml|yaml|yml|toml|ini|log)$/i, n = {
		composer: document.querySelector("#composer"),
		attachBtn: document.querySelector("#attachBtn"),
		messageInput: document.querySelector("#messageInput"),
		messages: document.querySelector("#messages"),
		toast: document.querySelector("#toast")
	};
	if (!n.composer || !n.attachBtn || !n.messageInput || !n.messages) return;
	function r(e) {
		n.toast && e && (n.toast.textContent = e, n.toast.classList.remove("hidden"), window.clearTimeout(r.timeoutId), r.timeoutId = window.setTimeout(() => n.toast.classList.add("hidden"), 3200));
	}
	function i(e) {
		return !!e && Number.isFinite(e.size) && e.size > 0 && e.size <= 393216 && (e.type.startsWith("text/") || e.type === "application/json" || t.test(e.name));
	}
	function a() {
		let e = n.composer.querySelector(".attachment-strip"), t = n.composer._hafizeAttachments || [];
		if (!t.length) {
			e?.remove();
			return;
		}
		e || (e = document.createElement("div"), e.className = "attachment-strip", e.setAttribute("aria-label", "Eklenen dosyalar"), n.composer.insertBefore(e, n.composer.querySelector(".composer-row"))), e.replaceChildren();
		for (let [r, i] of t.entries()) {
			let o = document.createElement("span");
			o.className = "attachment-chip", o.textContent = `${i.name} · ${(i.size / 1024).toFixed(1)} KB`;
			let s = document.createElement("button");
			s.type = "button", s.className = "attachment-remove", s.setAttribute("aria-label", `${i.name} ekini kaldır`), s.textContent = "×", s.addEventListener("click", () => {
				let e = n.messageInput.value.lastIndexOf(i.block);
				e >= 0 && (n.messageInput.value = `${n.messageInput.value.slice(0, e)}${n.messageInput.value.slice(e + i.block.length)}`, n.messageInput.dispatchEvent(new Event("input", { bubbles: !0 }))), t.splice(r, 1), a(), n.messageInput.focus();
			}), o.append(s), e.append(o);
		}
	}
	function o(t, n) {
		let r = n.replace(/\r\n/g, "\n").slice(0, e), i = n.length > e ? `\n[Dosya içeriği ${e} karakterle sınırlandı.]\n` : "";
		return `\n\n[Ekli dosya: ${t.name}]\n---\n${r}${i}---\n`;
	}
	async function s(e) {
		let t = n.composer._hafizeAttachments || (n.composer._hafizeAttachments = []);
		if (t.length >= 3) {
			r("En fazla 3 dosya ekleyebilirsin.");
			return;
		}
		if (!i(e)) {
			r("Bu dosya türü desteklenmiyor veya dosya 384 KB sınırını aşıyor.");
			return;
		}
		if (t.some((t) => t.name === e.name && t.size === e.size && t.lastModified === e.lastModified)) {
			r("Bu dosya zaten eklendi.");
			return;
		}
		try {
			let i = await e.text();
			if (!i.trim()) {
				r(`${e.name} boş olduğu için eklenmedi.`);
				return;
			}
			let s = o(e, i), c = n.messageInput.value, l = `${c}${s}`.slice(0, n.messageInput.maxLength || 12e3), u = l.slice(c.length);
			if (!u) {
				r("Mesaj alanı dolu. Dosya eklenebilmesi için biraz metin silmelisin.");
				return;
			}
			t.push({
				name: e.name,
				size: e.size,
				lastModified: e.lastModified,
				block: u
			}), n.messageInput.value = l, n.messageInput.dispatchEvent(new Event("input", { bubbles: !0 })), a(), n.messageInput.focus(), r(`${e.name} mesaja eklendi. Dosya sunucuya ayrı bir yükleme olarak gönderilmedi.`);
		} catch {
			r(`${e.name} okunamadı.`);
		}
	}
	function c() {
		n.composer._hafizeAttachments = [], a();
	}
	function l() {
		if (n.messageInput.disabled) return;
		let e = document.createElement("input");
		e.type = "file", e.hidden = !0, e.multiple = !0, e.accept = ".txt,.md,.markdown,.json,.csv,.tsv,.html,.css,.js,.mjs,.cjs,.jsx,.tsx,.py,.java,.c,.h,.cpp,.hpp,.xml,.yaml,.yml,.toml,.ini,.log,text/plain,application/json", e.addEventListener("change", async () => {
			for (let t of [...e.files].slice(0, 3)) await s(t);
			e.remove();
		}, { once: !0 }), document.body.append(e), e.click();
	}
	async function u(e) {
		if (!e) return !1;
		try {
			return await navigator.clipboard.writeText(e), !0;
		} catch {
			let t = document.createElement("textarea");
			t.value = e, t.setAttribute("readonly", "true"), t.style.position = "fixed", t.style.opacity = "0", document.body.append(t), t.select();
			let n = !1;
			try {
				n = document.execCommand("copy");
			} catch {
				n = !1;
			}
			return t.remove(), n;
		}
	}
	function d(e) {
		let t = e.previousElementSibling;
		for (; t;) {
			if (t.classList.contains("user")) return t.querySelector(".content")?.textContent?.trim() || "";
			t = t.previousElementSibling;
		}
		return "";
	}
	function f(e) {
		if (!e || !e.classList.contains("assistant") || e.querySelector(".message-actions")) return;
		let t = e.querySelector(".content");
		if (!t) return;
		let i = document.createElement("div");
		i.className = "message-actions";
		let a = document.createElement("button");
		a.type = "button", a.className = "message-action", a.textContent = "Kopyala", a.setAttribute("aria-label", "Hafize yanıtını kopyala"), a.title = "Hafize yanıtını panoya kopyala", a.addEventListener("click", async () => {
			let e = window.HafizeChatMarkdown?.sourceFor?.(t) ?? t.textContent;
			await u(String(e || "").trim()) ? (a.textContent = "Kopyalandı", window.setTimeout(() => {
				a.textContent = "Kopyala";
			}, 1400)) : r("Yanıt panoya kopyalanamadı.");
		});
		let o = document.createElement("button");
		o.type = "button", o.className = "message-action", o.textContent = "Yeniden dene", o.setAttribute("aria-label", "Bu kullanıcı isteğini yeniden gönder"), o.title = "Bu mesajın kullanıcı isteğini tekrar gönder", o.addEventListener("click", () => {
			if (n.messageInput.disabled) return r("Yanıt sürerken yeniden denenemez.");
			let t = d(e);
			if (!t) return r("Tekrar gönderilecek kullanıcı mesajı bulunamadı.");
			n.messageInput.value = t, n.messageInput.dispatchEvent(new Event("input", { bubbles: !0 })), n.messageInput.focus(), n.composer.requestSubmit();
		}), i.append(a, o), e.append(i);
	}
	function p(e) {
		if (!e || !e.classList.contains("user") || e.querySelector(".message-actions")) return;
		let t = e.querySelector(".content"), n = e.dataset.messageId;
		if (!t || !n) return;
		let r = document.createElement("div");
		r.className = "message-actions";
		let i = document.createElement("button");
		i.type = "button", i.className = "message-action", i.textContent = "Düzenle", i.setAttribute("aria-label", "Kullanıcı mesajını düzenle"), i.title = "Bu mesajı düzenle ve yeniden gönder", i.addEventListener("click", () => {
			window.dispatchEvent(new CustomEvent("hafize:edit-message", { detail: { messageId: n } }));
		}), r.append(i), e.append(r);
	}
	n.attachBtn.addEventListener("click", (e) => {
		e.preventDefault(), e.stopImmediatePropagation(), l();
	}, !0), n.composer.addEventListener("dragover", (e) => {
		e.preventDefault(), n.composer.classList.add("drag-active");
	}), n.composer.addEventListener("dragleave", (e) => {
		n.composer.contains(e.relatedTarget) || n.composer.classList.remove("drag-active");
	}), n.composer.addEventListener("drop", async (e) => {
		e.preventDefault(), n.composer.classList.remove("drag-active");
		for (let t of [...e.dataTransfer?.files || []].slice(0, 3)) await s(t);
	}), n.messageInput.addEventListener("paste", async (e) => {
		let t = [...e.clipboardData?.files || []];
		if (t.length) {
			e.preventDefault();
			for (let e of t.slice(0, 3)) await s(e);
		}
	}), n.composer.addEventListener("submit", c, !0), new MutationObserver(() => {
		for (let e of n.messages.querySelectorAll(".message.assistant")) f(e);
		for (let e of n.messages.querySelectorAll(".message.user")) p(e);
	}).observe(n.messages, { childList: !0 });
	for (let e of n.messages.querySelectorAll(".message.assistant")) f(e);
	for (let e of n.messages.querySelectorAll(".message.user")) p(e);
})();
//#endregion

//# sourceMappingURL=chat-composer-features.js.map