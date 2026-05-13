const store = require('./utils/store');

App({
  globalData: {
    darkMode: false,
    lastSession: null
  },

  onLaunch(options) {
    const sys = wx.getSystemInfoSync();
    const saved = wx.getStorageSync('app_settings') || {};
    const dark = saved.darkMode === 'auto'
      ? sys.theme === 'dark'
      : saved.darkMode === 'dark';
    this.globalData.darkMode = dark;

    // First-launch onboarding
    const onboarded = wx.getStorageSync('_onboarded');
    if (!onboarded) {
      // Delay navigation to let app initialize
      setTimeout(() => {
        wx.navigateTo({ url: '/pages/onboarding/onboarding' });
      }, 300);
    }

    // Handle share card params (friend invite / stats sharing)
    if (options.query) {
      const q = options.query;
      if (q.invite) {
        // Store pending invite code for squad page
        wx.setStorageSync('_pending_invite', q.invite);
      }
      if (q.stats) {
        try {
          const stats = JSON.parse(decodeURIComponent(q.stats));
          if (stats.code && stats.data) {
            store.updateFriendStats(stats.code, stats.data);
          }
        } catch (e) {
          // Stats data too large for query param, user needs clipboard import
        }
      }
    }
  },

  onShow(options) {
    // Handle share params on subsequent shows too
    if (options && options.query) {
      const q = options.query;
      if (q.invite) {
        wx.setStorageSync('_pending_invite', q.invite);
      }
    }
  },

  getDarkMode() { return this.globalData.darkMode; },

  setDarkMode(mode) {
    const sys = wx.getSystemInfoSync();
    const dark = mode === 'auto' ? sys.theme === 'dark' : mode === 'dark';
    this.globalData.darkMode = dark;
  }
});
