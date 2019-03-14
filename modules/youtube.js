const {
    CredentialsBuilder,
    WatchHistory,
    YoutubePlaylist,
} = require('youtubish');

const debug = require('debug')('home:youtube');

const { createChromecastDevice } = require('./cast');

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
            const appPromise = device.openApp('youtube', {
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

        return playlist.findMostRecentlyPlayed(this._history);
    }
}

module.exports = {
    YoutubeModule,
};
