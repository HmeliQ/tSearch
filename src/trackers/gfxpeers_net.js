// ==UserScript==
// @name GFX Peers
// @icon https://gfxpeers.net/favicon.ico
// @trackerURL https://gfxpeers.net
// @version 1.02
// @connect *://gfxpeers.net
// @require exKit
// ==/UserScript==

const code = {
  "version": 3,
  "type": "kit",
  "description": {"icon": "https://gfxpeers.net/favicon.ico", "name": "GFX Peers", "version": "1.02"},
  "search": {
    "url": "https://gfxpeers.net/torrents.php?searchstr=%search%&order_by=time&order_way=desc&action=basic&searchsubmit=1",
    "method": "GET"
  },
  "selectors": {
    "row": {"selector": "#torrent_table > tbody  > tr "},
    "title": {
      "selector": "tr.torrent > td.big_info > div > a",
      "pipeline": [{"name": "getText"}]
    },
    "url": {
      "selector": "tr.torrent > td.big_info > div > a",
      "pipeline": [{"name": "getProp", "args": ["href"]}]
    },
    "size": {
      "selector": "tr.torrent > td.number_column.nobr",
      "pipeline": [{"name": "getText"}, {"name": "parseSize"}]
    },
    "seeds": {
      "selector": "td:eq(6)",
      "pipeline": [{"name": "getText"}, {"name": "toInt"}]
    },
    "peers": {
      "selector": "td:eq(7)",
      "pipeline": [{"name": "getText"}, {"name": "toInt"}]
    },
//    "date": {"selector": "td:eq(3)", "pipeline": [{"name": "getText"}]}
        "date": {
      "selector": "td:eq(3)>span",
      "pipeline": [
        {"name": "getAttr", "args": ["title"]},
        {
          "name": "replaceRe",
          "args": ["([a-zA-Z]*) ([0-9]*) (.*)", "$2 $1 $3"]
        },
        {"name": "legacyReplaceMonth"},
        {"name": "legacyParseDate", "args": ["1"]}
      ]
    },
        "downloadUrl": {
     	 "selector": "td.big_info > div > span > a:eq(0)",
     	 "pipeline": [{"name": "getAttr", "args": ["href"]}]
    },a
  }
};

API_exKit(code);
