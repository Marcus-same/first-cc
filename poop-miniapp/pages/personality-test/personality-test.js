const { PERSONAS } = require('../../utils/fun');
const app = getApp();

const QUESTIONS = [
  {
    id: 'q1', dim: 'time',
    text: '你排便最常发生在什么时段？',
    options: [
      { val: 'M', text: '🌅 清晨到中午前（5:00-12:00）' },
      { val: 'B', text: '☀️ 中午到傍晚（12:00-20:00）' },
      { val: 'E', text: '🌙 晚上到深夜（20:00-5:00）' },
    ]
  },
  {
    id: 'q2', dim: 'time',
    text: '你的排便时间在大多数日子里固定吗？',
    options: [
      { val: 'M', text: '✅ 很固定，每天差不多同一时间' },
      { val: 'B', text: '🔄 不太固定，跟着作息走' },
    ]
  },
  {
    id: 'q3', dim: 'speed',
    text: '你每次蹲坑大概多久？',
    options: [
      { val: 'Q', text: '⚡ 5 分钟以内，速战速决' },
      { val: 'M', text: '⏱️ 5-10 分钟，正常速度' },
      { val: 'L', text: '🧘 10 分钟以上，慢慢来' },
    ]
  },
  {
    id: 'q4', dim: 'speed',
    text: '你上厕所会带手机吗？',
    options: [
      { val: 'Q', text: '📵 从不带，专心解决' },
      { val: 'M', text: '👀 偶尔看看，很快放下' },
      { val: 'L', text: '📱 必须带，刷完才出来' },
    ]
  },
  {
    id: 'q5', dim: 'type',
    text: '你的大便形状绝大多数时候是？',
    options: [
      { val: 'S', text: '🎯 基本同一种样子，比较固定' },
      { val: 'V', text: '🎨 时硬时稀，变化不少' },
      { val: 'B', text: '🤷 没注意过，说不上来' },
    ]
  },
  {
    id: 'q6', dim: 'type',
    text: '吃辛辣或生冷食物后，你的大便会变化吗？',
    options: [
      { val: 'S', text: '🛡️ 没什么变化，肠道很稳' },
      { val: 'V', text: '🌊 明显变化，反应挺大' },
    ]
  },
  {
    id: 'q7', dim: 'rhythm',
    text: '你每周大概排便几天？',
    options: [
      { val: 'R', text: '📅 几乎每天（5-7 天）' },
      { val: 'C', text: '🗓️ 隔天或更少（1-4 天）' },
    ]
  },
  {
    id: 'q8', dim: 'rhythm',
    text: '如果某天没排便，你会怎么做？',
    options: [
      { val: 'R', text: '🥗 有点在意，会调整饮食多喝水' },
      { val: 'C', text: '😌 不在意，顺其自然' },
    ]
  },
  {
    id: 'q9', dim: 'time',
    text: '周末和工作日作息不同时，你的排便时间会变吗？',
    options: [
      { val: 'M', text: '⏰ 不变，准时准点' },
      { val: 'B', text: '🔄 会跟着作息调整' },
    ]
  },
  {
    id: 'q10', dim: 'speed',
    text: '你觉得自己排便速度属于哪种？',
    options: [
      { val: 'Q', text: '⚡ 偏快，进去一会儿就出来' },
      { val: 'M', text: '⏱️ 正常速度，不快不慢' },
      { val: 'L', text: '🐢 偏慢，总要蹲比较久' },
    ]
  },
  {
    id: 'q11', dim: 'type',
    text: '你有没有因为吃了某样东西而跑去厕所的经历？',
    options: [
      { val: 'S', text: '🛡️ 很少有，肠胃比较钝感' },
      { val: 'V', text: '🌊 经常有，吃完就想去' },
    ]
  },
  {
    id: 'q12', dim: 'rhythm',
    text: '你是否有意培养过排便习惯？',
    options: [
      { val: 'R', text: '🎯 有，会固定时间上厕所' },
      { val: 'C', text: '🍃 没有，顺其自然' },
    ]
  },
];

const DIM_NAMES = { time: '时段', speed: '速度', type: '类型', rhythm: '节律' };

Page({
  data: {
    dark: false,
    questions: QUESTIONS,
    answers: {},
    step: 'test', // test | result
    persona: null,
    code: '',
    dims: null
  },

  onLoad() {
    this.setData({ dark: app.getDarkMode() });
  },

  onOptionTap(e) {
    const { q, val } = e.currentTarget.dataset;
    const key = `answers.${q}`;
    this.setData({ [key]: val });
  },

  onSubmit() {
    const answers = this.data.answers;
    const answered = Object.keys(answers).length;

    if (answered < QUESTIONS.length) {
      wx.showToast({ title: `还剩 ${QUESTIONS.length - answered} 题未答`, icon: 'none' });
      return;
    }

    const counts = {
      time: { M: 0, E: 0, B: 0 },
      speed: { Q: 0, L: 0, M: 0 },
      type: { S: 0, V: 0, B: 0 },
      rhythm: { R: 0, C: 0 }
    };

    QUESTIONS.forEach(q => {
      const val = answers[q.id];
      if (counts[q.dim] && counts[q.dim][val] !== undefined) {
        counts[q.dim][val]++;
      }
    });

    const code = [
      this.topCode(counts.time, ['B', 'M', 'E']),
      this.topCode(counts.speed, ['M', 'Q', 'L']),
      this.topCode(counts.type, ['B', 'S', 'V']),
      this.topCode(counts.rhythm, ['C', 'R']),
    ].join('-');

    const persona = this.findPersona(code);
    const dims = this.calcDimsFromAnswers(counts);
    this.setData({ step: 'result', persona, code, dims });
  },

  topCode(counts, defaults) {
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const top = entries[0], second = entries[1];
    if (top[1] === second[1]) {
      return defaults.find(d => counts[d] === top[1]) || defaults[0];
    }
    return top[0];
  },

  findPersona(code) {
    const exact = PERSONAS.find(p => p.sbti === code);
    if (exact) return exact;
    const parts = code.split('-');
    let best = null, bestScore = -1;
    PERSONAS.forEach(p => {
      const pParts = p.sbti.split('-');
      if (pParts.length !== parts.length) return;
      const score = parts.reduce((s, part, i) => s + (part === pParts[i] ? 1 : 0), 0);
      if (score > bestScore) { bestScore = score; best = p; }
    });
    return best || PERSONAS[PERSONAS.length - 1];
  },

  calcDimsFromAnswers(counts) {
    const dims = {};
    for (const [dim, vals] of Object.entries(counts)) {
      const total = Object.values(vals).reduce((a, b) => a + b, 0);
      if (dim === 'time') {
        dims.time = Math.round((vals.E / (total || 1)) * 100);
      } else if (dim === 'speed') {
        const score = vals.L * 100 + vals.M * 50;
        dims.speed = Math.round(score / (total || 1));
      } else if (dim === 'type') {
        dims.type = Math.round((vals.V / (total || 1)) * 100);
      } else if (dim === 'rhythm') {
        dims.rhythm = Math.round((vals.C / (total || 1)) * 100);
      }
    }
    return dims;
  },

  onRetry() {
    this.setData({ step: 'test', answers: {}, persona: null, code: '', dims: null });
  },

  onShareAppMessage() {
    const p = this.data.persona;
    if (!p) return { title: '来测测你的肠道人格 BPTI 类型' };
    return {
      title: `我的肠道人格是 ${p.icon} ${p.name}（BPTI ${this.data.code}），快来测测你的！`,
      path: '/pages/personality-test/personality-test'
    };
  }
});
