/**
 * Created by Anton on 31.12.2016.
 */
"use strict";
require.config({
    baseUrl: './js'
});
require(['./min/promise.min', './lib/i18nDom', './lib/utils', './lib/dom', './lib/selectBox', './min/EventEmitter.min', './min/moment-with-locales.min', './min/filesize.min'], function (Promise, i18nDom, utils, dom, selectBox, EventEmitter, moment, filesize) {
    i18nDom();

    document.body.classList.remove('loading');
    moment.locale(chrome.i18n.getUILanguage());

    var ee = new EventEmitter();
    var activeProfile = null;
    var uiState = [];

    var bindClearBtn = function (clear, input) {
        var clearIsVisible = false;
        input.addEventListener('keyup', function() {
            if (this.value.length > 0) {
                if (!clearIsVisible) {
                    clearIsVisible = true;
                    clear.classList.add('input__clear_visible');
                }
            } else {
                if (clearIsVisible) {
                    clearIsVisible = false;
                    clear.classList.remove('input__clear_visible');
                }
            }
        });

        clear.addEventListener('click', function (e) {
            e.preventDefault();
            input.value = '';
            input.dispatchEvent(new CustomEvent('keyup'));
            input.focus();
        });
    };

    var bindDblClickClear = function (nodeList) {
        if (!Array.isArray(nodeList)) {
            nodeList = [nodeList];
        }
        nodeList.forEach(function (node) {
            node.addEventListener('dblclick', function() {
                this.value = '';
                this.dispatchEvent(new CustomEvent('keyup'));
            });
        });
    };

    (function () {
        var searchInput = document.querySelector('.input__input-search');
        var searchClear = document.querySelector('.input__clear-search');
        var searchSubmit = document.querySelector('.search__submit');

        (function (input, submit) {
            var stateItem = {
                id: 'searchInput',
                discard: function () {
                    input.value = '';
                    input.dispatchEvent(new CustomEvent('keyup', {detail: 'stateReset'}));
                }
            };

            input.addEventListener('keypress', function(e) {
                if (e.keyCode === 13) {
                    submit.dispatchEvent(new MouseEvent('click', {cancelable: true}));
                }
            });

            input.addEventListener('keyup', function(e) {
                if (e.detail !== 'stateReset' && uiState.indexOf(stateItem) === -1) {
                    uiState.push(stateItem);
                }
            });
        })(searchInput, searchSubmit);

        bindClearBtn(searchClear, searchInput);

        (function (submit) {
            submit.addEventListener('click', function(e) {
                e.preventDefault();
                var query = searchInput.value.trim();
                ee.trigger('search', [query]);
            });
        })(searchSubmit);

        var initAutoComplete = function (input, submit) {
            var lastHistoryRequest = null;
            var historySuggests = (function () {
                var history = null;
                var initHistory = function (cb) {
                    chrome.storage.local.get({
                        history: []
                    }, function (storage) {
                        history = storage.history;
                        cb && cb();
                    });

                    return {
                        abort: function () {
                            cb = null;
                        }
                    }
                };
                var onGetHistory = function (term, cb) {
                    var termLen = term.length;
                    var termLow = term.toLowerCase();
                    var list = history.filter(function (item) {
                        var query = item.query;
                        if (termLen === 0) {
                            return !!query;
                        } else {
                            return query.toLowerCase().indexOf(termLow) === 0;
                        }
                    }).sort(function(a, b) {
                        a = a.count;
                        b = b.count;
                        return a === b ? 0 : a < b ? 1 : -1;
                    }).map(function (item) {
                        return item.query;
                    });
                    cb(list);
                };
                return function (term, cb) {
                    if (!history) {
                        lastHistoryRequest = initHistory(function () {
                            onGetHistory(term, cb);
                        });
                    } else {
                        onGetHistory(term, cb);
                    }
                };
            })();

            var webSuggests = (function () {
                var cache = {};
                var onGetSuggests = function (term, suggests, cb) {
                    cache[term] = suggests;
                    cb(suggests);
                };
                return function (term, cb) {
                    var _cache = cache[term];
                    if (_cache) {
                        onGetSuggests(term, _cache, cb);
                    } else {
                        lastHistoryRequest = utils.request({
                            url: 'http://suggestqueries.google.com/complete/search',
                            data: {
                                client: 'firefox',
                                q: term
                            },
                            json: true
                        }, function (err, response) {
                            if (!err) {
                                onGetSuggests(term, response.body[1], cb);
                            }
                        });
                    }
                };
            })();

            $(input).autocomplete({
                minLength: 0,
                delay: 100,
                position: {
                    collision: "bottom"
                },
                source: function(query, cb) {
                    if (lastHistoryRequest) {
                        lastHistoryRequest.abort();
                        lastHistoryRequest = null;
                    }

                    var term = query.term;
                    if (!term.length) {
                        historySuggests(term, cb);
                    } else {
                        webSuggests(term, cb);
                    }
                },
                select: function(e, ui) {
                    submit.dispatchEvent(new CustomEvent('click', {cancelable: true, detail: {query: ui.item.value}}));
                },
                create: function() {
                    var hasTopShadow = false;
                    var ac = document.querySelector('ul.ui-autocomplete');
                    ac.addEventListener('scroll', function () {
                        if (this.scrollTop !== 0) {
                            if (hasTopShadow !== true) {
                                hasTopShadow = true;
                                this.style.boxShadow = 'rgba(0, 0, 0, 0.40) -2px 1px 2px 0px inset';
                            }
                        } else
                        if (hasTopShadow !== false) {
                            hasTopShadow = false;
                            this.style.boxShadow = null;
                        }
                    });
                }
            });
        };

        setTimeout(function () {
            require(['./min/jquery-3.1.1.min'], function () {
                require(['./min/jquery-ui.min'], function () {
                    initAutoComplete(searchInput, searchSubmit);
                });
            });
        }, 50);
    })();

    var Filter = function () {
        var inputBoxTimeFilterVisible = false;
        var inputBoxTimeFilter = document.querySelector('.input_box-time-filter');
        var inputWordFilter = document.querySelector('.input__input-word-filter');
        var clearWordFilter = document.querySelector('.input__clear-word-filter');
        var sizeInputFromFilter = document.querySelector('.input__input-size-filter.input__input-range-from');
        var sizeInputToFilter = document.querySelector('.input__input-size-filter.input__input-range-to');
        var selectTimeFilter = document.querySelector('.select__select-time-filter');
        var timeInputFromFilter = document.querySelector('.input__input-time-filter.input__input-range-from');
        var timeInputToFilter = document.querySelector('.input__input-time-filter.input__input-range-to');
        var seedInputFromFilter = document.querySelector('.input__input-seed-filter.input__input-range-from');
        var seedInputToFilter = document.querySelector('.input__input-seed-filter.input__input-range-to');
        var peerInputFromFilter = document.querySelector('.input__input-peer-filter.input__input-range-from');
        var peerInputToFilter = document.querySelector('.input__input-peer-filter.input__input-range-to');

        var timer = null;
        var applyFilter = function () {
            clearTimeout(timer);
            timer = setTimeout(function () {
                ee.trigger('filterUpdate');
            }, 150);
        };

        var filters = [];

        (function wordFilter(input, clearWordFilter) {
            var strToRe = function (string) {
                var lowString = string.toLowerCase();
                var i, symbol;
                var part = '';
                var parts = [];
                var isSpace = /\s/;
                for (i = 0; symbol = lowString[i]; i++) {
                    if (isSpace.test(symbol)) {
                        if (lowString[i - 1] !== '\\') {
                            part && parts.push(part);
                            part = '';
                        } else {
                            part = part.substr(0, part.length - 1) + symbol;
                        }
                    } else {
                        part += symbol;
                    }
                }
                part && parts.push(part);

                var list = null;
                var includeList = [];
                var excludeList = [];
                var excludeRe = /^[!-]\w+/;
                var sanitizeText = /[\-\[\]{}()*+?.,\\\^$|#\s]/g;
                for (i = 0; part = parts[i]; i++) {
                    if (excludeRe.test(part)) {
                        list = excludeList;
                        part = part.substr(1);
                    } else {
                        list = includeList;
                    }
                    part = part.replace(sanitizeText, '\\$&');
                    if (list.indexOf(part) === -1) {
                        list.push(part);
                    }
                }

                var sortFn = function(a, b){
                    return a.length > b.length ? -1 : 1;
                };

                excludeList.sort(sortFn);
                includeList.sort(sortFn);

                var result = new Array(3);
                if (excludeList.length) {
                    result[0] = new RegExp(excludeList.join('|'));
                }
                if (includeList.length) {
                    result[1] = new RegExp(includeList.join('|'), 'g');
                    result[2] = includeList.length;
                }
                return (result[0] || result[1]) && result;
            };

            var stateItem = {
                id: 'wordFilter',
                discard: function () {
                    input.value = '';
                    input.dispatchEvent(new CustomEvent('keyup', {detail: 'stateReset'}));
                }
            };

            var filter = {
                type: 'word',
                re: null
            };

            bindClearBtn(clearWordFilter, input);

            input.addEventListener('keyup', function(e) {
                filter.re = strToRe(this.value);

                var pos = filters.indexOf(filter);
                if (pos !== -1) {
                    filters.splice(pos, 1);
                }

                if (filter.re) {
                    filters.push(filter);
                }

                applyFilter();

                if (e.detail !== 'stateReset' && uiState.indexOf(stateItem) === -1) {
                    uiState.push(stateItem);
                }
            });
        })(inputWordFilter, clearWordFilter);

        (function sizeFilter(inputFrom, inputTo) {
            var stateItem = {
                id: 'sizeFilter',
                discard: function () {
                    inputFrom.value = '';
                    inputTo.value = '';
                    inputTo.dispatchEvent(new CustomEvent('keyup', {detail: 'stateReset'}));
                }
            };

            var filter = {
                type: 'size',
                min: 0,
                max: 0
            };

            inputFrom.addEventListener('keyup', function(e) {
                filter.min = parseFloat(this.value) * 1024 * 1024 * 1024 || 0;

                var pos = filters.indexOf(filter);
                if (pos !== -1) {
                    filters.splice(pos, 1);
                }

                if (filter.min > 0 || filter.max > 0) {
                    filters.push(filter);
                }

                applyFilter();

                if (e.detail !== 'stateReset' && uiState.indexOf(stateItem) === -1) {
                    uiState.push(stateItem);
                }
            });

            inputTo.addEventListener('keyup', function(e) {
                filter.max = parseFloat(this.value) * 1024 * 1024 * 1024 || 0;

                var pos = filters.indexOf(filter);
                if (pos !== -1) {
                    filters.splice(pos, 1);
                }

                if (filter.min > 0 || filter.max > 0) {
                    filters.push(filter);
                }

                applyFilter();

                if (e.detail !== 'stateReset' && uiState.indexOf(stateItem) === -1) {
                    uiState.push(stateItem);
                }
            });

            bindDblClickClear([inputFrom, inputTo]);
        })(sizeInputFromFilter, sizeInputToFilter);

        (function timeFilter(select, inputBox, inputFrom, inputTo) {
            var stateItem = {
                id: 'timeFilter',
                discard: function () {
                    select.selectedIndex = 0;
                    select.dispatchEvent(new CustomEvent('change', {detail: 'stateReset'}));
                }
            };

            var filter = {
                type: 'date',
                min: 0,
                max: 0
            };

            var selectWrapper = new selectBox(select);

            select.addEventListener('change', function (e) {
                var value = this.value;
                if (value < 0) {
                    if (!inputBoxTimeFilterVisible) {
                        inputBoxTimeFilterVisible = true;
                        inputBox.classList.add('input_box-time-filter-visible');
                    }
                } else {
                    if (inputBoxTimeFilterVisible) {
                        inputBoxTimeFilterVisible = false;
                        inputFrom.value = '';
                        inputTo.value = '';
                        inputBox.classList.remove('input_box-time-filter-visible');
                    }
                }

                var pos = filters.indexOf(filter);
                if (pos !== -1) {
                    filters.splice(pos, 1);
                }

                if (!inputBoxTimeFilterVisible) {
                    filter.max = 0;
                    filter.min = parseInt(this.value) || 0;

                    if (filter.min > 0) {
                        filters.push(filter);
                    }
                }

                applyFilter();

                if (e.detail !== 'stateReset' && uiState.indexOf(stateItem) === -1) {
                    uiState.push(stateItem);
                }
            });

            inputFrom.addEventListener('keyup', function(e) {
                filter.min = parseInt(this.value) || 0;

                var pos = filters.indexOf(filter);
                if (pos !== -1) {
                    filters.splice(pos, 1);
                }

                if (filter.min > 0 || filter.max > 0) {
                    filters.push(filter);
                }

                applyFilter();
            });

            inputTo.addEventListener('keyup', function(e) {
                filter.max = parseInt(this.value) || 0;

                var pos = filters.indexOf(filter);
                if (pos !== -1) {
                    filters.splice(pos, 1);
                }

                if (filter.min > 0 || filter.max > 0) {
                    filters.push(filter);
                }

                applyFilter();
            });

            bindDblClickClear([inputFrom, inputTo]);
        })(selectTimeFilter, inputBoxTimeFilter, timeInputFromFilter, timeInputToFilter);

        (function seedFilter(inputFrom, inputTo) {
            var stateItem = {
                id: 'seedFilter',
                discard: function () {
                    inputFrom.value = '';
                    inputTo.value = '';
                    inputTo.dispatchEvent(new CustomEvent('keyup', {detail: 'stateReset'}));
                }
            };

            var filter = {
                type: 'seed',
                min: 0,
                max: 0
            };

            inputFrom.addEventListener('keyup', function(e) {
                filter.min = parseInt(this.value) || 0;

                var pos = filters.indexOf(filter);
                if (pos !== -1) {
                    filters.splice(pos, 1);
                }

                if (filter.min > 0 || filter.max > 0) {
                    filters.push(filter);
                }

                applyFilter();

                if (e.detail !== 'stateReset' && uiState.indexOf(stateItem) === -1) {
                    uiState.push(stateItem);
                }
            });

            inputTo.addEventListener('keyup', function(e) {
                filter.max = parseInt(this.value) || 0;

                var pos = filters.indexOf(filter);
                if (pos !== -1) {
                    filters.splice(pos, 1);
                }

                if (filter.min > 0 || filter.max > 0) {
                    filters.push(filter);
                }

                applyFilter();

                if (e.detail !== 'stateReset' && uiState.indexOf(stateItem) === -1) {
                    uiState.push(stateItem);
                }
            });

            bindDblClickClear([inputFrom, inputTo]);
        })(seedInputFromFilter, seedInputToFilter);

        (function peerFilter(inputFrom, inputTo) {
            var stateItem = {
                id: 'peerFilter',
                discard: function () {
                    inputFrom.value = '';
                    inputTo.value = '';
                    inputTo.dispatchEvent(new CustomEvent('keyup', {detail: 'stateReset'}));
                }
            };

            var filter = {
                type: 'peer',
                min: 0,
                max: 0
            };

            inputFrom.addEventListener('keyup', function(e) {
                filter.min = parseInt(this.value) || 0;

                var pos = filters.indexOf(filter);
                if (pos !== -1) {
                    filters.splice(pos, 1);
                }

                if (filter.min > 0 || filter.max > 0) {
                    filters.push(filter);
                }

                applyFilter();

                if (e.detail !== 'stateReset' && uiState.indexOf(stateItem) === -1) {
                    uiState.push(stateItem);
                }
            });

            inputTo.addEventListener('keyup', function(e) {
                filter.max = parseInt(this.value) || 0;

                var pos = filters.indexOf(filter);
                if (pos !== -1) {
                    filters.splice(pos, 1);
                }

                if (filter.min > 0 || filter.max > 0) {
                    filters.push(filter);
                }

                applyFilter();

                if (e.detail !== 'stateReset' && uiState.indexOf(stateItem) === -1) {
                    uiState.push(stateItem);
                }
            });

            bindDblClickClear([inputFrom, inputTo]);
        })(peerInputFromFilter, peerInputToFilter);

        var unique = function (value, index, self) {
            return self.indexOf(value) === index;
        };

        var filterTypeMap = {
            word: function (filter, torrent) {
                var result = true;
                if (filter.re[0]) {
                    result = !filter.re[0].test(torrent.wordFilterLow);
                }
                if (result && filter.re[1]) {
                    var m = torrent.wordFilterLow.match(filter.re[1]);
                    result = m && m.filter(unique).length === filter.re[2];
                }
                return result;
            },
            size: function (filter, torrent) {
                var result = filter.min === 0 ? true : torrent.size >= filter.min;
                if (result && filter.max) {
                    result = torrent.size <= filter.max;
                }
                return result;
            },
            date: function (filter, torrent) {
                var result = filter.min === 0 ? true : torrent.date >= filter.min;
                if (result && filter.max) {
                    result = torrent.date <= filter.max;
                }
                return result;
            },
            seed: function (filter, torrent) {
                var result = filter.min === 0 ? true : torrent.seed >= filter.min;
                if (result && filter.max) {
                    result = torrent.seed <= filter.max;
                }
                return result;
            },
            peer: function (filter, torrent) {
                var result = filter.min === 0 ? true : torrent.peer >= filter.min;
                if (result && filter.max) {
                    result = torrent.peer <= filter.max;
                }
                return result;
            }
        };

        var styleNode = dom.el('style', {
            class: ['style_filter'],
            text: ''
        });
        document.body.appendChild(styleNode);

        var tableRowSelector = '.table-results .body__row';
        ee.on('filterUpdate', function () {
            var style = [];

            if (filters.length) {
                var state = filters.map(function () {
                    return 1;
                }).join('');
                style.push(tableRowSelector + ':not([data-filter="' + state + '"]){display: none}');
            }

            var selectedTrackers = [];
            activeProfile.trackers.forEach(function (tracker) {
                if (tracker.selected) {
                    selectedTrackers.push(tracker.id);
                }
            });
            if (selectedTrackers.length) {
                var trackerList = selectedTrackers.map(function (id) {
                    return ':not([data-tracker-id="' + id + '"])';
                }).join('');
                style.push(tableRowSelector + trackerList + '{display: none}');
            }

            styleNode.textContent = style.join('');
        });

        this.getFilterValue = function (/**torrent*/torrent) {
            var state = new Array(filters.length);
            for (var i = 0, filter; filter = filters[i]; i++) {
                state[i] = filterTypeMap[filter.type](filter, torrent) ? 1 : 0;
            }
            return state.join('');
        }
    };

    var filter = new Filter();

    (function () {
        var scrollTopVisible = false;
        var scrollTop = document.querySelector('.scroll_top');

        scrollTop.addEventListener('click', function(e) {
            e.preventDefault();
            window.scrollTo(0, 0);
        });

        window.addEventListener('scroll', function (e) {
            if (window.scrollY > 100) {
                if (!scrollTopVisible) {
                    scrollTopVisible = true;
                    scrollTop.classList.add('scroll_top-show');
                }
            } else {
                if (scrollTopVisible) {
                    scrollTopVisible = false;
                    scrollTop.classList.remove('scroll_top-show');
                }
            }
        });
    })();

    var ProfileManager = function (profiles, profileIdProfileMap, trackers, activeProfile) {
        var layer = null;

        var getHeader = function (title) {
            return dom.el('div', {
                class: 'manager__header',
                append: [
                    dom.el('div', {
                        class: 'header__title',
                        text: title
                    }),
                    dom.el('a', {
                        href: '#close',
                        class: 'header__close',
                        text: chrome.i18n.getMessage('close'),
                        on: ['click', function (e) {
                            e.preventDefault();
                            close();
                        }]
                    })
                ]
            });
        };

        var getFooter = function (childNodes) {
            return dom.el('div', {
                class: 'manager__footer',
                append: childNodes
            });
        };

        var getLayer = function () {
            var content = null;
            var node = dom.el('div', {
                class: 'manager__layer',
                append: [
                    content = dom.el('div', {
                        class: 'manager'
                    })
                ]
            });
            return {
                node: node,
                content: content
            }
        };

        var getProfiles = function (profiles) {
            var getProfileItem = function (profile) {
                return dom.el('div', {
                    class: 'item',
                    data: {
                        id: profile.id
                    },
                    append: [
                        dom.el('div', {
                            class: 'item__name',
                            text: profile.name
                        }),
                        dom.el('a', {
                            class: 'item__action',
                            href: '#edit',
                            data: {
                                action: 'edit'
                            },
                            text: chrome.i18n.getMessage('edit')
                        }),
                        dom.el('a', {
                            class: 'item__action',
                            href: '#remove',
                            data: {
                                action: 'remove'
                            },
                            text: chrome.i18n.getMessage('remove')
                        })
                    ]
                });
            };
            return dom.el(document.createDocumentFragment(), {
                append: [
                    getHeader(chrome.i18n.getMessage('manageProfiles')),
                    dom.el('div', {
                        class: 'manager__profiles',
                        append: (function () {
                            var list = [];
                            profiles.forEach(function (/**profile*/profile) {
                                list.push(getProfileItem(profile))
                            });
                            return list;
                        })(),
                        on: ['click', function (e) {
                            var target = e.target;
                            if (target.dataset.action === 'edit') {
                                e.preventDefault();
                                var profileId = target.parentNode.dataset.id;
                                var profile = profileIdProfileMap[profileId];
                                layer.content.textContent = '';
                                layer.content.appendChild(getProfile(profile, trackers));
                            }
                        }]
                    }),
                    getFooter([
                        dom.el('a', {
                            href: '#save',
                            class: ['manager__footer__btn'],
                            text: chrome.i18n.getMessage('save')
                        })
                    ])
                ]
            });
        };

        var getProfile = function (/**profile*/profile, trackers) {
            var getTrackerItem = function (tracker, checked, exists) {
                return dom.el('div', {
                    class: 'item',
                    data: {
                        id: tracker.id
                    },
                    append: [
                        dom.el('input', {
                            class: 'item__checkbox',
                            type: 'checkbox',
                            checked: checked
                        }),
                        dom.el('div', {
                            class: 'item__name',
                            text: tracker.meta.name || tracker.id
                        }),
                        !exists || !tracker.meta.updateURL ? '' : dom.el('a', {
                            class: 'item__action',
                            href: '#update',
                            data: {
                                action: 'update'
                            },
                            text: chrome.i18n.getMessage('update')
                        }),
                        dom.el('a', {
                            class: 'item__action',
                            href: '#edit',
                            data: {
                                action: 'edit'
                            },
                            text: chrome.i18n.getMessage('edit')
                        }),
                        dom.el('a', {
                            class: 'item__action',
                            href: '#remove',
                            data: {
                                action: 'remove'
                            },
                            text: chrome.i18n.getMessage('remove')
                        })
                    ]
                })
            };

            var trackersNode = null;
            return dom.el(document.createDocumentFragment(), {
                append: [
                    getHeader(chrome.i18n.getMessage('manageProfile')),
                    dom.el('div', {
                        class: 'manager__profile',
                        append: [
                            dom.el('div', {
                                class: ['profile__input'],
                                append: [
                                    dom.el('input', {
                                        class: ['input__input'],
                                        type: 'text',
                                        value: profile.name
                                    })
                                ]
                            })
                        ]
                    }),
                    trackersNode = dom.el('div', {
                        class: 'manager__trackers',
                        append: (function () {
                            var list = [];
                            var idList = [];
                            profile.trackers.forEach(function (/**profileTracker*/profileTracker) {
                                var tracker = trackers[profileTracker.id];
                                var exists = !!tracker;
                                if (!tracker) {
                                    tracker = {
                                        id: profileTracker.id,
                                        meta: {}
                                    }
                                }
                                idList.push(tracker.id);
                                list.push(getTrackerItem(tracker, true, exists))
                            });
                            Object.keys(trackers).forEach(function (/**tracker*/trackerId) {
                                var tracker = trackers[trackerId];
                                if (idList.indexOf(tracker.id) === -1) {
                                    list.push(getTrackerItem(tracker, false, true))
                                }
                            });
                            return list;
                        })(),
                        on: ['click', function (e) {
                            var target = e.target;
                            if (target.dataset.action === 'edit') {
                                e.preventDefault();
                                var trackerId = target.parentNode.dataset.id;
                                chrome.tabs.create({
                                    url: 'editor.html#' + utils.param({
                                        id: trackerId
                                    })
                                });
                            }
                        }]
                    }),
                    getFooter([
                        dom.el('a', {
                            href: '#save',
                            class: ['manager__footer__btn'],
                            text: chrome.i18n.getMessage('save'),
                            on: ['click', function (e) {
                                e.preventDefault();
                                var profileTrackers = [];
                                [].slice.call(trackersNode.childNodes).forEach(function (trackerNode) {
                                    var id = trackerNode.dataset.id;
                                    var checkbox = trackerNode.querySelector('.item__checkbox');
                                    var checked = checkbox.checked;
                                    if (checked) {
                                        profileTrackers.push({
                                            id: id
                                        })
                                    }
                                });
                                profile.trackers = profileTrackers;
                                chrome.storage.local.set({
                                    profiles: profiles
                                }, function () {
                                    activeProfile.reload();
                                });
                            }]
                        }),
                        dom.el('a', {
                            href: '#update',
                            class: ['manager__footer__btn'],
                            text: chrome.i18n.getMessage('update')
                        })
                    ])
                ]
            });
        };

        var createLayer = function () {
            var layer = getLayer();
            layer.content.appendChild(getProfiles(profiles));
            return layer;
        };

        var close = function () {
            layer.node.parentNode.removeChild(layer.node);
        };

        layer = createLayer();
        document.body.appendChild(layer.node);
    };

    (function () {
        var manageProfile = document.querySelector('.button-manage-profile');
        var profileSelect = document.querySelector('.profile__select');
        var trackerList = document.querySelector('.tracker__list');
        var profileSelectWrapper = null;

        trackerList.addEventListener('click', function (e) {
            var child = dom.closestNode(this, e.target);
            if (child) {
                activeProfile.trackerIdTracker[child.dataset.id].select();
            }
        });

        var currentProfileId = null;
        var trackers = {};
        var profiles = [];
        var profileIdProfileMap = {};
        var getProfileId = function () {
            var id = 0;
            while (profileIdProfileMap[id]) {
                id++;
            }
            return id;
        };
        var getDefaultProfile = function () {
            return {
                name: chrome.i18n.getMessage('defaultProfileName'),
                id: getProfileId(),
                trackers: []
            }
        };
        var selectProfileId = function (id) {
            var index = 0;
            profiles.some(function (item, i) {
                if (item.id === id) {
                    index = i;
                    return true;
                }
            });
            if (profileSelect.selectedIndex != index) {
                profileSelect.selectedIndex = index;
            }
        };
        /**
         * @typedef {Object} profile
         * @property {string} name
         * @property {number} id
         * @property {[profileTracker]} trackers
         */
        /**
         * @typedef {Object} profileTracker
         * @property {string} id
         */
        /**
         * @typedef {Object} tracker
         * @property {string} id
         * @property {Object} meta
         * @property {string} meta.name
         * @property {string} meta.version
         * @property {string} [meta.author]
         * @property {string} [meta.description]
         * @property {string} [meta.homepageURL]
         * @property {string} meta.icon
         * @property {string} [meta.icon64]
         * @property {string} meta.updateURL
         * @property {string} meta.downloadURL
         * @property {string} [meta.supportURL]
         * @property {Object} info
         * @property {number} info.lastUpdate
         * @property {string} code
         */

        var Transport = function (transport) {
            var emptyFn = function () {};
            var onceFn = function (cb, scope) {
                return function () {
                    if (cb) {
                        var context = scope || this;
                        cb.apply(context, arguments);
                        cb = null;
                    }
                };
            };

            var callbackId = 0;
            var callbackIdCallback = {};

            this.onMessage = function (cb) {
                transport.onMessage(function (msg) {
                    if (msg.responseId) {
                        return callbackIdCallback[msg.responseId](msg.message);
                    }

                    var response;
                    if (msg.callbackId) {
                        response = onceFn(function (message) {
                            transport.sendMessage({
                                responseId: msg.callbackId,
                                message: message
                            });
                        });
                    } else {
                        response = emptyFn;
                    }
                    var result = cb(msg.message, response);
                    if (result !== true) {
                        response();
                    }
                });
            };
            this.sendMessage = function (message, callback) {
                var msg = {
                    message: message
                };
                if (callback) {
                    msg.callbackId = ++callbackId;
                    callbackIdCallback[msg.callbackId] = function (message) {
                        delete callbackIdCallback[msg.callbackId];
                        callback(message);
                    };
                }
                transport.sendMessage(msg);
            };
        };
        var FrameWorker = function () {
            var self = this;
            var stack = [];
            var frame = null;
            var contentWindow = null;

            var load = function () {
                frame = document.createElement('iframe');
                frame.src = 'sandbox.html';
                frame.style.display = 'none';
                frame.onload = function () {
                    contentWindow = frame.contentWindow;
                    while (stack.length) {
                        self.postMessage(stack.shift());
                    }
                };
                document.body.appendChild(frame);
            };

            this.postMessage = function (msg) {
                if (contentWindow) {
                    contentWindow.postMessage(msg, '*');
                } else {
                    stack.push(msg);
                }
            };

            var msgListener = function(event) {
                if (event.source === contentWindow) {
                    if (self.onmessage) {
                        self.onmessage(event.data);
                    }
                }
            };
            window.addEventListener("message", msgListener);

            this.onmessage = null;
            this.terminate = function () {
                if (frame) {
                    frame.parentNode.removeChild(frame);
                    frame = null;
                }
                window.removeEventListener("message", msgListener);
                self.onmessage = null;
            };

            load();
        };
        var Tracker = function (/**tracker*/tracker) {
            var self = this;
            var ready = false;
            var stack = [];
            var requests = [];
            var worker = null;
            var transport = null;
            var load = function (onReady) {
                worker = new FrameWorker();
                transport = new Transport({
                    sendMessage: function (msg) {
                        worker.postMessage(msg);
                    },
                    onMessage: function (cb) {
                        worker.onmessage = function (data) {
                            cb(data);
                        }
                    }
                });
                transport.onMessage(function (msg, response) {
                    if (msg.action === 'init') {
                        response(tracker.code);
                    } else
                    if (msg.action === 'ready') {
                        onReady();
                    } else
                    if (msg.action === 'request') {
                        var request = utils.request(msg.details, function (err, resp) {
                            var pos = requests.indexOf(request);
                            if (pos !== -1) {
                                requests.splice(pos, 1);
                            }
                            request = null;

                            var error = null;
                            if (err) {
                                error = {
                                    name: err.name,
                                    message: err.message
                                };
                            }
                            response({
                                error: error,
                                response: resp
                            });
                        });
                        request && requests.push(request);
                        return true;
                    } else
                    if (msg.action === 'error') {
                        console.error(tracker.id, 'Loading error!', msg.name + ':', msg.message);
                    } else {
                        console.error(tracker.id, 'msg', msg);
                    }
                });
            };
            var onReady = function () {
                ready = true;
                while (stack.length) {
                    self.sendMessage.apply(null, stack.shift());
                }
            };
            this.id = tracker.id;
            this.sendMessage = function (message, callback) {
                if (ready) {
                    transport.sendMessage(message, callback);
                } else {
                    stack.push([message, callback]);
                }
            };
            this.reload = function () {
                worker.terminate();
                load(onReady);
            };
            this.destroy = function () {
                ready = false;
                worker.terminate();
                self.abort();
            };
            this.search = function (query, cb) {
                self.sendMessage({
                    event: 'search',
                    query: query
                }, cb);
            };
            this.abort = function () {
                requests.splice(0).forEach(function (request) {
                    request.abort();
                });
            };
            load(onReady);
        };
        var Profile = function (profile) {
            var self = this;
            var trackerIdTracker = {};
            var wrappedTrackers = [];
            // todo: rm me
            window.myTrackers = wrappedTrackers;
            var load = function () {
                var trackerSelect = function (state) {
                    if (state === undefined) {
                        state = !this.selected;
                    } else {
                        state = !!state;
                    }
                    if (this.selected !== state) {
                        this.selected = state;
                        if (state) {
                            this.node.classList.add('tracker-selected');
                        } else {
                            this.node.classList.remove('tracker-selected');
                        }
                        ee.trigger('filterUpdate');
                    }
                };
                var trackersNode = document.createDocumentFragment();
                profile.trackers.forEach(function (/**profileTracker*/item) {
                    var worker = null;
                    var tracker = trackers[item.id];
                    if (tracker) {
                        worker = new Tracker(tracker);
                    } else {
                        tracker = {
                            id: item.id,
                            meta: {},
                            info: {},
                            code: ''
                        }
                    }

                    var node = dom.el('div', {
                        class: 'tracker',
                        data: {
                            id: tracker.id
                        },
                        append: [
                            dom.el('img', {
                                class: 'tracker__icon',
                                src: tracker.meta.icon64 || tracker.meta.icon,
                                on: ['error', function () {
                                    this.src = './img/blank.svg';
                                }]
                            }),
                            dom.el('div', {
                                class: 'tracker__name',
                                text: tracker.meta.name || tracker.id
                            }),
                            dom.el('div', {
                                class: 'tracker__counter',
                                text: 0
                            })
                        ]
                    });

                    /**
                     * @typedef trackerWrapper
                     * @property {string} id
                     * @property {Element} node
                     * @property {Worker} worker
                     * @property {boolean} selected
                     * @property {function} trackerSelect
                     */

                    var trackerWrapper = {
                        id: tracker.id,
                        node: node,
                        worker: worker,
                        selected: false,
                        select: trackerSelect
                    };

                    wrappedTrackers.push(trackerWrapper);
                    trackerIdTracker[trackerWrapper.id] = trackerWrapper;

                    trackersNode.appendChild(node);
                });
                trackerList.textContent = '';
                trackerList.appendChild(trackersNode);
            };
            load();
            this.reload = function () {
                self.destroy();
                load();
            };
            this.id = profile.id;
            this.trackers = wrappedTrackers;
            this.trackerIdTracker = trackerIdTracker;
            this.destroy = function () {
                trackers.splice(0).forEach(function (tracker) {
                    tracker.worker && tracker.worker.destroy();
                });
                for (var key in trackerIdTracker) {
                    delete trackerIdTracker[key];
                }
            };
        };

        manageProfile.addEventListener('click', function (e) {
            e.preventDefault();
            new ProfileManager(profiles, profileIdProfileMap, trackers, activeProfile);
        });

        profileSelectWrapper = new selectBox(profileSelect, {
            editBtn: manageProfile
        });

        chrome.storage.local.get({
            currentProfileId: null,
            profiles: [],
            trackers: {}
        }, function (storage) {
            currentProfileId = storage.currentProfileId;
            trackers = storage.trackers;
            profiles = storage.profiles;
            if (profiles.length === 0) {
                profiles.push(getDefaultProfile());
            }
            var elList = profiles.map(function (/**profile*/item) {
                profileIdProfileMap[item.id] = item;
                return dom.el('option', {
                    text: item.name,
                    value: item.id
                });
            });
            dom.el(profileSelect, {
                append: elList
            });
            if (!profileIdProfileMap[currentProfileId]) {
                currentProfileId = profiles[0].id;
            }
            selectProfileId(currentProfileId);

            profileSelectWrapper.update();
            profileSelectWrapper.select();

            if (activeProfile) {
                activeProfile.destroy();
            }
            activeProfile = new Profile(profileIdProfileMap[currentProfileId]);

            /*ee.on('search', function (query) {
                activeProfile.trackers.forEach(function (tracker) {
                    tracker.search(query, function (result) {
                        ee.trigger('results', [tracker.id, query, result]);
                    });
                });
            });

            ee.on('abort', function () {
                activeProfile.trackers.forEach(function (tracker) {
                    tracker.abort();
                });
            });*/
        });
    })();

    (function () {
        var results = document.querySelector('.results');
        var table = null;

        var unixTimeToString = function (unixtime) {
            return moment(unixtime * 1000).format('lll');
        };

        var unixTimeToFromNow = function (unixtime) {
            return moment(unixtime * 1000).fromNow();
        };

        var sortInsertList = function(tableBody, sortedList, nodeList) {
            "use strict";
            var node;
            var insertItems = [];
            var insertPosition = null;
            var nodes = null;
            var child = null;

            for (var i = 0; node = sortedList[i]; i++) {
                if (nodeList[i] === node) {
                    continue;
                }
                insertPosition = i;

                nodes = document.createDocumentFragment();
                while (sortedList[i] !== undefined && sortedList[i] !== nodeList[i]) {
                    var pos = nodeList.indexOf(sortedList[i], i);
                    if (pos !== -1) {
                        nodeList.splice(pos, 1);
                    }
                    nodeList.splice(i, 0, sortedList[i]);

                    nodes.appendChild(sortedList[i].node);
                    i++;
                }

                insertItems.push([insertPosition, nodes]);
            }

            for (var n = 0; node = insertItems[n]; n++) {
                child = tableBody.childNodes[node[0]];
                if (child !== undefined) {
                    tableBody.insertBefore(node[1], child);
                } else {
                    tableBody.appendChild(node[1]);
                }
            }
        };

        (function () {
            var sortTypeMap = {
                date: function (direction) {
                    var moveUp = -1;
                    var moveDown = 1;
                    if (direction > 0) {
                        moveUp = 1;
                        moveDown = -1;
                    }
                    return function (/*tableRow*/a, /*tableRow*/b) {
                        a = a.torrent.date;
                        b = b.torrent.date;
                        return a === b ? 0 : a > b ? moveUp : moveDown;
                    };
                },
                title: function (direction) {
                    var moveUp = -1;
                    var moveDown = 1;
                    if (direction > 0) {
                        moveUp = 1;
                        moveDown = -1;
                    }
                    return function (/*tableRow*/a, /*tableRow*/b) {
                        a = a.torrent.title;
                        b = b.torrent.title;
                        return a === b ? 0 : a < b ? moveUp : moveDown;
                    };
                },
                size: function (direction) {
                    var moveUp = -1;
                    var moveDown = 1;
                    if (direction > 0) {
                        moveUp = 1;
                        moveDown = -1;
                    }
                    return function (/*tableRow*/a, /*tableRow*/b) {
                        a = a.torrent.size;
                        b = b.torrent.size;
                        return a === b ? 0 : a > b ? moveUp : moveDown;
                    };
                },
                seed: function (direction) {
                    var moveUp = -1;
                    var moveDown = 1;
                    if (direction > 0) {
                        moveUp = 1;
                        moveDown = -1;
                    }
                    return function (/*tableRow*/a, /*tableRow*/b) {
                        a = a.torrent.seed;
                        b = b.torrent.seed;
                        return a === b ? 0 : a > b ? moveUp : moveDown;
                    };
                },
                peer: function (direction) {
                    var moveUp = -1;
                    var moveDown = 1;
                    if (direction > 0) {
                        moveUp = 1;
                        moveDown = -1;
                    }
                    return function (/*tableRow*/a, /*tableRow*/b) {
                        a = a.torrent.peer;
                        b = b.torrent.peer;
                        return a === b ? 0 : a > b ? moveUp : moveDown;
                    };
                }
            };

            var onLickClick = function (target, tableRows) {
                var link = dom.closest('a', target);
                if (link) {
                    var type = null;
                    /**
                     * @type {tableRow}
                     */
                    var row = null;
                    if (link.classList.contains('title')) {
                        type = 'open';
                        row = tableRows[link.dataset.index];
                    } else
                    if (link.classList.contains('cell__download')) {
                        type = 'download';
                        row = tableRows[link.dataset.index];
                    }
                    if (row) {
                        var item = {
                            type: type,
                            query: row.query,
                            trackerId: row.trackerId,
                            title: row.torrent.title,
                            url: row.torrent.url,
                            time: parseInt(Date.now() / 1000)
                        };

                        chrome.storage.local.get({
                            clickHistory: []
                        }, function (storage) {
                            var pos = -1;
                            storage.clickHistory.some(function (item, index) {
                                if (item.query === item.query && item.url === title.url) {
                                    pos = index;
                                    return true;
                                }
                            });
                            if (pos !== -1) {
                                storage.clickHistory.splice(pos, 1);
                            }
                            storage.clickHistory.unshift(item);
                            storage.clickHistory.splice(300);
                            chrome.storage.local.set(storage);
                        });
                    }
                }
            };

            var Table = function () {
                var cells = ['date', 'title', 'size', 'seed', 'peer'];
                var sortCells = [];

                var getHeadRow = function () {
                    var wrappedCells = {};
                    var sortedCell = null;

                    var sort = function (direction) {
                        if (this === sortedCell) {
                            if (this.sortDirection > 0) {
                                this.sortDirection = -1;
                            } else {
                                this.sortDirection = 1;
                            }
                        } else
                        if (sortedCell) {
                            this.sortDirection = 0;
                            sortedCell.node.classList.remove('cell-sort-up');
                            sortedCell.node.classList.remove('cell-sort-down');
                        }

                        if (direction) {
                            this.sortDirection = direction;
                        }

                        if (this.sortDirection > 0) {
                            this.node.classList.remove('cell-sort-down');
                            this.node.classList.add('cell-sort-up');
                        } else {
                            this.node.classList.remove('cell-sort-up');
                            this.node.classList.add('cell-sort-down');
                        }

                        sortedCell = this;

                        sortCells.splice(0);
                        sortCells.push([this.type, this.sortDirection]);

                        chrome.storage.local.set({
                            sortCells: sortCells
                        });

                        insertSortedRows();
                    };

                    var nodes = dom.el('div', {
                        class: ['row', 'head__row'],
                        on: ['click', function (e) {
                            var child = dom.closestNode(this, e.target);
                            if (child) {
                                e.preventDefault();
                                var row = wrappedCells[child.dataset.type];
                                row.sort();
                            }
                        }]
                    });

                    cells.forEach(function (type) {
                        var node = dom.el('a', {
                            class: ['cell', 'row__cell', 'cell-' + type],
                            href: '#cell-' + type,
                            data: {
                                type: type
                            },
                            append: [
                                dom.el('span', {
                                    class: ['cell__title'],
                                    text: chrome.i18n.getMessage('row_' + type)
                                }),
                                dom.el('i', {
                                    class: ['cell__sort']
                                })
                            ]
                        });
                        wrappedCells[type] = {
                            type: type,
                            sortDirection: 0,
                            node: node,
                            sort: sort
                        };
                        nodes.appendChild(node);
                    });

                    return {
                        node: dom.el('div', {
                            class: ['table__head'],
                            append: nodes
                        }),
                        cellTypeCell: wrappedCells
                    };
                };

                var normalizeTorrent = function (/**torrent*/torrent) {
                    if (torrent.size) {
                        torrent.size = parseInt(torrent.size);
                        if (isNaN(torrent.size)) {
                            torrent.size = null;
                        }
                    }
                    if (!torrent.size) {
                        torrent.size = 0;
                    }

                    if (torrent.seed) {
                        torrent.seed = parseInt(torrent.seed);
                        if (isNaN(torrent.seed)) {
                            torrent.seed = null;
                        }
                    }
                    if (!torrent.seed) {
                        torrent.seed = 1;
                    }

                    if (torrent.peer) {
                        torrent.peer = parseInt(torrent.peer);
                        if (isNaN(torrent.peer)) {
                            torrent.peer = null;
                        }
                    }
                    if (!torrent.peer) {
                        torrent.peer = 0;
                    }

                    if (torrent.date) {
                        torrent.date = parseInt(torrent.date);
                        if (isNaN(torrent.date)) {
                            torrent.date = null;
                        }
                    }
                    if (!torrent.date) {
                        torrent.date = 0;
                    }

                    if (!torrent.categoryTitle) {
                        torrent.categoryTitle = '';
                    }

                    torrent.titleLow = torrent.title.toLowerCase();
                    torrent.categoryTitleLow = torrent.categoryTitle.toLowerCase();
                    torrent.wordFilterLow = torrent.titleLow + ' ' + torrent.categoryTitleLow;

                    if (!torrent.categoryUrl) {
                        torrent.categoryUrl = '';
                    }

                    if (!torrent.downloadUrl) {
                        torrent.downloadUrl = '';
                    }
                };

                /**
                 * @typedef {Object} torrent
                 * @property {string} [categoryTitle]
                 * @property {string} [categoryUrl]
                 * @property {string} title
                 * @property {string} url
                 * @property {number} [size]
                 * @property {string} [downloadUrl]
                 * @property {number} [seed]
                 * @property {number} [peer]
                 * @property {number} [date]
                 *
                 * @property {string} titleLow
                 * @property {string} categoryTitleLow
                 * @property {string} wordFilterLow
                 */
                var getBodyRow = function (tracker, /**torrent*/torrent, index) {
                    var row = dom.el('div', {
                        class: ['row', 'body__row'],
                        data: {
                            trackerId: tracker.id,
                            filter: filter.getFilterValue(torrent)
                        }
                    });
                    cells.forEach(function (type) {
                        if (type === 'date') {
                            row.appendChild(dom.el('div', {
                                class: ['cell', 'row__cell', 'cell-' + type],
                                title: unixTimeToString(torrent.date),
                                text: unixTimeToFromNow(torrent.date)
                            }))
                        } else
                        if (type === 'title') {
                            var category = '';
                            if (torrent.categoryTitle) {
                                if (torrent.categoryUrl) {
                                    category = dom.el('a', {
                                        class: ['category'],
                                        target: '_blank',
                                        href: torrent.categoryUrl,
                                        text: torrent.categoryTitle
                                    });
                                } else {
                                    category = dom.el('span', {
                                        class: ['category'],
                                        text: torrent.categoryTitle
                                    });
                                }
                            }
                            row.appendChild(dom.el('div', {
                                class: ['cell', 'row__cell', 'cell-' + type],
                                append: [
                                    dom.el('div', {
                                        class: ['cell__title'],
                                        append: [
                                            dom.el('a', {
                                                class: ['title'],
                                                data: {
                                                    index: index
                                                },
                                                target: '_blank',
                                                href: torrent.url,
                                                text: torrent.title
                                            })
                                        ]
                                    }),
                                    category && dom.el('div', {
                                        class: ['cell__category'],
                                        append: [
                                            category
                                        ]
                                    })
                                ]
                            }))
                        } else
                        if (type === 'size') {
                            var downloadLink = filesize(torrent.size);
                            if (torrent.downloadUrl) {
                                downloadLink = dom.el('a', {
                                    class: ['cell__download'],
                                    data: {
                                        index: index
                                    },
                                    target: '_blank',
                                    href: torrent.downloadUrl,
                                    text: downloadLink + ' ' + String.fromCharCode(8595)
                                });
                            }
                            row.appendChild(dom.el('div', {
                                class: ['cell', 'row__cell', 'cell-' + type],
                                append: downloadLink
                            }));
                        } else
                        if (type === 'seed') {
                            row.appendChild(dom.el('div', {
                                class: ['cell', 'row__cell', 'cell-' + type],
                                text: torrent.seed
                            }))
                        } else
                        if (type === 'peer') {
                            row.appendChild(dom.el('div', {
                                class: ['cell', 'row__cell', 'cell-' + type],
                                text: torrent.peer
                            }))
                        }
                    });
                    return row;
                };

                var head = getHeadRow();
                var body = {
                    node: dom.el('div', {
                        class: ['body', 'table__body'],
                        on: [
                            ['mouseup', function (e) {
                                onLickClick(e.target, tableRows);
                            }]
                        ]
                    })
                };
                this.node = dom.el('div', {
                    class: ['table', 'table-results'],
                    append: [
                        head.node,
                        body.node
                    ]
                });

                chrome.storage.local.get({
                    sortCells: []
                }, function (storage) {
                    sortCells.splice(0);
                    sortCells.push.apply(sortCells, storage.sortCells);
                    sortCells.forEach(function (row) {
                        head.cellTypeCell[row[0]].sort(row[1]);
                    });
                });

                var tableRows = [];
                var tableSortedRows = [];

                var insertSortedRows = function () {
                    var sortedRows = tableRows.slice(0);
                    sortCells.forEach(function (item) {
                        var type = item[0];
                        var direction = item[1];
                        var sortFn = sortTypeMap[type](direction);
                        sortedRows.sort(sortFn);
                    });
                    sortInsertList(body.node, sortedRows, tableSortedRows);
                };

                this.insertReslts = function (tracker, query, results) {
                    results.forEach(function (item) {
                        /**
                         * @typedef {Object} tableRow
                         * @property {Element} node
                         * @property {string} query
                         * @property {torrent} torrent
                         * @property {string} trackerId
                         */
                        normalizeTorrent(item);
                        var node = getBodyRow(tracker, item, tableRows.length);
                        tableRows.push({
                            node: node,
                            query: query,
                            torrent: item,
                            trackerId: tracker.id
                        });
                    });
                    insertSortedRows();
                };

                ee.on('filterUpdate', function () {
                    for (var i = 0, /**tableRow*/row; row = tableRows[i]; i++) {
                        row.node.dataset.filter = filter.getFilterValue(row.torrent);
                    }
                });
            };

            table = new Table();
            results.textContent = '';
            results.appendChild(table.node);
        })();

        ee.on('search', function (query) {
            activeProfile.trackers.forEach(function (tracker) {
                tracker.worker && tracker.worker.search(query, function (response) {
                    if (response.success) {
                        table.insertReslts(tracker, query, response.results)
                    }
                });
            });
        });
    })();

    (function () {
        var main = document.querySelector('.menu__btn-main');
        main.addEventListener('click', function (e) {
            e.preventDefault();
            uiState.splice(0).forEach(function (state) {
                state.discard();
            });
            if (uiState.length > 0) {
                console.error('State is not empty!', uiState);
            }
        });
    })();

    // todo: rm me
    window.resetState = function () {
        uiState.splice(0).forEach(function (state) {
            state.discard();
        });
        if (uiState.length > 0) {
            console.error('State is not empty!', uiState);
        }
    };
});