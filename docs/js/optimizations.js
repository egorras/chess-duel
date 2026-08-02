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

// Memoized queen-blunder detection - cache results per game, since it
// requires a full chess.js replay (comparatively expensive vs. the other
// cached calculations here).
const queenBlunderCache = new Map();

// A "queen blunder" is a queen captured on the move immediately after its
// owner made a move judged 'blunder' - i.e. they hung it. Judgment comes
// from Lichess's own analysis when present, else our Stockfish re-analysis
// (same preference order used in stats-calculator.js).
function judgmentAtPly(game, plyIndex) {
    const lichessEntry = Array.isArray(game.analysis) ? game.analysis[plyIndex] : null;
    if (lichessEntry && lichessEntry.judgment && lichessEntry.judgment.name) {
        return lichessEntry.judgment.name.toLowerCase();
    }
    const sfEntry = game.stockfishAnalysis && game.stockfishAnalysis.moves
        ? game.stockfishAnalysis.moves[plyIndex]
        : null;
    return sfEntry ? sfEntry.judgment : null;
}

function computeQueenBlunders(game) {
    const sanMoves = game.moves ? game.moves.split(' ').filter(Boolean) : [];
    const hasAnalysis = (Array.isArray(game.analysis) && game.analysis.length > 0) ||
        !!(game.stockfishAnalysis && game.stockfishAnalysis.moves);
    if (sanMoves.length === 0 || !hasAnalysis) {
        return { white: 0, black: 0 };
    }

    const chess = new window.Chess();
    let white = 0;
    let black = 0;
    let prevMoverColor = null;

    for (let i = 0; i < sanMoves.length; i++) {
        let move;
        try {
            move = chess.move(sanMoves[i]);
        } catch (e) {
            break; // malformed/truncated move list - stop rather than mis-attribute the rest
        }
        if (!move) break;

        if (move.captured === 'q' && prevMoverColor && judgmentAtPly(game, i - 1) === 'blunder') {
            if (prevMoverColor === 'w') white++;
            else black++;
        }
        prevMoverColor = move.color;
    }

    return { white, black };
}

// A chess.js replay of every game in view (the default route is "All
// Time", i.e. every game ever played) is too slow to do inline - it's a
// full legal-move-generating replay per game, and there can be thousands.
// So countQueenBlundersCached() never blocks: it returns cached results
// immediately and otherwise answers 0 while quietly working through
// whatever isn't cached yet in idle-time slices, then asks the UI to
// redraw once so it can pick the real numbers up.
const queenBlunderQueue = [];
const queenBlunderQueued = new Set();
let queenBlunderProcessing = false;

function scheduleQueenBlunderSlice() {
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(processQueenBlunderQueue, { timeout: 500 });
    } else {
        setTimeout(() => processQueenBlunderQueue(), 16);
    }
}

function processQueenBlunderQueue(deadline) {
    const sliceStart = Date.now();
    const timeLeft = () => (deadline && typeof deadline.timeRemaining === 'function')
        ? deadline.timeRemaining()
        : 16 - (Date.now() - sliceStart);

    while (queenBlunderQueue.length > 0 && timeLeft() > 0) {
        const game = queenBlunderQueue.shift();
        const cacheKey = game.id || game.moves;
        queenBlunderQueued.delete(cacheKey);
        queenBlunderCache.set(cacheKey, computeQueenBlunders(game));
    }

    if (queenBlunderQueue.length > 0) {
        scheduleQueenBlunderSlice();
    } else {
        queenBlunderProcessing = false;
        // One redraw once the backlog is fully cleared, rather than after
        // every slice - stats-calculator.js re-derives everything from
        // scratch on each render, so there's no point refreshing mid-drain.
        window.dispatchEvent(new Event('hashchange'));
    }
}

function countQueenBlundersCached(game) {
    if (!game || !game.moves) return { white: 0, black: 0 };

    const cacheKey = game.id || game.moves;
    if (queenBlunderCache.has(cacheKey)) {
        return queenBlunderCache.get(cacheKey);
    }

    // chess.js loads via a deferred module script (see index.html) and may
    // not be ready yet on the very first render.
    if (typeof window !== 'undefined' && typeof window.Chess === 'function' && !queenBlunderQueued.has(cacheKey)) {
        queenBlunderQueued.add(cacheKey);
        queenBlunderQueue.push(game);
        if (!queenBlunderProcessing) {
            queenBlunderProcessing = true;
            scheduleQueenBlunderSlice();
        }
    }

    return { white: 0, black: 0 };
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
    queenBlunderCache.clear();
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
    if (queenBlunderCache.size > 10000) {
        queenBlunderCache.clear();
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
        countQueenBlundersCached,
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
