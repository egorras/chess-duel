// countKingMoves is now imported from utils.js

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
        player1: { 
            wins: 0, losses: 0, draws: 0, bestStreak: 0, currentStreak: 0,
            accuracy: [], blunders: 0, mistakes: 0, inaccuracies: 0,
            winsAsWhite: 0, winsAsBlack: 0, gamesAsWhite: 0, gamesAsBlack: 0,
            kingWalks: [], fastestWin: Infinity, fastestWinId: null,
            firstMoves: {}, avgTimeRemaining: [], timePressureWins: 0,
            byTermination: {}
        },
        player2: { 
            wins: 0, losses: 0, draws: 0, bestStreak: 0, currentStreak: 0,
            accuracy: [], blunders: 0, mistakes: 0, inaccuracies: 0,
            winsAsWhite: 0, winsAsBlack: 0, gamesAsWhite: 0, gamesAsBlack: 0,
            kingWalks: [], fastestWin: Infinity, fastestWinId: null,
            firstMoves: {}, avgTimeRemaining: [], timePressureWins: 0,
            byTermination: {}
        },
        byTermination: {},
        monthlyStats: {},
        gameLengths: [],
        openingCounts: {},
        longestGameId: null,
        shortestGameId: null,
        longestGameLength: 0,
        shortestGameLength: Infinity,
        mostCommonFirstMove: null
    };

    // Calculate overall streaks (including current)
    const overallStreaks = calculateStreaks(allGames, player1Name);
    stats.player1.bestStreak = overallStreaks.player1;
    stats.player2.bestStreak = overallStreaks.player2;
    
    // Calculate current streak
    let currentStreak = 0;
    let currentPlayer = null;
    for (let i = allGames.length - 1; i >= 0; i--) {
        const game = allGames[i];
        const whitePlayer = game.players.white.user.name;
        const winner = game.winner;
        
        let gameWinner = null;
        if (winner === 'white') {
            gameWinner = whitePlayer === player1Name ? 'player1' : 'player2';
        } else if (winner === 'black') {
            gameWinner = whitePlayer === player1Name ? 'player2' : 'player1';
        }
        
        if (gameWinner) {
            if (gameWinner === currentPlayer || currentPlayer === null) {
                currentStreak++;
                currentPlayer = gameWinner;
            } else {
                break;
            }
        } else {
            break;
        }
    }
    
    if (currentPlayer === 'player1') {
        stats.player1.currentStreak = currentStreak;
        stats.player2.currentStreak = 0;
    } else if (currentPlayer === 'player2') {
        stats.player2.currentStreak = currentStreak;
        stats.player1.currentStreak = 0;
    } else {
        stats.player1.currentStreak = 0;
        stats.player2.currentStreak = 0;
    }

    // Sort months
    const sortedMonths = Object.keys(gamesByMonth).sort();

    sortedMonths.forEach(monthKey => {
        const games = gamesByMonth[monthKey];

        const monthStat = {
            games: games.length,
            player1Wins: 0,
            player2Wins: 0,
            draws: 0,
            streaks: { player1: 0, player2: 0 },
            player1KingMoves: [],
            player2KingMoves: [],
            player1Accuracy: [],
            player2Accuracy: []
        };

        // Calculate streaks for this month
        monthStat.streaks = calculateStreaks(games, player1Name);

        games.forEach(game => {
            const whitePlayer = game.players.white.user.name;
            const winner = game.winner;
            const isPlayer1White = whitePlayer === player1Name;

            // Track games as white/black
            if (isPlayer1White) {
                stats.player1.gamesAsWhite++;
                stats.player2.gamesAsBlack++;
            } else {
                stats.player1.gamesAsBlack++;
                stats.player2.gamesAsWhite++;
            }

            // Determine result
            if (winner === 'white') {
                if (isPlayer1White) {
                    monthStat.player1Wins++;
                    stats.player1.wins++;
                    stats.player1.winsAsWhite++;
                    stats.player2.losses++;
                } else {
                    monthStat.player2Wins++;
                    stats.player2.wins++;
                    stats.player2.winsAsWhite++;
                    stats.player1.losses++;
                }
            } else if (winner === 'black') {
                if (isPlayer1White) {
                    monthStat.player2Wins++;
                    stats.player2.wins++;
                    stats.player2.winsAsBlack++;
                    stats.player1.losses++;
                } else {
                    monthStat.player1Wins++;
                    stats.player1.wins++;
                    stats.player1.winsAsBlack++;
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
                if (whiteAnalysis.accuracy) {
                    stats.player1.accuracy.push(whiteAnalysis.accuracy);
                    monthStat.player1Accuracy.push(whiteAnalysis.accuracy);
                }
                stats.player1.blunders += whiteAnalysis.blunder || 0;
                stats.player1.mistakes += whiteAnalysis.mistake || 0;
                stats.player1.inaccuracies += whiteAnalysis.inaccuracy || 0;
            } else if (isPlayer1White && blackAnalysis) {
                if (blackAnalysis.accuracy) {
                    stats.player2.accuracy.push(blackAnalysis.accuracy);
                    monthStat.player2Accuracy.push(blackAnalysis.accuracy);
                }
                stats.player2.blunders += blackAnalysis.blunder || 0;
                stats.player2.mistakes += blackAnalysis.mistake || 0;
                stats.player2.inaccuracies += blackAnalysis.inaccuracy || 0;
            } else if (!isPlayer1White && whiteAnalysis) {
                if (whiteAnalysis.accuracy) {
                    stats.player2.accuracy.push(whiteAnalysis.accuracy);
                    monthStat.player2Accuracy.push(whiteAnalysis.accuracy);
                }
                stats.player2.blunders += whiteAnalysis.blunder || 0;
                stats.player2.mistakes += whiteAnalysis.mistake || 0;
                stats.player2.inaccuracies += whiteAnalysis.inaccuracy || 0;
            } else if (!isPlayer1White && blackAnalysis) {
                if (blackAnalysis.accuracy) {
                    stats.player1.accuracy.push(blackAnalysis.accuracy);
                    monthStat.player1Accuracy.push(blackAnalysis.accuracy);
                }
                stats.player1.blunders += blackAnalysis.blunder || 0;
                stats.player1.mistakes += blackAnalysis.mistake || 0;
                stats.player1.inaccuracies += blackAnalysis.inaccuracy || 0;
            }

            // Game length (count moves)
            if (game.moves) {
                const moveCount = game.moves.split(' ').length;
                stats.gameLengths.push(moveCount);

                // Track longest and shortest games
                if (moveCount > stats.longestGameLength) {
                    stats.longestGameLength = moveCount;
                    stats.longestGameId = game.id;
                }
                if (moveCount < stats.shortestGameLength) {
                    stats.shortestGameLength = moveCount;
                    stats.shortestGameId = game.id;
                }

                // Track fastest win (by move count)
                if (winner) {
                    const player1Won = (isPlayer1White && winner === 'white') || (!isPlayer1White && winner === 'black');
                    if (player1Won && moveCount < stats.player1.fastestWin) {
                        stats.player1.fastestWin = moveCount;
                        stats.player1.fastestWinId = game.id;
                    } else if (!player1Won && moveCount < stats.player2.fastestWin) {
                        stats.player2.fastestWin = moveCount;
                        stats.player2.fastestWinId = game.id;
                    }
                }

                // Count king moves (use cached version if available)
                const kingMoves = typeof window !== 'undefined' && window.optimizations && window.optimizations.countKingMovesCached
                    ? window.optimizations.countKingMovesCached(game.moves, game.id)
                    : countKingMoves(game.moves);
                if (isPlayer1White) {
                    stats.player1.kingWalks.push(kingMoves.white);
                    stats.player2.kingWalks.push(kingMoves.black);
                    monthStat.player1KingMoves.push(kingMoves.white);
                    monthStat.player2KingMoves.push(kingMoves.black);
                } else {
                    stats.player1.kingWalks.push(kingMoves.black);
                    stats.player2.kingWalks.push(kingMoves.white);
                    monthStat.player1KingMoves.push(kingMoves.black);
                    monthStat.player2KingMoves.push(kingMoves.white);
                }

                // Track first move (only when player is white)
                const moves = game.moves.split(' ').filter(m => m.length > 0);
                if (moves.length > 0 && isPlayer1White) {
                    const firstMove = moves[0];
                    stats.player1.firstMoves[firstMove] = (stats.player1.firstMoves[firstMove] || 0) + 1;
                } else if (moves.length > 0 && !isPlayer1White) {
                    const firstMove = moves[0];
                    stats.player2.firstMoves[firstMove] = (stats.player2.firstMoves[firstMove] || 0) + 1;
                }
            }

            // Track time remaining at end of game (for winning player)
            if (game.clocks && game.clocks.length > 0 && winner) {
                // The last clock value is for the last player to move (the loser)
                // The second-to-last is for the winner
                const clocks = game.clocks;
                let winnerTimeRemaining = 0;
                
                if (clocks.length >= 2) {
                    // Winner's time is second to last (they made the winning move)
                    winnerTimeRemaining = clocks[clocks.length - 2] / 1000; // Convert from ms to seconds
                } else if (clocks.length === 1) {
                    winnerTimeRemaining = clocks[0] / 1000;
                }
                
                if (winnerTimeRemaining > 0) {
                    const player1Won = (isPlayer1White && winner === 'white') || (!isPlayer1White && winner === 'black');
                    if (player1Won) {
                        stats.player1.avgTimeRemaining.push(winnerTimeRemaining);
                        if (winnerTimeRemaining < 30) stats.player1.timePressureWins++;
                    } else {
                        stats.player2.avgTimeRemaining.push(winnerTimeRemaining);
                        if (winnerTimeRemaining < 30) stats.player2.timePressureWins++;
                    }
                }
            }

            // Opening counts
            if (game.opening?.name) {
                stats.openingCounts[game.opening.name] = (stats.openingCounts[game.opening.name] || 0) + 1;
            }

            // Termination stats (overall and per player)
            const status = game.status || 'unknown';
            if (!stats.byTermination[status]) {
                stats.byTermination[status] = 0;
            }
            stats.byTermination[status]++;
            
            // Track termination per player (for wins/losses/draws)
            if (winner === 'white') {
                if (isPlayer1White) {
                    // Player 1 won
                    if (!stats.player1.byTermination[status]) {
                        stats.player1.byTermination[status] = 0;
                    }
                    stats.player1.byTermination[status]++;
                } else {
                    // Player 2 won
                    if (!stats.player2.byTermination[status]) {
                        stats.player2.byTermination[status] = 0;
                    }
                    stats.player2.byTermination[status]++;
                }
            } else if (winner === 'black') {
                if (isPlayer1White) {
                    // Player 2 won
                    if (!stats.player2.byTermination[status]) {
                        stats.player2.byTermination[status] = 0;
                    }
                    stats.player2.byTermination[status]++;
                } else {
                    // Player 1 won
                    if (!stats.player1.byTermination[status]) {
                        stats.player1.byTermination[status] = 0;
                    }
                    stats.player1.byTermination[status]++;
                }
            } else {
                // Draw - count for both players
                if (!stats.player1.byTermination[status]) {
                    stats.player1.byTermination[status] = 0;
                }
                stats.player1.byTermination[status]++;
                if (!stats.player2.byTermination[status]) {
                    stats.player2.byTermination[status] = 0;
                }
                stats.player2.byTermination[status]++;
            }
        });

        stats.monthlyStats[monthKey] = monthStat;
    });

    // Calculate averages (optimized reduce operations)
    stats.player1.avgAccuracy = stats.player1.accuracy.length > 0
        ? Math.round(stats.player1.accuracy.reduce((sum, val) => sum + val, 0) / stats.player1.accuracy.length)
        : 0;
    stats.player2.avgAccuracy = stats.player2.accuracy.length > 0
        ? Math.round(stats.player2.accuracy.reduce((sum, val) => sum + val, 0) / stats.player2.accuracy.length)
        : 0;

    // Game length stats
    stats.avgGameLength = stats.gameLengths.length > 0
        ? Math.round(stats.gameLengths.reduce((sum, val) => sum + val, 0) / stats.gameLengths.length)
        : 0;
    stats.longestGame = stats.gameLengths.length > 0 ? Math.max(...stats.gameLengths) : 0;
    stats.shortestGame = stats.gameLengths.length > 0 ? Math.min(...stats.gameLengths) : 0;

    // Most common opening
    const sortedOpenings = Object.entries(stats.openingCounts).sort((a, b) => b[1] - a[1]);
    stats.mostCommonOpening = sortedOpenings.length > 0 ? sortedOpenings[0][0] : '-';

    // Most common termination
    const sortedTerminations = Object.entries(stats.byTermination).sort((a, b) => b[1] - a[1]);
    stats.mostCommonTermination = sortedTerminations.length > 0 ? sortedTerminations[0][0] : '-';

    // Most common first move (combine both players)
    const allFirstMoves = {};
    Object.entries(stats.player1.firstMoves).forEach(([move, count]) => {
        allFirstMoves[move] = (allFirstMoves[move] || 0) + count;
    });
    Object.entries(stats.player2.firstMoves).forEach(([move, count]) => {
        allFirstMoves[move] = (allFirstMoves[move] || 0) + count;
    });
    const sortedFirstMoves = Object.entries(allFirstMoves).sort((a, b) => b[1] - a[1]);
    stats.mostCommonFirstMove = sortedFirstMoves.length > 0 ? sortedFirstMoves[0][0] : '-';

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
                games: 0,
                player1WhiteGames: 0,
                player1BlackGames: 0,
                player2WhiteGames: 0,
                player2BlackGames: 0
            };
        }

        openings[openingName].games++;

        // Determine which player is white
        const isPlayer1White = whitePlayer === player1Name;

        // Track which player played white/black for this opening
        if (isPlayer1White) {
            openings[openingName].player1WhiteGames++;
            openings[openingName].player2BlackGames++;
        } else {
            openings[openingName].player1BlackGames++;
            openings[openingName].player2WhiteGames++;
        }

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
