const mdns = require('mdns');
const expressive = require('echo-expressive');
const wemore = require('wemore');

const TvModule = require('./modules/lgtv');
const PsModule = require('./modules/ps4');
const KeepAlive = require('./keepalive');

const PS4_CREDS = '/Users/dhleong/.ps4-wake.credentials.json';
const ps4 = new PsModule(PS4_CREDS);
const insomniac = new KeepAlive();
let lgtv = null;  // lazy init, in case it's off

const exapp = expressive();
const EXPRESSIVE_PORT = 54321;

/** wrap a promise so failures don't crash the app */
const safely = (promise) => promise.catch(e => { console.warn(e); });

/**
 * wrap an async function with a normal function that safely
 * executes the async function (see safely)
 */
const safe = (asyncFn) => (...args) => {
    safely(asyncFn(...args));
};

async function connectPs4IfActive() {
    const isAwake = await ps4.detect();
    if (isAwake) {
        await ps4.turnOn();
        insomniac.stayAwake();
    }
}

const devices = {
    // NB: "playstation" gets heard as "play station"
    //  by Echo and isn't handled by the wemo stuff
    ps: wemore.Emulate({friendlyName: "PS4"})
        .on('off', function() {
            ps4.turnOff();
            console.log("Turn OFF PS4");
        })
        .on('on', safe(async () => {
            try {
                console.log("Turn ON PS4");
                await ps4.turnOn();

                // make sure
                insomniac.stayAwake();
            } catch (e) {
                console.warn("UNABLE to turn ON PS4", e);
            }
        })),

    tv: wemore.Emulate({friendlyName: "Television"})
        .on('off', function() {
            if (!lgtv) lgtv = new TvModule();
            lgtv.handleInput(['power']);
            console.log("Turn OFF TV");
            insomniac.allowSleep(); // if TV is off, we definitely aren't needed

            // NB: keeping the instance cached
            //  all the time is finicky, but it
            //  seems safe to keep it around
            //  until it's turned off. We'll
            //  also assume it gets turned off
            //  whenever we lose connection to
            //  the PS4, since we don't have an
            //  explicit signal
            lgtv = null;
        }),

    flix: ps4AppDevice("Netflix", 'CUSA00129'),
    atoz: ps4AppDevice("Amazon Video", 'CUSA00130'),
    tube: ps4AppDevice("Youtube", 'CUSA01015'),
    hbog: ps4AppDevice("HBO", 'CUSA01567'),

    subs: wemore.Emulate({friendlyName: "Subtitles"})
        .on('on', function() {
            if (!lgtv) lgtv = new TvModule();
            lgtv.setSubsOn(true);
            console.log("Turn ON Subtitles");
        })
        .on('off', function() {
            if (!lgtv) lgtv = new TvModule();
            lgtv.setSubsOn(false);
            console.log("Turn OFF Subtitles");
        }),
};

Object.keys(devices).forEach(function(key) {
    devices[key].on('listening', function() {
        console.log("Advertising", this.friendlyName, "on", this.port);
        mdns.createAdvertisement(mdns.tcp('http'), this.port).start();
    });
});

function ps4AppDevice(name, titleId) {
    return wemore.Emulate({friendlyName: name})
        .on('on', function() {
            ps4.turnOn()
                .then(function(ps4) {
                    connectPs4IfActive();
                    ps4.start(titleId);
                });
            console.log("Turn ON " + name);
        });
}

function askIf(res, condition, question) {
    if (condition) {
        res.ask(question + "?");
    } else {
        res.tell(question);
    }
}

/**
 * Ensure all media Methods are formatted correctly.
 *  Mostly just demoing the slot() middleware util
 */
exapp.slot('Method', function(req, res, next, methodName) {
    req.attr('Method', methodName.toLowerCase());
    next();
});

exapp.use(function(req, res, next) {
    safely(connectPs4IfActive());

    next();
});

exapp.intent("MediaIntent", function(req, res) {
    if (!lgtv) lgtv = new TvModule();
    const method = req.attr('Method');
    switch (method) {
    case 'play':
    case 'pause':
    case 'resume':
    case 'click':
        // see above
        lgtv.handleInput(['click']);

        askIf(res, method == 'click', 'Okay');
        break;

    case 'right':
    case 'left':
    case 'up':
    case 'down':
    case 'forward':
    case 'fast forward':
    case 'fast-forward':
        lgtv.handleInput([method]);
        res.ask("Okay?");
        break;

    case 'stop':
    case 'back':
        lgtv.handleInput(['back']);
        askIf(res, method == 'back', 'Okay');
        break;

    case 'end':
    case 'done':
    case 'enough':
    case 'cancel':
    case 'thats it':
        res.tell("Done!");
        break;

    default:
        res.ask("I don't know how to " + method);
    }
});

exapp.launch(function(req, res) {
    res.ask("What should I do?");
});

exapp.intent("SelectPlaystationIntent", function(req, res) {
    if (!lgtv) lgtv = new TvModule();
    lgtv.switchToPs4();
    res.ask("Okay?");
});

exapp.intent("SelectWiiIntent", function(req, res) {
    if (!lgtv) lgtv = new TvModule();
    lgtv.switchToWii();
    res.tell("Okay");
});

exapp.intent("FixAudioIntent", function(req, res) {
    if (!lgtv) lgtv = new TvModule();
    lgtv.fixAudio();
    res.tell("Okay");
});

exapp.listen(EXPRESSIVE_PORT, function() {
    mdns.createAdvertisement(mdns.tcp('http'), EXPRESSIVE_PORT).start();
});

ps4.on('connected', function() {
    console.log("Connected to PS4");
    insomniac.stayAwake();
});

ps4.on('disconnected', function() {
    console.log("Disconnected from PS4");
    insomniac.allowSleep();
    lgtv = null;
});

// go ahead and do this right away
safely(connectPs4IfActive());
