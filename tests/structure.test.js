import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { BOSSES, CLASSES, ENEMIES, EVENTS, FUSIONS, META_PERKS, SPECIALIZATIONS, STAGES, UPGRADES } from '../src/data.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/game.js', import.meta.url), 'utf8');

test('every DOM reference in the game exists in index.html', () => {
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]));
  const references = new Set([...source.matchAll(/\$\('([^']+)'\)/g)].map(match => match[1]));
  assert.deepEqual([...references].filter(id => !ids.has(id)), []);
});

test('index.html does not contain duplicate ids', () => {
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test('content definitions are complete and internally consistent', () => {
  assert.equal(Object.keys(CLASSES).length, 4);
  assert.equal(STAGES.filter(stage => !stage.future).length, 12);
  assert.equal(Object.values(SPECIALIZATIONS).flatMap(Object.values).length, 8);
  assert.equal(Object.keys(EVENTS).length, 6);
  assert.equal(Object.keys(META_PERKS).length, 9);
  assert.ok(STAGES.some(stage => stage.requiresAny?.length === 2), 'campaign must contain a branch merge');
  for (const [classId, specs] of Object.entries(SPECIALIZATIONS)) { assert.ok(CLASSES[classId]); assert.equal(Object.keys(specs).length, 2); }
  for (const upgrade of Object.values(UPGRADES)) {
    assert.equal(upgrade.descriptions.length, upgrade.max);
    if (upgrade.spec) assert.ok(upgrade.classes?.some(classId => SPECIALIZATIONS[classId]?.[upgrade.spec]), `invalid specialization talent: ${upgrade.name}`);
  }
  for (const fusion of Object.values(FUSIONS)) {
    assert.equal(fusion.recipe.length, 2);
    assert.ok(fusion.recipe.every(id => UPGRADES[id]), `invalid fusion recipe: ${fusion.name}`);
    assert.ok(fusion.recipe.every((id, index) => fusion.levels[index] <= UPGRADES[id].max), `unreachable fusion: ${fusion.name}`);
  }
  const objectives = new Set(['survive', 'seals', 'hunt', 'defense', 'boss', 'portals', 'escort', 'zone', 'parts', 'tracks', 'twins']);
  for (const stage of STAGES.filter(stage => !stage.future)) {
    assert.ok(stage.duration >= 180 && stage.duration <= 360);
    assert.ok(objectives.has(stage.objective));
    assert.ok(stage.enemies.every(id => ENEMIES[id]));
    assert.ok(BOSSES[stage.boss]);
  }
});

test('all class portraits and static entrypoints exist', () => {
  const paths = ['../styles.css', '../src/game.js', ...Object.values(CLASSES).map(hero => `../${hero.image}`)];
  for (const path of paths) assert.equal(existsSync(new URL(path, import.meta.url)), true, `${path} is missing`);
});

test('campaign modes and expanded archive are visible in the interface', () => {
  assert.match(html, /id="hardButton"/);
  assert.doesNotMatch(html, /id="hardButton"[^>]*disabled/);
  assert.match(html, /id="endlessButton"/);
  assert.match(html, /data-tab="builds"/);
  assert.match(html, /id="specCards"/);
  assert.match(html, /id="eventCards"/);
});

test('minimap deliberately renders important markers without iterating experience', () => {
  const minimap = source.slice(source.indexOf('function drawMinimap'), source.indexOf('function drawEffect'));
  assert.match(minimap, /game\.drops/);
  assert.match(minimap, /enemy\.bossData \|\| enemy\.elite/);
  assert.doesNotMatch(minimap, /game\.shards/);
});
