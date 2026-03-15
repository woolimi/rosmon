import { Button } from '@/components/ui/Button';
import { Loader2 } from 'lucide-react';
import type { GraphVisibility } from '@/lib/graph/buildTopologyGraph';

export interface GraphVisibilityControlsProps {
  visibility: GraphVisibility;
  setVisibility: React.Dispatch<React.SetStateAction<GraphVisibility>>;
  onRefresh: () => void;
  disabled: boolean;
  isRefreshing: boolean;
}

export function GraphVisibilityControls({
  visibility,
  setVisibility,
  onRefresh,
  disabled,
  isRefreshing,
}: GraphVisibilityControlsProps) {
  return (
    <div className="absolute top-2 left-2 z-10 flex items-center gap-3 rounded-md border border-border bg-card/95 px-3 py-2 shadow-sm">
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={disabled}
      >
        {isRefreshing ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
            Loading…
          </>
        ) : (
          'Refresh'
        )}
      </Button>
      <div className="flex items-center gap-4 text-sm border-l border-border pl-3">
        <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
          <input
            type="checkbox"
            checked={visibility.topics}
            onChange={(e) =>
              setVisibility((v) => ({ ...v, topics: e.target.checked }))
            }
            className="rounded border-border bg-card text-primary focus:ring-border"
          />
          Topics
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
          <input
            type="checkbox"
            checked={visibility.services}
            onChange={(e) =>
              setVisibility((v) => ({ ...v, services: e.target.checked }))
            }
            className="rounded border-border bg-card text-primary focus:ring-border"
          />
          Services
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
          <input
            type="checkbox"
            checked={visibility.actions}
            onChange={(e) =>
              setVisibility((v) => ({ ...v, actions: e.target.checked }))
            }
            className="rounded border-border bg-card text-primary focus:ring-border"
          />
          Actions
        </label>
      </div>
    </div>
  );
}
