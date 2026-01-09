// Load all game data from monthly JSON files (blitz only)
async function loadAllGames() {
    const gamesByMonth = {};
    const startYear = 2024;
    const startMonth = 7;
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    let year = startYear;
    let month = startMonth;

    while (year < currentYear || (year === currentYear && month <= currentMonth)) {
        const monthStr = String(month).padStart(2, '0');
        const monthKey = `${year}-${monthStr}`;
        const fileName = `data/games/${monthKey}.json`;

        try {
            const response = await fetch(fileName);
            if (response.ok) {
                const monthGames = await response.json();
                // Filter for blitz games only
                const blitzGames = monthGames.filter(game => game.speed === 'blitz');
                if (blitzGames.length > 0) {
                    gamesByMonth[monthKey] = blitzGames;
                }
            }
        } catch (error) {
            // File doesn't exist or couldn't be loaded, skip
        }

        month++;
        if (month > 12) {
            month = 1;
            year++;
        }
    }

    return gamesByMonth;
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
