'use strict';

const starlightPrompt = `초등 고학년이 내 컴퓨터에서 직접 열어볼 수 있는 ‘별빛 우체국’ 브라우저 게임을 HTML 파일 하나로 만들어 줘.

우주선을 좌우 방향키나 화면의 두 버튼으로 움직여, 하늘에서 떨어지는 편지를 받으면 +10점, 황금 편지는 +30점, 운석에 부딪히면 -15점이 되게 해 줘. 점수는 0 아래로 내려가지 않아. 제한 시간 30초가 끝나면 결과와 다시 하기 버튼을 보여 줘.

같은 난이도에서 도전할 수 있도록 매 판 물체의 등장 순서를 동일하게 해 줘. 중앙으로 떨어지는 편지를 초반에 배치해서 첫 플레이가 어렵지 않게 해 줘.

JavaScript에 제목, 우주선 색, 제한 시간과 운석 등장 비율을 정하는 CONFIG를 만들어 줘. 배경은 별이 보이는 짙은 밤하늘로 하고, 점수가 바뀌는 순간을 화면에 표시해 줘. 키를 누르고 있는 동안이나 화면 버튼을 터치하고 있는 동안 계속 움직이게 해 줘. 외부 이미지나 프로그램 없이 실행할 수 있고, 조작과 점수 처리 부분을 읽기 쉽게 한글 주석도 붙여 줘.`;

const starlightHtml = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>별빛 우체국</title>
<style>
:root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; background: #0a1328; color: #eff6ff; }
* { box-sizing: border-box; }
body { margin: 0; }
main { width: min(100%, 860px); padding: 12px; margin: auto; }
header, .controls { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
h1 { margin: 0; font-size: clamp(16px, 3vw, 23px); overflow-wrap: anywhere; }
.hud { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.hud span { padding: 5px 9px; border-radius: 7px; background: #1b2c48; color: #dceaff; font-size: 14px; white-space: nowrap; }
.hud strong { color: #f7d679; }
.rules, #message { color: #b4c6e1; margin: 8px 0; line-height: 1.4; font-size: 13px; }
#message { min-height: 1.4em; margin-bottom: 0; }
.board { border: 1px solid #2a4161; border-radius: 10px; overflow: hidden; background: #101e3b; }
canvas { display: block; width: 100%; height: auto; }
.controls { margin-top: 9px; }
.move { display: flex; gap: 5px; }
button { appearance: none; border: 1px solid #40597b; background: #1b2c48; color: #eff6ff; min-width: 44px; min-height: 40px; border-radius: 7px; padding: 6px 10px; font: inherit; font-size: 14px; font-weight: 750; touch-action: none; cursor: pointer; }
button:hover, button:focus-visible { outline: 2px solid #a0f1d9; outline-offset: 1px; }
#start { color: #142c32; border-color: #97ecd3; background: #97ecd3; }
#start:disabled { cursor: default; filter: saturate(.45); opacity: .72; }
@media(max-width: 420px) { main { padding: 9px; } .rules, #message { font-size: 12px; } button { min-height: 36px; } }
</style>
</head>
<body>
<main>
  <header>
    <h1 id="title"></h1>
    <div class="hud"><span>남은 시간 <strong id="time">30</strong>초</span><span><b id="metric">점수</b> <strong id="score">0</strong><b id="unit">점</b></span></div>
  </header>
  <p class="rules" id="rules"></p>
  <div class="board"><canvas width="720" height="352" id="space" aria-label="별빛 우체국 게임 화면"></canvas></div>
  <div class="controls">
    <div class="move" aria-label="우주선 조작">
      <button type="button" data-key="ArrowLeft" aria-label="왼쪽">← 왼쪽</button>
      <button type="button" data-key="ArrowRight" aria-label="오른쪽">오른쪽 →</button>
    </div>
    <button type="button" id="start">게임 시작</button>
  </div>
  <p id="message" role="status">방향키나 이동 버튼을 누르고 있으면 우주선이 움직여요.</p>
</main>
<script>
// 한 줄의 설정을 바꿔 나만의 게임을 만들어요.
const CONFIG = /* LESSON_SETTINGS_START */ {"title":"별빛 우체국","kind":"catch","spacecraftColor":"#60a5fa","seconds":30,"meteorRate":0.25,"parcelPoints":10,"goldPoints":30,"crashPenalty":15,"challenge":false} /* LESSON_SETTINGS_END */;
const canvas = document.getElementById('space');
const world = canvas.getContext('2d');
const timer = document.getElementById('time');
const scoreLabel = document.getElementById('score');
const start = document.getElementById('start');
const message = document.getElementById('message');
const width = canvas.width;
const height = canvas.height;
const moves = new Set();
const shipY = height - 42;
const survival = CONFIG.kind === 'survive';
let shipX = width / 2;
let score = 0;
let lives = CONFIG.lives || 0;
let items = [];
let signals = [];
let playing = false;
let roundStart = 0;
let previousFrame = 0;
let nextItemAt = 0;
let itemNumber = 0;
let seed = 91;

document.title = CONFIG.title;
document.getElementById('title').textContent = CONFIG.title;
timer.textContent = CONFIG.seconds;
start.textContent = CONFIG.challenge ? '도전 시작' : '게임 시작';
document.getElementById('metric').textContent = survival ? '목숨' : '점수';
document.getElementById('unit').textContent = survival ? '개' : '점';
document.getElementById('rules').textContent = survival
  ? '운석에 닿으면 목숨을 하나 잃어요. 시간이 끝날 때까지 버텨요.'
  : '편지 +' + CONFIG.parcelPoints + ' · 황금 편지 +' + CONFIG.goldPoints + ' · 운석 −' + CONFIG.crashPenalty;
scoreLabel.textContent = survival ? lives : score;

// 시드가 같은 난수를 사용해서 매 판 같은 위치와 순서로 물체가 나와요.
function random() {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 4294967296;
}

function spawn(elapsed) {
  while (elapsed >= nextItemAt) {
    const lane = random();
    const kind = random();
    const velocity = random();
    const firstParcel = !survival && itemNumber < 2;
    const center = firstParcel || (survival && itemNumber === 0);
    const shape = firstParcel ? 'mail' : kind < CONFIG.meteorRate ? 'meteor' : kind > .90 ? 'gold' : 'mail';
    items.push({
      x: center ? width / 2 + itemNumber * 53 : 30 + lane * (width - 60),
      y: -18,
      speed: 132 + velocity * 58 + elapsed * 2.4,
      kind: survival ? 'meteor' : shape
    });
    itemNumber++;
    nextItemAt += survival ? Math.max(.38, 1.18 - CONFIG.meteorRate - nextItemAt * .010)
      : Math.max(.40, .78 - nextItemAt * .010);
  }
}

function polygon(points, fill) {
  world.beginPath();
  world.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) world.lineTo(x, y);
  world.closePath();
  world.fillStyle = fill;
  world.fill();
}

function draw(elapsed) {
  const sky = world.createLinearGradient(0, 0, width, height);
  sky.addColorStop(0, '#10203d');
  sky.addColorStop(.55, '#0b1832');
  sky.addColorStop(1, '#103646');
  world.fillStyle = sky;
  world.fillRect(0, 0, width, height);
  for (let i = 0; i < 92; i++) {
    const x = (i * 137.3 + 12) % width;
    const y = (i * 43.7 + 16 + elapsed * (2 + i % 4)) % height;
    world.globalAlpha = .24 + .18 * Math.sin(i + elapsed);
    world.fillStyle = i % 8 ? '#bbdbf0' : '#aaf8d8';
    world.fillRect(x, y, i % 8 ? 1.3 : 2.5, i % 8 ? 1.3 : 2.5);
  }
  world.globalAlpha = 1;
  world.strokeStyle = '#2b6876';
  world.setLineDash([4, 9]);
  world.beginPath();
  world.moveTo(12, shipY + 23);
  world.lineTo(width - 12, shipY + 23);
  world.stroke();
  world.setLineDash([]);
  for (const item of items) drawItem(item);
  drawShip(elapsed);
  for (const signal of signals) {
    world.globalAlpha = Math.max(0, 1 - signal.age / .85);
    world.fillStyle = signal.color;
    world.font = '700 18px sans-serif';
    world.textAlign = 'center';
    world.fillText(signal.text, signal.x, signal.y - signal.age * 38);
  }
  world.globalAlpha = 1;
}

function drawItem(item) {
  const {x, y, kind} = item;
  if (kind === 'meteor') {
    polygon([[x-13,y-4],[x-6,y-14],[x+7,y-12],[x+15,y-3],[x+10,y+11],[x-3,y+13],[x-13,y+7]], '#9a7481');
    polygon([[x-8,y-4],[x-4,y-10],[x+5,y-9],[x+8,y-4],[x+1,y+2]], '#bd9395');
    return;
  }
  world.fillStyle = kind === 'gold' ? '#ffdd74' : '#92eed9';
  world.fillRect(x-13, y-8, 26, 17);
  world.strokeStyle = kind === 'gold' ? '#a86221' : '#236c6f';
  world.lineWidth = 1.5;
  world.beginPath();
  world.moveTo(x-11,y-6);
  world.lineTo(x,y+1);
  world.lineTo(x+11,y-6);
  world.stroke();
}

function drawShip(elapsed) {
  let flame = playing ? 8 + Math.sin(elapsed * 26) * 4 : 5;
  polygon([[shipX-5,shipY+10],[shipX+5,shipY+10],[shipX,shipY+12+flame]], '#f5ba70');
  polygon([[shipX,shipY-19],[shipX+22,shipY+12],[shipX,shipY+6],[shipX-22,shipY+12]], CONFIG.spacecraftColor);
  polygon([[shipX,shipY-11],[shipX+6,shipY+2],[shipX-6,shipY+2]], '#d8f9ff');
}

// 부딪힌 물체의 종류를 확인하고, 점수와 화면에 뜨는 숫자를 바꿔요.
function catchItem(item) {
  const difference = survival ? -1 : item.kind === 'meteor'
    ? -CONFIG.crashPenalty : item.kind === 'gold' ? CONFIG.goldPoints : CONFIG.parcelPoints;
  if (survival) lives = Math.max(0, lives + difference);
  else score = Math.max(0, score + difference);
  scoreLabel.textContent = survival ? lives : score;
  signals.push({
    x: item.x, y: shipY - 9, age: 0,
    text: difference > 0 ? '+' + difference : String(difference),
    color: difference < 0 ? '#ffb4c1' : item.kind === 'gold' ? '#ffdd74' : '#b2ffe7'
  });
}

function finish() {
  playing = false;
  moves.clear();
  start.disabled = false;
  start.textContent = '다시 하기';
  message.textContent = survival
    ? (lives > 0 ? '성공! 시간 끝까지 버텼어요.' : '목숨을 모두 잃었어요. 다시 도전해 보세요.')
    : '배송 완료! ' + score + '점을 받았어요.';
  if (CONFIG.challenge && window.parent !== window) {
    window.parent.postMessage({type: 'swmirae:round', score, challenge: true}, '*');
  }
}

// 매 프레임 우주선과 편지를 움직이고, 0초가 되면 게임을 끝내요.
function frame(now) {
  const elapsed = Math.min(CONFIG.seconds, (now - roundStart) / 1000);
  const dt = Math.min(.05, (now - previousFrame) / 1000);
  previousFrame = now;
  const direction = Number(moves.has('ArrowRight')) - Number(moves.has('ArrowLeft'));
  shipX = Math.max(25, Math.min(width - 25, shipX + direction * dt * 380));
  timer.textContent = Math.ceil(CONFIG.seconds - elapsed);
  spawn(elapsed);
  signals = signals.filter(signal => (signal.age += dt) < .85);
  items = items.filter(item => {
    item.y += item.speed * dt;
    if (Math.abs(item.x - shipX) < 31 && Math.abs(item.y - shipY) < 23) {
      catchItem(item);
      return false;
    }
    return item.y < height + 20;
  });
  draw(elapsed);
  if (elapsed >= CONFIG.seconds || (survival && lives === 0)) finish();
  else requestAnimationFrame(frame);
}

function begin() {
  if (playing) return;
  playing = true;
  items = [];
  signals = [];
  moves.clear();
  shipX = width / 2;
  seed = 91;
  itemNumber = 0;
  nextItemAt = .22;
  score = 0;
  lives = CONFIG.lives || 0;
  scoreLabel.textContent = survival ? lives : score;
  timer.textContent = CONFIG.seconds;
  message.textContent = survival ? '운석을 피하면서 시간이 끝날 때까지 버텨요.' : '편지를 받고 운석은 피해요.';
  start.disabled = true;
  start.textContent = '게임 중';
  roundStart = performance.now();
  previousFrame = roundStart;
  requestAnimationFrame(frame);
}

// 키나 터치를 누르는 동안 이동하고, 떼거나 화면을 벗어나면 멈춰요.
function steering(key) { return key === 'ArrowLeft' || key === 'ArrowRight'; }

document.addEventListener('keydown', event => {
  if (playing && steering(event.key)) {
    event.preventDefault();
    moves.add(event.key);
  }
});
document.addEventListener('keyup', event => moves.delete(event.key));
window.addEventListener('blur', () => moves.clear());
for (const button of document.querySelectorAll('[data-key]')) {
  const key = button.dataset.key;
  button.addEventListener('pointerdown', event => {
    button.setPointerCapture(event.pointerId);
    if (playing) moves.add(key);
  });
  button.addEventListener('lostpointercapture', () => moves.delete(key));
  button.addEventListener('keydown', event => {
    if (playing && (event.key === ' ' || event.key === 'Enter')) {
      event.preventDefault();
      moves.add(key);
    }
  });
  button.addEventListener('keyup', () => moves.delete(key));
  button.addEventListener('blur', () => moves.delete(key));
}
start.addEventListener('click', begin);
draw(0);
</script>
</body>
</html>`;

window.starlightLesson = Object.freeze({prompt: starlightPrompt, html: starlightHtml});
