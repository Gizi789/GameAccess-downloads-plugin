const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SourceState, sourceEntryKey } = require('./source-state');

describe('SourceState and /api/source-index delta contract', () => {
  test('computes deterministic sha256(source_name + "\\0" + raw_title) keys and full/delta responses', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-source-state-'));
    const stateFile = path.join(tmpDir, 'source-index-state.json');

    try {
      const state = new SourceState({ stateFilePath: stateFile });
      state.accept([
        { raw_title: 'Portal 2 [Repack]', source_name: 'FitGirl' },
        { raw_title: 'Hades [Online-Fix]', source_name: 'OnlineFix' },
      ]);

      expect(state.revision).toBe(1);
      const fullRes = state.getSourceIndex('', '0');
      expect(fullRes.revision).toBe('1-0');
      expect(fullRes.full).toBe(true);
      expect(fullRes.removed).toEqual([]);
      expect(fullRes.added).toEqual([
        {
          key: sourceEntryKey('FitGirl', 'Portal 2 [Repack]'),
          title: 'Portal 2 [Repack]',
          source: 'FitGirl',
          multiplayer: false,
        },
        {
          key: sourceEntryKey('OnlineFix', 'Hades [Online-Fix]'),
          title: 'Hades [Online-Fix]',
          source: 'OnlineFix',
          multiplayer: true,
        },
      ]);

      // Same revision returns empty delta
      const sameRes = state.getSourceIndex('1-0', '0');
      expect(sameRes).toEqual({
        revision: '1-0',
        full: false,
        added: [],
        removed: [],
      });

      // Simulate restart from persisted file and apply a change (add Elden Ring, remove Portal 2)
      const reloaded = new SourceState({ stateFilePath: stateFile });
      expect(reloaded.revision).toBe(1);

      reloaded.accept([
        { raw_title: 'Hades [Online-Fix]', source_name: 'OnlineFix' },
        { raw_title: 'Elden Ring Deluxe Edition', source_name: 'DODI' },
      ]);
      expect(reloaded.revision).toBe(2);

      const deltaRes = reloaded.getSourceIndex('1-0', '0');
      expect(deltaRes.revision).toBe('2-0');
      expect(deltaRes.full).toBe(false);
      expect(deltaRes.added).toEqual([
        {
          key: sourceEntryKey('DODI', 'Elden Ring Deluxe Edition'),
          title: 'Elden Ring Deluxe Edition',
          source: 'DODI',
          multiplayer: false,
        },
      ]);
      expect(deltaRes.removed).toEqual([sourceEntryKey('FitGirl', 'Portal 2 [Repack]')]);

      // Unknown since falls back to full: true
      const unknownSince = reloaded.getSourceIndex('99-0', '0');
      expect(unknownSince.full).toBe(true);
      expect(unknownSince.added).toHaveLength(2);
      expect(unknownSince.removed).toEqual([]);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
