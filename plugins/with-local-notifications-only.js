const { withEntitlementsPlist } = require('expo/config-plugins');

const PUSH_ENTITLEMENT = 'aps-environment';

/**
 * Strips the Push Notifications entitlement on iOS.
 *
 * `expo-notifications` adds `aps-environment` by default, but this app only ever
 * schedules *local* notifications, which require no entitlement. Carrying it has two
 * costs:
 *
 * - Free / personal Apple developer teams cannot sign an app that declares the Push
 *   Notifications capability, so device builds fail outright.
 * - It advertises a capability the app does not use.
 *
 * The key has to be removed in two places: `expo-notifications` writes it onto the
 * static `ios.entitlements` config, which a base mod later merges into the plist, so
 * deleting it from `modResults` alone is silently undone.
 *
 * Remove this plugin if remote push is ever added.
 */
module.exports = function withLocalNotificationsOnly(config) {
  if (config.ios?.entitlements) {
    delete config.ios.entitlements[PUSH_ENTITLEMENT];
  }

  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults[PUSH_ENTITLEMENT];
    return mod;
  });
};
