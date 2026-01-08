// Load all game data from monthly JSON files
async function loadAllGames() {
    const games = [];
    const startYear = 2024;
    const startMonth = 1;
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    let year = startYear;
    let month = startMonth;

    while (year < currentYear || (year === currentYear && month <= currentMonth)) {
        const monthStr = String(month).padStart(2, '0');
        const fileName = `data/games/${year}-${monthStr}.json`;

        try {
            const response = await fetch(fileName);
            if (response.ok) {
                const monthGames = await response.json();
                games.push(...monthGames);
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

    return games;
}

function getPlayerNames(games) {
    if (games.length === 0) return ['Player 1', 'Player 2'];

    const firstGame = games[0];
    return [
        firstGame.players.white.user.name,
        firstGame.players.black.user.name
    ];
}

function calculateStats(games) {
    if (games.length === 0) {
        return null;
    }

    const [player1Name, player2Name] = getPlayerNames(games);

    const stats = {
        totalGames: games.length,
        player1: {
            name: player1Name,
            wins: 0,
            losses: 0,
            draws: 0
        },
        player2: {
            name: player2Name,
            wins: 0,
            losses: 0,
            draws: 0
        },
        byTimeControl: {},
        byMonth: {},
        byTermination: {},
        firstGame: null,
        lastGame: null
    };

    games.forEach(game => {
        const whitePlayer = game.players.white.user.name;
        const blackPlayer = game.players.black.user.name;
        const winner = game.winner;

        // Determine result for each player
        let player1Result, player2Result;
        if (winner === 'white') {
            if (whitePlayer === player1Name) {
                stats.player1.wins++;
                stats.player2.losses++;
                player1Result = 'win';
                player2Result = 'loss';
            } else {
                stats.player2.wins++;
                stats.player1.losses++;
                player1Result = 'loss';
                player2Result = 'win';
            }
        } else if (winner === 'black') {
            if (blackPlayer === player1Name) {
                stats.player1.wins++;
                stats.player2.losses++;
                player1Result = 'win';
                player2Result = 'loss';
            } else {
                stats.player2.wins++;
                stats.player1.losses++;
                player1Result = 'loss';
                player2Result = 'win';
            }
        } else {
            // Draw
            stats.player1.draws++;
            stats.player2.draws++;
            player1Result = 'draw';
            player2Result = 'draw';
        }

        // Time control stats
        const speed = game.speed || 'unknown';
        if (!stats.byTimeControl[speed]) {
            stats.byTimeControl[speed] = { count: 0, player1Wins: 0, player2Wins: 0, draws: 0 };
        }
        stats.byTimeControl[speed].count++;

        if (player1Result === 'win') {
            stats.byTimeControl[speed].player1Wins++;
        } else if (player2Result === 'win') {
            stats.byTimeControl[speed].player2Wins++;
        } else {
            stats.byTimeControl[speed].draws++;
        }

        // Monthly stats with detailed breakdown
        const date = new Date(game.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!stats.byMonth[monthKey]) {
            stats.byMonth[monthKey] = {
                count: 0,
                player1Wins: 0,
                player2Wins: 0,
                draws: 0
            };
        }
        stats.byMonth[monthKey].count++;
        if (player1Result === 'win') {
            stats.byMonth[monthKey].player1Wins++;
        } else if (player2Result === 'win') {
            stats.byMonth[monthKey].player2Wins++;
        } else {
            stats.byMonth[monthKey].draws++;
        }

        // Termination stats
        const status = game.status || 'unknown';
        if (!stats.byTermination[status]) {
            stats.byTermination[status] = 0;
        }
        stats.byTermination[status]++;

        // Track first and last games
        if (!stats.firstGame || game.createdAt < stats.firstGame) {
            stats.firstGame = game.createdAt;
        }
        if (!stats.lastGame || game.createdAt > stats.lastGame) {
            stats.lastGame = game.createdAt;
        }
    });

    return stats;
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

function formatMonthKey(monthKey) {
    const [year, month] = monthKey.split('-');
    const date = new Date(year, parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

function displayStats(stats) {
    if (!stats) {
        const errorEl = document.getElementById('error');
        errorEl.textContent = 'No game data available.';
        errorEl.classList.remove('hidden');
        document.getElementById('loading').classList.add('hidden');
        return;
    }

    // Hide loading, show stats
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('stats-container').classList.remove('hidden');

    // Overall stats
    document.getElementById('total-games').textContent = stats.totalGames;
    document.getElementById('date-range').textContent =
        `${formatDate(stats.firstGame)} - ${formatDate(stats.lastGame)}`;
    const drawRate = ((stats.player1.draws / stats.totalGames) * 100).toFixed(1);
    document.getElementById('draw-rate').textContent = `${drawRate}%`;

    // Player 1 stats
    document.getElementById('player1-name').textContent = stats.player1.name;
    document.getElementById('player1-wins').textContent = stats.player1.wins;
    document.getElementById('player1-draws').textContent = stats.player1.draws;
    document.getElementById('player1-losses').textContent = stats.player1.losses;
    const player1WinRate = ((stats.player1.wins / stats.totalGames) * 100).toFixed(1);
    document.getElementById('player1-winrate').textContent = `${player1WinRate}%`;

    // Player 2 stats
    document.getElementById('player2-name').textContent = stats.player2.name;
    document.getElementById('player2-wins').textContent = stats.player2.wins;
    document.getElementById('player2-draws').textContent = stats.player2.draws;
    document.getElementById('player2-losses').textContent = stats.player2.losses;
    const player2WinRate = ((stats.player2.wins / stats.totalGames) * 100).toFixed(1);
    document.getElementById('player2-winrate').textContent = `${player2WinRate}%`;

    // Highlight leader
    if (stats.player1.wins > stats.player2.wins) {
        document.getElementById('player1-card').classList.add('border-green-500');
        document.getElementById('player1-card').classList.add('shadow-lg');
    } else if (stats.player2.wins > stats.player1.wins) {
        document.getElementById('player2-card').classList.add('border-green-500');
        document.getElementById('player2-card').classList.add('shadow-lg');
    }

    // Update table headers with player names
    document.getElementById('player1-header').textContent = stats.player1.name;
    document.getElementById('player2-header').textContent = stats.player2.name;

    // Monthly breakdown
    const monthlyBreakdownContainer = document.getElementById('monthly-breakdown');
    const sortedMonths = Object.keys(stats.byMonth).sort().reverse(); // Most recent first

    sortedMonths.forEach(month => {
        const data = stats.byMonth[month];
        const row = document.createElement('tr');
        row.className = 'hover:bg-indigo-50';

        const player1WinPct = ((data.player1Wins / data.count) * 100).toFixed(0);
        const player2WinPct = ((data.player2Wins / data.count) * 100).toFixed(0);

        row.innerHTML = `
            <td class="px-4 py-3 font-medium text-gray-700">${formatMonthKey(month)}</td>
            <td class="px-4 py-3 text-center font-semibold">${data.count}</td>
            <td class="px-4 py-3 text-center">
                <span class="inline-block px-3 py-1 rounded-full bg-green-100 text-green-700 font-semibold">
                    ${data.player1Wins} (${player1WinPct}%)
                </span>
            </td>
            <td class="px-4 py-3 text-center">
                <span class="inline-block px-3 py-1 rounded-full bg-gray-100 text-gray-600 font-semibold">
                    ${data.draws}
                </span>
            </td>
            <td class="px-4 py-3 text-center">
                <span class="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold">
                    ${data.player2Wins} (${player2WinPct}%)
                </span>
            </td>
        `;
        monthlyBreakdownContainer.appendChild(row);
    });

    // Time control stats
    const timeControlContainer = document.getElementById('time-control-stats');
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
        const div = document.createElement('div');
        div.className = 'bg-gray-50 p-4 rounded-lg border-l-4 border-indigo-500';
        div.innerHTML = `
            <div class="font-bold text-indigo-600 mb-2">${timeControl.charAt(0).toUpperCase() + timeControl.slice(1)}</div>
            <div class="text-2xl font-bold text-gray-800 mb-2">${data.count}</div>
            <div class="text-sm text-gray-600">
                ${stats.player1.name}: ${data.player1Wins}W-${data.draws}D-${data.player2Wins}L
            </div>
        `;
        timeControlContainer.appendChild(div);
    });

    // Termination stats
    const terminationContainer = document.getElementById('termination-stats');
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
        div.className = 'bg-gray-50 p-4 rounded-lg border-l-4 border-purple-500';
        div.innerHTML = `
            <div class="font-bold text-purple-600 mb-2">${terminationLabels[status] || status}</div>
            <div class="text-2xl font-bold text-gray-800 mb-1">${count}</div>
            <div class="text-sm text-gray-600">${percentage}%</div>
        `;
        terminationContainer.appendChild(div);
    });
}

// Initialize
async function init() {
    try {
        const games = await loadAllGames();
        const stats = calculateStats(games);
        displayStats(stats);
    } catch (error) {
        console.error('Error loading games:', error);
        const errorEl = document.getElementById('error');
        errorEl.textContent = 'Error loading game data. Please try again later.';
        errorEl.classList.remove('hidden');
        document.getElementById('loading').classList.add('hidden');
    }
}

init();
