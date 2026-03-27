import { useEffect, useRef, useCallback } from 'react';

/**
 * Registers a `beforeunload` guard when there are unsaved changes.
 * Components call `setDirty(true)` when edits happen and `setDirty(false)` after saving.
 * Multiple consumers can register independently — the warning shows if ANY source is dirty.
 */

const dirtySources = new Set<string>();

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (dirtySources.size > 0) {
    e.preventDefault();
  }
}

let listenerAttached = false;

function syncListener() {
  if (dirtySources.size > 0 && !listenerAttached) {
    globalThis.addEventListener('beforeunload', handleBeforeUnload);
    listenerAttached = true;
  } else if (dirtySources.size === 0 && listenerAttached) {
    globalThis.removeEventListener('beforeunload', handleBeforeUnload);
    listenerAttached = false;
  }
}

export function useUnsavedChanges(sourceId: string) {
  const dirtyRef = useRef(false);

  const setDirty = useCallback(
    (dirty: boolean) => {
      if (dirty && !dirtyRef.current) {
        dirtyRef.current = true;
        dirtySources.add(sourceId);
        syncListener();
      } else if (!dirty && dirtyRef.current) {
        dirtyRef.current = false;
        dirtySources.delete(sourceId);
        syncListener();
      }
    },
    [sourceId],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dirtySources.delete(sourceId);
      syncListener();
    };
  }, [sourceId]);

  return { setDirty, isDirty: dirtyRef.current };
}

/** Returns true if any source has unsaved changes. Useful for navigation guards. */
export function hasUnsavedChanges(): boolean {
  return dirtySources.size > 0;
}
