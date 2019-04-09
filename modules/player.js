const debug = require('debug')('home:player');
const {
    ChromecastDevice, PlayerBuilder, YoutubeApp,
} = require('babbling');
const { pickBestMatchForTitle } = require('babbling/dist/cli/commands/find');

const leven = require('leven');

const CHROMECAST_DEVICE = 'Family Room TV';

function nameToId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/, "-");
}

const TITLES = [

    // Youtube

    ["Critical Role", "https://www.youtube.com/playlist?list=PL1tiwbzkOjQz7D0l_eLJGAISVtcL7oRu_"],

    // never resume the workout playlist!
    ["Workout", "https://www.youtube.com/playlist?list=PLw6X_oq5Z8kmISsoG_HYn_WxcOKJDLO9V", {resume: false}],

    // hbo

    ["Game of Thrones", "https://play.hbogo.com/series/urn:hbo:series:GVU2cggagzYNJjhsJATwo"],

    // hulu (NOTE: this urls are not quite right, but they should work)

    ["Blindspot", "https://www.hulu.com/series/626ff449-811f-44ad-94cd-2d48c2063619"],

    ["Brooklyn Nine - Nine", "https://www.hulu.com/series/daf48b7a-6cd7-4ef6-b639-a4811ec95232"],

    ["Good Place", "https://www.hulu.com/series/f11df77f-115e-4eba-8efa-264f0ff322d0"],

    ["Lost", "https://www.hulu.com/series/466b3994-b574-44f1-88bc-63707507a6cb"],

    ["Manifest", "https://www.hulu.com/series/a1e5ed46-2704-431e-94b0-9aea1560c712"],

    ["Rookie", "https://www.hulu.com/series/1138ee62-b9d9-4561-8094-3f7cda4bbd22"],

].reduce((m, [name, url, opts]) => {
    const id = nameToId(name);
    m[id] = { name, url, opts };
    return m;
}, {});

/**
 * Max acceptable score
 */
const MAX_SCORE = 0.2;

/**
 * Routes media play/cast requests to the appropriate module
 */
class PlayerModule {
    constructor(config) {
        this.config = config;
    }

    async playTitle(title) {
        debug('requested', title);
        const given = title.toLowerCase();

        let bestScore = Number.MAX_VALUE;
        let bestTitle = null;

        for (const id of Object.keys(TITLES)) {
            const title = TITLES[id];
            const score = leven(given, title.name.toLowerCase()) / title.name.length;
            if (score < bestScore) {
                bestScore = score;
                bestTitle = title;
            }
        }

        if (bestScore > MAX_SCORE) {
            debug(`No match for ${title}; closest was ${bestTitle.name} @${bestScore}`);
            await this._playBySearch(title);
            return;
        }

        debug(`best match was ${bestTitle.name} @${bestScore}`);
        return this._play(bestTitle);
    }

    async playTitleId(id) {
        const title = TITLES[id];
        if (!title) throw new Error(`No such title: ${id}`);

        return this._play(title);
    }

    async _play(titleObj) {
        const { url, opts } = titleObj;
        debug('playing', titleObj);
        const player = await this._getPlayer();
        return player.playUrl(url, opts);
    }

    async _playBySearch(title) {
        const p = await this._getPlayer();
        const best = await pickBestMatchForTitle(
            p.queryByTitle(title),
            title,
        );
        if (!best) {
            // TODO it'd be nice if we could surface these
            // errors on the chromecast device somehow...
            throw new Error(`Couldn't find anything for ${title}`);
        }

        // NOTE: let's just trust babbling
        // // double check
        // const distance = leven(title.toLowerCase(), best.title.toLowerCase());
        // if (distance > MAX_SCORE) {
        //     debug('found', best.title, 'but had distance', distance);
        //     throw new Error(`No good match for ${title}`);
        // }

        debug('playing', best.title, 'from', best.appName);
        await p.play(best);
    }

    async _getPlayer() {
        if (this._player) return this._player;

        const p = (await PlayerBuilder.autoInflate(this.config.babblingConfigFile))
            .withApp(YoutubeApp, {
                deviceName: "Home",
                playlistsCache: {},
            })
            .addDevice(new ChromecastDevice(CHROMECAST_DEVICE))
            .build();
        this._player = p;
        return p;
    }
}

module.exports = {
    PlayerModule,
};
