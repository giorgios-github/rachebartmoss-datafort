import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { CampaignStore } from './CampaignStore';
import type { SheetRecord } from './model';
import { uuid } from './util';

export interface Member { name: string; role: 'gm' | 'player'; }
export interface JoinOpts {
  url: string;                 // ws://<gm-ip>:<port>
  room: string;                // campaign code
  member?: Member;             // who I am (for presence)
  cache?: boolean;             // keep an offline IndexedDB copy (default off)
  WebSocketPolyfill?: unknown; // Node tests only; browser uses native WebSocket
}

/**
 * One live connection to ONE campaign on the hub.
 *
 * A Campaign owns a dedicated Y.Doc that holds ONLY this campaign's shared
 * sheets (keyed by sheet id). It carries no local/personal data — that keeps
 * the GM roster to exactly one entry per sheet. Every page (GM dashboard, each
 * player's bound sheet) creates its own Campaign for the same room; the hub
 * relays so they converge.
 */
export class Campaign {
  readonly store: CampaignStore;
  readonly provider: WebsocketProvider;
  private idb: IndexeddbPersistence | null = null;

  constructor(opts: JoinOpts) {
    this.store = new CampaignStore(); // fresh doc — shared campaign sheets only
    if (opts.cache && typeof indexedDB !== 'undefined') {
      this.idb = new IndexeddbPersistence('bartmoss-campaign-' + opts.room, this.store.doc);
    }
    this.provider = new WebsocketProvider(opts.url, opts.room, this.store.doc, {
      connect: true,
      WebSocketPolyfill: (opts.WebSocketPolyfill ?? (globalThis as { WebSocket?: unknown }).WebSocket) as never,
    });
    if (opts.member) this.provider.awareness.setLocalStateField('member', opts.member);
  }

  // ── connection ──
  get synced(): boolean { return this.provider.synced; }
  onSynced(cb: () => void): () => void {
    if (this.provider.synced) { cb(); return () => {}; }
    const h = (isSynced: boolean) => { if (isSynced) cb(); };
    this.provider.on('sync', h);
    return () => this.provider.off('sync', h);
  }
  onStatus(cb: (status: string) => void): () => void {
    const h = (e: { status: string }) => cb(e.status);
    this.provider.on('status', h);
    return () => this.provider.off('status', h);
  }

  // ── sheets ──
  onSheetsChange(cb: (sheets: SheetRecord[]) => void): () => void { return this.store.onSheetsChange(cb); }
  allSheets(): SheetRecord[] { return this.store.allSheets(); }
  getSheet(id: string): SheetRecord | undefined { return this.store.getSheet(id); }
  /** Upsert a sheet's json; returns its updatedAt (to ignore our own echo). */
  publishSheet(id: string, name: string, json: unknown): number {
    const updatedAt = Date.now();
    this.store.publishSheet({ id, ownerId: null, name: name || 'PC', updatedAt, json });
    return updatedAt;
  }
  createSheet(name?: string, json?: unknown): string {
    const id = uuid();
    this.publishSheet(id, name || 'New character', json ?? {});
    return id;
  }

  // ── session flags (shared via the doc) — e.g. GM pauses the session ──
  private session() { return this.store.doc.getMap('session'); }
  setPaused(paused: boolean): void { this.session().set('paused', !!paused); }
  isPaused(): boolean { return !!this.session().get('paused'); }
  onPaused(cb: (paused: boolean) => void): () => void {
    const m = this.session();
    const h = () => cb(!!m.get('paused'));
    m.observe(h);
    return () => m.unobserve(h);
  }

  // ── presence (awareness): who's online / future combat turn ──
  setPresence(state: Record<string, unknown>): void {
    Object.keys(state).forEach((k) => this.provider.awareness.setLocalStateField(k, state[k]));
  }
  getPeers(): unknown[] { return Array.from(this.provider.awareness.getStates().values()); }
  onPresence(cb: (peers: unknown[]) => void): () => void {
    const h = () => cb(this.getPeers());
    this.provider.awareness.on('change', h);
    return () => this.provider.awareness.off('change', h);
  }

  destroy(): void {
    this.provider.destroy();
    if (this.idb) this.idb.destroy();
    this.store.destroy();
  }
}
