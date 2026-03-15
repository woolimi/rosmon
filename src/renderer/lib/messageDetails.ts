/** Message/interface details (typedefs) — used by detail drawers for display. */
export interface MessageDetailsResponse {
  typedefs?: Array<{
    type?: string;
    fieldnames?: string[];
    fieldtypes?: string[];
    fieldarraylen?: number[];
  }>;
}
