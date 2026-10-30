/**
 * TypeScript-first frontend migration wave.
 * The browser/global contract is intentionally preserved during the migration.
 */
// @ts-nocheck
import { hafizeApi } from './hafize-api.ts';
import { xlsxToText } from './xlsx-text.ts';
(() => {
  'use strict';

  // A text/code attachment is stored server-side, so the practical limit is what the upload endpoint
  // accepts (50 MB). Media (images/PDF/video) keeps its own limits in rich-content.ts.
  const MAX_FILE_BYTES = 50 * 1024 * 1024;
  const MAX_ATTACHMENTS = 20;
  // Pasted text longer than this becomes a document instead of flooding the composer.
  const PASTE_TO_FILE_CHARS = 4000;
  const MEDIA_EXTENSIONS = /\.(?:pdf|png|jpe?g|gif|webp|heic|bmp|svg|mp4|webm|mov|avi|mkv|mp3|wav|ogg|m4a|docx?|xlsx?|pptx?|zip)$/i;
  const ACCEPTED_EXTENSIONS = /\.(?:txt|md|markdown|json|csv|tsv|html?|css|js|mjs|cjs|jsx|tsx|py|java|c|h|cpp|hpp|xml|yaml|yml|toml|ini|log)$/i;
  const ui = {
    composer: document.querySelector('#composer'),
    attachBtn: document.querySelector('#attachBtn'),
    messageInput: document.querySelector('#messageInput'),
    messages: document.querySelector('#messages'),
    toast: document.querySelector('#toast')
  };

  if (!ui.composer || !ui.attachBtn || !ui.messageInput || !ui.messages) return;

  function announce(message) {
    if (!ui.toast || !message) return;
    ui.toast.textContent = message;
    ui.toast.classList.remove('hidden');
    window.clearTimeout(announce.timeoutId);
    announce.timeoutId = window.setTimeout(() => ui.toast.classList.add('hidden'), 3200);
  }

  function acceptedFile(file) {
    return Boolean(file)
      && Number.isFinite(file.size)
      && file.size > 0
      && file.size <= MAX_FILE_BYTES
      && (file.type.startsWith('text/') || file.type === 'application/json' || ACCEPTED_EXTENSIONS.test(file.name));
  }

  function renderAttachmentStrip() {
    let strip = ui.composer.querySelector('.attachment-strip');
    const files = ui.composer._hafizeAttachments || [];
    if (!files.length) {
      strip?.remove();
      return;
    }
    if (!strip) {
      strip = document.createElement('div');
      strip.className = 'attachment-strip';
      strip.setAttribute('aria-label', 'Eklenen dosyalar');
      ui.composer.insertBefore(strip, ui.composer.querySelector('.composer-row'));
    }
    strip.replaceChildren();
    for (const [index, file] of files.entries()) {
      const chip = document.createElement('span');
      chip.className = 'attachment-chip';
      chip.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'attachment-remove';
      remove.setAttribute('aria-label', `${file.name} ekini kaldır`);
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        files.splice(index, 1);
        renderAttachmentStrip();
        ui.messageInput.focus();
      });
      chip.append(remove);
      strip.append(chip);
    }
  }

  /** A compact, human-readable reference; the content never enters the composer. */
  function composeAttachment(file, url) {
    return `\n[Ekli dosya: ${file.name}](${url})\n`;
  }

  // The reference waits beside the composer, shown as a chip, and joins the text only when the message
  // goes out: the box holds what the user wrote and nothing else.
  function insertAttachment(file, fullBlock, message) {
    const files = ui.composer._hafizeAttachments || (ui.composer._hafizeAttachments = []);
    files.push({ name: file.name, size: file.size, lastModified: file.lastModified, block: fullBlock });
    renderAttachmentStrip();
    ui.messageInput.focus();
    announce(message);
  }

  /** The workbook is read here and only its text is uploaded, like any other text attachment. */
  async function addSpreadsheet(file, files) {
    if (file.size > MAX_FILE_BYTES) {
      announce(`${file.name} eklenemedi: 50 MB sınırını aşıyor.`);
      return;
    }
    if (files.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) {
      announce('Bu dosya zaten eklendi.');
      return;
    }
    announce(`${file.name} hazırlanıyor…`);
    try {
      const text = await xlsxToText(new Uint8Array(await file.arrayBuffer()));
      if (!text.trim()) {
        announce(`${file.name} boş olduğu için eklenmedi.`);
        return;
      }
      const stored = await hafizeApi.uploadDocument(text, file.name, 'text/tab-separated-values');
      insertAttachment(file, composeAttachment(file, stored.url), `${file.name} eklendi; Hafize tablonun içeriğini okuyacak.`);
    } catch (error) {
      announce(`${file.name} eklenemedi: ${String(error?.message || 'dosya işlenemedi').slice(0, 120)}`);
    }
  }

  async function addFile(file) {
    const files = ui.composer._hafizeAttachments || (ui.composer._hafizeAttachments = []);
    if (files.length >= MAX_ATTACHMENTS) {
      announce(`En fazla ${MAX_ATTACHMENTS} dosya ekleyebilirsin.`);
      return;
    }
    if (/\.xls$/i.test(file.name)) {
      announce(`${file.name} eski Excel biçiminde. Excel'de .xlsx olarak kaydedip yeniden ekle.`);
      return;
    }
    if (/\.xlsx$/i.test(file.name)) {
      await addSpreadsheet(file, files);
      return;
    }
    // Images, PDFs and videos are prepared by rich-content.ts (upload for the vision model, PDF text,
    // video key frames); the composer only inserts the block it returns.
    const media = /^(image|video|audio)\//.test(file.type) || file.type === 'application/pdf' || MEDIA_EXTENSIONS.test(file.name);
    if (media) {
      const handler = window.HafizeMediaAttachments;
      if (!handler || !handler.supports(file)) {
        announce(`${file.name} eklenemedi: bu dosya türü desteklenmiyor (görsel, PDF ve video eklenebilir).`);
        return;
      }
      if (files.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) {
        announce('Bu dosya zaten eklendi.');
        return;
      }
      announce(`${file.name} hazırlanıyor…`);
      try {
        const prepared = await handler.prepare(file);
        insertAttachment(file, prepared.block, prepared.message);
      } catch (error) {
        announce(`${file.name} eklenemedi: ${String(error?.message || 'dosya işlenemedi').slice(0, 120)}`);
      }
      return;
    }
    if (!acceptedFile(file)) {
      announce(`${file.name} eklenemedi: bu dosya türü desteklenmiyor veya 50 MB sınırını aşıyor.`);
      return;
    }
    if (files.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) {
      announce('Bu dosya zaten eklendi.');
      return;
    }
    try {
      const text = await file.text();
      if (!text.trim()) {
        announce(`${file.name} boş olduğu için eklenmedi.`);
        return;
      }
      // The file is uploaded and only a reference is inserted: the composer stays readable while the
      // model still receives the content, which the server expands from the reference.
      const stored = await hafizeApi.uploadDocument(text, file.name, file.type || 'text/plain');
      insertAttachment(file, composeAttachment(file, stored.url), `${file.name} eklendi; içeriği sohbete yazılmadı, Hafize dosyayı okuyacak.`);
    } catch (error) {
      announce(`${file.name} yüklenemedi: ${String(error?.message || 'dosya işlenemedi').slice(0, 120)}`);
    }
  }

  function sendAttachments() {
    const blocks = (ui.composer._hafizeAttachments || []).map((file) => file.block).join('');
    if (blocks) ui.messageInput.value = `${ui.messageInput.value}${blocks}`;
    ui.composer._hafizeAttachments = [];
    renderAttachmentStrip();
  }

  function openPicker() {
    if (ui.messageInput.disabled) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.hidden = true;
    input.multiple = true;
    input.accept = '.txt,.md,.markdown,.json,.csv,.tsv,.html,.css,.js,.mjs,.cjs,.jsx,.tsx,.py,.java,.c,.h,.cpp,.hpp,.xml,.yaml,.yml,.toml,.ini,.log,.xlsx,.xls,text/plain,application/json,image/png,image/jpeg,image/webp,image/gif,.pdf,application/pdf,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov';
    input.addEventListener('change', async () => {
      for (const file of [...input.files].slice(0, MAX_ATTACHMENTS)) await addFile(file);
      input.remove();
    }, { once: true });
    document.body.append(input);
    input.click();
  }

  async function copyText(text) {
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const helper = document.createElement('textarea');
      helper.value = text;
      helper.setAttribute('readonly', 'true');
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      document.body.append(helper);
      helper.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch { copied = false; }
      helper.remove();
      return copied;
    }
  }

  function findRetryPrompt(article) {
    let cursor = article.previousElementSibling;
    while (cursor) {
      if (cursor.classList.contains('user')) return cursor.querySelector('.content')?.textContent?.trim() || '';
      cursor = cursor.previousElementSibling;
    }
    return '';
  }

  function enhanceArticle(article) {
    if (!article || !article.classList.contains('assistant') || article.querySelector('.message-actions')) return;
    const content = article.querySelector('.content');
    if (!content) return;
    const actions = document.createElement('div');
    actions.className = 'message-actions';

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'message-action';
    copy.textContent = 'Kopyala';
    copy.setAttribute('aria-label', 'Hafize yanıtını kopyala');
    copy.title = 'Hafize yanıtını panoya kopyala';
    copy.addEventListener('click', async () => {
      // A rendered answer copies as the markdown the model wrote, not as the
      // flattened text of the rendered nodes.
      const source = window.HafizeChatMarkdown?.sourceFor?.(content) ?? content.textContent;
      if (await copyText(String(source || '').trim())) {
        copy.textContent = 'Kopyalandı';
        window.setTimeout(() => { copy.textContent = 'Kopyala'; }, 1400);
      } else announce('Yanıt panoya kopyalanamadı.');
    });

    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'message-action';
    retry.textContent = 'Yeniden dene';
    retry.setAttribute('aria-label', 'Bu kullanıcı isteğini yeniden gönder');
    retry.title = 'Bu mesajın kullanıcı isteğini tekrar gönder';
    retry.addEventListener('click', () => {
      if (ui.messageInput.disabled) return announce('Yanıt sürerken yeniden denenemez.');
      const prompt = findRetryPrompt(article);
      if (!prompt) return announce('Tekrar gönderilecek kullanıcı mesajı bulunamadı.');
      ui.messageInput.value = prompt;
      ui.messageInput.dispatchEvent(new Event('input', { bubbles: true }));
      ui.messageInput.focus();
      ui.composer.requestSubmit();
    });

    actions.append(copy);
    const speak = createSpeakButton(article, content);
    if (speak) actions.append(speak);
    actions.append(retry);
    article.append(actions);
  }

  // "Seslendir": reads one answer aloud on request, even when automatic voice replies are off.
  // voice-output.ts does the speaking; this button only asks and mirrors its state.
  const SPEAK_EVENT = 'hafize:voice-output-speak';
  const STOP_EVENT = 'hafize:voice-output-stop';
  let speakingButton = null;
  function setSpeakLabel(button, active) {
    button.textContent = active ? '■ Durdur' : '🔊 Seslendir';
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', active ? 'Seslendirmeyi durdur' : 'Hafize yanıtını sesli oku');
    button.title = active ? 'Seslendirmeyi durdur (Esc)' : 'Bu yanıtı sesli oku';
  }
  function createSpeakButton(article, content) {
    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') return null;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'message-action message-speak';
    setSpeakLabel(button, false);
    const origin = `message:${article.dataset.messageId || Math.random().toString(36).slice(2)}`;
    button.dataset.speakOrigin = origin;
    button.addEventListener('click', () => {
      if (speakingButton === button) {
        document.dispatchEvent(new CustomEvent(STOP_EVENT));
        return;
      }
      const text = window.HafizeChatMarkdown?.sourceFor?.(content) ?? content.textContent;
      if (!String(text || '').trim()) return announce('Seslendirilecek metin bulunamadı.');
      document.dispatchEvent(new CustomEvent(SPEAK_EVENT, { detail: { text: String(text), origin } }));
    });
    return button;
  }
  document.addEventListener('hafize:voice-output-state', (event) => {
    const detail = event.detail || {};
    if (speakingButton) setSpeakLabel(speakingButton, false);
    speakingButton = null;
    if (!detail.speaking || typeof detail.origin !== 'string') return;
    const button = ui.messages.querySelector(`[data-speak-origin="${CSS.escape(detail.origin)}"]`);
    if (button) { speakingButton = button; setSpeakLabel(button, true); }
  });

  function enhanceUserArticle(article) {
    if (!article || !article.classList.contains('user') || article.querySelector('.message-actions')) return;
    const content = article.querySelector('.content');
    const messageId = article.dataset.messageId;
    if (!content || !messageId) return;
    const actions = document.createElement('div');
    actions.className = 'message-actions';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'message-action';
    edit.textContent = 'Düzenle';
    edit.setAttribute('aria-label', 'Kullanıcı mesajını düzenle');
    edit.title = 'Bu mesajı düzenle ve yeniden gönder';
    edit.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('hafize:edit-message', {
        detail: { messageId }
      }));
    });

    actions.append(edit);
    article.append(actions);
  }

  ui.attachBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    openPicker();
  }, true);

  ui.composer.addEventListener('dragover', (event) => {
    event.preventDefault();
    ui.composer.classList.add('drag-active');
  });
  ui.composer.addEventListener('dragleave', (event) => {
    if (!ui.composer.contains(event.relatedTarget)) ui.composer.classList.remove('drag-active');
  });
  ui.composer.addEventListener('drop', async (event) => {
    event.preventDefault();
    // The drop must not reach the textarea, or the browser also pastes the file text.
    event.stopPropagation();
    event.stopImmediatePropagation();
    ui.composer.classList.remove('drag-active');
    for (const file of [...(event.dataTransfer?.files || [])].slice(0, MAX_ATTACHMENTS)) await addFile(file);
  });

  // A file dropped straight onto the textarea becomes an attachment, never pasted text.
  ui.messageInput.addEventListener('drop', (event) => {
    if (event.dataTransfer?.files?.length) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  });
  ui.messageInput.addEventListener('dragover', (event) => {
    if (event.dataTransfer?.files?.length) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
  ui.messageInput.addEventListener('paste', async (event) => {
    const pastedFiles = [...(event.clipboardData?.files || [])];
    if (pastedFiles.length) {
      event.preventDefault();
      for (const file of pastedFiles.slice(0, MAX_ATTACHMENTS)) await addFile(file);
      return;
    }
    // A long paste becomes a document instead of flooding the composer: the message box keeps only a
    // one-line reference, exactly like a dropped file, and the model still receives the content.
    const text = typeof event.clipboardData?.getData?.('text/plain') === 'string' ? event.clipboardData.getData('text/plain') : '';
    if (text.length < PASTE_TO_FILE_CHARS) return;
    event.preventDefault();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const file = new File([text], `yapistirilan-metin-${stamp}.txt`, { type: 'text/plain' });
    await addFile(file);
  });
  // Capture phase: this runs before the app shell reads the box.
  ui.composer.addEventListener('submit', sendAttachments, true);

  const observer = new MutationObserver(() => {
    for (const article of ui.messages.querySelectorAll('.message.assistant')) enhanceArticle(article);
    for (const article of ui.messages.querySelectorAll('.message.user')) enhanceUserArticle(article);
  });
  observer.observe(ui.messages, { childList: true });
  for (const article of ui.messages.querySelectorAll('.message.assistant')) enhanceArticle(article);
  for (const article of ui.messages.querySelectorAll('.message.user')) enhanceUserArticle(article);
})();
