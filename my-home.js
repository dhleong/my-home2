
var mdns = require('mdns')
  , expressive = require('echo-expressive')
  , wemore = require('wemore')
  , TvModule = require('./modules/lgtv')
  , PsModule = require('./modules/ps4')
  , KeepAlive = require('./keepalive')
  
  , PS4_CREDS = '/Users/dhleong/.ps4-wake.credentials.json'
  , ps4 = new PsModule(PS4_CREDS)
  , lgtv = null  // lazy init, in case it's off
  , insomniac = new KeepAlive()

  , exapp = expressive()
  , EXPRESSIVE_PORT = 54321;

var devices = {
    // NB: "playstation" gets heard as "play station"
    //  by Echo and isn't handled by the wemo stuff
    ps: wemore.Emulate({friendlyName: "PS4"})
        .on('off', function() {
            ps4.turnOff();
            console.log("Turn OFF PS4");
            insomniac.allowSleep();
        })
        .on('on', function() {
            ps4.turnOn().fail(function(err) {
                console.warn("UNABLE to turn ON PS4", err);
            });
            console.log("Turn ON PS4");
            insomniac.stayAwake();
        })

  , tv: wemore.Emulate({friendlyName: "Television"})
        .on('off', function() {
            if (!lgtv) lgtv = new TvModule();
            lgtv.handleInput(['power']);
            console.log("Turn OFF TV");

            // NB: keeping the instance cached
            //  all the time is finicky, but it
            //  seems safe to keep it around
            //  until it's turned off. We'll
            //  also assume it gets turned off
            //  whenever we lose connection to
            //  the PS4, since we don't have an
            //  explicit signal
            lgtv = null;
        })

  , flix: wemore.Emulate({friendlyName: "Netflix"})
        .on('on', function() {
            ps4.turnOn()
            .then(function(ps4) {
                ps4.start('CUSA00129');
            });
            console.log("Turn ON Netflix");
        })

}

Object.keys(devices).forEach(function(key) {
    devices[key].on('listening', function() {
        console.log("Advertising", this.friendlyName, "on", this.port);
        mdns.createAdvertisement(mdns.tcp('http'), this.port).start();
    });
});

/**
 * Ensure all media Methods are formatted correctly.
 *  Mostly just demoing the slot() middleware util
 */
exapp.slot('Method', function(req, res, next, methodName) {
    req.attr('Method', methodName.toLowerCase());
    next();
});

exapp.intent("MediaIntent", function(req, res) {
    if (!lgtv) lgtv = new TvModule();
    var method = req.attr('Method');
    switch (method) {
    case 'play':
    case 'pause':
    case 'resume':
    case 'click':
        // see above
        lgtv.handleInput(['click']);
        res.ask("Okay?");
        break;

    case 'right':
    case 'left':
    case 'up':
    case 'down':
        lgtv.handleInput([method]);
        res.ask("Okay?");
        break;

    case 'stop':
    case 'back':
        lgtv.handleInput(['back']);
        res.tell("Okay");
        break;

    case 'end':
    case 'done':
        res.tell("Done!");
        break;

    default:
        res.tell("I don't know how to " + method);
    }
});

exapp.listen(EXPRESSIVE_PORT, function() {
    mdns.createAdvertisement(mdns.tcp('http'), EXPRESSIVE_PORT).start();
});


ps4.detect().then(function(isAwake) {
    if (isAwake) {
        insomniac.stayAwake();
        ps4.connect();
    }
});

ps4.on('disconnected', function() {
    console.log("Disconnected from PS4");
    insomniac.allowSleep();
    lgtv = null;
});
