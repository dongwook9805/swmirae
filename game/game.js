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

function initLesson(example) {
  const form = document.querySelector('#settings-form');
  const frameHost = document.querySelector('#frame-host');
  const code = document.querySelector('#config-code');
  const fullCode = document.querySelector('#full-code');
  const settingsPattern = /\/\* LESSON_SETTINGS_START \*\/\s*({[^\n]+})\s*\/\* LESSON_SETTINGS_END \*\//;
  const match = example.html.match(settingsPattern);
  if (!match) throw new Error('Lesson settings unavailable');
  const original = JSON.parse(match[1]);
  const challengeButton = document.querySelector('#challenge');
  const exampleButton = document.querySelector('#show-example');
  const codeStatus = document.querySelector('#code-status');
  const recordStatus = document.querySelector('#record-status');
  const promptStatus = document.querySelector('#prompt-status');
  let savedSettings = {...original};
  let currentFrame = null;
  let challengeMode = false;

  function source(settings) {
    // HTML 템플릿 안의 스크립트에서 제목 입력을 항상 문자열 값으로만 처리한다.
    const json = JSON.stringify(settings).replace(/[<>&\u2028\u2029]/g, ch =>
      '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
    return example.html.replace(settingsPattern, () => '/* LESSON_SETTINGS_START */ ' + json + ' /* LESSON_SETTINGS_END */');
  }

  function preview(settings, mode) {
    challengeMode = settings.challenge;
    challengeButton.setAttribute('aria-pressed', String(mode === 'challenge'));
    exampleButton.setAttribute('aria-pressed', String(mode === 'example'));
    const frame = document.createElement('iframe');
    frame.title = settings.title + ' 게임 화면';
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.srcdoc = source(settings);
    currentFrame = frame;
    frameHost.replaceChildren(frame);
    document.querySelector('#play-mode').textContent = {
      example: '편지를 받아 점수를 모으고 운석을 피해 보세요.',
      custom: '내가 바꾼 설정이 적용됐어요. 게임 파일로 가져갈 수 있어요.',
      challenge: '모두 같은 30초 규칙으로 플레이해요. 한 판을 끝내면 내 순위에 올라가요.',
    }[mode];
  }

  function renderCode() {
    code.textContent = 'const CONFIG = ' + JSON.stringify(savedSettings, null, 2) + ';';
    fullCode.textContent = source(savedSettings);
  }

  function fillForm(settings) {
    for (const key of ['title', 'spacecraftColor', 'seconds', 'meteorRate']) {
      form.elements.namedItem(key).value = settings[key];
    }
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

  form.addEventListener('submit', event => {
    event.preventDefault();
    const fields = new FormData(form);
    const title = String(fields.get('title')).trim();
    const seconds = Number(fields.get('seconds'));
    const meteorRate = Number(fields.get('meteorRate'));
    const spacecraftColor = String(fields.get('spacecraftColor'));
    if (!title || title.length > 32 || ![20, 30, 45].includes(seconds) ||
        ![0.1, 0.25, 0.4].includes(meteorRate) || !['#60a5fa', '#34d399', '#f472b6', '#facc15'].includes(spacecraftColor)) {
      codeStatus.textContent = '게임 제목과 설정을 확인해 주세요.';
      return;
    }
    savedSettings = {title, spacecraftColor, seconds, meteorRate, challenge: false};
    renderCode();
    preview(savedSettings, 'custom');
    codeStatus.textContent = '내 설정을 코드에 반영했어요.';
    if (matchMedia('(max-width: 780px)').matches) frameHost.scrollIntoView({block: 'start'});
  });

  document.querySelector('#reset-settings').addEventListener('click', () => {
    savedSettings = {...original};
    fillForm(savedSettings);
    renderCode();
    preview(original, 'example');
    codeStatus.textContent = '원래 예제 설정으로 되돌렸어요.';
  });
  exampleButton.addEventListener('click', () => preview(original, 'example'));
  challengeButton.addEventListener('click', () => preview({...original, challenge: true}, 'challenge'));

  document.querySelector('#download').addEventListener('click', () => {
    const file = new Blob([source(savedSettings)], {type: 'text/html;charset=utf-8'});
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'my-starlight-game.html';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    promptStatus.textContent = '받은 HTML 파일을 브라우저에서 열면 내 게임이 실행돼요.';
  });
  document.querySelector('#copy-prompt').addEventListener('click', async () => {
    const prompt = '아래 HTML 게임에서 황금 편지를 연속으로 2개 받으면 보너스 20점을 주는 기능을 추가해 줘. ' +
      '기존의 조작과 시간 설정은 유지하고, 바뀐 코드가 무슨 일을 하는지도 설명해 줘.';
    try {
      await navigator.clipboard.writeText(prompt + '\n\n현재 HTML 코드\n' + source(savedSettings));
      promptStatus.textContent = '수정 요청을 복사했어요.';
    } catch (_) {
      promptStatus.textContent = prompt + ' 이 문장과 다운로드한 HTML 파일을 함께 보내 보세요.';
    }
  });

  document.querySelector('#original-prompt').textContent = example.prompt;
  fillForm(savedSettings);
  renderCode();
  const records = getRecords();
  showRecords(records);
  if (!records.length) recordStatus.textContent = '아직 도전 기록이 없어요.';
  preview(original, 'example');
}

retry.addEventListener('click', openLesson);
openLesson();
