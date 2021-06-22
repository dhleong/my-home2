#!/usr/bin/env node

const fs = require('fs');

if (
    process.platform === 'darwin'
    && 'now' !== process.argv[2]
) {

    var Service = require('node-mac').Service;

    var svc = new Service({
        name: 'MyHome',
        description: 'My Smarthome server',
        script: require('path').join(__dirname, 'my-home.js'),
        cwd: __dirname,
        env: [{
            name: "PROJECT_ROOT",
            value: __dirname,
        }, {
            name: "DEBUG",
            value: 'home:*,shougun:*',
        }, {
            name: "FFPROBE_PATH",
            value: "/usr/local/bin/ffprobe"
        }, {
            name: "FFMPEG_PATH",
            value: "/usr/local/bin/ffmpeg"
        }],
    });

    svc.on('install', function() {
        console.log("MyHome starting");
        svc.start();
    }).on('uninstall', function() {
        console.log("MyHome uninstalled");
    }).on('error', function(e) {
        console.log(e);
    });

    var command = process.argv[2] || 'restart';

    switch (command) {
    case "restart":
        fs.mkdirSync('/Library/Logs/MyHome', { recursive: true });

        console.log("Stopping service, and ...");
        svc.stop();
        svc.uninstall();

        setTimeout(() => {
            console.log("... restarting...");
            svc.install();
        }, 250);
        break;

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
