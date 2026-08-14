import { AudioEngine } from './audio.js';
import { BOSS_GIFTS, BOSSES, ENEMIES, FUSION, META_PERKS, UPGRADES } from './data.js';
import { TAU, chooseUnique, circleHit, clamp, distanceSq, formatTime, normalize, phaseAt, spawnInterval, weightedPick, xpForLevel } from './core.js';

const $ = id => document.getElementById(id);
const canvas = $('world');
const ctx = canvas.getContext('2d', { alpha: false });
const ui = {
  menu: $('menu'), hud: $('hud'), status: $('status'), build: $('buildPanel'), boss: $('bossBar'), choice: $('choice'),
  pause: $('pause'), end: $('end'), archive: $('archive'), settings: $('settings'), touch: $('touch'), flash: $('flash'),
  timer: $('timer'), phase: $('phaseName'), wave: $('wave'), level: $('level'), kills: $('kills'), health: $('healthFill'),
  healthText: $('healthText'), xp: $('xpFill'), dash: $('dashAbility'), pulse: $('pulseAbility'), buildSlots: $('buildSlots'),
  bossName: $('bossName'), bossHealth: $('bossHealthFill'), bossHealthText: $('bossHealthText'), cards: $('cards'),
  choiceTitle: $('choiceTitle'), choiceSubtitle: $('choiceSubtitle'), toast: $('toast'), announcement: $('announcement')
};

const DEFAULT_SAVE = {
  echoes: 0, bestTime: 0, totalKills: 0, perks: { vitality: 0, force: 0, greed: 0 },
  settings: { volume: 65, shake: true, effects: true }
};

function loadSave() {
  try {
    const stored = JSON.parse(localStorage.getItem('crown-of-static-save')) || {};
    return {
      ...DEFAULT_SAVE, ...stored,
      perks: { ...DEFAULT_SAVE.perks, ...stored.perks },
      settings: { ...DEFAULT_SAVE.settings, ...stored.settings }
    };
  } catch { return structuredClone(DEFAULT_SAVE); }
}

let save = loadSave();
const persist = () => localStorage.setItem('crown-of-static-save', JSON.stringify(save));
const audio = new AudioEngine(save.settings.volume / 100);
const keys = new Set();
const touchMove = { x: 0, y: 0 };
let game = null;
let mode = 'menu';
let width = innerWidth;
let height = innerHeight;
let dpr = 1;
let lastFrame = performance.now();
let choiceActions = [];
let toastTimer;

function resize() {
  width = innerWidth;
  height = innerHeight;
  dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function setScreen(next) {
  mode = next;
  [ui.menu, ui.choice, ui.pause, ui.end, ui.archive, ui.settings].forEach(element => element.classList.add('hidden'));
  if (ui[next]) ui[next].classList.remove('hidden');
  const playingUi = game && !['menu', 'end', 'archive', 'settings'].includes(next);
  [ui.hud, ui.status, ui.build].forEach(element => element.classList.toggle('hidden', !playingUi));
  ui.touch.classList.toggle('hidden', !playingUi || !matchMedia('(pointer: coarse)').matches);
}

function createGame() {
  const metaHealth = save.perks.vitality * 5;
  return {
    time: 0, spawnClock: .5, shotClock: .2, thornClock: 2, collapseClock: 9, pendingLevels: 0,
    player: {
      x: 0, y: 0, radius: 14, facing: -Math.PI / 2, hp: 100 + metaHealth, maxHp: 100 + metaHealth,
      speed: 205, damage: 1 + save.perks.force * .04, fireRate: 1, magnet: 105, armor: 0,
      level: 1, xp: 0, nextXp: xpForLevel(1), dashCooldown: 0, dashTime: 0, pulseCooldown: 0,
      invulnerable: 0, speedBoost: 0, lastDamage: -99
    },
    upgrades: { needle: 1, halo: 0, thorns: 0, cadence: 0, stride: 0, magnet: 0, vitality: 0, armor: 0 },
    fused: false, gifts: [], enemies: [], projectiles: [], hostile: [], shards: [], particles: [], effects: [], numbers: [],
    kills: 0, bosses: 0, activeBoss: null, spawnedBosses: new Set(), camera: { x: 0, y: 0, shake: 0 },
    announcedWave: 1, started: performance.now(), endReward: 0
  };
}

function startGame() {
  audio.start();
  audio.click();
  game = createGame();
  setScreen('playing');
  ui.boss.classList.add('hidden');
  updateBuild();
  announce('ЦИКЛ 01', 'ВНЕШНИЙ КРУГ', 'Найди ритм. Всё остальное найдёт тебя.', 2300);
}

function quitToMenu() {
  game = null;
  ui.boss.classList.add('hidden');
  setScreen('menu');
}

function pauseGame() {
  if (mode === 'playing') setScreen('pause');
  else if (mode === 'pause') setScreen('playing');
}

function inputVector() {
  let x = touchMove.x;
  let y = touchMove.y;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
  return normalize(x, y);
}

function triggerDash() {
  if (!game || mode !== 'playing' || game.player.dashCooldown > 0) return;
  const player = game.player;
  const input = inputVector();
  if (input.length > .1) player.facing = Math.atan2(input.y, input.x);
  player.dashTime = .16;
  player.dashCooldown = 2.5;
  player.invulnerable = Math.max(player.invulnerable, .28);
  if (game.upgrades.stride >= 3) player.speedBoost = 1.2;
  if (game.gifts.includes('afterimage')) {
    game.effects.push({ type: 'afterimage', x: player.x, y: player.y, life: .55, maxLife: .55, radius: 18, damage: 75 * player.damage, triggered: false });
  }
  burst(player.x, player.y, '#69e5c4', 14, 1.6);
  game.camera.shake = 5;
  audio.dash();
}

function triggerPulse() {
  if (!game || mode !== 'playing' || game.player.pulseCooldown > 0) return;
  const player = game.player;
  player.pulseCooldown = 8;
  game.effects.push({ type: 'pulse', x: player.x, y: player.y, life: .62, maxLife: .62, radius: 0 });
  for (const enemy of game.enemies) {
    const distance = Math.sqrt(distanceSq(player, enemy));
    if (distance < 245) {
      damageEnemy(enemy, 42 * player.damage * (1 - distance / 500), true);
      const push = normalize(enemy.x - player.x, enemy.y - player.y);
      enemy.knockX += push.x * 210;
      enemy.knockY += push.y * 210;
    }
  }
  game.hostile = game.hostile.filter(shot => distanceSq(shot, player) > 260 ** 2);
  game.camera.shake = 11;
  flash(.14);
  audio.pulse();
}

function selectEnemyType(time) {
  return weightedPick([
    { value: 'husk', weight: 48 },
    { value: 'wisp', weight: 23 + time * .02 },
    { value: 'drone', weight: time > 38 ? 18 : 0 },
    { value: 'charger', weight: time > 82 ? 13 : 0 },
    { value: 'brute', weight: time > 120 ? 7 + time * .012 : 0 }
  ]);
}

function spawnEnemy(type = selectEnemyType(game.time), bossData = null) {
  const angle = Math.random() * TAU;
  const margin = Math.max(width, height) * .62 + 90;
  const data = bossData || ENEMIES[type];
  const scale = bossData ? 1 : 1 + game.time * .0021;
  const enemy = {
    type: bossData ? 'boss' : type, x: game.player.x + Math.cos(angle) * margin, y: game.player.y + Math.sin(angle) * margin,
    radius: data.radius, hp: data.hp * scale, maxHp: data.hp * scale, speed: data.speed * Math.min(1.35, 1 + game.time * .0007),
    damage: data.damage, xp: data.xp || 18, color: data.color, hit: 0, contact: 0, haloHit: 0, slow: 0,
    knockX: 0, knockY: 0, age: 0, attack: 1.4 + Math.random(), charge: 1.8 + Math.random() * 2,
    bossData, phase: 0
  };
  game.enemies.push(enemy);
  return enemy;
}

function spawnBoss(index) {
  const data = BOSSES[index];
  const boss = spawnEnemy('boss', data);
  boss.bossIndex = index;
  game.activeBoss = boss;
  game.spawnedBosses.add(index);
  game.announcedWave = phaseAt(data.at).wave;
  ui.bossName.textContent = data.name;
  ui.boss.classList.remove('hidden');
  announce(data.subtitle, data.name, 'Его силу можно забрать. Если переживёшь встречу.', 3000);
  game.camera.shake = 16;
  flash(.2);
  audio.boss();
}

function nearestEnemy(x, y, ignored = null) {
  let target = null;
  let closest = Infinity;
  for (const enemy of game.enemies) {
    if (enemy === ignored || enemy.dead) continue;
    const distance = (enemy.x - x) ** 2 + (enemy.y - y) ** 2;
    if (distance < closest) { closest = distance; target = enemy; }
  }
  return target;
}

function fireNeedles() {
  const level = game.upgrades.needle;
  const player = game.player;
  const count = level >= 5 ? 3 : level >= 3 ? 2 : 1;
  const used = new Set();
  for (let index = 0; index < count; index++) {
    let target = nearestEnemy(player.x, player.y);
    if (level >= 5) {
      target = game.enemies.filter(enemy => !enemy.dead && !used.has(enemy)).sort((a, b) => distanceSq(a, player) - distanceSq(b, player))[0] || target;
      if (target) used.add(target);
    }
    if (!target) return;
    const base = Math.atan2(target.y - player.y, target.x - player.x);
    const spread = count === 2 ? (index ? .08 : -.08) : 0;
    const angle = base + spread;
    const speed = level >= 2 ? 610 : 540;
    game.projectiles.push({
      x: player.x + Math.cos(angle) * 20, y: player.y + Math.sin(angle) * 20, vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed, radius: game.fused ? 6 : 4, life: 1.25, damage: (20 + level * 6) * player.damage,
      pierce: level >= 2 ? 2 : 1, color: game.fused ? '#efbd63' : '#70edc9', hit: new Set(), chain: game.gifts.includes('chain') || game.fused
    });
  }
  audio.shoot();
}

function fireBossPattern(boss) {
  const count = 10 + boss.bossIndex * 2;
  const rotation = boss.age * .6;
  for (let index = 0; index < count; index++) {
    const angle = rotation + index / count * TAU;
    game.hostile.push({ x: boss.x, y: boss.y, vx: Math.cos(angle) * (145 + boss.bossIndex * 18), vy: Math.sin(angle) * (145 + boss.bossIndex * 18), radius: 6, life: 6, damage: 10 + boss.bossIndex * 3, color: boss.color });
  }
  burst(boss.x, boss.y, boss.color, 18, 1.3);
}

function damageEnemy(enemy, amount, heavy = false) {
  if (enemy.dead) return;
  enemy.hp -= amount;
  enemy.hit = .1;
  game.numbers.push({ x: enemy.x, y: enemy.y - enemy.radius, value: Math.round(amount), life: .55, heavy });
  if (heavy) burst(enemy.x, enemy.y, enemy.color, 5, .8);
  audio.hit();
  if (enemy.hp <= 0) killEnemy(enemy);
}

function killEnemy(enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  game.kills++;
  burst(enemy.x, enemy.y, enemy.color, enemy.type === 'boss' ? 44 : 9, enemy.type === 'boss' ? 2.4 : 1);
  const shardCount = enemy.type === 'boss' ? 14 : Math.min(3, enemy.xp);
  for (let index = 0; index < shardCount; index++) {
    const angle = Math.random() * TAU;
    game.shards.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * Math.random() * 85, vy: Math.sin(angle) * Math.random() * 85, value: enemy.type === 'boss' ? 4 : Math.ceil(enemy.xp / shardCount), radius: enemy.type === 'boss' ? 6 : 4 });
  }
  if (enemy.type === 'boss') {
    game.activeBoss = null;
    game.bosses++;
    ui.boss.classList.add('hidden');
    game.camera.shake = 24;
    flash(.32);
    if (enemy.bossIndex === BOSSES.length - 1) {
      setTimeout(() => endGame(true), 900);
    } else {
      setTimeout(showBossChoice, 650);
    }
  }
}

function hurtPlayer(amount) {
  const player = game.player;
  if (player.invulnerable > 0 || mode !== 'playing') return;
  const reduced = amount * (1 - Math.min(.42, player.armor));
  player.hp -= reduced;
  player.invulnerable = game.upgrades.armor >= 3 ? .9 : .58;
  player.lastDamage = game.time;
  game.camera.shake = 13;
  burst(player.x, player.y, '#f07862', 12, 1.3);
  flash(.08, '#f05d4b');
  audio.hurt();
  if (player.hp <= 0) endGame(false);
}

function updatePlayer(dt) {
  const player = game.player;
  const input = inputVector();
  let speed = player.speed * (1 + game.upgrades.stride * .1);
  if (player.speedBoost > 0) speed *= 1.25;
  if (player.dashTime > 0) speed = 720;
  if (input.length > .1) player.facing = Math.atan2(input.y, input.x);
  const moveX = input.length > .1 ? input.x : player.dashTime > 0 ? Math.cos(player.facing) : 0;
  const moveY = input.length > .1 ? input.y : player.dashTime > 0 ? Math.sin(player.facing) : 0;
  player.x += moveX * speed * dt;
  player.y += moveY * speed * dt;
  if (player.dashTime > 0 && save.settings.effects && Math.random() < .75) {
    game.particles.push({ x: player.x, y: player.y, vx: -moveX * 40, vy: -moveY * 40, life: .25, maxLife: .25, size: 14, color: '#5addba', alpha: .22, shape: 'cloak' });
  }
  player.dashTime -= dt;
  player.dashCooldown -= dt;
  player.pulseCooldown -= dt;
  player.invulnerable -= dt;
  player.speedBoost -= dt;
  if (game.upgrades.vitality >= 3 && game.time - player.lastDamage > 5) player.hp = Math.min(player.maxHp, player.hp + dt * 1.5);

  game.shotClock -= dt;
  if (game.shotClock <= 0 && game.enemies.length) {
    fireNeedles();
    const cadence = 1 + game.upgrades.cadence * .12;
    game.shotClock = Math.max(.16, .66 - game.upgrades.needle * .055) / cadence;
  }

  if (game.upgrades.thorns) {
    game.thornClock -= dt;
    if (game.thornClock <= 0) {
      thornBurst();
      game.thornClock = Math.max(1.55, 3.25 - game.upgrades.thorns * .32) / (1 + game.upgrades.cadence * .08);
    }
  }

  if (game.gifts.includes('gravity')) {
    game.collapseClock -= dt;
    if (game.collapseClock <= 0) {
      gravityCollapse();
      game.collapseClock = 9;
    }
  }
}

function thornBurst() {
  const player = game.player;
  const level = game.upgrades.thorns;
  game.effects.push({ type: 'thorns', x: player.x, y: player.y, life: .48, maxLife: .48, rings: level >= 3 ? 2 : 1 });
  for (const enemy of game.enemies) {
    const distance = Math.sqrt(distanceSq(player, enemy));
    if (distance < 165 + (level >= 3 ? 50 : 0)) damageEnemy(enemy, (24 + level * 13) * player.damage, true);
  }
  audio.pulse();
}

function gravityCollapse() {
  const player = game.player;
  game.effects.push({ type: 'gravity', x: player.x, y: player.y, life: .85, maxLife: .85 });
  for (const enemy of game.enemies) {
    const distance = Math.sqrt(distanceSq(player, enemy));
    if (distance < 460) {
      const direction = normalize(player.x - enemy.x, player.y - enemy.y);
      enemy.knockX += direction.x * 480;
      enemy.knockY += direction.y * 480;
      damageEnemy(enemy, 55 * player.damage, true);
    }
  }
  game.camera.shake = 14;
  audio.pulse();
}

function updateWeapons(dt) {
  if (!game.upgrades.halo) return;
  const count = Math.min(3, game.upgrades.halo);
  const radius = game.upgrades.halo >= 3 ? 82 : 66;
  const speed = 1.85 + game.upgrades.halo * .15;
  for (const enemy of game.enemies) enemy.haloHit -= dt;
  for (let index = 0; index < count; index++) {
    const angle = game.time * speed + index / count * TAU;
    const orb = { x: game.player.x + Math.cos(angle) * radius, y: game.player.y + Math.sin(angle) * radius, radius: 9 };
    for (const enemy of game.enemies) {
      if (enemy.haloHit <= 0 && circleHit(orb, enemy)) {
        damageEnemy(enemy, (18 + game.upgrades.halo * 7) * game.player.damage);
        enemy.haloHit = .22;
        if (game.upgrades.halo >= 5) enemy.slow = .8;
      }
    }
    if (game.fused && Math.random() < dt * 3.6) {
      const target = nearestEnemy(orb.x, orb.y);
      if (target) {
        const direction = normalize(target.x - orb.x, target.y - orb.y);
        game.projectiles.push({ x: orb.x, y: orb.y, vx: direction.x * 690, vy: direction.y * 690, radius: 5, life: 1, damage: 28 * game.player.damage, pierce: 1, color: '#efbd63', hit: new Set(), chain: true });
      }
    }
  }
}

function updateEnemies(dt) {
  const player = game.player;
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    enemy.age += dt;
    enemy.hit -= dt;
    enemy.contact -= dt;
    enemy.slow -= dt;
    enemy.attack -= dt;
    enemy.charge -= dt;
    let direction = normalize(player.x - enemy.x, player.y - enemy.y);
    let speed = enemy.speed * (enemy.slow > 0 ? .55 : 1);

    if (enemy.type === 'charger' && enemy.charge <= 0) {
      enemy.charge = 3.4;
      enemy.chargeTime = .52;
      enemy.chargeDirection = direction;
    }
    if (enemy.chargeTime > 0) {
      enemy.chargeTime -= dt;
      direction = enemy.chargeDirection;
      speed *= 4.2;
    }

    if ((enemy.type === 'drone' || enemy.type === 'boss') && enemy.attack <= 0) {
      if (enemy.type === 'boss') {
        fireBossPattern(enemy);
        enemy.attack = Math.max(.85, 2.4 - enemy.bossIndex * .3 - enemy.phase * .25);
        if (Math.random() < .38) for (let i = 0; i < 2 + enemy.bossIndex; i++) spawnEnemy(enemy.bossIndex > 0 ? 'charger' : 'wisp');
      } else {
        const aim = normalize(player.x - enemy.x, player.y - enemy.y);
        game.hostile.push({ x: enemy.x, y: enemy.y, vx: aim.x * 205, vy: aim.y * 205, radius: 5, life: 4, damage: 9, color: enemy.color });
        enemy.attack = 2.8 + Math.random();
      }
    }

    if (enemy.type === 'boss') {
      const ratio = enemy.hp / enemy.maxHp;
      enemy.phase = ratio < .35 ? 2 : ratio < .68 ? 1 : 0;
      speed *= 1 + enemy.phase * .18;
    }

    enemy.x += (direction.x * speed + enemy.knockX) * dt;
    enemy.y += (direction.y * speed + enemy.knockY) * dt;
    enemy.knockX *= Math.pow(.006, dt);
    enemy.knockY *= Math.pow(.006, dt);

    if (circleHit(enemy, player) && enemy.contact <= 0) {
      hurtPlayer(enemy.damage);
      enemy.contact = .7;
      const away = normalize(enemy.x - player.x, enemy.y - player.y);
      enemy.knockX += away.x * 220;
      enemy.knockY += away.y * 220;
    }
  }
  game.enemies = game.enemies.filter(enemy => !enemy.dead && distanceSq(enemy, player) < 2600 ** 2);
}

function updateProjectiles(dt) {
  for (const shot of game.projectiles) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.life -= dt;
    for (const enemy of game.enemies) {
      if (enemy.dead || shot.hit.has(enemy) || !circleHit(shot, enemy)) continue;
      shot.hit.add(enemy);
      damageEnemy(enemy, shot.damage);
      shot.pierce--;
      if (shot.chain) chainFrom(enemy, shot.damage * .52, shot.color);
      if (shot.pierce <= 0) { shot.life = 0; break; }
    }
  }
  game.projectiles = game.projectiles.filter(shot => shot.life > 0);

  for (const shot of game.hostile) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.life -= dt;
    if (circleHit(shot, game.player)) {
      hurtPlayer(shot.damage);
      shot.life = 0;
    }
  }
  game.hostile = game.hostile.filter(shot => shot.life > 0);
}

function chainFrom(source, damage, color) {
  const target = nearestEnemy(source.x, source.y, source);
  if (!target || distanceSq(source, target) > 165 ** 2) return;
  damageEnemy(target, damage);
  game.effects.push({ type: 'chain', x: source.x, y: source.y, x2: target.x, y2: target.y, life: .13, maxLife: .13, color });
}

function updateShards(dt) {
  const player = game.player;
  const magnet = player.magnet * (1 + game.upgrades.magnet * .45);
  for (const shard of game.shards) {
    shard.vx *= Math.pow(.08, dt);
    shard.vy *= Math.pow(.08, dt);
    const distance = Math.sqrt(distanceSq(shard, player));
    if (distance < magnet) {
      const pull = normalize(player.x - shard.x, player.y - shard.y);
      const force = 220 + (1 - distance / magnet) * 620;
      shard.vx += pull.x * force * dt;
      shard.vy += pull.y * force * dt;
    }
    shard.x += shard.vx * dt;
    shard.y += shard.vy * dt;
    if (distance < player.radius + 10) {
      const doubled = game.upgrades.magnet >= 3 && Math.random() < .18;
      gainXp(shard.value * (doubled ? 2 : 1));
      shard.collected = true;
      audio.pickup();
    }
  }
  game.shards = game.shards.filter(shard => !shard.collected);
}

function gainXp(amount) {
  const player = game.player;
  player.xp += amount;
  while (player.xp >= player.nextXp) {
    player.xp -= player.nextXp;
    player.level++;
    player.nextXp = xpForLevel(player.level);
    game.pendingLevels++;
  }
  if (game.pendingLevels && mode === 'playing') showUpgradeChoice();
}

function updateEffects(dt) {
  for (const effect of game.effects) {
    effect.life -= dt;
    if (effect.type === 'afterimage' && !effect.triggered && effect.life < .1) {
      effect.triggered = true;
      for (const enemy of game.enemies) if (distanceSq(effect, enemy) < 125 ** 2) damageEnemy(enemy, effect.damage, true);
      burst(effect.x, effect.y, '#ff9270', 18, 1.5);
      game.camera.shake = 8;
    }
  }
  game.effects = game.effects.filter(effect => effect.life > 0);
  for (const particle of game.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= Math.pow(.12, dt);
    particle.vy *= Math.pow(.12, dt);
    particle.life -= dt;
  }
  game.particles = game.particles.filter(particle => particle.life > 0);
  for (const number of game.numbers) { number.y -= 32 * dt; number.life -= dt; }
  game.numbers = game.numbers.filter(number => number.life > 0);
}

function burst(x, y, color, count, force = 1) {
  if (!save.settings.effects) count = Math.ceil(count * .35);
  for (let index = 0; index < count; index++) {
    const angle = Math.random() * TAU;
    const speed = (35 + Math.random() * 170) * force;
    game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .25 + Math.random() * .5, maxLife: .75, size: 1 + Math.random() * 4, color, alpha: .9, shape: Math.random() < .2 ? 'line' : 'dot' });
  }
}

function updateGame(dt) {
  game.time += dt;
  const phase = phaseAt(game.time);
  if (phase.wave !== game.announcedWave && !BOSSES.some(boss => Math.abs(boss.at - game.time) < 2)) {
    game.announcedWave = phase.wave;
    announce(`ЦИКЛ ${String(phase.wave).padStart(2, '0')}`, phase.name, 'Архив меняет правила пространства.', 2200);
  }

  for (let index = 0; index < BOSSES.length; index++) {
    if (game.time >= BOSSES[index].at && !game.spawnedBosses.has(index) && !game.activeBoss) spawnBoss(index);
  }

  game.spawnClock -= dt;
  if (game.spawnClock <= 0 && game.enemies.length < 260) {
    const amount = game.time > 240 ? 2 : game.time > 110 && Math.random() < .35 ? 2 : 1;
    for (let index = 0; index < amount; index++) spawnEnemy();
    game.spawnClock = spawnInterval(game.time);
  }

  updatePlayer(dt);
  updateWeapons(dt);
  updateProjectiles(dt);
  updateEnemies(dt);
  updateShards(dt);
  updateEffects(dt);

  game.camera.x += (game.player.x - game.camera.x) * Math.min(1, dt * 6);
  game.camera.y += (game.player.y - game.camera.y) * Math.min(1, dt * 6);
  game.camera.shake *= Math.pow(.02, dt);
  updateHud();
}

function upgradeOptions() {
  const options = Object.entries(UPGRADES)
    .filter(([id, definition]) => game.upgrades[id] < definition.max)
    .map(([id]) => ({ kind: 'upgrade', id }));
  const picked = chooseUnique(options, 3);
  if (!game.fused && game.upgrades.needle >= 3 && game.upgrades.halo >= 3) picked[0] = { kind: 'fusion', id: FUSION.id };
  return picked;
}

function showUpgradeChoice() {
  if (!game || game.pendingLevels <= 0) return;
  game.pendingLevels--;
  audio.level();
  renderChoices(upgradeOptions(), 'РЕЗОНАНС ОБНАРУЖЕН', 'ВЫБЕРИ РЕЛИКВИЮ', 'Один выбор останется с тобой до конца цикла.');
}

function showBossChoice() {
  if (!game || mode === 'end') return;
  const options = Object.keys(BOSS_GIFTS).filter(id => !game.gifts.includes(id)).map(id => ({ kind: 'gift', id }));
  renderChoices(options, 'ЯДРО БОССА ВСКРЫТО', 'ЗАБЕРИ ЕГО ЗАКОН', 'Побеждённая машина больше не нуждается в своей силе.');
}

function renderChoices(options, eyebrow, title, subtitle) {
  setScreen('choice');
  ui.choice.querySelector('.eyebrow').textContent = eyebrow;
  ui.choiceTitle.textContent = title;
  ui.choiceSubtitle.textContent = subtitle;
  ui.cards.replaceChildren();
  choiceActions = [];
  options.forEach((option, index) => {
    const current = option.kind === 'upgrade' ? game.upgrades[option.id] : 0;
    const definition = option.kind === 'fusion' ? FUSION : option.kind === 'gift' ? BOSS_GIFTS[option.id] : UPGRADES[option.id];
    const description = option.kind === 'upgrade' ? definition.descriptions[current] : definition.description;
    const card = document.createElement('button');
    card.className = `card ${option.kind === 'fusion' ? 'fusion' : ''}`;
    card.style.setProperty('--accent', definition.accent);
    card.innerHTML = `<span class="card-index">0${index + 1}</span><div class="card-icon"><span>${definition.icon}</span></div><span class="card-type">${definition.type}</span><h3>${definition.name}</h3><p>${description}</p><footer><span>${option.kind === 'upgrade' ? current ? `УР. ${current} → ${current + 1}` : 'НОВАЯ РЕЛИКВИЯ' : option.kind === 'fusion' ? 'НЕОБРАТИМОЕ СЛИЯНИЕ' : 'СИЛА БОССА'}</span><span>ПРИНЯТЬ ↗</span></footer>`;
    const action = () => chooseOption(option);
    card.addEventListener('click', action);
    choiceActions.push(action);
    ui.cards.append(card);
  });
}

function chooseOption(option) {
  audio.click();
  if (option.kind === 'upgrade') applyUpgrade(option.id);
  if (option.kind === 'fusion') {
    game.fused = true;
    announce('СЛИЯНИЕ ЗАВЕРШЕНО', FUSION.name, 'Две реликвии вспомнили, что когда-то были одной.', 2600);
  }
  if (option.kind === 'gift') {
    game.gifts.push(option.id);
    announce('ЗАКОН ПОГЛОЩЁН', BOSS_GIFTS[option.id].name, 'Теперь машина работает на тебя.', 2500);
  }
  updateBuild();
  setScreen('playing');
  if (game.pendingLevels > 0) setTimeout(showUpgradeChoice, 180);
}

function applyUpgrade(id) {
  game.upgrades[id]++;
  const level = game.upgrades[id];
  const player = game.player;
  if (id === 'vitality') { player.maxHp += 25; player.hp = Math.min(player.maxHp, player.hp + 25); }
  if (id === 'armor') player.armor = level * .08;
  if (id === 'magnet') player.magnet += 8;
}

function updateBuild() {
  if (!game) return;
  const ids = ['needle', 'halo', 'thorns'];
  const slots = ids.filter(id => game.upgrades[id]).map(id => {
    const item = UPGRADES[id];
    return `<div class="build-slot ${game.fused && ['needle', 'halo'].includes(id) ? 'fused' : ''}" title="${item.name}">${item.icon}<b>${game.upgrades[id]}</b></div>`;
  });
  for (const id of game.gifts) slots.push(`<div class="build-slot fused" title="${BOSS_GIFTS[id].name}">${BOSS_GIFTS[id].icon}<b>★</b></div>`);
  ui.buildSlots.innerHTML = slots.join('');
}

function updateHud() {
  const player = game.player;
  const phase = phaseAt(game.time);
  ui.timer.textContent = formatTime(game.time);
  ui.phase.textContent = phase.name;
  ui.wave.textContent = String(phase.wave).padStart(2, '0');
  ui.level.textContent = player.level;
  ui.kills.textContent = game.kills;
  ui.health.style.width = `${clamp(player.hp / player.maxHp * 100, 0, 100)}%`;
  ui.healthText.textContent = `${Math.ceil(Math.max(0, player.hp))} / ${player.maxHp}`;
  ui.xp.style.width = `${player.xp / player.nextXp * 100}%`;
  setCooldown(ui.dash, player.dashCooldown, 2.5);
  setCooldown(ui.pulse, player.pulseCooldown, 8);
  if (game.activeBoss) {
    const ratio = clamp(game.activeBoss.hp / game.activeBoss.maxHp, 0, 1);
    ui.bossHealth.style.width = `${ratio * 100}%`;
    ui.bossHealthText.textContent = `${Math.ceil(ratio * 100)}%`;
  }
}

function setCooldown(element, cooldown, maximum) {
  element.querySelector('i').style.height = `${clamp(cooldown / maximum * 100, 0, 100)}%`;
  element.classList.toggle('ready', cooldown <= 0);
}

function endGame(victory) {
  if (!game || mode === 'end') return;
  const multiplier = 1 + save.perks.greed * .1;
  const reward = Math.floor((game.kills * .12 + game.time * .08 + game.bosses * 12) * multiplier);
  game.endReward = reward;
  save.echoes += reward;
  save.bestTime = Math.max(save.bestTime, game.time);
  save.totalKills += game.kills;
  persist();
  $('endEyebrow').textContent = victory ? 'ПРОТОКОЛ КОРОНЫ НАРУШЕН' : 'ЦИКЛ ЗАВЕРШЁН';
  $('endTitle').textContent = victory ? 'ТЕПЕРЬ КОРОНА ПОМНИТ ТЕБЯ' : 'КОРОНА ОТВЕРГЛА ТЕБЯ';
  $('endText').textContent = victory ? 'Ты добрался до сердца механизма. Это была только первая дверь.' : 'Но Архив сохранил всё, чему ты научился.';
  $('resultTime').textContent = formatTime(game.time);
  $('resultKills').textContent = game.kills;
  $('resultEchoes').textContent = `+${reward}`;
  ui.boss.classList.add('hidden');
  setScreen('end');
  victory ? audio.victory() : audio.hurt();
}

function announce(label, title, text, duration = 2200) {
  ui.announcement.querySelector('small').textContent = label;
  ui.announcement.querySelector('strong').textContent = title;
  ui.announcement.querySelector('p').textContent = text;
  ui.announcement.classList.add('show');
  clearTimeout(ui.announcement.timer);
  ui.announcement.timer = setTimeout(() => ui.announcement.classList.remove('show'), duration);
}

function toast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1800);
}

function flash(opacity, color = '#a7fff0') {
  ui.flash.style.background = color;
  ui.flash.style.opacity = opacity;
  setTimeout(() => { ui.flash.style.opacity = 0; }, 35);
}

function screenPosition(entity) {
  return { x: entity.x - game.camera.x + width / 2, y: entity.y - game.camera.y + height / 2 };
}

function worldHash(x, y) {
  let value = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  value = value ^ value >>> 13;
  return ((Math.imul(value, 1274126177) ^ value >>> 16) >>> 0) / 4294967295;
}

function drawGround(shakeX, shakeY) {
  const phase = phaseAt(game.time);
  const palettes = [
    ['#07100f', '#10231e', '#17342b'], ['#071110', '#123028', '#1a4a3c'],
    ['#0b0d14', '#1d1b2a', '#38305b'], ['#0c0d0b', '#2a2216', '#57401e']
  ];
  const palette = palettes[phase.tint];
  ctx.fillStyle = palette[0];
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(shakeX, shakeY);
  const tile = 118;
  const left = game.camera.x - width / 2;
  const top = game.camera.y - height / 2;
  const startX = Math.floor(left / tile) - 1;
  const startY = Math.floor(top / tile) - 1;
  ctx.lineWidth = 1;
  for (let gx = startX; gx < startX + width / tile + 3; gx++) {
    for (let gy = startY; gy < startY + height / tile + 3; gy++) {
      const hash = worldHash(gx, gy);
      const x = gx * tile - left;
      const y = gy * tile - top;
      ctx.strokeStyle = hash > .55 ? `${palette[2]}55` : `${palette[1]}65`;
      ctx.strokeRect(x + 4, y + 4, tile - 8, tile - 8);
      if (hash > .72) drawGroundRelic(x + tile / 2, y + tile / 2, hash, palette);
      else if (hash < .12) {
        ctx.beginPath();
        ctx.arc(x + tile / 2, y + tile / 2, 13 + hash * 40, 0, TAU);
        ctx.strokeStyle = `${palette[2]}35`;
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawGroundRelic(x, y, hash, palette) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(hash * TAU);
  ctx.strokeStyle = `${palette[2]}88`;
  ctx.fillStyle = `${palette[1]}88`;
  const size = 15 + hash * 23;
  ctx.beginPath();
  for (let index = 0; index < 6; index++) {
    const angle = index / 6 * TAU;
    const px = Math.cos(angle) * size;
    const py = Math.sin(angle) * size;
    index ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-size * .7, 0);
  ctx.lineTo(size * .7, 0);
  ctx.moveTo(0, -size * .7);
  ctx.lineTo(0, size * .7);
  ctx.stroke();
  ctx.restore();
}

function drawShard(shard) {
  const point = screenPosition(shard);
  const glow = 7 + Math.sin(game.time * 7 + shard.x) * 2;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(game.time * 2 + shard.y);
  ctx.shadowColor = '#62e2c1';
  ctx.shadowBlur = glow;
  ctx.fillStyle = '#84f3d3';
  ctx.beginPath();
  ctx.moveTo(0, -shard.radius * 1.5);
  ctx.lineTo(shard.radius, 0);
  ctx.lineTo(0, shard.radius * 1.5);
  ctx.lineTo(-shard.radius, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEnemy(enemy) {
  const point = screenPosition(enemy);
  const pulse = 1 + Math.sin(enemy.age * 4) * .04;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.scale(pulse, pulse);
  ctx.globalAlpha = enemy.hit > 0 ? .62 : 1;
  ctx.shadowColor = enemy.color;
  ctx.shadowBlur = enemy.type === 'boss' ? 25 : 8;

  if (enemy.type === 'wisp') {
    ctx.rotate(enemy.age * 1.4);
    ctx.fillStyle = enemy.color;
    polygon(4, enemy.radius, Math.PI / 4, true);
    ctx.fillStyle = '#e8fff7';
    polygon(4, enemy.radius * .35, Math.PI / 4, true);
  } else if (enemy.type === 'drone') {
    ctx.rotate(enemy.age * .5);
    ctx.fillStyle = '#101c18';
    ctx.strokeStyle = enemy.color;
    ctx.lineWidth = 2;
    polygon(6, enemy.radius, 0, true, true);
    ctx.fillStyle = enemy.color;
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
    for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ctx.fillRect(enemy.radius - 1, -2, 9, 4); }
  } else if (enemy.type === 'brute') {
    ctx.fillStyle = '#1d211c';
    ctx.strokeStyle = enemy.color;
    ctx.lineWidth = 3;
    polygon(7, enemy.radius, enemy.age * .08, true, true);
    ctx.fillStyle = enemy.color;
    ctx.fillRect(-7, -6, 4, 4); ctx.fillRect(3, -6, 4, 4);
  } else if (enemy.type === 'charger') {
    ctx.rotate(Math.atan2(game.player.y - enemy.y, game.player.x - enemy.x) + Math.PI / 2);
    ctx.fillStyle = '#11191c';
    ctx.strokeStyle = enemy.color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -enemy.radius * 1.4); ctx.lineTo(enemy.radius, enemy.radius); ctx.lineTo(0, enemy.radius * .55); ctx.lineTo(-enemy.radius, enemy.radius); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (enemy.chargeTime > 0) { ctx.strokeStyle = '#e9e1b4'; ctx.beginPath(); ctx.moveTo(0, enemy.radius); ctx.lineTo(0, enemy.radius + 50); ctx.stroke(); }
  } else if (enemy.type === 'boss') {
    drawBoss(enemy);
  } else {
    ctx.fillStyle = '#14211c';
    ctx.strokeStyle = enemy.color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -enemy.radius); ctx.quadraticCurveTo(enemy.radius * 1.2, 0, enemy.radius * .75, enemy.radius * 1.3); ctx.lineTo(0, enemy.radius * .9); ctx.lineTo(-enemy.radius * .75, enemy.radius * 1.3); ctx.quadraticCurveTo(-enemy.radius * 1.2, 0, 0, -enemy.radius); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d8eee5';
    ctx.fillRect(-5, -5, 3, 4); ctx.fillRect(2, -5, 3, 4);
  }
  ctx.restore();

  if (enemy.type !== 'boss' && enemy.hp < enemy.maxHp && enemy.radius > 18) {
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(point.x - 20, point.y - enemy.radius - 10, 40, 3);
    ctx.fillStyle = enemy.color; ctx.fillRect(point.x - 20, point.y - enemy.radius - 10, 40 * enemy.hp / enemy.maxHp, 3);
  }
}

function drawBoss(enemy) {
  ctx.rotate(enemy.age * .16);
  ctx.strokeStyle = enemy.color;
  ctx.lineWidth = 2;
  for (let ring = 0; ring < 3; ring++) {
    ctx.save();
    ctx.rotate((ring % 2 ? -1 : 1) * enemy.age * (.18 + ring * .08));
    ctx.setLineDash([12 + ring * 4, 7]);
    ctx.beginPath(); ctx.arc(0, 0, enemy.radius * (.72 + ring * .27), 0, TAU); ctx.stroke();
    ctx.restore();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = '#101713';
  polygon(8, enemy.radius * .72, Math.PI / 8, true);
  ctx.fillStyle = enemy.color;
  polygon(4, enemy.radius * .25, Math.PI / 4, true);
  ctx.fillStyle = '#f3eee0';
  ctx.beginPath(); ctx.arc(0, 0, enemy.radius * .1, 0, TAU); ctx.fill();
}

function polygon(sides, radius, rotation = 0, fill = false, stroke = false) {
  ctx.beginPath();
  for (let index = 0; index < sides; index++) {
    const angle = rotation + index / sides * TAU;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    index ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function drawPlayer() {
  const player = game.player;
  const point = screenPosition(player);
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(player.facing + Math.PI / 2);
  if (player.invulnerable > 0 && Math.floor(player.invulnerable * 18) % 2) ctx.globalAlpha = .42;
  ctx.shadowColor = '#56dfba';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#0b1815';
  ctx.strokeStyle = '#79e8c8';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(13, 15); ctx.lineTo(0, 11); ctx.lineTo(-13, 15); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e5eee8';
  ctx.beginPath(); ctx.ellipse(0, -8, 7, 9, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#122820';
  ctx.fillRect(-5, -11, 3, 3); ctx.fillRect(2, -11, 3, 3);
  ctx.strokeStyle = '#dfad58';
  ctx.beginPath(); ctx.moveTo(7, -2); ctx.lineTo(13, -23); ctx.stroke();
  ctx.restore();
  drawHalo();
}

function drawHalo() {
  const count = Math.min(3, game.upgrades.halo);
  if (!count) return;
  const radius = game.upgrades.halo >= 3 ? 82 : 66;
  const speed = 1.85 + game.upgrades.halo * .15;
  for (let index = 0; index < count; index++) {
    const angle = game.time * speed + index / count * TAU;
    const world = { x: game.player.x + Math.cos(angle) * radius, y: game.player.y + Math.sin(angle) * radius };
    const point = screenPosition(world);
    ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(angle + Math.PI / 4);
    ctx.shadowColor = game.fused ? '#efbd63' : '#d9ae62'; ctx.shadowBlur = 12;
    ctx.fillStyle = game.fused ? '#f0c879' : '#c59c54';
    ctx.fillRect(-7, -7, 14, 14);
    ctx.fillStyle = '#15201c'; ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
  }
}

function drawProjectile(shot, hostile = false) {
  const point = screenPosition(shot);
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(Math.atan2(shot.vy, shot.vx));
  ctx.shadowColor = shot.color;
  ctx.shadowBlur = 12;
  ctx.fillStyle = shot.color;
  if (hostile) { ctx.beginPath(); ctx.arc(0, 0, shot.radius, 0, TAU); ctx.fill(); }
  else ctx.fillRect(-11, -shot.radius / 2, 22, shot.radius);
  ctx.restore();
}

function drawEffect(effect) {
  const point = screenPosition(effect);
  const progress = 1 - effect.life / effect.maxLife;
  ctx.save();
  ctx.translate(point.x, point.y);
  if (effect.type === 'pulse') {
    ctx.strokeStyle = `rgba(100, 236, 201, ${1 - progress})`;
    ctx.lineWidth = 7 * (1 - progress) + 1;
    ctx.beginPath(); ctx.arc(0, 0, progress * 250, 0, TAU); ctx.stroke();
  } else if (effect.type === 'thorns') {
    ctx.strokeStyle = `rgba(181, 138, 255, ${1 - progress})`;
    ctx.lineWidth = 2;
    for (let ring = 0; ring < effect.rings; ring++) {
      const radius = 95 + ring * 60 + progress * 18;
      for (let i = 0; i < 18; i++) {
        const angle = i / 18 * TAU + ring * .14;
        ctx.beginPath(); ctx.moveTo(Math.cos(angle) * (radius - 18), Math.sin(angle) * (radius - 18)); ctx.lineTo(Math.cos(angle) * (radius + 20), Math.sin(angle) * (radius + 20)); ctx.stroke();
      }
    }
  } else if (effect.type === 'gravity') {
    ctx.strokeStyle = `rgba(205, 154, 255, ${1 - progress})`;
    ctx.lineWidth = 2;
    for (let ring = 0; ring < 4; ring++) { ctx.beginPath(); ctx.arc(0, 0, 420 * (1 - progress) + ring * 10, 0, TAU); ctx.stroke(); }
  } else if (effect.type === 'afterimage') {
    ctx.globalAlpha = clamp(effect.life / effect.maxLife, 0, .6);
    ctx.fillStyle = '#ef8468';
    ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(16, 18); ctx.lineTo(0, 10); ctx.lineTo(-16, 18); ctx.closePath(); ctx.fill();
    if (effect.triggered) { ctx.strokeStyle = '#ff9b78'; ctx.beginPath(); ctx.arc(0, 0, progress * 125, 0, TAU); ctx.stroke(); }
  } else if (effect.type === 'chain') {
    const end = screenPosition({ x: effect.x2, y: effect.y2 });
    ctx.strokeStyle = effect.color;
    ctx.globalAlpha = effect.life / effect.maxLife;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo((end.x - point.x) / 2 + Math.random() * 12 - 6, (end.y - point.y) / 2 + Math.random() * 12 - 6); ctx.lineTo(end.x - point.x, end.y - point.y); ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.restore();
}

function drawParticle(particle) {
  const point = screenPosition(particle);
  const alpha = clamp(particle.life / particle.maxLife, 0, 1) * particle.alpha;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = particle.color;
  if (particle.shape === 'line') {
    ctx.strokeStyle = particle.color; ctx.lineWidth = particle.size;
    ctx.beginPath(); ctx.moveTo(point.x, point.y); ctx.lineTo(point.x - particle.vx * .05, point.y - particle.vy * .05); ctx.stroke();
  } else if (particle.shape === 'cloak') {
    ctx.beginPath(); ctx.moveTo(point.x, point.y - particle.size); ctx.lineTo(point.x + particle.size, point.y + particle.size); ctx.lineTo(point.x - particle.size, point.y + particle.size); ctx.closePath(); ctx.fill();
  } else { ctx.beginPath(); ctx.arc(point.x, point.y, particle.size, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
}

function drawNumber(number) {
  const point = screenPosition(number);
  ctx.globalAlpha = clamp(number.life / .3, 0, 1);
  ctx.fillStyle = number.heavy ? '#f1c875' : '#dce9e2';
  ctx.font = `${number.heavy ? 600 : 500} ${number.heavy ? 15 : 11}px "Segoe UI"`;
  ctx.textAlign = 'center';
  ctx.fillText(number.value, point.x, point.y);
  ctx.globalAlpha = 1;
}

function drawVignette() {
  const gradient = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * .25, width / 2, height / 2, Math.max(width, height) * .72);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,5,4,.62)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  if (game.player.hp / game.player.maxHp < .28) {
    ctx.fillStyle = `rgba(130, 20, 16, ${.08 + Math.sin(game.time * 5) * .025})`;
    ctx.fillRect(0, 0, width, height);
  }
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!game) { ctx.fillStyle = '#050a09'; ctx.fillRect(0, 0, width, height); return; }
  const shake = save.settings.shake ? game.camera.shake : 0;
  const shakeX = (Math.random() - .5) * shake;
  const shakeY = (Math.random() - .5) * shake;
  drawGround(shakeX, shakeY);
  ctx.save();
  ctx.translate(shakeX, shakeY);
  game.effects.filter(effect => effect.type !== 'chain').forEach(drawEffect);
  game.shards.forEach(drawShard);
  game.enemies.forEach(drawEnemy);
  game.projectiles.forEach(shot => drawProjectile(shot));
  game.hostile.forEach(shot => drawProjectile(shot, true));
  drawPlayer();
  game.effects.filter(effect => effect.type === 'chain').forEach(drawEffect);
  game.particles.forEach(drawParticle);
  game.numbers.forEach(drawNumber);
  ctx.restore();
  drawVignette();
}

function frame(now) {
  const dt = Math.min(.033, (now - lastFrame) / 1000 || 0);
  lastFrame = now;
  if (game && mode === 'playing') updateGame(dt);
  draw();
  requestAnimationFrame(frame);
}

function renderArchive() {
  $('totalEchoes').textContent = save.echoes;
  $('bestTime').textContent = formatTime(save.bestTime);
  $('totalKills').textContent = save.totalKills;
  const container = $('perks');
  container.replaceChildren();
  Object.entries(META_PERKS).forEach(([id, perk]) => {
    const level = save.perks[id];
    const cost = perk.costs[level];
    const button = document.createElement('button');
    button.className = 'perk';
    button.disabled = level >= perk.max || save.echoes < cost;
    button.innerHTML = `<b>${perk.name}</b><p>${perk.description}</p><span>${level >= perk.max ? 'МАКСИМУМ' : `УР. ${level} → ${level + 1} · ${cost} ЭХО`}</span>`;
    button.addEventListener('click', () => {
      if (level >= perk.max || save.echoes < cost) return;
      save.echoes -= cost;
      save.perks[id]++;
      persist();
      audio.click();
      renderArchive();
    });
    container.append(button);
  });
}

function bindUi() {
  $('start').addEventListener('click', startGame);
  $('archiveButton').addEventListener('click', () => { audio.start(); audio.click(); renderArchive(); setScreen('archive'); });
  $('settingsButton').addEventListener('click', () => { audio.start(); audio.click(); setScreen('settings'); });
  $('pauseButton').addEventListener('click', pauseGame);
  $('resume').addEventListener('click', pauseGame);
  $('restart').addEventListener('click', startGame);
  $('again').addEventListener('click', startGame);
  $('quit').addEventListener('click', quitToMenu);
  $('endMenu').addEventListener('click', quitToMenu);
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => { audio.click(); setScreen('menu'); }));

  const volume = $('volume');
  const shake = $('shake');
  const effects = $('effects');
  volume.value = save.settings.volume;
  shake.checked = save.settings.shake;
  effects.checked = save.settings.effects;
  volume.addEventListener('input', () => { save.settings.volume = Number(volume.value); audio.setVolume(save.settings.volume / 100); persist(); });
  shake.addEventListener('change', () => { save.settings.shake = shake.checked; persist(); });
  effects.addEventListener('change', () => { save.settings.effects = effects.checked; persist(); });

  addEventListener('keydown', event => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'Space') triggerDash();
    if (event.code === 'KeyQ') triggerPulse();
    if (event.code === 'Escape') {
      if (mode === 'playing' || mode === 'pause') pauseGame();
      else if (mode === 'archive' || mode === 'settings') setScreen('menu');
    }
    if (mode === 'choice' && ['Digit1', 'Digit2', 'Digit3'].includes(event.code)) choiceActions[Number(event.code.at(-1)) - 1]?.();
  });
  addEventListener('keyup', event => keys.delete(event.code));
  addEventListener('blur', () => { keys.clear(); if (mode === 'playing') pauseGame(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'playing') pauseGame(); });

  $('touchDash').addEventListener('pointerdown', triggerDash);
  $('touchPulse').addEventListener('pointerdown', triggerPulse);
  const joystick = $('joystick');
  const knob = joystick.querySelector('i');
  const moveJoystick = event => {
    const bounds = joystick.getBoundingClientRect();
    const x = event.clientX - (bounds.left + bounds.width / 2);
    const y = event.clientY - (bounds.top + bounds.height / 2);
    const direction = normalize(x, y);
    const distance = Math.min(36, direction.length);
    touchMove.x = direction.x * Math.min(1, direction.length / 20);
    touchMove.y = direction.y * Math.min(1, direction.length / 20);
    knob.style.transform = `translate(${direction.x * distance}px, ${direction.y * distance}px)`;
  };
  joystick.addEventListener('pointerdown', event => { joystick.setPointerCapture(event.pointerId); moveJoystick(event); });
  joystick.addEventListener('pointermove', event => { if (joystick.hasPointerCapture(event.pointerId)) moveJoystick(event); });
  const resetJoystick = () => { touchMove.x = touchMove.y = 0; knob.style.transform = ''; };
  joystick.addEventListener('pointerup', resetJoystick);
  joystick.addEventListener('pointercancel', resetJoystick);
}

resize();
bindUi();
addEventListener('resize', resize);
requestAnimationFrame(frame);
