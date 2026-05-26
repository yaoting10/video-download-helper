import test from 'node:test';
import assert from 'node:assert/strict';

import { parseYtDlpProgress } from '../src/progress.js';

test('parses yt-dlp download progress lines', () => {
  assert.deepEqual(
    parseYtDlpProgress('download: 42.5% 1.20MiB/s ETA 00:10'),
    {
      percent: 42.5,
      statusText: '42.5% 1.20MiB/s ETA 00:10'
    }
  );
});

test('parses bare yt-dlp progress lines from current stdout logs', () => {
  assert.deepEqual(
    parseYtDlpProgress('29.6%    3.36MiB/s ETA 04:46'),
    {
      percent: 29.6,
      statusText: '29.6% 3.36MiB/s ETA 04:46'
    }
  );
});

test('ignores non-progress lines', () => {
  assert.equal(parseYtDlpProgress('[Merger] Merging formats into file.mp4'), null);
});
