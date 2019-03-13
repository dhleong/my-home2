#!/usr/bin/env node

const { ChromecastDevice } = require('babbling');
const {
    CredentialsBuilder,
    WatchHistory,
    YoutubePlaylist,
} = require('youtubish');

const debug = require('debug')('home:youtube');

const CHROMECAST_DEVICE = 'Family Room TV';

const PLAYLISTS = {
    'critical-role': 'PL1tiwbzkOjQz7D0l_eLJGAISVtcL7oRu_',
};

class YoutubeModule {

    /**
     * We use HTTP creds to scrape the watch history
     * and an API key to pull playlist data (
     */
    constructor(config) {
        const creds = new CredentialsBuilder()
            .apiKey(config.youtubeApiKey)
            .cookiesFromCurlFile(config.youtubeCurlFile)
            .build();

        this.creds = creds;
        this._history = new WatchHistory(creds);
        this._playlists = {};

        for (const key of Object.keys(PLAYLISTS)) {
            this._playlists[key] = new YoutubePlaylist(
                creds, PLAYLISTS[key],
            );
        }
    }

    async resumePlaylist(key) {
        const device = new ChromecastDevice(CHROMECAST_DEVICE);
        debug('resume', key);

        try {
            // start the app *first* so we feel more responsive
            const appPromise = device.openApp('youtube', {
                cookies: (await this.creds).cookies,
                deviceName: 'Home',
            });

            const itemPromise = this._findPlaylistItemToResume(key);

            // do both things in parallel; opening the app will probably
            // be way faster than fetching the item anyway, but... might as well!
            const [ app, item ] = await Promise.all([appPromise, itemPromise]);

            debug('play', item);

            await app.play(item.id, {
                listId: PLAYLISTS[key],
            });

            debug('done!');

        } finally {
            device.close();
        }
    }

    async _findPlaylistItemToResume(key) {
        debug(`resumePlaylist(${key}): fetching history`);
        const playlist = this._playlists[key];
        if (!playlist) throw new Error(`No such playlist: ${key}`);

        return playlist.findMostRecentlyPlayed(this._history);
    }
}

module.exports = {
    YoutubeModule,
};
