const debug = require('debug')('home:player');
const leven = require('leven');

function youtubePlaylist(id) {
    return (module) => {
        return module._yt.resumePlaylist(id);
    };
}

function huluSeries(id) {
    return (module) => {
        return module._hulu.resumeSeries(id);
    };
}

const TITLES = {
    'critical-role': {
        name: 'Critical Role',
        play: youtubePlaylist('PL1tiwbzkOjQz7D0l_eLJGAISVtcL7oRu_'),
    },

    // hulu

    'brooklyn-nine-nine': {
        name: 'Brooklyn Nine-Nine',
        play: huluSeries('daf48b7a-6cd7-4ef6-b639-a4811ec95232'),
    },

    lost: {
        name: 'Lost',
        play: huluSeries('466b3994-b574-44f1-88bc-63707507a6cb'),
    },

    rookie: {
        name: 'Rookie',
        play: huluSeries('1138ee62-b9d9-4561-8094-3f7cda4bbd22'),
    },
};

/**
 * Max acceptable score
 */
const MAX_SCORE = 5;

/**
 * Routes media play/cast requests to the appropriate module
 */
class PlayerModule {
    constructor(hulu, yt) {
        this._hulu = hulu;
        this._yt = yt;
    }

    async playTitle(title) {
        debug('requested', title);
        const given = title.toLowerCase();

        let bestScore = Number.MAX_VALUE;
        let bestTitle = null;

        for (const id of Object.keys(TITLES)) {
            const title = TITLES[id];
            const score = leven(given, title.name.toLowerCase());
            if (score < bestScore) {
                bestScore = score;
                bestTitle = title;
            }
        }

        if (bestScore > MAX_SCORE) {
            throw new Error(`No match for ${title}; closest was ${bestTitle.name} @${bestScore}`);
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
        const { name, play } = titleObj;
        debug('playing', name);
        return play(this);
    }
}

module.exports = {
    PlayerModule,
};
