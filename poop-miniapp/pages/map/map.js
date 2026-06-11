const store = require('../../utils/store');
const { BRISTOL } = require('../../utils/health-tips');
const app = getApp();

Page({
  data: {
    dark: false,
    latitude: 39.9042, longitude: 116.4074, // Default: Beijing
    markers: [], allMarkers: [],
    filterIdx: 0,
    filters: ['全部', '便秘型', '正常型', '腹泻型'],
    stats: { locations: 0, total: 0 },
    showFriends: false
  },

  onLoad() {
    this.setData({ dark: app.getDarkMode() });
    // 获取当前位置作为默认地图中心
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({ latitude: res.latitude, longitude: res.longitude });
      },
      fail: () => { /* 保持默认位置 */ }
    });
    this.loadMarkers();
  },

  onShow() {
    this.loadMarkers();
  },

  loadMarkers() {
    const sessions = store.getAllSessions().filter(s => s.location && s.location.lat);
    const locMap = {};

    sessions.forEach(s => {
      const key = `${s.location.lat.toFixed(4)},${s.location.lng.toFixed(4)}`;
      if (!locMap[key]) {
        locMap[key] = {
          id: key.replace(/[.,]/g, ''),
          latitude: s.location.lat,
          longitude: s.location.lng,
          sessions: []
        };
      }
      locMap[key].sessions.push(s);
    });

    const markers = Object.values(locMap).map(loc => {
      const types = loc.sessions.filter(s => s.type).map(s => s.type);
      const avgType = types.length ? Math.round(types.reduce((a, b) => a + b, 0) / types.length) : null;
      const bristol = avgType ? BRISTOL.find(b => b.type === avgType) : null;
      return {
        id: Number(loc.id),
        latitude: loc.latitude,
        longitude: loc.longitude,
        callout: {
          content: `${bristol ? bristol.icon : '🚽'} ${loc.sessions.length}次`,
          fontSize: 13,
          padding: 8,
          borderRadius: 8,
          display: 'ALWAYS'
        },
        width: 36,
        height: 36,
        _types: types,
        _avgType: avgType,
        _count: loc.sessions.length
      };
    });

    // Center on most recent location or keep default
    if (markers.length) {
      const last = markers[markers.length - 1];
      this.setData({ latitude: last.latitude, longitude: last.longitude });
    }

    const distinctLocs = new Set(markers.map(m => `${m.latitude.toFixed(3)},${m.longitude.toFixed(3)}`));
    this.setData({
      allMarkers: markers,
      markers: this.applyFilter(markers, 0),
      stats: { locations: distinctLocs.size, total: sessions.length }
    });
  },

  applyFilter(markers, idx) {
    if (idx === 0) return markers;
    if (idx === 1) return markers.filter(m => m._avgType && m._avgType <= 2);  // Constipation
    if (idx === 2) return markers.filter(m => m._avgType && m._avgType >= 3 && m._avgType <= 5);  // Normal
    if (idx === 3) return markers.filter(m => m._avgType && m._avgType >= 6);  // Diarrhea
    return markers;
  },

  onFilterTap(e) {
    const idx = parseInt(e.currentTarget.dataset.idx);
    this.setData({
      filterIdx: idx,
      markers: this.applyFilter(this.data.allMarkers, idx)
    });
  },

  toggleFriends() {
    if (!this.data.showFriends) {
      // Load friend-shared locations
      const friends = store.getFriends();
      const friendMarkers = [];
      Object.entries(friends).forEach(([code, f]) => {
        if (f.stats && f.stats.locations) {
          f.stats.locations.forEach(loc => {
            friendMarkers.push({
              id: Number(String(code + loc.lat + loc.lng).replace(/[^0-9]/g, '').slice(0, 10)),
              latitude: loc.lat,
              longitude: loc.lng,
              callout: {
                content: `👤 ${f.name} ${loc.icon || '🚽'}`,
                fontSize: 12,
                padding: 6,
                borderRadius: 8,
                display: 'ALWAYS',
                bgColor: '#5a9fd4',
                color: '#fff'
              },
              width: 32,
              height: 32
            });
          });
        }
      });
      this.setData({ markers: [...this.data.markers, ...friendMarkers], showFriends: true });
      wx.showToast({ title: '已显示好友位置', icon: 'none' });
    } else {
      this.setData({
        markers: this.applyFilter(this.data.allMarkers, this.data.filterIdx),
        showFriends: false
      });
    }
  },

  onMarkerTap(e) {
    // Marker tap handled by callout naturally
  },

  goSquad() { wx.navigateTo({ url: '/pages/squad/squad' }); },

  onShareAppMessage() {
    const myCode = store.getMyCode();
    return {
      title: '来看我的噗噗地图！加入一起打卡吧 🗺️',
      path: `/pages/map/map?invite=${myCode}`,
      imageUrl: ''
    };
  }
});
