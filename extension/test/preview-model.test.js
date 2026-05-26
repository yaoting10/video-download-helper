import test from 'node:test';
import assert from 'node:assert/strict';

import { canPreviewInBrowser, formatDuration, inferFormat, previewHint, summarizeCandidate } from '../src/preview-model.js';

test('summarizes a long media URL into source and media detail', () => {
  const summary = summarizeCandidate({
    url: 'https://encrypt-k-vod.xet.tech/path/to/playlist_eof.m3u8?sign=abc',
    pageUrl: 'https://example.com/course/watch',
    type: 'hls'
  });

  assert.deepEqual(summary, {
    host: 'example.com',
    format: 'M3U8',
    filename: 'playlist_eof.m3u8',
    title: 'playlist_eof.mp4'
  });
});

test('builds a Video DownloadHelper-style display title', () => {
  const summary = summarizeCandidate({
    url: 'https://cdn.example.com/playlist.m3u8',
    tabTitle: '孟健视觉赋能转化网站大气页面设计思路与实操',
    type: 'hls'
  });

  assert.equal(summary.title, '孟健视觉赋能转化网站大气页面设计思路与实操.mp4');
});

test('infers compact format labels', () => {
  assert.equal(inferFormat({ type: 'hls', url: 'https://cdn.example.com/a.m3u8' }), 'M3U8');
  assert.equal(inferFormat({ type: 'dash', url: 'https://cdn.example.com/a.mpd' }), 'MPD');
  assert.equal(inferFormat({ url: 'https://cdn.example.com/a.webm' }), 'WEBM');
});

test('formats durations like media thumbnails', () => {
  assert.equal(formatDuration(6613), '01:50:13');
  assert.equal(formatDuration(0), '');
});

test('detects browser-previewable direct media URLs', () => {
  assert.equal(canPreviewInBrowser({ url: 'https://cdn.example.com/video.mp4?token=1' }), true);
  assert.equal(canPreviewInBrowser({ url: 'https://cdn.example.com/playlist.m3u8' }), false);
});

test('returns helpful preview hints for stream manifests', () => {
  assert.equal(previewHint({ url: 'https://cdn.example.com/playlist.m3u8' }), 'HLS preview may require opening the source');
  assert.equal(previewHint({ url: 'https://cdn.example.com/video.mp4' }), 'Browser preview');
});
