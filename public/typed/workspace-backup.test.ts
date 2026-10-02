/* @vitest-environment node */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

type Entry = { key: string; value: string };

class MemoryStorage {
  private entries: Entry[] = [];

  get length(): number {
    return this.entries.length;
  }

  key(index: number): string | null {
    return this.entries[index]?.key ?? null;
  }

  getItem(key: string): string | null {
    return this.entries.find((entry) => entry.key === key)?.value ?? null;
  }

  setItem(key: string, value: string): void {
    const index = this.entries.findIndex((entry) => entry.key === key);
    if (index >= 0) this.entries[index] = { key, value };
    else this.entries.push({ key, value });
  }

  removeItem(key: string): void {
    this.entries = this.entries.filter((entry) => entry.key !== key);
  }
}

class FailOnceStorage extends MemoryStorage {
  private armed = false;
  private failed = false;

  /** Seeding the fixture must succeed; only the restore under test may fail. */
  arm(): void {
    this.armed = true;
  }

  override setItem(key: string, value: string): void {
    if (this.armed && !this.failed && key === 'hafize.message-workspace.v1') {
      this.failed = true;
      throw new Error('quota');
    }
    super.setItem(key, value);
  }
}

const fakeDocument = {
  readyState: 'complete',
  querySelector: () => null,
  getElementById: () => null,
  addEventListener: () => undefined
};

let api: typeof import('./workspace-backup.ts');

beforeAll(async () => {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: fakeDocument
  });
  api = await import('./workspace-backup.ts');
});

afterEach(() => {
  // Tests use isolated storage instances, so no local state leaks between cases.
});

describe('workspace backup core', () => {
  it('collects only allowlisted local surfaces', () => {
    const storage = new MemoryStorage();
    storage.setItem('hafize.prompt-library.v1', JSON.stringify([{ id: 'p1', body: 'Merhaba' }]));
    storage.setItem('hafize.conversations.v1', JSON.stringify([]));
    storage.setItem('HAFIZE_CONNECTOR_AUTH_TOKEN', 'must-never-export');
    storage.setItem('random.application.state', JSON.stringify({ hidden: true }));

    const snapshot = api.collectSections(storage as unknown as Storage);
    const keys = snapshot.sections.map((section) => section.key);

    expect(keys).toContain('hafize.prompt-library.v1');
    expect(keys).toContain('hafize.conversations.v1');
    expect(keys).not.toContain('HAFIZE_CONNECTOR_AUTH_TOKEN');
    expect(keys).not.toContain('random.application.state');
  });

  it('accepts safe smart-fill keys but rejects sensitive-looking keys', () => {
    expect(api.allowedStorageKey('hafize.prompt-library.v1')).toBe(true);
    expect(api.allowedStorageKey('hafize.prompt-library.smart-fill.v1.p1')).toBe(true);
    expect(api.allowedStorageKey('hafize.prompt-library.smart-fill.v1.token')).toBe(false);
    expect(api.allowedStorageKey('hafize.oauth.cache')).toBe(false);
    expect(api.allowedStorageKey('hafize.session.v1')).toBe(false);
  });

  it('creates a selective backup with a verifiable digest', async () => {
    const storage = new MemoryStorage();
    storage.setItem('hafize.prompt-library.v1', JSON.stringify([{ id: 'p1', body: 'İstem' }]));
    storage.setItem('hafize.conversations.v1', JSON.stringify([{ id: 'c1', messages: [] }]));

    const payload = await api.createBackup(storage as unknown as Storage, ['hafize.prompt-library.v1']);
    expect(payload.sections).toHaveLength(1);
    expect(payload.sections[0].key).toBe('hafize.prompt-library.v1');
    expect(payload.integrity?.algorithm).toBe('SHA-256');

    const inspected = await api.inspectBackup(JSON.stringify(payload));
    expect(inspected.valid).toBe(true);
    expect(inspected.integrity).toBe('verified');
    expect(inspected.sections).toHaveLength(1);
  });

  it('detects tampering after export', async () => {
    const storage = new MemoryStorage();
    storage.setItem('hafize.prompt-library.v1', JSON.stringify([{ id: 'p1', body: 'İstem' }]));

    const payload = await api.createBackup(storage as unknown as Storage);
    const tampered = JSON.parse(JSON.stringify(payload));
    tampered.sections[0].data[0].body = 'değiştirildi';

    const inspected = await api.inspectBackup(JSON.stringify(tampered));
    expect(inspected.valid).toBe(false);
    expect(inspected.integrity).toBe('failed');
  });

  it('rejects backups with unknown surfaces', async () => {
    const unknown = {
      format: 'hafize-workspace-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      source: 'local-device',
      sections: [{
        id: 'secrets',
        key: 'hafize.secret-store.v1',
        kind: 'unknown',
        label: 'Secrets',
        description: 'No',
        data: { secret: 'x' },
        bytes: 12
      }],
      integrity: null
    };

    const inspected = await api.inspectBackup(JSON.stringify(unknown));
    expect(inspected.valid).toBe(false);
    expect(inspected.sections).toHaveLength(0);
  });

  it('round-trips selected sections without touching unselected data', async () => {
    const storage = new MemoryStorage();
    storage.setItem('hafize.prompt-library.v1', JSON.stringify([{ id: 'old', body: 'eski' }]));
    storage.setItem('hafize.conversations.v1', JSON.stringify([{ id: 'keep' }]));

    const backupSource = new MemoryStorage();
    backupSource.setItem('hafize.prompt-library.v1', JSON.stringify([{ id: 'new', body: 'yeni' }]));
    const payload = await api.createBackup(backupSource as unknown as Storage, ['hafize.prompt-library.v1']);

    const result = api.restoreSelected(storage as unknown as Storage, payload.sections, ['hafize.prompt-library.v1']);
    expect(result.rolledBack).toBe(false);
    expect(JSON.parse(storage.getItem('hafize.prompt-library.v1') || '[]')[0].id).toBe('new');
    expect(JSON.parse(storage.getItem('hafize.conversations.v1') || '[]')[0].id).toBe('keep');
  });

  it('rolls back a failed multi-surface restore', async () => {
    const storage = new FailOnceStorage();
    storage.setItem('hafize.prompt-library.v1', JSON.stringify([{ id: 'old' }]));
    storage.setItem('hafize.message-workspace.v1', JSON.stringify([{ id: 'old-message' }]));
    storage.arm();

    const sections = [
      {
        id: 'hafize.prompt-library.v1',
        key: 'hafize.prompt-library.v1',
        kind: 'prompt-library',
        label: 'İstem kütüphanesi',
        description: '',
        data: [{ id: 'new', body: 'yeni' }],
        bytes: 30
      },
      {
        id: 'hafize.message-workspace.v1',
        key: 'hafize.message-workspace.v1',
        kind: 'message-workspace',
        label: 'Mesaj çalışma alanı',
        description: '',
        data: [{ id: 'new-message' }],
        bytes: 20
      }
    ] as const;

    const result = api.restoreSelected(
      storage as unknown as Storage,
      sections,
      sections.map((section) => section.id)
    );

    expect(result.rolledBack).toBe(true);
    expect(JSON.parse(storage.getItem('hafize.prompt-library.v1') || '[]')[0].id).toBe('old');
    expect(JSON.parse(storage.getItem('hafize.message-workspace.v1') || '[]')[0].id).toBe('old-message');
  });

  it('formats byte sizes deterministically for the UI', () => {
    expect(api.formatBytes(12)).toBe('12 B');
    expect(api.formatBytes(1024)).toBe('1.0 KB');
    expect(api.formatBytes(1024 * 1024)).toBe('1.00 MB');
  });

  it('stores metadata without embedding the backup payload itself', async () => {
    const storage = new MemoryStorage();
    storage.setItem('hafize.prompt-library.v1', JSON.stringify([{ id: 'p1', body: 'İstem' }]));
    const payload = await api.createBackup(storage as unknown as Storage);

    api.saveBackupMetadata(storage as unknown as Storage, payload);
    const metadata = api.backupMetadata(storage as unknown as Storage);

    expect(metadata?.sections).toBe(1);
    expect(metadata?.bytes).toBeGreaterThan(0);
    expect(storage.getItem('hafize.workspace-backup.meta.v1')).not.toContain('"body":"İstem"');
  });
});
