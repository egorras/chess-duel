'use strict';

function monthBounds(now = new Date()) {
  // "Current month" follows the user's local calendar, not UTC. This matters
  // for games played around midnight in non-UTC time zones.
  const since = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const until = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  return { since, until };
}

function playerName(player) {
  return player && player.user && player.user.name ? player.user.name : null;
}

function isFinished(game) {
  return game && game.status && !['created', 'started'].includes(game.status);
}

function calculateSummary(games, account, opponent) {
  const me = account.toLowerCase();
  const them = opponent.toLowerCase();
  let mine = 0;
  let theirs = 0;
  let draws = 0;
  let gamesCount = 0;
  const results = [];
  let myMaxStreak = 0;
  let opponentMaxStreak = 0;
  let myRun = 0;
  let opponentRun = 0;
  const daily = new Map();

  const orderedGames = games.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  for (const game of orderedGames) {
    const white = playerName(game.players && game.players.white);
    const black = playerName(game.players && game.players.black);
    if (!white || !black || !isFinished(game)) continue;
    const pair = [white.toLowerCase(), black.toLowerCase()];
    if (!pair.includes(me) || !pair.includes(them)) continue;

    gamesCount += 1;
    const played = new Date(game.createdAt);
    const day = played.getDate();
    const dayStats = daily.get(day) || { wins: 0, losses: 0, draws: 0, games: 0 };
    dayStats.games += 1;
    if (!game.winner) {
      draws += 1;
      results.push('D');
      dayStats.draws += 1;
    } else {
      const winner = game.winner === 'white' ? white.toLowerCase() : black.toLowerCase();
      if (winner === me) { mine += 1; results.push('W'); dayStats.wins += 1; }
      else if (winner === them) { theirs += 1; results.push('L'); dayStats.losses += 1; }
    }
    daily.set(day, dayStats);
    const result = results.at(-1);
    myRun = result === 'W' ? myRun + 1 : 0;
    opponentRun = result === 'L' ? opponentRun + 1 : 0;
    myMaxStreak = Math.max(myMaxStreak, myRun);
    opponentMaxStreak = Math.max(opponentMaxStreak, opponentRun);
  }

  const lastResult = results.at(-1);
  let streak = 0;
  if (lastResult === 'W' || lastResult === 'L') {
    for (let index = results.length - 1; index >= 0 && results[index] === lastResult; index -= 1) streak += 1;
  }

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const leadingDays = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const calendar = Array.from({ length: leadingDays }, () => ({ blank: true }));
  for (let day = 1; day <= daysInMonth; day += 1) {
    const value = daily.get(day) || { wins: 0, losses: 0, draws: 0, games: 0 };
    const outcome = value.games === 0 ? 'N' : value.wins > value.losses ? 'W' : value.losses > value.wins ? 'L' : 'D';
    calendar.push({ day, outcome, ...value });
  }

  return {
    account,
    opponent,
    games: gamesCount,
    wins: mine,
    losses: theirs,
    draws,
    myPoints: mine + draws / 2,
    opponentPoints: theirs + draws / 2,
    streak,
    streakOwner: streak ? (lastResult === 'W' ? account : opponent) : null,
    myMaxStreak,
    opponentMaxStreak,
    form: results.slice(-10),
    calendar
  };
}

function recentOpponents(games, account, options = {}) {
  const minimumGames = options.minimumGames || 2;
  const limit = options.limit || 10;
  const me = account.toLowerCase();
  const seen = new Map();
  for (let index = 0; index < games.length; index += 1) {
    const game = games[index];
    const white = playerName(game.players && game.players.white);
    const black = playerName(game.players && game.players.black);
    if (!white || !black) continue;
    const opponent = white.toLowerCase() === me ? black : black.toLowerCase() === me ? white : null;
    if (!opponent) continue;
    const key = opponent.toLowerCase();
    const current = seen.get(key) || { name: opponent, games: 0, firstSeen: index };
    current.games += 1;
    seen.set(key, current);
  }
  return [...seen.values()]
    .filter(item => item.games >= minimumGames)
    .sort((a, b) => b.games - a.games || a.firstSeen - b.firstSeen)
    .slice(0, limit)
    .map(item => item.name);
}

module.exports = { monthBounds, calculateSummary, recentOpponents };
