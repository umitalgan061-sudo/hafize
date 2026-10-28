// Attachment references inside a *user* message. The composer stores them as markdown
// (`![name](/api/images/…)`, `[Ekli dosya: name](/api/documents/…)`) because the server expands them
// from that text. User messages are painted as plain text, so without this decorator the chat shows
// the raw `[Ekli dosya: …](…)` syntax — the exact thing the "dosya içeriği sohbete yazılmaz" work
// was meant to avoid.
type Any = any;

const ATTACHMENT_REF = /!\[([^\]]*)\]\((\/api\/images\/[^)\s]+)\)|\[Ekli dosya: ([^\]]+)\]\((\/api\/documents\/[^)\s]+)\)/g;

export interface AttachmentReference {
  readonly kind: 'image' | 'document';
  readonly name: string;
  readonly url: string;
}

/** Every attachment reference in a message, in order. Pure so it can be unit-tested without a DOM. */
export function findAttachmentReferences(source: string): readonly AttachmentReference[] {
  if (typeof source !== 'string' || !source) return Object.freeze([]);
  const found: AttachmentReference[] = [];
  ATTACHMENT_REF.lastIndex = 0;
  let match = ATTACHMENT_REF.exec(source);
  while (match) {
    const imageAlt = match[1] ?? '';
    const imageUrl = match[2] ?? '';
    const docName = match[3] ?? '';
    const docUrl = match[4] ?? '';
    if (imageUrl) found.push({ kind: 'image', name: imageAlt || 'görsel', url: imageUrl });
    else if (docUrl) found.push({ kind: 'document', name: docName, url: docUrl });
    match = ATTACHMENT_REF.exec(source);
  }
  return Object.freeze(found);
}

function badge(documentRef: Any, label: string, kind: 'image' | 'document'): Any {
  const chip = documentRef.createElement('span');
  chip.className = `user-attachment-chip user-attachment-${kind}`;
  chip.dataset.attachmentKind = kind;
  const icon = documentRef.createElement('span');
  icon.className = 'user-attachment-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = kind === 'image' ? '🖼' : '📎';
  const name = documentRef.createElement('span');
  name.className = 'user-attachment-name';
  name.textContent = label || (kind === 'image' ? 'görsel' : 'dosya');
  chip.append(icon, name);
  return chip;
}

/** Replaces markdown attachment references in a painted user message with readable chips. */
export function decorateUserAttachments(container: Any, source: string): boolean {
  const documentRef = container?.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
  if (!container || !documentRef || typeof source !== 'string') return false;
  if (!ATTACHMENT_REF.test(source)) return false;
  ATTACHMENT_REF.lastIndex = 0;

  const walker = documentRef.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const targets: Any[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Any;
    if (node.nodeValue && ATTACHMENT_REF.test(node.nodeValue)) targets.push(node);
  }
  if (!targets.length) return false;

  for (const node of targets) {
    const text = String(node.nodeValue);
    const fragment = documentRef.createDocumentFragment();
    let cursor = 0;
    ATTACHMENT_REF.lastIndex = 0;
    let match = ATTACHMENT_REF.exec(text);
    while (match) {
      if (match.index > cursor) fragment.append(documentRef.createTextNode(text.slice(cursor, match.index)));
      const imageAlt = match[1] ?? '';
      const imageUrl = match[2] ?? '';
      const docName = match[3] ?? '';
      const docUrl = match[4] ?? '';
      if (imageUrl) {
        const figure = documentRef.createElement('span');
        figure.className = 'user-attachment-image';
        const img = documentRef.createElement('img');
        img.src = imageUrl;
        img.alt = imageAlt || 'Ekli görsel';
        img.loading = 'lazy';
        img.decoding = 'async';
        // A missing or expired upload must not leave a broken-image icon in the transcript.
        img.addEventListener('error', () => figure.replaceChildren(badge(documentRef, imageAlt || 'görsel', 'image')), { once: true });
        figure.append(img);
        fragment.append(figure);
      } else if (docUrl) {
        fragment.append(badge(documentRef, docName, 'document'));
      }
      cursor = match.index + match[0].length;
      match = ATTACHMENT_REF.exec(text);
    }
    if (cursor < text.length) fragment.append(documentRef.createTextNode(text.slice(cursor)));
    node.parentNode?.replaceChild(fragment, node);
  }
  return true;
}
