const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { isMultiplayer } = require('./source-ranking');

function sourceEntryKey(sourceName, rawTitle) {
  return crypto
    .createHash('sha256')
    .update(`${sourceName || ''}\0${rawTitle || ''}`)
    .digest('hex');
}

function buildEntriesMap(items) {
  const map = new Map();
  for (const item of items || []) {
    if (!item || typeof item !== 'object') continue;
    const title = typeof item.raw_title === 'string' ? item.raw_title.trim() : typeof item.title === 'string' ? item.title.trim() : '';
    if (!title) continue;
    const source = typeof item.source_name === 'string' ? item.source_name.trim() : typeof item.source === 'string' ? item.source.trim() : '';
    const key = sourceEntryKey(source, title);
    const mp = Boolean(item.multiplayer || isMultiplayer({ source_name: source, raw_title: title }));
    const existing = map.get(key);
    if (existing) {
      if (mp && !existing.multiplayer) existing.multiplayer = true;
    } else {
      map.set(key, { key, title, source, multiplayer: mp });
    }
  }
  return map;
}

function computeEntriesDigest(entriesMap) {
  const hash = crypto.createHash('sha256');
  const keys = Array.from(entriesMap.keys()).sort();
  for (const key of keys) {
    const entry = entriesMap.get(key);
    hash.update(`${key}:${entry.multiplayer ? 1 : 0}\n`);
  }
  return hash.digest('hex');
}

class SourceState {
  constructor(options = {}) {
    this.revision = 0;
    this.configVersion = 0;
    this.dirty = true;
    this.digest = '';
    this.updatedAt = null;
    this.stateFilePath = options.stateFilePath || null;
    this.entries = new Map();
    this.snapshots = new Map();
    if (this.stateFilePath) {
      this.loadFromFile(this.stateFilePath);
    }
  }

  loadFromFile(filePath) {
    this.stateFilePath = filePath;
    if (!filePath || !fs.existsSync(filePath)) return false;
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!raw || typeof raw !== 'object') return false;
      const loadedMap = new Map();
      if (Array.isArray(raw.entries)) {
        for (const entry of raw.entries) {
          if (!entry || typeof entry.title !== 'string') continue;
          const source = typeof entry.source === 'string' ? entry.source : '';
          const title = entry.title;
          const key = typeof entry.key === 'string' && entry.key ? entry.key : sourceEntryKey(source, title);
          loadedMap.set(key, { key, title, source, multiplayer: Boolean(entry.multiplayer) });
        }
      }
      this.revision = Number.isFinite(Number(raw.revision)) ? Math.max(0, Math.floor(Number(raw.revision))) : 0;
      this.entries = loadedMap;
      this.digest = typeof raw.digest === 'string' && raw.digest ? raw.digest : computeEntriesDigest(loadedMap);
      this.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : null;
      if (this.revision > 0) {
        this.snapshots.set(String(this.revision), new Map(this.entries));
      }
      return true;
    } catch {
      return false;
    }
  }

  saveToFile(filePath = this.stateFilePath) {
    if (!filePath) return;
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const payload = {
        revision: this.revision,
        digest: this.digest,
        updatedAt: this.updatedAt,
        entries: Array.from(this.entries.values()),
      };
      const tmp = `${filePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(payload), 'utf8');
      fs.renameSync(tmp, filePath);
    } catch {
      // Ignore persistence errors to keep runtime non-blocking
    }
  }

  markDirty() {
    this.dirty = true;
    this.configVersion++;
  }

  accept(items, failed = false) {
    const nextEntries = buildEntriesMap(items);
    if (failed && nextEntries.size === 0 && this.entries.size > 0) {
      this.dirty = true;
      this.updatedAt = new Date().toISOString();
      return;
    }
    const nextDigest = computeEntriesDigest(nextEntries);
    if (nextDigest !== this.digest) {
      if (this.revision > 0) {
        this.snapshots.set(String(this.revision), new Map(this.entries));
      }
      this.entries = nextEntries;
      this.digest = nextDigest;
      this.revision++;
      this.snapshots.set(String(this.revision), new Map(this.entries));
      while (this.snapshots.size > 8) {
        const oldestKey = this.snapshots.keys().next().value;
        this.snapshots.delete(oldestKey);
      }
    } else if (this.revision === 0 && nextEntries.size > 0) {
      this.entries = nextEntries;
      this.digest = nextDigest;
      this.revision = 1;
      this.snapshots.set(String(this.revision), new Map(this.entries));
    }
    this.dirty = failed;
    this.updatedAt = new Date().toISOString();
    this.saveToFile();
  }

  getSourceIndex(since, profileRevision = null) {
    const currentRevision =
      profileRevision !== null && profileRevision !== undefined && profileRevision !== ''
        ? `${this.revision}-${profileRevision}`
        : String(this.revision);
    const sinceStr = typeof since === 'string' ? since.trim() : '';
    const sinceSourceRev = sinceStr ? sinceStr.split('-')[0] : '';

    if (sinceStr && this.revision > 0 && (sinceStr === currentRevision || sinceSourceRev === String(this.revision))) {
      return {
        revision: currentRevision,
        full: false,
        added: [],
        removed: [],
      };
    }

    if (sinceSourceRev && sinceSourceRev !== '0' && this.snapshots.has(sinceSourceRev)) {
      const baseMap = this.snapshots.get(sinceSourceRev);
      const added = [];
      const removed = [];
      for (const [key, entry] of this.entries) {
        const prev = baseMap.get(key);
        if (!prev || prev.multiplayer !== entry.multiplayer || prev.title !== entry.title || prev.source !== entry.source) {
          added.push(entry);
        }
      }
      for (const key of baseMap.keys()) {
        if (!this.entries.has(key)) {
          removed.push(key);
        }
      }
      return {
        revision: currentRevision,
        full: false,
        added,
        removed,
      };
    }

    return {
      revision: currentRevision,
      full: true,
      added: Array.from(this.entries.values()),
      removed: [],
    };
  }
}

module.exports = { SourceState, sourceEntryKey, buildEntriesMap };
