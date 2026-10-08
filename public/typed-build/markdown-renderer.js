import { t as e } from "./rolldown-runtime-CtkjhSXr.js";
//#region public/markdown-renderer.ts
var t = /* @__PURE__ */ e(((e, t) => {
	(function(e, n) {
		let r = n();
		typeof t == "object" && t?.exports ? t.exports = r : e.HafizeMarkdown = r;
	})(typeof globalThis < "u" ? globalThis : self, function() {
		let e = Object.freeze([
			"http:",
			"https:",
			"mailto:"
		]), t = Object.freeze({
			MAX_SOURCE_LENGTH: 12e4,
			MAX_LINES: 4e3,
			MAX_BLOCKS: 800,
			MAX_BLOCK_DEPTH: 6,
			MAX_INLINE_DEPTH: 8,
			MAX_INLINE_NODES: 600,
			MAX_LIST_ITEMS: 300,
			MAX_TABLE_ROWS: 120,
			MAX_TABLE_COLUMNS: 16,
			MAX_CODE_LANGUAGE_LENGTH: 24,
			MAX_URL_LENGTH: 2048,
			MAX_TITLE_LENGTH: 200
		}), n = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/, r = /^( {0,3})(`{3,}|~{3,})[ \t]*([^`]*)$/, i = /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/, a = /^ {0,3}>[ \t]?/, o = /^( {0,3})([-+*]|\d{1,9}[.)])([ \t]+)(.*)$/, s = /^( {0,3})([-+*]|\d{1,9}[.)])[ \t]*$/, c = /^:?-{1,}:?$/, l = /^[A-Za-z0-9+#._-]{1,24}$/, u = /[\\`*_{}[\]()#+\-.!|~<>"']/, d = /[\p{L}\p{N}]/u, f = /^https?:\/\/[^\s<>`]+/i, p = /^<((?:https?|mailto):[^\s<>]{1,2048})>/i;
		function m(e) {
			return typeof e != "string" || !e ? "" : e.replace(/\r\n?/g, "\n").replace(/\u0000/g, "�").replace(/\t/g, "    ");
		}
		function h(n) {
			let r = String(n ?? "").trim();
			if (!r || r.length > t.MAX_URL_LENGTH || /[\u0000-\u0020\u007f]/.test(r)) return "";
			let i = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(r);
			return i && e.includes(`${i[1].toLowerCase()}:`) ? r : "";
		}
		function g(e, t, n) {
			let r = 0;
			for (; t + r < e.length && e[t + r] === n;) r += 1;
			return r;
		}
		function _(e) {
			let t = 0;
			for (; t < e.length && e[t] === " ";) t += 1;
			return t;
		}
		function v() {
			return {
				blocks: 0,
				truncated: !1
			};
		}
		function y(e) {
			return e.blocks += 1, e.blocks > t.MAX_BLOCKS ? (e.truncated = !0, !1) : !0;
		}
		function b(e, t, n) {
			let r = t;
			for (; r < e.length;) {
				if (e[r] !== "`") {
					r += 1;
					continue;
				}
				let t = g(e, r, "`");
				if (t === n) return r;
				r += t;
			}
			return -1;
		}
		function x(e) {
			let t = e.replace(/\n/g, " ");
			return t.length > 2 && t.startsWith(" ") && t.endsWith(" ") && t.trim() ? t.slice(1, -1) : t;
		}
		function S(e, t, n, r) {
			let i = t;
			for (; i < e.length;) {
				let t = e[i];
				if (t === "\\") {
					i += 2;
					continue;
				}
				if (t === "`") {
					let t = g(e, i, "`"), n = b(e, i + t, t);
					i = n < 0 ? i + t : n + t;
					continue;
				}
				if (t !== n) {
					i += 1;
					continue;
				}
				let a = g(e, i, n), o = e[i - 1], s = e[i + a];
				if (a >= r && o !== void 0 && !/\s/.test(o) && (n !== "_" || !s || !d.test(s))) return i;
				i += a;
			}
			return -1;
		}
		function C(e, t) {
			let n = 0, r = t;
			for (; r < e.length;) {
				let t = e[r];
				if (t === "\\") r += 2;
				else if (t === "`") {
					let t = g(e, r, "`"), n = b(e, r + t, t);
					r = n < 0 ? r + t : n + t;
				} else {
					if (t === "[") n += 1;
					else if (t === "]" && (--n, n === 0)) return r;
					r += 1;
				}
			}
			return -1;
		}
		function w(e, n) {
			if (e[n] !== "(") return null;
			let r = n + 1;
			for (; r < e.length && /[ \t\n]/.test(e[r]);) r += 1;
			let i = "";
			if (e[r] === "<") {
				let t = e.indexOf(">", r + 1);
				if (t < 0) return null;
				i = e.slice(r + 1, t), r = t + 1;
			} else {
				let t = 0, n = r;
				for (; r < e.length;) {
					let n = e[r];
					if (n === "\\") r += 2;
					else {
						if (/[ \t\n]/.test(n)) break;
						if (n === "(") t += 1;
						else if (n === ")") {
							if (t === 0) break;
							--t;
						}
						r += 1;
					}
				}
				i = e.slice(n, r).replace(/\\([\\`*_{}[\]()#+\-.!|~<>"'])/g, "$1");
			}
			for (; r < e.length && /[ \t\n]/.test(e[r]);) r += 1;
			let a = "", o = e[r];
			if (o === "\"" || o === "'") {
				let n = e.indexOf(o, r + 1);
				if (n < 0) return null;
				for (a = e.slice(r + 1, n).slice(0, t.MAX_TITLE_LENGTH), r = n + 1; r < e.length && /[ \t\n]/.test(e[r]);) r += 1;
			}
			return e[r] === ")" ? {
				destination: i,
				title: a,
				end: r + 1
			} : null;
		}
		function T(e) {
			let t = e;
			for (; t.length > 1;) {
				let e = t[t.length - 1];
				if (/[.,;:!?'"]/.test(e)) t = t.slice(0, -1);
				else if (e === ")" && (t.match(/\(/g)?.length ?? 0) < (t.match(/\)/g)?.length ?? 0)) t = t.slice(0, -1);
				else if (e === "]" || e === "}" || e === ">") t = t.slice(0, -1);
				else break;
			}
			return t;
		}
		function E(e, n = v(), r = 0) {
			let i = typeof e == "string" ? e : "", a = [], o = "", s = () => {
				o &&= (a.push({
					type: "text",
					value: o
				}), "");
			}, c = (e) => {
				s(), a.push(e);
			}, l = (e) => r >= t.MAX_INLINE_DEPTH ? [{
				type: "text",
				value: e
			}] : E(e, n, r + 1), m = 0;
			for (; m < i.length;) {
				if (a.length >= t.MAX_INLINE_NODES) {
					n.truncated = !0, o += i.slice(m);
					break;
				}
				let e = i[m];
				if (e === "\\" && u.test(i[m + 1] ?? "")) o += i[m + 1], m += 2;
				else if (e === "\n") o = o.replace(/[ \t]+$/, ""), c({ type: "break" }), m += 1;
				else if (e === "`") {
					let e = g(i, m, "`"), t = b(i, m + e, e);
					if (t > 0) {
						c({
							type: "code",
							value: x(i.slice(m + e, t))
						}), m = t + e;
						continue;
					}
					o += i.slice(m, m + e), m += e;
				} else {
					if (e === "<") {
						let e = p.exec(i.slice(m)), t = e ? h(e[1]) : "";
						if (t) {
							c({
								type: "link",
								href: t,
								title: "",
								children: [{
									type: "text",
									value: e[1]
								}]
							}), m += e[0].length;
							continue;
						}
					}
					if (e === "[" || e === "!" && i[m + 1] === "[") {
						let t = e === "!", n = t ? m + 1 : m, r = C(i, n), a = r > 0 ? w(i, r + 1) : null, o = a ? h(a.destination) : "";
						if (o) {
							let e = i.slice(n + 1, r), s = e ? l(e) : [{
								type: "text",
								value: o
							}];
							c({
								type: "link",
								href: o,
								title: a.title,
								image: t,
								children: s
							}), m = a.end;
							continue;
						}
					}
					if (e === "~" && i[m + 1] === "~" && i[m + 2] && !/[\s~]/.test(i[m + 2])) {
						let e = S(i, m + 2, "~", 2);
						if (e > m + 2) {
							c({
								type: "strike",
								children: l(i.slice(m + 2, e))
							}), m = e + 2;
							continue;
						}
					}
					if (e === "*" || e === "_") {
						let t = g(i, m, e), n = i[m + t], r = i[m - 1];
						if (n !== void 0 && !/\s/.test(n) && (e !== "_" || !r || !d.test(r))) {
							let n = Math.min(t, 3), r = S(i, m + n, e, n);
							if (r > 0) {
								let e = l(i.slice(m + n, r));
								c(n >= 3 ? {
									type: "strong",
									children: [{
										type: "em",
										children: e
									}]
								} : n === 2 ? {
									type: "strong",
									children: e
								} : {
									type: "em",
									children: e
								}), m = r + n;
								continue;
							}
						}
					}
					if ((e === "h" || e === "H") && (m === 0 || /[\s(<]/.test(i[m - 1]))) {
						let e = f.exec(i.slice(m)), t = e ? T(e[0]) : "", n = t ? h(t) : "";
						if (n) {
							c({
								type: "link",
								href: n,
								title: "",
								children: [{
									type: "text",
									value: t
								}]
							}), m += t.length;
							continue;
						}
					}
					o += e, m += 1;
				}
			}
			return s(), a;
		}
		function D(e) {
			let t = [], n = "";
			for (let r = 0; r < e.length; r += 1) {
				let i = e[r];
				i === "\\" && e[r + 1] === "|" ? (n += "|", r += 1) : i === "|" ? (t.push(n), n = "") : n += i;
			}
			return t.push(n), t.length > 1 && !t[0].trim() && t.shift(), t.length > 1 && !t[t.length - 1].trim() && t.pop(), t.map((e) => e.trim());
		}
		function O(e) {
			let n = D(e);
			return !n.length || n.length > t.MAX_TABLE_COLUMNS || !n.every((e) => c.test(e)) ? null : n.map((e) => {
				let t = e.startsWith(":"), n = e.endsWith(":");
				return t && n ? "center" : n ? "right" : t ? "left" : "";
			});
		}
		function k(e) {
			return !e || !e.trim() || n.test(e) || r.test(e) || i.test(e) || a.test(e) || o.test(e) || s.test(e);
		}
		function A(e) {
			return /\d/.test(e) ? `ordered:${e.slice(-1)}` : `bullet:${e}`;
		}
		function j(e, n, i) {
			let a = r.exec(e[n]);
			if (!a) return null;
			let o = a[1].length, s = a[2], c = s[0], u = a[3].trim().split(/\s+/)[0] ?? "", d = l.test(u) ? u.slice(0, t.MAX_CODE_LANGUAGE_LENGTH) : "", f = [], p = n + 1, m = !1;
			for (; p < e.length;) {
				let t = e[p], n = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(t);
				if (n && n[1][0] === c && n[1].length >= s.length) {
					m = !0, p += 1;
					break;
				}
				f.push(t.slice(Math.min(o, _(t)))), p += 1;
			}
			return {
				block: {
					type: "code",
					language: d,
					text: f.join("\n"),
					closed: m
				},
				next: p
			};
		}
		function M(e, t) {
			let n = [], r = t;
			for (; r < e.length;) {
				let t = e[r];
				if (a.test(t)) n.push(t.replace(a, "")), r += 1;
				else if (t.trim() && n.length && n[n.length - 1].trim() && !k(t)) n.push(t.trim()), r += 1;
				else break;
			}
			return {
				body: n,
				next: r
			};
		}
		function N(e, n, r, i) {
			let a = o.exec(e[n]) ?? s.exec(e[n]);
			if (!a) return null;
			let c = A(a[2]), l = c.startsWith("ordered"), u = l ? Math.max(0, Number.parseInt(a[2], 10) || 1) : 1, d = [], f = !1, p = n;
			for (; p < e.length;) {
				let n = o.exec(e[p]) ?? s.exec(e[p]);
				if (!n || A(n[2]) !== c) break;
				if (d.length >= t.MAX_LIST_ITEMS) {
					r.truncated = !0;
					break;
				}
				let a = n[1].length, l = n[3] ? Math.min(n[3].length, 4) : 1, u = a + n[2].length + l, m = [n[4] ?? ""];
				p += 1;
				let h = 0;
				for (; p < e.length;) {
					let t = e[p];
					if (!t.trim()) h += 1, p += 1;
					else if (_(t) >= u) h &&= (m.push(""), f = !0, 0), m.push(t.slice(u)), p += 1;
					else {
						if (h || k(t)) break;
						m.push(t.trim()), p += 1;
					}
				}
				if (h && p < e.length) {
					let t = o.exec(e[p]) ?? s.exec(e[p]);
					t && A(t[2]) === c && (f = !0);
				}
				d.push({ blocks: I(m, r, i + 1) });
			}
			return d.length ? {
				block: {
					type: "list",
					ordered: l,
					start: l ? u : 1,
					tight: !f,
					items: d
				},
				next: p
			} : null;
		}
		function P(e, t) {
			let n = e[t], r = e[t + 1];
			if (!n || !r || !n.includes("|")) return !1;
			let i = O(r);
			return !!i && D(n).length === i.length;
		}
		function F(e, n, r) {
			if (!P(e, n)) return null;
			let i = O(e[n + 1]), a = D(e[n]), o = [], s = n + 2;
			for (; s < e.length;) {
				let n = e[s];
				if (!n.trim() || !n.includes("|")) break;
				if (o.length >= t.MAX_TABLE_ROWS) {
					r.truncated = !0;
					break;
				}
				let a = D(n), c = Array.from({ length: i.length }, (e, t) => E(a[t] ?? "", r));
				o.push(c), s += 1;
			}
			return {
				block: {
					type: "table",
					align: i,
					header: a.map((e) => E(e, r)),
					rows: o
				},
				next: s
			};
		}
		function I(e, r, o = 0) {
			let s = [];
			if (o > t.MAX_BLOCK_DEPTH) {
				let t = e.join("\n").trim();
				return t && s.push({
					type: "paragraph",
					inline: [{
						type: "text",
						value: t
					}]
				}), s;
			}
			let c = 0;
			for (; c < e.length;) {
				let t = e[c];
				if (!t.trim()) {
					c += 1;
					continue;
				}
				if (!y(r)) break;
				let l = j(e, c, r);
				if (l) {
					s.push(l.block), c = l.next;
					continue;
				}
				let u = n.exec(t);
				if (u) {
					let e = (u[2] ?? "").replace(/[ \t]+#+[ \t]*$/, "");
					s.push({
						type: "heading",
						level: u[1].length,
						inline: E(e, r)
					}), c += 1;
					continue;
				}
				if (i.test(t)) {
					s.push({ type: "divider" }), c += 1;
					continue;
				}
				if (a.test(t)) {
					let t = M(e, c);
					s.push({
						type: "quote",
						blocks: I(t.body, r, o + 1)
					}), c = t.next;
					continue;
				}
				let d = F(e, c, r);
				if (d) {
					s.push(d.block), c = d.next;
					continue;
				}
				let f = N(e, c, r, o);
				if (f) {
					s.push(f.block), c = f.next;
					continue;
				}
				let p = [t.trim()];
				for (c += 1; c < e.length;) {
					let t = e[c];
					if (!t.trim() || k(t) || P(e, c)) break;
					p.push(t.trim()), c += 1;
				}
				s.push({
					type: "paragraph",
					inline: E(p.join("\n"), r)
				});
			}
			return s;
		}
		function L(e) {
			let n = m(e), r = v();
			if (!n.trim()) return {
				blocks: [],
				truncated: !1,
				source: n
			};
			let i = n;
			i.length > t.MAX_SOURCE_LENGTH && (i = i.slice(0, t.MAX_SOURCE_LENGTH), r.truncated = !0);
			let a = i.split("\n");
			return a.length > t.MAX_LINES && (a = a.slice(0, t.MAX_LINES), r.truncated = !0), {
				blocks: I(a, r, 0),
				truncated: r.truncated,
				source: n
			};
		}
		function R(e) {
			let t = m(e);
			return t.trim() ? /(^|\n) {0,3}(#{1,6}[ \t]|[-+*][ \t]|\d{1,9}[.)][ \t]|>[ \t]?|```|~~~|\|)/.test(t) || /(\*\*|__|~~|`|\[[^\]]*\]\(|<https?:|https?:\/\/)/.test(t) : !1;
		}
		function z(e) {
			let t = "";
			for (let n of e ?? []) if (n && typeof n == "object") {
				if (n.type === "text" || n.type === "code") t += n.value;
				else if (n.type === "break") t += "\n";
				else if (n.type === "link") {
					let e = z(n.children);
					t += e || n.href;
				} else t += z(n.children);
			}
			return t;
		}
		function B(e) {
			let t = [];
			for (let n of e ?? []) if (n && typeof n == "object") {
				if (n.type === "paragraph" || n.type === "heading") t.push(z(n.inline));
				else if (n.type === "code") t.push(n.text);
				else if (n.type === "quote") t.push(B(n.blocks));
				else if (n.type === "list") {
					let e = n.items.map((e, t) => {
						let r = B(e.blocks).replace(/\n{2,}/g, "\n");
						return n.ordered ? `${n.start + t}. ${r}` : r;
					});
					t.push(e.join("\n"));
				} else if (n.type === "table") {
					let e = [n.header, ...n.rows].map((e) => e.map((e) => z(e)).join(" · "));
					t.push(e.join("\n"));
				}
			}
			return t.filter((e) => e.trim()).join("\n\n");
		}
		function V(e) {
			let t = m(e);
			return t.trim() ? B(L(t).blocks) || t : "";
		}
		let H = /* @__PURE__ */ new WeakMap();
		function U(e, t, n) {
			let r = e.createElement(t);
			return n && r.setAttribute("class", n), r;
		}
		function W(e, t, n) {
			for (let r of n ?? []) {
				if (!r || typeof r != "object") continue;
				if (r.type === "text") {
					t.appendChild(e.createTextNode(r.value));
					continue;
				}
				if (r.type === "break") {
					t.appendChild(U(e, "br"));
					continue;
				}
				if (r.type === "code") {
					let n = U(e, "code", "md-inline-code");
					n.textContent = r.value, t.appendChild(n);
					continue;
				}
				if (r.type === "link") {
					let n = h(r.href);
					if (!n) {
						W(e, t, r.children);
						continue;
					}
					let i = U(e, "a", r.image ? "md-link md-link-image" : "md-link");
					i.setAttribute("href", n), i.setAttribute("target", "_blank"), i.setAttribute("rel", "noopener noreferrer nofollow ugc"), r.title && i.setAttribute("title", r.title), W(e, i, r.children), t.appendChild(i);
					continue;
				}
				let n = r.type === "strong" ? "strong" : r.type === "em" ? "em" : r.type === "strike" ? "s" : "";
				if (!n) continue;
				let i = U(e, n);
				W(e, i, r.children), t.appendChild(i);
			}
		}
		function G(e, t) {
			let n = U(e, "div", "md-code");
			t.language && n.setAttribute("data-language", t.language), t.closed || n.setAttribute("data-streaming", "true");
			let r = U(e, "div", "md-code-head"), i = U(e, "span", "md-code-lang");
			i.setAttribute("data-language", t.language || "kod"), i.setAttribute("aria-hidden", "true");
			let a = U(e, "button", "md-code-copy");
			a.setAttribute("type", "button"), a.setAttribute("data-md-copy", "code"), a.setAttribute("data-state", "idle"), a.setAttribute("aria-label", "Kod bloğunu kopyala"), a.setAttribute("title", "Kod bloğunu panoya kopyala"), r.appendChild(i), r.appendChild(a);
			let o = U(e, "pre", "md-code-body"), s = U(e, "code");
			return t.language && s.setAttribute("data-language", t.language), s.textContent = t.text, o.appendChild(s), n.appendChild(r), n.appendChild(o), n;
		}
		function K(e, t) {
			let n = U(e, "div", "md-table-wrap");
			n.setAttribute("role", "region"), n.setAttribute("tabindex", "0"), n.setAttribute("aria-label", "Tablo");
			let r = U(e, "table", "md-table"), i = U(e, "thead"), a = U(e, "tr");
			t.header.forEach((n, r) => {
				let i = U(e, "th");
				i.setAttribute("scope", "col"), t.align[r] && i.setAttribute("data-align", t.align[r]), W(e, i, n), a.appendChild(i);
			}), i.appendChild(a), r.appendChild(i);
			let o = U(e, "tbody");
			for (let n of t.rows) {
				let r = U(e, "tr");
				n.forEach((n, i) => {
					let a = U(e, "td");
					t.align[i] && a.setAttribute("data-align", t.align[i]), W(e, a, n), r.appendChild(a);
				}), o.appendChild(r);
			}
			return r.appendChild(o), n.appendChild(r), n;
		}
		function q(e, t, n, r = !1) {
			for (let i of n ?? []) if (i && typeof i == "object") {
				if (i.type === "paragraph") {
					if (r) {
						W(e, t, i.inline);
						continue;
					}
					let n = U(e, "p", "md-paragraph");
					W(e, n, i.inline), t.appendChild(n);
				} else if (i.type === "heading") {
					let n = Math.min(6, Math.max(1, Number(i.level) || 1)), r = U(e, `h${n}`, `md-heading md-heading-${n}`);
					W(e, r, i.inline), t.appendChild(r);
				} else if (i.type === "code") t.appendChild(G(e, i));
				else if (i.type === "divider") t.appendChild(U(e, "hr", "md-divider"));
				else if (i.type === "quote") {
					let n = U(e, "blockquote", "md-quote");
					q(e, n, i.blocks), t.appendChild(n);
				} else if (i.type === "table") t.appendChild(K(e, i));
				else if (i.type === "list") {
					let n = U(e, i.ordered ? "ol" : "ul", `md-list${i.tight ? " md-list-tight" : ""}`);
					i.ordered && i.start !== 1 && n.setAttribute("start", String(i.start));
					for (let t of i.items ?? []) {
						let r = U(e, "li", "md-list-item"), a = i.tight && t.blocks.length === 1 && t.blocks[0].type === "paragraph";
						q(e, r, t.blocks, a), n.appendChild(r);
					}
					t.appendChild(n);
				}
			}
		}
		function J(e, t, n = {}) {
			if (!e) return {
				rendered: !1,
				truncated: !1,
				blocks: 0
			};
			let r = n.document ?? e.ownerDocument;
			if (!r || typeof r.createElement != "function") return {
				rendered: !1,
				truncated: !1,
				blocks: 0
			};
			let i = m(t), a = typeof n.placeholder == "string" ? n.placeholder : "";
			if (H.set(e, i), !i.trim()) return e.replaceChildren(r.createTextNode(a)), e.removeAttribute("data-md"), {
				rendered: !1,
				truncated: !1,
				blocks: 0
			};
			let o = L(i);
			if (!o.blocks.length) return e.replaceChildren(r.createTextNode(i)), e.removeAttribute("data-md"), {
				rendered: !1,
				truncated: o.truncated,
				blocks: 0
			};
			let s = r.createDocumentFragment();
			return q(r, s, o.blocks), e.replaceChildren(s), e.setAttribute("data-md", o.truncated ? "truncated" : "on"), {
				rendered: !0,
				truncated: o.truncated,
				blocks: o.blocks.length
			};
		}
		function Y(e, t, n = {}) {
			if (!e) return !1;
			let r = n.document ?? e.ownerDocument;
			if (!r || typeof r.createTextNode != "function") return !1;
			let i = m(t);
			return H.set(e, i), e.replaceChildren(r.createTextNode(i || (n.placeholder ?? ""))), e.removeAttribute("data-md"), !0;
		}
		function X(e) {
			return H.get(e) ?? "";
		}
		return Object.freeze({
			LIMITS: t,
			SAFE_SCHEMES: e,
			normalizeSource: m,
			safeUrl: h,
			hasMarkdown: R,
			parseInline: E,
			parseMarkdown: L,
			toPlainText: V,
			renderMarkdownInto: J,
			renderPlainInto: Y,
			sourceFor: X
		});
	});
}));
//#endregion
export default t();

//# sourceMappingURL=markdown-renderer.js.map