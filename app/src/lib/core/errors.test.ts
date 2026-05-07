// Unit tests for friendlyError — the YouTube/Rust raw error → i18n
// key mapping that drives both the queue-item inline message and the
// failure toast description.

import { describe, expect, it } from 'vitest';
import { friendlyError } from './errors';

// Tiny mock translator: returns the key prefixed so we can assert on
// which key the mapper picked, without needing a real i18next setup.
const t = (key: string) => `<${key}>`;

describe('friendlyError', () => {
  it('returns undefined for null / empty input', () => {
    expect(friendlyError(null, t)).toBeUndefined();
    expect(friendlyError(undefined, t)).toBeUndefined();
    expect(friendlyError('', t)).toBeUndefined();
  });

  it('passes through unrecognised messages unchanged', () => {
    expect(friendlyError('CDN connection error: timeout', t)).toBe(
      'CDN connection error: timeout',
    );
    expect(friendlyError('disk write error: ENOSPC', t)).toBe(
      'disk write error: ENOSPC',
    );
  });

  describe('age-restricted', () => {
    it.each([
      'Sign in to confirm your age',
      'AGE_RESTRICTED',
      'Age-gated content',
      'This video is age verified',
      'Please confirm your age to continue',
    ])('maps "%s" to errors.ageGated', (raw) => {
      expect(friendlyError(raw, t)).toBe('<errors.ageGated>');
    });
  });

  describe('login required', () => {
    it.each([
      'Sign in to continue',
      'LOGIN_REQUIRED',
      'Please sign-in to YouTube',
      "Sign in to confirm you're not a bot",
      'requires a YouTube account',
    ])('maps "%s" to errors.requiresSignin', (raw) => {
      expect(friendlyError(raw, t)).toBe('<errors.requiresSignin>');
    });
  });

  it('maps private-video errors', () => {
    expect(friendlyError('This video is private', t)).toBe(
      '<errors.privateVideo>',
    );
    expect(friendlyError('Private video', t)).toBe('<errors.privateVideo>');
  });

  it('maps unavailable-video errors', () => {
    expect(friendlyError('Video unavailable', t)).toBe(
      '<errors.videoUnavailable>',
    );
    expect(friendlyError('This video is unavailable in your country', t)).toBe(
      '<errors.videoUnavailable>',
    );
  });

  it('age-gate trumps sign-in when both phrases appear', () => {
    // Real YouTube error reads "Sign in to confirm your age". We want
    // the age-gated mapping (more specific) rather than the generic
    // "needs a sign-in" path.
    expect(friendlyError('Sign in to confirm your age', t)).toBe(
      '<errors.ageGated>',
    );
  });
});
