import { AudioEngine } from './audio.js';
import { BOSSES, CLASSES, ENEMIES, FUSIONS, META_PERKS, STAGES, UPGRADES } from './data.js';
import { TAU, chooseUnique, circleHit, clamp, distanceSq, formatTime, normalize, spawnInterval, weightedPick, xpForLevel } from './core.js';

const $ = id => document.getElementById(id);
const canvas = $('world');
const ctx = canvas.getContext('2d', { alpha: false });
const ui = {
  menu: $('menu'), campaign: $('campaign'), classSelect: $('classSelect'), book: $('book'), choice: $('choice'),
  pause: $('pause'), end: $('end'), archive: $('archive'), settings: $('settings'), hud: $('hud'), status: $('status'),
  build: $('buildPanel'), boss: $('bossBar'), touch: $('touch'), flash: $('flash'), campaignNodes: $('campaignNodes'),
  campaignLinks: $('campaignLinks'), campaignProgress: $('campaignProgress'), chooseStage: $('chooseStage'),
  stageKicker: $('stageKicker'), stageNumber: $('stageNumber'), stageTitle: $('stageTitle'), stageLore: $('stageLore'),
  stageObjective: $('stageObjective'), stageDuration: $('stageDuration'), stageThreat: $('stageThreat'), classCards: $('classCards'),
  selectedStagePath: $('selectedStagePath'), selectedStageObjective: $('selectedStageObjective'), chosenClassName: $('chosenClassName'),
  chosenClassAbility: $('chosenClassAbility'), bookTabs: $('bookTabs'), bookGrid: $('bookGrid'), bookDetail: $('bookDetail'),
  bookFound: $('bookFound'), bookTotal: $('bookTotal'), bookProgressFill: $('bookProgressFill'), menuBookProgress: $('menuBookProgress'),
  endless: $('endlessButton'), endlessState: $('endlessState'), timer: $('timer'), phase: $('phaseName'), wave: $('wave'),
  level: $('level'), kills: $('kills'), health: $('healthFill'), healthText: $('healthText'), xp: $('xpFill'),
  dash: $('dashAbility'), ability: $('classAbility'), abilityIcon: $('abilityIcon'), abilityName: $('abilityName'),
  hudClassIcon: $('hudClassIcon'), hudPortrait: $('hudPortrait'), missionText: $('missionText'), missionFill: $('missionFill'),
  buildSlots: $('buildSlots'), bossName: $('bossName'), bossHealth: $('bossHealthFill'), bossHealthText: $('bossHealthText'),
  cards: $('cards'), choiceTitle: $('choiceTitle'), choiceSubtitle: $('choiceSubtitle'), toast: $('toast'), announcement: $('announcement')
};

const OBJECTIVES = {
  survive: ['ВЫЖИТЬ ДО ПРОБУЖДЕНИЯ СТРАЖА', 'ВЫЖИВАНИЕ'], seals: ['АКТИВИРОВАТЬ 3 ПЕЧАТИ', 'ПЕЧАТИ'],
  hunt: ['НАЙТИ И ПОБЕДИТЬ 3 ЭЛИТЫ', 'ОХОТА'], defense: ['ЗАЩИТИТЬ ИСКРУ КУЗНИ', 'ОБОРОНА'],
  boss: ['ДОБРАТЬСЯ ДО СЕРДЦА КОРОНЫ', 'ФИНАЛ'], endless: ['ПРОДЕРЖАТЬСЯ КАК МОЖНО ДОЛЬШЕ', 'БЕСКОНЕЧНЫЙ ЦИКЛ']
};
const ABILITIES = {
  swordsman: ['✺', 'КРУГОВОЙ РАЗРЕЗ'], archer: ['⫷', 'СЕМЬ СТРЕЛ'], mage: ['※', 'РАЗЛОМ'], mechanist: ['⌬', 'ПЕРЕГРУЗКА']
};
const ENDLESS_STAGE = {
  id: 'endless', number: 99, title: 'Бесконечный разлом', subtitle: 'ПОСЛЕ КОРОНЫ', lore: 'Корона открыла маршрут, которого не было на карте.',
  objective: 'endless', duration: Infinity, accent: '#e1ae5a', biome: 'void', enemies: Object.keys(ENEMIES), boss: 'archon', endless: true
};
const DEFAULT_SAVE = {
  echoes: 0, bestTime: 0, totalKills: 0, perks: { vitality: 0, force: 0, greed: 0 },
  settings: { volume: 65, shake: true, effects: true }, completedStages: [], selectedClass: 'swordsman',
  codex: { items: [], fusions: [], enemies: [] }, campaignComplete: false
};

function loadSave() {
  try {
    const stored = JSON.parse(localStorage.getItem('crown-of-static-save')) || {};
    return {
      ...DEFAULT_SAVE, ...stored, perks: { ...DEFAULT_SAVE.perks, ...stored.perks },
      settings: { ...DEFAULT_SAVE.settings, ...stored.settings },
      completedStages: Array.isArray(stored.completedStages) ? stored.completedStages : [],
      codex: {
        items: Array.isArray(stored.codex?.items) ? stored.codex.items : [],
        fusions: Array.isArray(stored.codex?.fusions) ? stored.codex.fusions : [],
        enemies: Array.isArray(stored.codex?.enemies) ? stored.codex.enemies : []
      }
    };
  } catch { return structuredClone(DEFAULT_SAVE); }
}

let save = loadSave();
const persist = () => localStorage.setItem('crown-of-static-save', JSON.stringify(save));
const audio = new AudioEngine(save.settings.volume / 100);
const keys = new Set();
const touchMove = { x: 0, y: 0 };
let width = innerWidth;
let height = innerHeight;
let dpr = 1;
let game = null;
let mode = 'menu';
let selectedStage = STAGES[0];
let selectedClass = CLASSES[save.selectedClass] ? save.selectedClass : 'swordsman';
let bookTab = 'weapons';
let bookSelection = null;
let choiceActions = [];
let lastFrame = performance.now();
let toastTimer = 0;

function resize() {
  width = innerWidth; height = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * dpr); canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
}

function setScreen(next) {
  mode = next;
  [ui.menu, ui.campaign, ui.classSelect, ui.book, ui.choice, ui.pause, ui.end, ui.archive, ui.settings].forEach(element => element.classList.add('hidden'));
  if (ui[next]) ui[next].classList.remove('hidden');
  const playingUi = Boolean(game) && ['playing', 'choice', 'pause'].includes(next);
  [ui.hud, ui.status, ui.build].forEach(element => element.classList.toggle('hidden', !playingUi));
  ui.boss.classList.toggle('hidden', !playingUi || !game?.activeBoss);
  ui.touch.classList.toggle('hidden', !playingUi || !matchMedia('(pointer: coarse)').matches);
  if (next === 'campaign') renderCampaign();
  if (next === 'classSelect') renderClassSelect();
  if (next === 'book') renderBook();
}

function isStageUnlocked(stage) {
  if (stage.future) return false;
  if (save.completedStages.includes(stage.id)) return true;
  const all = (stage.requires || []).every(id => save.completedStages.includes(id));
  const any = !stage.requiresAny || stage.requiresAny.some(id => save.completedStages.includes(id));
  return all && any;
}

function renderCampaign() {
  const playable = STAGES.filter(stage => !stage.future);
  ui.campaignProgress.textContent = `${save.completedStages.filter(id => playable.some(stage => stage.id === id)).length} / ${playable.length}`;
  const connections = [];
  for (const stage of STAGES) {
    for (const requirement of [...(stage.requires || []), ...(stage.requiresAny || [])]) connections.push([requirement, stage.id]);
  }
  for (const future of STAGES.filter(stage => stage.future)) connections.push(['crown-heart', future.id]);
  ui.campaignLinks.innerHTML = connections.map(([fromId, toId]) => {
    const from = STAGES.find(stage => stage.id === fromId); const to = STAGES.find(stage => stage.id === toId);
    const complete = save.completedStages.includes(fromId) && (to.future || isStageUnlocked(to));
    return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" class="${complete ? 'complete' : ''}"/>`;
  }).join('');
  ui.campaignNodes.innerHTML = '';
  for (const stage of STAGES) {
    const complete = save.completedStages.includes(stage.id); const unlocked = isStageUnlocked(stage);
    const button = document.createElement('button');
    button.className = `stage-node ${stage.future ? 'future locked' : complete ? 'complete' : unlocked ? 'available' : 'locked'} ${selectedStage?.id === stage.id ? 'selected' : ''}`;
    button.style.left = `${stage.x}%`; button.style.top = `${stage.y}%`; button.disabled = !unlocked;
    button.innerHTML = `<span>${stage.future ? '?' : String(stage.number).padStart(2, '0')}</span><small>${stage.title.toUpperCase()}</small>`;
    if (unlocked) button.addEventListener('click', () => { selectedStage = stage; renderCampaign(); showStage(stage); audio.click(); });
    ui.campaignNodes.append(button);
  }
  if (!selectedStage || !isStageUnlocked(selectedStage)) selectedStage = playable.find(stage => isStageUnlocked(stage) && !save.completedStages.includes(stage.id)) || playable.find(isStageUnlocked);
  if (selectedStage) showStage(selectedStage);
}

function showStage(stage) {
  const unlocked = isStageUnlocked(stage); const complete = save.completedStages.includes(stage.id);
  ui.stageKicker.textContent = `${stage.subtitle}${complete ? ' // ПРОЙДЕНО' : ''}`;
  ui.stageNumber.textContent = String(stage.number).padStart(2, '0'); ui.stageTitle.textContent = stage.title;
  ui.stageLore.textContent = stage.lore; ui.stageObjective.textContent = OBJECTIVES[stage.objective][1];
  ui.stageDuration.textContent = `${Math.floor(stage.duration / 60)}:${String(stage.duration % 60).padStart(2, '0')}`;
  ui.stageThreat.textContent = ['НИЗКАЯ', 'УМЕРЕННАЯ', 'УМЕРЕННАЯ', 'ВЫСОКАЯ', 'ВЫСОКАЯ', 'КРИТИЧЕСКАЯ'][stage.number - 1];
  ui.chooseStage.disabled = !unlocked;
}

function renderClassSelect() {
  const stage = selectedStage || STAGES[0];
  ui.selectedStagePath.textContent = stage.endless ? 'ПОСЛЕ КАМПАНИИ' : `СЕКТОР ${String(stage.number).padStart(2, '0')} // ${stage.title.toUpperCase()}`;
  ui.selectedStageObjective.textContent = OBJECTIVES[stage.objective][1]; ui.classCards.innerHTML = '';
  for (const [id, hero] of Object.entries(CLASSES)) {
    const button = document.createElement('button'); button.className = `class-card ${id === selectedClass ? 'selected' : ''}`;
    button.style.setProperty('--class-accent', hero.accent);
    button.innerHTML = `<img src="${hero.image}" alt="${hero.name}"><span class="class-icon">${hero.icon}</span><div class="class-copy"><small>${hero.title.toUpperCase()}</small><h3>${hero.name}</h3><p>${hero.passive}</p></div>`;
    button.addEventListener('click', () => { selectedClass = id; save.selectedClass = id; save.codex.items = [...new Set([...save.codex.items, hero.primary])]; persist(); renderClassSelect(); audio.click(); });
    ui.classCards.append(button);
  }
  const hero = CLASSES[selectedClass]; ui.chosenClassName.textContent = hero.name; ui.chosenClassAbility.textContent = hero.ability;
}

function codexCounts() {
  const validItems = save.codex.items.filter(id => UPGRADES[id]).length;
  const validFusions = save.codex.fusions.filter(id => FUSIONS[id]).length;
  const validEnemies = save.codex.enemies.filter(id => ENEMIES[id]).length;
  return { found: validItems + validFusions + validEnemies, total: Object.keys(UPGRADES).length + Object.keys(FUSIONS).length + Object.keys(ENEMIES).length };
}

function tabEntries(tab) {
  if (tab === 'weapons' || tab === 'artifacts') return Object.entries(UPGRADES).filter(([, item]) => item.category === tab).map(([id, data]) => ({ id, data, kind: 'items', unlocked: save.codex.items.includes(id) }));
  if (tab === 'fusions') return Object.entries(FUSIONS).map(([id, data]) => ({ id, data, kind: 'fusions', unlocked: save.codex.fusions.includes(id) }));
  return Object.entries(ENEMIES).map(([id, data]) => ({ id, data, kind: 'enemies', unlocked: save.codex.enemies.includes(id) }));
}

function renderBook() {
  const counts = codexCounts(); ui.bookFound.textContent = counts.found; ui.bookTotal.textContent = counts.total;
  ui.bookProgressFill.style.width = `${counts.found / counts.total * 100}%`; ui.menuBookProgress.textContent = `${Math.round(counts.found / counts.total * 100)}%`;
  for (const button of ui.bookTabs.querySelectorAll('button')) {
    const entries = tabEntries(button.dataset.tab); const found = entries.filter(entry => entry.unlocked).length;
    button.classList.toggle('active', button.dataset.tab === bookTab); button.querySelector('b').textContent = `${found}/${entries.length}`;
  }
  const entries = tabEntries(bookTab);
  if (!entries.some(entry => `${entry.kind}:${entry.id}` === bookSelection)) bookSelection = entries.length ? `${entries[0].kind}:${entries[0].id}` : null;
  ui.bookGrid.innerHTML = '';
  for (const entry of entries) {
    const key = `${entry.kind}:${entry.id}`; const showRecipe = entry.kind === 'fusions';
    const button = document.createElement('button');
    button.className = `book-entry ${entry.unlocked ? '' : 'locked'} ${bookSelection === key ? 'selected' : ''}`;
    button.style.setProperty('--entry-accent', entry.data.accent || entry.data.color || '#67e1c1');
    button.innerHTML = `<span class="entry-icon">${entry.unlocked ? entry.data.icon || enemyIcon(entry.id) : '◆'}</span><small>${entry.unlocked ? entry.data.category?.toUpperCase() || entry.data.family || 'ВОССТАНОВЛЕНО' : showRecipe ? 'РЕЦЕПТ ДОСТУПЕН' : 'ЗАПИСЬ УТРАЧЕНА'}</small><strong>${entry.unlocked ? entry.data.name : showRecipe ? 'НЕИЗВЕСТНОЕ СЛИЯНИЕ' : 'НЕИЗВЕСТНЫЙ ОБЪЕКТ'}</strong>`;
    button.addEventListener('click', () => { bookSelection = key; renderBook(); audio.click(); }); ui.bookGrid.append(button);
  }
  renderBookDetail(entries.find(entry => `${entry.kind}:${entry.id}` === bookSelection) || entries[0]);
}

function renderBookDetail(entry) {
  if (!entry) { ui.bookDetail.innerHTML = ''; return; }
  const { id, data, kind, unlocked } = entry; const accent = data.accent || data.color || '#67e1c1';
  let body = '';
  if (kind === 'items' && unlocked) body = `<p>${data.descriptions[0]}</p><div class="detail-levels">${data.descriptions.map((text, index) => `<div><b>${index + 1}</b>${text}</div>`).join('')}</div>`;
  if (kind === 'items' && !unlocked) body = '<p>Эта реликвия ещё не была выбрана во время забега. Её форма и свойства скрыты Архивом.</p><div class="mystery-effect">НАЙДИ ПРЕДМЕТ, ЧТОБЫ ВОССТАНОВИТЬ СТРАНИЦУ</div>';
  if (kind === 'fusions') {
    const parts = data.recipe.map(part => save.codex.items.includes(part) ? UPGRADES[part].name : 'НЕИЗВЕСТНЫЙ ПРЕДМЕТ');
    body = `<p>Рецепт восстановлен. Собери нужные уровни обеих реликвий в одном забеге.</p><div class="recipe"><span>${parts[0]} IV</span><b>+</b><span>${parts[1]} ${data.levels[1] === 4 ? 'IV' : 'III'}</span></div>${unlocked ? `<div class="detail-levels"><div><b>✓</b>${data.description}</div></div>` : '<div class="mystery-effect">ЭФФЕКТ СКРЫТ ДО ПЕРВОГО СЛИЯНИЯ</div>'}`;
  }
  if (kind === 'enemies' && unlocked) body = `<p>${enemyDescription(id)}</p><div class="detail-levels"><div><b>◈</b>Семейство: ${data.family}</div><div><b>↟</b>Опасность растёт в дальних секторах.</div></div>`;
  if (kind === 'enemies' && !unlocked) body = '<p>Архив не встречал это существо. Силуэт будет восстановлен при первой встрече.</p><div class="mystery-effect">ОБНАРУЖЬ СУЩЕСТВО В КАМПАНИИ</div>';
  const name = unlocked ? data.name : kind === 'fusions' ? 'Неизвестное слияние' : 'Закрытая запись';
  ui.bookDetail.className = `book-detail ${unlocked ? '' : 'locked'}`; ui.bookDetail.style.setProperty('--detail-accent', accent);
  ui.bookDetail.innerHTML = `<div class="detail-icon"><span>${unlocked ? data.icon || enemyIcon(id) : '◆'}</span></div><span class="detail-category">${unlocked ? data.category?.toUpperCase() || data.family || 'СЛИЯНИЕ' : 'ДАННЫЕ ОТСУТСТВУЮТ'}</span><h3>${name}</h3>${body}`;
}

function enemyIcon(id) { return ({ husk: '◒', wisp: '✦', drone: '⌬', charger: '♜', brute: '⬢', seer: '◉', hound: '⌁', sentinel: '⬡', scribe: '▤' })[id] || '◇'; }
function enemyDescription(id) {
  return ({
    husk: 'Пустой доспех движется по чужой, давно забытой команде.', wisp: 'Быстрая искра древнего сигнала. Слаба, но редко приходит одна.',
    drone: 'Летающий механизм держит дистанцию и выпускает энергетические иглы.', charger: 'Рыцарь накапливает импульс перед стремительным рывком.',
    brute: 'Тяжёлый каменный страж. Медленный, прочный и крайне опасный вблизи.', seer: 'Астроном видит цель без глаз и атакует с большой дистанции.',
    hound: 'Латунная гончая быстро сокращает расстояние и окружает носителя.', sentinel: 'Кузнечный страж прикрыт толстой бронёй и атакует раскалёнными зарядами.',
    scribe: 'Переписчик превращает утраченные слова Архива в холодные снаряды.'
  })[id] || 'Сведения повреждены.';
}

function unlockCodex(kind, id, notify = true) {
  const list = save.codex[kind]; if (!list || list.includes(id)) return false;
  list.push(id); persist(); if (notify) toast(kind === 'fusions' ? 'СЛИЯНИЕ РАСКРЫТО В КНИГЕ' : 'НОВАЯ СТРАНИЦА В КНИГЕ'); return true;
}

function renderArchive() {
  $('totalEchoes').textContent = save.echoes; $('bestTime').textContent = formatTime(save.bestTime); $('totalKills').textContent = save.totalKills;
  const root = $('perks'); root.innerHTML = '';
  for (const [id, perk] of Object.entries(META_PERKS)) {
    const level = save.perks[id]; const cost = perk.costs[level]; const row = document.createElement('div'); row.className = 'perk';
    row.innerHTML = `<div><h3>${perk.name} <small>${level}/${perk.max}</small></h3><p>${perk.description}</p></div><button ${level >= perk.max || save.echoes < cost ? 'disabled' : ''}>${level >= perk.max ? 'МАКСИМУМ' : `${cost} ЭХО`}</button>`;
    row.querySelector('button').addEventListener('click', () => { if (level >= perk.max || save.echoes < cost) return; save.echoes -= cost; save.perks[id]++; persist(); renderArchive(); audio.click(); }); root.append(row);
  }
}

function createGame() {
  const hero = CLASSES[selectedClass]; const stage = selectedStage || STAGES[0]; const metaHealth = save.perks.vitality * 5;
  const upgrades = Object.fromEntries(Object.keys(UPGRADES).map(id => [id, 0])); upgrades[hero.primary] = 1;
  const seals = [{ x: -520, y: -180, charge: 0 }, { x: 430, y: -310, charge: 0 }, { x: 270, y: 430, charge: 0 }];
  return {
    stage, classId: selectedClass, hero, time: 0, spawnClock: .5, attackClock: .2, thornClock: 2, stormClock: 1.2,
    mineClock: 2.5, frostClock: 3, recoveryClock: 18, pendingLevels: 0, ended: false, upgrades, fusions: new Set(),
    player: {
      x: stage.objective === 'defense' ? 110 : 0, y: 0, radius: 15, facing: 0, hp: hero.hp + metaHealth, maxHp: hero.hp + metaHealth,
      speed: hero.speed, damage: hero.damage * (1 + save.perks.force * .04), fireRate: 1, magnet: 115, armor: (selectedClass === 'swordsman' ? .12 : 0),
      level: 1, xp: 0, nextXp: xpForLevel(1), dashCooldown: 0, dashTime: 0, abilityCooldown: 0, invulnerable: 0,
      speedBoost: 0, lastDamage: -99, attackPose: 0, overdrive: 0, shotCount: 0, step: 0
    },
    enemies: [], projectiles: [], hostile: [], shards: [], particles: [], effects: [], numbers: [], mines: [],
    kills: 0, activeBoss: null, bossSpawned: false, camera: { x: 0, y: 0, shake: 0 }, seals,
    elitesKilled: 0, elitesSpawned: 0, nextElite: 34, core: { x: 0, y: 0, radius: 34, hp: 520 + stage.number * 35, maxHp: 520 + stage.number * 35 },
    nextBossAt: stage.endless ? 180 : 0, storyStep: 0, endReward: 0, victory: false
  };
}

function startGame() {
  audio.start(); audio.click(); unlockCodex('items', CLASSES[selectedClass].primary, false); game = createGame(); setScreen('playing');
  ui.wave.textContent = game.stage.endless ? '∞' : String(game.stage.number).padStart(2, '0');
  ui.phase.textContent = game.stage.title.toUpperCase(); ui.hudClassIcon.textContent = game.hero.icon; ui.hudPortrait.textContent = game.hero.icon;
  ui.abilityIcon.textContent = ABILITIES[game.classId][0]; ui.abilityName.textContent = ABILITIES[game.classId][1]; ui.boss.classList.add('hidden');
  updateBuild(); announce(game.stage.subtitle, game.stage.title, game.stage.lore, 3200);
}

function inputVector() {
  let x = touchMove.x; let y = touchMove.y;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x--; if (keys.has('KeyD') || keys.has('ArrowRight')) x++;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y--; if (keys.has('KeyS') || keys.has('ArrowDown')) y++;
  return normalize(x, y);
}

function triggerDash() {
  if (!game || mode !== 'playing' || game.player.dashCooldown > 0) return;
  const player = game.player; const input = inputVector(); if (input.length > .1) player.facing = Math.atan2(input.y, input.x);
  player.dashTime = .17; player.dashCooldown = 2.45; player.invulnerable = Math.max(player.invulnerable, .3);
  if (game.upgrades.stride >= 3) player.speedBoost = 1.25;
  game.effects.push({ type: 'dash', x: player.x, y: player.y, angle: player.facing, life: .35, maxLife: .35 });
  burst(player.x, player.y, game.hero.accent, 12, 1.5); game.camera.shake = 5; audio.dash();
}

function triggerAbility() {
  if (!game || mode !== 'playing' || game.player.abilityCooldown > 0) return;
  const player = game.player; player.attackPose = .3;
  if (game.classId === 'swordsman') {
    player.abilityCooldown = 7; game.effects.push({ type: 'slash', x: player.x, y: player.y, angle: 0, radius: 235, full: true, life: .44, maxLife: .44, color: game.hero.accent });
    for (const enemy of game.enemies) if (distanceSq(player, enemy) < 235 ** 2) damageEnemy(enemy, 88 * player.damage, true);
    game.hostile = game.hostile.filter(shot => distanceSq(shot, player) > 250 ** 2); game.camera.shake = 10;
  } else if (game.classId === 'archer') {
    player.abilityCooldown = 7.5; const target = nearestEnemy(player.x, player.y); const base = target ? Math.atan2(target.y - player.y, target.x - player.x) : player.facing;
    for (let index = -3; index <= 3; index++) createProjectile(player.x, player.y, base + index * .105, { kind: 'arrow', speed: 780, damage: 58 * player.damage, pierce: 4, color: game.hero.accent, life: 1.8 });
  } else if (game.classId === 'mage') {
    player.abilityCooldown = 9; const target = nearestEnemy(player.x, player.y); const distance = target ? Math.min(420, Math.sqrt(distanceSq(player, target))) : 250;
    const angle = target ? Math.atan2(target.y - player.y, target.x - player.x) : player.facing;
    game.effects.push({ type: 'rift', x: player.x + Math.cos(angle) * distance, y: player.y + Math.sin(angle) * distance, radius: 155, life: 5.2, maxLife: 5.2, pulse: 0, color: game.hero.accent });
  } else {
    player.abilityCooldown = 10; player.overdrive = 6.5;
    game.effects.push({ type: 'overdrive', x: player.x, y: player.y, radius: 160, life: .7, maxLife: .7, color: game.hero.accent });
  }
  flash(.08); audio.pulse();
}

function nearestEnemy(x, y, ignored = new Set()) {
  let target = null; let closest = Infinity;
  for (const enemy of game?.enemies || []) {
    if (enemy.dead || ignored.has(enemy)) continue; const d = (enemy.x - x) ** 2 + (enemy.y - y) ** 2;
    if (d < closest) { closest = d; target = enemy; }
  }
  return target;
}

function stageRank() { return game.stage.endless ? 5 + Math.floor(game.time / 180) : game.stage.number; }

function selectEnemyType() {
  const pool = game.stage.enemies.map((id, index) => ({ value: id, weight: Math.max(7, 45 - index * 10 + game.time * index * .018) }));
  return weightedPick(pool);
}

function spawnEnemy(type = selectEnemyType(), options = {}) {
  const angle = Math.random() * TAU; const margin = Math.max(width, height) * .65 + 100;
  const data = options.boss || ENEMIES[type]; const rank = stageRank(); const timeScale = 1 + game.time * .00125;
  const scale = options.boss ? 1 + Math.max(0, rank - 1) * .08 : (1 + Math.max(0, rank - 1) * .14) * timeScale;
  const anchor = game.stage.objective === 'defense' && Math.random() < .68 ? game.core : game.player;
  const enemy = {
    id: options.bossId || type, type: options.boss ? 'boss' : type, shape: options.boss ? 'boss' : data.shape,
    x: anchor.x + Math.cos(angle) * margin, y: anchor.y + Math.sin(angle) * margin, radius: data.radius,
    hp: data.hp * scale * (options.elite ? 3.3 : 1), maxHp: data.hp * scale * (options.elite ? 3.3 : 1),
    speed: data.speed * Math.min(1.38, 1 + game.time * .00075), damage: data.damage * (1 + Math.max(0, rank - 1) * .055),
    xp: (data.xp || 20) * (options.elite ? 5 : 1), color: data.color, ranged: data.ranged || Boolean(options.boss), charger: data.charger,
    bossData: options.boss || null, elite: Boolean(options.elite), hit: 0, contact: 0, haloHit: 0, slow: 0,
    knockX: 0, knockY: 0, age: 0, attack: .8 + Math.random() * 1.2, charge: 1.7 + Math.random() * 2, spawn: .35, phase: Math.random() * TAU
  };
  game.enemies.push(enemy); if (!options.boss) unlockCodex('enemies', type, false); return enemy;
}

function spawnBoss(bossId = game.stage.boss) {
  if (game.activeBoss) return; const data = BOSSES[bossId]; if (!data) return;
  const boss = spawnEnemy('boss', { boss: data, bossId }); boss.attack = .9; boss.charge = 2.4;
  game.activeBoss = boss; game.bossSpawned = true; ui.bossName.textContent = data.name; ui.boss.classList.remove('hidden');
  announce(data.subtitle, data.name, game.stage.endless ? 'Разлом проверяет, чему ты научился.' : 'Последняя печать сектора пробуждена.', 3200);
  game.camera.shake = 16; flash(.18); audio.boss();
}

function createProjectile(x, y, angle, options = {}) {
  const speed = options.speed || 600;
  game.projectiles.push({
    x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: options.radius || 4, life: options.life || 1.6,
    damage: options.damage || 20, pierce: options.pierce || 0, kind: options.kind || 'needle', color: options.color || game.hero.accent,
    target: options.target || null, chain: options.chain || 0, hits: new Set(), split: options.split || false
  });
}

function autoAttack() {
  const player = game.player; const level = game.upgrades[game.hero.primary]; const target = nearestEnemy(player.x, player.y);
  if (!target) { game.attackClock = .08; return; }
  const angle = Math.atan2(target.y - player.y, target.x - player.x); player.facing = angle; player.attackPose = .2; player.shotCount++;
  const cadence = 1 + game.upgrades.cadence * .12 + (player.overdrive > 0 ? .8 : 0);
  if (game.classId === 'swordsman') {
    const fused = game.fusions.has('bulwark'); const circular = fused || level >= 5 && player.shotCount % 3 === 0; const radius = 145 + level * 9;
    game.attackClock = .72 / cadence; game.effects.push({ type: 'slash', x: player.x, y: player.y, angle, radius, full: circular, life: .25, maxLife: .25, color: game.hero.accent });
    for (const enemy of game.enemies) {
      const d = Math.sqrt(distanceSq(player, enemy)); const diff = Math.atan2(Math.sin(Math.atan2(enemy.y - player.y, enemy.x - player.x) - angle), Math.cos(Math.atan2(enemy.y - player.y, enemy.x - player.x) - angle));
      if (d < radius + enemy.radius && (circular || Math.abs(diff) < .9 + level * .04)) damageEnemy(enemy, (39 + level * 11) * player.damage);
    }
    if (level >= 4) createProjectile(player.x, player.y, angle, { kind: 'wave', speed: 420, damage: 25 * player.damage, pierce: 2, radius: 8, life: .65 });
    if (fused) game.hostile = game.hostile.filter(shot => distanceSq(shot, player) > radius ** 2);
  } else if (game.classId === 'archer') {
    game.attackClock = .57 / cadence; const count = level >= 3 ? 2 : 1;
    for (let index = 0; index < count; index++) createProjectile(player.x, player.y, angle + (index - (count - 1) / 2) * .11, { kind: 'arrow', speed: 700 + level * 25, damage: (28 + level * 7) * player.damage, pierce: level >= 2 ? 1 + Math.floor(level / 4) : 0, color: game.hero.accent });
    if (level >= 5 && player.shotCount % 3 === 0) createProjectile(player.x, player.y, angle, { kind: 'arrow', speed: 620, damage: 42 * player.damage, target, pierce: 1, color: '#f6d28d' });
  } else if (game.classId === 'mage') {
    game.attackClock = .84 / cadence; const count = level >= 4 ? 2 : 1;
    for (let index = 0; index < count; index++) createProjectile(player.x, player.y, angle + (index ? .14 : 0), { kind: 'sphere', speed: 400, damage: (36 + level * 9) * player.damage, target, chain: 1 + Math.floor(level / 2), radius: 7, color: game.hero.accent, life: 3 });
  } else {
    game.attackClock = Math.max(.1, (.33 - level * .025) / cadence); const drones = game.fusions.has('choir') ? 3 : player.overdrive > 0 ? 2 : 1;
    const count = level >= 4 ? 2 : 1;
    for (let drone = 0; drone < drones; drone++) for (let index = 0; index < count; index++) {
      const orbit = player.step * 2 + drone * TAU / drones; const ox = player.x + Math.cos(orbit) * 27; const oy = player.y + Math.sin(orbit) * 27;
      createProjectile(ox, oy, angle + (index ? .055 : -.02), { kind: 'needle', speed: 760, damage: (13 + level * 4) * player.damage * (drone ? .56 : 1), pierce: level >= 2 ? 1 : 0, color: game.hero.accent, life: 1.3 });
    }
  }
  audio.shoot();
}

function updateSharedWeapons(dt) {
  const p = game.player;
  if (game.upgrades.thorns) {
    game.thornClock -= dt;
    if (game.thornClock <= 0) {
      const level = game.upgrades.thorns; const radius = 120 + level * 23; game.thornClock = Math.max(2.1, 4.7 - level * .45);
      game.effects.push({ type: 'thorns', x: p.x, y: p.y, radius, life: .55, maxLife: .55, color: UPGRADES.thorns.accent });
      for (const enemy of game.enemies) if (Math.abs(Math.sqrt(distanceSq(p, enemy)) - radius) < 52) damageEnemy(enemy, (35 + level * 12) * p.damage);
    }
  }
  if (game.upgrades.storm) {
    game.stormClock -= dt;
    if (game.stormClock <= 0) {
      const level = game.upgrades.storm; game.stormClock = Math.max(.75, 2.35 - level * .27); let target = nearestEnemy(p.x, p.y); const hit = new Set();
      for (let jump = 0; target && jump < 1 + Math.floor(level / 2); jump++) {
        hit.add(target); damageEnemy(target, (29 + level * 9) * p.damage); const from = jump ? [...hit].at(-2) : p;
        game.effects.push({ type: 'lightning', x: from.x, y: from.y, x2: target.x, y2: target.y, life: .16, maxLife: .16, color: UPGRADES.storm.accent }); target = nearestEnemy(target.x, target.y, hit);
      }
    }
  }
  if (game.upgrades.mines) {
    game.mineClock -= dt;
    if (game.mineClock <= 0) {
      const level = game.upgrades.mines; game.mineClock = Math.max(1.15, 3.8 - level * .45);
      game.mines.push({ x: p.x, y: p.y, radius: 10, arm: .45, life: 10, level, pulse: 0 });
      const limit = 2 + level * 2; if (game.mines.length > limit) game.mines.shift();
    }
  }
  if (game.upgrades.frost) {
    game.frostClock -= dt;
    if (game.frostClock <= 0) {
      const level = game.upgrades.frost; game.frostClock = Math.max(2.2, 4.2 - level * .35); const radius = 190 + level * 32;
      game.effects.push({ type: 'frost', x: p.x, y: p.y, radius, life: .7, maxLife: .7, color: UPGRADES.frost.accent });
      for (const enemy of game.enemies) if (distanceSq(p, enemy) < radius ** 2) { enemy.slow = 2.4; if (level >= 4) damageEnemy(enemy, 18 * p.damage); }
    }
  }
  if (game.upgrades.recovery) {
    game.recoveryClock -= dt;
    if (game.recoveryClock <= 0) { game.recoveryClock = 18; healPlayer(game.upgrades.recovery === 1 ? 4 : 7); }
  }
}

function damageEnemy(enemy, amount, heavy = false) {
  if (!enemy || enemy.dead) return; const critical = Math.random() < game.upgrades.fortune * .06 + (game.classId === 'archer' && ++game.player.shotCount % 5 === 0 ? 1 : 0);
  const dealt = amount * (critical ? 1.85 : 1); enemy.hp -= dealt; enemy.hit = .1; game.numbers.push({ x: enemy.x, y: enemy.y - enemy.radius, text: Math.round(dealt), life: .55, color: critical ? '#f5c86f' : '#d7eee5', critical });
  if (heavy) { const push = normalize(enemy.x - game.player.x, enemy.y - game.player.y); enemy.knockX += push.x * 160; enemy.knockY += push.y * 160; }
  if (enemy.hp <= 0) killEnemy(enemy); else audio.hit();
}

function killEnemy(enemy) {
  if (enemy.dead) return; enemy.dead = true; burst(enemy.x, enemy.y, enemy.color, enemy.bossData ? 38 : enemy.elite ? 22 : 9, enemy.bossData ? 2.5 : 1.3);
  if (enemy.bossData) {
    game.activeBoss = null; ui.boss.classList.add('hidden');
    if (game.stage.endless) { game.nextBossAt = Math.max(game.nextBossAt, game.time + 105); game.player.hp = Math.min(game.player.maxHp, game.player.hp + game.player.maxHp * .35); announce('СТРАЖ РАССЕЯН', 'РАЗЛОМ ПРОДОЛЖАЕТСЯ', 'Следующая волна уже помнит твою сборку.', 2300); audio.victory(); }
    else finishRun(true);
    return;
  }
  game.kills++; if (enemy.elite) { game.elitesKilled++; if (game.upgrades.recovery >= 3) healPlayer(8); }
  const shardCount = enemy.elite ? 5 : enemy.xp >= 4 ? 2 : 1;
  for (let index = 0; index < shardCount; index++) game.shards.push({ x: enemy.x + (Math.random() - .5) * 18, y: enemy.y + (Math.random() - .5) * 18, radius: 4, value: enemy.xp / shardCount, age: 0, vx: (Math.random() - .5) * 45, vy: (Math.random() - .5) * 45 });
  audio.hit();
}

function damagePlayer(amount) {
  const p = game.player; if (p.invulnerable > 0 || game.ended) return;
  const damage = Math.max(1, amount * (1 - clamp(p.armor, 0, .55))); p.hp -= damage; p.invulnerable = .5; p.lastDamage = game.time;
  game.camera.shake = 8; flash(.1, '#e66b5b'); audio.hurt(); if (p.hp <= 0) finishRun(false, 'Носитель потерян. Но найденные страницы и Эхо сохранены.');
}

function healPlayer(amount) { const p = game.player; const before = p.hp; p.hp = Math.min(p.maxHp, p.hp + amount); if (p.hp > before) game.numbers.push({ x: p.x, y: p.y - 24, text: `+${Math.round(p.hp - before)}`, life: .75, color: '#76e5b8' }); }

function burst(x, y, color, count = 8, force = 1) {
  const total = save.settings.effects ? count : Math.ceil(count / 3);
  for (let index = 0; index < total; index++) { const angle = Math.random() * TAU; const speed = (30 + Math.random() * 130) * force; game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .25 + Math.random() * .55, maxLife: .8, size: 1 + Math.random() * 3, color }); }
}

function update(dt) {
  if (!game || mode !== 'playing' || game.ended) return;
  dt = Math.min(dt, .034); game.time += dt; const p = game.player; const input = inputVector();
  p.dashCooldown = Math.max(0, p.dashCooldown - dt); p.abilityCooldown = Math.max(0, p.abilityCooldown - dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt); p.dashTime = Math.max(0, p.dashTime - dt); p.speedBoost = Math.max(0, p.speedBoost - dt);
  p.attackPose = Math.max(0, p.attackPose - dt); p.overdrive = Math.max(0, p.overdrive - dt); p.step += dt * (input.length ? 8 : 2);
  if (input.length) { p.facing = Math.atan2(input.y, input.x); const multiplier = p.dashTime > 0 ? 4.1 : p.speedBoost > 0 ? 1.32 : 1; p.x += input.x * p.speed * multiplier * dt; p.y += input.y * p.speed * multiplier * dt; }
  updateObjective(dt);
  game.spawnClock -= dt;
  if (game.spawnClock <= 0 && game.enemies.length < 125) {
    const rank = stageRank(); const batch = game.time > 150 && Math.random() < .24 ? 2 : 1;
    for (let index = 0; index < batch; index++) spawnEnemy();
    game.spawnClock = spawnInterval(game.time) * Math.max(.55, 1.08 - rank * .055) * (game.activeBoss ? 1.9 : 1);
  }
  game.attackClock -= dt; if (game.attackClock <= 0) autoAttack(); updateSharedWeapons(dt);
  updateMines(dt); updateEffects(dt); updateProjectiles(dt); updateEnemies(dt); updateHostile(dt); updateShards(dt); updateParticles(dt);
  updateHalo(dt); updateHud();
  game.camera.x += (p.x - game.camera.x) * Math.min(1, dt * 7); game.camera.y += (p.y - game.camera.y) * Math.min(1, dt * 7); game.camera.shake *= Math.pow(.02, dt);
}

function updateObjective(dt) {
  const { stage, player } = game; const lead = { survive: 26, seals: 34, hunt: 32, defense: 38, boss: 55 }[stage.objective] || 30;
  if (stage.objective === 'seals') {
    for (const seal of game.seals) if (seal.charge < 1 && distanceSq(player, seal) < 82 ** 2) {
      seal.charge = Math.min(1, seal.charge + dt / 6); if (seal.charge === 1) { burst(seal.x, seal.y, stage.accent, 22, 1.6); announce('ПЕЧАТЬ ОТВЕЧАЕТ', `${game.seals.filter(item => item.charge >= 1).length} ИЗ 3`, 'Сигнал становится громче.', 1500); }
    }
  }
  if (stage.objective === 'hunt' && game.elitesSpawned < 3 && game.time >= game.nextElite) {
    game.elitesSpawned++; game.nextElite += stage.duration * .22; const elite = spawnEnemy(stage.enemies[(game.elitesSpawned - 1) % stage.enemies.length], { elite: true });
    game.effects.push({ type: 'mark', target: elite, life: 5, maxLife: 5, color: stage.accent }); announce('СИГНАТУРА ОБНАРУЖЕНА', `ЭЛИТА ${game.elitesSpawned} ИЗ 3`, 'Отмеченная цель несёт ключ к стражу.', 1700);
  }
  if (stage.objective === 'defense' && game.core.hp <= 0) { finishRun(false, 'Искра погасла. Открытия сохранены, уровень можно повторить.'); return; }
  if (stage.endless) {
    if (!game.activeBoss && game.time >= game.nextBossAt) { const ids = Object.keys(BOSSES); spawnBoss(ids[Math.floor(game.time / 180 - 1) % ids.length]); game.nextBossAt += 180; }
    return;
  }
  const requirement = stage.objective === 'seals' ? game.seals.every(seal => seal.charge >= 1) : stage.objective === 'hunt' ? game.elitesKilled >= 3 : stage.objective === 'defense' ? game.core.hp > 0 : true;
  if (!game.bossSpawned && requirement && game.time >= stage.duration - lead) spawnBoss(stage.boss);
  if (game.storyStep === 0 && game.time > stage.duration * .48) { game.storyStep = 1; announce('АРХИВ // ФРАГМЕНТ', '«КОРОНА НЕ ПРАВИТ»', 'Она лишь запоминает тех, кто пытался.', 2600); }
}

function updateEnemies(dt) {
  const p = game.player; const coreTarget = game.stage.objective === 'defense' ? game.core : null;
  for (const enemy of game.enemies) {
    if (enemy.dead) continue; enemy.age += dt; enemy.spawn = Math.max(0, enemy.spawn - dt); enemy.hit = Math.max(0, enemy.hit - dt); enemy.contact -= dt; enemy.attack -= dt; enemy.charge -= dt; enemy.haloHit -= dt; enemy.slow = Math.max(0, enemy.slow - dt);
    let target = coreTarget || p; if (coreTarget && distanceSq(enemy, p) < 190 ** 2) target = p;
    const direction = normalize(target.x - enemy.x, target.y - enemy.y); let speed = enemy.speed * (enemy.slow > 0 ? .48 : 1);
    if (enemy.charger && enemy.charge <= 0) { enemy.charge = 3.4; speed *= 4.5; game.effects.push({ type: 'trail', x: enemy.x, y: enemy.y, angle: Math.atan2(direction.y, direction.x), life: .4, maxLife: .4, color: enemy.color }); }
    if (enemy.bossData) speed *= 1 + Math.sin(enemy.age * 2.2) * .12;
    const keepDistance = enemy.ranged && !enemy.bossData ? 250 : 0; const distance = Math.sqrt(distanceSq(enemy, target));
    if (distance > keepDistance + enemy.radius) { enemy.x += direction.x * speed * dt; enemy.y += direction.y * speed * dt; }
    else if (keepDistance) { enemy.x -= direction.y * speed * .35 * dt; enemy.y += direction.x * speed * .35 * dt; }
    enemy.x += enemy.knockX * dt; enemy.y += enemy.knockY * dt; enemy.knockX *= Math.pow(.025, dt); enemy.knockY *= Math.pow(.025, dt);
    if (enemy.ranged && enemy.attack <= 0 && distance < (enemy.bossData ? 540 : 430)) {
      enemy.attack = enemy.bossData ? 1.05 : 2.2 + Math.random() * .8; const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
      const count = enemy.bossData ? 7 : 1;
      for (let index = 0; index < count; index++) {
        const shotAngle = enemy.bossData ? angle + (index - 3) * .15 : angle; const shotSpeed = enemy.bossData ? 245 : 285;
        game.hostile.push({ x: enemy.x, y: enemy.y, vx: Math.cos(shotAngle) * shotSpeed, vy: Math.sin(shotAngle) * shotSpeed, radius: enemy.bossData ? 7 : 5, damage: enemy.damage * .65, life: 4, color: enemy.color, targetCore: target === coreTarget });
      }
    }
    if (circleHit(enemy, p) && enemy.contact <= 0) { enemy.contact = .8; damagePlayer(enemy.damage); const away = normalize(p.x - enemy.x, p.y - enemy.y); p.x += away.x * 18; p.y += away.y * 18; }
    if (coreTarget && target === coreTarget && circleHit(enemy, coreTarget) && enemy.contact <= 0) { enemy.contact = 1; coreTarget.hp -= enemy.damage; game.camera.shake = 5; if (coreTarget.hp <= 0) finishRun(false, 'Искра погасла. Открытия сохранены, уровень можно повторить.'); }
  }
  game.enemies = game.enemies.filter(enemy => !enemy.dead);
}

function updateProjectiles(dt) {
  for (const shot of game.projectiles) {
    shot.life -= dt;
    if (shot.target && !shot.target.dead) {
      const aim = normalize(shot.target.x - shot.x, shot.target.y - shot.y); const speed = Math.hypot(shot.vx, shot.vy); const turn = Math.min(1, dt * (shot.kind === 'sphere' ? 5 : 8));
      shot.vx += (aim.x * speed - shot.vx) * turn; shot.vy += (aim.y * speed - shot.vy) * turn;
    }
    shot.x += shot.vx * dt; shot.y += shot.vy * dt;
    for (const enemy of game.enemies) {
      if (enemy.dead || shot.hits.has(enemy) || !circleHit(shot, enemy)) continue; shot.hits.add(enemy); damageEnemy(enemy, shot.damage);
      if (shot.kind === 'sphere' && shot.chain > 0) {
        shot.chain--; const target = nearestEnemy(shot.x, shot.y, shot.hits); if (target) { game.effects.push({ type: 'lightning', x: enemy.x, y: enemy.y, x2: target.x, y2: target.y, life: .13, maxLife: .13, color: shot.color }); shot.target = target; shot.life = Math.max(shot.life, .7); if (game.fusions.has('oracleStorm')) damageEnemy(target, shot.damage * .35); continue; }
      }
      if (shot.kind === 'arrow' && game.fusions.has('deadeye') && !shot.split) {
        const target = nearestEnemy(enemy.x, enemy.y, shot.hits); if (target) { const a = Math.atan2(target.y - enemy.y, target.x - enemy.x); createProjectile(enemy.x, enemy.y, a - .1, { kind: 'arrow', speed: 620, damage: shot.damage * .55, target, split: true, color: shot.color }); createProjectile(enemy.x, enemy.y, a + .1, { kind: 'arrow', speed: 620, damage: shot.damage * .55, target, split: true, color: shot.color }); }
      }
      if (shot.pierce > 0) shot.pierce--; else { shot.life = 0; break; }
    }
  }
  game.projectiles = game.projectiles.filter(shot => shot.life > 0);
}

function updateHostile(dt) {
  const p = game.player;
  for (const shot of game.hostile) {
    shot.life -= dt; shot.x += shot.vx * dt; shot.y += shot.vy * dt;
    if (circleHit(shot, p)) { shot.life = 0; damagePlayer(shot.damage); }
    else if (game.stage.objective === 'defense' && circleHit(shot, game.core)) { shot.life = 0; game.core.hp -= shot.damage * .7; }
  }
  game.hostile = game.hostile.filter(shot => shot.life > 0);
}

function updateHalo(dt) {
  const level = game.upgrades.halo; if (!level) return; const count = level >= 4 ? 3 : level >= 2 ? 2 : 1; const radius = 68 + level * 7;
  for (const enemy of game.enemies) {
    enemy.haloHit -= dt; if (enemy.haloHit > 0) continue;
    for (let index = 0; index < count; index++) {
      const angle = game.time * (1.7 + level * .06) + index * TAU / count; const orb = { x: game.player.x + Math.cos(angle) * radius, y: game.player.y + Math.sin(angle) * radius, radius: 9 };
      if (circleHit(orb, enemy)) { enemy.haloHit = .45; damageEnemy(enemy, (18 + level * 7) * game.player.damage); if (level >= 5) enemy.slow = 1; if (game.fusions.has('briarCrown') && Math.random() < .24) { game.effects.push({ type: 'thorns', x: orb.x, y: orb.y, radius: 70, life: .38, maxLife: .38, color: UPGRADES.thorns.accent }); for (const other of game.enemies) if (distanceSq(orb, other) < 78 ** 2) damageEnemy(other, 22 * game.player.damage); } break; }
    }
  }
}

function updateMines(dt) {
  for (const mine of game.mines) {
    mine.arm -= dt; mine.life -= dt; mine.pulse += dt;
    if (game.fusions.has('choir') && mine.arm <= 0 && mine.pulse >= .7) {
      mine.pulse = 0; const target = nearestEnemy(mine.x, mine.y); if (target && distanceSq(mine, target) < 380 ** 2) createProjectile(mine.x, mine.y, Math.atan2(target.y - mine.y, target.x - mine.x), { kind: 'needle', speed: 640, damage: 17 * game.player.damage, color: UPGRADES.mines.accent });
    }
    if (mine.arm <= 0) {
      const target = game.enemies.find(enemy => !enemy.dead && distanceSq(mine, enemy) < (48 + mine.level * 10) ** 2);
      if (target) {
        const radius = 78 + mine.level * 17; game.effects.push({ type: 'explosion', x: mine.x, y: mine.y, radius, life: .42, maxLife: .42, color: UPGRADES.mines.accent });
        for (const enemy of game.enemies) if (distanceSq(mine, enemy) < radius ** 2) damageEnemy(enemy, (34 + mine.level * 14) * game.player.damage, true); mine.life = 0;
      }
    }
  }
  game.mines = game.mines.filter(mine => mine.life > 0);
}

function updateEffects(dt) {
  for (const effect of game.effects) {
    effect.life -= dt;
    if (effect.type === 'rift') {
      effect.pulse -= dt;
      for (const enemy of game.enemies) if (!enemy.dead && distanceSq(effect, enemy) < effect.radius ** 2) {
        const pull = normalize(effect.x - enemy.x, effect.y - enemy.y); enemy.x += pull.x * 58 * dt; enemy.y += pull.y * 58 * dt; enemy.slow = .3;
        if (effect.pulse <= 0) damageEnemy(enemy, 21 * game.player.damage);
      }
      if (effect.pulse <= 0) effect.pulse = .55;
    }
  }
  game.effects = game.effects.filter(effect => effect.life > 0 && (!effect.target || !effect.target.dead));
}

function updateShards(dt) {
  const p = game.player;
  for (const shard of game.shards) {
    shard.age += dt; shard.x += shard.vx * dt; shard.y += shard.vy * dt; shard.vx *= Math.pow(.08, dt); shard.vy *= Math.pow(.08, dt);
    const d = Math.sqrt(distanceSq(shard, p)); if (d < p.magnet) { const pull = normalize(p.x - shard.x, p.y - shard.y); const speed = 210 + (p.magnet - d) * 3; shard.x += pull.x * speed * dt; shard.y += pull.y * speed * dt; }
    if (d < p.radius + 9) { shard.dead = true; addXp(shard.value * (game.upgrades.magnet >= 3 && Math.random() < .12 ? 2 : 1)); audio.pickup(); }
  }
  game.shards = game.shards.filter(shard => !shard.dead && shard.age < 22);
}

function updateParticles(dt) {
  for (const particle of game.particles) { particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vx *= Math.pow(.08, dt); particle.vy *= Math.pow(.08, dt); }
  for (const number of game.numbers) { number.life -= dt; number.y -= dt * 32; }
  game.particles = game.particles.filter(particle => particle.life > 0); game.numbers = game.numbers.filter(number => number.life > 0);
}

function addXp(amount) {
  const p = game.player; p.xp += amount;
  while (p.xp >= p.nextXp) { p.xp -= p.nextXp; p.level++; p.nextXp = xpForLevel(p.level); game.pendingLevels++; }
  if (game.pendingLevels > 0 && mode === 'playing') openUpgradeChoice();
}

function fusionReady(id, fusion) {
  if (game.fusions.has(id)) return false; if (fusion.classes && !fusion.classes.includes(game.classId)) return false;
  return fusion.recipe.every((part, index) => game.upgrades[part] >= fusion.levels[index]);
}

function openUpgradeChoice() {
  if (!game || !game.pendingLevels) return; const valid = Object.entries(UPGRADES).filter(([id, item]) => (!item.classes || item.classes.includes(game.classId)) && game.upgrades[id] < item.max).map(([id]) => id);
  const ready = Object.entries(FUSIONS).filter(([id, fusion]) => fusionReady(id, fusion)).map(([id]) => `fusion:${id}`);
  let choices = chooseUnique(valid, Math.max(0, 3 - Math.min(1, ready.length))); if (ready.length) choices.unshift(ready[0]); choices = choices.slice(0, 3);
  if (!choices.length) { game.pendingLevels = 0; return; }
  choiceActions = choices; ui.cards.innerHTML = ''; ui.choiceTitle.textContent = ready.length ? 'СЛИЯНИЕ ДОСТУПНО' : 'ВЫБЕРИ РЕЛИКВИЮ';
  choices.forEach((key, index) => {
    const fusionId = key.startsWith('fusion:') ? key.slice(7) : null; const data = fusionId ? FUSIONS[fusionId] : UPGRADES[key]; const level = fusionId ? 1 : game.upgrades[key] + 1;
    const button = document.createElement('button'); button.className = 'choice-card'; button.style.setProperty('--card-accent', data.accent);
    button.innerHTML = `<div class="choice-icon"><span>${data.icon}</span></div><small>${fusionId ? 'ЗАПРЕТНОЕ СЛИЯНИЕ' : `${data.category === 'artifacts' ? 'АРТЕФАКТ' : 'ОРУЖИЕ'} // УРОВЕНЬ ${level}`}</small><h3>${data.name}</h3><p>${fusionId ? data.recipe.map(part => UPGRADES[part].name).join(' + ') : data.descriptions[level - 1]}</p><div class="level-pips">${Array.from({ length: fusionId ? 1 : data.max }, (_, pip) => `<i class="${pip < level ? 'on' : ''}"></i>`).join('')}</div>`;
    button.addEventListener('click', () => chooseUpgrade(index)); ui.cards.append(button);
  });
  audio.level(); setScreen('choice');
}

function chooseUpgrade(index) {
  const key = choiceActions[index]; if (!key || !game) return;
  if (key.startsWith('fusion:')) { const id = key.slice(7); game.fusions.add(id); unlockCodex('fusions', id); burst(game.player.x, game.player.y, FUSIONS[id].accent, 30, 2); }
  else {
    const item = UPGRADES[key]; game.upgrades[key]++; unlockCodex('items', key); const p = game.player;
    if (key === 'stride') p.speed *= 1.1; if (key === 'magnet') p.magnet += 50;
    if (key === 'vitality') { p.maxHp += 22; p.hp = Math.min(p.maxHp, p.hp + 22); } if (key === 'armor') p.armor += .08;
  }
  game.pendingLevels--; updateBuild(); audio.click();
  if (game.pendingLevels > 0) openUpgradeChoice(); else setScreen('playing');
}

function updateBuild() {
  if (!game) return; ui.buildSlots.innerHTML = '';
  for (const [id, level] of Object.entries(game.upgrades).filter(([, level]) => level > 0)) {
    const item = UPGRADES[id]; const slot = document.createElement('div'); slot.className = 'build-slot'; slot.style.setProperty('--slot-accent', item.accent); slot.title = item.name; slot.innerHTML = `${item.icon}<b>${level}</b>`; ui.buildSlots.append(slot);
  }
  for (const id of game.fusions) { const fusion = FUSIONS[id]; const slot = document.createElement('div'); slot.className = 'build-slot fused'; slot.title = fusion.name; slot.innerHTML = `${fusion.icon}<b>F</b>`; ui.buildSlots.append(slot); }
}

function missionState() {
  const stage = game.stage; const remaining = Math.max(0, stage.duration - game.time);
  if (stage.endless) return { text: `${formatTime(game.time)} // ВОЛНА ${1 + Math.floor(game.time / 60)}`, progress: game.time % 60 / 60 };
  if (game.activeBoss) return { text: `ПОБЕДИТЬ: ${game.activeBoss.bossData.name}`, progress: clamp(game.activeBoss.hp / game.activeBoss.maxHp, 0, 1) };
  if (stage.objective === 'seals') { const complete = game.seals.filter(seal => seal.charge >= 1).length; return { text: `ПЕЧАТИ ${complete}/3 // ${formatTime(remaining)}`, progress: game.seals.reduce((sum, seal) => sum + seal.charge, 0) / 3 }; }
  if (stage.objective === 'hunt') return { text: `ЭЛИТНЫЕ ЦЕЛИ ${game.elitesKilled}/3 // ${formatTime(remaining)}`, progress: game.elitesKilled / 3 };
  if (stage.objective === 'defense') return { text: `ИСКРА ${Math.ceil(game.core.hp / game.core.maxHp * 100)}% // ${formatTime(remaining)}`, progress: clamp(game.core.hp / game.core.maxHp, 0, 1) };
  return { text: `${OBJECTIVES[stage.objective][0]} // ${formatTime(remaining)}`, progress: clamp(game.time / stage.duration, 0, 1) };
}

function updateHud() {
  const p = game.player; const mission = missionState(); ui.timer.textContent = game.stage.endless ? formatTime(game.time) : formatTime(Math.max(0, game.stage.duration - game.time));
  ui.level.textContent = p.level; ui.kills.textContent = game.kills; ui.health.style.width = `${clamp(p.hp / p.maxHp, 0, 1) * 100}%`;
  ui.healthText.textContent = `${Math.ceil(Math.max(0, p.hp))} / ${p.maxHp}`; ui.xp.style.width = `${p.xp / p.nextXp * 100}%`;
  ui.dash.querySelector('i').style.height = `${p.dashCooldown / 2.45 * 100}%`; ui.ability.querySelector('i').style.height = `${p.abilityCooldown / (game.classId === 'mage' ? 9 : game.classId === 'mechanist' ? 10 : 7.5) * 100}%`;
  ui.missionText.textContent = mission.text; ui.missionFill.style.width = `${clamp(mission.progress, 0, 1) * 100}%`;
  if (game.activeBoss) { const ratio = clamp(game.activeBoss.hp / game.activeBoss.maxHp, 0, 1); ui.bossHealth.style.width = `${ratio * 100}%`; ui.bossHealthText.textContent = `${Math.ceil(ratio * 100)}%`; }
}

function finishRun(victory, reason = '') {
  if (!game || game.ended) return; game.ended = true; game.victory = victory; const rank = game.stage.endless ? 5 : game.stage.number;
  const baseReward = Math.floor(game.kills / 4 + rank * (victory ? 8 : 2)); const reward = Math.floor(baseReward * (1 + save.perks.greed * .1)); game.endReward = reward;
  save.echoes += reward; save.totalKills += game.kills; save.bestTime = Math.max(save.bestTime, Math.floor(game.time));
  if (victory && !game.stage.endless && !save.completedStages.includes(game.stage.id)) save.completedStages.push(game.stage.id);
  if (victory && game.stage.id === 'crown-heart') save.campaignComplete = true; persist(); refreshMetaUI();
  $('endEyebrow').textContent = victory ? 'СЕКТОР ОСВОБОЖДЁН' : 'НОСИТЕЛЬ ОТСТУПИЛ';
  $('endTitle').textContent = victory ? game.stage.id === 'crown-heart' ? 'КОРОНА ОТКРЫЛА РАЗЛОМ' : 'МАРШРУТ ВОССТАНОВЛЕН' : 'АРХИВ СОХРАНИЛ ПАМЯТЬ';
  $('endText').textContent = reason || (victory ? game.stage.id === 'crown-heart' ? 'Кампания завершена. Бесконечный режим теперь доступен.' : 'Следующий сектор стал ближе. Все открытия записаны в Книгу.' : 'Повтори уровень: валюта, Книга и постоянные улучшения не потеряны.');
  $('resultTime').textContent = formatTime(game.time); $('resultKills').textContent = game.kills; $('resultEchoes').textContent = `+${reward}`;
  $('nextStage').textContent = victory ? 'ПРОДОЛЖИТЬ КАМПАНИЮ' : 'ВЕРНУТЬСЯ К КАРТЕ'; setScreen('end'); if (victory) audio.victory();
}

function quitToMenu() { game = null; ui.boss.classList.add('hidden'); refreshMetaUI(); setScreen('menu'); }
function pauseGame() { if (mode === 'playing') setScreen('pause'); else if (mode === 'pause') setScreen('playing'); }

function render(now) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#050b09'; ctx.fillRect(0, 0, width, height);
  if (!game) { drawAmbient(now / 1000); return; }
  const shake = save.settings.shake ? game.camera.shake : 0; const sx = (Math.random() - .5) * shake; const sy = (Math.random() - .5) * shake;
  ctx.save(); ctx.translate(width / 2 - game.camera.x + sx, height / 2 - game.camera.y + sy); drawFloor(); drawObjectives();
  for (const mine of game.mines) drawMine(mine); for (const shard of game.shards) drawShard(shard); for (const effect of game.effects) drawEffect(effect);
  const ordered = [...game.enemies].sort((a, b) => a.y - b.y); for (const enemy of ordered) drawEnemy(enemy);
  drawHalo(); drawPlayer(); for (const shot of game.projectiles) drawProjectile(shot, false); for (const shot of game.hostile) drawProjectile(shot, true);
  for (const particle of game.particles) { ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1); ctx.fillStyle = particle.color; ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size); }
  ctx.globalAlpha = 1; ctx.textAlign = 'center'; for (const number of game.numbers) { ctx.globalAlpha = clamp(number.life / .3, 0, 1); ctx.fillStyle = number.color; ctx.font = `${number.critical ? 800 : 600} ${number.critical ? 15 : 11}px Segoe UI`; ctx.fillText(number.text, number.x, number.y); } ctx.globalAlpha = 1; ctx.restore();
  const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * .22, width / 2, height / 2, Math.max(width, height) * .72); vignette.addColorStop(0, 'transparent'); vignette.addColorStop(1, 'rgba(0,0,0,.56)'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
}

function drawAmbient(time) {
  const gradient = ctx.createRadialGradient(width * .62, height * .42, 10, width * .5, height * .5, Math.max(width, height) * .8); gradient.addColorStop(0, '#102b24'); gradient.addColorStop(.45, '#07120f'); gradient.addColorStop(1, '#020504'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  ctx.save(); ctx.translate(width * .72, height * .49); ctx.rotate(time * .018); ctx.strokeStyle = 'rgba(103,225,193,.07)'; ctx.lineWidth = 1;
  for (let ring = 1; ring < 6; ring++) { ctx.beginPath(); ctx.arc(0, 0, 55 * ring, 0, TAU); ctx.stroke(); }
  for (let ray = 0; ray < 12; ray++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(65, 0); ctx.lineTo(300, 0); ctx.stroke(); } ctx.restore();
}

function biomePalette() {
  return ({ ruins: ['#07110f', '#10201a', '#315247'], garden: ['#07120e', '#12251b', '#315e48'], observatory: ['#0a0d16', '#17182a', '#484362'], foundry: ['#130c09', '#27150e', '#68402c'], archive: ['#071018', '#10232c', '#31556a'], crown: ['#100d08', '#241e12', '#665634'], void: ['#080810', '#191527', '#4a3e61'] })[game.stage.biome] || ['#07110f', '#10201a', '#315247'];
}

function drawFloor() {
  const [base, line, accent] = biomePalette(); const camera = game.camera; const marginX = width / 2 + 120; const marginY = height / 2 + 120;
  ctx.fillStyle = base; ctx.fillRect(camera.x - marginX, camera.y - marginY, marginX * 2, marginY * 2);
  const size = 96; const minX = Math.floor((camera.x - marginX) / size) * size; const maxX = camera.x + marginX; const minY = Math.floor((camera.y - marginY) / size) * size; const maxY = camera.y + marginY;
  ctx.strokeStyle = line; ctx.globalAlpha = .28; ctx.lineWidth = 1;
  for (let x = minX; x < maxX; x += size) { ctx.beginPath(); ctx.moveTo(x, minY); ctx.lineTo(x, maxY); ctx.stroke(); }
  for (let y = minY; y < maxY; y += size) { ctx.beginPath(); ctx.moveTo(minX, y); ctx.lineTo(maxX, y); ctx.stroke(); }
  ctx.globalAlpha = .22; ctx.fillStyle = accent;
  for (let x = minX; x < maxX; x += size) for (let y = minY; y < maxY; y += size) {
    const seed = Math.abs(((x / size) * 73856093 ^ (y / size) * 19349663) | 0); if (seed % 7) continue;
    ctx.save(); ctx.translate(x + 26 + seed % 42, y + 22 + seed % 49); ctx.rotate((seed % 8) * Math.PI / 4); ctx.fillRect(-13, -2, 26, 4); ctx.fillRect(-2, -13, 4, 26); ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawObjectives() {
  if (game.stage.objective === 'seals') for (const seal of game.seals) {
    const pulse = 1 + Math.sin(game.time * 3 + seal.x) * .05; ctx.save(); ctx.translate(seal.x, seal.y); ctx.scale(pulse, pulse);
    ctx.strokeStyle = seal.charge >= 1 ? game.stage.accent : 'rgba(143,174,161,.32)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 58, -Math.PI / 2, -Math.PI / 2 + TAU * seal.charge); ctx.stroke();
    ctx.rotate(Math.PI / 4); ctx.strokeRect(-31, -31, 62, 62); ctx.rotate(-Math.PI / 4); ctx.fillStyle = seal.charge >= 1 ? game.stage.accent : '#263a32'; ctx.font = '25px Bahnschrift Condensed'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(seal.charge >= 1 ? '✦' : '◇', 0, 1); ctx.restore();
  }
  if (game.stage.objective === 'defense') {
    const core = game.core; const ratio = clamp(core.hp / core.maxHp, 0, 1); ctx.save(); ctx.translate(core.x, core.y); ctx.rotate(game.time * .22);
    ctx.strokeStyle = `rgba(225,174,90,${.25 + ratio * .5})`; ctx.lineWidth = 2; for (let ring = 0; ring < 3; ring++) { ctx.rotate(ring * .45); ctx.strokeRect(-42 - ring * 9, -42 - ring * 9, 84 + ring * 18, 84 + ring * 18); }
    ctx.rotate(-game.time * .22); const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 48); glow.addColorStop(0, `rgba(255,225,145,${ratio})`); glow.addColorStop(1, 'transparent'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 48, 0, TAU); ctx.fill(); ctx.fillStyle = '#e3b45e'; ctx.font = '27px Bahnschrift Condensed'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✦', 0, 0); ctx.restore();
  }
}

function drawPlayer() {
  const p = game.player; const hero = game.hero; const bob = Math.sin(p.step) * 2; const moving = inputVector().length > .1;
  ctx.save(); ctx.translate(p.x, p.y + bob); ctx.rotate(p.facing + Math.PI / 2); const dashAlpha = p.dashTime > 0 ? .55 : 1; ctx.globalAlpha = dashAlpha;
  const aura = ctx.createRadialGradient(0, 0, 5, 0, 0, 55); aura.addColorStop(0, `${hero.accent}26`); aura.addColorStop(1, 'transparent'); ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(0, 0, 55, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.ellipse(0, 14, 18, 8, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#263c35'; ctx.lineWidth = 5; ctx.lineCap = 'round'; const leg = moving ? Math.sin(p.step) * 4 : 0; ctx.beginPath(); ctx.moveTo(-5, 9); ctx.lineTo(-7 + leg, 20); ctx.moveTo(5, 9); ctx.lineTo(7 - leg, 20); ctx.stroke();
  ctx.fillStyle = '#101c19'; ctx.strokeStyle = hero.accent; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-13, 9); ctx.lineTo(-9, -13); ctx.lineTo(0, -20); ctx.lineTo(10, -12); ctx.lineTo(14, 10); ctx.lineTo(0, 17); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (game.classId === 'mage') { ctx.fillStyle = '#211b34'; ctx.beginPath(); ctx.moveTo(-17, 15); ctx.lineTo(-10, -12); ctx.lineTo(0, -19); ctx.lineTo(12, -10); ctx.lineTo(18, 16); ctx.lineTo(0, 10); ctx.closePath(); ctx.fill(); }
  if (game.classId === 'archer') { ctx.fillStyle = '#2a1c15'; ctx.beginPath(); ctx.moveTo(-15, 12); ctx.lineTo(-10, -12); ctx.lineTo(11, -11); ctx.lineTo(16, 13); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = '#d5c9ab'; ctx.beginPath(); ctx.arc(0, -17, 7, 0, TAU); ctx.fill(); ctx.fillStyle = '#111a17'; ctx.fillRect(-7, -20, 14, 4); ctx.fillStyle = hero.accent; ctx.fillRect(-5, -19, 3, 1); ctx.fillRect(2, -19, 3, 1);
  const attack = p.attackPose > 0 ? .7 : 0;
  if (game.classId === 'swordsman') { ctx.save(); ctx.translate(11, -3); ctx.rotate(-.35 - attack); ctx.strokeStyle = '#e7d9b3'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(2, -28); ctx.stroke(); ctx.strokeStyle = hero.accent; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-5, 1); ctx.lineTo(7, 1); ctx.stroke(); ctx.restore(); }
  if (game.classId === 'archer') { ctx.strokeStyle = hero.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(12, -5, 17, -1.2, 1.2); ctx.stroke(); ctx.strokeStyle = '#c7d8c9'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(18, -21); ctx.lineTo(18 - attack * 11, 11); ctx.stroke(); }
  if (game.classId === 'mage') { ctx.strokeStyle = '#8871b9'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(12, 9); ctx.lineTo(17, -27); ctx.stroke(); ctx.fillStyle = hero.accent; ctx.beginPath(); ctx.arc(17, -29, 5 + Math.sin(game.time * 7), 0, TAU); ctx.fill(); }
  if (game.classId === 'mechanist') { ctx.fillStyle = '#334b43'; ctx.fillRect(8, -12, 8, 23); ctx.strokeStyle = hero.accent; ctx.strokeRect(9, -11, 6, 21); }
  ctx.restore();
  if (game.classId === 'mechanist') drawDrones();
}

function drawDrones() {
  const p = game.player; const count = game.fusions.has('choir') ? 3 : p.overdrive > 0 ? 2 : 1;
  for (let index = 0; index < count; index++) { const angle = p.step * 2 + index * TAU / count; const x = p.x + Math.cos(angle) * 27; const y = p.y + Math.sin(angle) * 27; ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = '#10231e'; ctx.strokeStyle = game.hero.accent; ctx.lineWidth = 1.3; ctx.beginPath(); for (let point = 0; point < 6; point++) { const a = point * TAU / 6; const px = Math.cos(a) * 7; const py = Math.sin(a) * 7; point ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = game.hero.accent; ctx.fillRect(-2, -2, 4, 4); ctx.restore(); }
}

function drawEnemy(enemy) {
  const scale = enemy.spawn > 0 ? 1 - enemy.spawn / .35 : 1; const bob = Math.sin(enemy.age * 5 + enemy.phase) * (enemy.shape === 'wisp' ? 5 : 2);
  ctx.save(); ctx.translate(enemy.x, enemy.y + bob); ctx.scale(scale, scale); if (enemy.elite) { ctx.strokeStyle = `${enemy.color}88`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, enemy.radius + 9 + Math.sin(game.time * 4) * 2, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,0,0,.48)'; ctx.beginPath(); ctx.ellipse(0, enemy.radius * .72, enemy.radius * .95, enemy.radius * .38, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = enemy.hit > 0 ? .72 : 1; if (enemy.bossData) drawBoss(enemy); else drawEnemyShape(enemy); ctx.globalAlpha = 1;
  if (enemy.elite) { ctx.fillStyle = '#edc06e'; ctx.font = 'bold 10px Segoe UI'; ctx.textAlign = 'center'; ctx.fillText('◆', 0, -enemy.radius - 12); }
  if (enemy.elite || enemy.bossData) { ctx.fillStyle = '#17211d'; ctx.fillRect(-enemy.radius, enemy.radius + 8, enemy.radius * 2, 3); ctx.fillStyle = enemy.color; ctx.fillRect(-enemy.radius, enemy.radius + 8, enemy.radius * 2 * clamp(enemy.hp / enemy.maxHp, 0, 1), 3); }
  ctx.restore();
}

function drawEnemyShape(enemy) {
  const r = enemy.radius; const c = enemy.hit > 0 ? '#effff8' : enemy.color; ctx.strokeStyle = c; ctx.fillStyle = '#101916'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  if (enemy.shape === 'wisp') { ctx.fillStyle = `${c}55`; ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 1.2, 0, 0, r); ctx.quadraticCurveTo(-r * 1.2, 0, 0, -r); ctx.fill(); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, -2, 3.5, 0, TAU); ctx.fill(); return; }
  if (enemy.shape === 'drone') { polygon(0, 0, r, 6); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r * 1.5, 0); ctx.lineTo(r * 1.5, 0); ctx.stroke(); ctx.fillStyle = c; ctx.fillRect(-4, -2, 8, 4); return; }
  if (enemy.shape === 'charger') { ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, -r * .2); ctx.lineTo(r * .7, r); ctx.lineTo(-r * .7, r); ctx.lineTo(-r, -.2 * r); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(-r * .45, -r * .25); ctx.lineTo(r * .45, -r * .25); ctx.stroke(); return; }
  if (enemy.shape === 'brute') { ctx.fillRect(-r * .76, -r * .72, r * 1.52, r * 1.55); ctx.strokeRect(-r * .76, -r * .72, r * 1.52, r * 1.55); ctx.fillStyle = c; ctx.fillRect(-r * .5, -r * .4, r, 3); ctx.fillRect(-r * .65, r * .1, r * .25, r * .45); ctx.fillRect(r * .4, r * .1, r * .25, r * .45); return; }
  if (enemy.shape === 'seer') { ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, r); ctx.lineTo(-r, r); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, -r * .12, r * .45, r * .2, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#09110f'; ctx.beginPath(); ctx.arc(0, -r * .12, 3, 0, TAU); ctx.fill(); return; }
  if (enemy.shape === 'hound') { ctx.beginPath(); ctx.moveTo(-r, -r * .35); ctx.lineTo(r * .5, -r * .55); ctx.lineTo(r, r * .15); ctx.lineTo(r * .3, r * .55); ctx.lineTo(-r * .8, r * .4); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r * .5, r * .35); ctx.lineTo(-r * .8, r); ctx.moveTo(r * .35, r * .35); ctx.lineTo(r * .65, r); ctx.stroke(); ctx.fillStyle = c; ctx.fillRect(r * .35, -r * .25, 3, 3); return; }
  if (enemy.shape === 'sentinel') { ctx.save(); ctx.rotate(Math.PI / 4); ctx.fillRect(-r * .7, -r * .7, r * 1.4, r * 1.4); ctx.strokeRect(-r * .7, -r * .7, r * 1.4, r * 1.4); ctx.restore(); ctx.fillStyle = c; ctx.fillRect(-r * .45, -2, r * .9, 4); return; }
  if (enemy.shape === 'scribe') { ctx.beginPath(); ctx.moveTo(-r, -r * .6); ctx.lineTo(0, -r * .25); ctx.lineTo(r, -r * .6); ctx.lineTo(r * .85, r * .75); ctx.lineTo(0, r * .45); ctx.lineTo(-r * .85, r * .75); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(0, -r * .25); ctx.lineTo(0, r * .45); ctx.stroke(); return; }
  ctx.beginPath(); ctx.moveTo(-r * .75, r); ctx.lineTo(-r * .58, -r * .3); ctx.lineTo(-r * .35, -r); ctx.lineTo(r * .35, -r); ctx.lineTo(r * .62, -r * .28); ctx.lineTo(r * .76, r); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = c; ctx.fillRect(-r * .42, -r * .54, r * .84, 3);
}

function drawBoss(enemy) {
  const r = enemy.radius; const c = enemy.hit > 0 ? '#fff4d4' : enemy.color; ctx.save(); ctx.rotate(enemy.age * .12); ctx.strokeStyle = `${c}88`; ctx.lineWidth = 2;
  for (let ring = 0; ring < 3; ring++) { ctx.rotate((ring ? -1 : 1) * enemy.age * .04); ctx.beginPath(); const points = 8 + ring * 2; for (let point = 0; point < points; point++) { const angle = point * TAU / points; const distance = r + 9 + ring * 8 + Math.sin(enemy.age * 2 + point) * 3; point ? ctx.lineTo(Math.cos(angle) * distance, Math.sin(angle) * distance) : ctx.moveTo(Math.cos(angle) * distance, Math.sin(angle) * distance); } ctx.closePath(); ctx.stroke(); }
  ctx.restore(); ctx.fillStyle = '#111713'; ctx.strokeStyle = c; ctx.lineWidth = 3; polygon(0, 0, r * .72, 8); ctx.fill(); ctx.stroke(); const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, r * .7); glow.addColorStop(0, c); glow.addColorStop(.25, `${c}99`); glow.addColorStop(1, 'transparent'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, r * .7, 0, TAU); ctx.fill(); ctx.fillStyle = '#07100d'; ctx.beginPath(); ctx.arc(0, 0, r * .18, 0, TAU); ctx.fill();
}

function polygon(x, y, radius, sides) { ctx.beginPath(); for (let index = 0; index < sides; index++) { const angle = -Math.PI / 2 + index * TAU / sides; const px = x + Math.cos(angle) * radius; const py = y + Math.sin(angle) * radius; index ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); }

function drawProjectile(shot, hostile) {
  ctx.save(); ctx.translate(shot.x, shot.y); ctx.rotate(Math.atan2(shot.vy, shot.vx)); ctx.shadowBlur = hostile ? 11 : 7; ctx.shadowColor = shot.color; ctx.fillStyle = shot.color;
  if (shot.kind === 'arrow') { ctx.fillRect(-9, -1, 18, 2); ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(4, -4); ctx.lineTo(4, 4); ctx.closePath(); ctx.fill(); }
  else if (shot.kind === 'sphere') { ctx.beginPath(); ctx.arc(0, 0, shot.radius, 0, TAU); ctx.fill(); ctx.strokeStyle = '#efe7ff'; ctx.beginPath(); ctx.arc(0, 0, shot.radius + 4, game.time * 5, game.time * 5 + Math.PI); ctx.stroke(); }
  else if (shot.kind === 'wave') { ctx.globalAlpha = .7; ctx.fillRect(-13, -shot.radius, 26, shot.radius * 2); }
  else { ctx.fillRect(-7, -shot.radius / 2, 14, shot.radius); }
  if (hostile) { ctx.beginPath(); ctx.arc(0, 0, shot.radius, 0, TAU); ctx.fill(); } ctx.restore();
}

function drawHalo() {
  const level = game.upgrades.halo; if (!level) return; const count = level >= 4 ? 3 : level >= 2 ? 2 : 1; const radius = 68 + level * 7;
  ctx.strokeStyle = 'rgba(225,174,90,.13)'; ctx.beginPath(); ctx.arc(game.player.x, game.player.y, radius, 0, TAU); ctx.stroke();
  for (let index = 0; index < count; index++) { const angle = game.time * (1.7 + level * .06) + index * TAU / count; const x = game.player.x + Math.cos(angle) * radius; const y = game.player.y + Math.sin(angle) * radius; ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = UPGRADES.halo.accent; ctx.shadowBlur = 14; ctx.shadowColor = UPGRADES.halo.accent; polygon(0, 0, 8, 4); ctx.fill(); ctx.restore(); }
}

function drawMine(mine) { ctx.save(); ctx.translate(mine.x, mine.y); ctx.rotate(game.time * .8); ctx.strokeStyle = mine.arm <= 0 ? UPGRADES.mines.accent : '#60554f'; ctx.fillStyle = '#151512'; ctx.lineWidth = 2; polygon(0, 0, 11, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = mine.arm <= 0 ? UPGRADES.mines.accent : '#4b4b46'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill(); ctx.restore(); }
function drawShard(shard) { const pulse = 1 + Math.sin(shard.age * 7) * .17; ctx.save(); ctx.translate(shard.x, shard.y); ctx.rotate(shard.age * 2); ctx.scale(pulse, pulse); ctx.fillStyle = '#67e1c1'; ctx.shadowBlur = 10; ctx.shadowColor = '#67e1c1'; polygon(0, 0, 4, 4); ctx.fill(); ctx.restore(); }

function drawEffect(effect) {
  const t = clamp(effect.life / effect.maxLife, 0, 1); ctx.save(); ctx.globalAlpha = Math.min(1, t * 2); ctx.strokeStyle = effect.color || '#67e1c1'; ctx.fillStyle = effect.color || '#67e1c1';
  if (effect.type === 'slash') { const progress = 1 - t; ctx.lineWidth = 3 + t * 4; ctx.beginPath(); if (effect.full) ctx.arc(effect.x, effect.y, effect.radius * (.8 + progress * .2), effect.angle, effect.angle + TAU * progress); else ctx.arc(effect.x, effect.y, effect.radius, effect.angle - 1.05, effect.angle - 1.05 + 2.1 * Math.min(1, progress * 2)); ctx.stroke(); }
  else if (effect.type === 'lightning') { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(effect.x, effect.y); const segments = 6; for (let i = 1; i < segments; i++) { const p = i / segments; ctx.lineTo(effect.x + (effect.x2 - effect.x) * p + (Math.random() - .5) * 12, effect.y + (effect.y2 - effect.y) * p + (Math.random() - .5) * 12); } ctx.lineTo(effect.x2, effect.y2); ctx.stroke(); }
  else if (effect.type === 'rift') { ctx.translate(effect.x, effect.y); ctx.rotate(game.time * .6); ctx.lineWidth = 2; for (let ring = 0; ring < 3; ring++) { ctx.beginPath(); ctx.ellipse(0, 0, effect.radius * (1 - ring * .18), effect.radius * (.35 + ring * .06), ring * .7, 0, TAU); ctx.stroke(); } }
  else if (effect.type === 'thorns') { ctx.translate(effect.x, effect.y); ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 24; i++) { const angle = i * TAU / 24; const outer = i % 2 ? effect.radius : effect.radius * .76; const x = Math.cos(angle) * outer; const y = Math.sin(angle) * outer; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.stroke(); }
  else if (effect.type === 'frost' || effect.type === 'explosion' || effect.type === 'overdrive') { const progress = 1 - t; ctx.lineWidth = 3 * t; ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius * progress, 0, TAU); ctx.stroke(); if (effect.type === 'explosion') { ctx.globalAlpha *= .11; ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius * progress, 0, TAU); ctx.fill(); } }
  else if (effect.type === 'mark' && effect.target) { ctx.translate(effect.target.x, effect.target.y - effect.target.radius - 22); ctx.rotate(Math.PI / 4); ctx.strokeRect(-7, -7, 14, 14); }
  else { ctx.translate(effect.x, effect.y); ctx.rotate(effect.angle || 0); ctx.globalAlpha *= .35; ctx.fillRect(-45 * (1 - t), -5, 90 * (1 - t), 10); }
  ctx.restore();
}

function toast(message) {
  ui.toast.textContent = message; ui.toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1800);
}

function announce(kicker, title, text, duration = 2300) {
  const token = String(performance.now()); ui.announcement.dataset.token = token; ui.announcement.querySelector('small').textContent = kicker;
  ui.announcement.querySelector('strong').textContent = title; ui.announcement.querySelector('p').textContent = text; ui.announcement.classList.add('show');
  setTimeout(() => { if (ui.announcement.dataset.token === token) ui.announcement.classList.remove('show'); }, duration);
}

function flash(opacity = .12, color = '#b4fff1') { ui.flash.style.background = color; ui.flash.style.opacity = opacity; setTimeout(() => { ui.flash.style.opacity = 0; }, 45); }

function refreshMetaUI() {
  const counts = codexCounts(); ui.menuBookProgress.textContent = `${Math.round(counts.found / counts.total * 100)}%`;
  ui.endless.classList.toggle('locked', !save.campaignComplete); ui.endlessState.textContent = save.campaignComplete ? 'ОТКРЫТ' : 'ЗАВЕРШИ КАМПАНИЮ';
  $('volume').value = save.settings.volume; $('shake').checked = save.settings.shake; $('effects').checked = save.settings.effects;
}

$('campaignButton').addEventListener('click', () => { selectedStage = STAGES.find(stage => isStageUnlocked(stage) && !save.completedStages.includes(stage.id)) || STAGES.find(isStageUnlocked); audio.start(); audio.click(); setScreen('campaign'); });
ui.chooseStage.addEventListener('click', () => { if (!selectedStage || !isStageUnlocked(selectedStage)) return; audio.click(); setScreen('classSelect'); });
$('startStage').addEventListener('click', startGame);
ui.endless.addEventListener('click', () => { audio.start(); if (!save.campaignComplete) { toast('РЕЖИМ ОТКРОЕТСЯ ПОСЛЕ КАМПАНИИ'); return; } selectedStage = ENDLESS_STAGE; audio.click(); setScreen('classSelect'); });
$('bookButton').addEventListener('click', () => { audio.start(); audio.click(); setScreen('book'); });
$('archiveButton').addEventListener('click', () => { audio.start(); audio.click(); renderArchive(); setScreen('archive'); });
$('settingsButton').addEventListener('click', () => { audio.start(); audio.click(); setScreen('settings'); });
for (const button of document.querySelectorAll('[data-back]')) button.addEventListener('click', () => { audio.click(); setScreen(button.dataset.back); });
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => { audio.click(); setScreen('menu'); });
ui.bookTabs.addEventListener('click', event => { const button = event.target.closest('button[data-tab]'); if (!button) return; bookTab = button.dataset.tab; bookSelection = null; audio.click(); renderBook(); });

$('pauseButton').addEventListener('click', pauseGame); $('resume').addEventListener('click', pauseGame);
$('restart').addEventListener('click', startGame); $('quit').addEventListener('click', () => { game = null; ui.boss.classList.add('hidden'); setScreen('campaign'); });
$('again').addEventListener('click', startGame); $('nextStage').addEventListener('click', () => { game = null; ui.boss.classList.add('hidden'); setScreen('campaign'); });
$('endMenu').addEventListener('click', quitToMenu);

$('volume').addEventListener('input', event => { save.settings.volume = Number(event.target.value); audio.setVolume(save.settings.volume / 100); persist(); });
$('shake').addEventListener('change', event => { save.settings.shake = event.target.checked; persist(); });
$('effects').addEventListener('change', event => { save.settings.effects = event.target.checked; persist(); });

addEventListener('keydown', event => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault(); keys.add(event.code);
  if (event.code === 'Space') triggerDash(); if (event.code === 'KeyQ') triggerAbility();
  if (event.code === 'Escape') { if (mode === 'playing' || mode === 'pause') pauseGame(); else if (['campaign', 'classSelect', 'book', 'archive', 'settings'].includes(mode)) setScreen(mode === 'classSelect' ? 'campaign' : 'menu'); }
  if (mode === 'choice' && /^Digit[1-3]$/.test(event.code)) chooseUpgrade(Number(event.code.at(-1)) - 1);
});
addEventListener('keyup', event => keys.delete(event.code)); addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'playing') pauseGame(); });

const joystick = $('joystick'); const stick = joystick.querySelector('i'); let joystickPointer = null;
function moveJoystick(event) {
  const rect = joystick.getBoundingClientRect(); const x = event.clientX - (rect.left + rect.width / 2); const y = event.clientY - (rect.top + rect.height / 2); const vector = normalize(x, y); const length = Math.min(34, vector.length);
  touchMove.x = vector.x; touchMove.y = vector.y; stick.style.transform = `translate(${vector.x * length}px,${vector.y * length}px)`;
}
joystick.addEventListener('pointerdown', event => { joystickPointer = event.pointerId; joystick.setPointerCapture(event.pointerId); moveJoystick(event); });
joystick.addEventListener('pointermove', event => { if (event.pointerId === joystickPointer) moveJoystick(event); });
function resetJoystick(event) { if (joystickPointer !== null && (!event || event.pointerId === joystickPointer)) { joystickPointer = null; touchMove.x = 0; touchMove.y = 0; stick.style.transform = ''; } }
joystick.addEventListener('pointerup', resetJoystick); joystick.addEventListener('pointercancel', resetJoystick);
$('touchDash').addEventListener('pointerdown', event => { event.preventDefault(); triggerDash(); }); $('touchAbility').addEventListener('pointerdown', event => { event.preventDefault(); triggerAbility(); });

function frame(now) { const dt = (now - lastFrame) / 1000; lastFrame = now; update(dt); render(now); requestAnimationFrame(frame); }

resize(); refreshMetaUI(); requestAnimationFrame(frame);
