const fs = require('fs-extra');
const debug = require('debug')('home:hbogo');

const { createChromecastDevice } = require('./cast');
const { HboGoApp } = require('babbling');

class HboGoModule {

    constructor(config) {
        this.config = config;
    }

    async resumeSeries(id) {
        const device = createChromecastDevice();
        debug('resume', id);

        try {
            const token = await this._getToken();
            const app = await device.openApp(HboGoApp, {
                token,
            });

            await app.resumeSeries(id);

            debug('done!');

        } finally {
            device.close();
        }
    }

    async _getToken() {
        if (this._token) return this._token;

        const token = await fs.readFile(this.config.hbogoTokenFile);
        this._token = token.toString();
        return this._token;
    }
}

module.exports = {
    HboGoModule,
};


