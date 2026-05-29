import test from 'node:test';
import assert from 'node:assert/strict';

import { candidateKeyFor, normalizeMediaUrl, shouldShowCandidate } from '../src/candidate-model.js';

test('builds stable candidate keys without request ids', () => {
  const first = candidateKeyFor({
    pageUrl: 'https://example.com/watch?id=1#section',
    url: 'https://cdn.example.com/master.m3u8?token=one#frag'
  });
  const second = candidateKeyFor({
    pageUrl: 'https://example.com/watch?id=2',
    url: 'https://cdn.example.com/master.m3u8?token=one'
  });

  assert.equal(first, second);
});

test('deduplicates signed variants of the same media URL', () => {
  const first = candidateKeyFor({
    pageUrl: 'https://example.com/watch',
    url: 'https://cdn.example.com/master.m3u8?sign=abc&t=1&quality=hd'
  });
  const second = candidateKeyFor({
    pageUrl: 'https://example.com/watch',
    url: 'https://cdn.example.com/master.m3u8?sign=def&t=2&quality=hd'
  });

  assert.equal(first, second);
});

test('removes volatile signature parameters from media URLs', () => {
  assert.equal(
    normalizeMediaUrl('https://cdn.example.com/master.m3u8?token=one#frag'),
    'https://cdn.example.com/master.m3u8'
  );
});

test('filters obvious media segments and low-value playlists', () => {
  assert.equal(shouldShowCandidate({ url: 'https://cdn.example.com/segment-001.ts' }), false);
  assert.equal(shouldShowCandidate({ url: 'https://cdn.example.com/audio_0.m3u8' }), false);
  assert.equal(shouldShowCandidate({ url: 'https://cdn.example.com/master.m3u8' }), true);
  assert.equal(shouldShowCandidate({ url: 'https://cdn.example.com/video.mp4' }), true);
});
