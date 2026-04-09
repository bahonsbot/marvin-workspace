'use client';

import { useEffect, useRef } from 'react';

type UnsavedChangesGuardOptions = {
  message?: string;
};

export function useUnsavedChangesGuard(dirty: boolean, options?: UnsavedChangesGuardOptions) {
  const messageRef = useRef(options?.message ?? 'You have unsaved changes. Leave without saving?');
  messageRef.current = options?.message ?? 'You have unsaved changes. Leave without saving?';

  useEffect(() => {
    if (!dirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute('data-bypass-unsaved-guard')) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;

      let destination: URL;
      let current: URL;
      try {
        destination = new URL(anchor.href, window.location.href);
        current = new URL(window.location.href);
      } catch {
        return;
      }

      const sameDocument =
        destination.pathname === current.pathname &&
        destination.search === current.search &&
        destination.hash === current.hash;

      if (sameDocument) return;

      const confirmed = window.confirm(messageRef.current);
      if (confirmed) return;

      event.preventDefault();
      event.stopPropagation();
      (event as MouseEvent & { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [dirty]);
}
