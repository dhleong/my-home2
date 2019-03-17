const {
    CredentialsBuilder,
    WatchHistory,
    YoutubePlaylist,
} = require('youtubish');

const debug = require('debug')('home:youtube');

const { createChromecastDevice } = require('./cast');
const { YoutubeApp } = require('babbling');

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
        this._playlists = {};
    }

    async resumePlaylist(id) {
        if (!this._playlists[id]) {
            this._playlists[id] = new YoutubePlaylist(
                this.creds, id,
            );
        }

        const device = createChromecastDevice();
        debug('resume', id);

        try {
            // start the app *first* so we feel more responsive
            const appPromise = device.openApp(YoutubeApp, {
                cookies: (await this.creds).cookies,
                deviceName: 'Home',
            });

            const itemPromise = this._findPlaylistItemToResume(id);

            // do both things in parallel; opening the app will probably
            // be way faster than fetching the item anyway, but... might as well!
            const [ app, item ] = await Promise.all([appPromise, itemPromise]);

            debug('play', item);

            await app.play(item.id, {
                listId: id,
            });

            debug('done!');

        } finally {
            device.close();
        }
    }

    async _findPlaylistItemToResume(id) {
        debug(`resumePlaylist(${id}): fetching history`);
        const playlist = this._playlists[id];
        if (!playlist) throw new Error(`No such playlist: ${id}`);

        // NOTE: just always use a fresh WatchHistory so we're not
        // looking at old data when trying to find the
        // most-recently-played. If we had multiple playlists, we could
        // potentially try to cache this for some minor wins, but the
        // complexity just isn't worth it
        return playlist.findMostRecentlyPlayed(
            new WatchHistory(this.creds),
        );
    }
}

module.exports = {
    YoutubeModule,
};
