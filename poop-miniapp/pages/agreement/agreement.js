const app = getApp();
Page({
  data: { dark: false },
  onLoad() { this.setData({ dark: app.getDarkMode() }); }
});
