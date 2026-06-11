const STORE_KEY = 'poop_data';

function _read() {
  try {
    return JSON.parse(wx.getStorageSync(STORE_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

function _write(data) {
  wx.setStorageSync(STORE_KEY, JSON.stringify(data));
}

function _migrate() {
  const data = _read();
  if (data.days) return data; // already migrated
  // Migrate from old scattered keys
  const days = {};
  const today = new Date().toDateString();
  for (let i = 0; i < 60; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toDateString();
    let log;
    try {
      const storageKey = key === today ? 'poop_log' : 'poop_log_' + key;
      log = JSON.parse(wx.getStorageSync(storageKey) || 'null');
    } catch (e) { log = null; }
    if (log && log.sessions && log.sessions.length) {
      days[key] = { sessions: log.sessions };
      // Clean old key
      try { wx.removeStorageSync(key === today ? 'poop_log' : 'poop_log_' + key); } catch (e) {}
    }
  }
  data.days = days;
  data.friends = data.friends || {};
  _write(data);
  return data;
}

// --- Public API ---

function getToday() {
  const data = _migrate();
  const today = new Date().toDateString();
  if (!data.days[today]) data.days[today] = { sessions: [] };
  return { day: today, sessions: data.days[today].sessions };
}

function addSession(session) {
  const data = _migrate();
  const today = new Date().toDateString();
  if (!data.days[today]) data.days[today] = { sessions: [] };
  data.days[today].sessions.push(session);
  _write(data);
}

// dateKey: e.g. "Mon Jun 09 2026", index: position in sessions array
function deleteSession(dateKey, index) {
  const data = _migrate();
  if (data.days[dateKey] && data.days[dateKey].sessions) {
    data.days[dateKey].sessions.splice(index, 1);
    if (!data.days[dateKey].sessions.length) delete data.days[dateKey];
    _write(data);
    return true;
  }
  return false;
}

function getSessions(days) {
  const data = _migrate();
  const result = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toDateString();
    const day = data.days[key];
    if (day && day.sessions) {
      day.sessions.forEach(s => result.push({ ...s, _date: key }));
    }
  }
  return result;
}

function getAllSessions() {
  const data = _migrate();
  const result = [];
  Object.entries(data.days).forEach(([key, day]) => {
    if (day.sessions) {
      day.sessions.forEach(s => result.push({ ...s, _date: key }));
    }
  });
  return result;
}

function getDayCount() {
  const data = _migrate();
  return Object.keys(data.days).length;
}

function getStreak() {
  const data = _migrate();
  const today = new Date().toDateString();
  const todayHasData = data.days[today] && data.days[today].sessions && data.days[today].sessions.length;
  const days = Object.keys(data.days).sort().reverse();
  if (!days.length) return 0;
  let streak = 0;
  let check = new Date(todayHasData ? today : days[0]);
  if (!todayHasData && days[0] !== check.toDateString()) {
    check.setDate(check.getDate() - 1);
  }
  while (true) {
    const key = check.toDateString();
    if (data.days[key] && data.days[key].sessions && data.days[key].sessions.length) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function getFriends() {
  const data = _migrate();
  return data.friends || {};
}

function addFriend(code, name) {
  const data = _migrate();
  if (!data.friends) data.friends = {};
  if (data.friends[code]) return false;
  data.friends[code] = { name, addedAt: Date.now(), stats: null };
  _write(data);
  return true;
}

function updateFriendStats(code, stats) {
  const data = _migrate();
  if (!data.friends || !data.friends[code]) return;
  data.friends[code].stats = stats;
  data.friends[code].lastShared = Date.now();
  _write(data);
}

function removeFriend(code) {
  const data = _migrate();
  if (!data.friends || !data.friends[code]) return;
  delete data.friends[code];
  _write(data);
}

function getMyCode() {
  const data = _migrate();
  if (!data.myCode) {
    data.myCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    _write(data);
  }
  return data.myCode;
}

function getSquadName() {
  const data = _migrate();
  return data.squadName || '我的战队';
}

function setSquadName(name) {
  const data = _migrate();
  data.squadName = name;
  _write(data);
}

// 生成示例数据（供新用户体验功能）
function seedSampleData() {
  const data = _migrate();
  const now = new Date();
  const types = [4, 3, 4, 5, 4, 2, 4, 3, 4, 4, 6, 4, 3, 4];
  const notes = ['早餐后', '喝了很多水', '有点干', '', '午餐后', '', '', '很顺畅', '', '', '昨晚吃辣了', '', '晨跑后', '完美的💩'];
  let count = 0;
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    // Skip 3 random days to make it realistic
    if ([2, 7, 11].includes(i)) continue;
    const key = d.toDateString();
    if (!data.days[key]) data.days[key] = { sessions: [] };
    const hour = 7 + Math.floor(Math.random() * 12);
    const minute = Math.floor(Math.random() * 60);
    const start = new Date(d);
    start.setHours(hour, minute, 0, 0);
    data.days[key].sessions.push({
      start: start.getTime(),
      duration: 120 + Math.floor(Math.random() * 480),
      type: types[i],
      note: notes[i] || ''
    });
    count++;
  }
  _write(data);
  return count;
}

function clearAll() {
  wx.removeStorageSync(STORE_KEY);
  wx.removeStorageSync('_last_session');
  wx.removeStorageSync('_timer_state');
  wx.removeStorageSync('app_settings');
  // Also clean old keys
  const today = new Date().toDateString();
  for (let i = 0; i < 60; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toDateString();
    try { wx.removeStorageSync('poop_log_' + key); } catch (e) {}
  }
  try { wx.removeStorageSync('poop_log'); } catch (e) {}
}

function exportAll() {
  const data = _migrate();
  const all = getAllSessions();
  return { sessions: all, friends: data.friends, myCode: data.myCode, squadName: data.squadName };
}

function getDistinctLocations() {
  const all = getAllSessions();
  const locs = new Map();
  all.forEach(s => {
    if (s.location && s.location.lat) {
      const key = `${s.location.lat.toFixed(4)},${s.location.lng.toFixed(4)}`;
      if (!locs.has(key)) {
        locs.set(key, { ...s.location, count: 0, types: [] });
      }
      const entry = locs.get(key);
      entry.count++;
      if (s.type) entry.types.push(s.type);
    }
  });
  return [...locs.values()].map(l => ({
    ...l,
    dominantType: l.types.length ? Math.round(l.types.reduce((a, b) => a + b, 0) / l.types.length) : null
  }));
}

module.exports = {
  getToday, addSession, deleteSession, getSessions, getAllSessions, getDayCount, getStreak,
  getFriends, addFriend, updateFriendStats, removeFriend,
  getMyCode, getSquadName, setSquadName,
  clearAll, exportAll, seedSampleData,
  getDistinctLocations
};
