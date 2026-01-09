// Function to fetch recent games from Lichess API and merge with existing data

const LICHESS_API = 'https://lichess.org/api';

// Get API key from localStorage or prompt user
function getApiKey() {
    let apiKey = localStorage.getItem('lichess_api_key');
    if (!apiKey) {
        apiKey = prompt('Please enter your Lichess API key:\n\nYou can get one from: https://lichess.org/account/oauth/token\n\nThis will be stored locally in your browser.');
        if (apiKey) {
            localStorage.setItem('lichess_api_key', apiKey);
        }
    }
    return apiKey;
}

// Get the most recent game timestamp from existing data
function getMostRecentGameTimestamp(gamesByMonth) {
    let mostRecent = 0;
    for (const games of Object.values(gamesByMonth)) {
        for (const game of games) {
            if (game.createdAt > mostRecent) {
                mostRecent = game.createdAt;
            }
        }
    }
    return mostRecent;
}

// Fetch games from Lichess API for a given time period with retry logic for rate limits
async function fetchGamesFromLichess(username, apiKey, since, until, vsPlayer = null, retryCount = 0, onRetry = null) {
    const maxRetries = 3;
    
    const params = new URLSearchParams({
        rated: 'false',
        since: since.toString(),
        until: until.toString(),
        accuracy: 'true',
        clocks: 'true',
        division: 'true',
        moves: 'true',
        opening: 'true',
        evals: 'true',
        sort: 'dateAsc'
    });

    if (vsPlayer) {
        params.set('vs', vsPlayer);
    }

    const url = `${LICHESS_API}/games/user/${username}?${params.toString()}`;
    
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/x-ndjson'
        }
    });

    if (response.status === 429) {
        // Rate limited - retry with exponential backoff
        if (retryCount < maxRetries) {
            const waitTime = Math.pow(2, retryCount) * 2000; // 2s, 4s, 8s
            if (onRetry) {
                onRetry(retryCount + 1, maxRetries, waitTime);
            }
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return fetchGamesFromLichess(username, apiKey, since, until, vsPlayer, retryCount + 1, onRetry);
        } else {
            throw new Error(`Rate limited after ${maxRetries} retries. Please try again later.`);
        }
    }

    if (response.status === 401) {
        // Invalid API key - clear it from storage
        localStorage.removeItem('lichess_api_key');
        throw new Error('Invalid API key. Please try again and enter a valid key.');
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.text();
    
    // Parse NDJSON (newline-delimited JSON)
    const games = data
        .trim()
        .split('\n')
        .filter(line => line)
        .map(line => JSON.parse(line));

    return games;
}

// Merge new games with existing games
function mergeGamesWithExisting(existingGamesByMonth, newGames) {
    const gameMap = new Map();

    // Create a map of existing games by ID
    for (const games of Object.values(existingGamesByMonth)) {
        for (const game of games) {
            gameMap.set(game.id, game);
        }
    }

    // Add new games (will overwrite duplicates)
    let newCount = 0;
    for (const game of newGames) {
        // Only include blitz games
        if (game.speed === 'blitz') {
            if (!gameMap.has(game.id)) {
                newCount++;
            }
            gameMap.set(game.id, game);
        }
    }

    // Reorganize by month
    const reorganized = {};
    for (const game of gameMap.values()) {
        const date = new Date(game.createdAt);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const monthKey = `${year}-${month}`;
        
        if (!reorganized[monthKey]) {
            reorganized[monthKey] = [];
        }
        reorganized[monthKey].push(game);
    }

    // Sort games within each month by createdAt
    for (const monthKey in reorganized) {
        reorganized[monthKey].sort((a, b) => a.createdAt - b.createdAt);
    }

    return { mergedGames: reorganized, newCount };
}

// Main function to load recent games
async function loadRecentGames(gamesByMonth, player1Name, player2Name, onRetry = null) {
    const apiKey = getApiKey();
    if (!apiKey) {
        return { success: false, error: 'API key is required' };
    }

    // Get the most recent game timestamp, or fetch from last hour if no games exist
    const mostRecentTimestamp = getMostRecentGameTimestamp(gamesByMonth);
    const since = mostRecentTimestamp > 0 ? mostRecentTimestamp : Date.now() - 3600000; // Last hour if no games
    const until = Date.now();

    try {
        // Fetch games from one player's perspective (head-to-head games are the same from both perspectives)
        // Using player1 as the primary source
        const games = await fetchGamesFromLichess(player1Name, apiKey, since, until, player2Name, 0, onRetry);
        
        // Filter for blitz games only
        const uniqueGames = games.filter(game => game.speed === 'blitz');

        if (uniqueGames.length === 0) {
            return { success: true, newCount: 0, message: 'No new games found' };
        }

        // Merge with existing games
        const { mergedGames, newCount } = mergeGamesWithExisting(gamesByMonth, uniqueGames);

        return {
            success: true,
            newCount,
            mergedGames,
            message: newCount > 0 ? `Loaded ${newCount} new game${newCount !== 1 ? 's' : ''}` : 'No new games found'
        };
    } catch (error) {
        console.error('Error loading recent games:', error);
        return {
            success: false,
            error: error.message || 'Failed to load recent games'
        };
    }
}
