const mdns = require('mdns');
const wemore = require('wemore');
const createUuid = require('uuid/v5');

const { loadConfig } = require('./modules/config');
const TvModule = require('./modules/lgtv');
const PsModule = require('./modules/ps4');

const { DevicesModule } = require('./modules/devices');
const { PlayerModule } = require('./modules/player');
const { HttpModule } = require('./modules/http');
const KeepAlive = require('./keepalive');

const { safely, safe } = require('./util');

const config = loadConfig();

const ps4 = new PsModule(config.ps4Creds);
const player = new PlayerModule(config);
const insomniac = new KeepAlive();
let lgtv = null;  // lazy init, in case it's off

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
    ps: emulateDeviceWithName("PS4")
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

    tv: emulateDeviceWithName("Television")
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

    subs: emulateDeviceWithName("Subtitles")
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
    return emulateDeviceWithName(name)
        .on('on', function() {
            ps4.turnOn()
                .then(function(ps4) {
                    connectPs4IfActive();
                    ps4.start(titleId);
                });
            console.log("Turn ON " + name);
        });
}

function emulateDeviceWithName(name) {
    const uuid = createUuid(name, config.uuidNamespace);
    console.log("Creating", name, "=>", uuid);
    return wemore.Emulate({
        friendlyName: name,
        uuid,
    });
}

ps4.on('connected', function() {
    console.log("Connected to PS4");
    insomniac.stayAwake();
});

ps4.on('disconnected', function() {
    console.log("Disconnected from PS4");
    insomniac.allowSleep();
    lgtv = null;
});

const devicesModule = new DevicesModule(devices);
const http = new HttpModule(config, player, devicesModule);

http.start();

// go ahead and do this right away
safely(connectPs4IfActive());
