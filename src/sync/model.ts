// Local-first sync data model — Campaigns / Sessions / Teams.
// Phase 0: types + the per-sheet record used for last-writer-wins mirroring.
// The character-sheet payload itself stays the app's existing JSON blob; we
// only wrap it with sync metadata. Field-level CRDT modeling comes later
// (Phase 3, for combat-critical fields).

export type Uuid = string;

export interface TeamMember {
  memberId: Uuid;        // stable per player device/identity
  displayName: string;
  characterSheetId: Uuid | null;
  role: 'gm' | 'player';
}

export interface CampaignMeta {
  id: Uuid;
  name: string;
  createdAt: number;
  // session is the live window; campaign is the persisted state
  activeSessionId: Uuid | null;
}

export interface SessionRecord {
  id: Uuid;
  date: number;
  notes: string;
  connectedMembers: Uuid[];
  snapshotRef?: string;
}

// One synced character sheet. `json` is the app's existing CS blob (opaque
// here); `updatedAt` drives last-writer-wins until we go field-level.
export interface SheetRecord {
  id: Uuid;
  ownerId: Uuid | null;  // which member owns/edits it (null = unassigned)
  name: string;          // denormalized label for rosters without parsing json
  updatedAt: number;
  json: unknown;         // the CS document blob
}

export const SYNC_VERSION = '0.0.1-phase0';
