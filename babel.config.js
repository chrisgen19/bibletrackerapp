/**
 * `babel-preset-expo` automatically injects the react-native-worklets Babel plugin
 * when Reanimated is installed, so it must not be listed manually here.
 *
 * `inline-import` embeds Drizzle's generated `.sql` migrations as strings at build
 * time; without it Metro would try to parse them as JavaScript.
 */
module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
