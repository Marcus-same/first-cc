const { BRISTOL } = require('../../utils/health-tips');
const store = require('../../utils/store');
const { celebrate, checkChallenge } = require('../../utils/fun');
const app = getApp();

Page({
  data: {
    dark: false, min: 0, sec: 0, duration: 0,
    bristol: BRISTOL, selectedType: null, advice: '',
    note: '', recordLocation: false, location: null, locationName: ''
  },

  onLoad() {
    this.setData({ dark: app.getDarkMode() });
    const last = wx.getStorageSync('_last_session') || { duration: 0 };
    const dur = last.duration || 0;
    this.setData({
      min: Math.floor(dur / 60),
      sec: dur % 60,
      duration: dur
    });
  },

  selectType(e) {
    const t = parseInt(e.currentTarget.dataset.type);
    const b = BRISTOL.find(x => x.type === t);
    this.setData({ selectedType: t, advice: b ? b.advice : '' });
  },

  toggleLocation() {
    const enable = !this.data.recordLocation;
    this.setData({ recordLocation: enable });
    if (enable) {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => {
          this.setData({
            location: { lat: res.latitude, lng: res.longitude },
            locationName: `${res.latitude.toFixed(2)}, ${res.longitude.toFixed(2)}`
          });
        },
        fail: () => {
          wx.showToast({ title: '获取位置失败，请授权定位权限', icon: 'none' });
          this.setData({ recordLocation: false });
        }
      });
    } else {
      this.setData({ location: null, locationName: '' });
    }
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value });
  },

  skip() { this.saveRecord(null); },

  save() { this.saveRecord(this.data.selectedType); },

  saveRecord(type) {
    const session = {
      start: Date.now() - this.data.duration * 1000,
      duration: this.data.duration,
      type: type,
      note: this.data.note || ''
    };
    if (this.data.location) {
      session.location = this.data.location;
      if (this.data.locationName) session.location.name = this.data.locationName;
    }
    store.addSession(session);
    wx.removeStorageSync('_last_session');
    wx.removeStorageSync('_timer_state');

    // Check milestones
    const total = store.getAllSessions().length;
    if (total === 1 || total === 10 || total === 50 || total === 100) {
      celebrate('milestone');
    }

    // Check daily challenge after saving
    checkChallenge();
    // 返回到首页 tab（确保不依赖页面栈）
    wx.switchTab({ url: '/pages/index/index' });
  }
});
