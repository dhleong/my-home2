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
        process.env.PROJECT_ROOT || path.dirname(__dirname),
        'config.json',
    );

    try {
        const config = JSON.parse(fs.readFileSync(configPath));

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
    } catch (e) {
        console.error("Failed to read config file @", configPath);
        throw e;
    }
}

module.exports = {
    loadConfig,
};
