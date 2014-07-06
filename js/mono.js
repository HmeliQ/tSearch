/**
 * Created by Anton on 21.06.2014.
 *
 * Mono cross-browser engine.
 */
var mono = function (env) {
    var mono = function() {
        // mono like console.log
        var args = Array.prototype.slice.call(arguments);
        args.unshift(mono.pageId,'monoLog:');
        console.log.apply(console, args);
    };

    var defaultId = 'monoScope';
    var addon;
    if (typeof window === 'undefined') {
        mono.isModule = true;
        mono.isFF = true;
        addon = env;
    } else {
        if (window.chrome !== undefined) {
            mono.isChrome = true;
            if (window.chrome.app.getDetails().app !== undefined) {
                mono.isChromeApp = true;
            }
        } else
        if (window.opera !== undefined) {
            mono.isOpera = true;
        } else {
            addon = window.addon || window.self;
            if (addon !== undefined && addon.port !== undefined) {
                mono.isFF = true;
            } else
            if (navigator.userAgent.indexOf('Firefox') !== -1) {
                mono.isFF = true;
                mono.noAddon = true;
            }

        }
    }
    mono.messageStack = 50;
    mono.addon = addon;
    mono.pageId = defaultId;
    mono.debug = {
        messages: false
    };

    var messagesEnable = false;
    var serviceList = {};

    var externalStorage = {
        get: function(src, cb) {
            mono.sendMessage({action: 'get', data: src}, cb, 'monoStorage');
        },
        set: function(obj, cb) {
            mono.sendMessage({action: 'set', data: obj}, cb, 'monoStorage');
        },
        remove: function(obj, cb) {
            mono.sendMessage({action: 'remove', data: obj}, cb, 'monoStorage');
        },
        clear: function(cb) {
            mono.sendMessage({action: 'clear'}, cb, 'monoStorage');
        }
    };
    var localStorageMode = {
        get: function (src, cb) {
            var key, obj = {};
            if (src === undefined || src === null) {
                for (key in localStorage) {
                    if (!localStorage.hasOwnProperty(key)) {
                        continue;
                    }
                    obj[key] = localStorage[key];
                }
                return cb(obj);
            }
            if (typeof src === 'string') {
                src = [src];
            }
            if (Array.isArray(src) === true) {
                for (var i = 0, len = src.length; i < len; i++) {
                    key = src[i];
                    obj[key] = localStorage[key];
                }
            } else {
                for (key in src) {
                    obj[key] = localStorage[key];
                }
            }
            cb(obj);
        },
        set: function (obj, cb) {
            var key;
            for (key in obj) {
                localStorage[key] = obj[key];
            }
            cb && cb();
        },
        remove: function (obj, cb) {
            if (Array.isArray(obj)) {
                for (var i = 0, len = obj.length; i < len; i++) {
                    var key = obj[i];
                    delete localStorage[key];
                }
            } else {
                delete localStorage[obj];
            }
            cb && cb();
        },
        clear: function (cb) {
            localStorage.clear();
            cb && cb();
        }
    };
    var monoStorage = function() {
        var ss = require("sdk/simple-storage");
        return {
            get: function (src, cb) {
                var key, obj = {};
                if (src === undefined || src === null) {
                    for (key in ss.storage) {
                        if (!ss.storage.hasOwnProperty(key)) {
                            continue;
                        }
                        obj[key] = ss.storage[key];
                    }
                    return cb(obj);
                }
                if (typeof src === 'string') {
                    src = [src];
                }
                if (Array.isArray(src) === true) {
                    for (var i = 0, len = src.length; i < len; i++) {
                        key = src[i];
                        obj[key] = ss.storage[key];
                    }
                } else
                    for (key in src) {
                        obj[key] = ss.storage[key];
                    }
                cb(obj);
            },
            set: function (obj, cb) {
                var key;
                for (key in obj) {
                    ss.storage[key] = obj[key];
                }
                cb && cb();
            },
            remove: function (obj, cb) {
                if (Array.isArray(obj)) {
                    for (var i = 0, len = obj.length; i < len; i++) {
                        var key = obj[i];
                        delete ss.storage[key];
                    }
                } else {
                    delete ss.storage[obj];
                }
                cb && cb();
            },
            clear: function (cb) {
                var key;
                for (key in ss.storage) {
                    delete ss.storage[key];
                }
                cb && cb();
            }
        }
    };
    var storage_fn = function(mode) {
        if (mono.isModule) {
            if (monoStorage.get === undefined) {
                monoStorage = monoStorage();
            }
            return monoStorage;
        } else
        if (mono.isFF) {
            return externalStorage;
        } else
        if (mono.isChrome &&
            chrome.storage !== undefined) {
            return chrome.storage[mode];
        } else
        if (window.localStorage !== undefined) {
            return localStorageMode;
        }
        return {};
    };
    mono.storage = storage_fn('local');
    mono.storage.local = mono.storage;
    mono.storage.sync = storage_fn('sync');

    var msgTools = function() {
        var cbObj = mono.debug.cbStack = {};
        var cbStack = [];
        var id = 0;
        return {
            cbCollector: function (message, cb) {
                mono.debug.messages && mono('cbCollector', message);
                if (cb !== undefined) {
                    if (cbStack.length > mono.messageStack) {
                        mono('Stack overflow!');
                        delete cbObj[cbStack.shift()];
                    }
                    id++;
                    message.monoCallbackId = id;
                    cbObj[id] = cb;
                    cbStack.push(id);
                }
            },
            cbCaller: function(message, pageId) {
                mono.debug.messages && mono('cbCaller', message);
                if (cbObj[message.monoResponseId] === undefined) {
                    return mono('Send to', pageId, 'Id', message.monoResponseId,'Message response not found!');
                }
                cbObj[message.monoResponseId](message.data);
                delete cbObj[message.monoResponseId];
                cbStack.splice(cbStack.indexOf(message.monoResponseId), 1);
            },
            mkResponse: function(message, pageId) {
                mono.debug.messages && mono('mkResponse', message);
                var response;
                if (message.monoCallbackId !== undefined) {
                    response = function(responseMessage) {
                        responseMessage = {
                            data: responseMessage,
                            monoResponseId: message.monoCallbackId,
                            monoTo: message.monoFrom,
                            monoFrom: pageId
                        };
                        mono.sendMessage.send(responseMessage);
                    }
                }
                return response;
            }
        }
    }();

    var ffVirtualPort = function() {
        var onCollector = {};
        var hasListener = false;
        mono.addon = addon = {
            port: {
                emit: function(pageId, message) {
                    var msg = '>'+pageId+':'+JSON.stringify(message);
                    window.postMessage(msg, "*");
                },
                on: function(pageId, onMessage) {
                    if (onCollector[pageId] === undefined) {
                        onCollector[pageId] = [];
                    }
                    onCollector[pageId].push(onMessage);
                    if (hasListener) {
                        return;
                    }
                    hasListener = true;
                    window.addEventListener('monoMessage', function (e) {
                        if (e.detail[0] !== '<') {
                            return;
                        }
                        var sepPos = e.detail.indexOf(':');
                        if (sepPos === -1) {
                            return;
                        }
                        var pageId = e.detail.substr(1, sepPos - 1);
                        var data = e.detail.substr(sepPos + 1);
                        var json = JSON.parse(data);
                        for (var i = 0, item; item = onCollector[pageId][i]; i++) {
                            item(json);
                        }
                    });
                }
            }
        }
    };

    var ffMessaging = {
        send: function(message, cb) {
            msgTools.cbCollector(message, cb);
            addon.port.emit(message.monoTo, message);
        },
        on: function(cb) {
            var firstOn = messagesEnable;
            messagesEnable = true;
            var pageId = mono.pageId;
            var onMessage = function(message) {
                if (message.monoTo !== pageId && message.monoTo !== defaultId) {
                    return;
                }
                if (firstOn === false && message.monoResponseId) {
                    return msgTools.cbCaller(message, pageId);
                }
                if (firstOn === false && message.monoService !== undefined && serviceList[message.monoFrom] !== undefined) {
                    return serviceList[message.monoFrom].onMessage(message.data);
                }
                var response = msgTools.mkResponse(message, pageId);
                cb(message.data, response);
            };
            if (pageId !== defaultId) {
                addon.port.on(pageId, onMessage);
            }
            addon.port.on(defaultId, onMessage);
        }
    };

    var chMessaging = {
        send: function(message, cb) {
            msgTools.cbCollector(message, cb);
            chrome.runtime.sendMessage(message);
        },
        on: function(cb) {
            var firstOn = messagesEnable;
            messagesEnable = true;
            var pageId = mono.pageId;
            chrome.runtime.onMessage.addListener(function(message) {
                if (message.monoTo !== pageId && message.monoTo !== defaultId) {
                    return;
                }
                if (firstOn === false && message.monoResponseId) {
                    return msgTools.cbCaller(message, pageId);
                }
                if (firstOn === false && message.monoService !== undefined && serviceList[message.monoFrom] !== undefined) {
                    return serviceList[message.monoFrom].onMessage(message.data);
                }
                var response = msgTools.mkResponse(message, pageId);
                cb(message.data, response);
            });
        }
    };

    var opMessaging = {
        send: function(message, cb) {
            msgTools.cbCollector(message, cb);
            opera.extension.postMessage(message);
        },
        on: function(cb) {
            var firstOn = messagesEnable;
            messagesEnable = true;
            var pageId = mono.pageId;
            opera.extension.onmessage = function(message) {
                if (message.monoTo !== pageId && message.monoTo !== defaultId) {
                    return;
                }
                if (firstOn === false && message.monoResponseId) {
                    return msgTools.cbCaller(message, pageId);
                }
                if (firstOn === false && message.monoService !== undefined && serviceList[message.monoFrom] !== undefined) {
                    return serviceList[message.monoFrom].onMessage(message.data);
                }
                var response = msgTools.mkResponse(message, pageId);
                cb(message.data, response);
            };
        }
    };

    mono.sendMessage = function(message, cb, to) {
        message = {
            data: message,
            monoTo: to || defaultId,
            monoFrom: mono.pageId
        };
        mono.debug.messages && mono('sendMessage', 'to:', to, 'hasCallback', !!cb, message);
        mono.sendMessage.send(message, cb);
    };

    if (mono.isChrome) {
        mono.sendMessage.send = chMessaging.send;
        mono.onMessage = chMessaging.on;
    } else
    if (mono.isFF) {
        if (mono.noAddon) {
            ffVirtualPort();
        }
        mono.sendMessage.send = ffMessaging.send;
        mono.onMessage = ffMessaging.on;
    } else
    if (mono.isOpera) {
        mono.sendMessage.send = opMessaging.send;
        mono.onMessage = opMessaging.on;
    }

    if (!mono.isModule) {
        window.mono = mono;
    } else {
        return mono;
    }
};
if (typeof window !== "undefined") {
    mono(window);
} else {
    exports.init = mono;
}
