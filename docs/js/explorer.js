// Moves Explorer — a personal "opening explorer" over our own game history.
// Builds a tree of moves played (keyed by SAN sequence) with win/draw/loss
// counts at every position, and lets you click through it move by move.

const EXPLORER_MAX_PLY = 20; // ~10 moves each side; deep enough for repertoire study, shallow enough to stay fast

// Use the solid glyph set for both colors — the "white" outline glyphs
// (♔♕♖...) are hollow by design and let the square show through no matter
// what fill color is applied, which is what made them hard to see.
const PIECE_UNICODE = {
    p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚'
};

const explorerState = {
    root: null,
    treeKey: null, // `${scopeKey}::${colorFilter}` — rebuild the tree only when this changes
    colorFilter: 'all', // 'all' | 'white' | 'black' — restricted to player1's color
    path: [], // [{ san, node }]
    player1Name: '',
    player2Name: '',
    gamesByMonth: null, // most recent games for the active scope, kept fresh on every initExplorer call
    scopeKey: null
};

function explorerCreateNode() {
    return { count: 0, p1: 0, p2: 0, draw: 0, children: new Map() };
}

function explorerApplyResult(node, result) {
    node.count++;
    if (result === 'p1') node.p1++;
    else if (result === 'p2') node.p2++;
    else node.draw++;
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

        let node = root;
        explorerApplyResult(node, result);

        const limit = Math.min(tokens.length, EXPLORER_MAX_PLY);
        for (let i = 0; i < limit; i++) {
            const san = tokens[i];
            if (!node.children.has(san)) node.children.set(san, explorerCreateNode());
            node = node.children.get(san);
            explorerApplyResult(node, result);
        }
    });

    return root;
}

function explorerCurrentNode() {
    let node = explorerState.root;
    for (const step of explorerState.path) node = step.node;
    return node;
}

function computeBoardForPath(sanPath) {
    if (typeof window.Chess !== 'function') return null;
    const chess = new window.Chess();
    for (const san of sanPath) {
        if (!chess.move(san)) break;
    }
    return chess;
}

function renderExplorerBoard(sanPath) {
    const boardEl = document.getElementById('explorer-board');
    if (!boardEl) return;

    const chess = computeBoardForPath(sanPath);
    if (!chess) {
        boardEl.innerHTML = '<div class="text-xs text-gray-500 flex items-center justify-center h-full">Board unavailable.</div>';
        return;
    }

    const board = chess.board();
    boardEl.className = 'aspect-square w-full max-w-md mx-auto select-none grid grid-cols-8 grid-rows-8 rounded overflow-hidden border border-gray-700';
    boardEl.innerHTML = '';

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const square = board[r][c];
            const isLight = (r + c) % 2 === 0;
            const cell = document.createElement('div');
            cell.className = `flex items-center justify-center text-2xl sm:text-3xl ${isLight ? 'bg-gray-300' : 'bg-gray-600'}`;
            if (square) {
                cell.textContent = PIECE_UNICODE[square.type];
                if (square.color === 'w') {
                    cell.style.color = '#ffffff';
                    // Poor-man's stroke (multi-direction shadow) so the solid
                    // glyph reads as a piece, not a blob, on either square shade.
                    cell.style.textShadow = [
                        '-1px -1px 0 #000', '1px -1px 0 #000',
                        '-1px 1px 0 #000', '1px 1px 0 #000',
                        '0 0 3px rgba(0,0,0,0.6)'
                    ].join(', ');
                } else {
                    cell.style.color = '#0a0a0a';
                    cell.style.textShadow = [
                        '-1px -1px 0 #fff', '1px -1px 0 #fff',
                        '-1px 1px 0 #fff', '1px 1px 0 #fff',
                        '0 0 3px rgba(255,255,255,0.5)'
                    ].join(', ');
                }
            }
            boardEl.appendChild(cell);
        }
    }
}

function renderExplorerBreadcrumb() {
    const el = document.getElementById('explorer-breadcrumb');
    if (!el) return;
    el.innerHTML = '';

    const startBtn = document.createElement('span');
    startBtn.textContent = 'Start';
    startBtn.className = 'cursor-pointer hover:text-white underline decoration-dotted';
    startBtn.addEventListener('click', () => {
        explorerState.path = [];
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
            renderExplorer();
        });
        el.appendChild(label);
    });
}

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
                : `No games in our history go beyond this point (end of the line, or past the tracked ${EXPLORER_MAX_PLY}-ply depth).`;
        }
        return;
    }

    if (tableWrapper) tableWrapper.classList.remove('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');

    children.forEach(([san, child]) => {
        const p1Pct = (child.p1 / child.count * 100).toFixed(0);
        const p2Pct = (child.p2 / child.count * 100).toFixed(0);
        const drawPct = (child.draw / child.count * 100).toFixed(0);

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-700 cursor-pointer';
        tr.innerHTML = `
            <td class="px-2 py-1.5 font-mono text-gray-200 whitespace-nowrap">${san}</td>
            <td class="px-2 py-1.5 text-center text-gray-400">${child.count}</td>
            <td class="px-2 py-1.5">
                <div class="flex items-center gap-1.5">
                    <div class="flex-1 h-3 rounded overflow-hidden flex bg-gray-700 min-w-[60px]">
                        <div class="h-full bg-red-400" style="width:${p1Pct}%" title="${explorerState.player1Name}: ${child.p1}/${child.count}"></div>
                        <div class="h-full bg-gray-500" style="width:${drawPct}%" title="Draws: ${child.draw}/${child.count}"></div>
                        <div class="h-full bg-blue-400" style="width:${p2Pct}%" title="${explorerState.player2Name}: ${child.p2}/${child.count}"></div>
                    </div>
                    <span class="text-[10px] text-gray-400 font-mono whitespace-nowrap">${p1Pct}/${p2Pct}</span>
                </div>
            </td>
        `;
        tr.addEventListener('click', () => {
            explorerState.path.push({ san, node: child });
            renderExplorer();
        });
        tbody.appendChild(tr);
    });
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
    renderExplorerMovesTable(node);
    renderExplorerPositionSummary(node);
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
            renderExplorer();
        });
    }

    document.querySelectorAll('.explorer-color-btn').forEach(btn => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = 'true';
        btn.addEventListener('click', () => {
            explorerState.colorFilter = btn.dataset.color;
            rebuildExplorerTree(explorerState.gamesByMonth, explorerState.scopeKey);
            renderExplorerColorButtons();
            renderExplorer();
        });
    });
}

window.initExplorer = initExplorer;
