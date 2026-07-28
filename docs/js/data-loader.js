// Pure fallback range (no fetch) used only if the manifest can't be loaded —
// keeps the app working even if manifest.json is missing or stale.
function computeMonthKeyRange() {
    const startYear = 2024;
    const startMonth = 7;
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    const months = [];
    let year = startYear;
    let month = startMonth;
    while (year < currentYear || (year === currentYear && month <= currentMonth)) {
        months.push(`${year}-${String(month).padStart(2, '0')}`);
        month++;
        if (month > 12) { month = 1; year++; }
    }
    return months;
}

// Lightweight index of which months actually have data, so selectors/nav can
// know the full range without fetching every month's (much heavier) game data.
async function loadManifest() {
    try {
        const response = await fetch('data/games/manifest.json');
        if (!response.ok) throw new Error('manifest not found');
        const data = await response.json();
        if (Array.isArray(data.months) && data.months.length > 0) {
            return data.months.slice().sort();
        }
        throw new Error('manifest empty');
    } catch (error) {
        return computeMonthKeyRange();
    }
}

async function fetchMonthGames(monthKey) {
    try {
        const response = await fetch(`data/games/${monthKey}.json`);
        if (!response.ok) return null;
        const games = await response.json();
        return games.filter(game => game.speed === 'blitz');
    } catch (error) {
        return null;
    }
}

// Fetches only the month keys not already present in gamesByMonth, mutating
// it in place (so existing references / closures keep seeing updates).
// Returns the list of month keys that were newly added.
async function ensureMonthsLoaded(gamesByMonth, monthKeys) {
    const missing = [...new Set(monthKeys)].filter(key => !(key in gamesByMonth));
    if (missing.length === 0) return [];

    const results = await Promise.all(missing.map(async key => [key, await fetchMonthGames(key)]));
    const added = [];
    results.forEach(([key, games]) => {
        if (games && games.length > 0) {
            gamesByMonth[key] = games;
            added.push(key);
        }
    });
    return added;
}

function getPlayerNames(gamesByMonth) {
    for (const games of Object.values(gamesByMonth)) {
        if (games.length > 0) {
            return [
                games[0].players.white.user.name,
                games[0].players.black.user.name
            ];
        }
    }
    return ['Player 1', 'Player 2'];
}

function filterGamesByDateRange(gamesByMonth, year, month, day) {
    if (year === 'all') return gamesByMonth;

    const filtered = {};
    Object.keys(gamesByMonth).forEach(monthKey => {
        const [gameYear, gameMonth] = monthKey.split('-');
        if (gameYear === year && (month === 'all' || gameMonth === month)) {
            let monthGames = gamesByMonth[monthKey];
            
            // Filter by day if specified
            if (day !== 'all' && day !== undefined) {
                monthGames = monthGames.filter(game => {
                    const date = new Date(game.createdAt);
                    const gameDay = String(date.getDate()).padStart(2, '0');
                    return gameDay === day;
                });
            }
            
            if (monthGames.length > 0) {
                filtered[monthKey] = monthGames;
            }
        }
    });
    return filtered;
}
