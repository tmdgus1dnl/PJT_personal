// user.js
// Handles user state, greeting UI and permission checks within the SPA.

import { onAuth, getCurrentUser } from './auth.js';

// Module level state representing the currently selected or logged in user.
// The default SSAFY admin account is represented by uid === 'default'.
const state = {
  uid: 'default',
  nickname: 'SSAFY',
  role: 'admin',
  profileImage: '',
  backgroundImage: '',
};

/**
 * Create or update the greeting banner in the header. The banner
 * displays the current user's nickname and optionally icons for
 * switching profiles and opening settings.
 *
 * @param {Object} opts
 * @param {() => void} [opts.onProfileSwitch] Called when the user clicks the switch icon.
 * @param {() => void} [opts.onSettings] Called when the user clicks the settings icon.
 */
function updateGreeting(opts = {}) {
  const user = getCurrentUser();
  let greeting = document.getElementById('greeting');
  if (!greeting) {
    greeting = document.createElement('div');
    greeting.id = 'greeting';
    // Basic styling: position in the top right corner with subtle
    // background so it stands out without obstructing other elements.
    greeting.style.position = 'fixed';
    greeting.style.top = '10px';
    greeting.style.right = '10px';
    greeting.style.zIndex = '1000';
    greeting.style.background = 'rgba(0, 0, 0, 0.4)';
    greeting.style.color = '#fff';
    greeting.style.padding = '4px 8px';
    greeting.style.borderRadius = '4px';
    greeting.style.fontSize = '14px';
    greeting.style.display = 'flex';
    greeting.style.alignItems = 'center';
    greeting.style.gap = '6px';
  }
  // Clear previous contents
  greeting.innerHTML = '';
  greeting.textContent = `안녕하세요! ${user.nickname}님`;

  // Only show the profile switch and settings icons when callbacks are provided.
  if (opts.onProfileSwitch) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = '프로필 전환';
    btn.textContent = '🔄';
    btn.style.background = 'transparent';
    btn.style.border = 'none';
    btn.style.cursor = 'pointer';
    btn.style.color = 'inherit';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      opts.onProfileSwitch();
    });
    greeting.appendChild(btn);
  }
  if (opts.onSettings) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = '설정';
    btn.textContent = '⚙️';
    btn.style.background = 'transparent';
    btn.style.border = 'none';
    btn.style.cursor = 'pointer';
    btn.style.color = 'inherit';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      opts.onSettings();
    });
    greeting.appendChild(btn);
  }
}

/**
 * Initialise the user interface logic. This should be called once
 * after the DOM has loaded. It attaches an auth state listener and
 * updates the UI accordingly. When the user logs in or out the
 * greeting will refresh.
 *
 * @param {Object} opts See updateGreeting for options.
 */
export function initUserUI(opts = {}) {
  // Immediately render the greeting using the default state.
  updateGreeting(opts);
  // Subscribe to auth state changes. When a user signs in we
  // populate their profile from Firestore; otherwise we revert to
  // the default SSAFY admin account.
  onAuth(async (user) => {
    if (user) {
      try {
        const profile = await getUserProfile(user.uid);
        state.uid = user.uid;
        state.nickname = profile?.nickname || user.email || '사용자';
        state.role = profile?.role || 'user';
        state.profileImage = profile?.profileImage || '';
        state.backgroundImage = profile?.backgroundImage || '';
      } catch (err) {
        console.error('Failed to load user profile:', err);
        state.uid = user.uid;
        state.nickname = user.email || '사용자';
        state.role = 'user';
        state.profileImage = '';
        state.backgroundImage = '';
      }
    } else {
      // Default SSAFY account when not logged in.
      state.uid = 'default';
      state.nickname = 'SSAFY';
      state.role = 'admin';
      state.profileImage = '';
      state.backgroundImage = '';
    }
    updateGreeting(opts);
    // Update the sidebar profile circle to reflect the current user
    updateSidebarProfile();
    applyBackground();
  });
}

/**
 * Apply the current user's background image to the page. Falls back
 * gracefully if no background is set.
 */
function applyBackground() {
  if (state.backgroundImage) {
    document.body.style.backgroundImage = `url(${state.backgroundImage})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundRepeat = 'no-repeat';
  } else {
    document.body.style.backgroundImage = '';
  }
}

/**
 * Update the sidebar profile circle to reflect the current user. When a
 * user has uploaded a profile image, that image is displayed as the
 * background of the circle. Otherwise, the first character of their
 * nickname (or 'S' for SSAFY) is shown. This keeps the profile area
 * consistent with the design while reflecting user state.
 */
function updateSidebarProfile() {
  const circle = document.querySelector('.profile-circle');
  if (!circle) return;
  if (state.profileImage) {
    circle.style.backgroundImage = `url(${state.profileImage})`;
    circle.style.backgroundSize = 'cover';
    circle.style.backgroundRepeat = 'no-repeat';
    circle.textContent = '';
  } else {
    circle.style.backgroundImage = '';
    const first = state.nickname?.charAt(0) || 'S';
    circle.textContent = first.toUpperCase();
  }
}

/**
 * Determine whether the current user is permitted to access the
 * chatbot page. According to the specification, the default SSAFY
 * account (uid === 'default') may not use the chatbot. All logged
 * in users are allowed.
 */
export function canAccessChatbot() {
  return state.uid !== 'default';
}

/**
 * Expose the current user state so other modules may read the
 * nickname or role if necessary. Mutations should only occur within
 * this module.
 */

export function refreshGreeting(opts = {}) {
  updateGreeting(opts);
}