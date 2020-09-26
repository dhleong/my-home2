const debug = require('debug')('home:player');
const fs = require('fs');

const {
    ChromecastDevice, PlayerBuilder, YoutubeApp,
} = require('babbling');

const { ShougunBuilder } = require("shougun");
const { CredentialsBuilder, WatchHistory, YoutubePlaylist } = require("youtubish");
const {
    OauthCredentialsManager,
} = require("youtubish/dist/creds");

const leven = require('leven');

const CHROMECAST_DEVICE = 'Family Room TV';

function nameToId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/, "-");
}

const TITLES = [

    // Youtube

    // NOTE: `skip` is a special parameter; we use it here to never try
    // to resume the "Search for Grog" one-shot (for now) since I'm
    // watching that on my own while my wife is catching up much
    // earlier in the campaign.
    ["Critical Role", "https://www.youtube.com/playlist?list=PL1tiwbzkOjQz7D0l_eLJGAISVtcL7oRu_&skip=hi5pEHs76TE"],

    [
        ["Campaign Two", "Campaign 2"],
        null,  // no url, only fn:
        { fn: findCampaignTwoEpisode},
    ],

    [
        ["Workout", "A workout"], // aliases
        "https://www.youtube.com/playlist?list=PLw6X_oq5Z8kmISsoG_HYn_WxcOKJDLO9V",
        {resume: false}, // never resume the workout playlist!
    ],

    [
        // also aliased to "my campaign" because that's what I keep thinking I set up,
        // and this always goes there anyway
        ["my campaign", "my queue", "MyQ"], // google is... stupid
        "https://www.youtube.com/playlist?list=WL&index=0",
    ],

    [
        ["my watch later", "my watch later playlist"],
        // NOTE: skip the first three; those are long-running series kept in
        // my watch later for tracking, and not what I want to play when I
        // request this playlist
        "https://www.youtube.com/playlist?list=WL&index=3",
    ],

    // hbo

    ["Game of Thrones", "https://play.hbogo.com/series/urn:hbo:series:GVU2cggagzYNJjhsJATwo"],

    // amazon

    // this is super ambiguous, sadly:
    [
        ["House", "Haus"],  // yes, Google hears "Haus" instead of "House"
        "https://www.amazon.com/gp/video/detail/B000W0H3DK",
    ],

    // the default finds something else right now...
    ["Eureka", "https://www.amazon.com/gp/video/detail/B000U6BT40"],

    //
    // hulu (NOTE: some of these urls are not quite right, but they should work
    //

    // weird alias for "Abby's" in the way Google actually hears it (for whatever reason)
    ["a bee ' s", "https://www.hulu.com/series/abbys-e41c66f8-cc43-4eff-855e-94b2fc81ea86"],

    ["Blindspot", "https://www.hulu.com/series/626ff449-811f-44ad-94cd-2d48c2063619"],

    ["Brooklyn Nine - Nine", "https://www.hulu.com/series/daf48b7a-6cd7-4ef6-b639-a4811ec95232"],

    ["Good Place", "https://www.hulu.com/series/f11df77f-115e-4eba-8efa-264f0ff322d0"],

    ["Lost", "https://www.hulu.com/series/466b3994-b574-44f1-88bc-63707507a6cb"],

    ["Manifest", "https://www.hulu.com/series/a1e5ed46-2704-431e-94b0-9aea1560c712"],

    ["Rookie", "https://www.hulu.com/series/1138ee62-b9d9-4561-8094-3f7cda4bbd22"],

].reduce((m, [name, url, opts]) => {
    const names = Array.isArray(name)
        ? name
        : [name];

    for (const n of names) {
        const id = nameToId(n);
        m[id] = { name: n, url, opts };
    }

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
        console.log(TITLES);

        // go ahead and eagerly init shougun so the remote works
        this._getShougun().then(() => {
            debug('shougun ready');
        });
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

    async showRecommendations() {
        const s = await this._getShougun();
        return s.showRecommendations();
    }

    async _play(titleObj) {
        const { name, url, opts } = titleObj;
        debug('playing', titleObj);
        const player = await this._getPlayer();
        try {
            if (!url && opts.fn) {
                return await opts.fn(this.config, player);
            }

            await player.playUrl(url, opts);
        } catch (e) {
            const s = await this._getShougun();
            s.context.player.showError(e,
                `Unable to play ${name}`,
            );
            throw e;
        }
    }

    async _playBySearch(title) {
        const s = await this._getShougun();
        const media = await s.findMedia(title);
        if (media) {
            debug("playing", media);
            await s.play(media);
            return;
        }

        throw new Error(`Couldn't find anything for ${title}`);
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

    async _getShougun() {
        if (this._shougun) return this._shougun;

        const s = await ShougunBuilder.create()
            .playOnNamedChromecast(CHROMECAST_DEVICE)
            .includeBabblingMedia({
                configPath: this.config.babblingConfigFile,
            })
            .scanFolder(this.config.shougunMoviesDir)
            .trackInSqlite(this.config.shougunDb)
            .matchByPhonetics()
            .enableRemote()
            .enableLenderMode()
            .build();
        this._shougun = s;
        return s;
    }
}

async function findCampaignTwoEpisode(config, player) {
    const creds = youtubeCreds(config);

    // critical role c2:
    const playlistId = "PL1tiwbzkOjQxD0jjAE7PsWoaCrs0EkBH2";
    const playlist = new YoutubePlaylist(creds, playlistId);
    const history = new WatchHistory(creds);

    const mostRecent = await playlist.findMostRecentlyPlayed(history, 1000);

    if (!mostRecent) {
        throw new Error("Couldn't find most recent CR episode");
    }

    debug("MOST RECENT=", mostRecent);
    const url = `https://www.youtube.com/playlist?list=${playlistId}&v=${mostRecent.id}`;
    debug("PLAYING", url);
    return player.playUrl(url);
}

function youtubeCreds(config) {
    const json = JSON.parse(fs.readFileSync(config.babblingConfigFile).toString());

    return new OauthCredentialsManager(
        json.YoutubeApp,
    );
}

module.exports = {
    PlayerModule,
};
