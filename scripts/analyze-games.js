#!/usr/bin/env node

// Fills in computer analysis for games Lichess never analyzed (most of them —
// "Request a computer analysis" was only clicked on ~8% of our games, and
// there's no public API to trigger it programmatically). Runs a local
// Stockfish engine over each game's moves and stores the result under
// `stockfishAnalysis`, kept separate from Lichess's own `analysis` /
// `players.*.analysis` fields so callers can tell the two apart.
//
// Usage: node scripts/analyze-games.js [limit]
// Env:   STOCKFISH_PATH (default "stockfish"), ANALYSIS_DEPTH (default 12)

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DATA_DIR = path.join(__dirname, '..', 'docs', 'data', 'games');
const DEPTH = parseInt(process.env.ANALYSIS_DEPTH || '12', 10);
const LIMIT = parseInt(process.argv[2] || process.env.ANALYSIS_LIMIT || '15', 10);
const STOCKFISH_BIN = process.env.STOCKFISH_PATH || 'stockfish';
const CP_CAP = 1000; // cap centipawn magnitude (incl. mate scores) so ACPL isn't blown up by forced mates

// --- Win% / move-accuracy model -------------------------------------------
// Community reverse-engineered approximation of Lichess's own accuracy model,
// widely published (e.g. by the "acpl to accuracy" write-ups on the Lichess
// forum). `cp` must already be from the perspective of whoever it's rated for.
function winPercent(cp) {
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

function moveAccuracy(winPercentBefore, winPercentAfter) {
    const drop = Math.max(0, winPercentBefore - winPercentAfter);
    const acc = 103.1668100711649 * Math.exp(-0.04354415386753951 * drop) - 3.166924740191411;
    return Math.max(0, Math.min(100, acc));
}

function classifyDrop(winPercentDrop) {
    if (winPercentDrop >= 20) return 'blunder';
    if (winPercentDrop >= 10) return 'mistake';
    if (winPercentDrop >= 5) return 'inaccuracy';
    return null;
}

// --- Minimal persistent UCI engine wrapper ---------------------------------
// Commands are only ever issued one at a time and awaited before the next is
// sent, so a single pending-line-handler is enough (no request pipelining).
class Engine {
    constructor(binPath) {
        this.proc = spawn(binPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
        this.proc.stderr.on('data', () => {}); // ignore engine stderr chatter
        this._buffer = '';
        this._onLine = null;
        this.proc.stdout.on('data', chunk => {
            this._buffer += chunk.toString();
            const lines = this._buffer.split('\n');
            this._buffer = lines.pop();
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && this._onLine) this._onLine(trimmed);
            }
        });
    }

    send(cmd) {
        this.proc.stdin.write(cmd + '\n');
    }

    waitFor(doneRegex, onEachLine) {
        return new Promise(resolve => {
            this._onLine = line => {
                if (onEachLine) onEachLine(line);
                if (doneRegex.test(line)) {
                    this._onLine = null;
                    resolve(line);
                }
            };
        });
    }

    async init() {
        this.send('uci');
        await this.waitFor(/^uciok/);
        this.send('setoption name Threads value 1');
        this.send('isready');
        await this.waitFor(/^readyok/);
    }

    async newGame() {
        this.send('ucinewgame');
        this.send('isready');
        await this.waitFor(/^readyok/);
    }

    // Evaluate the position reached after `uciMoves` from the start position.
    // Returns { cp, mate, bestUci } — cp/mate are from the perspective of
    // whoever is to move in that position (standard UCI convention).
    async evaluate(uciMoves, depth) {
        this.send(`position startpos moves ${uciMoves.join(' ')}`.trim());
        this.send(`go depth ${depth}`);
        let cp = null;
        let mate = null;
        const bestLine = await this.waitFor(/^bestmove/, line => {
            const m = line.match(/score (cp|mate) (-?\d+)/);
            if (m) {
                if (m[1] === 'cp') { cp = parseInt(m[2], 10); mate = null; }
                else { mate = parseInt(m[2], 10); cp = null; }
            }
        });
        const bestMatch = bestLine.match(/^bestmove (\S+)/);
        const bestUci = bestMatch && bestMatch[1] !== '(none)' ? bestMatch[1] : null;
        return { cp, mate, bestUci };
    }

    quit() {
        try {
            this.send('quit');
        } catch (e) {}
        this.proc.kill();
    }
}

// --- Position eval helpers --------------------------------------------------
function toCappedCp({ cp, mate }) {
    if (mate !== null) return mate > 0 ? CP_CAP : -CP_CAP;
    return Math.max(-CP_CAP, Math.min(CP_CAP, cp));
}

function toWinPercent({ cp, mate }) {
    if (mate !== null) return mate > 0 ? 100 : 0;
    return winPercent(cp);
}

// --- Game analysis -----------------------------------------------------------
function isAlreadyAnalyzed(game) {
    if (game.stockfishAnalysis) return true;
    if (Array.isArray(game.analysis) && game.analysis.length > 0) return true;
    if (game.players && game.players.white && game.players.white.analysis) return true;
    return false;
}

async function analyzeGame(engine, Chess, game) {
    const tokens = (game.moves || '').split(' ').filter(Boolean);
    if (tokens.length === 0) return null;

    const chess = new Chess();
    const uciMoves = [];
    const sanMoves = [];
    for (const san of tokens) {
        const move = chess.move(san);
        if (!move) {
            // Malformed/unparseable move list — skip this game rather than
            // produce partial or misleading analysis.
            return null;
        }
        uciMoves.push(`${move.from}${move.to}${move.promotion || ''}`);
        sanMoves.push({ san, color: move.color });
    }

    await engine.newGame();

    const positions = [];
    for (let k = 0; k <= uciMoves.length; k++) {
        const evalResult = await engine.evaluate(uciMoves.slice(0, k), DEPTH);
        positions.push(evalResult);
    }

    const moves = [];
    const summary = {
        w: { inaccuracy: 0, mistake: 0, blunder: 0, cpLossSum: 0, accSum: 0, count: 0 },
        b: { inaccuracy: 0, mistake: 0, blunder: 0, cpLossSum: 0, accSum: 0, count: 0 }
    };

    for (let i = 1; i <= uciMoves.length; i++) {
        const mover = sanMoves[i - 1].color; // 'w' | 'b'
        const before = positions[i - 1]; // side-to-move here === mover
        const after = positions[i]; // side-to-move here === opponent

        const winBefore = toWinPercent(before);
        const winAfter = 100 - toWinPercent(after);
        const drop = Math.max(0, winBefore - winAfter);

        const cpBefore = toCappedCp(before);
        const cpAfter = -toCappedCp(after);
        const cpLoss = Math.max(0, cpBefore - cpAfter);

        const judgment = classifyDrop(drop);
        const accuracy = moveAccuracy(winBefore, winAfter);

        moves.push({
            ply: i,
            san: sanMoves[i - 1].san,
            mover,
            best: before.bestUci,
            cpLoss: Math.round(cpLoss),
            judgment
        });

        const side = summary[mover];
        side.count++;
        side.cpLossSum += cpLoss;
        side.accSum += accuracy;
        if (judgment) side[judgment]++;
    }

    const finalizeSide = side => ({
        inaccuracy: side.inaccuracy,
        mistake: side.mistake,
        blunder: side.blunder,
        acpl: side.count > 0 ? Math.round(side.cpLossSum / side.count) : 0,
        accuracy: side.count > 0 ? Math.round((side.accSum / side.count) * 10) / 10 : null
    });

    return {
        engine: 'stockfish',
        depth: DEPTH,
        generatedAt: Date.now(),
        positions: positions.map(p => ({ cp: p.cp, mate: p.mate })),
        moves,
        summary: {
            w: finalizeSide(summary.w),
            b: finalizeSide(summary.b)
        }
    };
}

// --- Main --------------------------------------------------------------------
async function main() {
    const monthFiles = fs.readdirSync(DATA_DIR)
        .filter(f => /^\d{4}-\d{2}\.json$/.test(f))
        .sort()
        .reverse(); // most recent month first

    if (monthFiles.length === 0) {
        console.log('No game data files found, nothing to analyze.');
        return;
    }

    const { Chess } = await import('chess.js');

    console.log(`Starting engine (${STOCKFISH_BIN}, depth ${DEPTH})...`);
    const engine = new Engine(STOCKFISH_BIN);
    await engine.init();

    let analyzedCount = 0;
    let touchedFiles = new Set();

    try {
        for (const file of monthFiles) {
            if (analyzedCount >= LIMIT) break;

            const filePath = path.join(DATA_DIR, file);
            const games = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            let fileChanged = false;

            // Games within a month file are stored oldest-first; walk newest-first.
            for (const game of [...games].reverse()) {
                if (analyzedCount >= LIMIT) break;
                if (isAlreadyAnalyzed(game)) continue;

                console.log(`  Analyzing ${game.id} (${file})...`);
                try {
                    const result = await analyzeGame(engine, Chess, game);
                    if (result) {
                        game.stockfishAnalysis = result;
                        fileChanged = true;
                        analyzedCount++;
                    } else {
                        console.log(`    Skipped ${game.id} (no/invalid moves)`);
                    }
                } catch (err) {
                    console.error(`    Failed to analyze ${game.id}: ${err.message}`);
                }
            }

            if (fileChanged) {
                fs.writeFileSync(filePath, JSON.stringify(games, null, 2));
                touchedFiles.add(file);
            }
        }
    } finally {
        engine.quit();
    }

    console.log(`\nAnalyzed ${analyzedCount} game(s) across ${touchedFiles.size} file(s).`);
}

if (require.main === module) {
    main().catch(err => {
        console.error('Error analyzing games:', err.message);
        process.exit(1);
    });
}

module.exports = { analyzeGame, Engine, winPercent, moveAccuracy, classifyDrop, isAlreadyAnalyzed };
