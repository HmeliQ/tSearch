import {inject, observer} from "mobx-react";
import React from "react";
import getTrackerIconClassName from "../tools/getTrackerIconClassName";
import blankSvg from "../assets/img/blank.svg";
import PropTypes from "prop-types";
import RootStore from "../stores/RootStore";
import {ProfilesTrackerStore} from "../stores/ProfilesItemStore";
import ProfileStore from "../stores/ProfileStore";
import {TrackerSessionStore} from '../stores/SearchStore';

@inject('rootStore')
@observer
class ProfileTracker extends React.Component {
  constructor(props) {
    super(props);

    this.handleClick = this.handleClick.bind(this);
  }

  componentDidMount() {
    if (this.tracker) {
      this.tracker.attach();
    }
  }

  componentWillUnmount() {
    if (this.tracker) {
      this.tracker.deattach();
    }
  }

  get tracker() {
    const id = this.props.id;
    return this.props.rootStore.trackers.trackers.get(id);
  }

  handleClick(e) {
    e.preventDefault();

    const wasSelected = this.props.profileStore.isSelectedTracker(this.props.id);
    this.props.profileStore.clearSelectedTrackers();
    if (!wasSelected) {
      this.props.profileStore.addSelectedTracker(this.props.id);
    }
  }

  render() {
    if (!this.tracker) {
      return (
        <div className="tracker">
          Not found
        </div>
      );
    }

    switch (this.tracker && this.tracker.state) {
      case 'pending': {
        return (
          <div className="tracker">
            Loading...
          </div>
        );
      }
      case 'error': {
        return (
          <div className="tracker">
            Error
          </div>
        );
      }
      case 'done': {
        const iconClassList = ['tracker__icon'];

        iconClassList.push(getTrackerIconClassName(this.tracker.id));

        const searchSession = this.props.trackerSearchSession;
        if (searchSession) {
          if (searchSession.state === 'pending') {
            iconClassList.push('tracker__icon-loading');
          } else
          if (searchSession.state === 'error') {
            iconClassList.push('tracker__icon-error');
          }
        }

        let icon = null;
        if (this.tracker.meta.trackerURL) {
          iconClassList.push('tracker__link');
          icon = (
            <a className={iconClassList.join(' ')} target="_blank" href={this.tracker.meta.trackerURL}/>
          );
        } else {
          icon = (
            <div className={iconClassList.join(' ')}/>
          );
        }

        let searchState = null;
        if (searchSession) {
          if (searchSession.authRequired) {
            searchState = (
              <a className="tracker__login" target="_blank" href={searchSession.authRequired.url}
                 title={chrome.i18n.getMessage('login')}/>
            );
          } else {
            const count = searchSession.search.getResultCountByTrackerId(this.tracker.id);
            const visibleCount = searchSession.search.getVisibleResultCountByTrackerId(this.tracker.id);

            let text = '';
            if (count === visibleCount) {
              text = count;
            } else {
              text = visibleCount + '/' + count;
            }
            searchState = (
              <div className="tracker__counter">{text}</div>
            )
          }
        }

        const iconUrl = this.tracker.getIconUrl() || blankSvg;

        const classList = ['tracker'];
        if (this.props.profileStore.isSelectedTracker(this.props.id)) {
          classList.push('tracker-selected');
        }

        return (
          <div className={classList.join(' ')}>
            {icon}
            <a className="tracker__name" href={'#' + this.tracker.id}
               onClick={this.handleClick}>{this.tracker.meta.name}</a>
            {searchState}
            <style>{`.${getTrackerIconClassName(this.tracker.id)}{background-image:url(${iconUrl})}`}</style>
          </div>
        );
      }
      default: {
        return (
          <div className="tracker">
            Idle
          </div>
        );
      }
    }
  }
}

ProfileTracker.propTypes = null && {
  rootStore: PropTypes.instanceOf(RootStore),
  id: PropTypes.string,
  profileStore: PropTypes.instanceOf(ProfileStore),
  profileTracker: PropTypes.instanceOf(ProfilesTrackerStore),
  trackerSearchSession: PropTypes.instanceOf(TrackerSessionStore),
};

export default ProfileTracker;