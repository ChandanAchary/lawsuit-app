const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Workaround for `event-target-shim` exports issue where it fails resolving
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
