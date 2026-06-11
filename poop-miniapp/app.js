const store = require('./utils/store');

App({
  globalData: {
    darkMode: false,
    lastSession: null
  },

  onLaunch(options) {
    // 自动检测版本更新，有新版本时弹窗提醒用户重启
    const updateManager = wx.getUpdateManager();
    updateManager.onCheckForUpdate((res) => {
      if (res.hasUpdate) {
        updateManager.onUpdateReady(() => {
          wx.showModal({
            title: '更新提示',
            content: '新版本已就绪，重启后生效',
            showCancel: false,
            confirmText: '立即重启',
            success: () => updateManager.applyUpdate()
          });
        });
        updateManager.onUpdateFailed(() => {
          wx.showToast({ title: '新版本下载失败，请稍后重试', icon: 'none' });
        });
      }
    });

    const sys = wx.getSystemInfoSync();
    const saved = wx.getStorageSync('app_settings') || {};
    const dark = saved.darkMode === 'auto'
      ? sys.theme === 'dark'
      : saved.darkMode === 'dark';
    this.globalData.darkMode = dark;

    // Enable share menu globally (转发按钮)
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });

    // First-launch onboarding
    try {
      const onboarded = wx.getStorageSync('_onboarded');
      if (!onboarded) {
        setTimeout(() => {
          wx.navigateTo({ url: '/pages/onboarding/onboarding' });
        }, 300);
      }
    } catch (e) {
      // Storage not available, skip onboarding
    }

    // Handle share card params (friend invite + auto stats sync)
    if (options.query) {
      const q = options.query;
      if (q.invite) {
        this._handleInvite(q.invite, q.d);
      }
    }
  },

  onShow(options) {
    // Handle share params on subsequent shows too
    if (options && options.query) {
      const q = options.query;
      if (q.invite) {
        this._handleInvite(q.invite, q.d);
      }
    }
    // Also process any pending invite stored from earlier
    this._processPendingInvite();
  },

  // 一键添加好友 + 自动同步数据
  // compactStats: "S5W12M340" → streak=5, weekCount=12, totalMin=340
  _handleInvite(code, compactStats) {
    const myCode = store.getMyCode();
    if (code === myCode) {
      wx.showToast({ title: '这是你自己的邀请码', icon: 'none' });
      return;
    }
    // Parse compact stats from URL (S=streak, W=weekCount, M=totalMin)
    let stats = null;
    if (compactStats) {
      const m = compactStats.match(/S(\d+)W(\d+)M(\d+)/);
      if (m) {
        stats = { streak: parseInt(m[1]), weekCount: parseInt(m[2]), totalMin: parseInt(m[3]) };
      }
    }

    const existing = store.getFriends();
    if (existing[code]) {
      // 好友已存在，只更新数据
      if (stats) {
        store.updateFriendStats(code, stats);
        wx.showToast({ title: '好友数据已自动更新！', icon: 'success' });
      } else {
        wx.showToast({ title: '该好友已在列表中', icon: 'none' });
      }
      return;
    }
    store.addFriend(code, '噗友' + code);
    if (stats) {
      store.updateFriendStats(code, stats);
      wx.showToast({ title: '已添加噗友并同步数据！', icon: 'success' });
    } else {
      wx.showToast({ title: '已添加噗友！', icon: 'success' });
    }
  },

  // 处理旧版遗留的 _pending_invite（兼容）
  _processPendingInvite() {
    const pendingCode = wx.getStorageSync('_pending_invite');
    if (!pendingCode) return;
    wx.removeStorageSync('_pending_invite');
    this._handleInvite(pendingCode);
  },

  getDarkMode() { return this.globalData.darkMode; },

  setDarkMode(mode) {
    const sys = wx.getSystemInfoSync();
    const dark = mode === 'auto' ? sys.theme === 'dark' : mode === 'dark';
    this.globalData.darkMode = dark;
  }
});
