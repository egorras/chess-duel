// Performance optimizations and caching utilities

// Cache for expensive calculations
const calculationCache = new Map();

// Cache key generator
function getCacheKey(prefix, ...args) {
    return `${prefix}_${JSON.stringify(args)}`;
}

// LRU Cache implementation for memory-efficient caching
class LRUCache {
    constructor(maxSize = 10) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    get(key) {
        if (!this.cache.has(key)) {
            return undefined;
        }
        // Move to end (most recently used)
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key, value) {
        if (this.cache.has(key)) {
            // Update existing: remove and re-add to end
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Remove least recently used (first item)
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    has(key) {
        return this.cache.has(key);
    }

    clear() {
        this.cache.clear();
    }

    get size() {
        return this.cache.size;
    }
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

// Memory cleanup utilities
function cleanupMemory() {
    // Clear calculation caches periodically
    if (kingMovesCache.size > 10000) {
        kingMovesCache.clear();
    }
    if (moveCountCache.size > 10000) {
        moveCountCache.clear();
    }
    if (calculationCache.size > 1000) {
        calculationCache.clear();
    }
    
    // Force garbage collection hint (if available)
    if (window.gc) {
        window.gc();
    }
}

// Periodic memory cleanup (every 5 minutes)
let memoryCleanupInterval = null;
function startMemoryCleanup() {
    if (memoryCleanupInterval) return;
    memoryCleanupInterval = setInterval(cleanupMemory, 5 * 60 * 1000);
}

function stopMemoryCleanup() {
    if (memoryCleanupInterval) {
        clearInterval(memoryCleanupInterval);
        memoryCleanupInterval = null;
    }
}

// Estimate memory usage of an object (rough approximation)
function estimateMemoryUsage(obj) {
    if (obj === null || obj === undefined) return 0;
    
    let bytes = 0;
    const visited = new WeakSet();
    
    function calculate(obj) {
        if (typeof obj === 'string') {
            return obj.length * 2; // 2 bytes per character
        } else if (typeof obj === 'number') {
            return 8; // 8 bytes for number
        } else if (typeof obj === 'boolean') {
            return 4; // 4 bytes for boolean
        } else if (Array.isArray(obj)) {
            bytes += obj.length * 8; // Array overhead
            obj.forEach(item => {
                if (typeof item === 'object' && item !== null && !visited.has(item)) {
                    visited.add(item);
                    calculate(item);
                } else {
                    bytes += estimateMemoryUsage(item);
                }
            });
        } else if (typeof obj === 'object') {
            if (visited.has(obj)) return 0;
            visited.add(obj);
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    bytes += key.length * 2; // Key string
                    bytes += estimateMemoryUsage(obj[key]);
                }
            }
        }
    }
    
    calculate(obj);
    return bytes;
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
        clearCaches,
        LRUCache,
        cleanupMemory,
        startMemoryCleanup,
        stopMemoryCleanup,
        estimateMemoryUsage
    };
}
