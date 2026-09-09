(() => {
  'use strict';

  const MAX_FILE_BYTES = 384 * 1024;
  const MAX_ATTACHMENTS = 3;
  const MAX_ATTACHMENT_TEXT = 9000;
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

  function composeAttachment(file, text) {
    const clipped = text.replace(/\r\n/g, '\n').slice(0, MAX_ATTACHMENT_TEXT);
    const notice = text.length > MAX_ATTACHMENT_TEXT
      ? `\n[Dosya içeriği ${MAX_ATTACHMENT_TEXT} karakterle sınırlandı.]\n`
      : '';
    return `\n\n[Ekli dosya: ${file.name}]\n---\n${clipped}${notice}---\n`;
  }

  async function addFile(file) {
    const files = ui.composer._hafizeAttachments || (ui.composer._hafizeAttachments = []);
    if (files.length >= MAX_ATTACHMENTS) {
      announce(`En fazla ${MAX_ATTACHMENTS} dosya ekleyebilirsin.`);
      return;
    }
    if (!acceptedFile(file)) {
      announce('Bu dosya türü desteklenmiyor veya dosya 384 KB sınırını aşıyor.');
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
      const fullBlock = composeAttachment(file, text);
      const before = ui.messageInput.value;
      const nextValue = `${before}${fullBlock}`.slice(0, ui.messageInput.maxLength || 12000);
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
      announce(`${file.name} mesaja eklendi. Dosya sunucuya ayrı bir yükleme olarak gönderilmedi.`);
    } catch {
      announce(`${file.name} okunamadı.`);
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
    input.accept = '.txt,.md,.markdown,.json,.csv,.tsv,.html,.css,.js,.mjs,.cjs,.jsx,.tsx,.py,.java,.c,.h,.cpp,.hpp,.xml,.yaml,.yml,.toml,.ini,.log,text/plain,application/json';
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
      // A formatted answer is a node tree, so its textContent loses the block
      // breaks; app.js keeps the original text on the node for copying.
      if (await copyText((content.dataset?.raw ?? content.textContent ?? '').trim())) {
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
    ui.composer.classList.remove('drag-active');
    for (const file of [...(event.dataTransfer?.files || [])].slice(0, MAX_ATTACHMENTS)) await addFile(file);
  });
  ui.messageInput.addEventListener('paste', async (event) => {
    const pastedFiles = [...(event.clipboardData?.files || [])];
    if (!pastedFiles.length) return;
    event.preventDefault();
    for (const file of pastedFiles.slice(0, MAX_ATTACHMENTS)) await addFile(file);
  });
  ui.composer.addEventListener('submit', clearAttachments, true);

  const observer = new MutationObserver(() => {
    for (const article of ui.messages.querySelectorAll('.message.assistant')) enhanceArticle(article);
  });
  observer.observe(ui.messages, { childList: true });
  for (const article of ui.messages.querySelectorAll('.message.assistant')) enhanceArticle(article);
})();
