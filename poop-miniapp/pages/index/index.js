const { generateTip } = require('../../utils/health-tips');
const store = require('../../utils/store');
const { getFortune, getMilestone, celebrate, getDailyChallenge } = require('../../utils/fun');
const app = getApp();

Page({
  data: {
    dark: false, timeStr: '00:00', running: false, elapsed: 0,
    runTip: '', warnSec: 600, warnMin: 10, warned: false, warnEnabled: true,
    statItems: [
      { key: 'count', val: 0, label: '今日次数', icon: '🧻' },
      { key: 'totalMin', val: 0, label: '总时长(分)', icon: '⏱️' },
      { key: 'best', val: '--', label: '最短', icon: '⚡' },
      { key: 'avg', val: '--', label: '平均', icon: '📊' },
    ],
    streak: 0, dailyTip: '', fortune: null, challenge: null, isEmpty: true,
    greeting: '', showSeedHint: false
  },
  timerId: null, startTime: 0,

  onShow() {
    // 时令问候
    const hour = new Date().getHours();
    const greetings = {
      morning: ['早上好 ☀️', '新的一天，肠道准备好了吗？', '早安，今天也要元气满满'],
      noon: ['中午好 🌿', '午饭后来个轻松时刻', '午后时光，放松一下'],
      evening: ['傍晚好 🌅', '一天辛苦了，该关爱一下肠道了', '晚饭后最适合规律排便'],
      night: ['夜深了 🌙', '安静的夜晚，肠道也在休息', '晚安，明天又是新的一天']
    };
    const g = hour < 10 ? greetings.morning : hour < 14 ? greetings.noon : hour < 20 ? greetings.evening : greetings.night;
    const greeting = g[Math.floor(Math.random() * g.length)];

    this.setData({ dark: app.getDarkMode(), greeting });
    const s = wx.getStorageSync('app_settings') || {};
    const warnSec = (s.warnMin || 10) * 60;
    this.setData({ warnSec, warnEnabled: s.warnEnabled !== false });
    this.loadStats();
    this.loadStreak();
    this.loadFortune();
    this.loadChallenge();
    const todaySessions = store.getToday().sessions;
    this.setData({ dailyTip: generateTip(todaySessions, store.getStreak()) });

    // 没有任何记录时，显示示例数据入口
    const allCount = store.getAllSessions().length;
    this.setData({ showSeedHint: allCount === 0 });

    // Timer recovery: check if there's an unfinished timer from last session
    const ts = wx.getStorageSync('_timer_state');
    if (ts && ts.running) {
      const elapsed = Math.floor((Date.now() - ts.startTime) / 1000);
      this.startTime = ts.startTime;
      this.setData({ running: true, runTip: '正在记录中…', warned: false, elapsed });
      this.resumeTimer();
    }
  },

  onHide() {
    // Save timer state before hiding to restore later
    if (this.data.running) {
      wx.setStorageSync('_timer_state', { startTime: this.startTime, running: true });
    }
    if (this.timerId) clearInterval(this.timerId);
  },

  resumeTimer() {
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      this.setData({ timeStr: m + ':' + s, elapsed, warnMin: Math.floor(elapsed / 60) });
      if (elapsed >= this.data.warnSec && !this.data.warned) {
        this.setData({ warned: true });
        if (this.data.warnEnabled) wx.vibrateLong();
      }
    }, 200);
  },

  loadStats() {
    const today = store.getToday();
    const s = today.sessions;
    if (!s.length) {
      this.setData({
        isEmpty: true,
        statItems: [
          { key: 'count', val: 0, label: '今日次数', icon: '🧻' },
          { key: 'totalMin', val: 0, label: '总时长(分)', icon: '⏱️' },
          { key: 'best', val: '--', label: '最短', icon: '⚡' },
          { key: 'avg', val: '--', label: '平均', icon: '📊' },
        ]
      });
      return;
    }
    this.setData({ isEmpty: false });
    const totalSec = s.reduce((a, b) => a + b.duration, 0);
    const times = s.map(x => Math.floor(x.duration / 60));
    this.setData({
      statItems: [
        { key: 'count', val: s.length, label: '今日次数', icon: '🧻' },
        { key: 'totalMin', val: Math.floor(totalSec / 60), label: '总时长(分)', icon: '⏱️' },
        { key: 'best', val: Math.min(...times) + '分', label: '最短', icon: '⚡' },
        { key: 'avg', val: Math.round(totalSec / s.length / 60) + '分', label: '平均', icon: '📊' },
      ]
    });
  },

  loadStreak() {
    const streak = store.getStreak();
    this.setData({ streak });
    // Celebrate streaks
    if (streak === 7) celebrate('streak');
  },

  loadFortune() {
    this.setData({ fortune: getFortune() });
  },

  loadChallenge() {
    this.setData({ challenge: getDailyChallenge() });
  },

  onStart() {
    this.startTime = Date.now();
    this.setData({ running: true, runTip: '正在记录中…', warned: false });
    wx.setStorageSync('_timer_state', { startTime: this.startTime, running: true });
    // Vibration feedback
    wx.vibrateShort();
    this.resumeTimer();
  },

  onStop() {
    clearInterval(this.timerId);
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    wx.setStorageSync('_last_session', { time: Date.now(), duration: elapsed });
    wx.removeStorageSync('_timer_state');
    wx.vibrateShort();
    this.setData({ running: false, timeStr: '00:00', elapsed: 0, runTip: '' });
    wx.navigateTo({ url: '/pages/record/record' });
  },

  goWeekly() {
    app.globalData.pendingView = 'weekly';
    wx.navigateTo({ url: '/pages/history/history' });
  },
  goAchievements() { wx.navigateTo({ url: '/pages/achievements/achievements' }); },
  goPersonality() { wx.navigateTo({ url: '/pages/personality/personality' }); },

  seedDemo() {
    wx.showModal({
      title: '生成演示数据',
      content: '将生成 10 条模拟记录（最近 2 周），你可以体验热力图、成就、人格等所有功能。\n\n随时可在设置中清除数据。',
      success: (res) => {
        if (res.confirm) {
          const count = store.seedSampleData();
          wx.showToast({ title: `已生成 ${count} 条演示数据`, icon: 'success', duration: 2000 });
          setTimeout(() => {
            this.loadStats();
            this.loadStreak();
            this.loadFortune();
            this.loadChallenge();
            this.setData({ showSeedHint: false });
          }, 800);
        }
      }
    });
  },

  onShareAppMessage() {
    const myCode = store.getMyCode();
    const sessions = store.getSessions(7);
    const streak = store.getStreak();
    const totalMin = Math.floor(sessions.reduce((a, s) => a + s.duration, 0) / 60);
    const d = `S${streak}W${sessions.length}M${totalMin}`;
    return {
      title: `噗噗日记 — 连续🔥${streak}天，周${sessions.length}次，一起来打卡！`,
      path: `/pages/index/index?invite=${myCode}&d=${d}`,
      imageUrl: ''
    };
  }
});
