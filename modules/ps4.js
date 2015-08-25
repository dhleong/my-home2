
var util = require('util')
  , events = require('events')
  , Q = require('q')
  , Waker = require('ps4-waker')
  , Detector = Waker.Detector
  , newSocket = Waker.Socket

  , DETECT_TIMEOUT = 5000
  , WAKE_TIMEOUT = 5000;

function PsModule(credentials) {
    this.socket = null;
    this.waker = new Waker(credentials);
}
util.inherits(PsModule, events.EventEmitter);

PsModule.prototype.connect = function() {
    console.log("connect()");
    var self = this;
    return this._detect()
    .then(function(result) {
        var deferred = Q.defer();
        self.waker.readCredentials(function(err, creds) {
            if (err) {
                console.error("No credentials found");
                process.exit(1);
                return;
            }

            console.log("Connecting to PS4...");
            var rinfo = result.rinfo;
            self.socket = newSocket({
                accountId: creds['user-credential']
              , host: rinfo.address
              , pin: '' // assume it's already handled by ps4-waker binary
            }).on('connected', function() {
                console.log("Connected to PS4");
            }).on('ready', function() {
                console.log("PS4 connection ready");
                deferred.resolve(self);
            }).on('login_result', function(result) {
                console.log("Login result", result);
            }).on('error', function(err) {
                console.error('Unable to connect to PS4 at', 
                    rinfo.address, err);
                deferred.reject(err);
            }).on('disconnected', function() {
                console.log("Lost connection");
                self.socket = null;
                self.emit('disconnected', self);
            });

            return deferred.promise;
        });
    });
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
        console.log("No socket; connecting before requesting standby");
        this.connect().then(doRequestStandby);
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
        self.waker.wake(WAKE_TIMEOUT, function(err) {
            console.log("Wake result", err);
            if (err) return reject(err);

            self.connect()
            .then(function() {
                resolve(self);
            })
            .fail(function(err) {
                reject(err);
            });
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
