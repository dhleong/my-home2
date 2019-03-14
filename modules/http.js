const fastify = require('fastify');
const debug = require('debug')('home:http');

class HttpModule {
    constructor(config, player) {
        this.port = config.httpPort;
        this.token = config.httpToken;

        this._player = player;
    }

    start() {
        const existing = this._server;
        if (existing) {
            existing.close();
        }

        const s = fastify({
            logger: true,
        });
        this._server = s;
        s.post('/action/play', async (req) => {
            if (!req.body.token) throw new Error('No token');
            if (req.body.token !== this.token) throw new Error('Bad token');

            if (req.body.title) {
                debug('Starting', req.body.title);
                await this._player.playTitle(req.body.title);
            } else if (req.body['title-id']) {
                const id = req.body['title-id'];
                debug('Starting by id', id);
                await this._player.playTitleId(id);
            }

            return {success: true};
        });

        s.listen(this.port, '0.0.0.0', (err, address) => {
            if (err) throw err;
            console.log(`listening on ${address}`);
        });
    }
}

module.exports = {
    HttpModule,
};
