
var spawn = require('child_process').spawn
  , OSX = process.platform == 'darwin'


/**
 * Module for keeping the machine awake
 *  and connections active
 */

function KeepAlive() {
    this.isAwake = false;
}

KeepAlive.prototype.stayAwake = function() {
    if (this.isAwake) return;

    if (OSX) {
        this.isAwake = true;
        this.proc = spawn('caffeinate', ['-is']);
    }
}

KeepAlive.prototype.allowSleep = function() {
    if (!this.isAwake) return;

    if (OSX) {
        this.isAwake = false;
        this.proc.kill();
    }
}

module.exports = KeepAlive
