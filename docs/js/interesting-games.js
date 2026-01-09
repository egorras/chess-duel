// Find interesting games based on various criteria
function findInterestingGames(gamesByMonth, player1Name, player2Name) {
    const allGames = Object.values(gamesByMonth).flat();
    
    // Filter games that have analysis data
    const gamesWithAnalysis = allGames.filter(game => {
        const whiteAnalysis = game.players?.white?.analysis;
        const blackAnalysis = game.players?.black?.analysis;
        return whiteAnalysis || blackAnalysis;
    });
    
    if (gamesWithAnalysis.length === 0) {
        return {
            missedMates: [],
            bigSwings: [],
            highBlunders: [],
            greatGames: [],
            chaoticGames: []
        };
    }
    
    // Calculate interesting metrics for each game
    const gamesWithMetrics = gamesWithAnalysis.map(game => {
        const whiteAnalysis = game.players?.white?.analysis || {};
        const blackAnalysis = game.players?.black?.analysis || {};
        const whitePlayer = game.players.white.user.name;
        const isPlayer1White = whitePlayer === player1Name;
        
        // Get ACPL (Average Centipawn Loss) - higher = more mistakes
        const whiteAcpl = whiteAnalysis.acpl || 0;
        const blackAcpl = blackAnalysis.acpl || 0;
        const totalAcpl = whiteAcpl + blackAcpl; // Combined mistakes = big swings
        
        // Get blunder counts
        const whiteBlunders = whiteAnalysis.blunder || 0;
        const blackBlunders = blackAnalysis.blunder || 0;
        const totalBlunders = whiteBlunders + blackBlunders;
        
        // Get accuracy
        const whiteAccuracy = whiteAnalysis.accuracy || 0;
        const blackAccuracy = blackAnalysis.accuracy || 0;
        const avgAccuracy = (whiteAccuracy + blackAccuracy) / 2;
        
        // Determine which player had more blunders
        const player1Blunders = isPlayer1White ? whiteBlunders : blackBlunders;
        const player2Blunders = isPlayer1White ? blackBlunders : whiteBlunders;
        const player1Acpl = isPlayer1White ? whiteAcpl : blackAcpl;
        const player2Acpl = isPlayer1White ? blackAcpl : whiteAcpl;
        
        return {
            game,
            totalAcpl,
            totalBlunders,
            avgAccuracy,
            whiteAcpl,
            blackAcpl,
            whiteBlunders,
            blackBlunders,
            player1Blunders,
            player2Blunders,
            player1Acpl,
            player2Acpl,
            whiteAccuracy,
            blackAccuracy
        };
    });
    
    // Find missed mates: games where one player had a forced mate on the board but the other player won
    // Only include games that actually have mate evaluations in the analysis
    const missedMatesGames = gamesWithMetrics
        .filter(g => {
            const game = g.game;
            const analysis = game.analysis || [];
            
            if (analysis.length === 0) {
                return false; // Need analysis data to detect missed mates
            }
            
            // Check if losing player had a forced mate
            const whiteLost = game.winner === 'black';
            const blackLost = game.winner === 'white';
            
            // Look through analysis for forced mates
            // Analysis array: index 0 = after white's 1st move, index 1 = after black's 1st move, etc.
            // So even indices = white's position, odd indices = black's position
            let whiteHadMate = false;
            let blackHadMate = false;
            
            for (let i = 0; i < analysis.length; i++) {
                const evalData = analysis[i];
                const isWhitePosition = i % 2 === 0; // Even indices are after white moves (white's position)
                
                // Only check for actual mate evaluations (mate field must exist)
                if (evalData.mate !== undefined && typeof evalData.mate === 'number') {
                    if (evalData.mate > 0 && isWhitePosition) {
                        // White has forced mate
                        whiteHadMate = true;
                    } else if (evalData.mate < 0 && !isWhitePosition) {
                        // Black has forced mate
                        blackHadMate = true;
                    }
                }
            }
            
            // Only return true if we found an actual mate evaluation and the player who had it lost
            if (whiteLost && whiteHadMate) {
                return true; // White had mate but lost
            }
            if (blackLost && blackHadMate) {
                return true; // Black had mate but lost
            }
            
            return false;
        })
        .map(g => {
            const game = g.game;
            const analysis = game.analysis || [];
            
            // Calculate missed mate score - find the best (lowest) mate count the losing player had
            let missedMateScore = 0;
            const whiteLost = game.winner === 'black';
            const blackLost = game.winner === 'white';
            
            let bestMateForLoser = Infinity;
            
            for (let i = 0; i < analysis.length; i++) {
                const evalData = analysis[i];
                const isWhitePosition = i % 2 === 0;
                
                if (evalData.mate !== undefined) {
                    if (whiteLost && isWhitePosition && evalData.mate > 0) {
                        // White had mate but lost - track the best mate they had
                        if (evalData.mate < bestMateForLoser) {
                            bestMateForLoser = evalData.mate;
                        }
                    } else if (blackLost && !isWhitePosition && evalData.mate < 0) {
                        // Black had mate but lost - track the best mate they had
                        const mateCount = Math.abs(evalData.mate);
                        if (mateCount < bestMateForLoser) {
                            bestMateForLoser = mateCount;
                        }
                    }
                }
            }
            
            // Score: lower mate count = worse miss (mate in 1 is worse than mate in 5)
            // So we use 1000 - mateCount to make lower numbers score higher
            if (bestMateForLoser !== Infinity) {
                missedMateScore = 1000 - bestMateForLoser;
            }
            
            return {
                ...g,
                missedMateScore,
                bestMateMissed: bestMateForLoser !== Infinity ? bestMateForLoser : null
            };
        })
        .sort((a, b) => b.missedMateScore - a.missedMateScore)
        .slice(0, 10)
        .map(g => g.game);
    
    // Sort and get top games for each category
    const sortedByAcpl = [...gamesWithMetrics].sort((a, b) => b.totalAcpl - a.totalAcpl);
    const sortedByBlunders = [...gamesWithMetrics].sort((a, b) => b.totalBlunders - a.totalBlunders);
    const sortedByAccuracyHigh = [...gamesWithMetrics].sort((a, b) => b.avgAccuracy - a.avgAccuracy);
    const sortedByAccuracyLow = [...gamesWithMetrics].sort((a, b) => a.avgAccuracy - b.avgAccuracy);
    
    // Get top 10 for each category
    return {
        missedMates: missedMatesGames,
        bigSwings: sortedByAcpl.slice(0, 10).map(g => g.game),
        highBlunders: sortedByBlunders.slice(0, 10).map(g => g.game),
        greatGames: sortedByAccuracyHigh.slice(0, 10).map(g => g.game),
        chaoticGames: sortedByAccuracyLow.slice(0, 10).map(g => g.game)
    };
}

// Store interesting games data globally for tab switching
let currentInterestingGames = null;
let currentPlayerNames = null;
let currentShowYear = false;

function displayInterestingGames(gamesByMonth, player1Name, player2Name) {
    const interesting = findInterestingGames(gamesByMonth, player1Name, player2Name);
    const route = typeof Router !== 'undefined' ? Router.getCurrentRoute() : { year: 'all', month: 'all', day: 'all' };
    const showYear = route.year === 'all';
    
    // Store for tab switching
    currentInterestingGames = interesting;
    currentPlayerNames = { player1Name, player2Name };
    currentShowYear = showYear;
    
    // Display all categories (they'll be shown/hidden by tabs)
    displayInterestingCategory('missed-mates', interesting.missedMates, 'Missed Mates', 
        'Games where one player had a forced mate on the board but the other player won', 
        player1Name, player2Name, showYear);
    displayInterestingCategory('big-swings', interesting.bigSwings, 'Big Swings', 
        'Games with the highest combined ACPL (biggest mistakes/swings)', 
        player1Name, player2Name, showYear);
    displayInterestingCategory('high-blunders', interesting.highBlunders, 'High Blunders', 
        'Games with the most total blunders', 
        player1Name, player2Name, showYear);
    displayInterestingCategory('great-games', interesting.greatGames, 'Great Games', 
        'Games with the highest average accuracy', 
        player1Name, player2Name, showYear);
    displayInterestingCategory('chaotic-games', interesting.chaoticGames, 'Chaotic Games', 
        'Games with the lowest average accuracy', 
        player1Name, player2Name, showYear);
    
    // Setup fun category tab switching
    setupFunCategoryTabs();
}

function setupFunCategoryTabs() {
    const funCategoryButtons = document.querySelectorAll('.fun-category-tab');
    const funCategoryPanes = document.querySelectorAll('.fun-category-pane');
    
    funCategoryButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetCategory = button.dataset.funCategory;
            
            // Remove active class from all buttons and panes
            funCategoryButtons.forEach(btn => {
                btn.classList.remove('active');
                btn.classList.remove('border-gray-400', 'text-gray-300');
                btn.classList.add('border-transparent', 'text-gray-400');
            });
            
            funCategoryPanes.forEach(pane => {
                pane.classList.remove('active');
            });
            
            // Add active class to clicked button and corresponding pane
            button.classList.add('active');
            button.classList.remove('border-transparent', 'text-gray-400');
            button.classList.add('border-gray-400', 'text-gray-300');
            
            const targetPane = document.querySelector(`[data-fun-category-content="${targetCategory}"]`);
            if (targetPane) {
                targetPane.classList.add('active');
            }
        });
    });
    
    // Activate first tab by default if none is active
    const activeButton = document.querySelector('.fun-category-tab.active');
    if (!activeButton && funCategoryButtons.length > 0) {
        funCategoryButtons[0].click();
    }
}

function displayInterestingCategory(containerId, games, title, description, player1Name, player2Name, showYear) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (games.length === 0) {
        container.innerHTML = `
            <div class="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-4">
                <h3 class="text-sm font-semibold mb-2 text-gray-300">${title}</h3>
                <p class="text-xs text-gray-500 mb-2">${description}</p>
                <p class="text-xs text-gray-500">No games with analysis data found.</p>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="bg-gray-800 rounded-lg border border-gray-700 mb-4 overflow-hidden">
            <div class="p-3 border-b border-gray-700">
                <h3 class="text-sm font-semibold mb-1 text-gray-300">${title}</h3>
                <p class="text-xs text-gray-500">${description}</p>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-xs">
                    <thead>
                        <tr class="border-b border-gray-700 text-gray-400 bg-gray-900">
                            <th class="px-2 py-2 text-left">#</th>
                            <th class="px-2 py-2 text-left">Date</th>
                            <th class="px-2 py-2 text-center">White</th>
                            <th class="px-2 py-2 text-center">Result</th>
                            <th class="px-2 py-2 text-center">Black</th>
                            <th class="px-2 py-2 text-left hidden sm:table-cell">Opening</th>
                            <th class="px-2 py-2 text-center hidden sm:table-cell">Type</th>
                            <th class="px-2 py-2 text-center">Moves</th>
                            <th class="px-2 py-2 text-center hidden sm:table-cell">W Acc</th>
                            <th class="px-2 py-2 text-center hidden sm:table-cell">B Acc</th>
                            <th class="px-2 py-2 text-center">W ACPL</th>
                            <th class="px-2 py-2 text-center">B ACPL</th>
                            <th class="px-2 py-2 text-center">W Bl</th>
                            <th class="px-2 py-2 text-center">B Bl</th>
                            ${containerId === 'missed-mates' ? '<th class="px-2 py-2 text-center">Missed Mate</th>' : ''}
                            <th class="px-2 py-2 text-center">Link</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-700">
    `;
    
    games.forEach((game, index) => {
        const whiteAnalysis = game.players?.white?.analysis || {};
        const blackAnalysis = game.players?.black?.analysis || {};
        
        const whitePlayer = game.players.white.user.name;
        const blackPlayer = game.players.black.user.name;
        const isPlayer1White = whitePlayer === player1Name;
        const { whiteColor, blackColor } = getPlayerColors(isPlayer1White);
        
        const gameDate = new Date(game.createdAt);
        const dateStr = formatDate24h(gameDate, showYear);
        
        const { text: resultText, class: resultClass } = getGameResult(game.winner, whiteColor, blackColor);
        
        const moveCount = game.moves ? game.moves.split(' ').length : 0;
        const openingName = game.opening?.name || 'Unknown';
        const openingShort = truncateOpeningName(openingName);
        const termination = getTerminationIcon(game.status || 'unknown');
        
        const whiteAcc = whiteAnalysis.accuracy || '-';
        const blackAcc = blackAnalysis.accuracy || '-';
        const whiteAcpl = whiteAnalysis.acpl || '-';
        const blackAcpl = blackAnalysis.acpl || '-';
        const whiteBlunders = whiteAnalysis.blunder || 0;
        const blackBlunders = blackAnalysis.blunder || 0;
        
        // For missed mates section, find and display the mate that was missed
        const isMissedMates = containerId === 'missed-mates';
        const whiteLost = game.winner === 'black';
        const blackLost = game.winner === 'white';
        let missedMateInfo = '';
        let missedMateColorClass = '';
        
        if (isMissedMates && game.analysis && game.analysis.length > 0) {
            let bestMateMissed = null;
            let playerWhoMissed = null;
            
            for (let i = 0; i < game.analysis.length; i++) {
                const evalData = game.analysis[i];
                const isWhitePosition = i % 2 === 0; // Even indices are after white moves (white's position)
                
                if (evalData.mate !== undefined) {
                    if (whiteLost && isWhitePosition && evalData.mate > 0) {
                        // White had mate but lost
                        if (!bestMateMissed || evalData.mate < bestMateMissed) {
                            bestMateMissed = evalData.mate;
                            playerWhoMissed = whitePlayer; // White player missed it
                        }
                    } else if (blackLost && !isWhitePosition && evalData.mate < 0) {
                        // Black had mate but lost
                        const mateCount = Math.abs(evalData.mate);
                        if (!bestMateMissed || mateCount < bestMateMissed) {
                            bestMateMissed = mateCount;
                            playerWhoMissed = blackPlayer; // Black player missed it
                        }
                    }
                }
            }
            
            if (bestMateMissed && playerWhoMissed) {
                missedMateInfo = `${playerWhoMissed} missed M${bestMateMissed}`;
                // Use player color for the missed mate info
                const isPlayer1Missed = playerWhoMissed === player1Name;
                // Use player1 color (red) if player1 missed it, otherwise player2 color (blue)
                missedMateColorClass = isPlayer1Missed ? 'text-red-400' : 'text-blue-400';
            }
        }
        
        // Use neutral colors for blunders (not red to avoid confusion with player colors)
        const whiteBlunderClass = whiteBlunders > 0 
            ? 'text-yellow-400 font-bold' 
            : 'text-gray-500';
        const blackBlunderClass = blackBlunders > 0 
            ? 'text-yellow-400 font-bold' 
            : 'text-gray-500';
        
        html += `
            <tr class="hover:bg-gray-800">
                <td class="px-2 py-2 text-gray-500">${index + 1}</td>
                <td class="px-2 py-2 text-gray-500">${dateStr}</td>
                <td class="px-2 py-2 text-center ${whiteColor}">${whitePlayer}</td>
                <td class="px-2 py-2 text-center font-bold ${resultClass}">${resultText}</td>
                <td class="px-2 py-2 text-center ${blackColor}">${blackPlayer}</td>
                <td class="px-2 py-2 hidden sm:table-cell" title="${openingName}">${openingShort}</td>
                <td class="px-2 py-2 text-center hidden sm:table-cell" title="${termination.label}">
                    <span class="${termination.color}" style="font-size: 1em; filter: grayscale(100%);">${termination.icon}</span>
                </td>
                <td class="px-2 py-2 text-center text-gray-400">${moveCount}</td>
                <td class="px-2 py-2 text-center hidden sm:table-cell ${whiteAcc !== '-' && whiteAcc >= 80 ? 'text-green-400' : 'text-gray-400'}">${whiteAcc !== '-' ? whiteAcc + '%' : '-'}</td>
                <td class="px-2 py-2 text-center hidden sm:table-cell ${blackAcc !== '-' && blackAcc >= 80 ? 'text-green-400' : 'text-gray-400'}">${blackAcc !== '-' ? blackAcc + '%' : '-'}</td>
                <td class="px-2 py-2 text-center text-gray-300">${whiteAcpl}</td>
                <td class="px-2 py-2 text-center text-gray-300">${blackAcpl}</td>
                <td class="px-2 py-2 text-center ${whiteBlunderClass}">${whiteBlunders}</td>
                <td class="px-2 py-2 text-center ${blackBlunderClass}">${blackBlunders}</td>
                ${isMissedMates ? `<td class="px-2 py-2 text-center ${missedMateColorClass || 'text-gray-400'} font-bold">${missedMateInfo || '-'}</td>` : ''}
                <td class="px-2 py-2 text-center">
                    <a href="https://lichess.org/${game.id}" target="_blank" rel="noopener noreferrer" class="text-gray-300 hover:underline">View</a>
                </td>
            </tr>
        `;
    });
    
    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}
