const convertSelector = (selector, postProcess) => {
  const result = {
    selector: null,
    pipeline: [],
  };

  if (!Array.isArray(postProcess)) {
    postProcess = [];
  }

  if (typeof selector === 'string') {
    selector = {selector};
  }

  result.selector = selector.selector;

  if (typeof selector.childNodeIndex === 'number') {
    result.pipeline.push({
      name: 'getChild',
      args: [selector.childNodeIndex]
    });
  }

  if (selector.attr) {
    result.pipeline.push({
      name: 'getAttr',
      args: [selector.attr]
    });
  } else
  if (selector.prop) {
    result.pipeline.push({
      name: 'getProp',
      args: [selector.prop]
    });
  } else
  if (selector.html) {
    result.pipeline.push({
      name: 'getHtml'
    });
    result.pipeline.push({
      name: 'trim'
    });
  } else {
    result.pipeline.push({
      name: 'getText'
    });
    result.pipeline.push({
      name: 'trim'
    });
  }

  postProcess.forEach(item => {
    if (item === 'convertSize') {
      result.pipeline.push({
        name: 'legacySizeFormat',
      });
    } else
    if (item === 'replaceToday') {
      result.pipeline.push({
        name: 'legacyReplaceToday',
      });
    } else
    if (item === 'replaceMonth') {
      result.pipeline.push({
        name: 'legacyReplaceMonth',
      });
    } else
    if (item.name === 'replaceRe') {
      result.pipeline.push({
        name: 'replace',
        args: [item.re, item.text]
      });
    } else
    if (item.name === 'timeFormat') {
      result.pipeline.push({
        name: 'legacyParseDate',
        args: [item.format],
      });
    }
  });

  return result;
};

const convertCodeV2toV3 = /**CodeV2*/code => {
  const /**CodeStore*/codeV3 = {};

  codeV3.version = 3;


  const search = codeV3.search = {};

  search.url = code.search.searchUrl;

  const method = code.search.requestType;
  if (method) {
    search.method = method.toUpperCase();
  }

  const data = code.search.requestData;
  if (data) {
    if (search.method === 'POST') {
      search.body = data;
    } else {
      search.query = data;
    }
  }

  const onBeforeRequest = code.search.onBeforeRequest;
  if (Array.isArray(onBeforeRequest)) {
    onBeforeRequest.some(item => {
      if (item.name === 'encode') {
        if (item.type === 'cp1251') {
          search.encoding = item.type;
          return true;
        }
      }
    });
  }

  const baseUrl = code.search.baseUrl;
  if (baseUrl) {
    search.baseUrl = baseUrl;
  }

  const overrideMimeType = code.search.requestMimeType;
  if (overrideMimeType) {
    const m = /charset=([^;]+)/.exec(code.search.requestMimeType);
    if (m) {
      code.search.charset = m[1];
    }
  }


  const auth = codeV3.auth = {};

  const loginUrl = code.search.loginUrl;
  if (loginUrl) {
    auth.url = loginUrl;
  }

  const loginFormSelector = code.search.loginFormSelector;
  if (loginFormSelector) {
    auth.selector = {selector: loginFormSelector};
  }


  const selectors = codeV3.selectors = {};

  selectors.row = convertSelector(code.search.listItemSelector);

  if (codeV3.search.listItemSplice) {
    selectors.skipFromStart = code.search.listItemSplice[0];
    selectors.skipFromEnd = code.search.listItemSplice[1] * -1;
  }

  code.search.onGetValue = code.search.onGetValue || {};

  selectors.categoryTitle = convertSelector(code.search.torrentSelector.categoryTitle, code.search.onGetValue.categoryTitle);
  selectors.categoryUrl = convertSelector(code.search.torrentSelector.categoryUrl, code.search.onGetValue.categoryUrl);
  selectors.categoryId = convertSelector(code.search.torrentSelector.categoryId, code.search.onGetValue.categoryId);
  selectors.title = convertSelector(code.search.torrentSelector.title, code.search.onGetValue.title);
  selectors.url = convertSelector(code.search.torrentSelector.url, code.search.onGetValue.url);
  selectors.size = convertSelector(code.search.torrentSelector.size, code.search.onGetValue.size);
  selectors.downloadUrl = convertSelector(code.search.torrentSelector.downloadUrl, code.search.onGetValue.downloadUrl);
  selectors.seeds = convertSelector(code.search.torrentSelector.seed, code.search.onGetValue.seed);
  selectors.peers = convertSelector(code.search.torrentSelector.peer, code.search.onGetValue.peer);
  selectors.date = convertSelector(code.search.torrentSelector.date, code.search.onGetValue.date);

  selectors.nextPageUrl = convertSelector(code.search.nextPageSelector, code.search.onGetValue.nextPageSelector);


  const description = codeV3.description = {};

  description.icon = code.icon;
  description.name = code.title;

  if (code.desc) {
    description.description = code.desc;
  }

  if (code.downloadUrl) {
    description.downloadUrl = code.downloadUrl;
  }

  description.version = code.tVersion;


  ['onBeforeRequest', 'onAfterRequest', 'onBeforeDomParse', 'onAfterDomParse', 'onGetListItem'].forEach(key => {
    const value = code.search[key];
    if (typeof value === 'function') {
      search[key] = value;
    }
  });

  ['onSelectorIsNotFound', 'onEmptySelectorValue', 'onGetValue'].forEach(sectionName => {
    const codeSearchSection = code.search[sectionName];
    for (let key in codeSearchSection) {
      const value = codeSearchSection[key];
      if (typeof value === 'function') {
        let section = search[sectionName];
        if (!section) {
          section = search[sectionName] = {};
        }
        section[key] = value;
      }
    }
  });


  return codeV3;
};

export default convertCodeV2toV3;