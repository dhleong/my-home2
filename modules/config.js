const fs = require('fs');
const path = require('path');

const format = {
    httpPort: 0,
    httpToken: '',

    ps4Creds: '',

    youtubeApiKey: '',
    youtubeCurlFile: '',
};

function loadConfig() {
    const configPath = path.join(
        process.env.PROJECT_ROOT || __dirname,
        'config.json',
    );

    const config = JSON.parse(fs.readSync(configPath));

    // verify format
    for (const k of Object.keys(format)) {
        if (!config[k]) {
            throw new Error(`Missing required config ${k}`);
        }

        if (typeof config[k] !== typeof format[k]) {
            throw new Error(`${k} (${config[k]}) has wrong type`);
        }
    }

    return config;
}

module.export = {
    loadConfig,
};
