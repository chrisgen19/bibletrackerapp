const { withXcodeProject } = require('expo/config-plugins');

/**
 * Pins the Apple development team onto every signable build configuration.
 *
 * `expo prebuild` regenerates `ios/` from scratch, and `DEVELOPMENT_TEAM` is not
 * something it derives from `app.json` — so a team set by opening Xcode, or by
 * hand in the `pbxproj`, is silently discarded on the next prebuild. The build
 * then fails to sign for a device, which looks like a signing problem rather
 * than a lost setting.
 *
 * Returns the number of configurations touched so callers can assert the filter
 * still matches something after an Expo upgrade changes the project layout.
 */
function setSigningTeam(project, teamId) {
  const configurations = project.pbxXCBuildConfigurationSection();
  let applied = 0;

  for (const key of Object.keys(configurations)) {
    const entry = configurations[key];
    // The section interleaves `<uuid>` objects with `<uuid>_comment` strings.
    if (typeof entry !== 'object' || entry === null) continue;

    const settings = entry.buildSettings;
    // Only the app target carries a bundle identifier. Helper targets in the same
    // project must not be given a team, which is what breaks archive builds.
    if (settings?.PRODUCT_BUNDLE_IDENTIFIER === undefined) continue;

    settings.DEVELOPMENT_TEAM = teamId;
    settings.CODE_SIGN_STYLE = 'Automatic';
    applied += 1;
  }

  return applied;
}

/**
 * Config plugin entry point. The team id lives in `app.json` beside the rest of
 * the native configuration rather than in this file, so a different developer
 * can point it at their own team without editing plugin code.
 */
module.exports = function withSigningTeam(config, props) {
  const teamId = props?.teamId;

  // Failing loudly at config time beats a signing error several minutes into a
  // build, where the cause is far from the symptom.
  if (typeof teamId !== 'string' || teamId.length === 0) {
    throw new Error(
      'with-signing-team: a `teamId` prop is required, e.g. ["./plugins/with-signing-team", { "teamId": "ABCDE12345" }]',
    );
  }

  return withXcodeProject(config, (mod) => {
    setSigningTeam(mod.modResults, teamId);
    return mod;
  });
};

module.exports.setSigningTeam = setSigningTeam;
