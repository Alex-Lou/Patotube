// Unit tests for the URL helpers used by the input field.

import { describe, expect, it } from 'vitest';
import { extractFirstUrl, validateUrl } from './url';

describe('extractFirstUrl', () => {
  it('returns the input unchanged when it is already a clean URL', () => {
    expect(extractFirstUrl('https://soundcloud.com/foo/bar')).toBe(
      'https://soundcloud.com/foo/bar',
    );
  });

  it('extracts a URL from share-sheet prose (mobile SC pattern)', () => {
    const text = 'Écoutez Track Title sur SoundCloud: https://on.soundcloud.com/abc123';
    expect(extractFirstUrl(text)).toBe('https://on.soundcloud.com/abc123');
  });

  it('strips trailing punctuation', () => {
    expect(extractFirstUrl('Watch this https://youtube.com/x.')).toBe(
      'https://youtube.com/x',
    );
    expect(extractFirstUrl('(see https://example.com/path)')).toBe(
      'https://example.com/path',
    );
  });

  it('handles an http (non-https) URL', () => {
    expect(extractFirstUrl('Check http://example.com/x')).toBe(
      'http://example.com/x',
    );
  });

  it('returns the trimmed text when there is no URL', () => {
    expect(extractFirstUrl('  hello world  ')).toBe('hello world');
    expect(extractFirstUrl('')).toBe('');
  });

  it('takes the first URL when multiple are present', () => {
    expect(
      extractFirstUrl('Compare https://a.com/x with https://b.com/y'),
    ).toBe('https://a.com/x');
  });

  it('keeps query strings and fragments', () => {
    expect(
      extractFirstUrl('Try https://www.youtube.com/watch?v=ABC&t=10#play'),
    ).toBe('https://www.youtube.com/watch?v=ABC&t=10#play');
  });
});

describe('validateUrl', () => {
  it('accepts a clean URL', () => {
    const v = validateUrl('https://soundcloud.com/foo/bar');
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.hostname).toBe('soundcloud.com');
    }
  });

  it('extracts the URL from share-sheet text and accepts it', () => {
    const v = validateUrl('Écoutez X sur SoundCloud: https://on.soundcloud.com/abc');
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.url).toBe('https://on.soundcloud.com/abc');
    }
  });

  it('rejects empty input', () => {
    const v = validateUrl('   ');
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe('empty');
  });

  it('rejects text with no URL inside', () => {
    const v = validateUrl('just some text without a link');
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe('invalid');
  });

  it('rejects non-http(s) protocols', () => {
    const v = validateUrl('ftp://example.com/file');
    expect(v.ok).toBe(false);
  });
});
