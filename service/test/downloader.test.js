import test from 'node:test';
import assert from 'node:assert/strict';

import { buildYtDlpArgs, sanitizeFilename } from '../src/downloader.js';

test('sanitizes filenames for output templates', () => {
  assert.equal(sanitizeFilename(' A/B:C*D? '), 'A-B-C-D');
  assert.equal(sanitizeFilename(''), 'video');
});

test('builds yt-dlp args with URL, headers, remuxing, and output directory', () => {
  const args = buildYtDlpArgs({
    url: 'https://cdn.example.com/master.m3u8',
    title: 'Demo Video',
    outputDir: '/tmp/downloads',
    headers: {
      Cookie: 'sid=abc',
      Referer: 'https://example.com/watch/123',
      'User-Agent': 'TestAgent/1.0'
    },
    format: 'best',
    remux: 'mp4'
  });

  assert.deepEqual(args, [
    '--newline',
    '--no-playlist',
    '--progress-template',
    'download:%(progress._percent_str)s %(progress._speed_str)s ETA %(progress._eta_str)s',
    '--paths',
    '/tmp/downloads',
    '--output',
    'Demo Video.%(ext)s',
    '--format',
    'best',
    '--remux-video',
    'mp4',
    '--add-header',
    'Cookie: sid=abc',
    '--referer',
    'https://example.com/watch/123',
    '--user-agent',
    'TestAgent/1.0',
    'https://cdn.example.com/master.m3u8'
  ]);
});
