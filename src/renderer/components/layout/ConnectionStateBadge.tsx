import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import type { RosConnectionState } from '@/hooks/useRos';

const CONNECTING_STYLE =
  'border-amber-400/50 bg-amber-400/10 text-amber-300';
const CONNECTED_STYLE =
  'border-emerald-400 bg-emerald-400/10 text-emerald-400';
const DISCONNECTED_STYLE = 'border-border bg-background/50 text-muted-foreground';
const FAILED_STYLE = 'border-destructive/60 bg-destructive/10 text-destructive';

export function ConnectionStateBadge({
  state,
  error,
  graphLoading,
  autoRetriesLeft = 0,
  initialRetryPending = false,
  className,
}: {
  state: RosConnectionState;
  error?: string | null;
  graphLoading?: boolean;
  /** @deprecated 호환용. 대신 initialRetryPending 사용 */
  autoRetriesLeft?: number;
  /** 첫 연결 실패 후 2초 재시도 대기 중이면 연결중으로 표시 */
  initialRetryPending?: boolean;
  className?: string;
}) {
  const stillConnecting = state === 'error' && (autoRetriesLeft > 0 || initialRetryPending);
  const isConnecting = state === 'connecting' || graphLoading === true || stillConnecting;
  const label =
    state === 'error' && !stillConnecting
      ? 'Failed'
      : isConnecting
        ? 'Connecting'
        : state === 'connected'
          ? 'Connected'
          : 'Disconnected';

  const styleClass =
    state === 'error' && !stillConnecting
      ? FAILED_STYLE
      : isConnecting
        ? CONNECTING_STYLE
        : state === 'connected'
          ? CONNECTED_STYLE
          : DISCONNECTED_STYLE;

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn('h-8 min-w-[4.5rem] font-medium', styleClass, className)}
      title={error || undefined}
      disabled
    >
      {isConnecting ? (
        <>
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
          {label}
        </>
      ) : state === 'connected' ? (
        <>
          <span className="mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />
          {label}
        </>
      ) : (
        label
      )}
    </Button>
  );
}
