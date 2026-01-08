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

function calculateStats(gamesByMonth, globalGamesByMonth, getPlayerNames) {
    if (Object.keys(gamesByMonth).length === 0) {
        return null;
    }

    const [player1Name, player2Name] = getPlayerNames(globalGamesByMonth);
    const allGames = Object.values(gamesByMonth).flat();

    const stats = {
        player1Name,
        player2Name,
        totalGames: allGames.length,
        player1: { wins: 0, losses: 0, draws: 0, bestStreak: 0, accuracy: [], blunders: 0, mistakes: 0, inaccuracies: 0 },
        player2: { wins: 0, losses: 0, draws: 0, bestStreak: 0, accuracy: [], blunders: 0, mistakes: 0, inaccuracies: 0 },
        byTermination: {},
        monthlyStats: {},
        gameLengths: [],
        openingCounts: {}
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
            const isPlayer1White = whitePlayer === player1Name;

            // Determine result
            if (winner === 'white') {
                if (isPlayer1White) {
                    monthStat.player1Wins++;
                    stats.player1.wins++;
                    stats.player2.losses++;
                } else {
                    monthStat.player2Wins++;
                    stats.player2.wins++;
                    stats.player1.losses++;
                }
            } else if (winner === 'black') {
                if (isPlayer1White) {
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

            // Collect accuracy and error stats
            const whiteAnalysis = game.players?.white?.analysis;
            const blackAnalysis = game.players?.black?.analysis;

            if (isPlayer1White && whiteAnalysis) {
                if (whiteAnalysis.accuracy) stats.player1.accuracy.push(whiteAnalysis.accuracy);
                stats.player1.blunders += whiteAnalysis.blunder || 0;
                stats.player1.mistakes += whiteAnalysis.mistake || 0;
                stats.player1.inaccuracies += whiteAnalysis.inaccuracy || 0;
            } else if (isPlayer1White && blackAnalysis) {
                if (blackAnalysis.accuracy) stats.player2.accuracy.push(blackAnalysis.accuracy);
                stats.player2.blunders += blackAnalysis.blunder || 0;
                stats.player2.mistakes += blackAnalysis.mistake || 0;
                stats.player2.inaccuracies += blackAnalysis.inaccuracy || 0;
            } else if (!isPlayer1White && whiteAnalysis) {
                if (whiteAnalysis.accuracy) stats.player2.accuracy.push(whiteAnalysis.accuracy);
                stats.player2.blunders += whiteAnalysis.blunder || 0;
                stats.player2.mistakes += whiteAnalysis.mistake || 0;
                stats.player2.inaccuracies += whiteAnalysis.inaccuracy || 0;
            } else if (!isPlayer1White && blackAnalysis) {
                if (blackAnalysis.accuracy) stats.player1.accuracy.push(blackAnalysis.accuracy);
                stats.player1.blunders += blackAnalysis.blunder || 0;
                stats.player1.mistakes += blackAnalysis.mistake || 0;
                stats.player1.inaccuracies += blackAnalysis.inaccuracy || 0;
            }

            // Game length (count moves)
            if (game.moves) {
                const moveCount = game.moves.split(' ').length;
                stats.gameLengths.push(moveCount);
            }

            // Opening counts
            if (game.opening?.name) {
                stats.openingCounts[game.opening.name] = (stats.openingCounts[game.opening.name] || 0) + 1;
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

    // Calculate averages
    stats.player1.avgAccuracy = stats.player1.accuracy.length > 0
        ? Math.round(stats.player1.accuracy.reduce((a, b) => a + b, 0) / stats.player1.accuracy.length)
        : 0;
    stats.player2.avgAccuracy = stats.player2.accuracy.length > 0
        ? Math.round(stats.player2.accuracy.reduce((a, b) => a + b, 0) / stats.player2.accuracy.length)
        : 0;

    // Game length stats
    stats.avgGameLength = stats.gameLengths.length > 0
        ? Math.round(stats.gameLengths.reduce((a, b) => a + b, 0) / stats.gameLengths.length)
        : 0;
    stats.longestGame = stats.gameLengths.length > 0 ? Math.max(...stats.gameLengths) : 0;
    stats.shortestGame = stats.gameLengths.length > 0 ? Math.min(...stats.gameLengths) : 0;

    // Most common opening
    const sortedOpenings = Object.entries(stats.openingCounts).sort((a, b) => b[1] - a[1]);
    stats.mostCommonOpening = sortedOpenings.length > 0 ? sortedOpenings[0][0] : '-';

    // Most common termination
    const sortedTerminations = Object.entries(stats.byTermination).sort((a, b) => b[1] - a[1]);
    stats.mostCommonTermination = sortedTerminations.length > 0 ? sortedTerminations[0][0] : '-';

    // Date range
    const months = Object.keys(gamesByMonth).sort();
    stats.dateRange = months.length > 0 ? `(${months[0]} to ${months[months.length - 1]})` : '';

    return stats;
}

function calculateOpeningStats(gamesByMonth, player1Name, player2Name) {
    const allGames = Object.values(gamesByMonth).flat();

    // Debug: Check if opening data exists
    if (allGames.length > 0) {
        console.log('Sample game data:', allGames[0]);
        console.log('Opening data:', allGames[0].opening);
    }

    const openings = {};

    allGames.forEach(game => {
        if (!game.opening || !game.opening.name) return;

        const openingName = game.opening.name;
        const whitePlayer = game.players.white.user.name;
        const winner = game.winner;

        // Initialize opening stats if needed
        if (!openings[openingName]) {
            openings[openingName] = {
                player1Wins: 0,
                player2Wins: 0,
                draws: 0,
                games: 0
            };
        }

        openings[openingName].games++;

        // Determine which player is white
        const isPlayer1White = whitePlayer === player1Name;

        // Count wins/draws
        if (winner === 'white') {
            if (isPlayer1White) {
                openings[openingName].player1Wins++;
            } else {
                openings[openingName].player2Wins++;
            }
        } else if (winner === 'black') {
            if (isPlayer1White) {
                openings[openingName].player2Wins++;
            } else {
                openings[openingName].player1Wins++;
            }
        } else {
            openings[openingName].draws++;
        }
    });

    return openings;
}
