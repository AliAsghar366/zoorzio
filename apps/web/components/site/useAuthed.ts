'use client';

import { useEffect, useState } from 'react';
import { isAuthenticated } from '@/lib/api';

/** Tokens live in localStorage, so this is only known after mount. */
export function useAuthed(): boolean {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(isAuthenticated());
  }, []);

  return authed;
}
