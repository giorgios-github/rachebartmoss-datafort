// parts/index.js — the catalogue registry. Bins in tray order; unbuilt parts listed
// as PLANNED entries (id only) so the tray is honest about state.
// v1 port: 9 parts live (one strong part per key bin); the rest of the DF-TO-C
// catalogue lands in follow-up passes.
import * as screen from './interface/screen.js';
import * as cell from './power/cell.js';
import * as procBoard from './logic/processor-board.js';
import * as smartCore from './logic/smart-core-ic.js';
import * as antenna from './link/antenna.js';
import * as emitter from './act/emitter.js';
import * as vessel from './store/vessel.js';
import * as cloop from './overdrive/coolant-loop.js';
import * as rfxcvr from './link/rf-transceiver.js';
import * as optic from './sense/optic.js';
import * as magazine from './store/magazine.js';
import * as railClamp from './structure/rail-clamp.js';
import * as loomMod from './loom.js';
import * as tiersMod from './tiers.js';
export const loom = loomMod;
export const tiers = tiersMod;

export const BIN_ORDER = ['POWER', 'LOGIC', 'SENSE', 'LINK', 'ACT', 'INTERFACE', 'STORE', 'STRUCTURE', 'FASTEN', 'OVERDRIVE', 'GRAFT'];

export const BINS = {
  POWER: { glyphOf: 'cell', parts: [cell], planned: ['psu', 'induction-coil', 'thermo-gen'] },
  LOGIC: { glyphOf: 'processor-board', parts: [procBoard, smartCore], planned: ['memory-spool', 'crypto-module'] },
  SENSE: { glyphOf: 'optic', parts: [optic], planned: ['microphone', 'chem-sniffer', 'imu', 'em-probe', 'biomonitor'] },
  LINK: { glyphOf: 'antenna', parts: [rfxcvr, antenna], planned: ['neural-jack', 'laser-link'] },
  ACT: { glyphOf: 'emitter', parts: [emitter], planned: ['servo', 'linear-actuator', 'injector', 'micro-pump', 'siren'] },
  INTERFACE: { glyphOf: 'screen', parts: [screen], planned: ['keypad', 'button', 'switch', 'dial', 'led-array', 'haptic'] },
  STORE: { glyphOf: 'vessel', parts: [magazine, vessel], planned: ['cartridge-bay'] },
  STRUCTURE: { glyphOf: 'rail-clamp', parts: [railClamp], planned: ['socket', 'strap'] },
  FASTEN: { glyphOf: 'clip', parts: [], planned: ['clip', 'cable-tie'] },
  OVERDRIVE: { glyphOf: 'coolant-loop', parts: [cloop], planned: ['governor', 'fuse', 'bypass-shunt', 'graft-heatsink', 'rating-stencil'] },
  GRAFT: { glyphOf: 'adapter-plate', parts: [], planned: ['adapter-plate', 'shim-set', 'reducer-bushing', 'pigtail', 'jury-rig-bracket'] }
};

export function allParts() {
  const out = [];
  for (const b of BIN_ORDER) for (const p of BINS[b].parts) out.push(p);
  return out;
}
