// Load all game data from monthly JSON files
async function loadAllGames() {
    const gamesByMonth = {};
    const startYear = 2024;
    const startMonth = 7; // Start from July 2024
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
                if (monthGames.length > 0) {
                    gamesByMonth[monthKey] = monthGames;
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

function calculateStreaks(games, player1Name) {
    let currentStreak = 0;
    let maxPlayer1Streak = 0;
    let maxPlayer2Streak = 0;
    let currentPlayer = null;

    games.forEach(game => {
        const whitePlayer = game.players.white.user.name;
        const winner = game.winner;

        let gameWinner = null;
        if (winner === 'white') {
            gameWinner = whitePlayer === player1Name ? 'player1' : 'player2';
        } else if (winner === 'black') {
            gameWinner = whitePlayer === player1Name ? 'player2' : 'player1';
        }

        if (gameWinner) {
            if (gameWinner === currentPlayer) {
                currentStreak++;
            } else {
                currentStreak = 1;
                currentPlayer = gameWinner;
            }

            if (gameWinner === 'player1') {
                maxPlayer1Streak = Math.max(maxPlayer1Streak, currentStreak);
            } else {
                maxPlayer2Streak = Math.max(maxPlayer2Streak, currentStreak);
            }
        } else {
            currentStreak = 0;
            currentPlayer = null;
        }
    });

    return { player1: maxPlayer1Streak, player2: maxPlayer2Streak };
}

function calculateStats(gamesByMonth) {
    if (Object.keys(gamesByMonth).length === 0) {
        return null;
    }

    const [player1Name, player2Name] = getPlayerNames(gamesByMonth);
    const allGames = Object.values(gamesByMonth).flat();

    const stats = {
        player1Name,
        player2Name,
        totalGames: allGames.length,
        wins: 0,
        losses: 0,
        draws: 0,
        byTimeControl: {},
        byTermination: {},
        monthlyStats: {},
        years: new Set(),
        bestStreak: 0
    };

    // Sort months
    const sortedMonths = Object.keys(gamesByMonth).sort();

    sortedMonths.forEach(monthKey => {
        const games = gamesByMonth[monthKey];
        const year = monthKey.split('-')[0];
        stats.years.add(year);

        const monthStat = {
            games: games.length,
            wins: 0,
            losses: 0,
            draws: 0,
            streaks: { player1: 0, player2: 0 }
        };

        // Calculate streaks for this month
        monthStat.streaks = calculateStreaks(games, player1Name);
        stats.bestStreak = Math.max(stats.bestStreak, monthStat.streaks.player1);

        games.forEach(game => {
            const whitePlayer = game.players.white.user.name;
            const winner = game.winner;

            // Determine result from player1's perspective
            let result;
            if (winner === 'white') {
                result = whitePlayer === player1Name ? 'win' : 'loss';
            } else if (winner === 'black') {
                result = whitePlayer === player1Name ? 'loss' : 'win';
            } else {
                result = 'draw';
            }

            if (result === 'win') {
                monthStat.wins++;
                stats.wins++;
            } else if (result === 'loss') {
                monthStat.losses++;
                stats.losses++;
            } else {
                monthStat.draws++;
                stats.draws++;
            }

            // Time control stats
            const speed = game.speed || 'unknown';
            if (!stats.byTimeControl[speed]) {
                stats.byTimeControl[speed] = { count: 0, wins: 0, losses: 0, draws: 0 };
            }
            stats.byTimeControl[speed].count++;
            stats.byTimeControl[speed][result === 'win' ? 'wins' : result === 'loss' ? 'losses' : 'draws']++;

            // Termination stats
            const status = game.status || 'unknown';
            if (!stats.byTermination[status]) {
                stats.byTermination[status] = 0;
            }
            stats.byTermination[status]++;
        });

        stats.monthlyStats[monthKey] = monthStat;
    });

    return stats;
}

function formatMonthName(monthKey) {
    const [year, month] = monthKey.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    return monthNames[parseInt(month) - 1];
}

function displayStats(stats) {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const statsContainer = document.getElementById('stats-container');

    if (!stats) {
        if (errorEl) {
            errorEl.textContent = 'No game data available.';
            errorEl.classList.remove('hidden');
        }
        if (loadingEl) loadingEl.classList.add('hidden');
        return;
    }

    // Hide loading, show stats
    if (loadingEl) loadingEl.classList.add('hidden');
    if (statsContainer) statsContainer.classList.remove('hidden');

    // Get year range
    const years = Array.from(stats.years).sort();
    const yearRange = years.length > 1 ? `${years[0]}-${years[years.length - 1]}` : years[0];

    // Update title
    const titleEl = document.getElementById('main-title');
    if (titleEl) {
        titleEl.textContent = `Lichess Stats: ${stats.player1Name} vs ${stats.player2Name} (${yearRange})`;
    }

    // Overall stats
    const totalGamesEl = document.getElementById('total-games');
    const wldTotalEl = document.getElementById('wld-total');
    const overallWinrateEl = document.getElementById('overall-winrate');
    const bestStreakEl = document.getElementById('best-streak');

    if (totalGamesEl) totalGamesEl.textContent = stats.totalGames;
    if (wldTotalEl) wldTotalEl.textContent = `${stats.wins}/${stats.losses}/${stats.draws}`;
    const winRate = ((stats.wins / stats.totalGames) * 100).toFixed(1);
    if (overallWinrateEl) overallWinrateEl.textContent = `${winRate}%`;
    if (bestStreakEl) bestStreakEl.textContent = stats.bestStreak;

    // Monthly breakdown
    const monthlyBreakdownContainer = document.getElementById('monthly-breakdown');
    if (monthlyBreakdownContainer) {
        const sortedMonths = Object.keys(stats.monthlyStats).sort().reverse();

        sortedMonths.forEach(monthKey => {
            const data = stats.monthlyStats[monthKey];
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-700';

            const winrate = ((data.wins / data.games) * 100).toFixed(1);
            const streakText = data.streaks.player1 > 0 || data.streaks.player2 > 0
                ? `${stats.player1Name}=${data.streaks.player1}, ${stats.player2Name}=${data.streaks.player2}`
                : '-';

            row.innerHTML = `
                <td class="px-4 py-3">${formatMonthName(monthKey)}</td>
                <td class="px-4 py-3 text-center">${data.games}</td>
                <td class="px-4 py-3 text-center">${data.wins}/${data.losses}/${data.draws}</td>
                <td class="px-4 py-3 text-center">${winrate}%</td>
                <td class="px-4 py-3">${streakText}</td>
            `;
            monthlyBreakdownContainer.appendChild(row);
        });
    }

    // Year totals (for now, just overall stats)
    const yearTotalGamesEl = document.getElementById('year-total-games');
    const yearTotalWldEl = document.getElementById('year-total-wld');
    const yearTotalWinrateEl = document.getElementById('year-total-winrate');
    const yearBestStreakEl = document.getElementById('year-best-streak');

    if (yearTotalGamesEl) yearTotalGamesEl.textContent = stats.totalGames;
    if (yearTotalWldEl) yearTotalWldEl.textContent = `${stats.wins}/${stats.losses}/${stats.draws}`;
    if (yearTotalWinrateEl) yearTotalWinrateEl.textContent = `${winRate}%`;
    if (yearBestStreakEl) yearBestStreakEl.textContent = `${stats.player1Name}=${stats.bestStreak}`;

    // Time control stats
    const timeControlContainer = document.getElementById('time-control-stats');
    if (timeControlContainer) {
        const timeControlOrder = ['bullet', 'blitz', 'rapid', 'classical', 'correspondence'];
        const sortedTimeControls = Object.keys(stats.byTimeControl).sort((a, b) => {
            const aIndex = timeControlOrder.indexOf(a);
            const bIndex = timeControlOrder.indexOf(b);
            if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
        });

        sortedTimeControls.forEach(timeControl => {
            const data = stats.byTimeControl[timeControl];
            const winrate = ((data.wins / data.count) * 100).toFixed(1);
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center text-sm py-1 border-b border-gray-700';
            div.innerHTML = `
                <span class="text-gray-300">${timeControl.charAt(0).toUpperCase() + timeControl.slice(1)}</span>
                <span class="text-gray-400">${data.wins}/${data.losses}/${data.draws} (${winrate}%)</span>
            `;
            timeControlContainer.appendChild(div);
        });
    }

    // Termination stats
    const terminationContainer = document.getElementById('termination-stats');
    if (terminationContainer) {
        const terminationLabels = {
            'mate': 'Checkmate',
            'resign': 'Resignation',
            'timeout': 'Timeout',
            'draw': 'Draw Agreement',
            'stalemate': 'Stalemate',
            'outoftime': 'Out of Time',
            'unknown': 'Unknown'
        };

        Object.keys(stats.byTermination).sort((a, b) =>
            stats.byTermination[b] - stats.byTermination[a]
        ).forEach(status => {
            const count = stats.byTermination[status];
            const percentage = ((count / stats.totalGames) * 100).toFixed(1);
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center text-sm py-1 border-b border-gray-700';
            div.innerHTML = `
                <span class="text-gray-300">${terminationLabels[status] || status}</span>
                <span class="text-gray-400">${count} (${percentage}%)</span>
            `;
            terminationContainer.appendChild(div);
        });
    }
}

// Global state
let globalGamesByMonth = {};
let globalPlayerNames = [];
let currentPerspective = 0; // 0 for player1, 1 for player2

function switchPerspective(perspectiveIndex) {
    currentPerspective = perspectiveIndex;

    // Update button states
    const btn1 = document.getElementById('switch-player1');
    const btn2 = document.getElementById('switch-player2');

    if (perspectiveIndex === 0) {
        if (btn1) {
            btn1.classList.remove('bg-gray-700', 'hover:bg-gray-600');
            btn1.classList.add('bg-blue-600', 'hover:bg-blue-700');
        }
        if (btn2) {
            btn2.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            btn2.classList.add('bg-gray-700', 'hover:bg-gray-600');
        }
    } else {
        if (btn1) {
            btn1.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            btn1.classList.add('bg-gray-700', 'hover:bg-gray-600');
        }
        if (btn2) {
            btn2.classList.remove('bg-gray-700', 'hover:bg-gray-600');
            btn2.classList.add('bg-blue-600', 'hover:bg-blue-700');
        }
    }

    // Recalculate and display stats from new perspective
    const stats = calculateStats(globalGamesByMonth, perspectiveIndex);

    // Clear existing stats
    const monthlyBreakdown = document.getElementById('monthly-breakdown');
    const timeControl = document.getElementById('time-control-stats');
    const termination = document.getElementById('termination-stats');

    if (monthlyBreakdown) monthlyBreakdown.innerHTML = '';
    if (timeControl) timeControl.innerHTML = '';
    if (termination) termination.innerHTML = '';

    displayStats(stats);
}

function setupPerspectiveSwitcher() {
    const btn1 = document.getElementById('switch-player1');
    const btn2 = document.getElementById('switch-player2');

    if (btn1 && btn2 && globalPlayerNames.length === 2) {
        btn1.textContent = globalPlayerNames[0];
        btn2.textContent = globalPlayerNames[1];

        btn1.addEventListener('click', () => switchPerspective(0));
        btn2.addEventListener('click', () => switchPerspective(1));
    }
}

// Initialize
async function init() {
    try {
        globalGamesByMonth = await loadAllGames();
        globalPlayerNames = getPlayerNames(globalGamesByMonth);

        const stats = calculateStats(globalGamesByMonth, currentPerspective);
        displayStats(stats);
        setupPerspectiveSwitcher();
    } catch (error) {
        console.error('Error loading games:', error);
        const errorEl = document.getElementById('error');
        const loadingEl = document.getElementById('loading');
        if (errorEl) {
            errorEl.textContent = `Error loading game data: ${error.message}`;
            errorEl.classList.remove('hidden');
        }
        if (loadingEl) {
            loadingEl.classList.add('hidden');
        }
    }
}

init();
