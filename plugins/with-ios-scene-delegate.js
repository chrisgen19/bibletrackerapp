const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const SCENE_DELEGATE_MARKER = 'class SceneDelegate';

const LAUNCH_OPTIONS_PROPERTY = '  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?';

const SCENE_DELEGATE_CLASS = `
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window

    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: appDelegate.launchOptions)

    // A cold launch from a link delivers it here; \`application(_:open:options:)\` is
    // never called under the scene life cycle.
    for context in connectionOptions.urlContexts {
      RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
    for activity in connectionOptions.userActivities {
      RCTLinkingManager.application(
        UIApplication.shared, continue: activity, restorationHandler: { _ in })
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    RCTLinkingManager.application(
      UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
`;

/**
 * Rewrites `AppDelegate.swift` to hand window creation to a scene delegate.
 *
 * The window and the `startReactNative` call are matched separately rather than as one
 * block: other config plugins inject code between them, and a single combined pattern
 * silently stops matching when they do.
 *
 * Returns the source unchanged if the scene delegate is already present, so repeated
 * prebuilds do not append it twice.
 */
function addSceneDelegate(source) {
  if (source.includes(SCENE_DELEGATE_MARKER)) return source;

  let next = source.replace(
    /^.*window = UIWindow\(frame: UIScreen\.main\.bounds\).*\n/m,
    '',
  );

  // The window no longer exists at this point, so the factory cannot start here.
  next = next.replace(
    /^[ \t]*factory\.startReactNative\((?:.*\n)*?.*launchOptions: launchOptions\)\n/m,
    '    self.launchOptions = launchOptions\n',
  );

  // `var window: UIWindow?` stays — ExpoAppDelegate and several plugins read it.
  next = next.replace(
    /^(\s*var window: UIWindow\?\n)/m,
    `$1${LAUNCH_OPTIONS_PROPERTY}\n`,
  );

  return `${next.trimEnd()}\n${SCENE_DELEGATE_CLASS}`;
}

/**
 * Declares the scene manifest that iOS 26+ SDKs require.
 *
 * Declaring this *without* moving window creation into the scene delegate yields a
 * black screen rather than a crash, so the two mods below must stay paired.
 */
function buildSceneManifest() {
  return {
    UIApplicationSupportsMultipleScenes: false,
    UISceneConfigurations: {
      UIWindowSceneSessionRoleApplication: [
        {
          UISceneConfigurationName: 'Default Configuration',
          UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
        },
      ],
    },
  };
}

/**
 * Config plugin entry point.
 *
 * Apps linked against the iOS 26 SDK or later must adopt the UIScene life cycle; UIKit
 * traps in `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption` at scene
 * creation otherwise, which reads as an instant launch-then-quit. Neither React Native
 * 0.86 nor Expo SDK 57 ships scene support, so the app has to adopt it itself.
 *
 * Remove this plugin once Expo adopts the scene life cycle upstream — see
 * https://github.com/expo/expo/issues/46664.
 */
module.exports = function withIosSceneDelegate(config) {
  const withManifest = withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest = buildSceneManifest();
    return mod;
  });

  return withAppDelegate(withManifest, (mod) => {
    if (mod.modResults.language !== 'swift') {
      throw new Error(
        `with-ios-scene-delegate: expected a Swift AppDelegate, got "${mod.modResults.language}"`,
      );
    }

    mod.modResults.contents = addSceneDelegate(mod.modResults.contents);
    return mod;
  });
};

module.exports.addSceneDelegate = addSceneDelegate;
module.exports.buildSceneManifest = buildSceneManifest;
