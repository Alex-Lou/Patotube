// Unit tests for path-utils. Pure functions, no React / no DOM.

import { describe, expect, it } from 'vitest';
import { swapExtension, withSuffixedExtension } from './path-utils';

describe('swapExtension', () => {
  it('replaces a single extension', () => {
    expect(swapExtension('foo.m4a', '.mp3')).toBe('foo.mp3');
  });

  it('replaces extension on a full path', () => {
    expect(
      swapExtension('/sdcard/Download/Title.m4a', '.mp3'),
    ).toBe('/sdcard/Download/Title.mp3');
  });

  it('preserves dots in the directory portion', () => {
    expect(
      swapExtension('/var/foo.bar/baz.m4a', '.mp3'),
    ).toBe('/var/foo.bar/baz.mp3');
  });

  it('appends extension when filename has none', () => {
    expect(swapExtension('/sdcard/Download/Title', '.mp3')).toBe(
      '/sdcard/Download/Title.mp3',
    );
  });

  it('handles Windows-style backslash paths', () => {
    expect(
      swapExtension('C:\\Users\\foo\\Title.m4a', '.mp3'),
    ).toBe('C:\\Users\\foo\\Title.mp3');
  });

  it('handles a hidden-file (leading dot) name with no extension', () => {
    // Ambiguous case: ".hidden" looks like an extension. We treat
    // anything where the last dot is at position 0 OR after the last
    // separator as "no extension" → append rather than replace.
    expect(swapExtension('/foo/bar/.hidden', '.mp3')).toBe(
      '/foo/bar/.hidden.mp3',
    );
  });

  it('handles double extensions by replacing only the last', () => {
    expect(swapExtension('archive.tar.gz', '.zst')).toBe('archive.tar.zst');
  });
});

describe('withSuffixedExtension', () => {
  it('inserts infix before the new extension', () => {
    expect(
      withSuffixedExtension('/sdcard/Download/Title.m4a', '.audio', '.m4a'),
    ).toBe('/sdcard/Download/Title.audio.m4a');
  });

  it('works when the infix and new extension differ from the source', () => {
    expect(
      withSuffixedExtension('/sdcard/Download/Title.webm', '.audio', '.ogg'),
    ).toBe('/sdcard/Download/Title.audio.ogg');
  });

  it('works on a filename with no extension', () => {
    expect(withSuffixedExtension('/foo/bar/Title', '.audio', '.m4a'))
      .toBe('/foo/bar/Title.audio.m4a');
  });
});
