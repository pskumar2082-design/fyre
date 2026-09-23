'use client';

import { useEffect, useRef, useState } from 'react';

// Shared open/close-on-outside-click/Escape behaviour for the dropdown
// pickers in the comparison feature (MovieSelector, ComparisonTabs) --
// same interaction pattern components/TableGroups.tsx's own dropdowns
// already use, kept as its own small hook here (rather than importing
// that file's internal, unexported copy) so it's shared once across this
// feature's own components instead of duplicated a third time.
export function useDropdown<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return { open, setOpen, ref };
}
