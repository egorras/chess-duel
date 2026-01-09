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

    // Hide loading and error
    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorEl) errorEl.classList.add('hidden');
    if (statsContainer) statsContainer.classList.remove('hidden');

    // If no stats, use default empty stats
    if (!stats) {
        // Get player names from global data if available
        const playerNames = getPlayerNames(globalGamesByMonth) || ['Player 1', 'Player 2'];
        
        const emptyStats = {
            player1Name: playerNames[0],
            player2Name: playerNames[1],
            totalGames: 0,
            player1: { wins: 0, losses: 0, draws: 0, bestStreak: 0, avgAccuracy: 0, blunders: 0, mistakes: 0 },
            player2: { wins: 0, losses: 0, draws: 0, bestStreak: 0, avgAccuracy: 0, blunders: 0, mistakes: 0 },
            avgGameLength: '-',
            longestGame: '-',
            shortestGame: '-',
            longestGameId: null,
            shortestGameId: null,
            mostCommonTermination: '-',
            mostCommonOpening: '-',
            monthlyStats: {}
        };
        stats = emptyStats;
    }

    // Total games and date range
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

    // Win rates (ignoring draws: wins / (wins + losses))
    const p1Winrate = document.getElementById('player1-winrate');
    const p2Winrate = document.getElementById('player2-winrate');
    const p1DecisiveGames = stats.player1.wins + stats.player1.losses;
    const p2DecisiveGames = stats.player2.wins + stats.player2.losses;
    const p1WinRate = p1DecisiveGames > 0 ? ((stats.player1.wins / p1DecisiveGames) * 100).toFixed(1) : '0.0';
    const p2WinRate = p2DecisiveGames > 0 ? ((stats.player2.wins / p2DecisiveGames) * 100).toFixed(1) : '0.0';
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
        const sortedMonths = Object.keys(stats.monthlyStats).sort();

        sortedMonths.forEach(monthKey => {
            const data = stats.monthlyStats[monthKey];
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-700';

            // Display streaks with player colors
            let streakText = '-';
            if (data.streaks.player1 > 0 || data.streaks.player2 > 0) {
                const p1Streak = data.streaks.player1 || 0;
                const p2Streak = data.streaks.player2 || 0;
                streakText = `<span class="text-red-400">${p1Streak}</span> - <span class="text-blue-400">${p2Streak}</span>`;
            }

            // Win rates ignoring draws: wins / (wins + losses)
            const p1DecisiveGames = data.player1Wins + (data.games - data.player1Wins - data.draws);
            const p2DecisiveGames = data.player2Wins + (data.games - data.player2Wins - data.draws);
            const p1WinRate = p1DecisiveGames > 0 ? ((data.player1Wins / p1DecisiveGames) * 100).toFixed(1) : '0.0';
            const p2WinRate = p2DecisiveGames > 0 ? ((data.player2Wins / p2DecisiveGames) * 100).toFixed(1) : '0.0';

            row.innerHTML = `
                <td class="px-2 py-2">${formatMonthName(monthKey)}</td>
                <td class="px-2 py-2 text-center">${data.games}</td>
                <td class="px-2 py-2 text-center text-red-400">${data.player1Wins} (${p1WinRate}%)</td>
                <td class="px-2 py-2 text-center">${data.draws}</td>
                <td class="px-2 py-2 text-center text-blue-400">${data.player2Wins} (${p2WinRate}%)</td>
                <td class="px-2 py-2">${streakText}</td>
            `;
            monthlyBreakdownContainer.appendChild(row);
        });
    }

    // Player comparison stats (combined with termination)
    displayPlayerComparisonStats(stats);
}

function displayPlayerComparisonStats(stats) {
    const container = document.getElementById('player-comparison-stats');
    if (!container) return;

    container.innerHTML = '';

    // Create comparison table
    let tableHTML = `
        <div class="overflow-x-auto">
            <table class="w-full text-xs">
                <thead>
                    <tr class="border-b border-gray-700 bg-gray-900">
                        <th class="px-2 py-2 text-left text-gray-400 font-semibold">Statistic</th>
                        <th class="px-2 py-2 text-center text-red-400 font-semibold">${stats.player1Name}</th>
                        <th class="px-2 py-2 text-center text-blue-400 font-semibold">${stats.player2Name}</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-700">
    `;

    // Current Streak
    tableHTML += `
                    <tr class="hover:bg-gray-700">
                        <td class="px-2 py-2 font-semibold text-gray-300">Current Streak</td>
                        <td class="px-2 py-2 text-center text-red-400 font-bold">${stats.player1.currentStreak || 0}</td>
                        <td class="px-2 py-2 text-center text-blue-400 font-bold">${stats.player2.currentStreak || 0}</td>
                    </tr>
                    <tr class="hover:bg-gray-700">
                        <td class="px-2 py-2 font-semibold text-gray-300">Best Streak</td>
                        <td class="px-2 py-2 text-center text-red-400 font-bold">${stats.player1.bestStreak}</td>
                        <td class="px-2 py-2 text-center text-blue-400 font-bold">${stats.player2.bestStreak}</td>
                    </tr>
    `;

    // Win Rate by Color (ignoring draws: wins / (wins + losses))
    const p1WhiteLosses = stats.player1.gamesAsWhite - stats.player1.winsAsWhite;
    const p1BlackLosses = stats.player1.gamesAsBlack - stats.player1.winsAsBlack;
    const p2WhiteLosses = stats.player2.gamesAsWhite - stats.player2.winsAsWhite;
    const p2BlackLosses = stats.player2.gamesAsBlack - stats.player2.winsAsBlack;
    
    const p1WhiteDecisive = stats.player1.winsAsWhite + p1WhiteLosses;
    const p1BlackDecisive = stats.player1.winsAsBlack + p1BlackLosses;
    const p2WhiteDecisive = stats.player2.winsAsWhite + p2WhiteLosses;
    const p2BlackDecisive = stats.player2.winsAsBlack + p2BlackLosses;
    
    const p1WhiteWinRate = p1WhiteDecisive > 0 
        ? ((stats.player1.winsAsWhite / p1WhiteDecisive) * 100).toFixed(1) 
        : '0.0';
    const p1BlackWinRate = p1BlackDecisive > 0 
        ? ((stats.player1.winsAsBlack / p1BlackDecisive) * 100).toFixed(1) 
        : '0.0';
    const p2WhiteWinRate = p2WhiteDecisive > 0 
        ? ((stats.player2.winsAsWhite / p2WhiteDecisive) * 100).toFixed(1) 
        : '0.0';
    const p2BlackWinRate = p2BlackDecisive > 0 
        ? ((stats.player2.winsAsBlack / p2BlackDecisive) * 100).toFixed(1) 
        : '0.0';

    tableHTML += `
                    <tr class="hover:bg-gray-700 border-t-2 border-gray-600">
                        <td class="px-2 py-2 font-semibold text-gray-300">Win Rate as White</td>
                        <td class="px-2 py-2 text-center text-red-400 font-bold">${p1WhiteWinRate}%</td>
                        <td class="px-2 py-2 text-center text-blue-400 font-bold">${p2WhiteWinRate}%</td>
                    </tr>
                    <tr class="hover:bg-gray-700">
                        <td class="px-2 py-2 font-semibold text-gray-300">Win Rate as Black</td>
                        <td class="px-2 py-2 text-center text-red-400 font-bold">${p1BlackWinRate}%</td>
                        <td class="px-2 py-2 text-center text-blue-400 font-bold">${p2BlackWinRate}%</td>
                    </tr>
    `;

    // Average King Walks (optimized reduce)
    const p1AvgKingWalks = stats.player1.kingWalks.length > 0
        ? (stats.player1.kingWalks.reduce((sum, val) => sum + val, 0) / stats.player1.kingWalks.length).toFixed(1)
        : '0.0';
    const p2AvgKingWalks = stats.player2.kingWalks.length > 0
        ? (stats.player2.kingWalks.reduce((sum, val) => sum + val, 0) / stats.player2.kingWalks.length).toFixed(1)
        : '0.0';

    tableHTML += `
                    <tr class="hover:bg-gray-700 border-t-2 border-gray-600">
                        <td class="px-2 py-2 font-semibold text-gray-300">Avg King Walks/Game</td>
                        <td class="px-2 py-2 text-center text-red-400 font-bold">${p1AvgKingWalks}</td>
                        <td class="px-2 py-2 text-center text-blue-400 font-bold">${p2AvgKingWalks}</td>
                    </tr>
    `;

    // Fastest Win
    const p1FastestWin = stats.player1.fastestWin !== Infinity ? stats.player1.fastestWin : '-';
    const p2FastestWin = stats.player2.fastestWin !== Infinity ? stats.player2.fastestWin : '-';
    tableHTML += `
                    <tr class="hover:bg-gray-700">
                        <td class="px-2 py-2 font-semibold text-gray-300">Fastest Win (moves)</td>
                        <td class="px-2 py-2 text-center text-red-400 font-bold">${p1FastestWin}</td>
                        <td class="px-2 py-2 text-center text-blue-400 font-bold">${p2FastestWin}</td>
                    </tr>
    `;

    // Time Pressure Wins
    tableHTML += `
                    <tr class="hover:bg-gray-700 border-t-2 border-gray-600">
                        <td class="px-2 py-2 font-semibold text-gray-300">Time Pressure Wins (&lt;30s)</td>
                        <td class="px-2 py-2 text-center text-red-400 font-bold">${stats.player1.timePressureWins || 0}</td>
                        <td class="px-2 py-2 text-center text-blue-400 font-bold">${stats.player2.timePressureWins || 0}</td>
                    </tr>
    `;

    // Average Time Remaining (optimized reduce)
    const p1AvgTime = stats.player1.avgTimeRemaining.length > 0
        ? Math.round(stats.player1.avgTimeRemaining.reduce((sum, val) => sum + val, 0) / stats.player1.avgTimeRemaining.length)
        : '-';
    const p2AvgTime = stats.player2.avgTimeRemaining.length > 0
        ? Math.round(stats.player2.avgTimeRemaining.reduce((sum, val) => sum + val, 0) / stats.player2.avgTimeRemaining.length)
        : '-';
    tableHTML += `
                    <tr class="hover:bg-gray-700">
                        <td class="px-2 py-2 font-semibold text-gray-300">Avg Time Remaining (s)</td>
                        <td class="px-2 py-2 text-center text-red-400 font-bold">${p1AvgTime}</td>
                        <td class="px-2 py-2 text-center text-blue-400 font-bold">${p2AvgTime}</td>
                    </tr>
    `;

    // Most Common First Move
    const p1FirstMove = Object.keys(stats.player1.firstMoves || {}).length > 0
        ? Object.keys(stats.player1.firstMoves).sort((a, b) => 
            stats.player1.firstMoves[b] - stats.player1.firstMoves[a]
        )[0]
        : '-';
    const p2FirstMove = Object.keys(stats.player2.firstMoves || {}).length > 0
        ? Object.keys(stats.player2.firstMoves).sort((a, b) => 
            stats.player2.firstMoves[b] - stats.player2.firstMoves[a]
        )[0]
        : '-';
    
    tableHTML += `
                    <tr class="hover:bg-gray-700 border-t-2 border-gray-600">
                        <td class="px-2 py-2 font-semibold text-gray-300">Most Common First Move</td>
                        <td class="px-2 py-2 text-center text-red-400 font-bold">${p1FirstMove}</td>
                        <td class="px-2 py-2 text-center text-blue-400 font-bold">${p2FirstMove}</td>
                    </tr>
    `;

    // Average Accuracy
    tableHTML += `
                    <tr class="hover:bg-gray-700 border-t-2 border-gray-600">
                        <td class="px-2 py-2 font-semibold text-gray-300">Average Accuracy</td>
                        <td class="px-2 py-2 text-center text-red-400 font-bold">${stats.player1.avgAccuracy}%</td>
                        <td class="px-2 py-2 text-center text-blue-400 font-bold">${stats.player2.avgAccuracy}%</td>
                    </tr>
    `;

    // Errors
    tableHTML += `
                    <tr class="hover:bg-gray-700">
                        <td class="px-2 py-2 font-semibold text-gray-300">Blunders</td>
                        <td class="px-2 py-2 text-center text-red-400 font-bold">${stats.player1.blunders}</td>
                        <td class="px-2 py-2 text-center text-blue-400 font-bold">${stats.player2.blunders}</td>
                    </tr>
                    <tr class="hover:bg-gray-700">
                        <td class="px-2 py-2 font-semibold text-gray-300">Mistakes</td>
                        <td class="px-2 py-2 text-center text-red-400 font-bold">${stats.player1.mistakes}</td>
                        <td class="px-2 py-2 text-center text-blue-400 font-bold">${stats.player2.mistakes}</td>
                    </tr>
                    <tr class="hover:bg-gray-700">
                        <td class="px-2 py-2 font-semibold text-gray-300">Inaccuracies</td>
                        <td class="px-2 py-2 text-center text-red-400 font-bold">${stats.player1.inaccuracies}</td>
                        <td class="px-2 py-2 text-center text-blue-400 font-bold">${stats.player2.inaccuracies}</td>
                    </tr>
    `;

    // Game Length stats
    if (stats.gameLengths.length > 0) {
        const avgLength = Math.round(stats.gameLengths.reduce((sum, val) => sum + val, 0) / stats.gameLengths.length);
        tableHTML += `
                    <tr class="hover:bg-gray-700 border-t-2 border-gray-600">
                        <td class="px-2 py-2 font-semibold text-gray-300">Average Game Length</td>
                        <td class="px-2 py-2 text-center text-gray-300" colspan="2">${avgLength} moves</td>
                    </tr>
                    <tr class="hover:bg-gray-700">
                        <td class="px-2 py-2 font-semibold text-gray-300">Longest Game</td>
                        <td class="px-2 py-2 text-center text-gray-300" colspan="2">${stats.longestGameLength} moves</td>
                    </tr>
                    <tr class="hover:bg-gray-700">
                        <td class="px-2 py-2 font-semibold text-gray-300">Shortest Game</td>
                        <td class="px-2 py-2 text-center text-gray-300" colspan="2">${stats.shortestGameLength} moves</td>
                    </tr>
        `;
    }

    // Game Termination stats
    const terminationLabels = {
        'mate': 'Checkmate',
        'resign': 'Resignation',
        'timeout': 'Timeout',
        'draw': 'Draw Agreement',
        'stalemate': 'Stalemate',
        'outoftime': 'Out of Time',
        'unknown': 'Unknown'
    };

    const sortedTerminations = Object.keys(stats.byTermination).sort((a, b) =>
        stats.byTermination[b] - stats.byTermination[a]
    );

    if (sortedTerminations.length > 0) {
        tableHTML += `
                    <tr class="hover:bg-gray-700 border-t-2 border-gray-600">
                        <td class="px-2 py-2 font-semibold text-gray-300" colspan="3">Game Termination</td>
                    </tr>
        `;

        sortedTerminations.forEach(status => {
            const p1Count = stats.player1.byTermination?.[status] || 0;
            const p2Count = stats.player2.byTermination?.[status] || 0;
            const totalCount = stats.byTermination[status];
            
            // For draws, show count for both players (they both participated)
            // For wins, show percentage of total games for that player
            let p1Display = p1Count.toString();
            let p2Display = p2Count.toString();
            
            // Add percentage for non-draw terminations (wins)
            if (status !== 'draw' && status !== 'stalemate') {
                const p1TotalGames = stats.player1.wins + stats.player1.losses + stats.player1.draws;
                const p2TotalGames = stats.player2.wins + stats.player2.losses + stats.player2.draws;
                const p1Pct = p1TotalGames > 0 ? ((p1Count / p1TotalGames) * 100).toFixed(1) : '0.0';
                const p2Pct = p2TotalGames > 0 ? ((p2Count / p2TotalGames) * 100).toFixed(1) : '0.0';
                p1Display = `${p1Count} (${p1Pct}%)`;
                p2Display = `${p2Count} (${p2Pct}%)`;
            }
            
            tableHTML += `
                    <tr class="hover:bg-gray-700">
                        <td class="px-2 py-2 text-gray-300">${terminationLabels[status] || status}</td>
                        <td class="px-2 py-2 text-center text-red-400 font-bold">${p1Display}</td>
                        <td class="px-2 py-2 text-center text-blue-400 font-bold">${p2Display}</td>
                    </tr>
            `;
        });
    }

    tableHTML += `
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = tableHTML;
}

function displaySessionStats(gamesByMonth, player1Name, player2Name) {
    // Check if year filter is 'all' to include year in date
    const route = Router.getCurrentRoute();
    const showYear = route.year === 'all';
    
    const sessions = clusterGamesIntoSessions(gamesByMonth, player1Name);
    const sessionStats = calculateSessionStats(sessions);
    
    // Update session dates to include year if needed
    sessions.forEach(session => {
        const startDate = new Date(session.startTime);
        session.dateFormatted = formatDate24h(startDate, showYear);
    });

    // Update player names in headers
    const sessionP1 = document.getElementById('session-player1');
    const sessionP2 = document.getElementById('session-player2');
    const sessionsTableP1 = document.getElementById('sessions-table-player1');
    const sessionsTableP2 = document.getElementById('sessions-table-player2');
    if (sessionP1) sessionP1.textContent = player1Name;
    if (sessionP2) sessionP2.textContent = player2Name;
    if (sessionsTableP1) sessionsTableP1.textContent = player1Name;
    if (sessionsTableP2) sessionsTableP2.textContent = player2Name;

    // Update summary stats
    const totalSessions = document.getElementById('total-sessions');
    const avgGamesPerSession = document.getElementById('avg-games-per-session');
    const avgSessionTime = document.getElementById('avg-session-time');
    const sessionP1Wins = document.getElementById('session-player1-wins');
    const sessionP2Wins = document.getElementById('session-player2-wins');

    if (totalSessions) totalSessions.textContent = sessionStats.totalSessions;
    if (avgGamesPerSession) avgGamesPerSession.textContent = sessionStats.avgGamesPerSession;
    
    // Format average session time
    if (avgSessionTime) {
        const avgMinutes = sessionStats.avgDuration || 0;
        if (avgMinutes < 60) {
            avgSessionTime.textContent = `${avgMinutes}m`;
        } else {
            const hours = Math.floor(avgMinutes / 60);
            const minutes = avgMinutes % 60;
            avgSessionTime.textContent = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
        }
    }
    
    if (sessionP1Wins) sessionP1Wins.textContent = sessionStats.player1Wins;
    if (sessionP2Wins) sessionP2Wins.textContent = sessionStats.player2Wins;

    // Render sessions table
    renderSessionsTable(sessions, player1Name, player2Name, showYear);
}

let currentSessionSortColumn = 'date';
let currentSessionSortDirection = 'desc';

function renderSessionsTable(sessions, player1Name, player2Name, showYear) {
    const tableBody = document.getElementById('sessions-table');
    if (!tableBody) return;

    // Ensure dateFormatted is set for all sessions
    sessions.forEach(session => {
        if (!session.dateFormatted) {
            const startDate = new Date(session.startTime);
            session.dateFormatted = formatDate24h(startDate, showYear);
        }
    });

    // Sort sessions
    const sortedSessions = [...sessions].sort((a, b) => {
        let comparison = 0;
        
        switch (currentSessionSortColumn) {
            case 'date':
                comparison = new Date(a.startTime) - new Date(b.startTime);
                break;
            case 'player1Score':
                comparison = a.player1Score - b.player1Score;
                break;
            case 'player2Score':
                comparison = a.player2Score - b.player2Score;
                break;
            case 'draws':
                comparison = (a.totalGames - a.player1Score - a.player2Score) - (b.totalGames - b.player1Score - b.player2Score);
                break;
            case 'games':
                comparison = a.totalGames - b.totalGames;
                break;
            case 'duration':
                comparison = a.duration - b.duration;
                break;
            case 'winner':
                // Sort by winner: player1 wins, draws, player2 wins
                const winnerA = a.player1Score > a.player2Score ? 0 : a.player1Score === a.player2Score ? 1 : 2;
                const winnerB = b.player1Score > b.player2Score ? 0 : b.player1Score === b.player2Score ? 1 : 2;
                comparison = winnerA - winnerB;
                break;
        }
        
        return currentSessionSortDirection === 'asc' ? comparison : -comparison;
    });

    tableBody.innerHTML = '';

    if (sortedSessions.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="7" class="px-2 py-2 text-center text-gray-500">No sessions found</td>';
        tableBody.appendChild(row);
        return;
    }

    // Use DocumentFragment for batch DOM updates
    const fragment = document.createDocumentFragment();

    sortedSessions.forEach(session => {
        // Main row (clickable to expand)
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-700 cursor-pointer session-row';

        const draws = session.totalGames - session.player1Score - session.player2Score;
        
        // Determine winner
        let winnerText = '';
        let winnerClass = '';
        if (session.player1Score > session.player2Score) {
            winnerText = player1Name;
            winnerClass = 'text-red-400';
        } else if (session.player2Score > session.player1Score) {
            winnerText = player2Name;
            winnerClass = 'text-blue-400';
        } else {
            winnerText = 'Draw';
            winnerClass = 'text-gray-400';
        }

        row.innerHTML = `
            <td class="px-2 py-2">
                <div class="flex items-center gap-2">
                    <svg class="accordion-arrow w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
                    <span class="text-gray-200">${session.dateFormatted}</span>
            </div>
            </td>
            <td class="px-2 py-2 text-center font-bold ${winnerClass}">${winnerText}</td>
            <td class="px-2 py-2 text-center text-red-400 font-bold hidden sm:table-cell">${session.player1Score}</td>
            <td class="px-2 py-2 text-center text-gray-400 hidden sm:table-cell">${draws}</td>
            <td class="px-2 py-2 text-center text-blue-400 font-bold hidden sm:table-cell">${session.player2Score}</td>
            <td class="px-2 py-2 text-center text-gray-400">${session.totalGames}</td>
            <td class="px-2 py-2 text-center text-gray-400 hidden sm:table-cell">${session.duration}m</td>
        `;
        fragment.appendChild(row);

        // Expandable details row
        const detailsRow = document.createElement('tr');
        detailsRow.className = 'session-details';
        const detailsCell = document.createElement('td');
        detailsCell.colSpan = 7;
        detailsCell.className = 'p-0';
        detailsCell.style.width = '100%';

        let tableHTML = `
            <div class="border-t border-gray-700 bg-gray-900 w-full">
                <div class="overflow-x-auto w-full">
                    <table class="w-full text-xs" style="width: 100%;">
                        <thead>
                            ${renderGameTableHeader({ showIndex: true, showDate: false, showOpening: true, showTermination: true, showTime: true, showKingMoves: true })}
                        </thead>
                        <tbody class="divide-y divide-gray-700">
        `;

        session.games.forEach((game, gameIndex) => {
            tableHTML += renderGameRow(game, player1Name, showYear, {
                showIndex: true,
                index: gameIndex + 1,
                showDate: false,
                showOpening: true,
                showTermination: true,
                showTime: true,
                showKingMoves: true
            });
        });

        tableHTML += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        detailsCell.innerHTML = tableHTML;
        detailsRow.appendChild(detailsCell);

        // Add click event to toggle accordion
        row.addEventListener('click', () => {
            const arrow = row.querySelector('.accordion-arrow');
            detailsRow.classList.toggle('expanded');
            if (arrow) arrow.classList.toggle('expanded');
        });

        fragment.appendChild(detailsRow);
    });

    // Batch append all rows at once
    tableBody.appendChild(fragment);

    // Update sort indicators
    updateSessionSortIndicators();
}

function updateSessionSortIndicators() {
    const sessionsTab = document.querySelector('[data-tab-content="sessions"]');
    if (!sessionsTab) return;
    const sortableHeaders = sessionsTab.querySelectorAll('.sortable');
    sortableHeaders.forEach(header => {
        const indicator = header.querySelector('.sort-indicator');
        if (indicator) {
            indicator.classList.remove('asc', 'desc');
            if (header.dataset.sort === currentSessionSortColumn) {
                indicator.classList.add(currentSessionSortDirection);
            }
        }
    });
}

function setupSessionsTableSorting() {
    const sessionsTab = document.querySelector('[data-tab-content="sessions"]');
    if (!sessionsTab) return;
    const sortableHeaders = sessionsTab.querySelectorAll('.sortable');
    sortableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const sortColumn = header.dataset.sort;
            
            // Toggle direction if clicking the same column
            if (sortColumn === currentSessionSortColumn) {
                currentSessionSortDirection = currentSessionSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSessionSortColumn = sortColumn;
                currentSessionSortDirection = 'desc';
            }

            // Re-render table with new sort
            const route = Router.getCurrentRoute();
            const showYear = route.year === 'all';
            const filteredGames = filterGamesByDateRange(window.globalGamesByMonth || {}, route.year, route.month, route.day);
            const [player1Name, player2Name] = getPlayerNames(window.globalGamesByMonth || {});
            const sessions = clusterGamesIntoSessions(filteredGames, player1Name);
            
            // Ensure dateFormatted is set before rendering
            sessions.forEach(session => {
                const startDate = new Date(session.startTime);
                session.dateFormatted = formatDate24h(startDate, showYear);
            });
            
            renderSessionsTable(sessions, player1Name, player2Name, showYear);
        });
    });
}

function displayOpeningStats(gamesByMonth, player1Name, player2Name) {
    console.log('displayOpeningStats called with:', Object.keys(gamesByMonth).length, 'months');
    console.log('Player names:', player1Name, player2Name);

    // Check if year filter is 'all' to include year in date
    const route = Router.getCurrentRoute();
    const showYear = route.year === 'all';

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

    // Convert to array with win percentages (ignoring draws: wins / (wins + losses))
    const openingList = Object.entries(openingStats).map(([name, stats]) => {
        const p1Losses = stats.games - stats.player1Wins - stats.draws;
        const p2Losses = stats.games - stats.player2Wins - stats.draws;
        const p1DecisiveGames = stats.player1Wins + p1Losses;
        const p2DecisiveGames = stats.player2Wins + p2Losses;
        const p1WinRate = p1DecisiveGames > 0 ? ((stats.player1Wins / p1DecisiveGames) * 100).toFixed(1) : '0.0';
        const p2WinRate = p2DecisiveGames > 0 ? ((stats.player2Wins / p2DecisiveGames) * 100).toFixed(1) : '0.0';
        return {
        name,
            ...stats,
            p1WinRate: parseFloat(p1WinRate),
            p2WinRate: parseFloat(p2WinRate)
        };
    });

    // Sort by games (default)
    openingList.sort((a, b) => b.games - a.games);

    // Render openings table
    renderOpeningsTable(openingList, player1Name, player2Name);
}

let currentOpeningSortColumn = 'games';
let currentOpeningSortDirection = 'desc';

function renderOpeningsTable(openingList, player1Name, player2Name) {
    const tableBody = document.getElementById('openings-table');
    if (!tableBody) return;

    // Sort openings
    const sortedOpenings = [...openingList].sort((a, b) => {
        let comparison = 0;
        
        switch (currentOpeningSortColumn) {
            case 'opening':
                comparison = a.name.localeCompare(b.name);
                break;
            case 'player1Wins':
                comparison = a.player1Wins - b.player1Wins;
                break;
            case 'player2Wins':
                comparison = a.player2Wins - b.player2Wins;
                break;
            case 'draws':
                comparison = a.draws - b.draws;
                break;
            case 'games':
                comparison = a.games - b.games;
                break;
        }
        
        return currentOpeningSortDirection === 'asc' ? comparison : -comparison;
    });

    tableBody.innerHTML = '';

    if (sortedOpenings.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="5" class="px-2 py-2 text-center text-gray-500">No opening data available</td>';
        tableBody.appendChild(row);
        return;
    }

    // Get all games by opening name for accordion
    const gamesByOpening = {};
    const route = Router.getCurrentRoute();
    const { year, month, day } = route;
    const showYear = route.year === 'all';
    const filteredGames = filterGamesByDateRange(window.globalGamesByMonth || {}, year, month, day);
    Object.values(filteredGames).flat().forEach(game => {
        const openingName = game.opening?.name || 'Unknown';
        if (!gamesByOpening[openingName]) {
            gamesByOpening[openingName] = [];
        }
        gamesByOpening[openingName].push(game);
    });

    sortedOpenings.forEach(opening => {
        // Main row (clickable to expand)
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-700 cursor-pointer opening-row';

        // Convert opening name to chess.com URL format
        const openingUrl = opening.name
            .replace(/[':,\.]/g, '')
            .replace(/\s+/g, '-')
            .replace(/--+/g, '-');

        // Win rates ignoring draws: wins / (wins + losses)
        const p1Losses = opening.games - opening.player1Wins - opening.draws;
        const p2Losses = opening.games - opening.player2Wins - opening.draws;
        const p1DecisiveGames = opening.player1Wins + p1Losses;
        const p2DecisiveGames = opening.player2Wins + p2Losses;
        const p1WinRate = p1DecisiveGames > 0 ? ((opening.player1Wins / p1DecisiveGames) * 100).toFixed(1) : '0.0';
        const p2WinRate = p2DecisiveGames > 0 ? ((opening.player2Wins / p2DecisiveGames) * 100).toFixed(1) : '0.0';

        // Format win count and percentage with consistent spacing using non-breaking spaces
        const p1WinsStr = String(opening.player1Wins).padStart(2, '\u00A0');
        const p2WinsStr = String(opening.player2Wins).padStart(2, '\u00A0');
        const p1RateStr = p1WinRate.padStart(5, '\u00A0');
        const p2RateStr = p2WinRate.padStart(5, '\u00A0');

        row.innerHTML = `
            <td class="px-2 py-2">
                <div class="flex items-center gap-2">
                    <svg class="accordion-arrow w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                    <a href="https://www.chess.com/openings/${openingUrl}"
                       target="_blank"
                       rel="noopener noreferrer"
                       class="text-gray-200 hover:text-gray-300 hover:underline"
                       onclick="event.stopPropagation()">
                        ${opening.name}
                    </a>
                </div>
            </td>
            <td class="px-2 py-2 text-center text-red-400" style="font-family: 'Fira Code', monospace;">
                <span class="font-bold">${p1WinsStr}</span><span class="text-gray-400 text-xs"> (${p1RateStr}%)</span>
            </td>
            <td class="px-2 py-2 text-center text-gray-400">${opening.draws}</td>
            <td class="px-2 py-2 text-center text-blue-400" style="font-family: 'Fira Code', monospace;">
                <span class="font-bold">${p2WinsStr}</span><span class="text-gray-400 text-xs"> (${p2RateStr}%)</span>
            </td>
            <td class="px-2 py-2 text-center text-gray-400">${opening.games}</td>
        `;
        tableBody.appendChild(row);

        // Expandable details row
        const detailsRow = document.createElement('tr');
        detailsRow.className = 'opening-details';
        const detailsCell = document.createElement('td');
        detailsCell.colSpan = 5;
        detailsCell.className = 'p-0';

        let games = gamesByOpening[opening.name] || [];
        // Sort games by date descending (most recent first)
        games = games.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        let tableHTML = `
            <div class="border-t border-gray-700 bg-gray-900">
                <div class="overflow-x-auto">
                    <table class="w-full text-xs">
                        <thead>
                            ${renderGameTableHeader({ showIndex: true, showDate: true, showOpening: true, showTermination: true, showTime: false, showKingMoves: true })}
                        </thead>
                        <tbody class="divide-y divide-gray-700">
        `;

        games.forEach((game, gameIndex) => {
            tableHTML += renderGameRow(game, player1Name, showYear, {
                showIndex: true,
                index: gameIndex + 1,
                showDate: true,
                showOpening: true,
                showTermination: true,
                showTime: false,
                showKingMoves: true
            });
        });

        tableHTML += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        detailsCell.innerHTML = tableHTML;
        detailsRow.appendChild(detailsCell);

        // Add click event to toggle accordion
        row.addEventListener('click', () => {
            const arrow = row.querySelector('.accordion-arrow');
            detailsRow.classList.toggle('expanded');
            if (arrow) arrow.classList.toggle('expanded');
        });

        tableBody.appendChild(detailsRow);
    });

    // Update sort indicators
    updateOpeningSortIndicators();
}

function updateOpeningSortIndicators() {
    const table = document.querySelector('#openings-table')?.closest('table');
    if (!table) return;
    
    const sortableHeaders = table.querySelectorAll('.sortable');
    sortableHeaders.forEach(header => {
        const indicator = header.querySelector('.sort-indicator');
        if (indicator) {
            indicator.classList.remove('asc', 'desc');
            if (header.dataset.sort === currentOpeningSortColumn) {
                indicator.classList.add(currentOpeningSortDirection);
            }
        }
    });
}

function setupOpeningsTableSorting() {
    // Use event delegation on the table container
    const openingsContainer = document.querySelector('[data-tab-content="openings"]');
    if (!openingsContainer) return;
    
    openingsContainer.addEventListener('click', (e) => {
        const header = e.target.closest('.sortable');
        if (!header) return;
        
        const sortColumn = header.dataset.sort;
        if (!sortColumn) return;
        
        // Toggle direction if clicking the same column
        if (sortColumn === currentOpeningSortColumn) {
            currentOpeningSortDirection = currentOpeningSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            currentOpeningSortColumn = sortColumn;
            currentOpeningSortDirection = 'asc';
        }
        
        // Re-render openings with new sort
        const route = Router.getCurrentRoute();
        const { year, month, day } = route;
        const filteredGames = filterGamesByDateRange(window.globalGamesByMonth || {}, year, month, day);
        const [player1Name, player2Name] = getPlayerNames(window.globalGamesByMonth || {});
        const openingStats = calculateOpeningStats(filteredGames, player1Name, player2Name);
        const openingList = Object.entries(openingStats).map(([name, stats]) => {
            // Win rates ignoring draws: wins / (wins + losses)
            const p1Losses = stats.games - stats.player1Wins - stats.draws;
            const p2Losses = stats.games - stats.player2Wins - stats.draws;
            const p1DecisiveGames = stats.player1Wins + p1Losses;
            const p2DecisiveGames = stats.player2Wins + p2Losses;
            const p1WinRate = p1DecisiveGames > 0 ? ((stats.player1Wins / p1DecisiveGames) * 100).toFixed(1) : '0.0';
            const p2WinRate = p2DecisiveGames > 0 ? ((stats.player2Wins / p2DecisiveGames) * 100).toFixed(1) : '0.0';
            return {
                name,
                ...stats,
                p1WinRate: parseFloat(p1WinRate),
                p2WinRate: parseFloat(p2WinRate)
            };
        });
        renderOpeningsTable(openingList, player1Name, player2Name);
    });
}

let currentSortColumn = 'date';
let currentSortDirection = 'desc'; // Default: newest first


function displayGames(gamesByMonth, player1Name, player2Name) {
    const tableBody = document.getElementById('games-table');
    if (!tableBody) return;

    // Check if year filter is 'all' to include year in date
    const route = Router.getCurrentRoute();
    const showYear = route.year === 'all';

    // Flatten all games from all months
    const allGames = Object.values(gamesByMonth).flat();
    
    if (allGames.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="12" class="px-4 py-3 text-center text-gray-500">No games found</td></tr>';
        return;
    }

    // Sort games
    const sortedGames = [...allGames].sort((a, b) => {
        let comparison = 0;
        
        switch (currentSortColumn) {
            case 'date':
                comparison = new Date(a.createdAt) - new Date(b.createdAt);
                break;
            case 'white':
                comparison = a.players.white.user.name.localeCompare(b.players.white.user.name);
                break;
            case 'black':
                comparison = a.players.black.user.name.localeCompare(b.players.black.user.name);
                break;
            case 'opening':
                const openingA = a.opening?.name || 'Unknown';
                const openingB = b.opening?.name || 'Unknown';
                comparison = openingA.localeCompare(openingB);
                break;
            case 'result':
                // Sort by winner: white wins, draws, black wins
                const resultA = a.winner === 'white' ? 0 : a.winner === 'draw' ? 1 : 2;
                const resultB = b.winner === 'white' ? 0 : b.winner === 'draw' ? 1 : 2;
                comparison = resultA - resultB;
                break;
            case 'moves':
                // Use cached metadata if available
                const movesA = a._metadata?.moveCount ?? (a.moves ? a.moves.split(' ').length : 0);
                const movesB = b._metadata?.moveCount ?? (b.moves ? b.moves.split(' ').length : 0);
                comparison = movesA - movesB;
                break;
            case 'whiteAcc':
                const whiteAccA = a.players.white.analysis?.accuracy || 0;
                const whiteAccB = b.players.white.analysis?.accuracy || 0;
                comparison = whiteAccA - whiteAccB;
                break;
            case 'blackAcc':
                const blackAccA = a.players.black.analysis?.accuracy || 0;
                const blackAccB = b.players.black.analysis?.accuracy || 0;
                comparison = blackAccA - blackAccB;
                break;
            case 'status':
                const statusA = a.status || 'unknown';
                const statusB = b.status || 'unknown';
                comparison = statusA.localeCompare(statusB);
                break;
            case 'whiteKing':
                // Use cached metadata if available
                const whiteKingA = a._metadata?.kingMoves?.white ?? countKingMoves(a.moves).white;
                const whiteKingB = b._metadata?.kingMoves?.white ?? countKingMoves(b.moves).white;
                comparison = whiteKingA - whiteKingB;
                break;
            case 'blackKing':
                const blackKingA = a._metadata?.kingMoves?.black ?? countKingMoves(a.moves).black;
                const blackKingB = b._metadata?.kingMoves?.black ?? countKingMoves(b.moves).black;
                comparison = blackKingA - blackKingB;
                break;
        }
        
        return currentSortDirection === 'asc' ? comparison : -comparison;
    });

    // Clear table
    tableBody.innerHTML = '';

    // Pre-compute metadata for all games to avoid repeated calculations
    const gamesWithMetadata = sortedGames.map(game => {
        if (!game._metadata) {
            game._metadata = {
                moveCount: game.moves ? game.moves.split(' ').length : 0,
                kingMoves: countKingMoves(game.moves),
                whitePlayer: game.players.white.user.name,
                blackPlayer: game.players.black.user.name,
                openingName: game.opening?.name || 'Unknown',
                whiteAcc: game.players.white.analysis?.accuracy || '-',
                blackAcc: game.players.black.analysis?.accuracy || '-'
            };
        }
        return game;
    });

    // Use DocumentFragment for batch DOM updates
    const fragment = document.createDocumentFragment();

    // Render games
    gamesWithMetadata.forEach((game, index) => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-800';
        row.innerHTML = renderGameRow(game, player1Name, showYear, {
            showIndex: false,
            showDate: true,
            showOpening: true,
            showTermination: true,
            showTime: false,
            showKingMoves: true
        });
        fragment.appendChild(row);
    });
    
    // Batch append all rows at once
    tableBody.appendChild(fragment);

    // Update sort indicators
    updateSortIndicators();
}

function updateSortIndicators() {
    const sortableHeaders = document.querySelectorAll('.sortable');
    sortableHeaders.forEach(header => {
        const indicator = header.querySelector('.sort-indicator');
        if (indicator) {
            indicator.classList.remove('asc', 'desc');
            if (header.dataset.sort === currentSortColumn) {
                indicator.classList.add(currentSortDirection);
            }
        }
    });
}

function setupGamesTableSorting() {
    const sortableHeaders = document.querySelectorAll('.sortable');
    sortableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const sortColumn = header.dataset.sort;
            
            // Toggle direction if clicking the same column
            if (sortColumn === currentSortColumn) {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortColumn = sortColumn;
                currentSortDirection = 'asc';
            }
            
            // Re-render games with new sort
            const route = Router.getCurrentRoute();
            const { year, month, day } = route;
            const filteredGames = filterGamesByDateRange(window.globalGamesByMonth || {}, year, month, day);
            const [player1Name, player2Name] = getPlayerNames(window.globalGamesByMonth || {});
            displayGames(filteredGames, player1Name, player2Name);
        });
    });
}
