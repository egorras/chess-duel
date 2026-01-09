// Performance optimizations and caching utilities

// Cache for expensive calculations
const calculationCache = new Map();

// Cache key generator
function getCacheKey(prefix, ...args) {
    return `${prefix}_${JSON.stringify(args)}`;
}

// Memoized countKingMoves - cache results per game
const kingMovesCache = new Map();
function countKingMovesCached(movesString, gameId) {
    if (!movesString) return { white: 0, black: 0 };
    
    // Use gameId as cache key if available
    const cacheKey = gameId || movesString;
    if (kingMovesCache.has(cacheKey)) {
        return kingMovesCache.get(cacheKey);
    }
    
    // Use the utility function from utils.js
    const result = countKingMoves(movesString);
    kingMovesCache.set(cacheKey, result);
    return result;
}

// Memoized move count calculation
const moveCountCache = new Map();
function getMoveCountCached(movesString, gameId) {
    if (!movesString) return 0;
    
    const cacheKey = gameId || movesString;
    if (moveCountCache.has(cacheKey)) {
        return moveCountCache.get(cacheKey);
    }
    
    const count = movesString.split(' ').length;
    moveCountCache.set(cacheKey, count);
    return count;
}

// Pre-compute game metadata to avoid repeated calculations
function precomputeGameMetadata(games) {
    return games.map(game => {
        const moveCount = getMoveCountCached(game.moves, game.id);
        const kingMoves = countKingMovesCached(game.moves, game.id);
        
        return {
            ...game,
            _metadata: {
                moveCount,
                kingMoves,
                date: new Date(game.createdAt),
                whitePlayer: game.players.white.user.name,
                blackPlayer: game.players.black.user.name,
                openingName: game.opening?.name || 'Unknown',
                whiteAcc: game.players.white.analysis?.accuracy || 0,
                blackAcc: game.players.black.analysis?.accuracy || 0
            }
        };
    });
}

// Debounce function for expensive operations
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function for frequent events
function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Batch DOM updates using DocumentFragment
function batchDOMUpdates(container, createElement) {
    const fragment = document.createDocumentFragment();
    return fragment;
}

// Clear caches when needed
function clearCaches() {
    kingMovesCache.clear();
    moveCountCache.clear();
    calculationCache.clear();
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.optimizations = {
        countKingMovesCached,
        getMoveCountCached,
        precomputeGameMetadata,
        debounce,
        throttle,
        batchDOMUpdates,
        clearCaches
    };
}
