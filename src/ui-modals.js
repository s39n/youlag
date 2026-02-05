/**
 * UI: Modals
 * 
 * Handles disclosures for both videos and articles,
 * such as modals and accordion/expansion panels.
 * 
 * NOTE: For simplicity, both the video modal and article expansion panels are referred to as "modal" in this context.
 */

function handleActiveVideo(eventOrVideoObject, isVideoObject = false) {
  // Handles activation of a feed item (video or article) and opens the video modal.
  
  app.state.modal.miniplayerScrollTop = 0;
  let videoObject;

  if (isVideoObject) {
    let queueObj = eventOrVideoObject;
    const activeVideo = queueObj.queue[queueObj.queue_active_index];
    if (!activeVideo) return;
    videoObject = { ...activeVideo };
  }
  else {
    // Extract the feed item from the DOM event/element
    const feedItem = (eventOrVideoObject instanceof Event)
      ? eventOrVideoObject.target.closest(app.frss.el.entry)
      : eventOrVideoObject.closest(app.frss.el.entry);
    if (!feedItem) return;

    videoObject = extractFeedItemData(feedItem);
    videoObject.feedItemEl = feedItem;
    setVideoQueue(videoObject);
  }

  if (!isModeMiniplayer()) setModeFullscreen(true);
  renderModalVideo(videoObject);
}

function renderModalVideo(videoObject) {
  // Create custom modal
  let modal = getModalVideo();

  if (!modal) {
    modal = templateModalVideo(videoObject);
    document.body.appendChild(modal);
    if (isModeFullscreen()) setModalState(true);
  }

  if (!modal._videoModalListeners) {
    // Track modal event listeners for later removal
    modal._videoModalListeners = [];
  }
  else {
    // Remove all previous listeners before updating content
    for (const {el, type, handler} of modal._videoModalListeners) {
      el.removeEventListener(type, handler);
    }
    modal._videoModalListeners.length = 0;
  }

  // If modal already exists, just update the container with new content.
  modal.querySelector(`.${app.modal.class.container}`).innerHTML = templateModalVideo(videoObject, 'container');
  
  setPageTitle(videoObject.title);

  setModalType(videoObject);

  renderModalVideoChapters(videoObject.video_chapters);
  setupModalVideoControlEventListeners();

  setupModalVideoEventListeners(videoObject); // Handles: Close, Minimize, Favorite, Tags, Escape key.

  renderRelatedVideos(videoObject);

  pushHistoryState('modalOpen', true); // Allow modal close when navigating back by adding a new history state.
}

function templateModalVideo(videoObject, elementToReturn = 'modal') {
  // Prepare and return the video modal element.

  // TODO: Refactor to abstract smaller components.

  // Setup DOM structure for video modal.
  let modal = document.createElement('div');
  let container = document.createElement('div');
  container.classList.add(app.modal.class.container);
  modal.id = app.modal.id.root;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('data-entry', videoObject.entryId);
  modal.appendChild(container);

  // Video: playback source state handling
  const videoSourceDefault = videoObject.video_source_default;
  const youtubeSelected = videoSourceDefault === 'youtube' ? 'selected' : '';
  const invidiousSelected = videoSourceDefault === 'invidious_1' ? 'selected' : '';
  const invidiousBaseUrl = videoObject.video_invidious_instance_1;

  // Video: Embed URL handling
  function getEmbedUrl(source) {
    // Get the correct embed URL for a given source
    if (source === 'invidious_1' && videoObject.video_invidious_instance_1 && videoObject.youtubeId) {
      return `${videoObject.video_invidious_instance_1.replace(/\/$/, '')}/embed/${videoObject.youtubeId}`;
    }
    else if (source === 'youtube') {
      return videoObject.youtube_embed_url;
    }
    return '';
  }

  const videoSourceDefaultNormalized = videoSourceDefault === 'invidious_1' ? 'invidious_1' : 'youtube';
  const defaultEmbedUrl = getEmbedUrl(videoSourceDefaultNormalized);

  // Article: Thumbnail presence state handling
  modal.classList.remove('youlag-modal-feed-item--has-thumbnail', 'youlag-modal-feed-item--no-thumbnail');
  videoObject.thumbnail
    ? modal.classList.add('youlag-modal-feed-item--has-thumbnail')
    : modal.classList.add('youlag-modal-feed-item--no-thumbnail');
  
  // Video: Description box state handling
  const isMobile = window.innerWidth <= app.breakpoints.desktop_md_max; 
  const isArticle = !videoObject.youtubeId;
  const relatedVideosSource = getRelatedVideosSetting();
  const shouldCollapseDescription = isMobile && !isArticle && relatedVideosSource !== 'none';

  // Modal content
  container.innerHTML = `
    <div class="${app.modal.class.content}">

      <div class="youlag-video-header">
        <select id="${app.modal.id.source}" class="${invidiousBaseUrl && videoObject.isVideoFeedItem ? '' : 'display-none'}">
          <option value="youtube" ${youtubeSelected}>YouTube</option>
          <option value="invidious_1" ${invidiousSelected}>Invidious</option>
        </select>

        <button id="${app.modal.id.minimize}" title="Minimize or expand">⧉</button>
        <button id="${app.modal.id.close}" title="Close">×</button>
      </div>

      <div class="youlag-video-container">
        <div class="youlag-thumbnail-container">
          <img src="${videoObject.thumbnail}" class="youlag-video-thumbnail" loading="lazy" />
        </div>
        <div class="youlag-iframe-container">
          <iframe id="${app.modal.id.videoIframe}"
                  class="youlag-iframe"
                  data-yl-video-source="${videoSourceDefaultNormalized}"
                  src="${defaultEmbedUrl}" frameborder="0" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen>
          </iframe>
        </div>
      </div>

      <div class="yl-video-blur-backdrop-effect">
        <img src="${videoObject.thumbnail}" class="yl-video-blur-backdrop-effect__image" loading="lazy" />
      </div>

      <div id="${app.modal.id.chapterContainer}" class="${Array.isArray(videoObject?.video_chapters) && videoObject?.video_chapters.length > 0 ? '' : 'display-none'}">
        <div id="${app.modal.id.chapterCurrent}" class="yl-video-chapter-current">
          <div id="${app.modal.id.chapterCurrentProgress}"></div>

          <div id="${app.modal.id.chapterPanel}">          
            <div id="ylVideoChapterToggle">
              <img src="${app.frss.img.chevronDown}" class="yl-video-chapter-toggle-icon" loading="lazy" />
            </div>
            <span class="yl-video-chapter-current__order yl-badge"></span>
            <span class="yl-video-chapter-current__label"></span>
          </div>

          <div id="${app.modal.id.chapterActionContainer}" class="yl-video-chapter-action-container">
            <div id="${app.modal.id.chapterActionPrevious}"
                    class="yl-video-chapter-action is-disabled"
                    role="button">
              <span class="yl-video-chapter-action__icon yl-video-chapter-action__icon--previous"></span>
            </div>
            <div id="${app.modal.id.chapterActionNext}"
                    class="yl-video-chapter-action"
                    role="button">
              <span class="yl-video-chapter-action__icon yl-video-chapter-action__icon--next"></span>
            </div>
          </div>
        </div>
      </div>

      <div class="youlag-video-details">

        <div class="youlag-video-metadata-container">
          <h2 class="youlag-video-metadata-title">${videoObject.title}</h2>
          <div class="youlag-video-metadata-panel">

            <section class="youlag-video-author-section">
              <a class="youlag-video-metadata-favicon-link" href="${videoObject.author_filter_url}">
                <img src="${videoObject.favicon}" class="youlag-video-metadata-favicon" />
              </a>

              <div class="yl-flex yl-flex-col">
                <div class="youlag-video-metadata-author">
                  <a href="${videoObject.author_filter_url}">${videoObject.website_name}</a>
                </div>
                <div class="youlag-video-metadata-date">${videoObject.date}</div>
              </div>
            </section>

            <section class="youlag-video-actions-container">
              <a href="#" 
                class="yl-video-action-button ${app.modal.class.favorite} ${app.modal.class.favorite}--${videoObject.favorited}"
                id="${app.modal.id.favorite}">
                <div class="youlag-favorited-icon"></div>
              </a>

              <a href="#" 
                class="yl-video-action-button"
                id="${app.modal.id.tags}">
                <img class="icon" src="../themes/icons/label.svg" loading="lazy" alt="🏷️">
              </a>

              <a class="yl-video-action-button" href="${videoObject.external_link}" target="_blank">
                <span class="yl-video-action-button__icon">🌐</span><span>Source</span>
              </a>

              <a class="yl-video-action-button" href="${videoObject.video_youtube_url}" target="_blank">
                <span class="yl-video-action-button__icon">▶️</span><span>YouTube</span>
              </a>
              <a class="yl-video-action-button" href="${videoObject.video_invidious_redirect_url}" target="_blank">
                <span class="yl-video-action-button__icon">📺</span><span>Invidious</span>
              </a>

            </section>

          </div>

        </div>


        <div id="${app.modal.id.moreContainer}">
          <div
            class="${app.modal.class.descContainer} ${shouldCollapseDescription ? app.modal.class.descContainerCollapsed : ''}">
            ${videoObject.video_description}
          </div>
          <div id="${app.modal.id.relatedContainer}" class="youlag-video-related-container display-none">
            <h3 class="youlag-video-related-title">
              <span class="yl-form-category__original-label">More from favorites</span>
              <span class="yl-form-category__video-label">Watch more</span>
            </h3>
          </div>
        </div>
        
      </div>

    </div>
  `;

  if (elementToReturn === 'container') {
    return container.innerHTML;
  }

  return modal;
}

function handleModalDescription(videoObject) {
  // Video: Description box collapse state handling
  const modal = getModalVideo();
  if (!modal || !videoObject) return;

  const shouldCollapseDescription = isMobile() && videoObject.youtubeId && getRelatedVideosSetting() !== 'none';

  videoDescContainer = modal.querySelector(`.${app.modal.class.descContainer}`);
  if (
      videoDescContainer && 
      videoDescContainer.offsetHeight <= 90 &&
      !isModeMiniplayer()
    ) {
    // The description box is collapsed by default on mobile(`shouldCollapseDescription`),
    // but check if it is short enough to not need collapsing.
    videoDescContainer.classList.remove(app.modal.class.descContainerCollapsed);
  }
  if (
    shouldCollapseDescription && videoDescContainer && videoDescContainer.offsetHeight > 90 || 
    shouldCollapseDescription && isModeMiniplayer()) {
    setupModalDescriptionEventListeners();
  }
}

function renderModalVideoChapters(videoChapters) {
  // Appends video chapters to the video modal.
  const modal = getModalVideo();
  const chapterContainer = modal.querySelector(`#${app.modal.id.chapterContainer}`);
  const iframe = modal.querySelector(`#${app.modal.id.videoIframe}`);
  const videoSource = iframe?.getAttribute('data-yl-video-source');

  if (!modal || !videoChapters || videoChapters.length === 0) {
    if (chapterContainer) chapterContainer.remove();
    return;
  }
  if (!chapterContainer) return;

  // Chapter only supported for YouTube as playback source.
  if (videoSource !== 'youtube') chapterContainer.classList.add('display-none');

  // List all chapters
  const chapterList = document.createElement('div');
  chapterList.id = app.modal.id.chapterList;
  chapterList.classList.add(app.modal.class.chapterList);

  videoChapters.forEach(chapter => {
    const item = document.createElement('div');
    item.classList.add('yl-video-chapter-list-item');
    item.setAttribute('data-seconds', chapter.seconds);
    item.setAttribute('data-order', chapter.order);
    item.innerHTML = `
      <span class="yl-video-chapter-list-item__time yl-badge">${chapter.timestamp}</span>
      <span class="yl-video-chapter-list-item__label">${chapter.label}</span>
    `;
    chapterList.appendChild(item);
  });

  chapterContainer.appendChild(chapterList);
}

function setupModalVideoControlEventListeners() {
  // Attach click event listeners to chapter items for seeking
  const modal = getModalVideo();
  if (!modal) return;

  if (!modal._videoModalListeners) modal._videoModalListeners = [];
  
  // Remove existing listeners for chapter list items
  if (modal._videoModalListeners && Array.isArray(modal._videoModalListeners)) {
    modal._videoModalListeners = modal._videoModalListeners.filter(listener => {
      if (
        listener.type === 'click' &&
        listener.el &&
        listener.el.classList &&
        listener.el.classList.contains('yl-video-chapter-list-item')
      ) {
        listener.el.removeEventListener(listener.type, listener.handler);
        return false;
      }
      return true;
    });
  }


  // Remove existing click listener for chapters current panel.
  const chapterCurrent = modal.querySelector(`#${app.modal.id.chapterCurrent}`);
  if (modal._videoModalListeners && Array.isArray(modal._videoModalListeners)) {
    modal._videoModalListeners = modal._videoModalListeners.filter(listener => {
      if (
        listener.type === 'click' &&
        listener.el === chapterCurrent
      ) {
        listener.el.removeEventListener(listener.type, listener.handler);
        return false;
      }
      return true;
    });
  }

  // Attach new chapter click listeners.
  const chapterItems = modal.querySelectorAll('.yl-video-chapter-list-item');
  chapterItems.forEach(item => {
    const seconds = parseInt(item.getAttribute('data-seconds'), 10);
    const chapterClickHandler = function(e) {
      e.preventDefault();
      chapterItems.forEach(i => i.classList.remove('is-active')); // Clear previous active state
      item.classList.add('is-active');
      updateChapterActionButtons();
      videoControlSeekTo(seconds, true);
    };
    item.addEventListener('click', chapterClickHandler);
    modal._videoModalListeners.push({ el: item, type: 'click', handler: chapterClickHandler });
  });

  const chapterActionPrevious = modal.querySelector(`#${app.modal.id.chapterActionPrevious}`);
  const chapterActionNext = modal.querySelector(`#${app.modal.id.chapterActionNext}`);
  const chapterItemsArr = Array.from(modal.querySelectorAll('.yl-video-chapter-list-item'));

  function updateChapterActionButtons() {
    // Set chapter skip button states
    let activeIndex = chapterItemsArr.findIndex(item => item.classList.contains('is-active'));
    if (activeIndex === -1) activeIndex = 0;
    if (chapterActionPrevious) chapterActionPrevious.classList.toggle('is-disabled', activeIndex === 0);
    if (chapterActionNext) chapterActionNext.classList.toggle('is-disabled', activeIndex === chapterItemsArr.length - 1);
  }

  // Chapter skip button initial state
  updateChapterActionButtons();

  // Chapter skip handlers for previous/next buttons
  function handleChapterSkip(direction) {
    const activeIndex = chapterItemsArr.findIndex(item => item.classList.contains('is-active'));
    const targetIndex = activeIndex + direction;
    if (targetIndex < 0 || targetIndex >= chapterItemsArr.length) return;
    const targetItem = chapterItemsArr[targetIndex];
    if (targetItem) {
      const seconds = parseInt(targetItem.getAttribute('data-seconds'), 10);
      videoControlSeekTo(seconds, true);
      chapterItemsArr.forEach((item, idx) => item.classList.toggle('is-active', idx === targetIndex));
      updateChapterActionButtons();
    }
  }

  if (chapterActionPrevious) {
    const prevHandler = e => { e.preventDefault(); handleChapterSkip(-1); };
    chapterActionPrevious.addEventListener('click', prevHandler);
    modal._videoModalListeners.push({ el: chapterActionPrevious, type: 'click', handler: prevHandler });
  }
  if (chapterActionNext) {
    const nextHandler = e => { e.preventDefault(); handleChapterSkip(1); };
    chapterActionNext.addEventListener('click', nextHandler);
    modal._videoModalListeners.push({ el: chapterActionNext, type: 'click', handler: nextHandler });
  }

  // Toggle chapter list visibility by clicking the current chapter.
  const chapterCurrentPanel = modal.querySelector(`#${app.modal.id.chapterPanel}`);
  const chapterList = modal.querySelector(`#${app.modal.id.chapterList}`);
  const chapterCurrentClickHandler = function(e) {
    e.preventDefault();
    if (!chapterCurrent) return;
    const isExpanded = chapterCurrent.classList.contains('is-expanded');
    if (isExpanded) {
      chapterCurrent.classList.remove('is-expanded');
    }
    else {
      chapterCurrent.classList.add('is-expanded');
      // Scroll to the active chapter.
      if (chapterList) {
        const activeItem = chapterList.querySelector('.yl-video-chapter-list-item.is-active');
        if (activeItem) {
          const listRect = chapterList.getBoundingClientRect();
          const itemRect = activeItem.getBoundingClientRect();
          const scrollTop = chapterList.scrollTop;
          const offset = itemRect.top - listRect.top - (listRect.height / 2) + (itemRect.height / 2);
          chapterList.scrollTo({ top: scrollTop + offset, behavior: 'smooth' });
        }
      }
    }
  };
  if (chapterCurrentPanel) {
    chapterCurrentPanel.addEventListener('click', chapterCurrentClickHandler);
    modal._videoModalListeners.push({ el: chapterCurrentPanel, type: 'click', handler: chapterCurrentClickHandler });
  }

  // Display the current chapter
  updateActiveChapterDisplay();
}

function updateActiveChapterDisplay() {
  const modal = getModalVideo();
  if (!modal) return;
  const chapterActive = modal.querySelector(`#${app.modal.id.chapterCurrent}`);
  const chapterActiveTime = chapterActive?.querySelector('.yl-video-chapter-current__order');
  const chapterActiveLabel = chapterActive?.querySelector('.yl-video-chapter-current__label');
  const chapterCurrentProgress = chapterActive?.querySelector(`#${app.modal.id.chapterCurrentProgress}`);
  const chapterItems = modal.querySelectorAll('.yl-video-chapter-list-item');
  const chapters = Array.from(chapterItems).map(item => ({
    seconds: parseInt(item.getAttribute('data-seconds'), 10),
    label: item.querySelector('.yl-video-chapter-list-item__label')?.textContent || '',
    timestamp: item.querySelector('.yl-video-chapter-list-item__time')?.textContent || ''
  }));
  let lastChapterIndex = -1;
  let videoDuration = null;

  if (chapterItems.length > 0) {
    // Only set initial state if not dirty
    if (chapterActive.getAttribute('data-yl-dirty') !== 'true') {
      chapterItems.forEach((item, index) => {
        if (index === 0) {
          item.classList.add('is-active');
        }
        else {
          item.classList.remove('is-active');
        }
      });
      if (chapters.length > 0 && chapterActiveTime && chapterActiveLabel) {
        chapterActiveTime.textContent = `1 / ${chapters.length}`;
        chapterActiveLabel.textContent = chapters[0].label;
      }
      chapterActive.setAttribute('data-yl-dirty', 'true');
    }
  }

  // Update active chapter based on video playback time
  if (chapterActive && chapterActiveTime && chapterActiveLabel) {
    const iframe = modal.querySelector(`#${app.modal.id.videoIframe}`);
    if (iframe) {
      const onIframeLoad = function() {
        try {
          iframe.contentWindow.postMessage(JSON.stringify({ event: "listening" }), "*");
        }
        catch (e) {
          console.warn("Youlag: Video chapter failed to send 'listening' event after load", e);
        }
        modal._chapterUpdateInterval = setInterval(() => {
          // Capture playback time from YouTube iframe
          iframe.contentWindow.postMessage(
            '{"event":"command","func":"getCurrentTime","args":[]}', '*'
          );
        }, 1000);
      };
      iframe.addEventListener('load', onIframeLoad);
      if (iframe.readyState === 'complete' || iframe.readyState === 'interactive') {
        onIframeLoad();
      }
      modal._videoModalListeners.push({ el: iframe, type: 'load', handler: onIframeLoad });
    }
    function setActiveChapter(currentTime) {
      if (!chapterActiveTime || !chapterActiveLabel || chapters.length === 0) {
        return;
      }
      let activeIndex = chapters.length - 1;
      for (let i = 0; i < chapters.length; i++) {
        if (currentTime < chapters[i].seconds) {
          activeIndex = i - 1;
          break;
        }
      }
      if (activeIndex < 0) activeIndex = 0;
      if (activeIndex !== lastChapterIndex) {
        chapterActiveTime.textContent = `${activeIndex + 1} / ${chapters.length}`;
        chapterActiveLabel.textContent = chapters[activeIndex].label;
        lastChapterIndex = activeIndex;
      }
      chapterItems.forEach((item, index) => {
        if (index === activeIndex) {
          item.classList.add('is-active');
        }
        else {
          item.classList.remove('is-active');
        }
      });

      // Update chapter progress bar
      const isVideoChapterProgressEnabledElement = document.querySelector('#yl_chapter_progress_enabled');
      const isVideoChapterProgressEnabled = isVideoChapterProgressEnabledElement?.getAttribute('data-yl-chapter-progress-enabled') === 'true';
      if (chapterCurrentProgress && isVideoChapterProgressEnabled) {
        let chapterStart = chapters[activeIndex].seconds;
        let chapterEnd = (activeIndex + 1 < chapters.length) ? chapters[activeIndex + 1].seconds : null;
        let percent = 0;
        if (chapterEnd !== null && chapterEnd > chapterStart) {
          percent = ((currentTime - chapterStart) / (chapterEnd - chapterStart)) * 100;
        }
        else if (chapterEnd === null && videoDuration && videoDuration > chapterStart) {
          // Calculate last chapter length based on total video duration.
          percent = ((currentTime - chapterStart) / (videoDuration - chapterStart)) * 100;
        }
        percent = Math.max(0, Math.min(100, percent));
        chapterCurrentProgress.style.width = percent + '%';
      }
    }
    function onYouTubeMessage(event) {
      if (!event.data) return;
      let data;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch (e) { return; }
      if (data.event === 'infoDelivery') {
        if (typeof data.info?.duration === 'number') {
          videoDuration = data.info.duration;
        }
        if (typeof data.info?.currentTime === 'number') {
          setActiveChapter(data.info.currentTime);
        }
      }
    }
    window.addEventListener('message', onYouTubeMessage);
    modal._videoModalListeners.push({ el: window, type: 'message', handler: onYouTubeMessage });
  }
}

function videoControlSeekTo(seconds, allowSeekAhead = true) {
  const modal = getModalVideo();
  if (!modal) return;

  const iframe = modal.querySelector(`#${app.modal.id.videoIframe}`);
  if (!iframe) return;

  iframe.contentWindow.postMessage(
    '{"event":"command","func":"seekTo","args":["' + seconds + '", ' + allowSeekAhead + ']}', '*'
  );
}

function setupModalDescriptionEventListeners() {
  // Setup the click listener to expand description only once.
  const modal = getModalVideo();
  if (!modal) return;
  const videoDescContainer = modal.querySelector(`.${app.modal.class.descContainer}`);

  const descExpand = function () {
    videoDescContainer.classList.remove(app.modal.class.descContainerCollapsed);
    videoDescContainer.removeEventListener('click', descExpand);
  };
  videoDescContainer.addEventListener('click', descExpand);
  if (modal._videoModalListeners) {
    modal._videoModalListeners.push({ el: videoDescContainer, type: 'click', handler: descExpand });
  }
}

function setModalType(videoObject) {
  const modal = getModalVideo();
  if (!modal || !videoObject) return;

  // Currently, anything that doesn't have a YouTube ID is considered an article.
  const isArticle = !videoObject.youtubeId;

  if (isArticle) {
    app.state.modal.activeType = 'article';
    modal.classList.add(app.modal.class.typeArticle);
    let iframeContainer = document.querySelector(`.${app.modal.class.iframeContainer}`);
    if (iframeContainer) document.querySelector(`.${app.modal.class.iframeContainer}`).remove();
  }
  else {
    // When article is miniplayer and next triggered is a video, ensure article class is removed.
    app.state.modal.activeType = 'video';
    modal.classList.remove(app.modal.class.typeArticle);
  }
}

function setupModalVideoEventListeners(videoObject) {
  // Modal action buttons: Close, Minimize, Favorite, Tags, Escape key.
  
  const modal = getModalVideo();
  if (!modal || !videoObject) return;

  // Setup modal event listener tracking
  if (!modal._videoModalListeners) modal._videoModalListeners = [];

  // Close modal button
  const closeBtn = modal.querySelector(`#${app.modal.id.close}`);
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModalVideo);
    modal._videoModalListeners.push({ el: closeBtn, type: 'click', handler: closeModalVideo });
  }

  // Toggle modal to fullscreen/miniplayer button
  const minimizeBtn = modal.querySelector(`#${app.modal.id.minimize}`);
  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', toggleModalMode);
    modal._videoModalListeners.push({ el: minimizeBtn, type: 'click', handler: toggleModalMode });
  }

  // Mode miniplayer: Settings state handling, if swipe-to-miniplayer is enabled.
  const miniplayerSwipeEnabledElement = document.querySelector('#yl_miniplayer_swipe_enabled');
  const miniplayerSwipeEnabled = miniplayerSwipeEnabledElement?.getAttribute('data-yl-mini-player-swipe-enabled') === 'true';
  if (miniplayerSwipeEnabled) {
    setupSwipeToMiniplayer(modal);
  }

  // Toggle favorite video button
  const favoriteBtn = modal.querySelector(`#${app.modal.id.favorite}`);
  if (favoriteBtn) {
    const favoriteHandler = (e) => {
      e.preventDefault();
      toggleFavorite(videoObject.favorite_toggle_url, modal, videoObject.feedItemEl);
    };
    favoriteBtn.addEventListener('click', favoriteHandler);
    modal._videoModalListeners.push({ el: favoriteBtn, type: 'click', handler: favoriteHandler });
  }

  // Assign labels/tags (playlists) button
  const tagsBtn = modal.querySelector(`#${app.modal.id.tags}`);
  if (tagsBtn) {
    const tagsHandler = async (e) => {
      e.preventDefault();
      const tagsButtonIcon = modal.querySelector(`#${app.modal.id.tags} img.icon`);
      if (tagsButtonIcon) tagsButtonIcon.classList.add('loading');
      const tags = await getItemTags(videoObject.entryId);
      if (tagsButtonIcon) tagsButtonIcon.classList.remove('loading');
      renderTagsModal(videoObject.entryId, tags);
    };
    tagsBtn.addEventListener('click', tagsHandler);
    modal._videoModalListeners.push({ el: tagsBtn, type: 'click', handler: tagsHandler });
  }

  // Expand description box on click
  handleModalDescription(videoObject);

  // Escape key closes fullscreen modal
  const escHandler = (event) => {
    if (event.key === 'Escape' && isModeFullscreen()) {
      closeModalVideo();
    }
  };
  document.addEventListener('keydown', escHandler);
  modal._videoModalListeners.push({ el: document, type: 'keydown', handler: escHandler });

  // Select video source change handling: YouTube, Invidious
  const videoSourceSelect = modal.querySelector(`#${app.modal.id.source}`);
  const iframe = modal.querySelector(`.${app.modal.class.iframe}`);
  if (videoSourceSelect && iframe) {
    const sourceHandler = function () {
      iframe.src = getEmbedUrl(videoSourceSelect.value);
      iframe.setAttribute('data-yl-video-source', videoSourceSelect.value);
      const chapterContainer = modal.querySelector(`#${app.modal.id.chapterContainer}`);
      if (chapterContainer) {
        // Chapter only supported for YouTube as playback source.
        if (videoSourceSelect.value !== 'youtube') {
          chapterContainer.classList.add('display-none');
        }
        else {
          chapterContainer.classList.remove('display-none');
        }
      }
    };
    videoSourceSelect.addEventListener('change', sourceHandler);
    modal._videoModalListeners.push({ el: videoSourceSelect, type: 'change', handler: sourceHandler });
  }

  function getEmbedUrl(source) {
    // Helper to get the correct embed URL for a given source
    if (source === 'invidious_1' && videoObject.video_invidious_instance_1 && videoObject.youtubeId) {
      return `${videoObject.video_invidious_instance_1.replace(/\/$/, '')}/embed/${videoObject.youtubeId}`;
    }
    else if (source === 'youtube') {
      return videoObject.youtube_embed_url;
    }
    return '';
  }

}

function restoreModalEventListeners() {
  // Restore modal event listeners after tab suspension.
  // Primarily to address how moobile devices handles tab suspension,

  const modal = getModalVideo();
  if (!modal) return;

  // Remove all existing modal event listeners before reattaching new ones, to prevent stacking.
  if (modal._videoModalListeners && Array.isArray(modal._videoModalListeners)) {
    for (const {el, type, handler} of modal._videoModalListeners) {
      if (el && type && handler) {
        el.removeEventListener(type, handler);
      }
    }
    modal._videoModalListeners.length = 0;
  }

  let videoQueue; // Localstorage: youlagVideoQueue
  try {
    videoQueue = JSON.parse(localStorage.getItem(app.modal.queue.localStorageKey));
  }
  catch (e) {
    videoQueue = null;
  }
  if (!videoQueue || !Array.isArray(videoQueue.queue)) return;

  const entryId = modal.getAttribute('data-entry') || videoQueue.queue[videoQueue.queue_active_index]?.entryId;
  if (!entryId) return;

  const videoObject = videoQueue.queue.find(v => v.entryId === entryId);
  if (!videoObject) return;

  const hasVideoIframe = !!modal.querySelector(`#${app.modal.id.videoIframe}`);
  if (!hasVideoIframe) return;

  setupModalVideoEventListeners(videoObject);
  setupModalVideoControlEventListeners();
}

function forceFrssEntryToCollapse(target) {
  // HACK: Collapse the expanded entry triggered by FreshRSS click event, as Youlag presents the content in a modal.

  const feedItem = target;
  let isActive = feedItem.classList.contains('active');
  const iframes = feedItem.querySelectorAll('iframe');

  if (iframes) {
    iframes.forEach(iframe => {
      // Disable iframes to prevent autoplay.
      const src = iframe.getAttribute('src');
      if (src) {
        iframe.setAttribute('data-original', src);
        iframe.setAttribute('src', '');
      }
    });
  }

  if (isActive) {
    // Collapse the feed item
    feedItem.classList.remove('active');
    feedItem.classList.remove('current');
  }
}

function closeModalVideo() {
  const modal = getModalVideo();

  // Remove all modal-specific listeners before removing the modal element
  if (modal && modal._videoModalListeners && Array.isArray(modal._videoModalListeners)) {
    for (const {el, type, handler} of modal._videoModalListeners) {
      el.removeEventListener(type, handler);
    }
    modal._videoModalListeners.length = 0;
  }
  
  if (modal) modal.remove();

  setHistoryPopstate(false); // Signal that a new pop state can be pushed for the next video

  if (
    !app.state.popstate.allowBack && 
    history.state && 
    history.state.modalOpen && 
    isModeFullscreen()
  ) {
    // Only trigger history.back() once, and set the ignore flags.
    app.state.popstate.allowBack = false;
    app.state.popstate.ignoreNext = true;
    history.back();
  }
  else {
    app.state.popstate.ignoreNext = false;
    resetHistoryState();
  }
  setModalState(false);
  setModeMiniplayer(false);
  setModeFullscreen(false);
  setPageTitle();
  clearVideoQueue();
}

function renderRelatedVideos(videoObject) {
  // Renders related videos in the video modal.
  const modal = getModalVideo();
  if (!videoObject || !modal) return;

  // The `app.modal.class.relatedVideoEntryHTML` contains the original feed entry HTML and is not displayed 
  // as its purpose is to be parsed when opening a the related video.
  let template = (videoObject) =>  `
    <div class="${app.modal.class.relatedVideoEntry}" data-yl-feed="${videoObject.entryId}">
      <div class="${app.modal.class.relatedVideoEntryHTML} display-none">
        ${videoObject.feedItem.outerHTML}
      </div>
      <div class="youlag-related-video-item__thumbnail"><img src="${videoObject.thumbnail}" loading="lazy" ></div>
      <div class="youlag-related-video-item__metadata">
        <div class="youlag-related-video-item__title">${videoObject.title}</div>
        <div class="youlag-related-video-item__author">${videoObject.website_name}</div>
        <div class="youlag-related-video-item__date">
          ${getRelativeDate(videoObject.date)}
        </div>
      </div>
    </div>
  `

  function appendRelatedVideos(currentEntryId, currentAuthorId) {
    // Append related videos to the video modal.
    const relatedVideosSource = getRelatedVideosSetting();
    if (relatedVideosSource === 'none' || relatedVideosSource === '') return;

    const currentlyViewing = currentEntryId;
    const relatedVideosContainer = modal.querySelector(`#${app.modal.id.relatedContainer}`);
    if (!relatedVideosContainer) return;

    let relatedVideos;

    switch (relatedVideosSource) {
      case 'watch_later':
        relatedVideos = fetchRelatedItems(relatedVideosSource, 'rand', 10);
        break;
      case 'subscriptions':
        relatedVideos = fetchRelatedItems(relatedVideosSource, '', 10);
        break;
      case 'author':
        relatedVideos = fetchRelatedItems(`f_${currentAuthorId}`, '', 10);
        break;
      default:
        relatedVideos = Promise.resolve([]);
    }

    relatedVideos.then(videos => {
      if (!Array.isArray(videos) || videos.length === 0) return;
      videos.forEach(videoObject => {
        const videoHtml = template(videoObject);
        if (videoObject.entryId === currentlyViewing) return; // Skip currently viewing video.
        relatedVideosContainer.insertAdjacentHTML('beforeend', videoHtml);
      });
      // Display the related videos container once appended.
      relatedVideosContainer.classList.remove('display-none');
    });

    // Remove any previous relatedVideosContainer click listeners and attach new ones.
    if (!modal._videoModalListeners) modal._videoModalListeners = [];
    modal._videoModalListeners = modal._videoModalListeners.filter(listener => {
      if (listener.type === 'click' && listener.el === relatedVideosContainer) {
        listener.el.removeEventListener(listener.type, listener.handler);
        return false;
      }
      return true;
    });

    // Attach and track the new click handler
    const relatedClickHandler = function (e) {
      const relatedItem = e.target.closest(`.${app.modal.class.relatedVideoEntry}`);
      if (!relatedItem) return;
      const feedItem = relatedItem.querySelector(`.${app.modal.class.relatedVideoEntryHTML} > ${app.frss.el.entry}`);
      if (feedItem) {
        const modal = getModalVideo();
        if (modal) {
          modal.scrollTo({ top: 0 });
        }
        handleActiveVideo(feedItem);
      }
    };
    relatedVideosContainer.addEventListener('click', relatedClickHandler);
    modal._videoModalListeners.push({ el: relatedVideosContainer, type: 'click', handler: relatedClickHandler });

  }

  appendRelatedVideos(videoObject.entryId, videoObject.authorId);
}

function setVideoQueue(videoObject) {
  // Store the videoObject in localStorage.youlagVideoQueue.
  // The video object is defined in `extractFeedItemData()`.

  let queue = [];
  let queue_active_index = 0;
  try {
    const stored = localStorage.getItem(app.modal.queue.localStorageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed.queue)) queue = parsed.queue;
      if (typeof parsed.queue_active_index === 'number') queue_active_index = parsed.queue_active_index;
    }
  } catch (e) { }

  const entryId = videoObject.entryId;
  const foundIndex = queue.findIndex(v => v.entryId === entryId);
  const isMiniplayer = isModeMiniplayer();
  
  if (foundIndex === -1) {
    queue.push(videoObject);
    queue_active_index = queue.length - 1;
  }
  else {
    queue.splice(foundIndex, 1);
    queue.push(videoObject);
    queue_active_index = queue.length - 1;
  }

  localStorage.setItem(app.modal.queue.localStorageKey, JSON.stringify({ queue, queue_active_index, isMiniplayer }));
}

function clearVideoQueue() {
  localStorage.removeItem(app.modal.queue.localStorageKey);
}

function restoreVideoQueue() {
  // Restore video queue from localStorage on page load, only if miniplayer mode was active.
  if (app.state.youlag.restoreVideoInit || !isFeedPage()) return;

  const stored = localStorage.getItem(app.modal.queue.localStorageKey);
  let queueObj = null;
  if (stored) {
    try {
      queueObj = JSON.parse(stored);
    }
    catch (e) {
      console.error('Error parsing youlagVideoQueue from localStorage:', e);
    }
  }
  if (!queueObj || queueObj.isMiniplayer !== true) return;

  if (queueObj && Array.isArray(queueObj.queue) && typeof queueObj.queue_active_index === 'number' && queueObj.queue.length > 0) {
    setModeMiniplayer(true); // Restored video queue always opens in miniplayer mode.
    handleActiveVideo(queueObj, true);
  }

  app.state.youlag.restoreVideoInit = true;
}

function handleActiveArticle() {
  pushHistoryState('articleOpen', true);
}

function closeArticle(event) {
  const openedArticle = document.querySelector(app.frss.el.current);

  if (openedArticle) {
    // Focus closed article, to easier visually navigate where one last left off. 
    openedArticle.setAttribute('tabindex', '-1');
    openedArticle.focus({ preventScroll: true });

    // Close the article
    openedArticle.classList.remove('active', 'current');
    const rect = openedArticle.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    let offset = 0;

    if (window.getComputedStyle) {
      const root = document.documentElement;
      const val = getComputedStyle(root).getPropertyValue('--yl-topnav-height');
      if (val) {
        offset = parseInt(val.trim(), 10) || 0;
      }
    }

    // Prevent sticky transition title from showing when auto-scrolling.
    const ylCategoryToolbar = document.getElementById(app.ui.id.toolbar);
    setToolbarStickyState(true);
    ylCategoryToolbar.classList.remove('sticky-visible');
    ylCategoryToolbar.classList.add('sticky-hidden');

    // Scroll to the top of the closed article, offset by `var(--yl-topnav-height)`.
    const targetScroll = rect.top + scrollTop - offset;
    window.scrollTo({
      top: Math.max(0, targetScroll)
    });
    event?.stopPropagation?.();

    setTimeout(() => {
      setToolbarStickyState(false);
    }, 50);

    setModalState(false);
    setHistoryPopstate(false); // Signal that a new pop state can be pushed for the next article
  }
}

function renderTagsModal(entryId, tags) {
  // Opens modal to manage tags (playlists) for feed item (entryId).
  /**
   * Example tags object:
  [{
    "id": 2,
    "name": "Some playlist name",
    "checked": true
  },]
  */

  if (document.getElementById(`${app.modal.id.tagsContainer}`)) {
    // Remove existing modal if present
    document.getElementById(`${app.modal.id.tagsContainer}`).remove();
  }

  let container = document.createElement('div');
  const useVideoLabels = document.querySelector('body.youlag-video-labels') ? true : false;
  const modalTitle = useVideoLabels ? 'Save to...' : 'Tags';
  container.id = `${app.modal.id.tagsContainer}`;
  container.classList.add(app.modal.class.tagsModalRoot);
  container.innerHTML = `
    <forms class="yl-tags-content">
      <h3 class="yl-tags-modal-title">
        ${modalTitle}

        <a href="./?c=tag" target="_blank"><img class="icon" src="../themes/Mapco/icons/configure.svg" loading="lazy" alt="⚙️"></a>
      </h3>
      <div class="yl-tags-list">
        ${tags.map(tag => `
            <div class="yl-tags-list-item">
              <input type="checkbox" id="yl-tag-${tag.id}" data-tag-id="${tag.id}" data-entry-id="${entryId}" ${tag.checked ? 'checked' : ''} />
              <label for="yl-tag-${tag.id}">${tag.name}</label>
            </div>
          `).join('')
        }
      </div>
      <div class="yl-tags-modal-actions">
        <button id="yl-tags-modal-close" class="btn">Done</button>
      </div>
    </forms>
  `

  document.body.appendChild(container);
  document.body.classList.add(app.modal.class.tagsModalOpen);


  // Event listener for tags (playlists) items.
  const checkboxes = container.querySelectorAll(`.${app.modal.class.tagsModalItem} input[type="checkbox"]`);
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function () {
      const tagId = this.getAttribute('data-tag-id');
      const entryId = this.getAttribute('data-entry-id');
      const checked = this.checked;
      setItemTag(entryId, { id: tagId, checked: checked });
    });
  });

  function closeTagsModal() {
    const modal = document.getElementById(`${app.modal.id.tagsContainer}`);
    if (modal) modal.remove();
    document.body.classList.remove(app.modal.class.tagsModalOpen);
    document.removeEventListener('keydown', tagsModalEscHandler, true);
  }

  // Close button
  const closeButton = container.querySelector(`#${app.modal.id.tagsClose}`);
  closeButton.addEventListener('click', closeTagsModal);

  // Close on Esc key
  function tagsModalEscHandler(event) {
    if (event.key === 'Escape') {
      closeTagsModal();
      event.stopPropagation(); // Prevent bubbling to other modals
    }
  }
  document.addEventListener('keydown', tagsModalEscHandler, true);

  // Close onblur
  container.addEventListener('mousedown', function (event) {
    const content = container.querySelector(`.${app.modal.class.tagsModalContent}`);
    if (content && !content.contains(event.target)) {
      closeTagsModal();
    }
  });

}
