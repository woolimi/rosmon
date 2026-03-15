import { useState } from 'react';
import { useRosContext } from '@/contexts/RosContext';
import { ROSMON_BRIDGE_WS_URL } from '@/lib/ros';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { AlertCircle } from 'lucide-react';

const ROSMON_BRIDGE_CMD = 'python -m rosmon_bridge --port 9090';

export function ConnectionFailedBanner() {
  const { connectionState, error, connect } = useRosContext();
  const [retrying, setRetrying] = useState(false);

  if (connectionState !== 'error') return null;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await connect(ROSMON_BRIDGE_WS_URL);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Connection failed</AlertTitle>
      <AlertDescription>
        <div className="space-y-2">
          {error && <p className="text-sm opacity-90">{error}</p>}
          <p className="text-xs opacity-90">
            URL: <code className="rounded bg-background/50 px-1">{ROSMON_BRIDGE_WS_URL}</code>
          </p>
          <p>
            Run <strong>rosmon_bridge</strong>, then click <strong>Reconnect</strong> below.
          </p>
          <p className="text-xs opacity-90 mt-1">Example (in a ROS2 environment):</p>
          <code className="block rounded-md border border-border bg-background/50 px-3 py-2 font-mono text-xs break-all">
            {ROSMON_BRIDGE_CMD}
          </code>
          <div className="pt-2">
            <Button variant="outline" size="sm" onClick={handleRetry} disabled={retrying}>
              {retrying ? 'Connecting…' : 'Reconnect'}
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
