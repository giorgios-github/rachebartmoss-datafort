import * as Y from 'yjs';
import type { SheetRecord, CampaignMeta, TeamMember, Uuid } from './model';

/**
 * CampaignStore — a thin, transport-agnostic wrapper around a single Yjs doc
 * holding one campaign's shared state. Phase 0 wires only the `sheets` map
 * (last-writer-wins per sheet). A network provider (LAN hub) and field-level
 * CRDT come in later phases; the doc/API here stay the stable seam.
 *
 * Y structure:
 *   doc.getMap('meta')    -> campaign meta fields
 *   doc.getMap('team')    -> memberId -> TeamMember
 *   doc.getMap('sheets')  -> sheetId  -> SheetRecord  (LWW by updatedAt)
 */
export class CampaignStore {
  readonly doc: Y.Doc;
  private readonly meta: Y.Map<unknown>;
  private readonly team: Y.Map<TeamMember>;
  private readonly sheets: Y.Map<SheetRecord>;

  constructor(doc?: Y.Doc) {
    this.doc = doc ?? new Y.Doc();
    this.meta = this.doc.getMap('meta');
    this.team = this.doc.getMap('team');
    this.sheets = this.doc.getMap('sheets');
  }

  // ── meta ──
  initCampaign(m: CampaignMeta): void {
    this.doc.transact(() => {
      if (this.meta.get('id')) return; // already initialized
      (Object.keys(m) as (keyof CampaignMeta)[]).forEach((k) => this.meta.set(k, m[k]));
    });
  }
  getMeta(): Partial<CampaignMeta> {
    const out: Record<string, unknown> = {};
    this.meta.forEach((v, k) => (out[k] = v));
    return out as Partial<CampaignMeta>;
  }

  // ── team ──
  upsertMember(member: TeamMember): void {
    this.team.set(member.memberId, member);
  }
  getTeam(): TeamMember[] {
    return Array.from(this.team.values());
  }

  // ── sheets (LWW) ──
  /** Publish/replace a sheet only if our copy is newer (last-writer-wins). */
  publishSheet(rec: SheetRecord): boolean {
    const existing = this.sheets.get(rec.id);
    if (existing && existing.updatedAt > rec.updatedAt) return false;
    this.sheets.set(rec.id, rec);
    return true;
  }
  getSheet(id: Uuid): SheetRecord | undefined {
    return this.sheets.get(id);
  }
  allSheets(): SheetRecord[] {
    return Array.from(this.sheets.values());
  }
  removeSheet(id: Uuid): void {
    this.sheets.delete(id);
  }

  // ── observation ──
  /** Fires whenever any sheet changes (local or remote). */
  onSheetsChange(cb: (sheets: SheetRecord[]) => void): () => void {
    const handler = () => cb(this.allSheets());
    this.sheets.observeDeep(handler);
    return () => this.sheets.unobserveDeep(handler);
  }

  /** Apply a remote update (binary) into the doc. */
  applyUpdate(update: Uint8Array, origin?: unknown): void {
    Y.applyUpdate(this.doc, update, origin);
  }
  /** Encode the whole doc state (for initial handoff / snapshot). */
  encodeState(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }

  destroy(): void {
    this.doc.destroy();
  }
}
