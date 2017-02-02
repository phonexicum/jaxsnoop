'use strict';

// ====================================================================================================================
// Includes

// const Q = require('q');

// module.exports.globalAttemptsNumber = 3;

// ====================================================================================================================

// This function makes globalAttemptsNumber of calling callback until it will succeed.
// Calls of callback are made sequentially with specified delay, until first succeeded callback
// In fact this function plays role of decorator
// 
// callback - must return Q.Promise, callback is treated as succeeded if promise will success
// delay - the delay before calling next callback after fail of the previous
// 
// return - this function also returns promise and will trigger success if any attempt of calling callback will succeed
// 

// module.exports.AttemptsLauncher = function AttemptsLauncher(callback, delay) {

//     var promise = callback();

//     for (var i = 0; i < module.exports.globalAttemptsNumber; i++) {
//         promise = promise.fail((err) => {
//             return Q.Promise((res, rej) => {
//                 setTimeout(() => {
//                     callback().then((mes) => {res(mes);}, (err) => {rej(err);});
//                 }, delay);
//             });
//         });
//     }
//     return promise;
// };

// ====================================================================================================================
