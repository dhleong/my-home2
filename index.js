#!/usr/bin/env node

const fs = require('fs');

function onServiceAsPromise(svc, method) {
    return new Promise((resolve, reject) => {
        svc.once("error", reject);
        svc.once(method, () => {
            svc.removeListener("error", reject);
            resolve();
        });
        svc[method]();
    });
}

async function startServiceMacos() {
    const Service = require('node-mac').Service;

    const svc = new Service({
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
        fs.mkdirSync('/Library/Logs/MyHome', { recursive: true });
        svc.start();
    }).on('uninstall', function() {
        console.log("MyHome uninstalled");
    }).on('error', function(e) {
        console.log(e);
    });

    var command = process.argv[2] || 'restart';

    fs.mkdirSync('/Library/Logs/MyHome', { recursive: true });

    switch (command) {
    case "restart":
        console.log("Stopping service, and ...");
        await onServiceAsPromise(svc, "stop");
        await onServiceAsPromise(svc, "uninstall");

        console.log("... restarting...");
        fs.mkdirSync('/Library/Logs/MyHome', { recursive: true });
        await onServiceAsPromise(svc, "install");
        break;

    case "start":
        await onServiceAsPromise(svc, "install");
        break;

    case "stop":
        console.log("Stopping service...");
        await onServiceAsPromise(svc, "uninstall");
        break;
    }
}

if (
    process.platform === 'darwin'
    && 'now' !== process.argv[2]
) {
    startServiceMacos()
        .then(() => console.log("Done!"))
        .catch(e => { throw e; });
} else {
    require("./my-home");
}
