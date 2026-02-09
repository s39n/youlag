/**
 * UI: Modes
 * 
 * Handles different view modes for the video modal, such as fullscreen and miniplayer.
 */

function toggleModalMode() {
  if (isModeMiniplayer()) {
    // Toggle from miniplayer -> fullscreen mode
    setModeMiniplayer(false, 'fullscreen');
    setModeFullscreen(true);

    if (!getHistoryPopstate()) {
      /**
       * When `restoreVideoQueue()` opens in miniplayer mode, the popstate is not yet added.
       * Thus, if expanding back to fullscreen mode, we need to add it here to avoid routing back a page,
       * and instead just close the modal.
       */
      pushHistoryState('modalOpen', true);
    }

    const modal = getModalVideo();
    if (!modal) return;
    const entryId = modal.getAttribute('data-entry');
    if (entryId) addVideoParamUrl(entryId);
  }
  else {
    // Toggle from fullscreen -> miniplayer mode
    setModeMiniplayer(true);
    setModeFullscreen(false, 'miniplayer');
    removeVideoParamUrl();
  }
}

function setModeMiniplayer(state, prevState) {
  const modal = getModalVideo();

  if (state === true) {
    if (app.state.modal.activeType === 'article') {
      modal ? (app.state.modal.miniplayerScrollTop = modal.scrollTop) : null;
    }
    document.body.classList.add(app.modal.class.modeMiniplayer);
    setModeState('miniplayer');
    setModalState(false); // Miniplayer mode is not considered active.
    modal ? modal.scrollTo({ top: 0 }) : null;
  }
  else if (state === false) {
    if (modal) {
      let transitionRan = false;
      const onTransitionEnd = () => {
        transitionRan = true;
        // Scroll back to previous position when exiting miniplayer mode.
        modal.scrollTo({ top: app.state.modal.miniplayerScrollTop, behavior: 'smooth' });
      };
      modal.addEventListener('transitionend', onTransitionEnd, { once: true });
      setTimeout(() => {
        // Fallback if transition event is not detected.
        if (!transitionRan) {
          modal.scrollTo({ top: app.state.modal.miniplayerScrollTop, behavior: 'smooth' });
        }
      }, 500);
    }
    document.body.classList.remove(app.modal.class.modeMiniplayer);
    app.state.modal.mode = prevState || null;
  }
  try {
    const stored = localStorage.getItem(app.modal.queue.localStorageKey);
    if (stored) {
      const obj = JSON.parse(stored);
      obj.isMiniplayer = !!state;
      localStorage.setItem(app.modal.queue.localStorageKey, JSON.stringify(obj));
    }
  } catch (e) { }
}

function setModeFullscreen(state, prevState) {
  if (state === true) {
    document.body.classList.add(app.modal.class.modeFullscreen);
    document.body.classList.remove(app.modal.class.modeMiniplayer);
    setModeState('fullscreen');
    setModalState(true);
  }
  else if (state === false) {
    document.body.classList.remove(app.modal.class.modeFullscreen);
    app.state.modal.mode = prevState || null;
    setModalState(false);
  }
}

function setupSwipeToMiniplayer(modal) {
  // Allow video modal overscroll to enter miniplayer mode on touch devices.

  modal = modal || getModalVideo();
  if (!modal) return;

  // Remove any previous swipe listeners
  if (modal._videoModalListeners && Array.isArray(modal._videoModalListeners)) {
    modal._videoModalListeners = modal._videoModalListeners.filter(({ el, type, handler }) => {
      if (el === modal && (type === 'touchstart' || type === 'touchmove' || type === 'touchend')) {
        el.removeEventListener(type, handler);
        return false;
      }
      return true;
    });
  }

  let touchStartY = null;
  let overscrollActive = false;
  const swipeThreshold = 50; // Minimum distance in pixels to consider a swipe.
  const scrollTolerance = 30; // Allow a larger tolerance for scrollTop to improve swipe reliability

  // Track the initial Y position when a single touch starts near the top of the modal.
  function touchStartHandler(e) {
    if (modal.scrollTop <= scrollTolerance && e.touches.length === 1) {
      touchStartY = e.touches[0].clientY;
      overscrollActive = false;
    }
  }

  // Detect downward movement from the top of the modal to track overscroll gesture.
  function touchMoveHandler(e) {
    if (touchStartY !== null && modal.scrollTop <= scrollTolerance && e.touches.length === 1) {
      const moveY = e.touches[0].clientY;
      if (moveY - touchStartY > 0) {
        overscrollActive = true;
        e.preventDefault(); // Prevent native scroll bounce to allow custom overscroll detection.
      }
    }
  }

  // If a downward swipe of sufficient distance is detected, triggers miniplayer mode.
  function touchEndHandler(e) {
    if (touchStartY !== null && overscrollActive && e.changedTouches.length === 1) {
      const endY = e.changedTouches[0].clientY;
      if (endY - touchStartY > swipeThreshold && modal.scrollTop <= scrollTolerance) {
        toggleModalMode(true);
      }
    }
    touchStartY = null;
    overscrollActive = false;
  }

  modal.addEventListener('touchstart', touchStartHandler, { passive: false });
  modal.addEventListener('touchmove', touchMoveHandler, { passive: false });
  modal.addEventListener('touchend', touchEndHandler, { passive: false });

  if (modal._videoModalListeners) {
    modal._videoModalListeners.push(
      { el: modal, type: 'touchstart', handler: touchStartHandler },
      { el: modal, type: 'touchmove', handler: touchMoveHandler },
      { el: modal, type: 'touchend', handler: touchEndHandler }
    );
  }
}