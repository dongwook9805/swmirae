'use strict';
const storageKey = 'swmirae.game.access';
const gate = document.querySelector('#gate');
const gateText = document.querySelector('#gate-text');
const retry = document.querySelector('#retry');
const sharedAccess = new URLSearchParams(location.hash.slice(1)).get('access');
if (sharedAccess) history.replaceState(null, '', location.pathname + location.search);

async function openLesson() {
  let token = sharedAccess;
  try { token ||= localStorage.getItem(storageKey); } catch (_) {}
  if (!token) return;
  gateText.textContent = '상담 신청을 확인하고 있어요.';
  retry.hidden = true;
  try {
    const response = await requestBooking({mode: 'game-access', token});
    const result = await response.json();
    if (result.error === 'GAME_ACCESS_REQUIRED') {
      try {
        if (localStorage.getItem(storageKey) === token) localStorage.removeItem(storageKey);
      } catch (_) {}
      gateText.textContent = '체험 기간이 지났거나 신청을 확인할 수 없어요. 학원에 문의하거나 무료 상담을 신청해 주세요.';
      return;
    }
    if (!response.ok || !result.ok || !result.lesson) throw new Error('Lesson unavailable');
    try { localStorage.setItem(storageKey, token); } catch (_) {}
    initGame(result.lesson);
    gate.hidden = true;
    document.querySelector('#workbench').hidden = false;
  } catch (_) {
    gateText.textContent = '지금은 상담 신청을 확인하기 어려워요. 잠시 후 다시 확인해 주세요.';
    retry.hidden = false;
  }
}

function initGame(lesson) {
  const guide = document.querySelector('#guide');
  const input = document.querySelector('#code');
  const canvas = document.querySelector('#board');
  const ctx = canvas.getContext('2d');
  const score = document.querySelector('#score');
  const codeStatus = document.querySelector('#code-status');
  const playStatus = document.querySelector('#play-status');
  const moves = new Set();
  const keys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
  const rules = new Map(lesson.commands.map(command => [command.name, command]));
  const colors = {파랑: '#60a5fa', 노랑: '#facc15', 초록: '#34d399', 분홍: '#f472b6'};
  let world = null;
  let animation = 0;
  let lastTime = 0;

  function restore() {
    input.value = lesson.starter;
    codeStatus.textContent = '';
    codeStatus.dataset.error = 'false';
  }

  for (const {name, example, help} of lesson.commands) {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const detail = document.createElement('dd');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = example;
    button.setAttribute('aria-label', example + ' 예시 넣기');
    button.addEventListener('click', () => {
      const line = new RegExp('^[ \\t]*' + name + '(?:[ \\t]+[^\\n]*)?$', 'm');
      const next = input.value.trimEnd();
      input.value = line.test(next) ? next.replace(line, example) : [next, example].filter(Boolean).join('\n');
      input.focus();
      codeStatus.textContent = '예시를 넣었어요. 숫자나 색을 바꿔서 실행해 보세요.';
      codeStatus.dataset.error = 'false';
    });
    term.append(button);
    detail.textContent = help;
    row.append(term, detail);
    guide.append(row);
  }

  function parse() {
    const result = Object.create(null);
    for (const [i, raw] of input.value.split('\n').entries()) {
      if (!raw.trim()) continue;
      const [name, value, extra] = raw.trim().split(/\s+/);
      const rule = rules.get(name);
      const prefix = (i + 1) + '번째 줄을 확인해 주세요. ';
      if (!rule || !value || extra) throw Error(prefix + '예시처럼 명령과 값을 띄어 써요.');
      if (Object.hasOwn(result, name)) throw Error(prefix + name + ' 명령은 한 번만 써요.');
      if (rule.values) {
        if (!rule.values.includes(value)) throw Error(prefix + rule.help);
        result[name] = value;
      } else {
        const number = Number(value);
        if (!/^\d+$/.test(value) || number < rule.min || number > rule.max) throw Error(prefix + rule.help);
        result[name] = number;
      }
    }
    for (const name of rules.keys()) {
      if (!Object.hasOwn(result, name)) throw Error(name + ' 명령을 한 줄 추가해 주세요.');
    }
    return result;
  }

  function rounded(x, y, w, h, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  }

  function draw() {
    ctx.fillStyle = '#101c34';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#304366';
    for (let y = 16; y < canvas.height; y += 24) {
      for (let x = 16; x < canvas.width; x += 24) ctx.fillRect(x, y, 2, 2);
    }
    if (!world) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '31px sans-serif';
    ctx.fillStyle = '#ffc93c';
    for (const star of world.stars) {
      if (!star.collected) ctx.fillText('★', star.x, star.y + 1);
    }
    for (const rock of world.rocks) {
      rounded(rock.x - 14, rock.y - 14, 28, 28, 8, '#7e8da5');
      rounded(rock.x - 9, rock.y - 9, 10, 5, 2, '#aebbd0');
    }
    const {x, y} = world.player;
    rounded(x - 14, y - 14, 28, 28, 8, world.color);
    rounded(x - 7, y - 4, 4, 5, 1, '#101c34');
    rounded(x + 3, y - 4, 4, 5, 1, '#101c34');
  }

  function intersects(point, radius) {
    const {x, y} = world.player;
    return Math.hypot(point.x - x, point.y - y) < radius;
  }

  function tick(timestamp) {
    if (!world?.playing) return;
    const dt = Math.min(.035, (timestamp - (lastTime || timestamp)) / 1000);
    lastTime = timestamp;
    const dx = Number(moves.has('ArrowRight')) - Number(moves.has('ArrowLeft'));
    const dy = Number(moves.has('ArrowDown')) - Number(moves.has('ArrowUp'));
    const velocity = world.speed * dt / (Math.hypot(dx, dy) || 1);
    world.player.x = Math.max(15, Math.min(canvas.width - 15, world.player.x + velocity * dx));
    world.player.y = Math.max(15, Math.min(canvas.height - 15, world.player.y + velocity * dy));

    if (world.rocks.some(rock => intersects(rock, 25))) {
      world.player = {...lesson.start};
      playStatus.textContent = '장애물에 닿았어요. 모은 별은 그대로 두고 출발점으로 돌아왔어요.';
    }
    for (const star of world.stars) {
      if (star.collected || !intersects(star, 28)) continue;
      star.collected = true;
      world.count += 1;
      score.textContent = world.count + ' / ' + world.stars.length + ' 별';
      playStatus.textContent = '별을 모았어요!';
    }
    if (world.count === world.stars.length) {
      world.playing = false;
      moves.clear();
      playStatus.textContent = '성공! 별을 모두 모았어요. 명령을 바꾸면 새 게임이 돼요.';
    }
    draw();
    if (world.playing) animation = requestAnimationFrame(tick);
  }

  function start() {
    let values;
    try { values = parse(); } catch (error) {
      codeStatus.textContent = error.message;
      codeStatus.dataset.error = 'true';
      input.focus();
      return;
    }
    cancelAnimationFrame(animation);
    moves.clear();
    world = {
      player: {...lesson.start},
      color: colors[values.색상],
      speed: 45 + values.속도 * 24,
      stars: lesson.stars.slice(0, values.별).map(star => ({...star, collected: false})),
      rocks: lesson.rocks.slice(0, values.장애물),
      count: 0,
      playing: true
    };
    score.textContent = '0 / ' + world.stars.length + ' 별';
    codeStatus.textContent = '명령을 게임에 적용했어요.';
    codeStatus.dataset.error = 'false';
    playStatus.textContent = '방향키나 아래 버튼으로 움직여 별을 모으세요.';
    lastTime = 0;
    draw();
    if (matchMedia('(max-width: 720px)').matches) canvas.scrollIntoView({block: 'nearest'});
    canvas.focus({preventScroll: true});
    animation = requestAnimationFrame(tick);
  }

  canvas.addEventListener('keydown', event => {
    if (!world?.playing || !keys.has(event.key)) return;
    event.preventDefault();
    moves.add(event.key);
  });
  canvas.addEventListener('keyup', event => moves.delete(event.key));
  canvas.addEventListener('blur', () => moves.clear());
  window.addEventListener('blur', () => moves.clear());
  for (const button of document.querySelectorAll('[data-move]')) {
    const key = button.dataset.move;
    button.addEventListener('pointerdown', event => {
      button.setPointerCapture(event.pointerId);
      moves.add(key);
    });
    button.addEventListener('lostpointercapture', () => moves.delete(key));
    button.addEventListener('keydown', event => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      moves.add(key);
    });
    button.addEventListener('keyup', () => moves.delete(key));
    button.addEventListener('blur', () => moves.delete(key));
  }
  document.querySelector('#run').addEventListener('click', start);
  document.querySelector('#reset').addEventListener('click', restore);
  restore();
  draw();
}

retry.addEventListener('click', openLesson);
openLesson();
