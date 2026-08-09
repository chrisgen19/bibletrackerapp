const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle emits `.sql` migration files that are imported by `drizzle/migrations.js`.
config.resolver.sourceExts.push('sql');

module.exports = config;
