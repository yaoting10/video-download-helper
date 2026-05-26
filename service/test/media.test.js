import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyMediaUrl, normalizeCandidate } from '../src/media.js';

test('classifies common stream and file URLs', () => {
  assert.equal(classifyMediaUrl('https://example.com/master.m3u8?token=1'), 'hls');
  assert.equal(classifyMediaUrl('https://cdn.example.com/manifest.mpd'), 'dash');
  assert.equal(classifyMediaUrl('https://cdn.example.com/video.mp4'), 'file');
  assert.equal(classifyMediaUrl('https://cdn.example.com/file.txt'), null);
});

test('normalizes candidates with tab and header context', () => {
  const candidate = normalizeCandidate({
    url: 'https://cdn.example.com/master.m3u8',
    pageUrl: 'https://example.com/watch/123',
    tabTitle: 'Demo Video',
    headers: {
      Cookie: 'sid=abc',
      Referer: 'https://example.com/watch/123',
      'User-Agent': 'TestAgent/1.0'
    }
  });

  assert.equal(candidate.type, 'hls');
  assert.equal(candidate.title, 'Demo Video');
  assert.equal(candidate.pageUrl, 'https://example.com/watch/123');
  assert.deepEqual(candidate.headers, {
    Cookie: 'sid=abc',
    Referer: 'https://example.com/watch/123',
    'User-Agent': 'TestAgent/1.0'
  });
});
