import { Disposer, boundedText, on, query, text } from './browser-platform.ts';

type Attachment = { name: string; size: number; lastModified: number; block: string };
type ComposerWithAttachments = HTMLFormElement & { _hafizeAttachments?: Attachment[] };

export const COMPOSER_LIMITS = Object.freeze({ fileBytes: 384 * 1024, attachments: 3, text: 9000 });
const ACCEPTED_EXTENSIONS = /\.(?:txt|md|markdown|json|csv|tsv|html?|css|js|mjs|cjs|jsx|tsx|py|java|c|h|cpp|hpp|xml|yaml|yml|toml|ini|log)$/i;

export function acceptedFile(file: File | null | undefined): boolean {
  return Boolean(file && Number.isFinite(file.size) && file.size > 0 && file.size <= COMPOSER_LIMITS.fileBytes && (file.type.startsWith('text/') || file.type === 'application/json' || ACCEPTED_EXTENSIONS.test(file.name)));
}

export function composeAttachment(file: Pick<File, 'name'>, source: string): string {
  const clipped = source.replace(/\r\n/g, '\n').slice(0, COMPOSER_LIMITS.text);
  const notice = source.length > COMPOSER_LIMITS.text ? `\n[Dosya içeriği ${COMPOSER_LIMITS.text} karakterle sınırlandı.]\n` : '';
  return `\n\n[Ekli dosya: ${file.name}]\n---\n${clipped}${notice}---\n`;
}

export async function copyText(value: string, documentRef: Document = document): Promise<boolean> {
  if (!value) return false;
  try { await navigator.clipboard.writeText(value); return true; } catch {}
  const helper = documentRef.createElement('textarea'); helper.value = value; helper.readOnly = true; helper.style.position = 'fixed'; helper.style.opacity = '0'; documentRef.body.append(helper); helper.select();
  try { return documentRef.execCommand('copy'); } catch { return false; } finally { helper.remove(); }
}

function announce(documentRef: Document, message: string): void {
  const toast = query<HTMLElement>(documentRef, '#toast'); if (!toast || !message) return;
  toast.textContent = message; toast.classList.remove('hidden');
  const win = documentRef.defaultView; if (!win) return;
  const handle = Number(toast.dataset.hafizeComposerToastTimer || 0); if (handle) win.clearTimeout(handle);
  toast.dataset.hafizeComposerToastTimer = String(win.setTimeout(() => toast.classList.add('hidden'), 3200));
}

function attachmentList(composer: ComposerWithAttachments): Attachment[] {
  if (!composer._hafizeAttachments) composer._hafizeAttachments = [];
  return composer._hafizeAttachments;
}

function renderAttachmentStrip(composer: ComposerWithAttachments, documentRef: Document): void {
  const files = attachmentList(composer); let strip = composer.querySelector<HTMLElement>('.attachment-strip');
  if (!files.length) { strip?.remove(); return; }
  if (!strip) { strip = text(documentRef, 'div', '', 'attachment-strip'); strip.setAttribute('aria-label', 'Eklenen dosyalar'); const row = composer.querySelector('.composer-row'); composer.insertBefore(strip, row); }
  strip.replaceChildren();
  files.forEach((file, index) => {
    const chip = text(documentRef, 'span', `${file.name} · ${(file.size / 1024).toFixed(1)} KB`, 'attachment-chip');
    const remove = text<HTMLButtonElement>(documentRef, 'button', '×', 'attachment-remove'); remove.type = 'button'; remove.setAttribute('aria-label', `${file.name} ekini kaldır`);
    remove.addEventListener('click', () => {
      const at = inputValue(composer)?.lastIndexOf(file.block) ?? -1; const input = query<HTMLTextAreaElement>(documentRef, '#messageInput');
      if (input && at >= 0) { input.value = `${input.value.slice(0, at)}${input.value.slice(at + file.block.length)}`; input.dispatchEvent(new Event('input', { bubbles: true })); }
      files.splice(index, 1); renderAttachmentStrip(composer, documentRef); input?.focus();
    }); chip.append(remove); strip.append(chip);
  });
}

function inputValue(_composer: ComposerWithAttachments): string { return query<HTMLTextAreaElement>(document, '#messageInput')?.value || ''; }

export async function addFile(file: File, context: { composer: ComposerWithAttachments; input: HTMLTextAreaElement; documentRef?: Document }): Promise<boolean> {
  const documentRef = context.documentRef || document; const { composer, input } = context; const files = attachmentList(composer);
  if (files.length >= COMPOSER_LIMITS.attachments) { announce(documentRef, `En fazla ${COMPOSER_LIMITS.attachments} dosya ekleyebilirsin.`); return false; }
  if (!acceptedFile(file)) { announce(documentRef, 'Bu dosya türü desteklenmiyor veya dosya 384 KB sınırını aşıyor.'); return false; }
  if (files.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) { announce(documentRef, 'Bu dosya zaten eklendi.'); return false; }
  try {
    const source = await file.text(); if (!source.trim()) { announce(documentRef, `${file.name} boş olduğu için eklenmedi.`); return false; }
    const before = input.value; const fullBlock = composeAttachment(file, source); const nextValue = `${before}${fullBlock}`.slice(0, input.maxLength || 12000); const appended = nextValue.slice(before.length);
    if (!appended) { announce(documentRef, 'Mesaj alanı dolu. Dosya eklenebilmesi için biraz metin silmelisin.'); return false; }
    files.push({ name: file.name, size: file.size, lastModified: file.lastModified, block: appended }); input.value = nextValue; input.dispatchEvent(new Event('input', { bubbles: true })); renderAttachmentStrip(composer, documentRef); input.focus(); announce(documentRef, `${file.name} mesaja eklendi. Dosya sunucuya ayrı bir yükleme olarak gönderilmedi.`); return true;
  } catch { announce(documentRef, `${file.name} okunamadı.`); return false; }
}

function retryPrompt(article: HTMLElement): string { let cursor = article.previousElementSibling as HTMLElement | null; while (cursor) { if (cursor.classList.contains('user')) return query<HTMLElement>(document, '.content',)?.textContent?.trim() || ''; cursor = cursor.previousElementSibling as HTMLElement | null; } return ''; }

function enhanceArticle(article: HTMLElement, input: HTMLTextAreaElement, composer: ComposerWithAttachments, documentRef: Document): void {
  if (!article || !article.classList.contains('assistant') || article.querySelector('.message-actions')) return; const content = article.querySelector<HTMLElement>('.content'); if (!content) return;
  const actions = text<HTMLDivElement>(documentRef, 'div', '', 'message-actions');
  const copy = text<HTMLButtonElement>(documentRef, 'button', 'Kopyala', 'message-action'); copy.type = 'button'; copy.setAttribute('aria-label', 'Hafize yanıtını kopyala');
  copy.addEventListener('click', async () => { if (await copyText(content.textContent?.trim() || '', documentRef)) { copy.textContent = 'Kopyalandı'; window.setTimeout(() => { copy.textContent = 'Kopyala'; }, 1400); } else announce(documentRef, 'Yanıt panoya kopyalanamadı.'); });
  const retry = text<HTMLButtonElement>(documentRef, 'button', 'Yeniden dene', 'message-action'); retry.type = 'button'; retry.setAttribute('aria-label', 'Bu kullanıcı isteğini yeniden gönder');
  retry.addEventListener('click', () => { if (input.disabled) return announce(documentRef, 'Yanıt sürerken yeniden denenemez.'); const prompt = retryPrompt(article); if (!prompt) return announce(documentRef, 'Tekrar gönderilecek kullanıcı mesajı bulunamadı.'); input.value = prompt; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); composer.requestSubmit(); });
  actions.append(copy, retry); article.append(actions);
}

function enhanceUserArticle(article: HTMLElement, documentRef: Document): void {
  if (!article || !article.classList.contains('user') || article.querySelector('.message-actions')) return; const messageId = article.dataset.messageId; if (!article.querySelector('.content') || !messageId) return;
  const actions = text<HTMLDivElement>(documentRef, 'div', '', 'message-actions'); const edit = text<HTMLButtonElement>(documentRef, 'button', 'Düzenle', 'message-action'); edit.type = 'button'; edit.setAttribute('aria-label', 'Kullanıcı mesajını düzenle');
  edit.addEventListener('click', () => documentRef.defaultView?.dispatchEvent(new CustomEvent('hafize:edit-message', { detail: { messageId } }))); actions.append(edit); article.append(actions);
}

export function mountComposerFeatures(documentRef: Document = document, rootRef: Window = window): Readonly<{ destroy: () => void }> | null {
  const composer = query<ComposerWithAttachments>(documentRef, '#composer'); const attachBtn = query<HTMLButtonElement>(documentRef, '#attachBtn'); const input = query<HTMLTextAreaElement>(documentRef, '#messageInput'); const messages = query<HTMLElement>(documentRef, '#messages');
  if (!composer || !attachBtn || !input || !messages) return null;
  const disposer = new Disposer();
  on(attachBtn, 'click', ((event) => { event.preventDefault(); event.stopImmediatePropagation(); if (input.disabled) return; const picker = documentRef.createElement('input'); picker.type = 'file'; picker.hidden = true; picker.multiple = true; picker.accept = '.txt,.md,.markdown,.json,.csv,.tsv,.html,.css,.js,.mjs,.cjs,.jsx,.tsx,.py,.java,.c,.h,.cpp,.hpp,.xml,.yaml,.yml,.toml,.ini,.log,text/plain,application/json'; picker.addEventListener('change', async () => { for (const file of [...(picker.files || [])].slice(0, COMPOSER_LIMITS.attachments)) await addFile(file, { composer, input, documentRef }); picker.remove(); }, { once: true }); documentRef.body.append(picker); picker.click(); }) as EventListener, true, disposer);
  on(composer, 'dragover', ((event) => { event.preventDefault(); composer.classList.add('drag-active'); }) as EventListener, undefined, disposer);
  on(composer, 'dragleave', ((event: DragEvent) => { if (!composer.contains(event.relatedTarget as Node | null)) composer.classList.remove('drag-active'); }) as EventListener, undefined, disposer);
  on(composer, 'drop', (async (event) => { event.preventDefault(); composer.classList.remove('drag-active'); for (const file of [...(event as DragEvent).dataTransfer?.files || []].slice(0, COMPOSER_LIMITS.attachments)) await addFile(file, { composer, input, documentRef }); }) as EventListener, undefined, disposer);
  on(input, 'paste', (async (event) => { const files = [...(event as ClipboardEvent).clipboardData?.files || []]; if (!files.length) return; event.preventDefault(); for (const file of files.slice(0, COMPOSER_LIMITS.attachments)) await addFile(file, { composer, input, documentRef }); }) as EventListener, undefined, disposer);
  on(composer, 'submit', () => { composer._hafizeAttachments = []; renderAttachmentStrip(composer, documentRef); }, true, disposer);
  const observer = new MutationObserver(() => { messages.querySelectorAll<HTMLElement>('.message.assistant').forEach((node) => enhanceArticle(node, input, composer, documentRef)); messages.querySelectorAll<HTMLElement>('.message.user').forEach((node) => enhanceUserArticle(node, documentRef)); });
  observer.observe(messages, { childList: true }); disposer.add(() => observer.disconnect()); observer.takeRecords();
  messages.querySelectorAll<HTMLElement>('.message.assistant').forEach((node) => enhanceArticle(node, input, composer, documentRef)); messages.querySelectorAll<HTMLElement>('.message.user').forEach((node) => enhanceUserArticle(node, documentRef));
  return Object.freeze({ destroy: () => { disposer.flush(); composer._hafizeAttachments = []; composer.querySelector('.attachment-strip')?.remove(); rootRef.getSelection?.()?.removeAllRanges?.(); } });
}

const autoStart = () => mountComposerFeatures(document, window);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoStart, { once: true }); else autoStart();
