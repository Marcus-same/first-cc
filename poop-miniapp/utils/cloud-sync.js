const store = require('./store');

const COLLECTION = 'user_stats';

function _db() {
  if (!wx.cloud) return null;
  try {
    return wx.cloud.database();
  } catch (e) {
    return null;
  }
}

// 推送我的最新统计数据到云数据库
function pushMyStats() {
  const db = _db();
  if (!db) return Promise.resolve(false);

  const code = store.getMyCode();
  const sessions = store.getSessions(7);
  const streak = store.getStreak();
  const totalMin = Math.floor(store.getAllSessions().reduce((a, s) => a + (s.duration || 0), 0) / 60);

  return db.collection(COLLECTION).doc(code).set({
    data: {
      code,
      streak,
      weekCount: sessions.length,
      totalMin,
      updatedAt: Date.now()
    }
  }).then(() => {
    console.log('[cloud-sync] 数据已推送');
    return true;
  }).catch((err) => {
    console.warn('[cloud-sync] 推送失败', err);
    return false;
  });
}

// 从云数据库拉取好友数据
function pullFriendStats(friendCodes) {
  const db = _db();
  if (!db || !friendCodes.length) return Promise.resolve({});

  // 云数据库 where 最多支持 20 个
  const codes = friendCodes.slice(0, 20);
  return db.collection(COLLECTION)
    .where({ code: db.command.in(codes) })
    .get()
    .then((res) => {
      const result = {};
      (res.data || []).forEach(doc => {
        result[doc.code] = {
          streak: doc.streak || 0,
          weekCount: doc.weekCount || 0,
          totalMin: doc.totalMin || 0
        };
      });
      console.log('[cloud-sync] 拉取到', Object.keys(result).length, '位好友数据');
      return result;
    })
    .catch((err) => {
      console.warn('[cloud-sync] 拉取失败', err);
      return {};
    });
}

// 云开发是否可用
function cloudAvailable() {
  return !!_db();
}

module.exports = { pushMyStats, pullFriendStats, cloudAvailable };
