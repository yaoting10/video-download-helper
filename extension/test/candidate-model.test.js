import test from 'node:test';
import assert from 'node:assert/strict';

import { candidateKeyFor, normalizeMediaUrl } from '../src/candidate-model.js';

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

test('preserves media query parameters because signed stream URLs need them', () => {
  assert.equal(
    normalizeMediaUrl('https://cdn.example.com/master.m3u8?token=one#frag'),
    'https://cdn.example.com/master.m3u8?token=one'
  );
});
