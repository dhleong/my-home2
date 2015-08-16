#!/usr/bin/env node

if (process.platform == 'darwin'
      && 'now' != process.argv[2]) {

    var Service = require('node-mac').Service;

    var svc = new Service({
        name: 'MyHome',
        description: 'My Smarthome server',
        script: require('path').join(__dirname, 'my-home.js'),
        cwd: __dirname
    });

    svc.on('install', function() {
        console.log("MyHome starting");
        svc.start();
    })
    .on('uninstall', function() {
        console.log("MyHome uninstalled");
    })
    .on('error', function(e) {
        console.log(e);
    });

    var command = process.argv[2] || 'restart';

    switch (command) {
    case "restart":
        svc.stop(); // jshint ignore:line
        // fallthrough
    case "start":
        svc.install();
        break;

    case "stop":
        console.log("Stopping service...");
        svc.uninstall();
        break;
    }
} else {
    require("./my-home");
}
