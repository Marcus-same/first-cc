const store = require('../../utils/store');
const app = getApp();

Page({
  data: {
    dark: false,
    myCode: '',
    squadName: '我的战队',
    friends: [],
    friendCount: 0,
    showAdd: false,
    inputCode: '',
    inputName: '',
    leaderboard: [],
    lbTab: 0
  },

  onLoad() {
    this.setData({ dark: app.getDarkMode() });
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const myCode = store.getMyCode();
    const squadName = store.getSquadName();
    const friendsObj = store.getFriends();
    const friends = Object.entries(friendsObj).map(([code, f]) => ({
      code,
      name: f.name,
      stats: f.stats,
      lastShared: f.lastShared
    }));
    this.setData({
      myCode,
      squadName,
      friends,
      friendCount: friends.length
    });
    this.buildLeaderboard();
  },

  buildLeaderboard() {
    // Combine own stats + friends for leaderboard
    const entries = [];
    const mySessions = store.getAllSessions();
    const myStreak = store.getStreak();
    const myWeek = mySessions.filter(s => {
      const d = new Date(s.start);
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      return d >= weekAgo;
    });

    entries.push({
      name: '我',
      isMe: true,
      streak: myStreak,
      weekCount: myWeek.length,
      totalMin: Math.floor(mySessions.reduce((a, s) => a + s.duration, 0) / 60)
    });

    this.data.friends.forEach(f => {
      if (f.stats) {
        entries.push({
          name: f.name,
          isMe: false,
          streak: f.stats.streak || 0,
          weekCount: f.stats.weekCount || 0,
          totalMin: f.stats.totalMin || 0
        });
      }
    });

    this.setData({ leaderboard: entries });
  },

  toggleAdd() {
    this.setData({ showAdd: !this.data.showAdd, inputCode: '', inputName: '' });
  },

  onCodeInput(e) {
    this.setData({ inputCode: e.detail.value.toUpperCase().slice(0, 4) });
  },

  onNameInput(e) {
    this.setData({ inputName: e.detail.value });
  },

  addFriend() {
    const code = this.data.inputCode.trim();
    const name = this.data.inputName.trim() || '好友' + code;
    if (code.length < 4) {
      wx.showToast({ title: '请输入4位邀请码', icon: 'none' });
      return;
    }
    if (code === this.data.myCode) {
      wx.showToast({ title: '不能添加自己哦', icon: 'none' });
      return;
    }
    const ok = store.addFriend(code, name);
    if (!ok) {
      wx.showToast({ title: '该好友已存在', icon: 'none' });
      return;
    }
    wx.showToast({ title: '好友已添加', icon: 'success' });
    this.setData({ showAdd: false });
    this.refresh();
  },

  removeFriend(e) {
    const code = e.currentTarget.dataset.code;
    wx.showModal({
      title: '删除好友',
      content: '确定要删除这个好友吗？',
      success: (res) => {
        if (res.confirm) {
          store.removeFriend(code);
          wx.showToast({ title: '已删除', icon: 'success' });
          this.refresh();
        }
      }
    });
  },

  onShareAppMessage() {
    return {
      title: `加入我的拉屎战队！邀请码：${this.data.myCode}`,
      path: `/pages/index/index?invite=${this.data.myCode}`,
    };
  },

  shareStats() {
    // Encode recent stats for sharing
    const sessions = store.getSessions(7);
    const streak = store.getStreak();
    const locations = sessions.filter(s => s.location).map(s => ({
      lat: s.location.lat,
      lng: s.location.lng,
      icon: s.type ? require('../../utils/health-tips').BRISTOL.find(b => b.type === s.type)?.icon : '🚽'
    }));
    const stats = {
      streak,
      weekCount: sessions.length,
      totalMin: Math.floor(sessions.reduce((a, s) => a + s.duration, 0) / 60),
      locations: locations.slice(0, 10) // Limit location data
    };
    // Store in clipboard as fallback since query params have size limits
    wx.setClipboardData({
      data: JSON.stringify({ code: this.data.myCode, stats }),
      success: () => {
        wx.showModal({
          title: '分享战队数据',
          content: '数据已复制到剪贴板。发送给好友后，让对方在「添加好友」中输入你的邀请码，然后粘贴数据即可同步。',
          showCancel: false
        });
      }
    });
  },

  importFriendStats() {
    wx.getClipboardData({
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (data.code && data.stats) {
            const friends = store.getFriends();
            if (!friends[data.code]) {
              wx.showToast({ title: '请先添加该好友', icon: 'none' });
              return;
            }
            store.updateFriendStats(data.code, data.stats);
            wx.showToast({ title: '好友数据已同步！', icon: 'success' });
            this.refresh();
          } else {
            wx.showToast({ title: '剪贴板无有效战队数据', icon: 'none' });
          }
        } catch (e) {
          wx.showToast({ title: '解析失败，请确认复制了正确的数据', icon: 'none' });
        }
      }
    });
  },

  onLbTab(e) {
    this.setData({ lbTab: parseInt(e.currentTarget.dataset.idx) });
  }
});
