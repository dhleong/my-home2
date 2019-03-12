#!/usr/bin/env node

const fs = require('fs-extra');
const request = require('request-promise-native');
const { ChromecastDevice } = require('babbling');
const debug = require('debug')('youtube');

const CHROMECAST_DEVICE = 'Family Room TV';

const HISTORY_URL = 'https://www.youtube.com/feed/history';
const PLAYLIST_ENDPOINT = 'https://www.googleapis.com/youtube/v3/playlistItems';

// using this agent triggers Google to return some JSON we can consume
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.121 Safari/537.36';

const PLAYLISTS = {
    'critical-role': 'PL1tiwbzkOjQz7D0l_eLJGAISVtcL7oRu_',
};

function extractJSON(html) {
    const result = html.match(/window\["ytInitialData"\] = (\{.+\});$/m);
    if (!result) {
        // save so we can test
        fs.writeFile('youtube.html', html);
        throw new Error('No match; format must have changed?');
    }

    const [, rawJson] = result;
    return JSON.parse(rawJson);
}

function findTabContents(json, tabId) {
    const tabs = json.contents.twoColumnBrowseResultsRenderer.tabs;
    const tab = tabs.find(tab => tab.tabRenderer.tabIdentifier === tabId);

    return tab.tabRenderer.content.sectionListRenderer
        .contents[0].itemSectionRenderer.contents;
}

function scrapeWatchHistory(html) {
    const json = extractJSON(html);

    const items = findTabContents(json, 'FEhistory');

    return items.map(({videoRenderer: renderer}) => ({
        title: renderer.title.simpleText,
        desc: renderer.descriptionSnippet
            ? renderer.descriptionSnippet.simpleText
            : '',
        id: renderer.videoId,
    }));
}

class YoutubeModule {

    /**
     * We use HTTP creds to scrape the watch history
     * and an API key to pull playlist data (
     */
    constructor(config) {
        this.apiKey = config.youtubeApiKey;
        this.credsFile = config.youtubeCurlFile;

        this.playlistContents = {
            // should look like:
            //  key: {
            //      items: [],
            //      cursor: '',
            //  },
        };
    }

    async resumePlaylist(key) {
        const device = new ChromecastDevice(CHROMECAST_DEVICE);
        debug('resume', key);

        try {
            // start the app *first* so we feel more responsive
            const appPromise = device.openApp('youtube', {
                cookies: await this._readCookies(),
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
        const history = await this.loadWatchHistory();

        debug(` - got history; checking each playlist item`);
        let found;
        for (const historyItem of history) {
            found = await this._forEachPlaylistItem(key, async (item) => {
                if (historyItem.id === item.id) {
                    debug(` - found item!`, item.title);
                    return item;
                }
            });

            if (found) break;
        }

        if (!found) {
            throw new Error(`Couldn't find next episode for ${key}`);
        }

        return found;
    }

    /**
     * Iterate over playlist items for the given playlist key,
     * using the provided async callback fn; if that callback
     * resolves to a truthy value, we stop iterating and return 
     * that value.
     */
    async _forEachPlaylistItem(key, cb) {
        const existing = this.playlistContents[key];
        let cursor;
        let firstPage = false;
        if (existing) {
            cursor = existing.cursor;

            for (const item of existing.items) {
                const result = await cb(item);
                if (result) return result;
            }

            debug(`[${key}]: cb not matched in existing ${existing.items.length} items...`);
        } else {
            firstPage = true;
        }

        // still not done?
        while (firstPage || (cursor && cursor.length)) {
            debug(`[${key}]: fetch next page; cursor=${cursor}`);
            firstPage = false;
            const newItems = await this._fetchPlaylistPageByKey(key, cursor);

            for (const item of newItems) {
                const result = await cb(item);
                if (result) return result;
            }

            cursor = this.playlistContents[key].cursor;
        }

        // never found it :(
        return false;
    }

    /** returns the new items */
    async _fetchPlaylistPageByKey(key, cursor) {
        const id = PLAYLISTS[key];
        if (!id) throw new Error(`No such playlist ${key}`);

        const json = await request.get({
            url: PLAYLIST_ENDPOINT,
            json: true,
            qs: {
                key: this.youtubeApiKey,
                maxResults: 50,
                part: 'snippet',
                playlistId: id,
                pageToken: cursor,
            },
        });

        const newCursor = json.nextPageToken;
        const items = json.items.map(({snippet}) => ({
            id: snippet.resourceId.videoId,
            title: snippet.title,
        }));

        const contents = this.playlistContents[key] || {
            items: [],
        };
        this.playlistContents[key] = contents;

        contents.items = contents.items.concat(items);
        contents.cursor = newCursor;
        debug(`fetched ${items.length} items; newCursor = ${newCursor}`);

        return items;
    }

    async loadWatchHistory() {
        const html = await this._requestHtml(HISTORY_URL);
        return scrapeWatchHistory(html);
    }

    async _requestHtml(url) {
        const cookies = await this._readCookies();
        return request({
            url,
            headers: {
                Cookie: cookies,
                'User-Agent': USER_AGENT,
            },
        });
    }

    async _readApiKey() {
        const buffer = await fs.readFile(this.keyFile);
        return buffer.toString().trim();
    }

    async _readCookies() {
        if (this._cookies) return this._cookies;

        const buf = await fs.readFile(this.credsFile);
        const rawCurl = buf.toString();

        const [ , cookies ] = rawCurl.match(/'cookie: (.*?)'/);
        this._cookies = cookies;
        return cookies;
    }
}

module.exports = {
    YoutubeModule,
};

// new YoutubeModule(
//     '/Users/dhleong/git/my-home2/yt.key',
//     '/Users/dhleong/git/my-home2/yt.curl.txt'
// )
//     .resumePlaylist('critical-role')
//     .then(it => console.log(it));
