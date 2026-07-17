// parts/index.js — the catalogue registry. Bins in tray order; unbuilt parts listed
// as PLANNED entries (id only) so the tray is honest about state.
// Wave 3: full DF-TO-C port in progress.
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
import * as button from './interface/button.js';
import * as swtch from './interface/switch.js';
import * as dial from './interface/dial.js';
import * as keypad from './interface/keypad.js';
import * as ledArray from './interface/led-array.js';
import * as haptic from './interface/haptic.js';
import * as crypto from './logic/crypto-module.js';
import * as memSpool from './logic/memory-spool.js';
import * as psu from './power/psu.js';
import * as indCoil from './power/induction-coil.js';
import * as thermoGen from './power/thermo-gen.js';
import * as cartBay from './store/cartridge-bay.js';
import * as micro from './sense/microphone.js';
import * as imu from './sense/imu.js';
import * as emProbe from './sense/em-probe.js';
import * as biomon from './sense/biomonitor.js';
import * as chemSniff from './sense/chem-sniffer.js';
import * as servo from './act/servo.js';
import * as linAct from './act/linear-actuator.js';
import * as injector from './act/injector.js';
import * as microPump from './act/micro-pump.js';
import * as siren from './act/siren.js';
import * as neuralJack from './link/neural-jack.js';
import * as laserLink from './link/laser-link.js';
import * as governor from './overdrive/governor.js';
import * as fuse from './overdrive/fuse.js';
import * as bypassShunt from './overdrive/bypass-shunt.js';
import * as graftSink from './overdrive/graft-heatsink.js';
import * as ratingStencil from './overdrive/rating-stencil.js';
import * as clip from './fasten/clip.js';
import * as cableTie from './fasten/cable-tie.js';
import * as adapterPlate from './graft/adapter-plate.js';
import * as juryBracket from './graft/jury-rig-bracket.js';
import * as pigtail from './graft/pigtail.js';
import * as reducerBushing from './graft/reducer-bushing.js';
import * as shimSet from './graft/shim-set.js';
import * as socket from './structure/socket.js';
import * as strap from './structure/strap.js';
import * as loomMod from './loom.js';
import * as tiersMod from './tiers.js';
export const loom = loomMod;
export const tiers = tiersMod;

export const BIN_ORDER = ['POWER', 'LOGIC', 'SENSE', 'LINK', 'ACT', 'INTERFACE', 'STORE', 'STRUCTURE', 'FASTEN', 'OVERDRIVE', 'GRAFT'];

export const BINS = {
  POWER: { glyphOf: 'cell', parts: [cell, psu, indCoil, thermoGen], planned: [] },
  LOGIC: { glyphOf: 'processor-board', parts: [procBoard, smartCore, memSpool, crypto], planned: [] },
  SENSE: { glyphOf: 'optic', parts: [optic, micro, imu, emProbe, biomon, chemSniff], planned: [] },
  LINK: { glyphOf: 'rf-transceiver', parts: [rfxcvr, antenna, neuralJack, laserLink], planned: [] },
  ACT: { glyphOf: 'emitter', parts: [emitter, servo, linAct, injector, microPump, siren], planned: [] },
  INTERFACE: { glyphOf: 'screen', parts: [screen, button, swtch, dial, keypad, ledArray, haptic], planned: [] },
  STORE: { glyphOf: 'vessel', parts: [magazine, vessel, cartBay], planned: [] },
  STRUCTURE: { glyphOf: 'rail-clamp', parts: [railClamp, socket, strap], planned: [] },
  FASTEN: { glyphOf: 'clip', parts: [clip, cableTie], planned: [] },
  OVERDRIVE: { glyphOf: 'coolant-loop', parts: [cloop, governor, fuse, bypassShunt, graftSink, ratingStencil], planned: [] },
  GRAFT: { glyphOf: 'adapter-plate', parts: [adapterPlate, shimSet, reducerBushing, pigtail, juryBracket], planned: [] }
};

export const HIDDEN = [];   // ids resolvable but not offered in the tray

export function allParts() {
  const out = [];
  for (const b of BIN_ORDER) for (const p of BINS[b].parts) out.push(p);
  return out;
}
