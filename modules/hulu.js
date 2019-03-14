const fs = require('fs-extra');
const debug = require('debug')('home:youtube');

const { createChromecastDevice } = require('./cast');

class HuluModule {

    constructor(config) {
        this.config = config;
    }

    async resumeSeries(id) {
        const device = createChromecastDevice();
        debug('resume', id);

        try {
            const cookies = await this._getCookies();
            const app = await device.openApp('hulu', {
                cookies,
            });

            await app.resumeSeries(id);

            debug('done!');

        } finally {
            device.close();
        }
    }

    async _getCookies() {
        if (this._cookies) return this._cookies;

        const cookies = await fs.readFile(this.config.huluCookiesFile);
        this._cookies = cookies.toString();
        return this._cookies;
    }
}

module.exports = {
    HuluModule,
};

