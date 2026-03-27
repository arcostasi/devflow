import { describe, it, expect } from 'vitest';
import { hasUnsavedChanges } from '../hooks/useUnsavedChanges';

describe('hasUnsavedChanges (initial state)', () => {
  it('returns false when no sources are dirty', () => {
    expect(hasUnsavedChanges()).toBe(false);
  });
});
