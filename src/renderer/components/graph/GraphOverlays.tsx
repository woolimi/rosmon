import { Loader2 } from 'lucide-react';

export interface GraphOverlaysProps {
  /** Show loading overlay (connecting, or loading graph) */
  showLoading: boolean;
  /** Show error overlay (connection failed) */
  showError: boolean;
  /** Show empty state (no nodes, connected) */
  showEmpty: boolean;
  bridgeUrl: string;
  rosDomainId: string;
}

export function GraphOverlays({
  showLoading,
  showError,
  showEmpty,
  bridgeUrl,
  rosDomainId,
}: GraphOverlaysProps) {
  return (
    <>
      {showLoading && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 text-foreground"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
          <p className="text-sm font-medium">Loading topology…</p>
        </div>
      )}
      {showError && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-background/90"
          role="alert"
          aria-live="assertive"
        >
          <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 rounded-lg border border-red-500/60 bg-red-950/40 px-6 py-5 text-center shadow-lg shadow-red-950/20">
            <p className="font-semibold text-red-400">Connection failed</p>
            <p className="text-sm text-red-200/90">
              Check that <strong>rosmon_bridge</strong> is running and the URL (
              <code className="rounded bg-red-900/50 px-1.5 py-0.5 font-mono text-red-300">
                {bridgeUrl}
              </code>
              ) is correct, then refresh or reconnect from the top bar.
            </p>
          </div>
        </div>
      )}
      {showEmpty && (
        <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm px-4">
          <p className="font-medium text-foreground">No nodes</p>
          <p className="text-center max-w-sm">
            Verify ROS_DOMAIN_ID is <strong className="text-foreground">{rosDomainId !== '' ? rosDomainId : '(not set)'}</strong>.
          </p>
          <p className="text-xs mt-1">Run nodes in the same terminal/environment as rosmon_bridge, or export ROS_DOMAIN_ID first.</p>
        </div>
      )}
    </>
  );
}
