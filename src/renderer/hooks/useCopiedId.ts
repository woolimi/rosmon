import { useEffect, useState } from 'react';

/**
 * Copy-to-clipboard feedback state that resets after a delay.
 * @param delayMs - ms after which copiedId is cleared (default 2000)
 * @returns [copiedId, setCopiedId] - pass setCopiedId to onCopy(id) of CopyableCliLine
 */
export function useCopiedId(delayMs = 2000): [string | null, (id: string) => void] {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (copiedId == null) return;
    const t = setTimeout(() => setCopiedId(null), delayMs);
    return () => clearTimeout(t);
  }, [copiedId, delayMs]);

  return [copiedId, setCopiedId];
}
