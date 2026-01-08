#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

const LICHESS_API = 'https://lichess.org/api';
const DATA_DIR = path.join(__dirname, '..', 'data', 'games');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function fetchGamesForPeriod(username, apiKey, since, until, vsPlayer = null, retryCount = 0) {
  const maxRetries = 3;

  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/x-ndjson'
      }
    };

    // Build query parameters
    const params = new URLSearchParams({
      rated: 'false', // Include both rated and unrated games
      since: since.toString(),
      until: until.toString(),
      accuracy: 'true',
      clocks: 'true',
      division: 'true',
      moves: 'true',
      sort: 'dateAsc'
    });

    // Add vs parameter if specified
    if (vsPlayer) {
      params.set('vs', vsPlayer);
    }

    const url = `${LICHESS_API}/games/user/${username}?${params.toString()}`;

    https.get(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', async () => {
        if (res.statusCode === 429) {
          // Rate limited
          if (retryCount < maxRetries) {
            const waitTime = Math.pow(2, retryCount) * 2000; // 2s, 4s, 8s
            console.log(`  Rate limited. Waiting ${waitTime/1000}s before retry ${retryCount + 1}/${maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            try {
              const result = await fetchGamesForPeriod(username, apiKey, since, until, vsPlayer, retryCount + 1);
              resolve(result);
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error(`Rate limited after ${maxRetries} retries`));
          }
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`API returned ${res.statusCode}: ${data}`));
          return;
        }

        // Parse NDJSON (newline-delimited JSON)
        const games = data
          .trim()
          .split('\n')
          .filter(line => line)
          .map(line => JSON.parse(line));

        resolve(games);
      });
    }).on('error', reject);
  });
}

function getGameMonth(game) {
  // Lichess timestamps are in milliseconds
  const date = new Date(game.createdAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getMonthTimestamps(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 1));
  return {
    since: startDate.getTime(),
    until: endDate.getTime()
  };
}

function getMonthsToFetch() {
  const files = fs.readdirSync(DATA_DIR);
  const existingMonths = files
    .filter(f => f.endsWith('.json') && f !== '.gitkeep')
    .map(f => {
      const match = f.match(/^(\d{4}-\d{2})\.json$/);
      return match ? match[1] : null;
    })
    .filter(Boolean)
    .sort();

  // Determine start month
  let startMonth;
  if (existingMonths.length > 0) {
    // Start from the last existing month to update it
    startMonth = existingMonths[existingMonths.length - 1];
  } else {
    // No existing data, start from July 2024
    startMonth = '2024-07';
  }

  // Generate list of months from start to current
  const months = [];
  const [startYear, startMonthNum] = startMonth.split('-').map(Number);
  const startDate = new Date(startYear, startMonthNum - 1, 1);
  const now = new Date();

  let current = new Date(startDate);
  while (current <= now) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    months.push(`${year}-${month}`);
    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

function loadExistingGames(monthFile) {
  if (fs.existsSync(monthFile)) {
    const content = fs.readFileSync(monthFile, 'utf8');
    return JSON.parse(content);
  }
  return [];
}

function saveGames(monthFile, games) {
  if (games.length > 0) {
    fs.writeFileSync(monthFile, JSON.stringify(games, null, 2));
  }
}

function mergeGames(existingGames, newGames) {
  const gameMap = new Map();

  // Add existing games
  existingGames.forEach(game => {
    gameMap.set(game.id, game);
  });

  // Add/update with new games
  newGames.forEach(game => {
    gameMap.set(game.id, game);
  });

  // Convert back to array and sort by date
  return Array.from(gameMap.values()).sort((a, b) => a.createdAt - b.createdAt);
}

async function main() {
  const username = process.argv[2];
  const vsPlayer = process.argv[3];
  const apiKey = process.env.LICHESS_API_KEY;

  if (!username || !vsPlayer) {
    console.error('Usage: node fetch-games.js <username> <vs-player>');
    process.exit(1);
  }

  if (!apiKey) {
    console.error('Error: LICHESS_API_KEY environment variable is required');
    process.exit(1);
  }

  console.log(`Fetching games: ${username} vs ${vsPlayer}`);

  try {
    const monthsToFetch = getMonthsToFetch();
    console.log(`Will fetch ${monthsToFetch.length} months: ${monthsToFetch[0]} to ${monthsToFetch[monthsToFetch.length - 1]}`);

    let totalSaved = 0;
    let totalNew = 0;
    let totalFetched = 0;

    for (const month of monthsToFetch) {
      const { since, until } = getMonthTimestamps(month);
      const games = await fetchGamesForPeriod(username, apiKey, since, until, vsPlayer);
      totalFetched += games.length;

      const monthFile = path.join(DATA_DIR, `${month}.json`);
      const existingGames = loadExistingGames(monthFile);
      const mergedGames = mergeGames(existingGames, games);

      const newCount = mergedGames.length - existingGames.length;
      if (newCount > 0 || games.length > 0) {
        saveGames(monthFile, mergedGames);
        if (newCount > 0) {
          console.log(`  ${month}: ${mergedGames.length} games (${newCount} new)`);
          totalNew += newCount;
        } else if (games.length > 0) {
          console.log(`  ${month}: ${mergedGames.length} games (no new games)`);
        }
      } else if (existingGames.length > 0) {
        console.log(`  ${month}: ${existingGames.length} games (no changes)`);
      }

      totalSaved += mergedGames.length;

      // Rate limiting: wait 1.5s between requests to avoid hitting API limits
      if (monthsToFetch.indexOf(month) < monthsToFetch.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    console.log(`\nFetched: ${totalFetched} games from API`);
    console.log(`Total saved: ${totalSaved} games (${totalNew} new)`);
  } catch (error) {
    console.error('Error fetching games:', error.message);
    process.exit(1);
  }
}

main();
