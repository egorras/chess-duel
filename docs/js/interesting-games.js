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
    
    // Find missed mates: games where the losing player had 2+ blunders
    const missedMatesGames = gamesWithMetrics
        .filter(g => {
            const game = g.game;
            const whitePlayer = game.players.white.user.name;
            const isPlayer1White = whitePlayer === player1Name;
            
            // Check if white lost and had blunders
            if (game.winner === 'black' && g.whiteBlunders >= 2) {
                return true;
            }
            // Check if black lost and had blunders
            if (game.winner === 'white' && g.blackBlunders >= 2) {
                return true;
            }
            return false;
        })
        .map(g => ({
            ...g,
            // Calculate a "missed mate score" - blunders of losing player
            missedMateScore: g.game.winner === 'white' 
                ? g.blackBlunders 
                : g.whiteBlunders
        }))
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
    displayInterestingCategory('missed-mates', interesting.missedMates, 'Missed Mates (Lost with 2+ Blunders)', 
        'Games where the losing player had 2+ blunders - potential missed mates that cost the game', 
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
        
        // Highlight the losing player's blunders for missed mates section
        const isMissedMates = containerId === 'missed-mates';
        const whiteLost = game.winner === 'black';
        const blackLost = game.winner === 'white';
        const whiteBlunderClass = isMissedMates && whiteLost && whiteBlunders >= 2 
            ? 'text-red-500 font-bold' 
            : whiteBlunders > 0 
                ? 'text-red-400 font-bold' 
                : 'text-gray-500';
        const blackBlunderClass = isMissedMates && blackLost && blackBlunders >= 2 
            ? 'text-red-500 font-bold' 
            : blackBlunders > 0 
                ? 'text-red-400 font-bold' 
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
