/* global module, process, require */
/* eslint-disable @typescript-eslint/no-require-imports */
const appConfig = require('./app.json');

const config = appConfig.expo;

// Local: arquivo ignorado pelo Git. EAS: arquivo secreto disponibilizado pelo builder.
config.android.googleServicesFile = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';
config.updates = {
  ...(config.updates ?? {}),
  url: 'https://u.expo.dev/f3bbe2d8-3c7f-430f-994c-bc620a1bf972',
};
config.runtimeVersion = { policy: 'appVersion' };

module.exports = { expo: config };
