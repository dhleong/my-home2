const fastify = require('fastify');
const debug = require('debug')('home:http');

function declareRoutes(module, s) {
    s.post('/action/play', async (req) => {
        if (req.body.title) {
            debug('Starting', req.body.title);
            await module._player.playTitle(req.body.title);
        } else if (req.body['title-id']) {
            const id = req.body['title-id'];
            debug('Starting by id', id);
            await module._player.playTitleId(id);
        }

        return {success: true};
    });

    s.put('/devices/:id/state', async (req) => {
        if (!(req.params.id && req.body.state)) {
            throw new Error("Incomplete request");
        }

        debug("device state!", req.params.id, req.body.state);
        module._devices.setState(req.params.id, req.body.state);

        return {success: true};
    });
}

class AuthError extends Error {
    constructor(message) {
        super(message);
        this.statusCode = 401;
    }
}

async function verifyToken(req) {
    if (!req.body.token) throw new AuthError('No token');
    if (req.body.token !== this.token) throw new AuthError('Bad token');
}

function declareMiddleware(module, s) {
    s.addHook("preHandler", verifyToken.bind(module));
}

class HttpModule {
    constructor(config, player, devices) {
        this.port = config.httpPort;
        this.token = config.httpToken;

        this._player = player;
        this._devices = devices;
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

        declareMiddleware(this, s);
        declareRoutes(this, s);

        s.listen(this.port, '0.0.0.0', (err, address) => {
            if (err) throw err;
            console.log(`listening on ${address}`);
        });
    }
}

module.exports = {
    HttpModule,
};
