
const { EventEmitter } = require('events');
const { Device } = require('ps4-waker');

class PsModule extends EventEmitter {

    constructor(credentials) {
        super();

        this.device = new Device({
            credentials,
        });
    }

    /**
     * Search for a PS4
     * @return a Promise that resolves to a boolean
     *  where "true" means the device is awake, and
     *  "false" means it's in standby.
     */
    async detect() {
        const status = await this.device.getDeviceStatus();
        return status.status.toUpperCase() === 'OK';
    }

    start(titleId) {
        return this.device.startTitle(titleId);
    }

    turnOff() {
        return this.device.turnOff();
    }

    turnOn() {
        return this.device.turnOn();
    }

}

module.exports = PsModule;
