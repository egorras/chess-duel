// Moves Explorer — a personal "opening explorer" over our own game history.
// Builds a tree of moves played (keyed by SAN sequence) with win/draw/loss
// counts — and, where we have computer analysis, average eval — at every
// position, and lets you click through it move by move.

const EXPLORER_MAX_PLY = Infinity; // no cap; walk full game length

// Solid glyph set for both colors — the "white" outline glyphs (♔♕♖...) are
// hollow by design and let the square show through no matter what fill color
// is applied, which is what made them hard to see.
const PIECE_UNICODE = {
    p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚'
};

// chess.com-style green board
const SQUARE_LIGHT = '#ebecd0';
const SQUARE_DARK = '#779952';

const ARROW_LAST_COLOR = 'rgba(255, 170, 0, 0.85)';
const ARROW_HOVER_COLOR = 'rgba(56, 189, 248, 0.95)';

const explorerState = {
    root: null,
    treeKey: null, // `${scopeKey}::${colorFilter}` — rebuild the tree only when this changes
    colorFilter: 'all', // 'all' | 'white' | 'black' — restricted to player1's color
    path: [], // [{ san, node }]
    forwardStack: [], // steps popped by ArrowLeft, replayable with ArrowRight until a different move is chosen
    player1Name: '',
    player2Name: '',
    gamesByMonth: null, // most recent games for the active scope, kept fresh on every initExplorer call
    scopeKey: null,
    currentChess: null, // chess.js instance at the current path (for hover-move previews)
    lastMove: null, // verbose move object for the last move in the path, or null at start
    renderedSanPath: null, // SAN path currently reflected in the piece layer, for step animation
    pieceEls: new Map(), // square -> piece element currently on the board
    flipped: false // true = black on bottom
};

function explorerCreateNode() {
    // p1/p2/draw = game OUTCOME after reaching this node (who won the game).
    // moverP1/moverP2 = who actually PLAYED the move that led to this node —
    // needed because in the "All" color filter, p1 may be either color from
    // game to game, so outcome color alone can't tell you whose preference
    // a given move reflects.
    return { count: 0, p1: 0, p2: 0, draw: 0, moverP1: 0, moverP2: 0, evalSum: 0, evalCount: 0, children: new Map(), games: [] };
}

function explorerApplyResult(node, result) {
    node.count++;
    if (result === 'p1') node.p1++;
    else if (result === 'p2') node.p2++;
    else node.draw++;
}

// --- Eval extraction (reuses whatever computer analysis we have — Lichess's
// own, or our Stockfish supplement — without needing a live engine here) ----
function evalWinPercent(cp) {
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

// Returns an array indexed by (ply - 1) of white-perspective centipawn evals,
// or null where unavailable. Prefers Lichess's own analysis; falls back to
// our Stockfish supplement.
function getWhiteEvalByPly(game) {
    if (Array.isArray(game.analysis) && game.analysis.length > 0) {
        return game.analysis.map(entry => {
            if (!entry) return null;
            if (typeof entry.eval === 'number') return entry.eval;
            if (typeof entry.mate === 'number') return entry.mate > 0 ? 1000 : -1000;
            return null;
        });
    }

    const sf = game.stockfishAnalysis;
    if (sf && Array.isArray(sf.positions) && sf.positions.length > 1) {
        // positions[0] is the start position; ply p's eval is positions[p].
        const result = [];
        for (let ply = 1; ply < sf.positions.length; ply++) {
            const pos = sf.positions[ply];
            if (!pos) { result.push(null); continue; }
            const sideToMoveIsWhite = ply % 2 === 0; // positions[0]=start(white to move), alternates
            let cp = null;
            if (pos.mate !== null && pos.mate !== undefined) cp = pos.mate > 0 ? 1000 : -1000;
            else if (typeof pos.cp === 'number') cp = pos.cp;
            result.push(cp === null ? null : (sideToMoveIsWhite ? cp : -cp));
        }
        return result;
    }

    return null;
}

function buildMoveTree(gamesByMonth, player1Name, colorFilter) {
    const root = explorerCreateNode();
    const allGames = Object.values(gamesByMonth).flat();

    allGames.forEach(game => {
        if (!game.moves) return;
        const tokens = game.moves.split(' ').filter(Boolean);
        if (tokens.length === 0) return;

        const isP1White = game.players.white.user.name === player1Name;
        if (colorFilter === 'white' && !isP1White) return;
        if (colorFilter === 'black' && isP1White) return;

        let result;
        if (!game.winner) result = 'draw';
        else if ((game.winner === 'white' && isP1White) || (game.winner === 'black' && !isP1White)) result = 'p1';
        else result = 'p2';

        const evalByPly = getWhiteEvalByPly(game);

        let node = root;
        explorerApplyResult(node, result);

        const limit = Math.min(tokens.length, EXPLORER_MAX_PLY);
        for (let i = 0; i < limit; i++) {
            const san = tokens[i];
            if (!node.children.has(san)) node.children.set(san, explorerCreateNode());
            node = node.children.get(san);
            explorerApplyResult(node, result);

            // Ply i (0-indexed) is White's move when i is even.
            const moveIsWhite = i % 2 === 0;
            const moverIsP1 = moveIsWhite === isP1White;
            if (moverIsP1) node.moverP1++;
            else node.moverP2++;

            const whiteEval = evalByPly && evalByPly[i] != null ? evalByPly[i] : null;
            if (whiteEval !== null) {
                node.evalSum += whiteEval;
                node.evalCount++;
            }

            node.games.push({ id: game.id, ply: i + 1, createdAt: game.createdAt, mover: moverIsP1 ? 'p1' : 'p2', result });
        }
    });

    return root;
}

function explorerCurrentNode() {
    let node = explorerState.root;
    for (const step of explorerState.path) node = step.node;
    return node;
}

function replayPath(sanPath) {
    if (typeof window.Chess !== 'function') return { chess: null, lastMove: null };
    const chess = new window.Chess();
    let lastMove = null;
    for (const san of sanPath) {
        const move = chess.move(san);
        if (!move) break;
        lastMove = move;
    }
    return { chess, lastMove };
}

// --- Board rendering ---------------------------------------------------------
// Squares are a static background grid (built once). Pieces live in their own
// absolutely-positioned layer so a single ply's change can move/add/remove
// just the affected elements with a CSS transition, instead of a full redraw.

// Row/col in board-display space (0,0 = top-left as drawn), honoring flip.
function squareRowCol(square) {
    const file = square.charCodeAt(0) - 97; // 'a' -> 0
    const rank = parseInt(square[1], 10); // 1-8
    const row = 8 - rank; // 0 = rank 8 .. 7 = rank 1, white-at-bottom orientation
    const col = file;
    if (!explorerState.flipped) return { row, col };
    return { row: 7 - row, col: 7 - col };
}

function pieceStyleFor(square) {
    const { row, col } = squareRowCol(square);
    return { left: `${col * 12.5}%`, top: `${row * 12.5}%` };
}

function stylePieceGlyph(el, color) {
    if (color === 'w') {
        el.style.color = '#ffffff';
        // Poor-man's stroke (multi-direction shadow) so the solid glyph reads
        // as a piece, not a blob, on either square shade.
        el.style.textShadow = [
            '-1px -1px 0 #000', '1px -1px 0 #000',
            '-1px 1px 0 #000', '1px 1px 0 #000',
            '0 0 3px rgba(0,0,0,0.6)'
        ].join(', ');
    } else {
        el.style.color = '#0a0a0a';
        el.style.textShadow = [
            '-1px -1px 0 #fff', '1px -1px 0 #fff',
            '-1px 1px 0 #fff', '1px 1px 0 #fff',
            '0 0 3px rgba(255,255,255,0.5)'
        ].join(', ');
    }
}

function createPieceEl(type, color, square) {
    const el = document.createElement('div');
    el.className = 'absolute flex items-center justify-center text-2xl sm:text-3xl';
    el.style.width = '12.5%';
    el.style.height = '12.5%';
    el.style.transition = 'left 0.28s ease, top 0.28s ease';
    const pos = pieceStyleFor(square);
    el.style.left = pos.left;
    el.style.top = pos.top;
    el.textContent = PIECE_UNICODE[type];
    stylePieceGlyph(el, color);
    return el;
}

function buildExplorerBoardSquares(squaresEl) {
    squaresEl.innerHTML = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const isLight = (r + c) % 2 === 0;
            const cell = document.createElement('div');
            cell.style.backgroundColor = isLight ? SQUARE_LIGHT : SQUARE_DARK;
            squaresEl.appendChild(cell);
        }
    }
}

function renderExplorerCoordinates() {
    const filesEl = document.getElementById('explorer-board-files');
    const ranksEl = document.getElementById('explorer-board-ranks');
    if (!filesEl || !ranksEl) return;

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
    const orderedFiles = explorerState.flipped ? [...files].reverse() : files;
    const orderedRanks = explorerState.flipped ? [...ranks].reverse() : ranks;

    filesEl.innerHTML = orderedFiles.map(f => `<span class="flex-1 text-center">${f}</span>`).join('');
    ranksEl.innerHTML = orderedRanks.map(r => `<span class="flex-1 flex items-center">${r}</span>`).join('');
}

function rebuildExplorerBoardPieces(piecesEl, chess) {
    piecesEl.innerHTML = '';
    explorerState.pieceEls = new Map();
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = board[r][c];
            if (!sq) continue;
            const el = createPieceEl(sq.type, sq.color, sq.square);
            piecesEl.appendChild(el);
            explorerState.pieceEls.set(sq.square, el);
        }
    }
}

const EXPLORER_CASTLE_ROOK_SQUARES = {
    w: { k: ['h1', 'f1'], q: ['a1', 'd1'] },
    b: { k: ['h8', 'f8'], q: ['a8', 'd8'] }
};

// Animates exactly one ply's worth of change (forward or undo) by moving,
// adding, or removing only the affected piece elements. `longerPath` is
// whichever of the before/after SAN sequences is one ply longer; replaying it
// gives us the verbose move (from/to/captured/flags) describing the diff.
function animateExplorerBoardStep(piecesEl, longerPath, forward) {
    const chess = new window.Chess();
    for (let i = 0; i < longerPath.length - 1; i++) chess.move(longerPath[i]);
    const move = chess.move(longerPath[longerPath.length - 1]);
    if (!move) return false;

    const pieceEls = explorerState.pieceEls;

    const movePieceEl = (from, to) => {
        const el = pieceEls.get(from);
        if (!el) return;
        pieceEls.delete(from);
        const pos = pieceStyleFor(to);
        el.style.left = pos.left;
        el.style.top = pos.top;
        pieceEls.set(to, el);
    };
    const removePieceEl = (square) => {
        const el = pieceEls.get(square);
        if (!el) return;
        pieceEls.delete(square);
        el.remove();
    };
    const addPieceEl = (type, color, square) => {
        const el = createPieceEl(type, color, square);
        piecesEl.appendChild(el);
        pieceEls.set(square, el);
    };
    const castleSide = move.flags.includes('k') ? 'k' : move.flags.includes('q') ? 'q' : null;
    const epSquare = move.to[0] + move.from[1];

    if (forward) {
        if (move.flags.includes('e')) removePieceEl(epSquare);
        else if (move.captured) removePieceEl(move.to);

        movePieceEl(move.from, move.to);
        if (castleSide) {
            const [rFrom, rTo] = EXPLORER_CASTLE_ROOK_SQUARES[move.color][castleSide];
            movePieceEl(rFrom, rTo);
        }
        if (move.promotion) {
            const el = pieceEls.get(move.to);
            if (el) el.textContent = PIECE_UNICODE[move.promotion];
        }
    } else {
        if (castleSide) {
            const [rFrom, rTo] = EXPLORER_CASTLE_ROOK_SQUARES[move.color][castleSide];
            movePieceEl(rTo, rFrom);
        }
        if (move.promotion) {
            const el = pieceEls.get(move.to);
            if (el) el.textContent = PIECE_UNICODE.p;
        }
        movePieceEl(move.to, move.from);

        const capturedColor = move.color === 'w' ? 'b' : 'w';
        if (move.flags.includes('e')) addPieceEl('p', capturedColor, epSquare);
        else if (move.captured) addPieceEl(move.captured, capturedColor, move.to);
    }
    return true;
}

function renderExplorerBoard(sanPath) {
    const boardEl = document.getElementById('explorer-board');
    if (!boardEl) return;

    const { chess, lastMove } = replayPath(sanPath);
    explorerState.currentChess = chess;
    explorerState.lastMove = lastMove;

    if (!chess) {
        boardEl.innerHTML = '<div class="text-xs text-gray-500 flex items-center justify-center h-full">Board unavailable.</div>';
        boardEl.dataset.skeleton = '';
        explorerState.renderedSanPath = null;
        return;
    }

    if (boardEl.dataset.skeleton !== 'true') {
        boardEl.className = 'aspect-square w-full max-w-md mx-auto select-none relative';
        boardEl.innerHTML = `
            <div id="explorer-board-squares" class="absolute inset-0 grid grid-cols-8 grid-rows-8 rounded overflow-hidden border border-gray-700"></div>
            <div id="explorer-board-pieces" class="absolute inset-0 overflow-hidden pointer-events-none"></div>
            <svg id="explorer-arrows" class="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 8 8" preserveAspectRatio="none"></svg>
        `;
        boardEl.dataset.skeleton = 'true';
        buildExplorerBoardSquares(document.getElementById('explorer-board-squares'));
        explorerState.renderedSanPath = null; // force a full piece rebuild below
    }

    const piecesEl = document.getElementById('explorer-board-pieces');
    const prevPath = explorerState.renderedSanPath;
    const isStepForward = !!prevPath && sanPath.length === prevPath.length + 1 &&
        prevPath.every((san, i) => san === sanPath[i]);
    const isStepBackward = !!prevPath && sanPath.length === prevPath.length - 1 &&
        sanPath.every((san, i) => san === prevPath[i]);

    let animated = false;
    if (isStepForward) animated = animateExplorerBoardStep(piecesEl, sanPath, true);
    else if (isStepBackward) animated = animateExplorerBoardStep(piecesEl, prevPath, false);

    if (!animated) rebuildExplorerBoardPieces(piecesEl, chess);

    explorerState.renderedSanPath = sanPath.slice();
    renderExplorerCoordinates();
    drawExplorerArrows(null);
}

// --- Arrows ------------------------------------------------------------------
function squareToCoord(square) {
    const { row, col } = squareRowCol(square);
    return { x: col + 0.5, y: row + 0.5 };
}

function buildArrowMarkup(from, to, color, strokeWidth, markerId) {
    const a = squareToCoord(from);
    const b = squareToCoord(to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const shrink = 0.3; // keep the arrowhead from overlapping the destination piece
    const ex = b.x - (dx / len) * shrink;
    const ey = b.y - (dy / len) * shrink;
    return `<line x1="${a.x}" y1="${a.y}" x2="${ex}" y2="${ey}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" marker-end="url(#${markerId})" />`;
}

function drawExplorerArrows(hoverMove) {
    const svg = document.getElementById('explorer-arrows');
    if (!svg) return;

    let defs = `
        <defs>
            <marker id="explorer-arrowhead-last" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="0.55" markerHeight="0.55" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 Z" fill="${ARROW_LAST_COLOR}" />
            </marker>
            <marker id="explorer-arrowhead-hover" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="0.7" markerHeight="0.7" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 Z" fill="${ARROW_HOVER_COLOR}" />
            </marker>
        </defs>
    `;

    let arrows = '';
    if (explorerState.lastMove) {
        arrows += buildArrowMarkup(explorerState.lastMove.from, explorerState.lastMove.to, ARROW_LAST_COLOR, 0.11, 'explorer-arrowhead-last');
    }
    if (hoverMove) {
        arrows += buildArrowMarkup(hoverMove.from, hoverMove.to, ARROW_HOVER_COLOR, 0.16, 'explorer-arrowhead-hover');
    }

    svg.innerHTML = defs + arrows;
}

// Resolve a candidate SAN move's from/to at the current position, without
// mutating the displayed board, so the moves table can preview it on hover.
function resolveCandidateMove(san) {
    if (!explorerState.currentChess) return null;
    const clone = new window.Chess(explorerState.currentChess.fen());
    const move = clone.move(san);
    return move ? { from: move.from, to: move.to, fen: clone.fen() } : null;
}

// Lichess's analysis board takes a FEN with spaces swapped for underscores.
function lichessAnalysisUrl(fen) {
    return `https://lichess.org/analysis/standard/${fen.replace(/ /g, '_')}`;
}

// --- Eval bar ------------------------------------------------------------
function formatEvalPawns(avgCp) {
    if (Math.abs(avgCp) >= 1000) return avgCp > 0 ? 'M' : '-M'; // mate, sentinel-encoded as ±1000cp
    const pawns = (avgCp / 100).toFixed(1);
    const sign = avgCp > 0 ? '+' : '';
    return `${sign}${pawns}`;
}

function renderExplorerEvalBar(node) {
    const fillEl = document.getElementById('explorer-eval-bar-white');
    const numberEl = document.getElementById('explorer-eval-bar-number');
    const labelEl = document.getElementById('explorer-eval-label');
    if (!fillEl || !labelEl) return;

    if (!node || node.evalCount === 0) {
        fillEl.style.height = '50%';
        if (numberEl) numberEl.textContent = '';
        labelEl.textContent = explorerState.path.length === 0
            ? ''
            : 'No engine data for this position yet';
        return;
    }

    const avgCp = node.evalSum / node.evalCount;
    const whitePct = evalWinPercent(avgCp);
    fillEl.style.height = `${whitePct.toFixed(1)}%`;

    if (numberEl) {
        // Sits right on the white/black boundary of the bar, readable against either fill.
        numberEl.textContent = formatEvalPawns(avgCp);
        numberEl.style.bottom = `${whitePct}%`;
        numberEl.style.transform = 'translateY(50%)';
        numberEl.style.color = avgCp >= 0 ? '#111827' : '#f3f4f6';
        numberEl.style.textShadow = avgCp >= 0
            ? '0 0 2px #fff, 0 0 2px #fff'
            : '0 0 2px #111827, 0 0 2px #111827';
    }

    const pawns = (avgCp / 100).toFixed(2);
    const sign = avgCp > 0 ? '+' : '';
    labelEl.textContent = `Engine: ${sign}${pawns} (avg of ${node.evalCount} analyzed game${node.evalCount === 1 ? '' : 's'})`;
}

// --- Side-to-move indicator ---------------------------------------------
// Well-defined purely by ply parity, independent of the All/White/Black
// filter — clarifies whose move the candidate list below actually shows.
function renderExplorerSideToMove() {
    const el = document.getElementById('explorer-side-to-move');
    if (!el) return;
    const isWhiteToMove = explorerState.path.length % 2 === 0;
    const dotColor = isWhiteToMove ? '#ffffff' : '#0a0a0a';
    const dotBorder = isWhiteToMove ? 'border-gray-500' : 'border-gray-700';

    let colorMapping = '';
    if (explorerState.colorFilter === 'white') {
        colorMapping = ` <span class="text-gray-600">·</span> <span class="text-red-400">${explorerState.player1Name}</span> plays White, <span class="text-blue-400">${explorerState.player2Name}</span> plays Black`;
    } else if (explorerState.colorFilter === 'black') {
        colorMapping = ` <span class="text-gray-600">·</span> <span class="text-red-400">${explorerState.player1Name}</span> plays Black, <span class="text-blue-400">${explorerState.player2Name}</span> plays White`;
    } else {
        colorMapping = ` <span class="text-gray-600">·</span> <span class="text-gray-500">colors vary by game — see "played by" under each move below for who made it</span>`;
    }

    el.innerHTML = `
        <span class="inline-block w-2.5 h-2.5 rounded-full border ${dotBorder}" style="background-color: ${dotColor}"></span>
        <span>${isWhiteToMove ? 'White' : 'Black'} to move</span>${colorMapping}
    `;
}

// --- Breadcrumb / move history ------------------------------------------------
function renderExplorerBreadcrumb() {
    const el = document.getElementById('explorer-breadcrumb');
    if (!el) return;
    el.innerHTML = '';

    const startBtn = document.createElement('span');
    startBtn.textContent = 'Start';
    startBtn.className = 'cursor-pointer hover:text-white underline decoration-dotted';
    startBtn.addEventListener('click', () => {
        explorerState.path = [];
        explorerState.forwardStack = [];
        renderExplorer();
    });
    el.appendChild(startBtn);

    explorerState.path.forEach((step, i) => {
        const sep = document.createElement('span');
        sep.textContent = '→';
        sep.className = 'text-gray-600';
        el.appendChild(sep);

        const moveNum = Math.floor(i / 2) + 1;
        const prefix = i % 2 === 0 ? `${moveNum}.` : `${moveNum}...`;
        const label = document.createElement('span');
        label.textContent = `${prefix}${step.san}`;
        label.className = 'cursor-pointer hover:text-white underline decoration-dotted';
        label.addEventListener('click', () => {
            explorerState.path = explorerState.path.slice(0, i + 1);
            explorerState.forwardStack = [];
            renderExplorer();
        });
        el.appendChild(label);
    });
}

// --- Candidate moves table -----------------------------------------------
function renderExplorerMovesTable(node) {
    const tbody = document.getElementById('explorer-moves-table');
    const emptyEl = document.getElementById('explorer-empty');
    const tableWrapper = tbody ? tbody.closest('table') : null;
    if (!tbody) return;
    tbody.innerHTML = '';

    const children = Array.from(node.children.entries()).sort((a, b) => b[1].count - a[1].count);

    if (children.length === 0) {
        if (tableWrapper) tableWrapper.classList.add('hidden');
        if (emptyEl) {
            emptyEl.classList.remove('hidden');
            emptyEl.textContent = explorerState.path.length === 0
                ? 'No games recorded yet.'
                : 'No games in our history go beyond this point (end of the line).';
        }
        return;
    }

    if (tableWrapper) tableWrapper.classList.remove('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');

    const isWhiteToMove = explorerState.path.length % 2 === 0;
    const dotColor = isWhiteToMove ? '#ffffff' : '#0a0a0a';
    const dotBorder = isWhiteToMove ? 'border-gray-500' : 'border-gray-700';

    const showMoverSplit = explorerState.colorFilter === 'all';

    children.forEach(([san, child]) => {
        const p1Pct = (child.p1 / child.count * 100).toFixed(0);
        const p2Pct = (child.p2 / child.count * 100).toFixed(0);
        const drawPct = (child.draw / child.count * 100).toFixed(0);

        const moverP1Pct = (child.moverP1 / child.count * 100).toFixed(0);
        const moverP2Pct = (child.moverP2 / child.count * 100).toFixed(0);
        const moverBadge = showMoverSplit ? `
            <span class="text-[9px] font-mono whitespace-nowrap block text-gray-500" title="Who actually played ${san}: ${explorerState.player1Name} in ${child.moverP1}/${child.count}, ${explorerState.player2Name} in ${child.moverP2}/${child.count}">
                played by <span class="text-red-400">${explorerState.player1Name} ${moverP1Pct}%</span> <span class="text-gray-600">/</span> <span class="text-blue-400">${explorerState.player2Name} ${moverP2Pct}%</span>
            </span>
        ` : '';

        let evalCell = '<span class="text-gray-600">—</span>';
        if (child.evalCount > 0) {
            const avgCp = child.evalSum / child.evalCount;
            const pawns = formatEvalPawns(avgCp);
            const evalColor = avgCp > 20 ? 'text-gray-200' : avgCp < -20 ? 'text-gray-400' : 'text-gray-400';
            evalCell = `<span class="font-mono font-semibold ${evalColor}" title="Avg engine eval after ${san}, from ${child.evalCount} analyzed game${child.evalCount === 1 ? '' : 's'}">${pawns}</span>`;
        }

        const candidate = resolveCandidateMove(san);
        const lichessCell = candidate
            ? `<a href="${lichessAnalysisUrl(candidate.fen)}" target="_blank" rel="noopener" title="Open this position on Lichess analysis" class="text-gray-400 hover:text-white">↗</a>`
            : '';

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-700 cursor-pointer';
        tr.innerHTML = `
            <td class="px-2 py-1.5 font-mono text-gray-200 whitespace-nowrap">
                <span class="inline-block w-2 h-2 rounded-full border ${dotBorder} mr-1.5 align-middle" style="background-color: ${dotColor}"></span>${san}
                ${moverBadge}
            </td>
            <td class="px-2 py-1.5 text-center">
                <button class="explorer-games-toggle text-gray-400 hover:text-white underline decoration-dotted cursor-pointer" title="See the actual games and jump to one on Lichess">${child.count}</button>
            </td>
            <td class="px-2 py-1.5 text-center whitespace-nowrap">${evalCell}</td>
            <td class="px-2 py-1.5 text-center w-6">${lichessCell}</td>
            <td class="px-2 py-1.5">
                <div class="flex items-center gap-1.5">
                    <div class="flex-1 h-3 rounded overflow-hidden flex bg-gray-700 min-w-[60px]">
                        <div class="h-full bg-red-400" style="width:${p1Pct}%" title="${explorerState.player1Name} won: ${child.p1}/${child.count}"></div>
                        <div class="h-full bg-gray-500" style="width:${drawPct}%" title="Draws: ${child.draw}/${child.count}"></div>
                        <div class="h-full bg-blue-400" style="width:${p2Pct}%" title="${explorerState.player2Name} won: ${child.p2}/${child.count}"></div>
                    </div>
                    <span class="text-[10px] font-mono whitespace-nowrap"><span class="text-red-400">${p1Pct}</span><span class="text-gray-500">/</span><span class="text-blue-400">${p2Pct}</span></span>
                </div>
                <div class="text-[9px] text-gray-500 mt-0.5">game result</div>
            </td>
        `;
        tr.addEventListener('click', () => {
            const top = explorerState.forwardStack[explorerState.forwardStack.length - 1];
            if (top && top.san === san) explorerState.forwardStack.pop();
            else explorerState.forwardStack = [];
            explorerState.path.push({ san, node: child });
            renderExplorer();
        });
        const lichessLink = tr.querySelector('a');
        if (lichessLink) lichessLink.addEventListener('click', e => e.stopPropagation());
        tr.addEventListener('mouseenter', () => {
            const candidate = resolveCandidateMove(san);
            if (candidate) drawExplorerArrows(candidate);
        });
        tr.addEventListener('mouseleave', () => {
            drawExplorerArrows(null);
        });
        tbody.appendChild(tr);

        const gamesToggle = tr.querySelector('.explorer-games-toggle');
        gamesToggle.addEventListener('click', e => {
            e.stopPropagation();
            const existing = tr.nextElementSibling;
            if (existing && existing.classList.contains('explorer-games-row')) {
                existing.remove();
                return;
            }
            document.querySelectorAll('.explorer-games-row').forEach(row => row.remove());
            tr.after(buildExplorerGamesRow(child));
        });
    });
}

// Expandable row listing the actual games behind a candidate move, each
// linking to that exact game on Lichess, jumped to the ply it reached here.
function buildExplorerGamesRow(child) {
    const row = document.createElement('tr');
    row.className = 'explorer-games-row bg-gray-900';
    const sorted = [...child.games].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const items = sorted.map(g => {
        const date = g.createdAt ? new Date(g.createdAt).toLocaleDateString() : '';
        const who = g.mover === 'p1' ? explorerState.player1Name : explorerState.player2Name;
        const whoColor = g.mover === 'p1' ? 'text-red-400' : 'text-blue-400';
        const resultLabel = g.result === 'draw' ? 'draw' : g.result === 'p1' ? `${explorerState.player1Name} won` : `${explorerState.player2Name} won`;
        return `
            <a href="https://lichess.org/${g.id}#${g.ply}" target="_blank" rel="noopener"
               class="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-gray-700 text-gray-300">
                <span>${date} <span class="${whoColor}">· played by ${who}</span></span>
                <span class="text-gray-500">${resultLabel} ↗</span>
            </a>
        `;
    }).join('');
    row.innerHTML = `
        <td colspan="5" class="px-2 py-2">
            <div class="flex flex-col gap-0.5 max-h-48 overflow-y-auto text-xs font-mono">${items}</div>
        </td>
    `;
    return row;
}

function renderExplorerPositionSummary(node) {
    const el = document.getElementById('explorer-position-summary');
    if (!el) return;
    if (node.count === 0) {
        el.textContent = '';
        return;
    }
    const p1Pct = (node.p1 / node.count * 100).toFixed(1);
    const p2Pct = (node.p2 / node.count * 100).toFixed(1);
    const drawPct = (node.draw / node.count * 100).toFixed(1);
    el.innerHTML = `${node.count} game${node.count === 1 ? '' : 's'} reached this position — ` +
        `<span class="text-red-400">${explorerState.player1Name} ${p1Pct}%</span> ` +
        `<span class="text-gray-600">/</span> <span class="text-gray-400">draw ${drawPct}%</span> ` +
        `<span class="text-gray-600">/</span> <span class="text-blue-400">${explorerState.player2Name} ${p2Pct}%</span>`;
}

function renderExplorer() {
    const node = explorerCurrentNode();
    renderExplorerBreadcrumb();
    renderExplorerBoard(explorerState.path.map(s => s.san));
    renderExplorerSideToMove();
    renderExplorerMovesTable(node);
    renderExplorerPositionSummary(node);
    renderExplorerEvalBar(node);
}

function renderExplorerColorButtons() {
    document.querySelectorAll('.explorer-color-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === explorerState.colorFilter);
    });
    const whiteLabel = document.getElementById('explorer-p1-label-white');
    const blackLabel = document.getElementById('explorer-p1-label-black');
    if (whiteLabel) whiteLabel.textContent = explorerState.player1Name || 'P1';
    if (blackLabel) blackLabel.textContent = explorerState.player1Name || 'P1';
}

function rebuildExplorerTree(gamesByMonth, scopeKey) {
    const treeKey = `${scopeKey}::${explorerState.colorFilter}`;
    if (explorerState.treeKey !== treeKey) {
        explorerState.root = buildMoveTree(gamesByMonth, explorerState.player1Name, explorerState.colorFilter);
        explorerState.treeKey = treeKey;
        explorerState.path = [];
    }
}

function initExplorer(gamesByMonth, player1Name, player2Name, scopeKey) {
    explorerState.player1Name = player1Name;
    explorerState.player2Name = player2Name;
    explorerState.gamesByMonth = gamesByMonth;
    explorerState.scopeKey = scopeKey;
    rebuildExplorerTree(gamesByMonth, scopeKey);

    renderExplorerColorButtons();
    renderExplorer();

    const resetBtn = document.getElementById('explorer-reset');
    if (resetBtn && !resetBtn.dataset.bound) {
        resetBtn.dataset.bound = 'true';
        resetBtn.addEventListener('click', () => {
            explorerState.path = [];
            explorerState.forwardStack = [];
            renderExplorer();
        });
    }

    const backBtn = document.getElementById('explorer-back');
    if (backBtn && !backBtn.dataset.bound) {
        backBtn.dataset.bound = 'true';
        backBtn.addEventListener('click', () => {
            if (explorerState.path.length === 0) return;
            explorerState.forwardStack.push(explorerState.path.pop());
            renderExplorer();
        });
    }

    const flipBtn = document.getElementById('explorer-flip');
    if (flipBtn && !flipBtn.dataset.bound) {
        flipBtn.dataset.bound = 'true';
        flipBtn.addEventListener('click', () => {
            explorerState.flipped = !explorerState.flipped;
            renderExplorer();
        });
    }

    document.querySelectorAll('.explorer-color-btn').forEach(btn => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = 'true';
        btn.addEventListener('click', () => {
            explorerState.colorFilter = btn.dataset.color;
            rebuildExplorerTree(explorerState.gamesByMonth, explorerState.scopeKey);
            explorerState.forwardStack = [];
            renderExplorerColorButtons();
            renderExplorer();
        });
    });

    if (!document.body.dataset.explorerKeysBound) {
        document.body.dataset.explorerKeysBound = 'true';
        document.addEventListener('keydown', handleExplorerKeydown);
    }
}

// Left = back one ply (remembered on forwardStack). Right = redo that step if
// available, else step into the most-played next move (top table row).
function handleExplorerKeydown(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const explorerPane = document.querySelector('[data-tab-content="explorer"]');
    if (!explorerPane || !explorerPane.classList.contains('active')) return;

    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.key === 'ArrowLeft') {
        if (explorerState.path.length === 0) return;
        e.preventDefault();
        explorerState.forwardStack.push(explorerState.path.pop());
        renderExplorer();
    } else {
        if (explorerState.forwardStack.length > 0) {
            e.preventDefault();
            explorerState.path.push(explorerState.forwardStack.pop());
            renderExplorer();
            return;
        }
        const node = explorerCurrentNode();
        if (!node.children.size) return;
        const [topSan, topChild] = Array.from(node.children.entries())
            .sort((a, b) => b[1].count - a[1].count)[0];
        e.preventDefault();
        explorerState.path.push({ san: topSan, node: topChild });
        renderExplorer();
    }
}

window.initExplorer = initExplorer;
