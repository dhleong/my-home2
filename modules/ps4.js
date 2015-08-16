
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

            var rinfo = result.rinfo;
            self.socket = newSocket({
                accountId: creds['user-credential']
              , host: rinfo.address
              , pin: '' // assume it's already handled by ps4-waker binary
            }).on('ready', function() {
                deferred.resolve(self);
            }).on('error', function(err) {
                console.error('Unable to connect to PS4 at', 
                    rinfo.address, err);
                deferred.reject(err);
            }).on('disconnected', function() {
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
    if (!this.socket) {
        return;
    }

    this.socket.requestStandby(function(err) {
        console.log("Requested standby:", err);
    });
    this.socket = null;
}


PsModule.prototype.turnOn = function() {
    if (this.socket) {
        // already on
        return Q(this);
    }

    return Q.Promise(function(resolve, reject) {
        var self = this;
        this.waker.wake(WAKE_TIMEOUT, function(err) {
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
        return result.device.status.toUpperCase() == "OK"
    });
}

PsModule.prototype._detect = function() {
    return Q.Promise(function(resolve, reject) {
        Detector.findAny(DETECT_TIMEOUT, function(err, device, rinfo) {
            if (err) return reject(err);

            resolve({device: device, rinfo: rinfo});
        });
    });
}

module.exports = PsModule;
