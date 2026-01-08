// Global state
let globalGamesByMonth = {};
let globalPlayerNames = [];
let pointsChart = null;

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

function filterGamesByDateRange(gamesByMonth, year, month) {
    if (year === 'all') return gamesByMonth;

    const filtered = {};
    Object.keys(gamesByMonth).forEach(monthKey => {
        const [gameYear, gameMonth] = monthKey.split('-');
        if (gameYear === year && (month === 'all' || gameMonth === month)) {
            filtered[monthKey] = gamesByMonth[monthKey];
        }
    });
    return filtered;
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

    const [player1Name, player2Name] = getPlayerNames(globalGamesByMonth);
    const allGames = Object.values(gamesByMonth).flat();

    const stats = {
        player1Name,
        player2Name,
        totalGames: allGames.length,
        player1: { wins: 0, losses: 0, draws: 0, bestStreak: 0 },
        player2: { wins: 0, losses: 0, draws: 0, bestStreak: 0 },
        byTermination: {},
        monthlyStats: {}
    };

    // Calculate overall streaks
    const overallStreaks = calculateStreaks(allGames, player1Name);
    stats.player1.bestStreak = overallStreaks.player1;
    stats.player2.bestStreak = overallStreaks.player2;

    // Sort months
    const sortedMonths = Object.keys(gamesByMonth).sort();

    sortedMonths.forEach(monthKey => {
        const games = gamesByMonth[monthKey];

        const monthStat = {
            games: games.length,
            player1Wins: 0,
            player2Wins: 0,
            draws: 0,
            streaks: { player1: 0, player2: 0 }
        };

        // Calculate streaks for this month
        monthStat.streaks = calculateStreaks(games, player1Name);

        games.forEach(game => {
            const whitePlayer = game.players.white.user.name;
            const winner = game.winner;

            // Determine result
            if (winner === 'white') {
                if (whitePlayer === player1Name) {
                    monthStat.player1Wins++;
                    stats.player1.wins++;
                    stats.player2.losses++;
                } else {
                    monthStat.player2Wins++;
                    stats.player2.wins++;
                    stats.player1.losses++;
                }
            } else if (winner === 'black') {
                if (whitePlayer === player1Name) {
                    monthStat.player2Wins++;
                    stats.player2.wins++;
                    stats.player1.losses++;
                } else {
                    monthStat.player1Wins++;
                    stats.player1.wins++;
                    stats.player2.losses++;
                }
            } else {
                monthStat.draws++;
                stats.player1.draws++;
                stats.player2.draws++;
            }

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

function generateChartData(gamesByMonth, player1Name) {
    const allGames = [];

    // Flatten and sort all games by date
    Object.keys(gamesByMonth).sort().forEach(monthKey => {
        allGames.push(...gamesByMonth[monthKey]);
    });

    allGames.sort((a, b) => a.createdAt - b.createdAt);

    const labels = [];
    const player1Points = [];
    const player2Points = [];

    let p1Cumulative = 0;
    let p2Cumulative = 0;

    allGames.forEach((game, index) => {
        const whitePlayer = game.players.white.user.name;
        const winner = game.winner;

        // Calculate points for this game
        let p1GamePoints = 0;
        let p2GamePoints = 0;

        if (winner === 'white') {
            if (whitePlayer === player1Name) {
                p1GamePoints = 1;
                p2GamePoints = 0;
            } else {
                p1GamePoints = 0;
                p2GamePoints = 1;
            }
        } else if (winner === 'black') {
            if (whitePlayer === player1Name) {
                p1GamePoints = 0;
                p2GamePoints = 1;
            } else {
                p1GamePoints = 1;
                p2GamePoints = 0;
            }
        } else {
            // Draw
            p1GamePoints = 0.5;
            p2GamePoints = 0.5;
        }

        p1Cumulative += p1GamePoints;
        p2Cumulative += p2GamePoints;

        // Format label
        const date = new Date(game.createdAt);
        const label = `Game ${index + 1}`;

        labels.push(label);
        player1Points.push(p1Cumulative);
        player2Points.push(p2Cumulative);
    });

    return { labels, player1Points, player2Points };
}

function renderPointsChart(gamesByMonth, player1Name, player2Name) {
    const canvas = document.getElementById('points-chart');
    if (!canvas) return;

    const chartData = generateChartData(gamesByMonth, player1Name);

    // Destroy existing chart if it exists
    if (pointsChart) {
        pointsChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    pointsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: player1Name,
                    data: chartData.player1Points,
                    borderColor: 'rgb(96, 165, 250)',
                    backgroundColor: 'rgba(96, 165, 250, 0.1)',
                    borderWidth: 2,
                    tension: 0.1,
                    fill: false
                },
                {
                    label: player2Name,
                    data: chartData.player2Points,
                    borderColor: 'rgb(248, 113, 113)',
                    backgroundColor: 'rgba(248, 113, 113, 0.1)',
                    borderWidth: 2,
                    tension: 0.1,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: 'rgb(209, 213, 219)',
                        font: {
                            family: "'Fira Code', monospace"
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: 'rgb(156, 163, 175)',
                        font: {
                            family: "'Fira Code', monospace"
                        },
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 10
                    },
                    grid: {
                        color: 'rgba(75, 85, 99, 0.3)'
                    }
                },
                y: {
                    ticks: {
                        color: 'rgb(156, 163, 175)',
                        font: {
                            family: "'Fira Code', monospace"
                        }
                    },
                    grid: {
                        color: 'rgba(75, 85, 99, 0.3)'
                    }
                }
            }
        }
    });
}

function displayStats(stats) {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const statsContainer = document.getElementById('stats-container');

    if (!stats) {
        if (errorEl) {
            errorEl.textContent = 'No blitz game data available for selected period.';
            errorEl.classList.remove('hidden');
        }
        if (loadingEl) loadingEl.classList.add('hidden');
        return;
    }

    // Hide loading, show stats
    if (loadingEl) loadingEl.classList.add('hidden');
    if (statsContainer) statsContainer.classList.remove('hidden');

    // Update title
    const titleEl = document.getElementById('main-title');
    if (titleEl) {
        titleEl.textContent = `Lichess Blitz Stats: ${stats.player1Name} vs ${stats.player2Name}`;
    }

    // Total games
    const totalGamesEl = document.getElementById('total-games');
    if (totalGamesEl) totalGamesEl.textContent = stats.totalGames;

    // Player names
    const p1Name = document.querySelectorAll('#player1-name');
    const p2Name = document.querySelectorAll('#player2-name');
    p1Name.forEach(el => { if (el) el.textContent = stats.player1Name; });
    p2Name.forEach(el => { if (el) el.textContent = stats.player2Name; });

    // Wins
    const p1Wins = document.getElementById('player1-wins');
    const p2Wins = document.getElementById('player2-wins');
    if (p1Wins) p1Wins.textContent = stats.player1.wins;
    if (p2Wins) p2Wins.textContent = stats.player2.wins;

    // Draws (single element, same for both players)
    const draws = document.getElementById('draws');
    if (draws) draws.textContent = stats.player1.draws;

    // Win rates
    const p1Winrate = document.getElementById('player1-winrate');
    const p2Winrate = document.getElementById('player2-winrate');
    const p1WinRate = stats.totalGames > 0 ? ((stats.player1.wins / stats.totalGames) * 100).toFixed(1) : '0.0';
    const p2WinRate = stats.totalGames > 0 ? ((stats.player2.wins / stats.totalGames) * 100).toFixed(1) : '0.0';
    if (p1Winrate) p1Winrate.textContent = `${p1WinRate}%`;
    if (p2Winrate) p2Winrate.textContent = `${p2WinRate}%`;

    // Best streaks
    const p1Streak = document.getElementById('player1-streak');
    const p2Streak = document.getElementById('player2-streak');
    if (p1Streak) p1Streak.textContent = stats.player1.bestStreak;
    if (p2Streak) p2Streak.textContent = stats.player2.bestStreak;

    // Table headers
    const tableP1 = document.getElementById('table-player1');
    const tableP2 = document.getElementById('table-player2');
    if (tableP1) tableP1.textContent = stats.player1Name;
    if (tableP2) tableP2.textContent = stats.player2Name;

    // Monthly breakdown
    const monthlyBreakdownContainer = document.getElementById('monthly-breakdown');
    if (monthlyBreakdownContainer) {
        monthlyBreakdownContainer.innerHTML = '';
        const sortedMonths = Object.keys(stats.monthlyStats).sort().reverse();

        sortedMonths.forEach(monthKey => {
            const data = stats.monthlyStats[monthKey];
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-700';

            const streakText = data.streaks.player1 > 0 || data.streaks.player2 > 0
                ? `${stats.player1Name}=${data.streaks.player1}, ${stats.player2Name}=${data.streaks.player2}`
                : '-';

            row.innerHTML = `
                <td class="px-4 py-3">${formatMonthName(monthKey)}</td>
                <td class="px-4 py-3 text-center">${data.games}</td>
                <td class="px-4 py-3 text-center text-blue-400">${data.player1Wins}</td>
                <td class="px-4 py-3 text-center">${data.draws}</td>
                <td class="px-4 py-3 text-center text-red-400">${data.player2Wins}</td>
                <td class="px-4 py-3">${streakText}</td>
            `;
            monthlyBreakdownContainer.appendChild(row);
        });
    }

    // Termination stats
    const terminationContainer = document.getElementById('termination-stats');
    if (terminationContainer) {
        terminationContainer.innerHTML = '';
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

function calculateOpeningStats(gamesByMonth, player1Name, player2Name) {
    const allGames = Object.values(gamesByMonth).flat();

    const player1AsWhite = {};
    const player1AsBlack = {};
    const player2AsWhite = {};
    const player2AsBlack = {};

    allGames.forEach(game => {
        if (!game.opening || !game.opening.name) return;

        const openingName = game.opening.name;
        const whitePlayer = game.players.white.user.name;
        const blackPlayer = game.players.black.user.name;
        const winner = game.winner;

        // Determine which player is white and black
        const isPlayer1White = whitePlayer === player1Name;

        // Initialize opening stats if needed
        const initOpening = (obj, opening) => {
            if (!obj[opening]) {
                obj[opening] = { wins: 0, draws: 0, losses: 0, games: 0 };
            }
        };

        if (isPlayer1White) {
            // Player 1 as white, Player 2 as black
            initOpening(player1AsWhite, openingName);
            initOpening(player2AsBlack, openingName);

            player1AsWhite[openingName].games++;
            player2AsBlack[openingName].games++;

            if (winner === 'white') {
                player1AsWhite[openingName].wins++;
                player2AsBlack[openingName].losses++;
            } else if (winner === 'black') {
                player1AsWhite[openingName].losses++;
                player2AsBlack[openingName].wins++;
            } else {
                player1AsWhite[openingName].draws++;
                player2AsBlack[openingName].draws++;
            }
        } else {
            // Player 2 as white, Player 1 as black
            initOpening(player2AsWhite, openingName);
            initOpening(player1AsBlack, openingName);

            player2AsWhite[openingName].games++;
            player1AsBlack[openingName].games++;

            if (winner === 'white') {
                player2AsWhite[openingName].wins++;
                player1AsBlack[openingName].losses++;
            } else if (winner === 'black') {
                player2AsWhite[openingName].losses++;
                player1AsBlack[openingName].wins++;
            } else {
                player2AsWhite[openingName].draws++;
                player1AsBlack[openingName].draws++;
            }
        }
    });

    return {
        player1AsWhite,
        player1AsBlack,
        player2AsWhite,
        player2AsBlack
    };
}

function displayOpeningStats(gamesByMonth, player1Name, player2Name) {
    const openingStats = calculateOpeningStats(gamesByMonth, player1Name, player2Name);

    // Update titles
    const p1OpeningsTitle = document.getElementById('player1-openings-title');
    const p2OpeningsTitle = document.getElementById('player2-openings-title');
    if (p1OpeningsTitle) p1OpeningsTitle.textContent = player1Name;
    if (p2OpeningsTitle) p2OpeningsTitle.textContent = player2Name;

    // Helper function to render opening list
    const renderOpeningList = (containerId, openings) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        // Calculate success rate and sort
        const openingList = Object.entries(openings).map(([name, stats]) => {
            const points = stats.wins + stats.draws * 0.5;
            const successRate = stats.games > 0 ? (points / stats.games) * 100 : 0;
            return { name, ...stats, successRate };
        });

        // Sort by success rate, then by number of games
        openingList.sort((a, b) => {
            if (Math.abs(b.successRate - a.successRate) > 0.1) {
                return b.successRate - a.successRate;
            }
            return b.games - a.games;
        });

        // Show top 10 openings
        openingList.slice(0, 10).forEach(opening => {
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center py-1 border-b border-gray-700/50';

            const successColor = opening.successRate >= 60 ? 'text-green-400' :
                                 opening.successRate >= 40 ? 'text-yellow-400' : 'text-red-400';

            div.innerHTML = `
                <div class="flex-1">
                    <div class="text-gray-200">${opening.name}</div>
                    <div class="text-xs text-gray-500">
                        ${opening.wins}W-${opening.draws}D-${opening.losses}L (${opening.games} games)
                    </div>
                </div>
                <div class="text-right ml-2">
                    <div class="${successColor} font-bold">${opening.successRate.toFixed(0)}%</div>
                </div>
            `;
            container.appendChild(div);
        });

        if (openingList.length === 0) {
            container.innerHTML = '<div class="text-gray-500 text-xs">No data</div>';
        }
    };

    renderOpeningList('player1-white-openings', openingStats.player1AsWhite);
    renderOpeningList('player1-black-openings', openingStats.player1AsBlack);
    renderOpeningList('player2-white-openings', openingStats.player2AsWhite);
    renderOpeningList('player2-black-openings', openingStats.player2AsBlack);
}

function displayStatsWithChart(gamesByMonth) {
    const stats = calculateStats(gamesByMonth);
    displayStats(stats);

    // Render the points chart and opening stats
    if (stats && Object.keys(gamesByMonth).length > 0) {
        const [player1Name, player2Name] = getPlayerNames(globalGamesByMonth);
        renderPointsChart(gamesByMonth, player1Name, player2Name);
        displayOpeningStats(gamesByMonth, player1Name, player2Name);
    }
}

function setupDateRangeSelectors() {
    // Get all unique years and months from game data
    const years = new Set();
    const monthsByYear = {};

    Object.keys(globalGamesByMonth).forEach(monthKey => {
        const [year, month] = monthKey.split('-');
        years.add(year);
        if (!monthsByYear[year]) {
            monthsByYear[year] = new Set();
        }
        monthsByYear[year].add(month);
    });

    // Populate year selector
    const yearSelect = document.getElementById('year-select');
    if (yearSelect) {
        Array.from(years).sort().forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });
    }

    // Update month selector when year changes
    const monthSelect = document.getElementById('month-select');
    const updateMonthSelector = (year) => {
        if (!monthSelect) return;
        monthSelect.innerHTML = '<option value="all">All Months</option>';

        if (year !== 'all' && monthsByYear[year]) {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            Array.from(monthsByYear[year]).sort().forEach(month => {
                const option = document.createElement('option');
                option.value = month;
                option.textContent = monthNames[parseInt(month) - 1];
                monthSelect.appendChild(option);
            });
        }
    };

    // Handle URL hash routing
    const updateFromHash = () => {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const year = params.get('year') || 'all';
        const month = params.get('month') || 'all';

        if (yearSelect) yearSelect.value = year;
        updateMonthSelector(year);
        if (monthSelect) monthSelect.value = month;

        // Recalculate stats and render chart
        const filteredGames = filterGamesByDateRange(globalGamesByMonth, year, month);
        displayStatsWithChart(filteredGames);
    };

    // Event listeners
    if (yearSelect) {
        yearSelect.addEventListener('change', () => {
            const year = yearSelect.value;
            updateMonthSelector(year);
            if (monthSelect) monthSelect.value = 'all';
            const hash = year === 'all' ? '' : `year=${year}&month=all`;
            window.location.hash = hash;
        });
    }

    if (monthSelect) {
        monthSelect.addEventListener('change', () => {
            const year = yearSelect ? yearSelect.value : 'all';
            const month = monthSelect.value;
            const hash = year === 'all' ? '' : `year=${year}&month=${month}`;
            window.location.hash = hash;
        });
    }

    // Handle hash changes
    window.addEventListener('hashchange', updateFromHash);

    // Initial load from hash
    updateFromHash();
}

// Initialize
async function init() {
    try {
        globalGamesByMonth = await loadAllGames();
        globalPlayerNames = getPlayerNames(globalGamesByMonth);

        setupDateRangeSelectors();
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
