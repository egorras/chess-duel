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

    // Total games and date range
    const totalGamesEl = document.getElementById('total-games');
    const dateRangeEl = document.getElementById('date-range');
    if (totalGamesEl) totalGamesEl.textContent = stats.totalGames;
    if (dateRangeEl) dateRangeEl.textContent = stats.dateRange;

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

    // Additional stats - Player names
    const statsP1 = document.getElementById('stats-player1');
    const statsP2 = document.getElementById('stats-player2');
    if (statsP1) statsP1.textContent = stats.player1Name;
    if (statsP2) statsP2.textContent = stats.player2Name;

    // Accuracy stats
    const p1Accuracy = document.getElementById('player1-accuracy');
    const p2Accuracy = document.getElementById('player2-accuracy');
    if (p1Accuracy) p1Accuracy.textContent = `${stats.player1.avgAccuracy}%`;
    if (p2Accuracy) p2Accuracy.textContent = `${stats.player2.avgAccuracy}%`;

    // Blunders and mistakes
    const p1Blunders = document.getElementById('player1-blunders');
    const p2Blunders = document.getElementById('player2-blunders');
    const p1Mistakes = document.getElementById('player1-mistakes');
    const p2Mistakes = document.getElementById('player2-mistakes');
    if (p1Blunders) p1Blunders.textContent = stats.player1.blunders;
    if (p2Blunders) p2Blunders.textContent = stats.player2.blunders;
    if (p1Mistakes) p1Mistakes.textContent = stats.player1.mistakes;
    if (p2Mistakes) p2Mistakes.textContent = stats.player2.mistakes;

    // Game length stats
    const avgGameLength = document.getElementById('avg-game-length');
    const longestGame = document.getElementById('longest-game');
    const shortestGame = document.getElementById('shortest-game');
    const longestGameLink = document.getElementById('longest-game-link');
    const shortestGameLink = document.getElementById('shortest-game-link');

    if (avgGameLength) avgGameLength.textContent = stats.avgGameLength;
    if (longestGame) longestGame.textContent = stats.longestGame;
    if (shortestGame) shortestGame.textContent = stats.shortestGame;

    // Set links to Lichess games
    if (longestGameLink && stats.longestGameId) {
        longestGameLink.href = `https://lichess.org/${stats.longestGameId}`;
    }
    if (shortestGameLink && stats.shortestGameId) {
        shortestGameLink.href = `https://lichess.org/${stats.shortestGameId}`;
    }

    // Most common stats
    const mostCommonTermination = document.getElementById('most-common-termination');
    const mostCommonOpening = document.getElementById('most-common-opening');

    const terminationLabels = {
        'mate': 'Checkmate',
        'resign': 'Resignation',
        'timeout': 'Timeout',
        'draw': 'Draw',
        'stalemate': 'Stalemate',
        'outoftime': 'Out of Time'
    };

    if (mostCommonTermination) {
        mostCommonTermination.textContent = terminationLabels[stats.mostCommonTermination] || stats.mostCommonTermination;
    }
    if (mostCommonOpening) {
        // Truncate long opening names
        const openingName = stats.mostCommonOpening;
        mostCommonOpening.textContent = openingName.length > 20 ? openingName.substring(0, 20) + '...' : openingName;
        mostCommonOpening.title = openingName; // Show full name on hover
    }

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

function displaySkirmishStats(gamesByMonth, player1Name, player2Name) {
    const skirmishes = clusterGamesIntoSkirmishes(gamesByMonth, player1Name);
    const skirmishStats = calculateSkirmishStats(skirmishes);

    // Update player names in headers
    const skirmishP1 = document.getElementById('skirmish-player1');
    const skirmishP2 = document.getElementById('skirmish-player2');
    if (skirmishP1) skirmishP1.textContent = player1Name;
    if (skirmishP2) skirmishP2.textContent = player2Name;

    // Update summary stats
    const totalSkirmishes = document.getElementById('total-skirmishes');
    const avgGamesPerSkirmish = document.getElementById('avg-games-per-skirmish');
    const skirmishP1Wins = document.getElementById('skirmish-player1-wins');
    const skirmishP2Wins = document.getElementById('skirmish-player2-wins');

    if (totalSkirmishes) totalSkirmishes.textContent = skirmishStats.totalSkirmishes;
    if (avgGamesPerSkirmish) avgGamesPerSkirmish.textContent = `${skirmishStats.avgGamesPerSkirmish} games avg`;
    if (skirmishP1Wins) skirmishP1Wins.textContent = skirmishStats.player1Wins;
    if (skirmishP2Wins) skirmishP2Wins.textContent = skirmishStats.player2Wins;

    // Display recent skirmishes
    const recentSkirmishesContainer = document.getElementById('recent-skirmishes');
    if (!recentSkirmishesContainer) return;

    recentSkirmishesContainer.innerHTML = '';

    // Show last 10 skirmishes, most recent first
    const recentSkirmishes = skirmishes.slice(-10).reverse();

    recentSkirmishes.forEach((skirmish, index) => {
        const container = document.createElement('div');
        container.className = 'bg-gray-900 rounded border border-gray-700';

        const winnerClass = skirmish.winner === 'player1' ? 'text-blue-400' :
                           skirmish.winner === 'player2' ? 'text-red-400' : 'text-gray-400';
        const winnerText = skirmish.winner === 'player1' ? player1Name :
                          skirmish.winner === 'player2' ? player2Name : 'Draw';

        // Create header (clickable to expand)
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between p-3 cursor-pointer hover:bg-gray-800';
        header.innerHTML = `
            <div class="flex items-center gap-3">
                <svg class="accordion-arrow w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
                <div class="text-gray-500 text-xs">${skirmish.date}</div>
                <div class="font-bold ${winnerClass}">${winnerText}</div>
            </div>
            <div class="flex items-center gap-4 text-sm">
                <div class="text-blue-400 font-bold">${skirmish.player1Score}</div>
                <div class="text-gray-500">-</div>
                <div class="text-red-400 font-bold">${skirmish.player2Score}</div>
                <div class="text-gray-500 text-xs">${skirmish.totalGames} games</div>
                <div class="text-gray-500 text-xs">${skirmish.duration}m</div>
            </div>
        `;

        // Create details section (expandable)
        const details = document.createElement('div');
        details.className = 'skirmish-details';

        // Create games table
        let tableHTML = `
            <div class="border-t border-gray-700 p-3">
                <div class="overflow-x-auto">
                    <table class="w-full text-xs">
                        <thead>
                            <tr class="border-b border-gray-700 text-gray-400">
                                <th class="px-2 py-2 text-left">#</th>
                                <th class="px-2 py-2 text-center">White</th>
                                <th class="px-2 py-2 text-center">Black</th>
                                <th class="px-2 py-2 text-left">Opening</th>
                                <th class="px-2 py-2 text-center">Result</th>
                                <th class="px-2 py-2 text-center">Moves</th>
                                <th class="px-2 py-2 text-center">W Acc</th>
                                <th class="px-2 py-2 text-center">B Acc</th>
                                <th class="px-2 py-2 text-center">Link</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-700">
        `;

        skirmish.games.forEach((game, gameIndex) => {
            const whitePlayer = game.players.white.user.name;
            const blackPlayer = game.players.black.user.name;
            const isPlayer1White = whitePlayer === player1Name;

            const whiteColor = isPlayer1White ? 'text-blue-400' : 'text-red-400';
            const blackColor = isPlayer1White ? 'text-red-400' : 'text-blue-400';

            const whiteAcc = game.players.white.analysis?.accuracy || '-';
            const blackAcc = game.players.black.analysis?.accuracy || '-';

            const moveCount = game.moves ? game.moves.split(' ').length : 0;
            const openingName = game.opening?.name || 'Unknown';
            const openingShort = openingName.length > 30 ? openingName.substring(0, 30) + '...' : openingName;

            let resultText = '';
            let resultClass = '';
            if (game.winner === 'white') {
                resultText = '1-0';
                resultClass = whiteColor;
            } else if (game.winner === 'black') {
                resultText = '0-1';
                resultClass = blackColor;
            } else {
                resultText = '½-½';
                resultClass = 'text-gray-400';
            }

            tableHTML += `
                <tr class="hover:bg-gray-800">
                    <td class="px-2 py-2 text-gray-500">${gameIndex + 1}</td>
                    <td class="px-2 py-2 text-center ${whiteColor}">${whitePlayer}</td>
                    <td class="px-2 py-2 text-center ${blackColor}">${blackPlayer}</td>
                    <td class="px-2 py-2" title="${openingName}">${openingShort}</td>
                    <td class="px-2 py-2 text-center font-bold ${resultClass}">${resultText}</td>
                    <td class="px-2 py-2 text-center text-gray-400">${moveCount}</td>
                    <td class="px-2 py-2 text-center ${whiteAcc !== '-' && whiteAcc >= 80 ? 'text-green-400' : 'text-gray-400'}">${whiteAcc !== '-' ? whiteAcc + '%' : '-'}</td>
                    <td class="px-2 py-2 text-center ${blackAcc !== '-' && blackAcc >= 80 ? 'text-green-400' : 'text-gray-400'}">${blackAcc !== '-' ? blackAcc + '%' : '-'}</td>
                    <td class="px-2 py-2 text-center">
                        <a href="https://lichess.org/${game.id}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">View</a>
                    </td>
                </tr>
            `;
        });

        tableHTML += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        details.innerHTML = tableHTML;

        // Add click event to toggle accordion
        header.addEventListener('click', () => {
            const arrow = header.querySelector('.accordion-arrow');
            details.classList.toggle('expanded');
            arrow.classList.toggle('expanded');
        });

        container.appendChild(header);
        container.appendChild(details);
        recentSkirmishesContainer.appendChild(container);
    });

    if (recentSkirmishes.length === 0) {
        recentSkirmishesContainer.innerHTML = '<div class="text-gray-500 text-sm text-center py-4">No skirmishes found</div>';
    }
}

function displayOpeningStats(gamesByMonth, player1Name, player2Name) {
    console.log('displayOpeningStats called with:', Object.keys(gamesByMonth).length, 'months');
    console.log('Player names:', player1Name, player2Name);

    const openingStats = calculateOpeningStats(gamesByMonth, player1Name, player2Name);

    console.log('Opening stats calculated:', openingStats);
    console.log('Total unique openings:', Object.keys(openingStats).length);

    // Update table headers with player names
    const p1Header = document.getElementById('openings-player1');
    const p2Header = document.getElementById('openings-player2');
    if (p1Header) p1Header.textContent = player1Name;
    if (p2Header) p2Header.textContent = player2Name;

    const tableBody = document.getElementById('openings-table');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    // Convert to array and sort by number of games (most played first)
    const openingList = Object.entries(openingStats).map(([name, stats]) => ({
        name,
        ...stats
    }));

    openingList.sort((a, b) => b.games - a.games);

    // Show top 10 openings
    openingList.slice(0, 10).forEach(opening => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-700';

        // Convert opening name to chess.com URL format
        const openingUrl = opening.name
            .replace(/[':,\.]/g, '')
            .replace(/\s+/g, '-')
            .replace(/--+/g, '-');

        row.innerHTML = `
            <td class="px-4 py-3">
                <a href="https://www.chess.com/openings/${openingUrl}"
                   target="_blank"
                   rel="noopener noreferrer"
                   class="text-gray-200 hover:text-blue-400 hover:underline">
                    ${opening.name}
                </a>
            </td>
            <td class="px-4 py-3 text-center text-blue-400 font-bold">${opening.player1Wins}</td>
            <td class="px-4 py-3 text-center text-gray-400">${opening.draws}</td>
            <td class="px-4 py-3 text-center text-red-400 font-bold">${opening.player2Wins}</td>
            <td class="px-4 py-3 text-center text-gray-500">${opening.games}</td>
        `;
        tableBody.appendChild(row);
    });

    if (openingList.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="5" class="px-4 py-3 text-center text-gray-500">No opening data available</td>';
        tableBody.appendChild(row);
    }
}
