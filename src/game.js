import { AudioEngine } from './audio.js';
import { BOSSES, CLASSES, ENEMIES, EVENTS, FUSIONS, META_PERKS, SPECIALIZATIONS, STAGES, UPGRADES } from './data.js';
import { TAU, absorbDamage, chooseUnique, circleHit, clamp, distanceSq, formatTime, normalize, spawnInterval, weightedPick, xpForLevel } from './core.js';

const $ = id => document.getElementById(id);
const canvas = $('world');
const ctx = canvas.getContext('2d', { alpha: false });
const ui = {
  menu: $('menu'), campaign: $('campaign'), classSelect: $('classSelect'), event: $('event'), book: $('book'), choice: $('choice'),
  pause: $('pause'), end: $('end'), archive: $('archive'), settings: $('settings'), hud: $('hud'), status: $('status'),
  build: $('buildPanel'), boss: $('bossBar'), touch: $('touch'), flash: $('flash'), campaignNodes: $('campaignNodes'),
  campaignLinks: $('campaignLinks'), campaignProgress: $('campaignProgress'), chooseStage: $('chooseStage'),
  stageKicker: $('stageKicker'), stageNumber: $('stageNumber'), stageTitle: $('stageTitle'), stageLore: $('stageLore'),
  stageObjective: $('stageObjective'), stageDuration: $('stageDuration'), stageThreat: $('stageThreat'), classCards: $('classCards'), specCards: $('specCards'),
  selectedStagePath: $('selectedStagePath'), selectedStageObjective: $('selectedStageObjective'), chosenClassName: $('chosenClassName'),
  chosenClassAbility: $('chosenClassAbility'), chosenSpecName: $('chosenSpecName'), eventCards: $('eventCards'), bookTabs: $('bookTabs'), bookGrid: $('bookGrid'), bookDetail: $('bookDetail'),
  bookFound: $('bookFound'), bookTotal: $('bookTotal'), bookProgressFill: $('bookProgressFill'), menuBookProgress: $('menuBookProgress'),
  endless: $('endlessButton'), endlessState: $('endlessState'), timer: $('timer'), phase: $('phaseName'), wave: $('wave'),
  level: $('level'), kills: $('kills'), health: $('healthFill'), healthText: $('healthText'), xp: $('xpFill'),
  dash: $('dashAbility'), ability: $('classAbility'), abilityIcon: $('abilityIcon'), abilityName: $('abilityName'),
  hudClassIcon: $('hudClassIcon'), hudPortrait: $('hudPortrait'), missionText: $('missionText'), missionFill: $('missionFill'),
  buildSlots: $('buildSlots'), bossName: $('bossName'), bossHealth: $('bossHealthFill'), bossHealthText: $('bossHealthText'),
  cards: $('cards'), choiceTitle: $('choiceTitle'), choiceSubtitle: $('choiceSubtitle'), pinnedRecipe: $('pinnedRecipe'), toast: $('toast'), announcement: $('announcement')
};

const OBJECTIVES = {
  survive: ['ВЫЖИТЬ ДО ПРОБУЖДЕНИЯ СТРАЖА', 'ВЫЖИВАНИЕ'], seals: ['АКТИВИРОВАТЬ 3 ПЕЧАТИ', 'ПЕЧАТИ'],
  hunt: ['НАЙТИ И ПОБЕДИТЬ 3 ЭЛИТЫ', 'ОХОТА'], defense: ['ЗАЩИТИТЬ ИСКРУ КУЗНИ', 'ОБОРОНА'],
  boss: ['ДОБРАТЬСЯ ДО СЕРДЦА КОРОНЫ', 'ФИНАЛ'], portals: ['УНИЧТОЖИТЬ 4 ПОРТАЛА', 'ПОРТАЛЫ'],
  escort: ['СОПРОВОДИТЬ ДРЕВНЮЮ МАШИНУ', 'СОПРОВОЖДЕНИЕ'], zone: ['УДЕРЖИВАТЬ ДВИЖУЩИЙСЯ СВЕТ', 'ЖИВАЯ ЗОНА'],
  parts: ['СОБРАТЬ 4 ЧАСТИ МЕХАНИЗМА', 'СБОР ДЕТАЛЕЙ'], tracks: ['НАЙТИ 5 СЛЕДОВ ОХОТНИКА', 'ПОИСК ПО СЛЕДАМ'],
  twins: ['ПОБЕДИТЬ ДВА СВЯЗАННЫХ СИГНАЛА', 'ДВОЙНАЯ ЦЕЛЬ'], endless: ['ПРОДЕРЖАТЬСЯ КАК МОЖНО ДОЛЬШЕ', 'БЕСКОНЕЧНЫЙ ЦИКЛ']
};
const ABILITIES = {
  swordsman: ['✺', 'КРУГОВОЙ РАЗРЕЗ'], archer: ['⫷', 'СЕМЬ СТРЕЛ'], mage: ['※', 'РАЗЛОМ'], mechanist: ['⌬', 'ПЕРЕГРУЗКА']
};
const ENDLESS_STAGE = {
  id: 'endless', number: 99, title: 'Бесконечный разлом', subtitle: 'ПОСЛЕ КОРОНЫ', lore: 'Корона открыла маршрут, которого не было на карте.',
  objective: 'endless', duration: Infinity, accent: '#e1ae5a', biome: 'void', enemies: Object.keys(ENEMIES), boss: 'archon', endless: true
};
const DEFAULT_SAVE = {
  echoes: 0, bestTime: 0, totalKills: 0, perks: Object.fromEntries(Object.keys(META_PERKS).map(id => [id, 0])),
  settings: { volume: 65, shake: true, effects: true }, completedStages: [], selectedClass: 'swordsman',
  selectedSpecs: { swordsman: 'guardian', archer: 'hunter', mage: 'riftkeeper', mechanist: 'engineer' },
  codex: { items: [], fusions: [], enemies: [], specs: [], bosses: [] }, campaignComplete: false, hardCompletedStages: [],
  enemyKills: {}, bossKills: {}, stageTimes: {}, builds: [], pinnedFusion: null, nextRunEvent: null, pendingEvent: false
};

function loadSave() {
  try {
    const stored = JSON.parse(localStorage.getItem('crown-of-static-save')) || {};
    return {
      ...DEFAULT_SAVE, ...stored, perks: { ...DEFAULT_SAVE.perks, ...stored.perks },
      settings: { ...DEFAULT_SAVE.settings, ...stored.settings },
      completedStages: Array.isArray(stored.completedStages) ? stored.completedStages : [],
      hardCompletedStages: Array.isArray(stored.hardCompletedStages) ? stored.hardCompletedStages : [],
      selectedSpecs: { ...DEFAULT_SAVE.selectedSpecs, ...stored.selectedSpecs }, enemyKills: stored.enemyKills || {}, bossKills: stored.bossKills || {},
      stageTimes: stored.stageTimes || {}, builds: Array.isArray(stored.builds) ? stored.builds : [],
      codex: {
        items: Array.isArray(stored.codex?.items) ? stored.codex.items : [],
        fusions: Array.isArray(stored.codex?.fusions) ? stored.codex.fusions : [],
        enemies: Array.isArray(stored.codex?.enemies) ? stored.codex.enemies : [],
        specs: Array.isArray(stored.codex?.specs) ? stored.codex.specs : [],
        bosses: Array.isArray(stored.codex?.bosses) ? stored.codex.bosses : []
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
let selectedSpec = SPECIALIZATIONS[selectedClass][save.selectedSpecs[selectedClass]] ? save.selectedSpecs[selectedClass] : Object.keys(SPECIALIZATIONS[selectedClass])[0];
let difficulty = 'normal';
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
  [ui.menu, ui.campaign, ui.classSelect, ui.event, ui.book, ui.choice, ui.pause, ui.end, ui.archive, ui.settings].forEach(element => element.classList.add('hidden'));
  if (ui[next]) ui[next].classList.remove('hidden');
  const playingUi = Boolean(game) && ['playing', 'choice', 'pause'].includes(next);
  [ui.hud, ui.status, ui.build].forEach(element => element.classList.toggle('hidden', !playingUi));
  ui.boss.classList.toggle('hidden', !playingUi || !game?.activeBoss);
  ui.touch.classList.toggle('hidden', !playingUi || !matchMedia('(pointer: coarse)').matches);
  if (next === 'campaign') renderCampaign();
  if (next === 'classSelect') renderClassSelect();
  if (next === 'event') renderEvent();
  if (next === 'book') renderBook();
}

function completedStages() { return difficulty === 'hard' ? save.hardCompletedStages : save.completedStages; }

function isStageUnlocked(stage) {
  if (stage.future) return false;
  const completed = completedStages();
  if (completed.includes(stage.id)) return true;
  const all = (stage.requires || []).every(id => completed.includes(id));
  const any = !stage.requiresAny || stage.requiresAny.some(id => completed.includes(id));
  return all && any;
}

function renderCampaign() {
  const playable = STAGES.filter(stage => !stage.future);
  const completed = completedStages();
  ui.campaignProgress.textContent = `${completed.filter(id => playable.some(stage => stage.id === id)).length} / ${playable.length}`;
  $('campaignMode').textContent = difficulty === 'hard' ? 'ХАРД // ОСВОБОЖДЕНО' : 'ОСВОБОЖДЕНО';
  const connections = [];
  for (const stage of STAGES) {
    for (const requirement of [...(stage.requires || []), ...(stage.requiresAny || [])]) connections.push([requirement, stage.id]);
  }
  for (const future of STAGES.filter(stage => stage.future)) connections.push(['crown-heart', future.id]);
  ui.campaignLinks.innerHTML = connections.map(([fromId, toId]) => {
    const from = STAGES.find(stage => stage.id === fromId); const to = STAGES.find(stage => stage.id === toId);
    const complete = completed.includes(fromId) && (to.future || isStageUnlocked(to));
    return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" class="${complete ? 'complete' : ''}"/>`;
  }).join('');
  ui.campaignNodes.innerHTML = '';
  for (const stage of STAGES) {
    const complete = completed.includes(stage.id); const unlocked = isStageUnlocked(stage);
    const button = document.createElement('button');
    button.className = `stage-node ${stage.future ? 'future locked' : complete ? 'complete' : unlocked ? 'available' : 'locked'} ${selectedStage?.id === stage.id ? 'selected' : ''}`;
    button.style.left = `${stage.x}%`; button.style.top = `${stage.y}%`; button.disabled = !unlocked;
    button.innerHTML = `<span>${stage.future ? '?' : String(stage.number).padStart(2, '0')}</span><small>${stage.title.toUpperCase()}</small>`;
    if (unlocked) button.addEventListener('click', () => { selectedStage = stage; renderCampaign(); showStage(stage); audio.click(); });
    ui.campaignNodes.append(button);
  }
  if (!selectedStage || !isStageUnlocked(selectedStage)) selectedStage = playable.find(stage => isStageUnlocked(stage) && !completed.includes(stage.id)) || playable.find(isStageUnlocked);
  if (selectedStage) showStage(selectedStage);
}

function showStage(stage) {
  const unlocked = isStageUnlocked(stage); const complete = completedStages().includes(stage.id);
  ui.stageKicker.textContent = `${stage.subtitle}${complete ? ' // ПРОЙДЕНО' : ''}`;
  ui.stageNumber.textContent = String(stage.number).padStart(2, '0'); ui.stageTitle.textContent = stage.title;
  ui.stageLore.textContent = stage.lore; ui.stageObjective.textContent = OBJECTIVES[stage.objective][1];
  ui.stageDuration.textContent = `${Math.floor(stage.duration / 60)}:${String(stage.duration % 60).padStart(2, '0')}`;
  const threat = ['НИЗКАЯ', 'УМЕРЕННАЯ', 'УМЕРЕННАЯ', 'ВЫСОКАЯ', 'ВЫСОКАЯ', 'КРИТИЧЕСКАЯ', 'КРИТИЧЕСКАЯ', 'ЖЕСТОКАЯ', 'ЖЕСТОКАЯ', 'ПРЕДЕЛЬНАЯ', 'ПРЕДЕЛЬНАЯ', 'НЕИЗВЕСТНАЯ'][stage.number - 1];
  ui.stageThreat.textContent = difficulty === 'hard' ? `${threat} +` : threat;
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
    button.addEventListener('click', () => { selectedClass = id; selectedSpec = save.selectedSpecs[id] || Object.keys(SPECIALIZATIONS[id])[0]; save.selectedClass = id; save.codex.items = [...new Set([...save.codex.items, hero.primary])]; persist(); renderClassSelect(); audio.click(); });
    ui.classCards.append(button);
  }
  ui.specCards.innerHTML = '';
  for (const [id, spec] of Object.entries(SPECIALIZATIONS[selectedClass])) {
    const button = document.createElement('button'); button.className = `spec-card ${id === selectedSpec ? 'selected' : ''}`; button.style.setProperty('--spec-accent', spec.accent);
    button.innerHTML = `<span><i>${spec.icon}</i></span><div><small>${spec.title.toUpperCase()}</small><strong>${spec.name}</strong><p>${spec.description}</p></div>`;
    button.addEventListener('click', () => { selectedSpec = id; save.selectedSpecs[selectedClass] = id; unlockCodex('specs', `${selectedClass}:${id}`, false); persist(); renderClassSelect(); audio.click(); }); ui.specCards.append(button);
  }
  const hero = CLASSES[selectedClass]; const spec = SPECIALIZATIONS[selectedClass][selectedSpec];
  ui.chosenSpecName.textContent = spec.name; ui.chosenSpecName.style.color = spec.accent; ui.chosenClassName.textContent = `${hero.name} // ${spec.name}`; ui.chosenClassAbility.textContent = `${hero.ability} ${spec.description}`;
}

function renderEvent() {
  const ids = chooseUnique(Object.keys(EVENTS), 3); ui.eventCards.innerHTML = '';
  for (const id of ids) {
    const event = EVENTS[id]; const unavailable = id === 'merchant' && save.echoes < 30; const button = document.createElement('button');
    button.className = 'event-card'; button.disabled = unavailable; button.style.setProperty('--event-accent', event.accent);
    button.innerHTML = `<span><i>${event.icon}</i></span><small>${unavailable ? 'НЕДОСТАТОЧНО ЭХА' : 'ОДНОРАЗОВЫЙ МАРШРУТ'}</small><h3>${event.name}</h3><p>${event.description}</p>`;
    button.addEventListener('click', () => { if (unavailable) return; if (id === 'merchant') save.echoes -= 30; save.nextRunEvent = id; save.pendingEvent = false; persist(); audio.click(); setScreen('campaign'); }); ui.eventCards.append(button);
  }
}

function codexCounts() {
  const validItems = save.codex.items.filter(id => UPGRADES[id]).length;
  const validFusions = save.codex.fusions.filter(id => FUSIONS[id]).length;
  const validEnemies = save.codex.enemies.filter(id => ENEMIES[id]).length;
  const validBosses = save.codex.bosses.filter(id => BOSSES[id]).length;
  const specs = Object.values(SPECIALIZATIONS).reduce((sum, group) => sum + Object.keys(group).length, 0);
  const validSpecs = save.codex.specs.filter(key => SPECIALIZATIONS[key.split(':')[0]]?.[key.split(':')[1]]).length;
  return { found: validItems + validFusions + validEnemies + validBosses + validSpecs, total: Object.keys(UPGRADES).length + Object.keys(FUSIONS).length + Object.keys(ENEMIES).length + Object.keys(BOSSES).length + specs };
}

function tabEntries(tab) {
  if (['weapons', 'artifacts', 'talents'].includes(tab)) return Object.entries(UPGRADES).filter(([, item]) => item.category === tab).map(([id, data]) => ({ id, data, kind: 'items', unlocked: save.codex.items.includes(id) }));
  if (tab === 'fusions') return Object.entries(FUSIONS).map(([id, data]) => ({ id, data, kind: 'fusions', unlocked: save.codex.fusions.includes(id) }));
  if (tab === 'enemies') return Object.entries(ENEMIES).map(([id, data]) => ({ id, data, kind: 'enemies', unlocked: save.codex.enemies.includes(id) }));
  if (tab === 'bosses') return Object.entries(BOSSES).map(([id, data]) => ({ id, data, kind: 'bosses', unlocked: save.codex.bosses.includes(id) }));
  if (tab === 'heroes') return Object.entries(CLASSES).map(([id, data]) => ({ id, data, kind: 'heroes', unlocked: save.codex.items.includes(data.primary) }));
  return save.builds.map((data, index) => ({ id: String(index), data: { ...data, name: `${CLASSES[data.classId]?.name || 'Носитель'} // ${SPECIALIZATIONS[data.classId]?.[data.specId]?.name || 'Путь'}`, icon: CLASSES[data.classId]?.icon || '◇', accent: SPECIALIZATIONS[data.classId]?.[data.specId]?.accent }, kind: 'builds', unlocked: true }));
}

function renderBook() {
  const counts = codexCounts(); ui.bookFound.textContent = counts.found; ui.bookTotal.textContent = counts.total;
  ui.bookProgressFill.style.width = `${counts.found / counts.total * 100}%`; ui.menuBookProgress.textContent = `${Math.round(counts.found / counts.total * 100)}%`;
  for (const button of ui.bookTabs.querySelectorAll('button')) {
    const entries = tabEntries(button.dataset.tab); const found = entries.filter(entry => entry.unlocked).length;
    button.classList.toggle('active', button.dataset.tab === bookTab); button.querySelector('b').textContent = `${found}/${entries.length} · ${entries.length ? Math.round(found / entries.length * 100) : 0}%`;
  }
  const entries = tabEntries(bookTab);
  if (!entries.some(entry => `${entry.kind}:${entry.id}` === bookSelection)) bookSelection = entries.length ? `${entries[0].kind}:${entries[0].id}` : null;
  ui.bookGrid.innerHTML = '';
  for (const entry of entries) {
    const key = `${entry.kind}:${entry.id}`; const showRecipe = entry.kind === 'fusions';
    const button = document.createElement('button');
    button.className = `book-entry ${entry.unlocked ? '' : 'locked'} ${bookSelection === key ? 'selected' : ''}`;
    button.style.setProperty('--entry-accent', entry.data.accent || entry.data.color || '#67e1c1');
    button.innerHTML = `<span class="entry-icon">${entry.unlocked ? entry.data.icon || enemyIcon(entry.id) : '◆'}</span><small>${entry.unlocked ? entry.data.category?.toUpperCase() || entry.data.family || entry.kind.toUpperCase() : showRecipe ? 'РЕЦЕПТ ДОСТУПЕН' : 'ЗАПИСЬ УТРАЧЕНА'}</small><strong>${entry.unlocked ? entry.data.name : showRecipe ? 'НЕИЗВЕСТНОЕ СЛИЯНИЕ' : 'НЕИЗВЕСТНЫЙ ОБЪЕКТ'}</strong>`;
    button.addEventListener('click', () => { bookSelection = key; renderBook(); audio.click(); }); ui.bookGrid.append(button);
  }
  renderBookDetail(entries.find(entry => `${entry.kind}:${entry.id}` === bookSelection) || entries[0]);
}

function renderBookDetail(entry) {
  if (!entry) { ui.bookDetail.innerHTML = ''; return; }
  const { id, data, kind, unlocked } = entry; const accent = data.accent || data.color || '#67e1c1';
  let body = '';
  if (kind === 'items' && unlocked) {
    const location = data.spec ? `${CLASSES[data.classes[0]].name}: специализация «${SPECIALIZATIONS[data.classes[0]][data.spec].name}»` : data.classes ? `Доступно классу: ${data.classes.map(key => CLASSES[key].name).join(', ')}` : 'Может появиться при повышении уровня в любом секторе.';
    body = `<p>${data.descriptions[0]}</p><div class="detail-levels"><div><b>⌖</b>${location}</div>${data.descriptions.map((text, index) => `<div><b>${index + 1}</b>${text}</div>`).join('')}</div>`;
  }
  if (kind === 'items' && !unlocked) body = '<p>Эта запись ещё не выбрана во время забега. Архив сохранил только подсказку: реликвии приходят при новом уровне, а таланты зависят от специализации.</p><div class="mystery-effect">ВЫБЕРИ ПРЕДМЕТ, ЧТОБЫ ВОССТАНОВИТЬ СТРАНИЦУ</div>';
  if (kind === 'fusions') {
    const parts = data.recipe.map(part => save.codex.items.includes(part) ? UPGRADES[part].name : 'НЕИЗВЕСТНЫЙ ПРЕДМЕТ');
    body = `<p>Собери нужные уровни обеих реликвий в одном забеге.</p><div class="recipe"><span>${parts[0]} ${roman(data.levels[0])}</span><b>+</b><span>${parts[1]} ${roman(data.levels[1])}</span></div>${unlocked ? `<div class="detail-levels"><div><b>✓</b>${data.description}</div></div>` : '<div class="mystery-effect">ЭФФЕКТ СКРЫТ ДО ПЕРВОГО СЛИЯНИЯ</div>'}<button class="pin-button" data-pin="${id}">${save.pinnedFusion === id ? 'ОТКРЕПИТЬ РЕЦЕПТ' : 'ЗАКРЕПИТЬ РЕЦЕПТ ДЛЯ ЗАБЕГА'}</button>`;
  }
  if (kind === 'enemies' && unlocked) body = `<p>${enemyDescription(id)}</p><div class="detail-levels"><div><b>◈</b>Семейство: ${data.family}</div><div><b>✦</b>Уничтожено: ${save.enemyKills[id] || 0}</div><div><b>⌖</b>${enemyLocation(id)}</div></div>`;
  if (kind === 'enemies' && !unlocked) body = '<p>Архив не встречал это существо. Силуэт будет восстановлен при первой встрече.</p><div class="mystery-effect">ОБНАРУЖЬ СУЩЕСТВО В КАМПАНИИ</div>';
  if (kind === 'bosses' && unlocked) { const stage = STAGES.find(item => item.boss === id || id === 'twinB' && item.id === 'double-signal'); const normal = stage && save.stageTimes[`normal:${stage.id}`]; const hard = stage && save.stageTimes[`hard:${stage.id}`]; body = `<p>${bossLore(id)}</p><div class="detail-levels"><div><b>✦</b>Побед: ${save.bossKills[id] || 0}</div><div><b>⌖</b>${stage?.title || 'Скрытая сигнатура'}</div><div><b>◷</b>Лучшее время: ${normal ? formatTime(normal) : '—'}${hard ? ` // хард ${formatTime(hard)}` : ''}</div><div><b>Ⅲ</b>Три фазы и собственные боевые правила.</div></div>`; }
  if (kind === 'bosses' && !unlocked) body = '<p>Имя стража скрыто. Запись появится, когда он впервые пробудится.</p><div class="mystery-effect">ДОЙДИ ДО ФИНАЛА СЕКТОРА</div>';
  if (kind === 'heroes') {
    const specs = Object.entries(SPECIALIZATIONS[id]);
    const knownSpec = specs.find(([specId]) => save.codex.specs.includes(`${id}:${specId}`)); body = `<div class="hero-forms"><div class="hero-preview"><img src="${data.image}" alt="${data.name} до специализации"><small>ДО</small></div><div class="hero-preview evolved" style="--form-accent:${knownSpec?.[1].accent || '#485750'}"><img src="${data.image}" alt="${data.name} после специализации"><small>ПОСЛЕ</small></div></div><p>${data.passive} ${data.ability}</p><div class="detail-levels">${specs.map(([specId, spec]) => { const known = save.codex.specs.includes(`${id}:${specId}`); return `<div><b style="color:${known ? spec.accent : '#596760'}">${known ? spec.icon : '?'}</b>${known ? `${spec.name}: ${spec.description}` : 'Неизвестная специализация'}</div>`; }).join('')}</div>`;
  }
  if (kind === 'builds') {
    const stage = STAGES.find(item => item.id === data.stageId); const items = data.items.map(([itemId, level]) => `${UPGRADES[itemId]?.name || itemId} ${roman(level)}`).join(' · ');
    body = `<p>${data.victory ? 'Победная' : 'Сохранённая'} сборка из сектора «${stage?.title || data.stageId}».</p><div class="detail-levels"><div><b>◷</b>${formatTime(data.time)} // ${data.difficulty === 'hard' ? 'ХАРД' : 'ОБЫЧНЫЙ'}</div><div><b>✦</b>${data.kills} целей</div><div><b>▤</b>${items || 'Только основное оружие'}</div><div><b>F</b>${data.fusions.length ? data.fusions.map(key => FUSIONS[key]?.name).join(', ') : 'Без слияний'}</div></div>`;
  }
  const name = unlocked ? data.name : kind === 'fusions' ? 'Неизвестное слияние' : 'Закрытая запись';
  const category = ({ fusions: 'СЛИЯНИЕ', bosses: 'СТРАЖ СЕКТОРА', heroes: 'НОСИТЕЛЬ', builds: 'СОХРАНЁННАЯ СБОРКА' })[kind] || data.category?.toUpperCase() || data.family;
  ui.bookDetail.className = `book-detail ${unlocked ? '' : 'locked'}`; ui.bookDetail.style.setProperty('--detail-accent', accent);
  ui.bookDetail.innerHTML = `<div class="detail-icon"><span>${unlocked ? data.icon || enemyIcon(id) : '◆'}</span></div><span class="detail-category">${unlocked ? category : 'ДАННЫЕ ОТСУТСТВУЮТ'}</span><h3>${name}</h3>${body}`;
  ui.bookDetail.querySelector('[data-pin]')?.addEventListener('click', event => { save.pinnedFusion = save.pinnedFusion === event.currentTarget.dataset.pin ? null : event.currentTarget.dataset.pin; persist(); renderBookDetail(entry); audio.click(); });
}

function roman(level) { return ['0', 'I', 'II', 'III', 'IV', 'V'][level] || String(level); }
function enemyIcon(id) { return ({ husk: '◒', wisp: '✦', drone: '⌬', charger: '♜', brute: '⬢', seer: '◉', hound: '⌁', sentinel: '⬡', scribe: '▤', warder: '▣', repairer: '⚙', conductor: 'ϟ', silencer: '⊘', mirror: '◇' })[id] || '◉'; }
function enemyDescription(id) {
  return ({
    husk: 'Пустой доспех движется по чужой, давно забытой команде.', wisp: 'Быстрая искра древнего сигнала. Слаба, но редко приходит одна.',
    drone: 'Летающий механизм держит дистанцию и выпускает энергетические иглы.', charger: 'Рыцарь накапливает импульс перед стремительным рывком.',
    brute: 'Тяжёлый каменный страж. Медленный, прочный и крайне опасный вблизи.', seer: 'Астроном видит цель без глаз и атакует с большой дистанции.',
    hound: 'Латунная гончая быстро сокращает расстояние и окружает носителя.', sentinel: 'Кузнечный страж прикрыт толстой бронёй и атакует раскалёнными зарядами.',
    scribe: 'Переписчик превращает утраченные слова Архива в холодные снаряды.', warder: 'Создаёт защитный контур вокруг ближайших союзников.',
    repairer: 'Малая машина восстанавливает повреждённых представителей Роя.', conductor: 'Ускоряет существ рядом и направляет их к носителю.',
    silencer: 'Его заряд временно нарушает работу классовой способности.', mirror: 'Повторяет повреждённые формы союзников, но копии быстро распадаются.'
  })[id] || 'Сведения повреждены.';
}

function enemyLocation(id) { const names = STAGES.filter(stage => stage.enemies.includes(id)).slice(0, 3).map(stage => stage.title); return names.length ? `Встречается: ${names.join(', ')}` : 'Место встречи не восстановлено.'; }
function bossLore(id) {
  return ({ gardener: 'Садовник выращивает стены из металла и меняет форму арены.', oracle: 'Оракул искажает направление движения перед сильным импульсом.', librarian: 'Библиотекарь умеет временно закрывать одну страницу текущей сборки.', forgemaster: 'Кузнец собирает броню из рассеянных машин.', crown: 'Корона изучает оружие носителя и отвечает похожей атакой.', twinA: 'Один из двух сигналов. Пока оба активны, они усиливают друг друга.', twinB: 'Вторая половина команды, которую невозможно отключить одним ударом.' })[id] || 'Страж сектора меняет тактику на каждой фазе. Перед опасной атакой его контур загорается.';
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
  const hero = CLASSES[selectedClass]; const spec = SPECIALIZATIONS[selectedClass][selectedSpec]; const stage = selectedStage || STAGES[0]; const metaHealth = (save.perks.vitality || 0) * 5;
  const upgrades = Object.fromEntries(Object.keys(UPGRADES).map(id => [id, 0])); upgrades[hero.primary] = 1;
  const seals = [{ x: -520, y: -180, charge: 0 }, { x: 430, y: -310, charge: 0 }, { x: 270, y: 430, charge: 0 }];
  const hard = difficulty === 'hard'; const eventId = save.nextRunEvent; const coreHealth = 760 + stage.number * 45; save.nextRunEvent = null; persist();
  const state = {
    stage, classId: selectedClass, specId: selectedSpec, hero, spec, difficulty, eventId, time: 0, spawnClock: stage.objective === 'defense' ? 2.2 : .5, attackClock: .2, thornClock: 2, stormClock: 1.2,
    mineClock: 2.5, frostClock: 3, recoveryClock: 18, pendingLevels: 0, ended: false, upgrades, fusions: new Set(),
    player: {
      x: stage.objective === 'defense' ? 110 : 0, y: 0, radius: 15, facing: 0, hp: hero.hp + metaHealth, maxHp: hero.hp + metaHealth,
      speed: hero.speed * (spec.speed || 1) * (1 + (save.perks.swiftness || 0) * .03), damage: hero.damage * (spec.damage || 1) * (1 + (save.perks.force || 0) * .04), fireRate: 1, magnet: 115,
      armor: (selectedClass === 'swordsman' ? .12 : 0) + (spec.armor || 0) + (save.perks.ward || 0) * .03,
      level: 1, xp: 0, nextXp: xpForLevel(1), dashCooldown: 0, dashTime: 0, abilityCooldown: 0, invulnerable: 0,
      speedBoost: 0, lastDamage: -99, attackPose: 0, overdrive: 0, shotCount: 0, step: 0, blockCooldown: spec === SPECIALIZATIONS.swordsman.guardian ? 14 : 0
    },
    enemies: [], projectiles: [], hostile: [], shards: [], drops: [], particles: [], effects: [], numbers: [], mines: [], hazards: [],
    kills: 0, activeBoss: null, bossSpawned: false, camera: { x: 0, y: 0, shake: 0 }, seals,
    elitesKilled: 0, elitesSpawned: 0, nextElite: 34, core: { x: 0, y: 0, radius: 34, hp: coreHealth, maxHp: coreHealth, shield: 180, maxShield: 180, lastDamage: -99 },
    portals: [], escort: { x: -560, y: 0, radius: 32, hp: 720, maxHp: 720, progress: 0 }, zone: { x: 0, y: 0, radius: 145, charge: 0, moveClock: 22 },
    parts: [{ x: -480, y: -260 }, { x: 470, y: -250 }, { x: -330, y: 430 }, { x: 430, y: 380 }], tracks: [], objectiveCount: 0,
    nextBossAt: stage.endless ? (hard ? 140 : 180) : 0, storyStep: 0, endReward: 0, victory: false, invertControls: 0, lockedUpgrade: null, lockedTimer: 0,
    hardHazardClock: 13, anomalyElite: eventId === 'anomaly', signalElite: eventId === 'signal', rewardScale: eventId === 'anomaly' || eventId === 'signal' ? 1.3 : 1
  };
  if (stage.objective === 'portals') for (const [x, y] of [[-520, -290], [470, -330], [-390, 420], [510, 360]]) state.enemies.push(objectiveEnemy(x, y, 420 + stage.number * 32, stage.accent));
  if (stage.objective === 'tracks') state.tracks = [{ x: -400, y: -220 }, { x: 360, y: -350 }, { x: 530, y: 150 }, { x: 80, y: 460 }, { x: -450, y: 330 }];
  applyStartEvent(state, eventId); return state;
}

function objectiveEnemy(x, y, hp, color) {
  return { id: 'portal', type: 'objective', shape: 'portal', x, y, radius: 30, hp, maxHp: hp, speed: 0, damage: 0, xp: 0, color, objectiveTarget: true, hit: 0, contact: 0, haloHit: 0, slow: 0, knockX: 0, knockY: 0, age: 0, attack: 0, charge: 0, spawn: .35, phase: Math.random() * TAU };
}

function applyStartEvent(state, id) {
  if (!id) return;
  const p = state.player; const artifacts = Object.keys(UPGRADES).filter(key => UPGRADES[key].category === 'artifacts');
  if (id === 'altar') { p.maxHp = Math.round(p.maxHp * .82); p.hp = p.maxHp; p.damage *= 1.18; const key = artifacts[Math.floor(Math.random() * artifacts.length)]; state.upgrades[key] = 1; applyUpgradeStats(state, key); unlockCodex('items', key, false); }
  if (id === 'forge') state.upgrades[state.hero.primary] = 2;
  if (id === 'archive') { state.xpScale = 1.2; const unseen = artifacts.filter(key => !save.codex.items.includes(key)); if (unseen.length) unlockCodex('items', unseen[Math.floor(Math.random() * unseen.length)], false); }
  if (id === 'merchant') for (const key of chooseUnique(artifacts, 2)) { state.upgrades[key] = 1; applyUpgradeStats(state, key); unlockCodex('items', key, false); }
}

function applyUpgradeStats(state, key) {
  const p = state.player;
  if (key === 'stride') p.speed *= 1.1; if (key === 'magnet') p.magnet += 50;
  if (key === 'vitality') { p.maxHp += 22; p.hp = Math.min(p.maxHp, p.hp + 22); } if (key === 'armor') p.armor += .08;
}

function startGame() {
  audio.start(); audio.click(); unlockCodex('items', CLASSES[selectedClass].primary, false); unlockCodex('specs', `${selectedClass}:${selectedSpec}`, false); game = createGame(); setScreen('playing');
  ui.wave.textContent = game.stage.endless ? '∞' : String(game.stage.number).padStart(2, '0');
  ui.phase.textContent = `${game.stage.title.toUpperCase()}${game.difficulty === 'hard' ? ' // ХАРД' : ''}`; ui.hudClassIcon.textContent = game.spec.icon; ui.hudClassIcon.style.color = game.spec.accent; ui.hudPortrait.textContent = game.hero.icon;
  ui.abilityIcon.textContent = ABILITIES[game.classId][0]; ui.abilityName.textContent = ABILITIES[game.classId][1]; ui.boss.classList.add('hidden');
  updateBuild(); announce(game.eventId ? EVENTS[game.eventId].name.toUpperCase() : game.stage.subtitle, game.stage.title, game.eventId ? EVENTS[game.eventId].description : game.stage.lore, 3200);
}

function inputVector() {
  let x = touchMove.x; let y = touchMove.y;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x--; if (keys.has('KeyD') || keys.has('ArrowRight')) x++;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y--; if (keys.has('KeyS') || keys.has('ArrowDown')) y++;
  if (game?.invertControls > 0) { x *= -1; y *= -1; }
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
  const player = game.player; const cooldown = (1 - (save.perks.charge || 0) * .03) * (1 - game.upgrades.capacitor * .1); player.attackPose = .3;
  if (game.classId === 'swordsman') {
    player.abilityCooldown = 7 * cooldown; const radius = 235 + game.upgrades.bastion * 18; game.effects.push({ type: 'slash', x: player.x, y: player.y, angle: 0, radius, full: true, life: .44, maxLife: .44, color: game.spec.accent });
    for (const enemy of game.enemies) if (distanceSq(player, enemy) < radius ** 2) damageEnemy(enemy, 88 * player.damage, true);
    game.hostile = game.hostile.filter(shot => distanceSq(shot, player) > 250 ** 2); game.camera.shake = 10;
  } else if (game.classId === 'archer') {
    player.abilityCooldown = 7.5 * cooldown * (1 - game.upgrades.stormQuiver * .08); const target = nearestEnemy(player.x, player.y); const base = target ? Math.atan2(target.y - player.y, target.x - player.x) : player.facing;
    const spread = .105 + game.upgrades.stormQuiver * .012; for (let index = -3; index <= 3; index++) createProjectile(player.x, player.y, base + index * spread, { kind: 'arrow', speed: 780, damage: 58 * player.damage, pierce: 4, color: game.spec.accent, life: 1.8 });
  } else if (game.classId === 'mage') {
    player.abilityCooldown = 9 * cooldown * (1 - game.upgrades.continuum * .07); const target = nearestEnemy(player.x, player.y); const distance = target ? Math.min(420, Math.sqrt(distanceSq(player, target))) : 250;
    const angle = target ? Math.atan2(target.y - player.y, target.x - player.x) : player.facing;
    const scale = game.spec.riftScale || 1; const life = 5.2 + game.upgrades.continuum * .7; game.effects.push({ type: 'rift', x: player.x + Math.cos(angle) * distance, y: player.y + Math.sin(angle) * distance, radius: (155 + game.upgrades.gravityWell * 18) * scale, life, maxLife: life, pulse: 0, color: game.spec.accent });
    if (game.specId === 'battlemage') player.invulnerable = Math.max(player.invulnerable, .3 + game.upgrades.spellguard * .12);
  } else {
    player.abilityCooldown = 10 * cooldown; player.overdrive = 6.5;
    game.effects.push({ type: 'overdrive', x: player.x, y: player.y, radius: 160, life: .7, maxLife: .7, color: game.spec.accent });
  }
  if (game.upgrades.capacitor >= 3) player.speedBoost = Math.max(player.speedBoost, 2.5);
  if (game.fusions.has('solarClock')) player.solarBoost = 4;
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
  const hard = game.difficulty === 'hard'; const scale = (options.boss ? 1 + Math.max(0, rank - 1) * .08 : (1 + Math.max(0, rank - 1) * .14) * timeScale) * (hard ? 1.45 : 1);
  const siegeChance = game.core.hp < game.core.maxHp * .45 ? .2 : .4;
  const siegeSpawn = game.stage.objective === 'defense' && !data.ranged && !options.boss && Math.random() < siegeChance;
  const anchor = siegeSpawn ? game.core : game.player;
  const enemy = {
    id: options.bossId || type, type: options.boss ? 'boss' : type, shape: options.boss ? 'boss' : data.shape,
    x: anchor.x + Math.cos(angle) * margin, y: anchor.y + Math.sin(angle) * margin, radius: data.radius,
    hp: data.hp * scale * (options.elite ? 3.3 : 1), maxHp: data.hp * scale * (options.elite ? 3.3 : 1),
    speed: data.speed * Math.min(1.38, 1 + game.time * .00075) * (hard ? 1.18 : 1), damage: data.damage * (1 + Math.max(0, rank - 1) * .055) * (hard ? 1.15 : 1),
    xp: (data.xp || 20) * (options.elite ? 5 : 1), color: data.color, ranged: data.ranged || Boolean(options.boss), charger: data.charger,
    bossData: options.boss || null, elite: Boolean(options.elite), siege: siegeSpawn, siegeHits: 0, support: data.support, hit: 0, contact: 0, haloHit: 0, slow: 0,
    knockX: 0, knockY: 0, age: 0, attack: .8 + Math.random() * 1.2, charge: 1.7 + Math.random() * 2, supportClock: 2 + Math.random(), cloneClock: 8,
    spawn: .35, phase: Math.random() * TAU, bossPhase: 1, patternClock: 3.5, modifier: options.elite && hard ? ['swift', 'warded', 'volatile'][Math.floor(Math.random() * 3)] : null
  };
  if (enemy.modifier === 'swift') enemy.speed *= 1.25; if (enemy.modifier === 'warded') { enemy.hp *= 1.35; enemy.maxHp = enemy.hp; }
  game.enemies.push(enemy); if (!options.boss) unlockCodex('enemies', type, false); return enemy;
}

function spawnBoss(bossId = game.stage.boss, linked = false) {
  if (game.activeBoss && !linked) return; const data = BOSSES[bossId]; if (!data) return;
  const boss = spawnEnemy('boss', { boss: data, bossId }); boss.attack = .9; boss.charge = 2.4;
  game.activeBoss ||= boss; game.bossSpawned = true; unlockCodex('bosses', bossId, false); ui.bossName.textContent = game.stage.objective === 'twins' ? 'ДВА СВЯЗАННЫХ СИГНАЛА' : data.name; ui.boss.classList.remove('hidden');
  announce(data.subtitle, data.name, game.stage.endless ? 'Разлом проверяет, чему ты научился.' : 'Последняя печать сектора пробуждена.', 3200);
  game.camera.shake = 16; flash(.18); audio.boss();
  return boss;
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
  if (game.lockedUpgrade === game.hero.primary) { game.attackClock = .25; return; }
  const angle = Math.atan2(target.y - player.y, target.x - player.x); player.facing = angle; player.attackPose = .2; player.shotCount++;
  const cadence = 1 + game.upgrades.cadence * .12 + (player.overdrive > 0 ? .8 : 0) + (player.momentum || 0) * .08; const reach = 1 + game.upgrades.reach * .1;
  if (game.classId === 'swordsman') {
    const fused = game.fusions.has('bulwark'); const circular = fused || level >= 5 && player.shotCount % 3 === 0; const radius = (145 + level * 9) * reach; const double = game.upgrades.momentum >= 3 && player.shotCount % 4 === 0;
    game.attackClock = .72 / cadence; game.effects.push({ type: 'slash', x: player.x, y: player.y, angle, radius, full: circular, life: .25, maxLife: .25, color: game.hero.accent });
    for (const enemy of game.enemies) {
      const d = Math.sqrt(distanceSq(player, enemy)); const diff = Math.atan2(Math.sin(Math.atan2(enemy.y - player.y, enemy.x - player.x) - angle), Math.cos(Math.atan2(enemy.y - player.y, enemy.x - player.x) - angle));
      if (d < radius + enemy.radius && (circular || Math.abs(diff) < .9 + level * .04)) damageEnemy(enemy, (39 + level * 11) * player.damage * (1 + game.upgrades.severance * .18) * (double ? 1.7 : 1));
    }
    if (level >= 4) createProjectile(player.x, player.y, angle, { kind: 'wave', speed: 420, damage: 25 * player.damage, pierce: 2, radius: 8, life: .65 });
    if (fused) game.hostile = game.hostile.filter(shot => distanceSq(shot, player) > radius ** 2);
  } else if (game.classId === 'archer') {
    game.attackClock = .57 / cadence; const count = level >= 3 ? 2 : 1;
    for (let index = 0; index < count; index++) createProjectile(player.x, player.y, angle + (index - (count - 1) / 2) * .11, { kind: 'arrow', speed: 700 + level * 25, damage: (28 + level * 7) * player.damage, pierce: level >= 2 ? 1 + Math.floor(level / 4) : 0, color: game.spec.accent, life: 1.6 * (1 + game.upgrades.reach * .2) });
    const ghostRate = game.upgrades.ghostQuiver >= 3 ? 4 : 6; if (game.upgrades.ghostQuiver && player.shotCount % ghostRate === 0) createProjectile(player.x, player.y, angle + .06, { kind: 'arrow', speed: 730, damage: 34 * player.damage, target: game.upgrades.ghostQuiver >= 2 ? target : null, color: '#f5d394' });
    if (level >= 5 && player.shotCount % 3 === 0) createProjectile(player.x, player.y, angle, { kind: 'arrow', speed: 620, damage: 42 * player.damage, target, pierce: 1, color: '#f6d28d' });
  } else if (game.classId === 'mage') {
    game.attackClock = .84 / cadence; const count = level >= 4 ? 2 : 1;
    for (let index = 0; index < count; index++) createProjectile(player.x, player.y, angle + (index ? .14 : 0), { kind: 'sphere', speed: 400, damage: (36 + level * 9) * player.damage, target, chain: Math.max(0, 1 + Math.floor(level / 2) - (game.specId === 'battlemage' ? 1 : 0)), radius: 7 * reach, color: game.spec.accent, life: 3 * (1 + game.upgrades.reach * .2) });
  } else {
    game.attackClock = Math.max(.1, (.33 - level * .025) / cadence) * (1 - game.upgrades.targetMesh * .06); const drones = droneCount();
    const count = level >= 4 ? 2 : 1;
    for (let drone = 0; drone < drones; drone++) for (let index = 0; index < count; index++) {
      const orbit = player.step * 2 + drone * TAU / drones; const ox = player.x + Math.cos(orbit) * 27; const oy = player.y + Math.sin(orbit) * 27;
      createProjectile(ox, oy, angle + (index ? .055 : -.02), { kind: 'needle', speed: 760, damage: (13 + level * 4) * player.damage * (drone ? .56 + game.upgrades.swarmCore * .08 : 1), pierce: level >= 2 ? 1 : 0, color: game.spec.accent, life: 1.3 * (1 + game.upgrades.reach * .2) });
    }
  }
  audio.shoot();
}

function droneCount() { return game.fusions.has('choir') ? 3 : 1 + (game.spec.drones || 0) + (game.upgrades.swarmCore >= 2 ? 1 : 0) + (game.player.overdrive > 0 ? 1 : 0); }

function updateSharedWeapons(dt) {
  const p = game.player;
  if (game.upgrades.thorns && game.lockedUpgrade !== 'thorns') {
    game.thornClock -= dt;
    if (game.thornClock <= 0) {
      const level = game.upgrades.thorns; const radius = 120 + level * 23; game.thornClock = Math.max(2.1, 4.7 - level * .45);
      game.effects.push({ type: 'thorns', x: p.x, y: p.y, radius, life: .55, maxLife: .55, color: UPGRADES.thorns.accent });
      for (const enemy of game.enemies) if (Math.abs(Math.sqrt(distanceSq(p, enemy)) - radius) < 52) damageEnemy(enemy, (35 + level * 12) * p.damage);
    }
  }
  if (game.upgrades.storm && game.lockedUpgrade !== 'storm') {
    game.stormClock -= dt;
    if (game.stormClock <= 0) {
      const level = game.upgrades.storm; game.stormClock = Math.max(.75, 2.35 - level * .27); let target = nearestEnemy(p.x, p.y); const hit = new Set();
      for (let jump = 0; target && jump < 1 + Math.floor(level / 2); jump++) {
        hit.add(target); damageEnemy(target, (29 + level * 9) * p.damage); const from = jump ? [...hit].at(-2) : p;
        game.effects.push({ type: 'lightning', x: from.x, y: from.y, x2: target.x, y2: target.y, life: .16, maxLife: .16, color: UPGRADES.storm.accent }); target = nearestEnemy(target.x, target.y, hit);
      }
    }
  }
  if (game.upgrades.mines && game.lockedUpgrade !== 'mines') {
    game.mineClock -= dt;
    if (game.mineClock <= 0) {
      const level = game.upgrades.mines; game.mineClock = Math.max(1.15, 3.8 - level * .45);
      game.mines.push({ x: p.x, y: p.y, radius: 10, arm: .45, life: 10, level, pulse: 0 });
      const limit = 2 + level * 2; if (game.mines.length > limit) game.mines.shift();
    }
  }
  if (game.upgrades.frost && game.lockedUpgrade !== 'frost') {
    game.frostClock -= dt;
    if (game.frostClock <= 0) {
      const level = game.upgrades.frost; game.frostClock = Math.max(2.2, 4.2 - level * .35); const radius = 190 + level * 32;
      game.effects.push({ type: 'frost', x: p.x, y: p.y, radius, life: .7, maxLife: .7, color: UPGRADES.frost.accent });
      for (const enemy of game.enemies) if (distanceSq(p, enemy) < radius ** 2) { enemy.slow = game.fusions.has('glacier') ? 4 : 2.4; if (level >= 4 || game.fusions.has('glacier')) damageEnemy(enemy, (game.fusions.has('glacier') ? 34 : 18) * p.damage); }
    }
  }
  if (game.upgrades.recovery) {
    game.recoveryClock -= dt;
    if (game.recoveryClock <= 0) { game.recoveryClock = 18; healPlayer(game.upgrades.recovery === 1 ? 4 : 7); }
  }
}

function damageEnemy(enemy, amount, heavy = false) {
  if (!enemy || enemy.dead) return; const critical = Math.random() < game.upgrades.fortune * .06 + game.upgrades.focus * .07 + (game.classId === 'archer' && ++game.player.shotCount % 5 === 0 ? 1 : 0);
  let multiplier = 1 + game.upgrades.force * .08; if (game.specId === 'hunter' && (enemy.elite || enemy.bossData)) multiplier *= game.spec.eliteDamage * (1 + game.upgrades.preyMark * .15);
  if (game.specId === 'executioner' && enemy.hp < enemy.maxHp * .45) multiplier *= 1 + game.upgrades.severance * .1;
  const warder = game.enemies.find(other => other !== enemy && !other.dead && other.support === 'shield' && distanceSq(other, enemy) < 165 ** 2); if (warder) multiplier *= .72;
  if (enemy.forgeArmor > 0) multiplier *= .55;
  const critPower = 1.85 + game.upgrades.focus * .25 + (game.upgrades.force >= 4 ? .35 : 0); const dealt = amount * multiplier * (critical ? critPower : 1); enemy.hp -= dealt; enemy.hit = .1; game.numbers.push({ x: enemy.x, y: enemy.y - enemy.radius, text: Math.round(dealt), life: .55, color: critical ? '#f5c86f' : '#d7eee5', critical });
  if (critical && game.fusions.has('thunderhead')) { const target = nearestEnemy(enemy.x, enemy.y, new Set([enemy])); if (target && distanceSq(enemy, target) < 300 ** 2) { target.hp -= dealt * .32; game.effects.push({ type: 'lightning', x: enemy.x, y: enemy.y, x2: target.x, y2: target.y, life: .16, maxLife: .16, color: FUSIONS.thunderhead.accent }); if (target.hp <= 0) killEnemy(target); } }
  if (heavy) { const push = normalize(enemy.x - game.player.x, enemy.y - game.player.y); enemy.knockX += push.x * 160; enemy.knockY += push.y * 160; }
  if (enemy.hp <= 0) killEnemy(enemy); else audio.hit();
}

function killEnemy(enemy) {
  if (enemy.dead) return; enemy.dead = true; burst(enemy.x, enemy.y, enemy.color, enemy.bossData ? 38 : enemy.elite ? 22 : 9, enemy.bossData ? 2.5 : 1.3);
  if (enemy.objectiveTarget) { game.objectiveCount++; announce('ВРАТА РАЗРУШЕНЫ', `${game.objectiveCount} ИЗ 4`, 'Поток существ ослабевает.', 1300); return; }
  if (enemy.bossData) {
    save.bossKills[enemy.id] = (save.bossKills[enemy.id] || 0) + 1; const remaining = game.enemies.filter(other => other !== enemy && !other.dead && other.bossData); game.activeBoss = remaining[0] || null;
    if (game.activeBoss) { announce('СВЯЗЬ ОСЛАБЛА', 'ВТОРОЙ СИГНАЛ ЕЩЁ АКТИВЕН', 'Оставшийся страж перешёл в последнюю фазу.', 2100); game.activeBoss.bossPhase = 3; return; }
    ui.boss.classList.add('hidden');
    if (game.difficulty === 'hard' && game.stage.id === 'double-signal' && !game.secretSpawned) { game.secretSpawned = true; const secret = spawnBoss('crown'); secret.hp *= 1.35; secret.maxHp = secret.hp; announce('СКРЫТЫЙ ПРОТОКОЛ', 'КОРОНА ПОМНИТ ХАРД-РЕЖИМ', 'Последняя сигнатура вышла из Архива.', 2600); return; }
    if (game.stage.endless) { game.nextBossAt = Math.max(game.nextBossAt, game.time + 105); game.player.hp = Math.min(game.player.maxHp, game.player.hp + game.player.maxHp * .35); announce('СТРАЖ РАССЕЯН', 'РАЗЛОМ ПРОДОЛЖАЕТСЯ', 'Следующая волна уже помнит твою сборку.', 2300); audio.victory(); }
    else finishRun(true);
    return;
  }
  game.kills++; save.enemyKills[enemy.id] = (save.enemyKills[enemy.id] || 0) + 1; if (game.stage.objective === 'defense' && game.kills % 18 === 0) repairCore(); if (game.specId === 'executioner') game.player.momentum = Math.min(game.upgrades.momentum >= 2 ? 3 : 1, (game.player.momentum || 0) + 1);
  if (enemy.modifier === 'volatile') game.effects.push({ type: 'danger', x: enemy.x, y: enemy.y, radius: 72, warning: .65, pulse: 0, life: 2.2, maxLife: 2.2, color: '#e67b61' });
  if (enemy.elite) { game.elitesKilled++; if (game.upgrades.recovery >= 3) healPlayer(8); }
  const shardCount = enemy.elite ? 5 : enemy.xp >= 4 ? 2 : 1;
  for (let index = 0; index < shardCount; index++) game.shards.push({ x: enemy.x + (Math.random() - .5) * 18, y: enemy.y + (Math.random() - .5) * 18, radius: 4, value: enemy.xp / shardCount, age: 0, vx: (Math.random() - .5) * 45, vy: (Math.random() - .5) * 45 });
  rollDrop(enemy);
  audio.hit();
}

function repairCore() {
  const core = game.core;
  if (core.shield < core.maxShield) core.shield = Math.min(core.maxShield, core.shield + 28);
  else core.hp = Math.min(core.maxHp, core.hp + 8);
  game.effects.push({ type: 'block', x: core.x, y: core.y, radius: 82, life: .45, maxLife: .45, color: '#67e1c1' });
  game.numbers.push({ x: core.x, y: core.y - 58, text: '+ЗАЩИТА', life: .75, color: '#76e5c4' });
}

function rollDrop(enemy) {
  const bonus = 1 + (save.perks.salvage || 0) * .3 + game.upgrades.salvage * .5; const elite = enemy.elite;
  let type = Math.random() < (elite ? .055 : .0045) * bonus ? 'magnet' : Math.random() < (elite ? .17 : .012) * bonus ? 'scrap' : null;
  if (elite && game.upgrades.salvage >= 3) type ||= Math.random() < .7 ? 'scrap' : 'magnet';
  if (type) game.drops.push({ type, x: enemy.x, y: enemy.y, radius: 11, age: 0, phase: Math.random() * TAU, magnetized: false });
}

function damagePlayer(amount) {
  const p = game.player; if (p.invulnerable > 0 || game.ended) return;
  if (game.specId === 'guardian' && game.upgrades.aegis && p.blockCooldown <= 0) {
    p.blockCooldown = Math.max(8, 18 - game.upgrades.aegis * 2.5); p.invulnerable = .35; game.effects.push({ type: 'block', x: p.x, y: p.y, radius: 80 + game.upgrades.aegis * 20, life: .45, maxLife: .45, color: game.spec.accent });
    if (game.upgrades.aegis >= 2) for (const enemy of game.enemies) if (distanceSq(p, enemy) < 125 ** 2) damageEnemy(enemy, 32 * p.damage, true); audio.pulse(); return;
  }
  const damage = Math.max(1, amount * (1 - clamp(p.armor, 0, .55))); p.hp -= damage; p.invulnerable = .5; p.lastDamage = game.time;
  if (game.fusions.has('livingWall')) { game.effects.push({ type: 'thorns', x: p.x, y: p.y, radius: 125, life: .42, maxLife: .42, color: FUSIONS.livingWall.accent }); for (const enemy of game.enemies) if (distanceSq(p, enemy) < 135 ** 2) damageEnemy(enemy, 38 * p.damage, true); }
  game.camera.shake = 8; flash(.1, '#e66b5b'); audio.hurt(); if (p.hp <= 0) finishRun(false, 'Носитель потерян. Но найденные страницы и Эхо сохранены.');
}

function healPlayer(amount) { const p = game.player; const before = p.hp; const hardScale = game.difficulty === 'hard' ? .65 : 1; p.hp = Math.min(p.maxHp, p.hp + amount * hardScale); if (p.hp > before) game.numbers.push({ x: p.x, y: p.y - 24, text: `+${Math.round(p.hp - before)}`, life: .75, color: '#76e5b8' }); }

function burst(x, y, color, count = 8, force = 1) {
  const total = save.settings.effects ? count : Math.ceil(count / 3);
  for (let index = 0; index < total; index++) { const angle = Math.random() * TAU; const speed = (30 + Math.random() * 130) * force; game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .25 + Math.random() * .55, maxLife: .8, size: 1 + Math.random() * 3, color }); }
}

function update(dt) {
  if (!game || mode !== 'playing' || game.ended) return;
  dt = Math.min(dt, .034); game.time += dt; const p = game.player; const input = inputVector();
  p.dashCooldown = Math.max(0, p.dashCooldown - dt); p.abilityCooldown = Math.max(0, p.abilityCooldown - dt);
  p.blockCooldown = Math.max(0, p.blockCooldown - dt); p.momentum = Math.max(0, (p.momentum || 0) - dt * .18);
  game.invertControls = Math.max(0, game.invertControls - dt); game.lockedTimer = Math.max(0, game.lockedTimer - dt); if (!game.lockedTimer) game.lockedUpgrade = null;
  p.invulnerable = Math.max(0, p.invulnerable - dt); p.dashTime = Math.max(0, p.dashTime - dt); p.speedBoost = Math.max(0, p.speedBoost - dt);
  p.attackPose = Math.max(0, p.attackPose - dt); p.overdrive = Math.max(0, p.overdrive - dt); p.solarBoost = Math.max(0, (p.solarBoost || 0) - dt); p.step += dt * (input.length ? 8 : 2);
  if (input.length) { p.facing = Math.atan2(input.y, input.x); const multiplier = p.dashTime > 0 ? 4.1 : p.speedBoost > 0 ? 1.32 : 1; p.x += input.x * p.speed * multiplier * dt; p.y += input.y * p.speed * multiplier * dt; }
  updateObjective(dt);
  game.spawnClock -= dt;
  if (game.spawnClock <= 0 && game.enemies.length < 125) {
    const rank = stageRank(); const openPortals = game.stage.objective === 'portals' ? game.enemies.filter(enemy => enemy.objectiveTarget && !enemy.dead).length : 0; const batch = (game.time > 150 && Math.random() < .24 ? 2 : 1) + (openPortals && Math.random() < openPortals * .1 ? 1 : 0);
    for (let index = 0; index < batch; index++) spawnEnemy();
    game.spawnClock = spawnInterval(game.time) * Math.max(.55, 1.08 - rank * .055) * (game.activeBoss ? 1.9 : 1) * (game.stage.objective === 'defense' ? 1.28 : 1);
  }
  game.attackClock -= dt; if (game.attackClock <= 0) autoAttack(); updateSharedWeapons(dt);
  updateMines(dt); updateEffects(dt); updateProjectiles(dt); updateEnemies(dt); updateHostile(dt); updateShards(dt); updateDrops(dt); updateParticles(dt);
  updateHalo(dt); updateHud();
  game.camera.x += (p.x - game.camera.x) * Math.min(1, dt * 7); game.camera.y += (p.y - game.camera.y) * Math.min(1, dt * 7); game.camera.shake *= Math.pow(.02, dt);
}

function updateObjective(dt) {
  const { stage, player } = game; let lead = { survive: 26, seals: 34, hunt: 32, defense: 38, boss: 55, portals: 48, escort: 48, zone: 50, parts: 48, tracks: 55, twins: 62 }[stage.objective] || 30;
  if (game.difficulty === 'hard') lead += 28;
  if (stage.objective === 'seals') {
    for (const seal of game.seals) if (seal.charge < 1 && distanceSq(player, seal) < 82 ** 2) {
      seal.charge = Math.min(1, seal.charge + dt / 6); if (seal.charge === 1) { burst(seal.x, seal.y, stage.accent, 22, 1.6); announce('ПЕЧАТЬ ОТВЕЧАЕТ', `${game.seals.filter(item => item.charge >= 1).length} ИЗ 3`, 'Сигнал становится громче.', 1500); }
    }
  }
  if (stage.objective === 'hunt' && game.elitesSpawned < 3 && game.time >= game.nextElite) {
    game.elitesSpawned++; game.nextElite += stage.duration * .22; const elite = spawnEnemy(stage.enemies[(game.elitesSpawned - 1) % stage.enemies.length], { elite: true });
    game.effects.push({ type: 'mark', target: elite, life: 5, maxLife: 5, color: stage.accent }); announce('СИГНАТУРА ОБНАРУЖЕНА', `ЭЛИТА ${game.elitesSpawned} ИЗ 3`, 'Отмеченная цель несёт ключ к стражу.', 1700);
  }
  if (stage.objective === 'defense') {
    const core = game.core;
    if (game.time - core.lastDamage > 5) core.shield = Math.min(core.maxShield, core.shield + dt * (game.difficulty === 'hard' ? 8 : 14));
    if (core.hp <= 0) { finishRun(false, 'Искра погасла. Открытия сохранены, уровень можно повторить.'); return; }
  }
  if (stage.objective === 'escort') {
    const machine = game.escort; if (distanceSq(player, machine) < 230 ** 2) machine.progress = Math.min(1, machine.progress + dt / (stage.duration - lead - 18));
    machine.x = -560 + machine.progress * 1120; machine.y = Math.sin(machine.progress * Math.PI * 3) * 170;
    if (machine.hp <= 0) { finishRun(false, 'Древняя машина остановлена. Собранные записи сохранены.'); return; }
  }
  if (stage.objective === 'zone') {
    const zone = game.zone; zone.moveClock -= dt; if (distanceSq(player, zone) < zone.radius ** 2) zone.charge = Math.min(1, zone.charge + dt / 72);
    if (zone.moveClock <= 0) { const angle = Math.random() * TAU; zone.x = player.x + Math.cos(angle) * 360; zone.y = player.y + Math.sin(angle) * 360; zone.moveClock = 22; announce('МАЯК СМЕСТИЛСЯ', 'СЛЕДУЙ ЗА СВЕТОМ', 'Безопасная область уже движется.', 1400); }
  }
  if (stage.objective === 'parts') for (const part of game.parts) if (!part.found && distanceSq(player, part) < 38 ** 2) { part.found = true; game.objectiveCount++; burst(part.x, part.y, stage.accent, 18, 1.4); announce('ДЕТАЛЬ НАЙДЕНА', `${game.objectiveCount} ИЗ 4`, 'Механизм становится цельным.', 1200); }
  if (stage.objective === 'tracks') for (const track of game.tracks) if (!track.found && distanceSq(player, track) < 52 ** 2) { track.found = true; game.objectiveCount++; burst(track.x, track.y, stage.accent, 12, 1); announce('СЛЕД ВОССТАНОВЛЕН', `${game.objectiveCount} ИЗ 5`, game.objectiveCount === 5 ? 'Невидимый противник больше не скрывается.' : 'След ведёт дальше.', 1300); }
  if ((game.anomalyElite || game.signalElite) && !game.eventEliteSpawned && game.time > (game.signalElite ? 18 : 35)) { game.eventEliteSpawned = true; const elite = spawnEnemy(undefined, { elite: true }); game.effects.push({ type: 'mark', target: elite, life: 7, maxLife: 7, color: '#e7bd67' }); announce('ДОПОЛНИТЕЛЬНЫЙ СИГНАЛ', 'УСИЛЕННАЯ ЦЕЛЬ', 'Событие изменило состав уровня.', 1600); }
  updateHardRules(dt);
  if (stage.endless) {
    if (!game.activeBoss && game.time >= game.nextBossAt) { const ids = Object.keys(BOSSES); spawnBoss(ids[Math.floor(game.time / 180 - 1) % ids.length]); game.nextBossAt += 180; }
    return;
  }
  const requirement = stage.objective === 'seals' ? game.seals.every(seal => seal.charge >= 1)
    : stage.objective === 'hunt' ? game.elitesKilled >= 3 : stage.objective === 'defense' ? game.core.hp > 0
      : stage.objective === 'portals' || stage.objective === 'parts' ? game.objectiveCount >= 4 : stage.objective === 'escort' ? game.escort.progress >= 1
        : stage.objective === 'zone' ? game.zone.charge >= 1 : stage.objective === 'tracks' ? game.objectiveCount >= 5 : true;
  if (!game.bossSpawned && requirement && game.time >= stage.duration - lead) {
    if (stage.objective === 'twins') { spawnBoss('twinA'); spawnBoss('twinB', true); } else spawnBoss(stage.boss);
  }
  if (game.storyStep === 0 && game.time > stage.duration * .48) { game.storyStep = 1; announce('АРХИВ // ФРАГМЕНТ', '«КОРОНА НЕ ПРАВИТ»', 'Она лишь запоминает тех, кто пытался.', 2600); }
}

function updateHardRules(dt) {
  if (game.difficulty !== 'hard') return; game.hardHazardClock -= dt;
  if (game.hardHazardClock <= 0) {
    const p = game.player; game.hardHazardClock = 13 + Math.random() * 7; game.hazards.push({ x: p.x, y: p.y, radius: 92, warning: 1.25, life: 4.2, tick: 0 });
    game.effects.push({ type: 'warning', x: p.x, y: p.y, radius: 92, life: 1.25, maxLife: 1.25, color: '#df765e' });
  }
  for (const hazard of game.hazards) {
    hazard.warning -= dt; hazard.life -= dt; hazard.tick -= dt;
    if (hazard.warning <= 0 && hazard.tick <= 0 && distanceSq(hazard, game.player) < hazard.radius ** 2) { hazard.tick = .8; damagePlayer(9 + stageRank()); }
  }
  game.hazards = game.hazards.filter(hazard => hazard.life > 0);
}

function updateEnemies(dt) {
  const p = game.player; const coreTarget = game.stage.objective === 'defense' ? game.core : game.stage.objective === 'escort' ? game.escort : null;
  for (const enemy of game.enemies) {
    if (enemy.dead) continue; enemy.age += dt; enemy.spawn = Math.max(0, enemy.spawn - dt); enemy.hit = Math.max(0, enemy.hit - dt); enemy.contact -= dt; enemy.attack -= dt; enemy.charge -= dt; enemy.haloHit -= dt; enemy.slow = Math.max(0, enemy.slow - dt);
    if (enemy.objectiveTarget) continue;
    if (enemy.bossData) updateBoss(enemy, dt);
    if (enemy.support === 'repair') {
      enemy.supportClock -= dt; if (enemy.supportClock <= 0) { enemy.supportClock = 3.5; const target = game.enemies.find(other => other !== enemy && !other.dead && other.hp < other.maxHp && distanceSq(other, enemy) < 210 ** 2); if (target) { target.hp = Math.min(target.maxHp, target.hp + target.maxHp * .08); game.effects.push({ type: 'repair', x: enemy.x, y: enemy.y, x2: target.x, y2: target.y, life: .35, maxLife: .35, color: enemy.color }); } }
    }
    if (enemy.support === 'clone') {
      enemy.cloneClock -= dt; if (enemy.cloneClock <= 0 && game.enemies.length < 115) { enemy.cloneClock = 9; const copy = spawnEnemy(game.stage.enemies.find(id => id !== 'mirror') || 'husk'); copy.x = enemy.x + 30; copy.y = enemy.y + 20; copy.hp *= .42; copy.maxHp = copy.hp; copy.xp = 0; copy.support = null; copy.clone = true; }
    }
    let target = coreTarget || p;
    if (game.stage.objective === 'defense' && (!enemy.siege || enemy.ranged || enemy.bossData)) target = p;
    else if (coreTarget && distanceSq(enemy, p) < 190 ** 2) target = p;
    const direction = normalize(target.x - enemy.x, target.y - enemy.y); const commanded = game.enemies.some(other => other !== enemy && !other.dead && other.support === 'command' && distanceSq(other, enemy) < 190 ** 2); let speed = enemy.speed * (enemy.slow > 0 ? .48 : 1) * (commanded ? 1.2 : 1);
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
        game.hostile.push({ x: enemy.x, y: enemy.y, vx: Math.cos(shotAngle) * shotSpeed, vy: Math.sin(shotAngle) * shotSpeed, radius: enemy.bossData ? 7 : 5, damage: enemy.damage * .65, life: 4, color: enemy.color, targetCore: target === coreTarget, silence: enemy.support === 'silence' });
      }
    }
    if (circleHit(enemy, p) && enemy.contact <= 0) { enemy.contact = .8; damagePlayer(enemy.damage); const away = normalize(p.x - enemy.x, p.y - enemy.y); p.x += away.x * 18; p.y += away.y * 18; }
    if (coreTarget && target === coreTarget && circleHit(enemy, coreTarget) && enemy.contact <= 0) {
      enemy.contact = coreTarget === game.core ? 1.35 : 1; damageObjective(coreTarget, enemy.damage * (coreTarget === game.core ? .75 : 1));
      if (coreTarget === game.core) { const away = normalize(enemy.x - coreTarget.x, enemy.y - coreTarget.y); enemy.x += away.x * 28; enemy.y += away.y * 28; if (++enemy.siegeHits >= 2) enemy.siege = false; }
    }
  }
  game.enemies = game.enemies.filter(enemy => !enemy.dead);
}

function updateBoss(enemy, dt) {
  const ratio = enemy.hp / enemy.maxHp; const phase = ratio <= .33 ? 3 : ratio <= .66 ? 2 : 1;
  enemy.forgeArmor = Math.max(0, (enemy.forgeArmor || 0) - dt); enemy.patternClock -= dt;
  if (phase > enemy.bossPhase) { enemy.bossPhase = phase; enemy.patternClock = .4; announce(`ФАЗА ${phase} ИЗ 3`, enemy.bossData.name, phase === 2 ? 'Контур меняется. Следи за предупреждениями.' : 'Последний протокол активирован.', 1700); }
  if (enemy.pendingPattern !== undefined) { enemy.pendingPattern -= dt; if (enemy.pendingPattern <= 0) { delete enemy.pendingPattern; executeBossPattern(enemy); } }
  else if (enemy.patternClock <= 0) {
    enemy.patternClock = Math.max(3.4, 7.4 - enemy.bossPhase - (game.difficulty === 'hard' ? 1 : 0)); enemy.pendingPattern = 1.05;
    game.effects.push({ type: 'warning', x: enemy.x, y: enemy.y, radius: enemy.radius + 75, life: 1.05, maxLife: 1.05, color: enemy.color });
  }
}

function executeBossPattern(enemy) {
  const p = game.player; const id = enemy.id; game.camera.shake = 8;
  if (id === 'gardener') { for (let index = 0; index < 3 + enemy.bossPhase; index++) { const angle = index * TAU / (3 + enemy.bossPhase); game.effects.push({ type: 'danger', x: p.x + Math.cos(angle) * 150, y: p.y + Math.sin(angle) * 150, radius: 52, warning: .75, pulse: 0, life: 3.2, maxLife: 3.2, color: enemy.color }); } for (let index = 0; index < 2; index++) game.effects.push({ type: 'wall', x: p.x + (index ? 125 : -125), y: p.y, width: 250, horizontal: Boolean(index), warning: .8, pulse: 0, life: 3.8, maxLife: 3.8, color: enemy.color }); }
  else if (id === 'oracle') { game.invertControls = 2.2 + enemy.bossPhase * .35; announce('ИНВЕРСИЯ ДВИЖЕНИЯ', 'ОРИЕНТАЦИЯ НАРУШЕНА', 'Направления временно отражены.', 1200); }
  else if (id === 'librarian') { const active = Object.keys(game.upgrades).filter(key => game.upgrades[key] && UPGRADES[key].category === 'weapons'); game.lockedUpgrade = active[Math.floor(Math.random() * active.length)] || game.hero.primary; game.lockedTimer = 4 + enemy.bossPhase; toast(`ЗАБЛОКИРОВАНО: ${UPGRADES[game.lockedUpgrade].name.toUpperCase()}`); }
  else if (id === 'forgemaster') { enemy.forgeArmor = 5; enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * .04); game.effects.push({ type: 'block', x: enemy.x, y: enemy.y, radius: enemy.radius + 35, life: .8, maxLife: .8, color: enemy.color }); }
  else if (id === 'crown') mimicPlayerAttack(enemy);
  else {
    const count = 8 + enemy.bossPhase * 3; for (let index = 0; index < count; index++) { const angle = index * TAU / count + enemy.age; game.hostile.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 220, vy: Math.sin(angle) * 220, radius: 7, damage: enemy.damage * .55, life: 4, color: enemy.color }); }
  }
}

function mimicPlayerAttack(enemy) {
  const count = game.classId === 'archer' ? 9 : game.classId === 'mechanist' ? 12 : 7; const base = Math.atan2(game.player.y - enemy.y, game.player.x - enemy.x);
  for (let index = 0; index < count; index++) { const angle = game.classId === 'swordsman' ? index * TAU / count : base + (index - (count - 1) / 2) * .13; game.hostile.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 260, vy: Math.sin(angle) * 260, radius: 7, damage: enemy.damage * .6, life: 4, color: game.spec.accent }); }
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
      if (shot.kind === 'arrow' && game.specId === 'stormshot' && Math.random() < game.spec.chainChance + game.upgrades.voltage * .08) {
        const chained = nearestEnemy(enemy.x, enemy.y, shot.hits); if (chained && distanceSq(enemy, chained) < 260 ** 2) { shot.hits.add(chained); damageEnemy(chained, shot.damage * (.45 + game.upgrades.voltage * .12)); game.effects.push({ type: 'lightning', x: enemy.x, y: enemy.y, x2: chained.x, y2: chained.y, life: .15, maxLife: .15, color: game.spec.accent }); }
      }
      if (shot.kind === 'sphere' && game.specId === 'battlemage') {
        const radius = 58 + game.upgrades.detonation * 16; game.effects.push({ type: 'explosion', x: enemy.x, y: enemy.y, radius, life: .3, maxLife: .3, color: game.spec.accent });
        for (const other of game.enemies) if (other !== enemy && !other.dead && distanceSq(enemy, other) < radius ** 2) damageEnemy(other, shot.damage * (.32 + game.upgrades.detonation * .08));
      }
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
    if (circleHit(shot, p)) { shot.life = 0; damagePlayer(shot.damage); if (shot.silence) { p.abilityCooldown = Math.max(p.abilityCooldown, 3.5); toast('СПОСОБНОСТЬ ЗАГЛУШЕНА'); } }
    else { const target = game.stage.objective === 'defense' ? game.core : game.stage.objective === 'escort' ? game.escort : null; if (target && shot.targetCore && circleHit(shot, target)) { shot.life = 0; damageObjective(target, shot.damage * .7); } }
  }
  game.hostile = game.hostile.filter(shot => shot.life > 0);
}

function damageObjective(target, amount) {
  if (target === game.core) { absorbDamage(target, amount); target.lastDamage = game.time; }
  else target.hp = Math.max(0, target.hp - amount);
  game.camera.shake = 5;
}

function updateHalo(dt) {
  const level = game.upgrades.halo; if (!level || game.lockedUpgrade === 'halo') return; const count = (level >= 4 ? 3 : level >= 2 ? 2 : 1) + (game.player.solarBoost > 0 ? 1 : 0); const radius = 68 + level * 7;
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
    if ((game.fusions.has('choir') || game.fusions.has('mobileFoundry') || game.upgrades.turretKit) && mine.arm <= 0 && mine.pulse >= Math.max(.35, .9 - game.upgrades.turretKit * .14)) {
      mine.pulse = 0; const target = nearestEnemy(mine.x, mine.y); if (target && distanceSq(mine, target) < 380 ** 2) createProjectile(mine.x, mine.y, Math.atan2(target.y - mine.y, target.x - mine.x), { kind: 'needle', speed: 640, damage: (17 + game.upgrades.turretKit * 4) * game.player.damage, color: UPGRADES.mines.accent });
    }
    if (mine.arm <= 0) {
      const target = game.enemies.find(enemy => !enemy.dead && distanceSq(mine, enemy) < (48 + mine.level * 10) ** 2);
      if (target) {
        const radius = 78 + mine.level * 17; game.effects.push({ type: 'explosion', x: mine.x, y: mine.y, radius, life: .42, maxLife: .42, color: UPGRADES.mines.accent });
        for (const enemy of game.enemies) if (distanceSq(mine, enemy) < radius ** 2) damageEnemy(enemy, (34 + mine.level * 14) * game.player.damage, true);
        if (game.fusions.has('mobileFoundry') && Math.random() < .08) game.drops.push({ type: 'scrap', x: mine.x, y: mine.y, radius: 11, age: 0, phase: 0, magnetized: false }); mine.life = 0;
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
    if (effect.type === 'danger') {
      effect.warning -= dt; effect.pulse -= dt;
      if (effect.warning <= 0 && effect.pulse <= 0 && distanceSq(effect, game.player) < effect.radius ** 2) { effect.pulse = .75; damagePlayer(10 + stageRank() * 1.2); }
    }
    if (effect.type === 'wall') {
      effect.warning -= dt; effect.pulse -= dt; const p = game.player; const dx = Math.abs(p.x - effect.x); const dy = Math.abs(p.y - effect.y); const inside = effect.horizontal ? dx < effect.width / 2 && dy < 18 : dy < effect.width / 2 && dx < 18;
      if (effect.warning <= 0 && effect.pulse <= 0 && inside) { effect.pulse = .75; damagePlayer(11 + stageRank()); }
    }
  }
  game.effects = game.effects.filter(effect => effect.life > 0 && (!effect.target || !effect.target.dead));
}

function updateShards(dt) {
  const p = game.player;
  for (const shard of game.shards) {
    shard.age += dt; shard.x += shard.vx * dt; shard.y += shard.vy * dt; shard.vx *= Math.pow(.08, dt); shard.vy *= Math.pow(.08, dt);
    const d = Math.sqrt(distanceSq(shard, p)); if (shard.magnetized || d < p.magnet) { const pull = normalize(p.x - shard.x, p.y - shard.y); const speed = shard.magnetized ? 780 + Math.min(d, 900) : 210 + (p.magnet - d) * 3; shard.x += pull.x * speed * dt; shard.y += pull.y * speed * dt; }
    if (d < p.radius + 9) { shard.dead = true; addXp(shard.value * (game.upgrades.magnet >= 3 && Math.random() < .12 ? 2 : 1)); audio.pickup(); }
  }
  game.shards = game.shards.filter(shard => !shard.dead && (shard.magnetized || shard.age < 22));
}

function updateDrops(dt) {
  const p = game.player;
  for (const drop of game.drops) {
    drop.age += dt; const d = Math.sqrt(distanceSq(drop, p));
    if (drop.magnetized || d < p.magnet * .75) { const pull = normalize(p.x - drop.x, p.y - drop.y); const speed = drop.magnetized ? 720 + Math.min(d, 850) : 230; drop.x += pull.x * speed * dt; drop.y += pull.y * speed * dt; }
    if (d > p.radius + drop.radius + 4) continue; drop.dead = true;
    if (drop.type === 'magnet') {
      for (const shard of game.shards) shard.magnetized = true; for (const other of game.drops) if (other !== drop) other.magnetized = true;
      announce('МАГНИТ АКТИВИРОВАН', 'КАРТА ОТДАЁТ ВСЁ', 'Весь оставленный опыт и Scrap летят к носителю.', 1800);
    } else {
      const base = .24 + game.upgrades.salvage * .04 + game.upgrades.repairProtocol * .08; const spec = game.spec.scrapBonus || 1; healPlayer(p.maxHp * base * spec);
      if (game.upgrades.repairProtocol >= 3) game.mines.push({ x: p.x, y: p.y, radius: 10, arm: 0, life: 10, level: Math.max(1, game.upgrades.mines), pulse: 0 });
      toast(`SCRAP // +${Math.round(base * spec * 100)}% ЗДОРОВЬЯ`);
    }
    burst(drop.x, drop.y, drop.type === 'magnet' ? '#73c8ef' : '#e8b65e', 18, 1.6); audio.pickup();
  }
  game.drops = game.drops.filter(drop => !drop.dead && drop.age < 75);
}

function updateParticles(dt) {
  for (const particle of game.particles) { particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vx *= Math.pow(.08, dt); particle.vy *= Math.pow(.08, dt); }
  for (const number of game.numbers) { number.life -= dt; number.y -= dt * 32; }
  game.particles = game.particles.filter(particle => particle.life > 0); game.numbers = game.numbers.filter(number => number.life > 0);
}

function addXp(amount) {
  const p = game.player; const scale = (1 + game.upgrades.wisdom * .12 + (save.perks.learning || 0) * .05) * (game.xpScale || 1); p.xp += amount * scale;
  while (p.xp >= p.nextXp) { p.xp -= p.nextXp; p.level++; p.nextXp = xpForLevel(p.level); game.pendingLevels++; }
  if (game.pendingLevels > 0 && mode === 'playing') openUpgradeChoice();
}

function fusionReady(id, fusion) {
  if (game.fusions.has(id)) return false; if (fusion.classes && !fusion.classes.includes(game.classId)) return false;
  return fusion.recipe.every((part, index) => { const required = game.difficulty === 'hard' && index === 0 ? Math.min(UPGRADES[part].max, fusion.levels[index] + 1) : fusion.levels[index]; return game.upgrades[part] >= required; });
}

function openUpgradeChoice() {
  if (!game || !game.pendingLevels) return; const valid = Object.entries(UPGRADES).filter(([id, item]) => (!item.classes || item.classes.includes(game.classId)) && (!item.spec || item.spec === game.specId) && game.upgrades[id] < item.max).map(([id]) => id);
  const ready = Object.entries(FUSIONS).filter(([id, fusion]) => fusionReady(id, fusion)).map(([id]) => `fusion:${id}`);
  let choices = chooseUnique(valid, Math.max(0, 3 - Math.min(1, ready.length))); if (ready.length) choices.unshift(ready[0]); choices = choices.slice(0, 3);
  if (!choices.length) { game.pendingLevels = 0; return; }
  choiceActions = choices; ui.cards.innerHTML = ''; ui.choiceTitle.textContent = ready.length ? 'СЛИЯНИЕ ДОСТУПНО' : 'ВЫБЕРИ РЕЛИКВИЮ';
  choices.forEach((key, index) => {
    const fusionId = key.startsWith('fusion:') ? key.slice(7) : null; const data = fusionId ? FUSIONS[fusionId] : UPGRADES[key]; const level = fusionId ? 1 : game.upgrades[key] + 1;
    const button = document.createElement('button'); button.className = 'choice-card'; button.style.setProperty('--card-accent', data.accent);
    const category = data.category === 'artifacts' ? 'АРТЕФАКТ' : data.category === 'talents' ? 'ТАЛАНТ СПЕЦИАЛИЗАЦИИ' : 'ОРУЖИЕ';
    button.innerHTML = `<div class="choice-icon"><span>${data.icon}</span></div><small>${fusionId ? 'ЗАПРЕТНОЕ СЛИЯНИЕ' : `${category} // УРОВЕНЬ ${level}`}</small><h3>${data.name}</h3><p>${fusionId ? data.recipe.map(part => UPGRADES[part].name).join(' + ') : data.descriptions[level - 1]}</p><div class="level-pips">${Array.from({ length: fusionId ? 1 : data.max }, (_, pip) => `<i class="${pip < level ? 'on' : ''}"></i>`).join('')}</div>`;
    button.addEventListener('click', () => chooseUpgrade(index)); ui.cards.append(button);
  });
  audio.level(); setScreen('choice');
}

function chooseUpgrade(index) {
  const key = choiceActions[index]; if (!key || !game) return;
  if (key.startsWith('fusion:')) { const id = key.slice(7); game.fusions.add(id); unlockCodex('fusions', id); burst(game.player.x, game.player.y, FUSIONS[id].accent, 30, 2); }
  else {
    game.upgrades[key]++; unlockCodex('items', key); applyUpgradeStats(game, key);
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
  const fusion = FUSIONS[save.pinnedFusion]; ui.pinnedRecipe.classList.toggle('hidden', !fusion); if (fusion) { const parts = fusion.recipe.map((id, index) => `${UPGRADES[id].name}: ${game.upgrades[id]}/${fusion.levels[index]}`); ui.pinnedRecipe.innerHTML = `<strong>${fusion.name}</strong>${parts.join('<br>')}`; }
}

function missionState() {
  const stage = game.stage; const remaining = Math.max(0, stage.duration - game.time);
  if (stage.endless) return { text: `${formatTime(game.time)} // ВОЛНА ${1 + Math.floor(game.time / 60)}`, progress: game.time % 60 / 60 };
  if (game.activeBoss) return { text: `ПОБЕДИТЬ: ${game.activeBoss.bossData.name}`, progress: clamp(game.activeBoss.hp / game.activeBoss.maxHp, 0, 1) };
  if (stage.objective === 'seals') { const complete = game.seals.filter(seal => seal.charge >= 1).length; return { text: `ПЕЧАТИ ${complete}/3 // ${formatTime(remaining)}`, progress: game.seals.reduce((sum, seal) => sum + seal.charge, 0) / 3 }; }
  if (stage.objective === 'hunt') return { text: `ЭЛИТНЫЕ ЦЕЛИ ${game.elitesKilled}/3 // ${formatTime(remaining)}`, progress: game.elitesKilled / 3 };
  if (stage.objective === 'defense') return { text: `ИСКРА ${Math.ceil(game.core.hp / game.core.maxHp * 100)}% · ЩИТ ${Math.ceil(game.core.shield / game.core.maxShield * 100)}% // ${formatTime(remaining)}`, progress: clamp(game.core.hp / game.core.maxHp, 0, 1) };
  if (stage.objective === 'portals') return { text: `ПОРТАЛЫ ${game.objectiveCount}/4 // ${formatTime(remaining)}`, progress: game.objectiveCount / 4 };
  if (stage.objective === 'escort') return { text: `МАШИНА ${Math.ceil(game.escort.hp / game.escort.maxHp * 100)}% // ПУТЬ ${Math.floor(game.escort.progress * 100)}%`, progress: game.escort.progress };
  if (stage.objective === 'zone') return { text: `СВЕТ ${Math.floor(game.zone.charge * 100)}% // ${formatTime(remaining)}`, progress: game.zone.charge };
  if (stage.objective === 'parts') return { text: `ДЕТАЛИ ${game.objectiveCount}/4 // ${formatTime(remaining)}`, progress: game.objectiveCount / 4 };
  if (stage.objective === 'tracks') return { text: `СЛЕДЫ ${game.objectiveCount}/5 // ${formatTime(remaining)}`, progress: game.objectiveCount / 5 };
  if (stage.objective === 'twins') return { text: `${game.bossSpawned ? 'РАЗОРВАТЬ СВЯЗЬ' : 'ДОЖДАТЬСЯ ДВОЙНОГО СИГНАЛА'} // ${formatTime(remaining)}`, progress: clamp(game.time / stage.duration, 0, 1) };
  return { text: `${OBJECTIVES[stage.objective][0]} // ${formatTime(remaining)}`, progress: clamp(game.time / stage.duration, 0, 1) };
}

function updateHud() {
  const p = game.player; const mission = missionState(); ui.timer.textContent = game.stage.endless ? formatTime(game.time) : formatTime(Math.max(0, game.stage.duration - game.time));
  ui.level.textContent = p.level; ui.kills.textContent = game.kills; ui.health.style.width = `${clamp(p.hp / p.maxHp, 0, 1) * 100}%`;
  ui.healthText.textContent = `${Math.ceil(Math.max(0, p.hp))} / ${p.maxHp}`; ui.xp.style.width = `${p.xp / p.nextXp * 100}%`;
  ui.dash.querySelector('i').style.height = `${p.dashCooldown / 2.45 * 100}%`; ui.ability.querySelector('i').style.height = `${p.abilityCooldown / (game.classId === 'mage' ? 9 : game.classId === 'mechanist' ? 10 : 7.5) * 100}%`;
  ui.missionText.textContent = mission.text; ui.missionFill.style.width = `${clamp(mission.progress, 0, 1) * 100}%`;
  if (game.activeBoss) { const bosses = game.enemies.filter(enemy => !enemy.dead && enemy.bossData); const hp = bosses.reduce((sum, enemy) => sum + enemy.hp, 0); const maxHp = bosses.reduce((sum, enemy) => sum + enemy.maxHp, 0); const ratio = clamp(hp / maxHp, 0, 1); ui.bossHealth.style.width = `${ratio * 100}%`; ui.bossHealthText.textContent = `${Math.ceil(ratio * 100)}% // ФАЗА ${Math.max(...bosses.map(enemy => enemy.bossPhase))}`; }
}

function finishRun(victory, reason = '') {
  if (!game || game.ended) return; game.ended = true; game.victory = victory; const rank = game.stage.endless ? 5 : game.stage.number;
  const baseReward = Math.floor(game.kills / 4 + rank * (victory ? 8 : 2)); const reward = Math.floor(baseReward * (1 + (save.perks.greed || 0) * .1) * game.rewardScale * (game.difficulty === 'hard' ? 1.35 : 1)); game.endReward = reward;
  save.echoes += reward; save.totalKills += game.kills; save.bestTime = Math.max(save.bestTime, Math.floor(game.time));
  if (victory && !game.stage.endless) {
    const list = game.difficulty === 'hard' ? save.hardCompletedStages : save.completedStages; if (!list.includes(game.stage.id)) list.push(game.stage.id);
    const key = `${game.difficulty}:${game.stage.id}`; save.stageTimes[key] = save.stageTimes[key] ? Math.min(save.stageTimes[key], Math.floor(game.time)) : Math.floor(game.time); save.pendingEvent = true;
  }
  if (victory && game.stage.id === 'double-signal' && game.difficulty === 'normal') save.campaignComplete = true;
  const items = Object.entries(game.upgrades).filter(([, level]) => level).sort((a, b) => b[1] - a[1]).slice(0, 8); save.builds.unshift({ classId: game.classId, specId: game.specId, stageId: game.stage.id, difficulty: game.difficulty, victory, time: Math.floor(game.time), kills: game.kills, items, fusions: [...game.fusions] }); save.builds = save.builds.slice(0, 12); persist(); refreshMetaUI();
  $('endEyebrow').textContent = victory ? 'СЕКТОР ОСВОБОЖДЁН' : 'НОСИТЕЛЬ ОТСТУПИЛ';
  $('endTitle').textContent = victory ? game.stage.id === 'double-signal' ? 'КАМПАНИЯ ВОССТАНОВЛЕНА' : 'МАРШРУТ ВОССТАНОВЛЕН' : 'АРХИВ СОХРАНИЛ ПАМЯТЬ';
  $('endText').textContent = reason || (victory ? game.stage.id === 'double-signal' ? 'Двенадцать секторов завершены. Бесконечный разлом теперь доступен.' : 'Выбери одно событие перед следующим сектором. Все открытия записаны в Книгу.' : 'Повтори уровень: валюта, Книга и постоянные улучшения не потеряны.');
  $('resultTime').textContent = formatTime(game.time); $('resultKills').textContent = game.kills; $('resultEchoes').textContent = `+${reward}`;
  $('nextStage').textContent = victory && !game.stage.endless ? 'ВЫБРАТЬ СОБЫТИЕ' : 'ВЕРНУТЬСЯ К КАРТЕ'; setScreen('end'); if (victory) audio.victory();
}

function quitToMenu() { game = null; ui.boss.classList.add('hidden'); refreshMetaUI(); setScreen('menu'); }
function pauseGame() { if (mode === 'playing') setScreen('pause'); else if (mode === 'pause') setScreen('playing'); }

function render(now) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#050b09'; ctx.fillRect(0, 0, width, height);
  if (!game) { drawAmbient(now / 1000); return; }
  const shake = save.settings.shake ? game.camera.shake : 0; const sx = (Math.random() - .5) * shake; const sy = (Math.random() - .5) * shake;
  ctx.save(); ctx.translate(width / 2 - game.camera.x + sx, height / 2 - game.camera.y + sy); drawFloor(); drawObjectives();
  for (const mine of game.mines) drawMine(mine); for (const shard of game.shards) drawShard(shard); for (const drop of game.drops) drawDrop(drop); for (const effect of game.effects) drawEffect(effect);
  const ordered = [...game.enemies].sort((a, b) => a.y - b.y); for (const enemy of ordered) drawEnemy(enemy);
  drawHalo(); drawPlayer(); for (const shot of game.projectiles) drawProjectile(shot, false); for (const shot of game.hostile) drawProjectile(shot, true);
  for (const particle of game.particles) { ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1); ctx.fillStyle = particle.color; ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size); }
  ctx.globalAlpha = 1; ctx.textAlign = 'center'; for (const number of game.numbers) { ctx.globalAlpha = clamp(number.life / .3, 0, 1); ctx.fillStyle = number.color; ctx.font = `${number.critical ? 800 : 600} ${number.critical ? 15 : 11}px Segoe UI`; ctx.fillText(number.text, number.x, number.y); } ctx.globalAlpha = 1; ctx.restore();
  const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * .22, width / 2, height / 2, Math.max(width, height) * .72); vignette.addColorStop(0, 'transparent'); vignette.addColorStop(1, 'rgba(0,0,0,.56)'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
  if (['playing', 'pause', 'choice'].includes(mode)) drawMinimap();
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
    const core = game.core; const ratio = clamp(core.hp / core.maxHp, 0, 1); const shield = clamp(core.shield / core.maxShield, 0, 1); ctx.save(); ctx.translate(core.x, core.y);
    ctx.strokeStyle = `rgba(103,225,193,${.12 + shield * .72})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 69, -Math.PI / 2, -Math.PI / 2 + TAU * shield); ctx.stroke(); ctx.rotate(game.time * .22);
    ctx.strokeStyle = `rgba(225,174,90,${.25 + ratio * .5})`; ctx.lineWidth = 2; for (let ring = 0; ring < 3; ring++) { ctx.rotate(ring * .45); ctx.strokeRect(-42 - ring * 9, -42 - ring * 9, 84 + ring * 18, 84 + ring * 18); }
    ctx.rotate(-game.time * .22); const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 48); glow.addColorStop(0, `rgba(255,225,145,${ratio})`); glow.addColorStop(1, 'transparent'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 48, 0, TAU); ctx.fill(); ctx.fillStyle = '#e3b45e'; ctx.font = '27px Bahnschrift Condensed'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✦', 0, 0); ctx.restore();
  }
  if (game.stage.objective === 'escort') drawMachine(game.escort);
  if (game.stage.objective === 'zone') { const zone = game.zone; ctx.save(); ctx.strokeStyle = `${game.stage.accent}99`; ctx.fillStyle = `${game.stage.accent}12`; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.radius + Math.sin(game.time * 3) * 4, 0, TAU); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = game.stage.accent; ctx.font = '22px Bahnschrift Condensed'; ctx.textAlign = 'center'; ctx.fillText('✦', zone.x, zone.y + 7); ctx.restore(); }
  if (game.stage.objective === 'parts') for (const part of game.parts) if (!part.found) { ctx.save(); ctx.translate(part.x, part.y); ctx.rotate(game.time); ctx.strokeStyle = game.stage.accent; ctx.fillStyle = '#0b1714'; ctx.lineWidth = 2; polygon(0, 0, 15, 8); ctx.fill(); ctx.stroke(); ctx.fillStyle = game.stage.accent; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill(); ctx.restore(); }
  if (game.stage.objective === 'tracks') for (const track of game.tracks) if (!track.found) { ctx.save(); ctx.translate(track.x, track.y); ctx.rotate(.3); ctx.fillStyle = `${game.stage.accent}88`; ctx.beginPath(); ctx.ellipse(-8, 0, 5, 11, 0, 0, TAU); ctx.ellipse(8, 15, 5, 11, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  for (const hazard of game.hazards) if (hazard.warning <= 0) { ctx.fillStyle = 'rgba(195,64,49,.12)'; ctx.strokeStyle = 'rgba(231,108,83,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hazard.x, hazard.y, hazard.radius, 0, TAU); ctx.fill(); ctx.stroke(); }
}

function drawMachine(machine) {
  const ratio = clamp(machine.hp / machine.maxHp, 0, 1); ctx.save(); ctx.translate(machine.x, machine.y); ctx.fillStyle = '#0d1b17'; ctx.strokeStyle = game.stage.accent; ctx.lineWidth = 2; ctx.fillRect(-30, -21, 60, 42); ctx.strokeRect(-30, -21, 60, 42); ctx.fillStyle = game.stage.accent; ctx.fillRect(-20, -5, 40 * ratio, 10);
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(side * 24, 24, 9, 0, TAU); ctx.fill(); } ctx.restore();
}

function drawPlayer() {
  const p = game.player; const hero = game.hero; const accent = game.spec.accent; const level = game.upgrades[hero.primary]; const bob = Math.sin(p.step) * 2; const moving = inputVector().length > .1;
  ctx.save(); ctx.translate(p.x, p.y + bob); ctx.rotate(p.facing + Math.PI / 2); const dashAlpha = p.dashTime > 0 ? .55 : 1; ctx.globalAlpha = dashAlpha;
  const aura = ctx.createRadialGradient(0, 0, 5, 0, 0, 55 + level * 2); aura.addColorStop(0, `${accent}30`); aura.addColorStop(1, 'transparent'); ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(0, 0, 55 + level * 2, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.ellipse(0, 14, 18, 8, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#263c35'; ctx.lineWidth = 5; ctx.lineCap = 'round'; const leg = moving ? Math.sin(p.step) * 4 : 0; ctx.beginPath(); ctx.moveTo(-5, 9); ctx.lineTo(-7 + leg, 20); ctx.moveTo(5, 9); ctx.lineTo(7 - leg, 20); ctx.stroke();
  ctx.fillStyle = '#101c19'; ctx.strokeStyle = accent; ctx.lineWidth = 1.4 + level * .08; ctx.beginPath(); ctx.moveTo(-13, 9); ctx.lineTo(-9, -13); ctx.lineTo(0, -20); ctx.lineTo(10, -12); ctx.lineTo(14, 10); ctx.lineTo(0, 17); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (game.classId === 'mage') { ctx.fillStyle = '#211b34'; ctx.beginPath(); ctx.moveTo(-17, 15); ctx.lineTo(-10, -12); ctx.lineTo(0, -19); ctx.lineTo(12, -10); ctx.lineTo(18, 16); ctx.lineTo(0, 10); ctx.closePath(); ctx.fill(); }
  if (game.classId === 'archer') { ctx.fillStyle = '#2a1c15'; ctx.beginPath(); ctx.moveTo(-15, 12); ctx.lineTo(-10, -12); ctx.lineTo(11, -11); ctx.lineTo(16, 13); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = '#d5c9ab'; ctx.beginPath(); ctx.arc(0, -17, 7, 0, TAU); ctx.fill(); ctx.fillStyle = '#111a17'; ctx.fillRect(-7, -20, 14, 4); ctx.fillStyle = accent; ctx.fillRect(-5, -19, 3, 1); ctx.fillRect(2, -19, 3, 1); ctx.font = '9px Bahnschrift Condensed'; ctx.textAlign = 'center'; ctx.fillText(game.spec.icon, 0, 8);
  const attack = p.attackPose > 0 ? .7 : 0;
  if (game.classId === 'swordsman') { const length = 27 + level * 6; ctx.save(); ctx.translate(11, -3); ctx.rotate(-.35 - attack); ctx.shadowBlur = level >= 4 ? 10 : 0; ctx.shadowColor = accent; ctx.strokeStyle = game.fusions.has('bulwark') ? FUSIONS.bulwark.accent : '#e7d9b3'; ctx.lineWidth = 3 + level * .22; ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(2, -length); ctx.stroke(); ctx.strokeStyle = accent; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-5 - level, 1); ctx.lineTo(7 + level, 1); ctx.stroke(); if (level >= 3) for (let rune = 0; rune < level - 1; rune++) ctx.fillRect(0, -11 - rune * 6, 3, 2); ctx.restore(); }
  if (game.classId === 'archer') { const size = 16 + level * 2; ctx.strokeStyle = accent; ctx.lineWidth = 2 + level * .12; ctx.beginPath(); ctx.arc(12, -5, size, -1.2, 1.2); ctx.stroke(); if (level >= 3) { ctx.strokeStyle = `${accent}88`; ctx.beginPath(); ctx.arc(12, -5, size + 5, -1, 1); ctx.stroke(); } ctx.strokeStyle = '#c7d8c9'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(18, -5 - size); ctx.lineTo(18 - attack * 11, -5 + size); ctx.stroke(); }
  if (game.classId === 'mage') { const float = Math.sin(game.time * 3) * 4; ctx.save(); ctx.translate(7 + level * 2, float); ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(12, 9); ctx.lineTo(17, -29 - level * 2); ctx.stroke(); ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(17, -31 - level * 2, 5 + level * .7 + Math.sin(game.time * 7), 0, TAU); ctx.fill(); if (level >= 3) { ctx.strokeStyle = `${accent}aa`; ctx.beginPath(); ctx.arc(17, -31 - level * 2, 10 + level, game.time * 2, game.time * 2 + Math.PI * 1.4); ctx.stroke(); } ctx.restore(); }
  if (game.classId === 'mechanist') { ctx.fillStyle = '#334b43'; ctx.fillRect(7, -13, 9 + level, 25); ctx.strokeStyle = accent; ctx.strokeRect(8, -12, 7 + level, 23); if (level >= 3) { ctx.fillStyle = accent; ctx.fillRect(10, -8, 2, 14); ctx.fillRect(14, -6, 2, 10); } }
  ctx.restore();
  if (game.classId === 'mechanist') drawDrones();
}

function drawDrones() {
  const p = game.player; const count = droneCount(); const level = game.upgrades.repeater; const size = 6 + level * .8;
  for (let index = 0; index < count; index++) { const angle = p.step * 2 + index * TAU / count; const x = p.x + Math.cos(angle) * (28 + level * 2); const y = p.y + Math.sin(angle) * (28 + level * 2); ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = '#10231e'; ctx.strokeStyle = game.spec.accent; ctx.lineWidth = 1.3; polygon(0, 0, size, level >= 4 ? 8 : 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = game.spec.accent; ctx.fillRect(-2, -2, 4, 4); if (level >= 3) { ctx.strokeStyle = `${game.spec.accent}88`; ctx.beginPath(); ctx.moveTo(-size - 4, 0); ctx.lineTo(size + 4, 0); ctx.stroke(); } ctx.restore(); }
}

function drawEnemy(enemy) {
  const scale = enemy.spawn > 0 ? 1 - enemy.spawn / .35 : 1; const bob = Math.sin(enemy.age * 5 + enemy.phase) * (enemy.shape === 'wisp' ? 5 : 2);
  ctx.save(); ctx.translate(enemy.x, enemy.y + bob); ctx.scale(scale, scale); if (enemy.elite) { ctx.strokeStyle = `${enemy.color}88`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, enemy.radius + 9 + Math.sin(game.time * 4) * 2, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,0,0,.48)'; ctx.beginPath(); ctx.ellipse(0, enemy.radius * .72, enemy.radius * .95, enemy.radius * .38, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = enemy.hit > 0 ? .72 : 1; if (enemy.bossData) drawBoss(enemy); else drawEnemyShape(enemy); ctx.globalAlpha = 1;
  if (enemy.elite || enemy.siege) { ctx.fillStyle = enemy.elite ? '#edc06e' : '#ef9858'; ctx.font = 'bold 10px Segoe UI'; ctx.textAlign = 'center'; ctx.fillText(enemy.elite ? '◆' : '▼', 0, -enemy.radius - 12); }
  if (enemy.elite || enemy.bossData) { ctx.fillStyle = '#17211d'; ctx.fillRect(-enemy.radius, enemy.radius + 8, enemy.radius * 2, 3); ctx.fillStyle = enemy.color; ctx.fillRect(-enemy.radius, enemy.radius + 8, enemy.radius * 2 * clamp(enemy.hp / enemy.maxHp, 0, 1), 3); }
  ctx.restore();
}

function drawEnemyShape(enemy) {
  const r = enemy.radius; const c = enemy.hit > 0 ? '#effff8' : enemy.color; ctx.strokeStyle = c; ctx.fillStyle = '#101916'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  if (enemy.shape === 'portal') { ctx.save(); ctx.rotate(game.time * .45); ctx.lineWidth = 3; for (let ring = 0; ring < 3; ring++) { ctx.rotate(.35); polygon(0, 0, r - ring * 7, 6 + ring); ctx.stroke(); } ctx.fillStyle = `${c}66`; ctx.beginPath(); ctx.arc(0, 0, 9 + Math.sin(game.time * 4) * 2, 0, TAU); ctx.fill(); ctx.restore(); return; }
  if (enemy.shape === 'wisp') { ctx.fillStyle = `${c}55`; ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 1.2, 0, 0, r); ctx.quadraticCurveTo(-r * 1.2, 0, 0, -r); ctx.fill(); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, -2, 3.5, 0, TAU); ctx.fill(); return; }
  if (enemy.shape === 'drone') { polygon(0, 0, r, 6); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r * 1.5, 0); ctx.lineTo(r * 1.5, 0); ctx.stroke(); ctx.fillStyle = c; ctx.fillRect(-4, -2, 8, 4); return; }
  if (enemy.shape === 'charger') { ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, -r * .2); ctx.lineTo(r * .7, r); ctx.lineTo(-r * .7, r); ctx.lineTo(-r, -.2 * r); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(-r * .45, -r * .25); ctx.lineTo(r * .45, -r * .25); ctx.stroke(); return; }
  if (enemy.shape === 'brute') { ctx.fillRect(-r * .76, -r * .72, r * 1.52, r * 1.55); ctx.strokeRect(-r * .76, -r * .72, r * 1.52, r * 1.55); ctx.fillStyle = c; ctx.fillRect(-r * .5, -r * .4, r, 3); ctx.fillRect(-r * .65, r * .1, r * .25, r * .45); ctx.fillRect(r * .4, r * .1, r * .25, r * .45); return; }
  if (enemy.shape === 'seer') { ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, r); ctx.lineTo(-r, r); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, -r * .12, r * .45, r * .2, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#09110f'; ctx.beginPath(); ctx.arc(0, -r * .12, 3, 0, TAU); ctx.fill(); return; }
  if (enemy.shape === 'hound') { ctx.beginPath(); ctx.moveTo(-r, -r * .35); ctx.lineTo(r * .5, -r * .55); ctx.lineTo(r, r * .15); ctx.lineTo(r * .3, r * .55); ctx.lineTo(-r * .8, r * .4); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r * .5, r * .35); ctx.lineTo(-r * .8, r); ctx.moveTo(r * .35, r * .35); ctx.lineTo(r * .65, r); ctx.stroke(); ctx.fillStyle = c; ctx.fillRect(r * .35, -r * .25, 3, 3); return; }
  if (enemy.shape === 'sentinel') { ctx.save(); ctx.rotate(Math.PI / 4); ctx.fillRect(-r * .7, -r * .7, r * 1.4, r * 1.4); ctx.strokeRect(-r * .7, -r * .7, r * 1.4, r * 1.4); ctx.restore(); ctx.fillStyle = c; ctx.fillRect(-r * .45, -2, r * .9, 4); return; }
  if (enemy.shape === 'scribe') { ctx.beginPath(); ctx.moveTo(-r, -r * .6); ctx.lineTo(0, -r * .25); ctx.lineTo(r, -r * .6); ctx.lineTo(r * .85, r * .75); ctx.lineTo(0, r * .45); ctx.lineTo(-r * .85, r * .75); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(0, -r * .25); ctx.lineTo(0, r * .45); ctx.stroke(); return; }
  if (enemy.shape === 'warder') { ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * .85, -r * .55); ctx.lineTo(r * .68, r * .62); ctx.lineTo(0, r); ctx.lineTo(-r * .68, r * .62); ctx.lineTo(-r * .85, -r * .55); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = `${c}88`; ctx.beginPath(); ctx.arc(0, 0, r + 6, -2.4, .9); ctx.stroke(); return; }
  if (enemy.shape === 'repairer') { polygon(0, 0, r, 6); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r * 1.7, -r * .3); ctx.lineTo(-r * .55, 0); ctx.lineTo(-r * 1.5, r * .55); ctx.moveTo(r * 1.7, -r * .3); ctx.lineTo(r * .55, 0); ctx.lineTo(r * 1.5, r * .55); ctx.stroke(); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill(); return; }
  if (enemy.shape === 'conductor') { ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * .8, r * .8); ctx.lineTo(-r * .8, r * .8); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * .55, game.time, game.time + Math.PI * 1.4); ctx.stroke(); ctx.fillStyle = c; ctx.fillRect(-2, -r * .45, 4, r * .9); return; }
  if (enemy.shape === 'silencer') { ctx.fillRect(-r * .7, -r * .7, r * 1.4, r * 1.4); ctx.strokeRect(-r * .7, -r * .7, r * 1.4, r * 1.4); ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(-r * .45, -r * .45); ctx.lineTo(r * .45, r * .45); ctx.moveTo(r * .45, -r * .45); ctx.lineTo(-r * .45, r * .45); ctx.stroke(); return; }
  if (enemy.shape === 'mirror') { ctx.save(); ctx.rotate(Math.PI / 4); ctx.fillRect(-r * .65, -r * .65, r * 1.3, r * 1.3); ctx.strokeRect(-r * .65, -r * .65, r * 1.3, r * 1.3); ctx.restore(); ctx.strokeStyle = `${c}99`; ctx.beginPath(); ctx.moveTo(0, -r * .8); ctx.lineTo(0, r * .8); ctx.stroke(); return; }
  ctx.beginPath(); ctx.moveTo(-r * .75, r); ctx.lineTo(-r * .58, -r * .3); ctx.lineTo(-r * .35, -r); ctx.lineTo(r * .35, -r); ctx.lineTo(r * .62, -r * .28); ctx.lineTo(r * .76, r); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = c; ctx.fillRect(-r * .42, -r * .54, r * .84, 3);
}

function drawBoss(enemy) {
  const r = enemy.radius; const c = enemy.hit > 0 ? '#fff4d4' : enemy.color; ctx.save(); ctx.rotate(enemy.age * .12); ctx.strokeStyle = `${c}88`; ctx.lineWidth = 2;
  for (let ring = 0; ring < 2 + enemy.bossPhase; ring++) { ctx.rotate((ring ? -1 : 1) * enemy.age * .04); ctx.beginPath(); const points = 8 + ring * 2; for (let point = 0; point < points; point++) { const angle = point * TAU / points; const distance = r + 9 + ring * 8 + Math.sin(enemy.age * 2 + point) * 3; point ? ctx.lineTo(Math.cos(angle) * distance, Math.sin(angle) * distance) : ctx.moveTo(Math.cos(angle) * distance, Math.sin(angle) * distance); } ctx.closePath(); ctx.stroke(); }
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
  const level = game.upgrades.halo; if (!level || game.lockedUpgrade === 'halo') return; const count = (level >= 4 ? 3 : level >= 2 ? 2 : 1) + (game.player.solarBoost > 0 ? 1 : 0); const radius = 68 + level * 7;
  ctx.strokeStyle = 'rgba(225,174,90,.13)'; ctx.beginPath(); ctx.arc(game.player.x, game.player.y, radius, 0, TAU); ctx.stroke();
  for (let index = 0; index < count; index++) { const angle = game.time * (1.7 + level * .06) + index * TAU / count; const x = game.player.x + Math.cos(angle) * radius; const y = game.player.y + Math.sin(angle) * radius; ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = UPGRADES.halo.accent; ctx.shadowBlur = 14; ctx.shadowColor = UPGRADES.halo.accent; polygon(0, 0, 8, 4); ctx.fill(); ctx.restore(); }
}

function drawMine(mine) { ctx.save(); ctx.translate(mine.x, mine.y); ctx.rotate(game.time * .8); ctx.strokeStyle = mine.arm <= 0 ? UPGRADES.mines.accent : '#60554f'; ctx.fillStyle = '#151512'; ctx.lineWidth = 2; polygon(0, 0, 11, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = mine.arm <= 0 ? UPGRADES.mines.accent : '#4b4b46'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill(); ctx.restore(); }
function drawShard(shard) { const pulse = 1 + Math.sin(shard.age * 7) * .17; ctx.save(); ctx.translate(shard.x, shard.y); ctx.rotate(shard.age * 2); ctx.scale(pulse, pulse); ctx.fillStyle = '#67e1c1'; ctx.shadowBlur = 10; ctx.shadowColor = '#67e1c1'; polygon(0, 0, 4, 4); ctx.fill(); ctx.restore(); }
function drawDrop(drop) {
  const color = drop.type === 'magnet' ? '#72c8ef' : '#e8b65e'; const pulse = 1 + Math.sin(drop.age * 5 + drop.phase) * .12; ctx.save(); ctx.translate(drop.x, drop.y); ctx.scale(pulse, pulse); ctx.shadowBlur = 18; ctx.shadowColor = color; ctx.strokeStyle = color; ctx.fillStyle = '#0d1715'; ctx.lineWidth = 2;
  if (drop.type === 'magnet') { ctx.beginPath(); ctx.arc(0, 0, 11, .15, Math.PI - .15); ctx.stroke(); ctx.fillStyle = color; ctx.fillRect(-12, -1, 5, 7); ctx.fillRect(7, -1, 5, 7); }
  else { ctx.rotate(drop.age * .7); polygon(0, 0, 12, 8); ctx.fill(); ctx.stroke(); ctx.fillStyle = color; ctx.fillRect(-3, -3, 6, 6); } ctx.restore();
}

function drawMinimap() {
  const size = width < 720 ? 112 : 148; const x = width - size - (width < 720 ? 13 : 28); const y = width < 720 ? 102 : 79; const range = 1050 * (1 + (save.perks.cartography || 0) * .12); const inner = size - 18; const p = game.player;
  ctx.save(); ctx.fillStyle = 'rgba(4,11,9,.82)'; ctx.strokeStyle = 'rgba(132,190,169,.28)'; ctx.lineWidth = 1; ctx.fillRect(x, y, size, size); ctx.strokeRect(x + .5, y + .5, size - 1, size - 1); ctx.beginPath(); ctx.rect(x + 6, y + 6, size - 12, size - 24); ctx.clip();
  ctx.strokeStyle = 'rgba(116,164,146,.12)'; ctx.beginPath(); ctx.moveTo(x + size / 2, y + 6); ctx.lineTo(x + size / 2, y + size - 18); ctx.moveTo(x + 6, y + (size - 12) / 2); ctx.lineTo(x + size - 6, y + (size - 12) / 2); ctx.stroke();
  const plot = (point, color, radius, square = false) => { const dx = clamp((point.x - p.x) / range, -.5, .5) * inner; const dy = clamp((point.y - p.y) / range, -.5, .5) * inner; const px = x + size / 2 + dx; const py = y + (size - 12) / 2 + dy; ctx.fillStyle = color; if (square) ctx.fillRect(px - radius, py - radius, radius * 2, radius * 2); else { ctx.beginPath(); ctx.arc(px, py, radius, 0, TAU); ctx.fill(); } };
  for (const drop of game.drops) plot(drop, drop.type === 'magnet' ? '#72c8ef' : '#e8b65e', 2.8, drop.type === 'scrap');
  for (const enemy of game.enemies) if (enemy.bossData || enemy.elite || enemy.objectiveTarget || enemy.siege) plot(enemy, enemy.bossData ? '#ee725f' : enemy.siege ? '#ef9858' : enemy.objectiveTarget ? game.stage.accent : '#e8bd65', enemy.bossData ? 4 : 2.5, enemy.elite || enemy.siege);
  if (game.stage.objective === 'escort') plot(game.escort, game.stage.accent, 3, true); if (game.stage.objective === 'zone') plot(game.zone, game.stage.accent, 3);
  ctx.fillStyle = game.spec.accent; ctx.translate(x + size / 2, y + (size - 12) / 2); ctx.rotate(p.facing); ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.save(); ctx.fillStyle = '#72877e'; ctx.font = '700 6px Segoe UI'; ctx.textAlign = 'left'; ctx.fillText('КАРТА · XP СКРЫТ', x + 7, y + size - 6); ctx.restore();
}

function drawEffect(effect) {
  const t = clamp(effect.life / effect.maxLife, 0, 1); ctx.save(); ctx.globalAlpha = Math.min(1, t * 2); ctx.strokeStyle = effect.color || '#67e1c1'; ctx.fillStyle = effect.color || '#67e1c1';
  if (effect.type === 'slash') { const progress = 1 - t; ctx.lineWidth = 3 + t * 4; ctx.beginPath(); if (effect.full) ctx.arc(effect.x, effect.y, effect.radius * (.8 + progress * .2), effect.angle, effect.angle + TAU * progress); else ctx.arc(effect.x, effect.y, effect.radius, effect.angle - 1.05, effect.angle - 1.05 + 2.1 * Math.min(1, progress * 2)); ctx.stroke(); }
  else if (effect.type === 'lightning') { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(effect.x, effect.y); const segments = 6; for (let i = 1; i < segments; i++) { const p = i / segments; ctx.lineTo(effect.x + (effect.x2 - effect.x) * p + (Math.random() - .5) * 12, effect.y + (effect.y2 - effect.y) * p + (Math.random() - .5) * 12); } ctx.lineTo(effect.x2, effect.y2); ctx.stroke(); }
  else if (effect.type === 'rift') { ctx.translate(effect.x, effect.y); ctx.rotate(game.time * .6); ctx.lineWidth = 2; for (let ring = 0; ring < 3; ring++) { ctx.beginPath(); ctx.ellipse(0, 0, effect.radius * (1 - ring * .18), effect.radius * (.35 + ring * .06), ring * .7, 0, TAU); ctx.stroke(); } }
  else if (effect.type === 'thorns') { ctx.translate(effect.x, effect.y); ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 24; i++) { const angle = i * TAU / 24; const outer = i % 2 ? effect.radius : effect.radius * .76; const x = Math.cos(angle) * outer; const y = Math.sin(angle) * outer; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.stroke(); }
  else if (effect.type === 'frost' || effect.type === 'explosion' || effect.type === 'overdrive') { const progress = 1 - t; ctx.lineWidth = 3 * t; ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius * progress, 0, TAU); ctx.stroke(); if (effect.type === 'explosion') { ctx.globalAlpha *= .11; ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius * progress, 0, TAU); ctx.fill(); } }
  else if (effect.type === 'warning') { ctx.lineWidth = 2 + (1 - t) * 4; ctx.setLineDash([8, 7]); ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius * (1.25 - (1 - t) * .25), 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  else if (effect.type === 'danger') { ctx.globalAlpha = effect.warning > 0 ? .18 : .32 * t; ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius, 0, TAU); ctx.fill(); ctx.globalAlpha = .8 * t; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius, 0, TAU); ctx.stroke(); }
  else if (effect.type === 'wall') { ctx.globalAlpha = effect.warning > 0 ? .28 : .7 * t; ctx.lineWidth = effect.warning > 0 ? 2 : 9; ctx.setLineDash(effect.warning > 0 ? [9, 7] : []); ctx.beginPath(); if (effect.horizontal) { ctx.moveTo(effect.x - effect.width / 2, effect.y); ctx.lineTo(effect.x + effect.width / 2, effect.y); } else { ctx.moveTo(effect.x, effect.y - effect.width / 2); ctx.lineTo(effect.x, effect.y + effect.width / 2); } ctx.stroke(); ctx.setLineDash([]); }
  else if (effect.type === 'block') { ctx.lineWidth = 4 * t; ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius * (1.2 - t * .2), 0, TAU); ctx.stroke(); }
  else if (effect.type === 'repair') { ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(effect.x, effect.y); ctx.lineTo(effect.x2, effect.y2); ctx.stroke(); ctx.setLineDash([]); }
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
  $('hardState').textContent = save.hardCompletedStages.length ? `ОСВОЕНО ${save.hardCompletedStages.length}/12` : 'НОВЫЕ ПРАВИЛА';
  $('volume').value = save.settings.volume; $('shake').checked = save.settings.shake; $('effects').checked = save.settings.effects;
}

$('campaignButton').addEventListener('click', () => { difficulty = 'normal'; selectedStage = STAGES.find(stage => isStageUnlocked(stage) && !save.completedStages.includes(stage.id)) || STAGES.find(isStageUnlocked); audio.start(); audio.click(); setScreen('campaign'); });
$('hardButton').addEventListener('click', () => { difficulty = 'hard'; selectedStage = STAGES.find(stage => isStageUnlocked(stage) && !save.hardCompletedStages.includes(stage.id)) || STAGES.find(isStageUnlocked); audio.start(); audio.click(); setScreen('campaign'); });
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
$('again').addEventListener('click', startGame); $('nextStage').addEventListener('click', () => { const showEvent = game?.victory && !game.stage.endless && save.pendingEvent; game = null; ui.boss.classList.add('hidden'); setScreen(showEvent ? 'event' : 'campaign'); });
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
