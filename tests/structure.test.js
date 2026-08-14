import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { BOSS_GIFTS, UPGRADES } from '../src/data.js';

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

test('upgrade definitions contain one description per level', () => {
  for (const upgrade of Object.values(UPGRADES)) assert.equal(upgrade.descriptions.length, upgrade.max);
  assert.equal(Object.keys(BOSS_GIFTS).length, 3);
});

test('all static entrypoint assets exist', () => {
  for (const path of ['../styles.css', '../src/game.js', '../assets/ruin-keyart.webp']) {
    assert.equal(existsSync(new URL(path, import.meta.url)), true, `${path} is missing`);
  }
});
