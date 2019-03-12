const fastify = require('fastify');
const debug = require('debug')('home:http');

const TOKEN = 'toRENRd,CddkMexPWF}N6Nh8HkmUUL';

class HttpModule {
    constructor(port, yt) {
        this.port = port;

        this._yt = yt;
    }

    start() {
        const existing = this._server;
        if (existing) {
            existing.close();
        }

        const s = fastify();
        this._server = s;
        s.post('/action/play', async (req) => {
            if (!req.body.token) throw new Error('No token');
            if (req.body.token !== TOKEN) throw new Error('Bad token');

            debug('Starting', req.body.title);
            this._yt.resumePlaylist(req.body.title).catch(e => {
                console.error('Unable to start', req.body.title, e);
            });

            return {};
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
