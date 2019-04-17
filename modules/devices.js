const EventEmitter = require("events").EventEmitter;
const wemore = require("wemore");

const debug = require("debug")("home:devices");

const { safe } = require('../util');

class DevicesModule {
    constructor(devices) {
        this.devices = devices;

        this.createBinaryDevice("lights", async state => {
            const d = await wemore.Discover("Lights");
            await d.setBinaryState(state === "on");
        });

        this.createGroup("living-room", [
            "ps",
            "tv",
            "lights",
        ]);
    }

    setState(deviceId, state) {
        if (state !== "on" && state !== "off") {
            throw new Error(`Invalid state ${state}`);
        }

        const device = this.devices[deviceId];
        if (!device) throw new Error(`No such device ${deviceId}`);

        debug(`set state (${deviceId}) <- ${state}`);
        device.emit(state);
    }

    createBinaryDevice(id, action) {
        if (this.devices[id]) {
            throw new Error(`Duplicate device id ${id}`);
        }

        const device = new EventEmitter();
        device.on("on", safe(action, "on"));
        device.on("off", safe(action, "off"));
        this.devices[id] = device;
    }

    createGroup(id, deviceIds) {
        this.createBinaryDevice(id, async state => {
            for (const memberId of deviceIds) {
                this.setState(memberId, state);
            }
        });
    }
}

module.exports = { DevicesModule };
