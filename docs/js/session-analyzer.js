// Cluster games into sessions based on time gaps
function clusterGamesIntoSessions(gamesByMonth, player1Name, maxGapMinutes = 15) {
    const allGames = [];

    // Flatten and sort all games by date
    Object.keys(gamesByMonth).sort().forEach(monthKey => {
        allGames.push(...gamesByMonth[monthKey]);
    });

    allGames.sort((a, b) => a.createdAt - b.createdAt);

    if (allGames.length === 0) return [];

    const sessions = [];
    let currentSession = {
        games: [allGames[0]],
        startTime: allGames[0].createdAt,
        endTime: allGames[0].lastMoveAt,
        player1Score: 0,
        player2Score: 0
    };

    // Calculate initial score
    const firstGame = allGames[0];
    const firstWhite = firstGame.players.white.user.name;
    const firstWinner = firstGame.winner;

    if (firstWinner === 'white') {
        if (firstWhite === player1Name) {
            currentSession.player1Score = 1;
        } else {
            currentSession.player2Score = 1;
        }
    } else if (firstWinner === 'black') {
        if (firstWhite === player1Name) {
            currentSession.player2Score = 1;
        } else {
            currentSession.player1Score = 1;
        }
    } else {
        currentSession.player1Score = 0.5;
        currentSession.player2Score = 0.5;
    }

    // Group games into sessions
    for (let i = 1; i < allGames.length; i++) {
        const prevGame = allGames[i - 1];
        const currentGame = allGames[i];

        // Calculate time gap in minutes
        // Use lastMoveAt if available, otherwise use createdAt + estimated game duration
        const prevGameEndTime = prevGame.lastMoveAt || (prevGame.createdAt + (prevGame.moves ? prevGame.moves.split(' ').length * 60000 : 1800000)); // Default 30 min if no moves
        const gapMinutes = (currentGame.createdAt - prevGameEndTime) / (1000 * 60);

        // Check if games are on the same day
        const sameDay = new Date(prevGame.createdAt).toDateString() === new Date(currentGame.createdAt).toDateString();
        
        // If different day, always start new session
        // If same day, use maxGapMinutes but cap at 2 hours
        const maxAllowedGap = sameDay ? Math.min(maxGapMinutes, 120) : -1; // -1 ensures different days always start new session

        if (sameDay && gapMinutes <= maxAllowedGap && gapMinutes >= 0) {
            // Same session
            currentSession.games.push(currentGame);
            currentSession.endTime = currentGame.lastMoveAt;

            // Update scores
            const whitePlayer = currentGame.players.white.user.name;
            const winner = currentGame.winner;

            if (winner === 'white') {
                if (whitePlayer === player1Name) {
                    currentSession.player1Score++;
                } else {
                    currentSession.player2Score++;
                }
            } else if (winner === 'black') {
                if (whitePlayer === player1Name) {
                    currentSession.player2Score++;
                } else {
                    currentSession.player1Score++;
                }
            } else {
                currentSession.player1Score += 0.5;
                currentSession.player2Score += 0.5;
            }
        } else {
            // New session - save the old one
            sessions.push(currentSession);

            // Start new session
            currentSession = {
                games: [currentGame],
                startTime: currentGame.createdAt,
                endTime: currentGame.lastMoveAt,
                player1Score: 0,
                player2Score: 0
            };

            // Calculate initial score for new session
            const whitePlayer = currentGame.players.white.user.name;
            const winner = currentGame.winner;

            if (winner === 'white') {
                if (whitePlayer === player1Name) {
                    currentSession.player1Score = 1;
                } else {
                    currentSession.player2Score = 1;
                }
            } else if (winner === 'black') {
                if (whitePlayer === player1Name) {
                    currentSession.player2Score = 1;
                } else {
                    currentSession.player1Score = 1;
                }
            } else {
                currentSession.player1Score = 0.5;
                currentSession.player2Score = 0.5;
            }
        }
    }

    // Add the last session
    sessions.push(currentSession);

    // Add metadata to each session
    sessions.forEach(session => {
        session.totalGames = session.games.length;
        session.winner = session.player1Score > session.player2Score ? 'player1' :
                          session.player2Score > session.player1Score ? 'player2' : 'draw';
        const startDate = new Date(session.startTime);
        const month = startDate.toLocaleDateString('en-US', { month: 'short' });
        const day = String(startDate.getDate()).padStart(2, '0');
        const hours = String(startDate.getHours()).padStart(2, '0');
        const minutes = String(startDate.getMinutes()).padStart(2, '0');
        session.date = `${month} ${day}, ${hours}:${minutes}`;
        
        // Calculate session duration by summing individual game durations
        // This is more accurate than using endTime - startTime (which can be wrong due to bad lastMoveAt)
        let totalDurationMinutes = 0;
        session.games.forEach(game => {
            let gameDurationMinutes = 0;
            
            if (game.createdAt && game.lastMoveAt) {
                const durationMs = game.lastMoveAt - game.createdAt;
                gameDurationMinutes = Math.round(durationMs / (1000 * 60));
                
                // Use clock data if available for more accurate estimate
                if (game.clock && game.clocks && game.clocks.length > 0) {
                    const initialTime = game.clock.initial || 300; // seconds
                    const lastClock = game.clocks[game.clocks.length - 1] / 1000; // convert ms to seconds
                    const timeUsed = initialTime - lastClock;
                    const moveCount = game.moves ? game.moves.split(' ').length : 0;
                    const estimatedMinutes = Math.round((timeUsed + (moveCount * 2)) / 60);
                    
                    if (estimatedMinutes < 120 && estimatedMinutes > 0) {
                        gameDurationMinutes = estimatedMinutes;
                    }
                }
                
                // Cap at 2 hours for blitz/rapid games
                if (game.speed === 'blitz' || game.speed === 'rapid') {
                    gameDurationMinutes = Math.min(gameDurationMinutes, 120);
                }
            }
            
            totalDurationMinutes += gameDurationMinutes;
        });
        
        session.duration = totalDurationMinutes;
    });

    return sessions;
}

function calculateSessionStats(sessions) {
    if (sessions.length === 0) {
        return {
            totalSessions: 0,
            player1Wins: 0,
            player2Wins: 0,
            draws: 0,
            avgGamesPerSession: 0,
            avgDuration: 0
        };
    }

    const stats = {
        totalSessions: sessions.length,
        player1Wins: sessions.filter(s => s.winner === 'player1').length,
        player2Wins: sessions.filter(s => s.winner === 'player2').length,
        draws: sessions.filter(s => s.winner === 'draw').length,
        avgGamesPerSession: Math.round(sessions.reduce((sum, s) => sum + s.totalGames, 0) / sessions.length),
        avgDuration: Math.round(sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length)
    };

    return stats;
}
