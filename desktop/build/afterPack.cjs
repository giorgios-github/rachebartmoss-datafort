/**
 * electron-builder afterPack hook — ad-hoc code signing for macOS.
 *
 * We don't ship an Apple Developer ID yet, so the app is unsigned. On Apple
 * Silicon an *unsigned* downloaded app is rejected by Gatekeeper as
 * "damaged and can't be opened" (and right-click ▸ Open does NOT fix that
 * specific message). An *ad-hoc* signature (`codesign --sign -`) is free,
 * needs no certificate, and turns that hard failure into the normal
 * "unidentified developer" prompt — which right-click ▸ Open clears.
 *
 * This runs after the .app is packed but before the .dmg is built, so the
 * distributed disk image contains the ad-hoc-signed app.
 */
const path = require('node:path');
const { execFileSync } = require('node:child_process');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appName = context.packager.appInfo.productFilename; // "Bartmoss GM Hub"
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  // --deep signs nested frameworks/helpers first; "-" is the ad-hoc identity.
  execFileSync('codesign', ['--deep', '--force', '--sign', '-', appPath], { stdio: 'inherit' });
  console.log(`  · ad-hoc signed ${appName}.app`);
};
