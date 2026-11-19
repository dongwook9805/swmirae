'use strict';

const accessKey = 'swmirae.game.access';
const recordsKey = 'swmirae.game.starlight-records';
const gate = document.querySelector('#gate');
const gateText = document.querySelector('#gate-text');
const retry = document.querySelector('#retry');
const sharedAccess = new URLSearchParams(location.hash.slice(1)).get('access');
if (sharedAccess) history.replaceState(null, '', location.pathname + location.search);

async function openLesson() {
  let token = sharedAccess;
  try { token ||= localStorage.getItem(accessKey); } catch (_) {}
  if (!token) return;
  gateText.textContent = '상담 신청을 확인하고 있어요.';
  retry.hidden = true;
  try {
    const response = await requestBooking({mode: 'game-access', token});
    const result = await response.json();
    if (result.error === 'GAME_ACCESS_REQUIRED') {
      try {
        if (localStorage.getItem(accessKey) === token) localStorage.removeItem(accessKey);
      } catch (_) {}
      gateText.textContent = '체험 기간이 지났거나 신청을 확인할 수 없어요. 학원에 문의하거나 무료 상담을 신청해 주세요.';
      return;
    }
    if (!response.ok || !result.ok) throw new Error('Lesson unavailable');
    initLesson(window.starlightLesson);
    try { localStorage.setItem(accessKey, token); } catch (_) {}
    gate.hidden = true;
    document.querySelector('#workbench').hidden = false;
  } catch (_) {
    gateText.textContent = '지금은 온라인 실습을 여는 데 문제가 있어요. 잠시 후 다시 확인해 주세요.';
    retry.hidden = false;
  }
}

const gameTypes = {
  catch: {
    goal: '편지를 받아 점수 모으기',
    fields: [['편지', 'parcelPoints', 10, 1, 50], ['황금편지', 'goldPoints', 30, 1, 100], ['충돌감점', 'crashPenalty', 15, 0, 50]],
  },
  survive: {
    goal: '운석을 피해 끝까지 버티기',
    fields: [['목숨', 'lives', 3, 1, 5]],
  },
};
const meteorLevels = new Map([['적게', 0.1], ['보통', 0.25], ['많게', 0.4]]);

function ruleFields(type) {
  return [['시간', 'seconds', 30, 10, 60], ...gameTypes[type].fields];
}

function readRules(input, type) {
  const fields = new Map(ruleFields(type).map(field => [field[0], field]));
  const seen = new Set();
  const result = {};
  for (const [i, line] of input.split('\n').entries()) {
    if (!line.trim()) continue;
    const [name, value, extra] = line.trim().split(/\s+/);
    const cue = (i + 1) + '번째 줄';
    if (!value || extra) throw new Error(cue + '에 “시간 30”처럼 규칙과 값을 띄어 써 주세요.');
    if (seen.has(name)) throw new Error(cue + '의 ' + name + '이 앞에 이미 나왔어요.');
    seen.add(name);
    if (name === '운석') {
      if (!meteorLevels.has(value)) throw new Error(cue + '의 운석은 적게·보통·많게 중에서 써 주세요.');
      result.meteorRate = meteorLevels.get(value);
      continue;
    }
    const field = fields.get(name);
    if (!field) throw new Error(cue + '의 “' + name + '”을 확인해 주세요. 아래 안내의 규칙 이름을 써요.');
    const [, key,, min, max] = field;
    const number = Number(value);
    if (!/^\d+$/.test(value) || number < min || number > max) {
      throw new Error(cue + '의 ' + name + '은 ' + min + '부터 ' + max + ' 사이의 정수로 써 주세요.');
    }
    result[key] = number;
  }
  for (const name of [...fields.keys(), '운석']) {
    if (!seen.has(name)) throw new Error('“' + name + '” 규칙을 한 줄 써 주세요.');
  }
  return result;
}

function initLesson(example) {
  const designForm = document.querySelector('#design-form');
  const rulesForm = document.querySelector('#rules-form');
  const rulesInput = document.querySelector('#rules-input');
  const frameHost = document.querySelector('#frame-host');
  const settingsPattern = /\/\* LESSON_SETTINGS_START \*\/\s*({[^\n]+})\s*\/\* LESSON_SETTINGS_END \*\//;
  const original = JSON.parse(example.html.match(settingsPattern)[1]);
  const challengeButton = document.querySelector('#challenge');
  const exampleButton = document.querySelector('#show-example');
  const mineButton = document.querySelector('#show-mine');
  const designStatus = document.querySelector('#design-status');
  const codeStatus = document.querySelector('#code-status');
  const recordStatus = document.querySelector('#record-status');
  const promptStatus = document.querySelector('#prompt-status');
  let design = null;
  let game = null;
  let currentFrame = null;
  let challengeMode = false;

  function source(settings) {
    // HTML에서도 제목을 JavaScript 문자열 값으로만 처리해요.
    const json = JSON.stringify(settings).replace(/[<>&\u2028\u2029]/g, ch =>
      '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
    return example.html.replace(settingsPattern, () => '/* LESSON_SETTINGS_START */ ' + json + ' /* LESSON_SETTINGS_END */');
  }

  function preview(settings, mode) {
    challengeMode = settings.challenge;
    challengeButton.setAttribute('aria-pressed', String(mode === 'challenge'));
    exampleButton.setAttribute('aria-pressed', String(mode === 'example'));
    mineButton.setAttribute('aria-pressed', String(mode === 'custom'));
    const frame = document.createElement('iframe');
    frame.title = settings.title + ' 게임 화면';
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.srcdoc = source(settings);
    currentFrame = frame;
    frameHost.replaceChildren(frame);
    document.querySelector('#game-empty').hidden = true;
    frameHost.hidden = false;
    document.querySelector('#playtest-actions').hidden = mode !== 'custom';
    document.querySelector('#play-mode').textContent = {
      example: '예제에서 움직임과 점수 규칙을 살펴보세요.',
      custom: '게임 시작을 누르고 내 규칙이 예상대로 작동하는지 확인해요.',
      challenge: '모두 같은 30초 예제에 도전해요. 한 판을 끝내면 내 순위에 올라가요.',
    }[mode];
  }

  function getRecords() {
    try {
      const decoded = JSON.parse(localStorage.getItem(recordsKey) || '[]');
      if (Array.isArray(decoded)) return decoded.filter(score => Number.isInteger(score) && score >= 0 && score <= 10000).slice(0, 5);
    } catch (_) {}
    return [];
  }

  function showRecords(scores) {
    const list = document.querySelector('#records-list');
    list.replaceChildren();
    for (const [index, score] of scores.entries()) {
      const row = document.createElement('li');
      const rank = document.createElement('span');
      const points = document.createElement('strong');
      rank.textContent = (index + 1) + '위';
      points.textContent = score + '점';
      row.append(rank, points);
      list.append(row);
    }
  }

  window.addEventListener('message', event => {
    const result = event.data;
    if (!challengeMode || event.source !== currentFrame?.contentWindow || event.origin !== 'null' ||
        result?.type !== 'swmirae:round' || result.challenge !== true ||
        !Number.isInteger(result.score) || result.score < 0 || result.score > 10000) return;
    const previous = getRecords();
    const position = 1 + previous.filter(score => score >= result.score).length;
    const next = [...previous, result.score].sort((a, b) => b - a).slice(0, 5);
    try {
      localStorage.setItem(recordsKey, JSON.stringify(next));
      recordStatus.textContent = position <= 5 ? result.score + '점으로 내 기록 ' + position + '위!' : result.score + '점이에요. 한 판 더 도전해 볼까요?';
    } catch (_) {
      recordStatus.textContent = result.score + '점이에요. 이 브라우저에서 기록을 저장할 수 없어요.';
    }
    showRecords(next);
  });

  function resetRules(type) {
    rulesInput.value = [...ruleFields(type).map(([name,, value]) => name + ' ' + value), '운석 보통'].join('\n');
  }

  designForm.addEventListener('submit', event => {
    event.preventDefault();
    const form = new FormData(designForm);
    const title = form.get('title').trim();
    const idea = form.get('idea').trim();
    const kind = form.get('kind');
    const spacecraftColor = form.get('spacecraftColor');
    if (!title || title.length > 32 || !idea || idea.length > 160 || !Object.hasOwn(gameTypes, kind) ||
        !['#60a5fa', '#34d399', '#f472b6', '#facc15'].includes(spacecraftColor)) {
      designStatus.dataset.error = 'true';
      designStatus.textContent = '게임 제목과 아이디어를 쓰고 목표를 골라 주세요.';
      return;
    }
    if (design?.kind !== kind) resetRules(kind);
    design = {title, idea, kind, spacecraftColor};
    designStatus.dataset.error = 'false';
    designStatus.textContent = '‘' + title + '’의 목표를 정했어요. 이제 규칙을 직접 써 보세요.';
    const guide = ruleFields(kind).map(([name,,, min, max]) => name + ' ' + min + '–' + max).join(' · ');
    document.querySelector('#rule-guide').textContent = guide + ' · 운석은 적게 / 보통 / 많게';
    document.querySelector('#rules-empty').hidden = true;
    rulesForm.hidden = false;
    codeStatus.textContent = '';
    rulesInput.focus();
  });

  document.querySelector('#reset-rules').addEventListener('click', () => {
    resetRules(design.kind);
    codeStatus.textContent = '';
    rulesInput.focus();
  });

  rulesForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!design) return;
    let rules;
    try {
      rules = readRules(rulesInput.value, design.kind);
    } catch (error) {
      codeStatus.dataset.error = 'true';
      codeStatus.textContent = error.message;
      rulesInput.focus();
      return;
    }
    const {title, kind, spacecraftColor} = design;
    game = {title, kind, spacecraftColor, ...rules, challenge: false};
    const prompt = '“' + design.idea + '”라는 아이디어를 “' + title + '”라는 HTML 게임으로 만들어 줘.\n' +
      '목표는 ' + gameTypes[kind].goal + '야. 우주선 색은 ' + spacecraftColor + '로 해 줘.\n\n' +
      '내가 정한 규칙\n' + rulesInput.value.trim() + '\n\n' +
      '방향키와 터치 버튼으로 움직일 수 있게 하고, 규칙이 어느 코드에 들어갔는지 설명해 줘.';
    document.querySelector('#my-prompt').textContent = prompt;
    document.querySelector('#config-code').textContent = 'const CONFIG = ' + JSON.stringify(game, null, 2) + ';';
    document.querySelector('#full-code').textContent = source(game);
    document.querySelector('#code-step').hidden = false;
    document.querySelector('#prompt-step').hidden = false;
    promptStatus.textContent = '';
    mineButton.hidden = false;
    codeStatus.dataset.error = 'false';
    codeStatus.textContent = '규칙을 코드로 바꾸고 게임을 만들었어요.';
    preview(game, 'custom');
    if (matchMedia('(max-width: 780px)').matches) frameHost.scrollIntoView({block: 'start'});
  });

  exampleButton.addEventListener('click', () => preview(original, 'example'));
  challengeButton.addEventListener('click', () => preview({...original, challenge: true}, 'challenge'));
  mineButton.addEventListener('click', () => preview(game, 'custom'));
  document.querySelector('#edit-rules').addEventListener('click', () => rulesInput.focus());

  document.querySelector('#download').addEventListener('click', () => {
    const file = new Blob([source(game)], {type: 'text/html;charset=utf-8'});
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'my-space-game.html';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    document.querySelector('#play-mode').textContent = '받은 HTML 파일을 브라우저에서 열면 내 게임이 실행돼요.';
  });
  document.querySelector('#copy-prompt').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(document.querySelector('#my-prompt').textContent);
      promptStatus.textContent = '내 게임 요청문을 복사했어요.';
    } catch (_) {
      promptStatus.textContent = '위에 나온 요청문을 선택해 복사할 수 있어요.';
    }
  });

  document.querySelector('#original-prompt').textContent = example.prompt;
  const records = getRecords();
  showRecords(records);
  if (!records.length) recordStatus.textContent = '아직 도전 기록이 없어요.';
}

retry.addEventListener('click', openLesson);
openLesson();
