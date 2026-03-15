import { useEffect, useState } from 'react';
import type { RosmonBridgeClient } from '@/lib/rosmonBridge';

export interface UseInterfaceTextResult {
  text: string;
  error: string | undefined;
  errorDetail: string | undefined;
  loading: boolean;
}

export function useInterfaceText(
  open: boolean,
  ros: RosmonBridgeClient | null,
  resolvedType: string
): UseInterfaceTextResult {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [errorDetail, setErrorDetail] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !ros) {
      setText('');
      setError(undefined);
      setErrorDetail(undefined);
      setLoading(false);
      return;
    }
    const typeToFetch = resolvedType?.trim() ?? '';
    if (!typeToFetch) {
      setText('');
      setError(undefined);
      setErrorDetail(undefined);
      setLoading(false);
      return;
    }
    setLoading(true);
    setText('');
    setError(undefined);
    setErrorDetail(undefined);
    ros
      .getInterface(typeToFetch)
      .then((res) => {
        setText(res?.text ?? '');
        setError(res?.error);
        setErrorDetail(res?.error_detail);
      })
      .catch(() => {
        setText('');
        setError(undefined);
        setErrorDetail(undefined);
      })
      .finally(() => setLoading(false));
  }, [open, resolvedType, ros]);

  return { text, error, errorDetail, loading };
}
