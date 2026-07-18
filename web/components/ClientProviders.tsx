'use client';

import type { ReactNode } from 'react';
import { WalletProviders } from '@/components/WalletProviders';

/** Client-only wallet context — imported directly so children stay inside the provider. */
export function ClientProviders({ children }: { children: ReactNode }) {
  return <WalletProviders>{children}</WalletProviders>;
}
