/**
 * TypeScript-first frontend migration wave.
 * The browser/global contract is intentionally preserved during the migration.
 */
// @ts-nocheck
import { hafizeApi } from './hafize-api.ts';
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
        const at = ui.messageInput.value.lastIndexOf(file.block);
        if (at >= 0) {
          ui.messageInput.value = `${ui.messageInput.value.slice(0, at)}${ui.messageInput.value.slice(at + file.block.length)}`;
          ui.messageInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
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

  function insertAttachment(file, fullBlock, message) {
    const files = ui.composer._hafizeAttachments || (ui.composer._hafizeAttachments = []);
    const before = ui.messageInput.value;
    // No maxlength on the textarea, so there is no hard cap to enforce here.
    const nextValue = `${before}${fullBlock}`;
    const appendedBlock = nextValue.slice(before.length);
    if (!appendedBlock) {
      announce('Mesaj alanı dolu. Dosya eklenebilmesi için biraz metin silmelisin.');
      return;
    }
    files.push({ name: file.name, size: file.size, lastModified: file.lastModified, block: appendedBlock });
    ui.messageInput.value = nextValue;
    ui.messageInput.dispatchEvent(new Event('input', { bubbles: true }));
    renderAttachmentStrip();
    ui.messageInput.focus();
    announce(message);
  }

  async function addFile(file) {
    const files = ui.composer._hafizeAttachments || (ui.composer._hafizeAttachments = []);
    if (files.length >= MAX_ATTACHMENTS) {
      announce(`En fazla ${MAX_ATTACHMENTS} dosya ekleyebilirsin.`);
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

  function clearAttachments() {
    ui.composer._hafizeAttachments = [];
    renderAttachmentStrip();
  }

  function openPicker() {
    if (ui.messageInput.disabled) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.hidden = true;
    input.multiple = true;
    input.accept = '.txt,.md,.markdown,.json,.csv,.tsv,.html,.css,.js,.mjs,.cjs,.jsx,.tsx,.py,.java,.c,.h,.cpp,.hpp,.xml,.yaml,.yml,.toml,.ini,.log,text/plain,application/json,image/png,image/jpeg,image/webp,image/gif,.pdf,application/pdf,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov';
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

    actions.append(copy, retry);
    article.append(actions);
  }

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
  ui.composer.addEventListener('submit', clearAttachments, true);

  const observer = new MutationObserver(() => {
    for (const article of ui.messages.querySelectorAll('.message.assistant')) enhanceArticle(article);
    for (const article of ui.messages.querySelectorAll('.message.user')) enhanceUserArticle(article);
  });
  observer.observe(ui.messages, { childList: true });
  for (const article of ui.messages.querySelectorAll('.message.assistant')) enhanceArticle(article);
  for (const article of ui.messages.querySelectorAll('.message.user')) enhanceUserArticle(article);
})();
