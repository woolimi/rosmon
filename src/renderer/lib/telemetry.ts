/**
 * Extract a numeric value from a ROS message for charting.
 * - number -> as is
 * - { data: n } (std_msgs/Float64, Int32, etc.) -> n
 * - { data: "123" } (std_msgs/String) -> parseFloat
 * - object with path e.g. "linear.x" -> msg.linear?.x
 */
export function extractNumber(msg: unknown, path?: string): number | null {
  if (msg === null || msg === undefined) return null;
  if (typeof msg === 'number' && !Number.isNaN(msg)) return msg;
  if (typeof msg === 'string') return parseFloat(msg) ?? null;

  const obj = msg as Record<string, unknown>;
  if (path) {
    const parts = path.trim().split('.');
    let v: unknown = obj;
    for (const p of parts) {
      v = (v as Record<string, unknown>)?.[p];
      if (v === undefined || v === null) return null;
    }
    return typeof v === 'number' && !Number.isNaN(v) ? v : null;
  }

  if (typeof obj.data === 'number' && !Number.isNaN(obj.data)) return obj.data;
  if (typeof obj.data === 'string') return parseFloat(obj.data) ?? null;
  return null;
}

/** Format message for display in card/table (single line). */
export function formatMessagePreview(msg: unknown, maxLen = 80): string {
  if (msg === null || msg === undefined) return '—';
  if (typeof msg === 'string') return msg.length > maxLen ? msg.slice(0, maxLen) + '…' : msg;
  if (typeof msg === 'number') return String(msg);
  const s = JSON.stringify(msg);
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
}
