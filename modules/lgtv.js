/**
 * LG TV control module
 */

var util = require('util')
  , events = require('events')
  , Q = require('q')
  , LgServer = require('lg-control')
  , Commands = LgServer.Commands;

function LgTvModule() {
    var self = this;
    this.server = new LgServer();
    this.server.on('ready', function() {
        console.log("LG Ready");

        self.ready = true;
        self.emit('ready');
    });
}
util.inherits(LgTvModule, events.EventEmitter);

LgTvModule.prototype.handleInput = function(input) {
    var self = this;
    if (!self.ready) {
        self.once('ready', function() {
            self.handleInput(input);
        });
        return;
    }

    var cmd = input[0];
    var args = input.slice(1);
    var commandFun = this.commands[cmd];
    if (commandFun) {
        this.commands[cmd].apply(this, args);
        return Q(true);
    } else {
        return Q(false);
    }
}

LgTvModule.prototype.commands = {
    power: function() {
        this.server.command(Commands.POWER_OFF);
    }
  , back: function() {
        this.server.command(Commands.BACK);
    }
  , click: function() {
        this.server.command(Commands.ENTER);
    }
  , navigate: function(parts) {
        console.log(parts);
    }
};

['left', 'up', 'right', 'down'].forEach(function(dir) {
    LgTvModule.prototype.commands[dir] = function() {
        this.server.command(Commands.Arrow[dir.toUpperCase()]);
    };
});

module.exports = LgTvModule;
