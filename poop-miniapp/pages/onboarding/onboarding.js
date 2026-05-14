const app = getApp();

Page({
  data: {
    dark: false,
    current: 0,
    slides: [
      {
        emoji: '🚽',
        title: '记录每一次',
        desc: '开始计时 → 结束记录 → 选择布里斯托类型\n简单三步，追踪肠道健康',
        color: '#6b8e4e'
      },
      {
        emoji: '🔬',
        title: '了解你的肠道',
        desc: '布里斯托分类法将便便分为 7 种类型\n第 4 型是黄金标准，柔软成型最健康',
        color: '#e07b5a'
      },
      {
        emoji: '👥',
        title: '和朋友一起',
        desc: '生成邀请码，添加好友\n分享周报，比比谁更规律',
        color: '#5a9fd4'
      },
      {
        emoji: '🏅',
        title: '坚持就有收获',
        desc: '连续打卡解锁成就勋章\n肠道人格、噗噗地图等你发现',
        color: '#c9a234'
      }
    ]
  },

  onLoad() {
    this.setData({ dark: app.getDarkMode() });
  },

  onSwiperChange(e) {
    this.setData({ current: e.detail.current });
  },

  onStart() {
    wx.setStorageSync('_onboarded', true);
    wx.switchTab({ url: '/pages/index/index' });
  },

  onSkip() {
    wx.setStorageSync('_onboarded', true);
    wx.switchTab({ url: '/pages/index/index' });
  }
});
