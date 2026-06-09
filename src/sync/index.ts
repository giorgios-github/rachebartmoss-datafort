import { Campaign } from './Campaign';
import type { JoinOpts } from './Campaign';
import { SYNC_VERSION } from './model';
import { uuid } from './util';

/**
 * Public surface, exposed as the IIFE global `window.BartmossSync`.
 *
 * One concept: `join(opts)` opens a live connection to ONE campaign on the GM
 * hub and returns a `Campaign` you talk to (roster, publish, presence). Both
 * the GM dashboard and each player's bound sheet call `join` for the same room;
 * the hub relays so everyone converges on one shared, deduplicated set.
 *
 * Local mode (cs.html without ?campaign) does NOT use this at all — the app
 * stays a plain offline localStorage tool there.
 */
export { Campaign } from './Campaign';
export type { JoinOpts, Member } from './Campaign';
export * from './model';
export { uuid } from './util';

// One-time migration: Phase 0 kept a local mirror in IndexedDB
// ('bartmoss-campaign-local') that, with the old code, could replay stale
// sheets into a campaign. The current design never uses it — delete it so it
// can't resurface duplicates.
try {
  if (typeof indexedDB !== 'undefined' && indexedDB.deleteDatabase) {
    indexedDB.deleteDatabase('bartmoss-campaign-local');
  }
} catch { /* ignore */ }

export function join(opts: JoinOpts): Campaign {
  return new Campaign(opts);
}

export const VERSION = SYNC_VERSION;
// keep a named export referenced so bundlers don't tree-shake the helper away
void uuid;
