module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Order matters: nativewind before reanimated
    plugins: ["nativewind/babel", "react-native-reanimated/plugin"],
  };
};
