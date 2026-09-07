// apps/mobile sits in an npm workspace where `react-native` is nested under
// this app's own node_modules while `jest-expo` (which needs to require
// `react-native/jest-preset` internally) gets hoisted to the repo root.
// Node's module resolution can't bridge that gap - jest-expo's own require
// call fails to find react-native from its hoisted location - so instead of
// using the "jest-expo" preset string, this reconstructs the same preset by
// requiring react-native's own jest-preset directly, which resolves fine
// from this file's location (apps/mobile).
// react-native's preset is plain JSON-serializable config (strings/arrays),
// so a JSON round-trip clone avoids adding a dependency just for this.
const preset = JSON.parse(JSON.stringify(require('react-native/jest-preset')));

preset.moduleNameMapper = {
  ...(preset.moduleNameMapper || {}),
  '^react-native-vector-icons$': '@expo/vector-icons',
  '^react-native-vector-icons/(.*)': '@expo/vector-icons/$1',
};

module.exports = preset;
