// Cluster games into skirmishes based on time gaps
function clusterGamesIntoSkirmishes(gamesByMonth, player1Name, maxGapMinutes = 30) {
    const allGames = [];

    // Flatten and sort all games by date
    Object.keys(gamesByMonth).sort().forEach(monthKey => {
        allGames.push(...gamesByMonth[monthKey]);
    });

    allGames.sort((a, b) => a.createdAt - b.createdAt);

    if (allGames.length === 0) return [];

    const skirmishes = [];
    let currentSkirmish = {
        games: [allGames[0]],
        startTime: allGames[0].createdAt,
        endTime: allGames[0].lastMoveAt,
        player1Score: 0,
        player2Score: 0
    };

    // Calculate initial score
    const firstGame = allGames[0];
    const whitePlayer = firstGame.players.white.user.name;
    const winner = firstGame.winner;

    if (winner === 'white') {
        if (whitePlayer === player1Name) {
            currentSkirmish.player1Score = 1;
        } else {
            currentSkirmish.player2Score = 1;
        }
    } else if (winner === 'black') {
        if (whitePlayer === player1Name) {
            currentSkirmish.player2Score = 1;
        } else {
            currentSkirmish.player1Score = 1;
        }
    } else {
        currentSkirmish.player1Score = 0.5;
        currentSkirmish.player2Score = 0.5;
    }

    // Group games into skirmishes
    for (let i = 1; i < allGames.length; i++) {
        const prevGame = allGames[i - 1];
        const currentGame = allGames[i];

        // Calculate time gap in minutes
        const gapMinutes = (currentGame.createdAt - prevGame.lastMoveAt) / (1000 * 60);

        if (gapMinutes <= maxGapMinutes) {
            // Same skirmish
            currentSkirmish.games.push(currentGame);
            currentSkirmish.endTime = currentGame.lastMoveAt;

            // Update scores
            const whitePlayer = currentGame.players.white.user.name;
            const winner = currentGame.winner;

            if (winner === 'white') {
                if (whitePlayer === player1Name) {
                    currentSkirmish.player1Score++;
                } else {
                    currentSkirmish.player2Score++;
                }
            } else if (winner === 'black') {
                if (whitePlayer === player1Name) {
                    currentSkirmish.player2Score++;
                } else {
                    currentSkirmish.player1Score++;
                }
            } else {
                currentSkirmish.player1Score += 0.5;
                currentSkirmish.player2Score += 0.5;
            }
        } else {
            // New skirmish - save the old one
            skirmishes.push(currentSkirmish);

            // Start new skirmish
            currentSkirmish = {
                games: [currentGame],
                startTime: currentGame.createdAt,
                endTime: currentGame.lastMoveAt,
                player1Score: 0,
                player2Score: 0
            };

            // Calculate initial score for new skirmish
            const whitePlayer = currentGame.players.white.user.name;
            const winner = currentGame.winner;

            if (winner === 'white') {
                if (whitePlayer === player1Name) {
                    currentSkirmish.player1Score = 1;
                } else {
                    currentSkirmish.player2Score = 1;
                }
            } else if (winner === 'black') {
                if (whitePlayer === player1Name) {
                    currentSkirmish.player2Score = 1;
                } else {
                    currentSkirmish.player1Score = 1;
                }
            } else {
                currentSkirmish.player1Score = 0.5;
                currentSkirmish.player2Score = 0.5;
            }
        }
    }

    // Add the last skirmish
    skirmishes.push(currentSkirmish);

    // Add metadata to each skirmish
    skirmishes.forEach(skirmish => {
        skirmish.totalGames = skirmish.games.length;
        skirmish.winner = skirmish.player1Score > skirmish.player2Score ? 'player1' :
                          skirmish.player2Score > skirmish.player1Score ? 'player2' : 'draw';
        skirmish.date = new Date(skirmish.startTime).toLocaleDateString();
        skirmish.duration = Math.round((skirmish.endTime - skirmish.startTime) / (1000 * 60)); // minutes
    });

    return skirmishes;
}

function calculateSkirmishStats(skirmishes) {
    if (skirmishes.length === 0) {
        return {
            totalSkirmishes: 0,
            player1Wins: 0,
            player2Wins: 0,
            draws: 0,
            avgGamesPerSkirmish: 0,
            avgDuration: 0
        };
    }

    const stats = {
        totalSkirmishes: skirmishes.length,
        player1Wins: skirmishes.filter(s => s.winner === 'player1').length,
        player2Wins: skirmishes.filter(s => s.winner === 'player2').length,
        draws: skirmishes.filter(s => s.winner === 'draw').length,
        avgGamesPerSkirmish: Math.round(skirmishes.reduce((sum, s) => sum + s.totalGames, 0) / skirmishes.length),
        avgDuration: Math.round(skirmishes.reduce((sum, s) => sum + s.duration, 0) / skirmishes.length)
    };

    return stats;
}
