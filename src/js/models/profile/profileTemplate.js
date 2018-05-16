import {types, getParent} from "mobx-state-tree";

/**
 * @typedef {{}} ProfileTemplateM
 * Model:
 * @property {string} name
 * @property {ProfileTemplateTrackerM[]} trackers
 * Actions:
 * @property {function(ProfileTemplateTrackerM[])} setTrackers
 * Views:
 * @property {function:Map<string,ProfileTemplateTrackerM>} getTrackerMap
 * @property {function(string,string,string):Promise} moveTracker
 */

/**
 * @typedef {{}} ProfileTemplateTrackerM
 * Model:
 * @property {string} id
 * @property {{name:string,[downloadURL]:string}} meta
 * Actions:
 * Views:
 */

const profileTemplateModel = types.model('profileTemplateModel', {
  name: types.identifier(types.string),
  trackers: types.optional(types.array(types.model('profileTemplateTrackerModel', {
    id: types.string,
    meta: types.model('profileItemTrackerMetaModel', {
      name: types.string,
      downloadURL: types.maybe(types.string),
    }),
  })), []),
}).actions(/**ProfileTemplateM*/self => {
  return {
    setTrackers(trackers) {
      self.trackers = trackers;
    }
  };
}).views(/**ProfileTemplateM*/self => {
  return {
    getTrackerMap() {
      const map = new Map();
      self.trackers.forEach(trackerTemplate => {
        map.set(trackerTemplate.id, trackerTemplate);
      });
      return map;
    },
    moveTracker(id, prevId, nextId) {
      const indexModel = /**@type IndexM*/getParent(self, 2);
      const list = self.trackers.slice(0);
      const map = self.getTrackerMap();

      const item = map.get(id);
      const prevItem = map.get(prevId);
      const nextItem = map.get(nextId);

      const index = list.indexOf(item);

      list.splice(index, 1);

      if (prevItem) {
        const pos = list.indexOf(prevItem);
        if (pos !== -1) {
          list.splice(pos + 1, 0, item);
        }
      } else
      if (nextItem) {
        const pos = list.indexOf(nextItem);
        if (pos !== -1) {
          list.splice(pos, 0, item);
        }
      } else {
        list.push(item);
      }

      self.setTrackers(list);
      return indexModel.saveProfiles();
    },
  };
});

export default profileTemplateModel;