
/** wrap a promise so failures don't crash the app */
const safely = (promise) => promise.catch(e => { console.warn(e); });

/**
 * wrap an async function with a normal function that safely
 * executes the async function (see safely)
 */
const safe = (asyncFn, ...extraArgs) => (...args) => {
    safely(asyncFn(...args, ...extraArgs));
};

module.exports = {
    safely,
    safe,
};
