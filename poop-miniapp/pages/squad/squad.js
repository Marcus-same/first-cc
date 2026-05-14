const store = require('../../utils/store');
const app = getApp();

Page({
  data: {
    dark: false,
    myCode: '',
    myCodeChars: [],
    squadName: '我的噗友',
    friends: [],
    friendCount: 0,
    showAdd: false,
    inputCode: '',
    inputName: '',
    leaderboard: [],
    lbTab: 0,
    showPK: false,
    pkFriendName: '',
    pkItems: [],
    pkMyWins: 0,
    pkFriendWins: 0,
    pkWinnerText: ''
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
      myCodeChars: myCode.split(''),
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
      title: `加入我的噗友战队！邀请码：${this.data.myCode}`,
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
          title: '分享噗友数据',
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
            wx.showToast({ title: '剪贴板无有效噗友数据', icon: 'none' });
          }
        } catch (e) {
          wx.showToast({ title: '解析失败，请确认复制了正确的数据', icon: 'none' });
        }
      }
    });
  },

  onLbTab(e) {
    this.setData({ lbTab: parseInt(e.currentTarget.dataset.idx) });
  },

  pkFriend(e) {
    const { name, code } = e.currentTarget.dataset;
    const friend = this.data.friends.find(f => f.code === code);
    if (!friend || !friend.stats) {
      wx.showToast({ title: '好友还没有分享数据', icon: 'none' });
      return;
    }

    const { BRISTOL } = require('../../utils/health-tips');
    const mySessions = store.getAllSessions();
    const myStreak = store.getStreak();
    const myWeek = mySessions.filter(s => {
      const d = new Date(s.start);
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      return d >= weekAgo;
    });
    const myTotalMin = Math.floor(mySessions.reduce((a, s) => a + s.duration, 0) / 60);

    // Find dominant Bristol type for "me"
    const myTypes = {};
    myWeek.forEach(s => { if (s.type) myTypes[s.type] = (myTypes[s.type] || 0) + 1; });
    const myTopType = Object.entries(myTypes).sort((a, b) => b[1] - a[1])[0];
    const myTopBristol = myTopType ? BRISTOL.find(b => b.type === parseInt(myTopType[0])) : null;

    const fStreak = friend.stats.streak || 0;
    const fWeekCount = friend.stats.weekCount || 0;
    const fTotalMin = friend.stats.totalMin || 0;

    const pkItems = [
      { label: '连续打卡', icon: '🔥', me: myStreak + '天', friend: fStreak + '天', meWin: myStreak > fStreak, friendWin: fStreak > myStreak },
      { label: '本周次数', icon: '📝', me: myWeek.length + '次', friend: fWeekCount + '次', meWin: myWeek.length > fWeekCount, friendWin: fWeekCount > myWeek.length },
      { label: '累计时长', icon: '⏱', me: myTotalMin + '分', friend: fTotalMin + '分', meWin: myTotalMin > fTotalMin, friendWin: fTotalMin > myTotalMin },
    ];

    if (myTopBristol) {
      pkItems.push({ label: '主要类型', icon: myTopBristol.icon, me: myTopBristol.name, friend: '--', meWin: false, friendWin: false });
    }

    // Count wins
    const myWins = pkItems.filter(i => i.meWin).length;
    const friendWins = pkItems.filter(i => i.friendWin).length;

    this.setData({
      showPK: true,
      pkFriendName: name,
      pkItems,
      pkMyWins: myWins,
      pkFriendWins: friendWins,
      pkWinnerText: myWins > friendWins ? '🏆 你赢了！' : friendWins > myWins ? '🏆 ' + name + ' 赢了！' : '🤝 平手！'
    });
  },

  closePK() {
    this.setData({ showPK: false });
  }
});
