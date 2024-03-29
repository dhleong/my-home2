#!/usr/bin/env node

const fs = require('fs');
const { EventEmitter } = require('stream');
const execFile = require('util').promisify(require('child_process').execFile);

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

function createService(config) {
    // NOTE: This lib is quite janky. We should probably replace it, but for now we
    // monkey patch certain methods that are not robust
    const Service = require('node-mac').Service;
    const original = new Service(config);

    // NOTE: We have to go through some quite *extra* work to monkey-patch,
    // since some properties are mysteriously not enumerable, and most are
    // not writable (although some are...?!)
    const patched = new Proxy(new EventEmitter(), {
        get(target, prop, receiver) {
            // Some properties are mysteriously not enumerable...
            return target[prop] ?? original[prop];
        },
    });

    patched.stop = async (callback) => {
        await execFile('launchctl', ['unload', patched.plist]);
        patched.emit('stop');
        callback && callback();
    };

    return patched;
}

async function startServiceMacos() {
    const svc = createService({
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

    const LOG_DIR = '/Library/Logs/MyHome';
    fs.mkdirSync(LOG_DIR, { recursive: true });

    switch (command) {
    case "restart":
        console.log("Stopping service, and ...");
        // NOTE: node-mac will throw an error when we try to stop() if the log file
        // doesn't exist, so we do it ourselves...
        await onServiceAsPromise(svc, "stop");

        // Delete the log dir so node-mac doesn't try to do that itself (and potentially fail)
        console.log("... uninstalling, and ...");
        fs.rmdirSync(LOG_DIR, { recursive: true, force: true });
        await onServiceAsPromise(svc, "uninstall");

        console.log("... restarting...");
        fs.mkdirSync(LOG_DIR, { recursive: true });
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
        .catch(e => {
            console.error(e);
            process.exit(1);
        });
} else {
    require("./my-home");
}
