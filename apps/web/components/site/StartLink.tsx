'use client';

import Link from 'next/link';
import { useAuthed } from './useAuthed';

interface StartLinkProps {
  className?: string;
  children: React.ReactNode;
  /** Where a signed-in visitor should land instead of the sign-up form. */
  authedHref?: string;
}

export function StartLink({ className, children, authedHref = '/portal' }: StartLinkProps) {
  const authed = useAuthed();

  return (
    <Link href={authed ? authedHref : '/login?mode=register'} className={className}>
      {children}
    </Link>
  );
}
