import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseUnique, circleHit, formatTime, mulberry32, normalize, phaseAt, spawnInterval, weightedPick, xpForLevel } from '../src/core.js';

test('formatTime produces a stable game timer', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(65.9), '01:05');
  assert.equal(formatTime(-4), '00:00');
});

test('normalize keeps zero input stationary', () => {
  assert.deepEqual(normalize(0, 0), { x: 0, y: 0, length: 0 });
  const vector = normalize(3, 4);
  assert.equal(vector.length, 5);
  assert.equal(vector.x, .6);
  assert.equal(vector.y, .8);
});

test('experience requirements increase with level', () => {
  assert.ok(xpForLevel(2) > xpForLevel(1));
  assert.ok(xpForLevel(20) > xpForLevel(10));
});

test('spawn interval accelerates but stays bounded', () => {
  assert.equal(spawnInterval(0), .68);
  assert.equal(spawnInterval(10000), .11);
});

test('phase boundaries map to the intended world states', () => {
  assert.equal(phaseAt(0).wave, 1);
  assert.equal(phaseAt(90).wave, 2);
  assert.equal(phaseAt(210).wave, 3);
  assert.equal(phaseAt(330).wave, 4);
});

test('unique choices never duplicate an option', () => {
  const choices = chooseUnique(['a', 'b', 'c', 'd'], 3, mulberry32(7));
  assert.equal(choices.length, 3);
  assert.equal(new Set(choices).size, 3);
});

test('weighted selection is deterministic with a seeded generator', () => {
  const entries = [{ value: 'common', weight: 10 }, { value: 'rare', weight: 1 }];
  assert.equal(weightedPick(entries, mulberry32(2)), weightedPick(entries, mulberry32(2)));
});

test('circle collision includes touching edges', () => {
  assert.equal(circleHit({ x: 0, y: 0, radius: 10 }, { x: 20, y: 0, radius: 10 }), true);
  assert.equal(circleHit({ x: 0, y: 0, radius: 10 }, { x: 21, y: 0, radius: 10 }), false);
});
