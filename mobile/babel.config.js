// babel.config.js
// Babel configuration for Expo with NativeWind plugin.
// NativeWind/babel transforms className props into React Native style objects at build time.

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      'react-native-reanimated/plugin',
    ],
  };
};
