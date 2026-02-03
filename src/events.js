
/**
 * Events
 * 
 * Handles initialization and event-related functionalities.
 */


function init() {
  if (app.state.youlag.init) return;
  
  clearPathHash();
  setBodyClass();
  if (isFeedPage()) {
    setupClickListener();
    setupVisibilityEventListeners();
    setupTagsDropdownOverride();
    renderToolbar();
    if (isLayoutVideo()) {
      updateVideoAuthor();
      updateVideoDateFormat();
      if (isWatchLaterPage()) {
        setWatchLaterCategoryFilter();
      }
    }
    onNewFeedItems();
    restoreVideoQueue();
  }
  updateSidenavLinks();
  settingsPageEventListeners();
  setVideoLabelsTitle('playlists', 'Playlists');
  setVideoLabelsTitle('watch_later', 'Watch later');
  updateAddFeedLink();
  setAddFeedCategoryValue();
  setMissingLogo();
  showUpdateAvailableNotice();
  handleExperimentalFeature(); // TODO: Temporary handler for experimental features, remove later.
  removeYoulagLoadingState();

  app.state.youlag.init = true;
}

function setupVisibilityEventListeners() {
  // Handle visibility change events, e.g. when the user switches tabs and returns from a hidden state.
  document.addEventListener('visibilitychange', function () {

    if (document.visibilityState === 'visible') {
      restoreModalEventListeners();
    }
  });
}

function handleExperimentalFeature() {
  // Temporary handler for experimental features.

  // Hide the category filter toggle if the feature is disabled.
  const rootStyles = getComputedStyle(document.documentElement);
  const categoryFilterFeature = rootStyles.getPropertyValue('--yl-experimental-feature--category-filter').trim();
  if (categoryFilterFeature === 'visible') {
    console.info('%cYoulag: Experimental feature "Category filter" for Watch later (Favorite) page is enabled.', 'color: #2196f3; font-weight: bold');
    document.getElementById('yl_stream_category_filter_toggle').style.setProperty('display', 'flex', 'important');
  }
}

function removeYoulagLoadingState() {
  // By default, the youlag CSS is set to a loading state.
  // This will remove the loading state when the script is ready.
  document.body.classList.add('youlag-loaded');
}

function initFallback() {
  // NOTE: Using FreshRSS' `freshrss:globalContextLoaded` event hasn't been reliable, thus this fallback method.
  if (document.readyState === 'complete' || document.readyState === 'interactive' || app.state.youlag.init === true) {
    init();
  }
  else {
    document.addEventListener('DOMContentLoaded', init);
    window.addEventListener('load', init);
  }
}

// Fallback interval check
const checkInitInterval = setInterval(() => {
  if (document.readyState === 'complete' || app.state.youlag.init === true) {
    init();
    clearInterval(checkInitInterval);
  }
}, 1000);

// Ensure init runs
initFallback();
