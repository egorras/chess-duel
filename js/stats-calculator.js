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
