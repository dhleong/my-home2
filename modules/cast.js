const { ChromecastDevice } = require('babbling');

const CHROMECAST_DEVICE = 'Family Room TV';

function createChromecastDevice() {
    return new ChromecastDevice(CHROMECAST_DEVICE);
}

module.exports = {
    createChromecastDevice,
};
