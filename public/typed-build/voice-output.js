//#region public/typed/voice-output.ts
var e = "hafize.voiceOutput.v1";
function t(e) {
	return typeof e == "string" ? e.replace(/\`\`\`[\s\S]*?\`\`\`/g, " Kod bloğu atlandı. ").replace(/\`([^\`]+)\`/g, "$1").replace(/https?:\/\/\S+/gi, " bağlantı ").replace(/[*_#>|~]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 2400) : "";
}
function n(e, n = 240) {
	let r = t(e);
	if (!r) return [];
	let i = Number.isInteger(n) && n >= 80 ? n : 240, a = r.match(/[^.!?…]+[.!?…]?/g) || [r], o = [], s = "";
	for (let e of a) {
		let t = e.trim();
		if (!t) continue;
		let n = s ? `${s} ${t}` : t;
		if (n.length <= i) {
			s = n;
			continue;
		}
		if (s && o.push(s), t.length <= i) {
			s = t;
			continue;
		}
		let r = "";
		for (let e of t.split(" ")) {
			let t = r ? `${r} ${e}` : e;
			t.length > i && r ? (o.push(r), r = e) : r = t;
		}
		s = r;
	}
	return s && o.push(s), o;
}
function r(t) {
	try {
		return t?.getItem(e) === "true";
	} catch {
		return !1;
	}
}
function i(t, n) {
	try {
		t?.setItem(e, String(n));
	} catch {}
}
function a(e, t) {
	let a = e.querySelector("#voiceOutputToggle"), o = e.querySelector(".voice-card"), s = e.querySelector("#composer"), c = e.querySelector("#messageInput"), l = e.querySelector("#messages"), u = e.querySelector("#micBtn");
	if (!a || !o) return null;
	let d = t.speechSynthesis, f = t.SpeechSynthesisUtterance, p = !!(d && typeof d.speak == "function" && f), m = t.localStorage, h = p && r(m), g = !1, _ = !1, v = [], y = () => {
		a.disabled = !p, a.setAttribute("aria-pressed", String(h)), a.textContent = p ? h ? "Sesli yanıt açık" : "Sesli yanıt kapalı" : "Sesli yanıt desteklenmiyor", o.classList.toggle("speaking", g), o.classList.toggle("thinking", _ && !g);
	}, b = () => {
		v = [], g = !1;
		try {
			d?.cancel();
		} catch {}
		y();
	}, x = () => {
		try {
			return d?.getVoices?.().find((e) => String(e.lang || "").toLowerCase().startsWith("tr")) || null;
		} catch {
			return null;
		}
	}, S = () => {
		if (!h || !p || !v.length) {
			g = !1, y();
			return;
		}
		let e = new f(v.shift());
		e.lang = "tr-TR", e.rate = .98, e.pitch = 1;
		let t = x();
		t && (e.voice = t), e.onend = S, e.onerror = () => {
			v = [], g = !1, y();
		}, g = !0, _ = !1, y();
		try {
			d.speak(e);
		} catch {
			e.onerror?.(new SpeechSynthesisErrorEvent("error"));
		}
	}, C = (t) => {
		if (!h || !p || e.hidden) return !1;
		let r = n(t);
		return r.length ? (b(), v = r, S(), !0) : !1;
	}, w = (e) => (h = p && !!e, i(m, h), h || b(), y(), h), T = () => {
		let e = l?.querySelectorAll(".message.assistant .content") || [], n = e.length ? e[e.length - 1] : null;
		return t.HafizeChatMarkdown?.sourceFor?.(n) || n?.textContent || "";
	}, E = () => {
		if (c?.disabled) {
			_ = !0, g && b(), y();
			return;
		}
		let e = _;
		_ = !1, y(), e && C(T());
	}, D = () => w(!h), O = () => b(), k = () => {
		e.hidden && b();
	};
	a.addEventListener("click", D), s?.addEventListener("submit", O, !0), e.addEventListener("visibilitychange", k);
	let A = t.MutationObserver, j = u && A ? new A(() => {
		u.getAttribute("aria-pressed") === "true" && b();
	}) : null;
	j?.observe(u, {
		attributes: !0,
		attributeFilter: ["aria-pressed"]
	});
	let M = c && A ? new A(E) : null;
	return M?.observe(c, {
		attributes: !0,
		attributeFilter: ["disabled"]
	}), y(), Object.freeze({
		isSupported: p,
		isEnabled: () => h,
		isSpeaking: () => g,
		setEnabled: w,
		speak: C,
		cancel: b,
		syncStreamState: E,
		destroy() {
			b(), j?.disconnect(), M?.disconnect(), a.removeEventListener("click", D), s?.removeEventListener("submit", O, !0), e.removeEventListener("visibilitychange", k);
		}
	});
}
var o = Object.freeze({
	STORAGE_KEY: e,
	normalizeSpeechText: t,
	splitSpeechText: n,
	installVoiceOutput: a
});
globalThis.HafizeVoiceOutput = o;
var s = () => a(document, globalThis);
typeof document < "u" && (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", s, { once: !0 }) : s());
//#endregion
export { e as STORAGE_KEY, a as installVoiceOutput, t as normalizeSpeechText, n as splitSpeechText };

//# sourceMappingURL=voice-output.js.map