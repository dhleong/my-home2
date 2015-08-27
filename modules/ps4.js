
var util = require('util')
  , events = require('events')
  , Q = require('q')
  , Waker = require('ps4-waker')
  , Detector = Waker.Detector

  , DETECT_TIMEOUT = 5000
  , WAKE_TIMEOUT = 5000;

function PsModule(credentials) {
    this.socket = null;
    this.credentials = credentials;
}
util.inherits(PsModule, events.EventEmitter);

PsModule.prototype.waker = function() {
    return new Waker(this.credentials, {
        keepSocket: true
      , errorIfAwake: false
    }).on('need-credentials', function(d) {
        console.log("NEED CREDS!?", d);
    }).on('device-notified', function(d) {
        console.log("Sent WAKEUP to", d);
    }).on('logging-in', function(d) {
        console.log("Logging into", d);
    });
}

PsModule.prototype.connect = function() {
    return this.turnOn();
}

PsModule.prototype.start = function(titleId) {
    if (!this.socket) {
        throw new Error("PsModule not connected");
    }

    var self = this;
    return Q.Promise(function(resolve, reject) {
        self.socket.startTitle(titleId, function(err) {
            if (err) return reject(err);
            resolve(self);
        });
    });
}

PsModule.prototype.turnOff = function() {

    var self = this;
    var doRequestStandby = function() {
        console.log("Requesting standby...");
        self.socket.requestStandby(function(err) {
            console.log("Requested standby:", err);
            self.socket = null;
        });
    }

    if (this.socket) {
        doRequestStandby();
    } else {
        console.log("No socket; checking status");
        this.detect().then(function(isAlive) {
            if (isAlive) {
                console.log("PS4 is awake; connecting before requesting standby");
                return this.turnOn().then(doRequestStandby);
            } else {
                console.log("PS4 is already asleep!");
            }
        });
    }

}


PsModule.prototype.turnOn = function() {
    if (this.socket) {
        // already on
        console.log("PS4 Already on");
        return Q(this);
    }

    var self = this;
    return Q.Promise(function(resolve, reject) {
        console.log("Calling waker");
        self.waker().wake(WAKE_TIMEOUT, function(err, socket) {
            console.log("Wake result", err);
            if (err) return reject(err);
            if (!socket) return reject(new Error("No socket"));

            socket.on('connected', function() {
                console.log("Acquired connection");
                self.emit('connected', self);
            }).on('ready', function() {
                console.log("PS4 connection ready");
            }).on('login_result', function(result) {
                console.log("Login result", result);
            }).on('login_retry', function() {
                console.log("Retrying login");
            }).on('error', function(err) {
                console.error('PS4 Socket Error', err);
            }).on('disconnected', function() {
                console.log("Lost connection");
                self.socket = null;
                self.emit('disconnected', self);
            });

            self.socket = socket;
            resolve(self);

            // self.connect()
            // .then(function() {
            //     resolve(self);
            // })
            // .fail(function(err) {
            //     reject(err);
            // });
        });
    });
}


/**
 * Search for a PS4
 * @return a Promise that resolves to a boolean
 *  where "true" means the device is awake, and
 *  "false" means it's in standby.
 */
PsModule.prototype.detect = function() {
    return this._detect().then(function(result) {
        console.log("PS4 Detect result:", result);
        return result.device.status.toUpperCase() == "OK"
    });
}

PsModule.prototype._detect = function() {
    console.log("_detect()");
    return Q.Promise(function(resolve, reject) {
        Detector.findAny(DETECT_TIMEOUT, function(err, device, rinfo) {
            if (err) return reject(err);

            resolve({device: device, rinfo: rinfo});
        });
    });
}

module.exports = PsModule;
