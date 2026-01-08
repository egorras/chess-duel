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

function displayOpeningStats(gamesByMonth, player1Name, player2Name) {
    console.log('displayOpeningStats called with:', Object.keys(gamesByMonth).length, 'months');
    console.log('Player names:', player1Name, player2Name);

    const openingStats = calculateOpeningStats(gamesByMonth, player1Name, player2Name);

    console.log('Opening stats calculated:', openingStats);
    console.log('Player 1 as White openings:', Object.keys(openingStats.player1AsWhite).length);
    console.log('Player 1 as Black openings:', Object.keys(openingStats.player1AsBlack).length);

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

            // Convert opening name to chess.com URL format
            const openingUrl = opening.name
                .replace(/[':,\.]/g, '')
                .replace(/\s+/g, '-')
                .replace(/--+/g, '-');

            div.innerHTML = `
                <div class="flex-1">
                    <a href="https://www.chess.com/openings/${openingUrl}"
                       target="_blank"
                       rel="noopener noreferrer"
                       class="text-gray-200 hover:text-blue-400 hover:underline">
                        ${opening.name}
                    </a>
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
