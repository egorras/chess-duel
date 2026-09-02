'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { monthBounds, calculateSummary, recentOpponents } = require('../core');

const game = (white, black, winner, status = 'mate') => ({ status, winner, players: {
  white: { user: { name: white } }, black: { user: { name: black } }
} });

test('monthBounds uses local calendar month boundaries', () => {
  assert.deepEqual(monthBounds(new Date(2026, 8, 15, 12)), {
    since: new Date(2026, 8, 1).getTime(), until: new Date(2026, 9, 1).getTime()
  });
});

test('calculates score from either color and ignores active games', () => {
  const result = calculateSummary([
    game('Me', 'Friend', 'white'), game('Friend', 'Me', 'white'),
    game('Me', 'Friend'), game('Me', 'Friend', null, 'started')
  ], 'Me', 'Friend');
  const { calendar, ...score } = result;
  assert.deepEqual(score, { account: 'Me', opponent: 'Friend', games: 3, wins: 1,
    losses: 1, draws: 1, myPoints: 1.5, opponentPoints: 1.5,
    streak: 0, streakOwner: null, myMaxStreak: 1, opponentMaxStreak: 1,
    form: ['W', 'L', 'D'] });
  assert.ok(calendar.length >= 28);
});

test('reports current winning streak and recent form', () => {
  const games = [game('Me', 'Friend'), game('Me', 'Friend', 'black'),
    game('Friend', 'Me', 'black'), game('Me', 'Friend', 'white')];
  games.forEach((item, index) => { item.createdAt = index; });
  const result = calculateSummary(games, 'Me', 'Friend');
  assert.equal(result.streak, 2);
  assert.equal(result.streakOwner, 'Me');
  assert.equal(result.myMaxStreak, 2);
  assert.equal(result.opponentMaxStreak, 1);
  assert.deepEqual(result.form, ['D', 'L', 'W', 'W']);
});

test('lists frequent recent opponents by frequency then recency', () => {
  assert.deepEqual(recentOpponents([
    game('Me', 'Alice'), game('Bob', 'Me'), game('me', 'alice'),
    game('Me', 'Bob'), game('Me', 'Bob'), game('Me', 'OneOff')
  ], 'ME'), ['Bob', 'Alice']);
});
