import { useRosContext } from '@/contexts/RosContext';
import { ConnectionStateBadge } from '@/components/layout/ConnectionStateBadge';
import { getDefinedEnvEntries } from '@/lib/buildEnv';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover';
import { Button } from '@/components/ui/Button';
import { ChevronDown } from 'lucide-react';

const ENV_LABELS: Record<string, string> = {
  ROS_VERSION: 'ROS_VERSION',
  ROS_DISTRO: 'ROS_DISTRO',
  ROS_PYTHON_VERSION: 'ROS_PYTHON_VERSION',
  ROS_DOMAIN_ID: 'ROS_DOMAIN_ID',
  RMW_IMPLEMENTATION: 'RMW_IMPLEMENTATION',
  ROS_LOCALHOST_ONLY: 'ROS_LOCALHOST_ONLY',
  ROS_AUTOMATIC_DISCOVERY_RANGE: 'ROS_AUTO_DISCOVERY',
};

export function TopBar() {
  const { connectionState, error, graphLoading, autoRetriesLeft, initialRetryPending } = useRosContext();
  const definedEnv = getDefinedEnvEntries();

  return (
    <header className="h-12 border-b border-border bg-card flex items-center gap-4 px-4 shrink-0">
      <div className="flex items-center gap-2.5">
        <img
          src="/favicon-96x96.png"
          alt=""
          className="h-8 w-auto object-contain"
          width={28}
          height={28}
        />
        <span className="logo-text-wrap">
          <span className="logo-text text-lg tracking-tight">ROSMON</span>
        </span>
      </div>
      <ConnectionStateBadge state={connectionState} error={error} graphLoading={graphLoading} autoRetriesLeft={autoRetriesLeft} initialRetryPending={initialRetryPending} />
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="ml-auto text-xs text-muted-foreground">
            Environment
            <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto min-w-[200px]">
          <div className="grid gap-2 text-xs">
            {definedEnv.length === 0 ? (
              <p className="text-muted-foreground py-1">No env set</p>
            ) : (
              definedEnv.map(({ key, value }) => (
                <div key={key} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{ENV_LABELS[key] ?? key}</span>
                  <span
                    className="font-medium tabular-nums"
                    title={value}
                  >
                    {value}
                  </span>
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </header>
  );
}
