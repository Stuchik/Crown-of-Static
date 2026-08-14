import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { BOSSES, CLASSES, ENEMIES, FUSIONS, STAGES, UPGRADES } from '../src/data.js';

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
  assert.equal(STAGES.filter(stage => !stage.future).length, 6);
  assert.ok(STAGES.some(stage => stage.requiresAny?.length === 2), 'campaign must contain a branch merge');
  for (const upgrade of Object.values(UPGRADES)) assert.equal(upgrade.descriptions.length, upgrade.max);
  for (const fusion of Object.values(FUSIONS)) {
    assert.equal(fusion.recipe.length, 2);
    assert.ok(fusion.recipe.every(id => UPGRADES[id]), `invalid fusion recipe: ${fusion.name}`);
  }
  for (const stage of STAGES.filter(stage => !stage.future)) {
    assert.ok(stage.duration >= 180 && stage.duration <= 360);
    assert.ok(stage.enemies.every(id => ENEMIES[id]));
    assert.ok(BOSSES[stage.boss]);
  }
});

test('all class portraits and static entrypoints exist', () => {
  const paths = ['../styles.css', '../src/game.js', ...Object.values(CLASSES).map(hero => `../${hero.image}`)];
  for (const path of paths) assert.equal(existsSync(new URL(path, import.meta.url)), true, `${path} is missing`);
});

test('locked future modes are visible in the interface', () => {
  assert.match(html, /id="hardButton"[^>]*disabled/);
  assert.match(html, /В РАЗРАБОТКЕ/);
  assert.match(html, /id="endlessButton"/);
});
