// Metro (React Native's bundler) only looks inside the project's own
// node_modules by default. In this npm workspaces monorepo most packages
// are hoisted to the repo root's node_modules instead, so without this
// config Metro cannot resolve them and `expo start` fails to bundle.
// See: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
