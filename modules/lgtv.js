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

    var cmd = input[0].replace(/[ -]/g, '_');
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
  , forward: function() {
        this.server.command(Commands.Arrow.RIGHT)
                   .command(Commands.Arrow.RIGHT)
                   .command(Commands.Arrow.RIGHT)
                   .command(Commands.Arrow.RIGHT);
    }
  , fast_forward: function() {
        this.server.command(Commands.Arrow.RIGHT)
                   .command(Commands.Arrow.RIGHT)
                   .command(Commands.Arrow.RIGHT)
                   .command(Commands.Arrow.RIGHT);
    }
};

['left', 'up', 'right', 'down'].forEach(function(dir) {
    LgTvModule.prototype.commands[dir] = function() {
        this.server.command(Commands.Arrow[dir.toUpperCase()]);
    };
});

LgTvModule.prototype.switchToWii = function() {
    this.server.command(Commands.INPUTS)
               .command(Commands.Arrow.RIGHT)
               .command(Commands.Arrow.RIGHT)
               .command(Commands.ENTER);
}

LgTvModule.prototype.switchToPs4 = function() {
    this.server.command(Commands.INPUTS)
               .command(Commands.Arrow.LEFT)
               .command(Commands.Arrow.LEFT)
               .command(Commands.ENTER);
}

LgTvModule.prototype.setSubsOn = function(subsOn) {
    this.server.command(Commands.Arrow.DOWN)
               .command(Commands.Arrow.DOWN)
               .command(Commands.ENTER)
               .command(Commands.Arrow.RIGHT)
               .command(subsOn 
                       ? Commands.Arrow.DOWN
                       : Commands.Arrow.UP)
               .command(Commands.ENTER)
               .command(Commands.BACK)
               .command(Commands.BACK);
}

module.exports = LgTvModule;
