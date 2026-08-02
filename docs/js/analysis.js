// Analysis & Learnings section (lives inside the Overview tab) — rating gap,
// opening win rates, streaks, and splits, compared side by side for both players.
// Respects whatever date range is currently selected.

function computeMonthlySummary(gamesByMonth, player1Name) {
    const months = Object.keys(gamesByMonth).sort();
    return months.map(monthKey => {
        const games = gamesByMonth[monthKey];
        let p1 = 0, p2 = 0, draw = 0, meRatingSum = 0, oppRatingSum = 0, ratedCount = 0;
        games.forEach(game => {
            const isP1White = game.players.white.user.name === player1Name;
            if (!game.winner) {
                draw++;
            } else if ((game.winner === 'white' && isP1White) || (game.winner === 'black' && !isP1White)) {
                p1++;
            } else {
                p2++;
            }
            const p1Rating = isP1White ? game.players.white.rating : game.players.black.rating;
            const p2Rating = isP1White ? game.players.black.rating : game.players.white.rating;
            if (p1Rating && p2Rating) {
                meRatingSum += p1Rating;
                oppRatingSum += p2Rating;
                ratedCount++;
            }
        });
        return {
            month: monthKey,
            n: games.length,
            p1, p2, draw,
            winRate: games.length > 0 ? p1 / games.length : 0,
            p1AvgRating: ratedCount > 0 ? Math.round(meRatingSum / ratedCount) : null,
            p2AvgRating: ratedCount > 0 ? Math.round(oppRatingSum / ratedCount) : null
        };
    });
}

function computeSplits(allGames, player1Name) {
    const byColor = {
        p1White: { w: 0, l: 0, d: 0 },
        p1Black: { w: 0, l: 0, d: 0 }
    };
    const byLength = {
        short: { w: 0, l: 0, d: 0 },
        medium: { w: 0, l: 0, d: 0 },
        long: { w: 0, l: 0, d: 0 }
    };
    const byDow = [0, 1, 2, 3, 4, 5, 6].map(() => ({ w: 0, l: 0, d: 0 }));

    allGames.forEach(game => {
        const isP1White = game.players.white.user.name === player1Name;
        let result;
        if (!game.winner) result = 'd';
        else if ((game.winner === 'white' && isP1White) || (game.winner === 'black' && !isP1White)) result = 'w';
        else result = 'l';

        const colorKey = isP1White ? 'p1White' : 'p1Black';
        byColor[colorKey][result]++;

        const plies = game.moves ? game.moves.split(' ').length : 0;
        const bucket = plies < 30 ? 'short' : plies <= 60 ? 'medium' : 'long';
        byLength[bucket][result]++;

        if (game.createdAt) {
            const dow = new Date(game.createdAt).getUTCDay();
            byDow[dow][result]++;
        }
    });

    return { byColor, byLength, byDow };
}

function computeStreakTimeline(allGames, player1Name) {
    const sorted = [...allGames].sort((a, b) => a.createdAt - b.createdAt);
    const runs = [];
    let cur = null;

    sorted.forEach(game => {
        const isP1White = game.players.white.user.name === player1Name;
        let result;
        if (!game.winner) result = 'draw';
        else if ((game.winner === 'white' && isP1White) || (game.winner === 'black' && !isP1White)) result = 'p1';
        else result = 'p2';

        if (cur && cur.result === result) {
            cur.length++;
            cur.endDate = game.createdAt;
        } else {
            cur = { result, length: 1, startDate: game.createdAt, endDate: game.createdAt };
            runs.push(cur);
        }
    });

    return runs;
}

// --- Game character: blunders, thrown wins, comebacks, back-and-forth games -
// Reuses whatever per-ply eval we have (Lichess's own analysis, or our
// Stockfish supplement) to characterize *how* games were won/lost, not just
// who won. All evals below are centipawns from White's perspective, flipped
// to "player1's perspective" for comparison against a fixed threshold.
const GAME_CHARACTER_LEAD_CP = 150; // magnitude needed to count as "someone's ahead" (ignores near-equal noise)
const GAME_CHARACTER_WINNING_CP = 300; // magnitude needed to call a position "winning" for thrown/comeback purposes

function gameEvalByPlyP1Perspective(game, isP1White) {
    let whiteEvals = null;
    if (Array.isArray(game.analysis) && game.analysis.length > 0) {
        whiteEvals = game.analysis.map(entry => {
            if (!entry) return null;
            if (typeof entry.eval === 'number') return entry.eval;
            if (typeof entry.mate === 'number') return entry.mate > 0 ? 1000 : -1000;
            return null;
        });
    } else if (game.stockfishAnalysis && Array.isArray(game.stockfishAnalysis.positions) && game.stockfishAnalysis.positions.length > 1) {
        const positions = game.stockfishAnalysis.positions;
        whiteEvals = [];
        for (let ply = 1; ply < positions.length; ply++) {
            const pos = positions[ply];
            if (!pos) { whiteEvals.push(null); continue; }
            const sideToMoveIsWhite = ply % 2 === 0;
            let cp = null;
            if (pos.mate !== null && pos.mate !== undefined) cp = pos.mate > 0 ? 1000 : -1000;
            else if (typeof pos.cp === 'number') cp = pos.cp;
            whiteEvals.push(cp === null ? null : (sideToMoveIsWhite ? cp : -cp));
        }
    }
    if (!whiteEvals) return null;
    return whiteEvals.map(cp => (cp === null ? null : (isP1White ? cp : -cp)));
}

function computeGameCharacter(allGames, player1Name) {
    const result = {
        p1: { blunders: 0, mistakes: 0, inaccuracies: 0, accuracySum: 0, accuracyCount: 0 },
        p2: { blunders: 0, mistakes: 0, inaccuracies: 0, accuracySum: 0, accuracyCount: 0 },
        analyzedGames: 0,
        backAndForthGames: 0,
        thrownByP1: [], // p1 had a winning position but didn't win
        thrownByP2: [],
        comebackByP1: [], // p1 was losing badly but won anyway
        comebackByP2: []
    };

    allGames.forEach(game => {
        const isP1White = game.players.white.user.name === player1Name;
        const whiteAnalysis = game.players?.white?.analysis || game.stockfishAnalysis?.summary?.w;
        const blackAnalysis = game.players?.black?.analysis || game.stockfishAnalysis?.summary?.b;
        const p1Analysis = isP1White ? whiteAnalysis : blackAnalysis;
        const p2Analysis = isP1White ? blackAnalysis : whiteAnalysis;

        if (p1Analysis) {
            result.p1.blunders += p1Analysis.blunder || 0;
            result.p1.mistakes += p1Analysis.mistake || 0;
            result.p1.inaccuracies += p1Analysis.inaccuracy || 0;
            if (p1Analysis.accuracy) { result.p1.accuracySum += p1Analysis.accuracy; result.p1.accuracyCount++; }
        }
        if (p2Analysis) {
            result.p2.blunders += p2Analysis.blunder || 0;
            result.p2.mistakes += p2Analysis.mistake || 0;
            result.p2.inaccuracies += p2Analysis.inaccuracy || 0;
            if (p2Analysis.accuracy) { result.p2.accuracySum += p2Analysis.accuracy; result.p2.accuracyCount++; }
        }

        const p1Evals = gameEvalByPlyP1Perspective(game, isP1White);
        if (!p1Evals || p1Evals.every(e => e === null)) return;
        result.analyzedGames++;

        let winner; // 'p1' | 'p2' | 'draw'
        if (!game.winner) winner = 'draw';
        else if ((game.winner === 'white' && isP1White) || (game.winner === 'black' && !isP1White)) winner = 'p1';
        else winner = 'p2';

        let leader = null; // 'p1' | 'p2' | null
        let leadChanges = 0;
        let peakP1Lead = 0;
        let peakP2Lead = 0;

        p1Evals.forEach(cp => {
            if (cp === null) return;
            if (cp > peakP1Lead) peakP1Lead = cp;
            if (-cp > peakP2Lead) peakP2Lead = -cp;

            let currentLeader = null;
            if (cp >= GAME_CHARACTER_LEAD_CP) currentLeader = 'p1';
            else if (cp <= -GAME_CHARACTER_LEAD_CP) currentLeader = 'p2';
            else return; // near-equal — doesn't count as holding (or losing) the lead

            if (leader && currentLeader !== leader) leadChanges++;
            leader = currentLeader;
        });

        if (leadChanges >= 2) result.backAndForthGames++;

        const gameRef = { id: game.id, date: game.createdAt, peakLead: null };
        if (peakP1Lead >= GAME_CHARACTER_WINNING_CP && winner !== 'p1') {
            result.thrownByP1.push({ ...gameRef, peakLead: peakP1Lead });
        }
        if (peakP2Lead >= GAME_CHARACTER_WINNING_CP && winner !== 'p2') {
            result.thrownByP2.push({ ...gameRef, peakLead: peakP2Lead });
        }
        if (peakP2Lead >= GAME_CHARACTER_WINNING_CP && winner === 'p1') {
            result.comebackByP1.push({ ...gameRef, peakLead: peakP2Lead });
        }
        if (peakP1Lead >= GAME_CHARACTER_WINNING_CP && winner === 'p2') {
            result.comebackByP2.push({ ...gameRef, peakLead: peakP1Lead });
        }
    });

    result.thrownByP1.sort((a, b) => b.peakLead - a.peakLead);
    result.thrownByP2.sort((a, b) => b.peakLead - a.peakLead);
    result.comebackByP1.sort((a, b) => b.peakLead - a.peakLead);
    result.comebackByP2.sort((a, b) => b.peakLead - a.peakLead);

    return result;
}

function renderGameCharacterGameList(container, games, colorClass) {
    if (games.length === 0) {
        container.innerHTML = '<div class="text-[10px] text-gray-600">None in this range.</div>';
        return;
    }
    const fmtDate = t => new Date(t).toISOString().slice(0, 10);
    container.innerHTML = games.slice(0, 5).map(g => `
        <a href="https://lichess.org/${g.id}" target="_blank" rel="noopener" class="flex items-center justify-between gap-2 text-[10px] hover:bg-gray-700 rounded px-1.5 py-1">
            <span class="text-gray-500">${fmtDate(g.date)}</span>
            <span class="${colorClass} font-mono">was +${(g.peakLead / 100).toFixed(1)}</span>
        </a>
    `).join('');
}

function displayGameCharacter(allGames, player1Name, player2Name) {
    const container = document.getElementById('analysis-character');
    if (!container) return;

    const gc = computeGameCharacter(allGames, player1Name);
    if (gc.analyzedGames === 0) {
        container.innerHTML = '<div class="text-xs text-gray-500">No computer-analyzed games in this range — analyze games (see the Stats tab) to unlock this.</div>';
        return;
    }

    const p1AvgAcc = gc.p1.accuracyCount > 0 ? (gc.p1.accuracySum / gc.p1.accuracyCount).toFixed(1) : null;
    const p2AvgAcc = gc.p2.accuracyCount > 0 ? (gc.p2.accuracySum / gc.p2.accuracyCount).toFixed(1) : null;

    container.innerHTML = `
        <p class="text-[10px] text-gray-500 mb-3">Based on ${gc.analyzedGames} computer-analyzed game${gc.analyzedGames === 1 ? '' : 's'} in this range. "Thrown" = held a ${(GAME_CHARACTER_WINNING_CP/100).toFixed(1)}+ pawn advantage at some point but didn't win; "comeback" = won despite being down that much at some point.</p>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <div class="bg-gray-900 rounded p-2 border border-gray-700 text-center">
                <div class="text-[10px] text-gray-500 mb-1">Blunders</div>
                <div class="text-base font-bold"><span class="text-red-400">${gc.p1.blunders}</span><span class="text-gray-600 text-xs"> / </span><span class="text-blue-400">${gc.p2.blunders}</span></div>
            </div>
            <div class="bg-gray-900 rounded p-2 border border-gray-700 text-center">
                <div class="text-[10px] text-gray-500 mb-1">Mistakes</div>
                <div class="text-base font-bold"><span class="text-red-400">${gc.p1.mistakes}</span><span class="text-gray-600 text-xs"> / </span><span class="text-blue-400">${gc.p2.mistakes}</span></div>
            </div>
            <div class="bg-gray-900 rounded p-2 border border-gray-700 text-center">
                <div class="text-[10px] text-gray-500 mb-1">Avg. Accuracy</div>
                <div class="text-base font-bold"><span class="text-red-400">${p1AvgAcc ?? '–'}</span><span class="text-gray-600 text-xs"> / </span><span class="text-blue-400">${p2AvgAcc ?? '–'}</span></div>
            </div>
            <div class="bg-gray-900 rounded p-2 border border-gray-700 text-center">
                <div class="text-[10px] text-gray-500 mb-1">Back-and-forth games</div>
                <div class="text-base font-bold text-gray-300">${gc.backAndForthGames}</div>
                <div class="text-[9px] text-gray-600">${(gc.backAndForthGames / gc.analyzedGames * 100).toFixed(0)}% of analyzed</div>
            </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
                <div class="text-red-400 text-xs font-semibold mb-1">${player1Name} threw (${gc.thrownByP1.length})</div>
                <div id="analysis-character-thrown-p1" class="space-y-0.5"></div>
            </div>
            <div>
                <div class="text-blue-400 text-xs font-semibold mb-1">${player2Name} threw (${gc.thrownByP2.length})</div>
                <div id="analysis-character-thrown-p2" class="space-y-0.5"></div>
            </div>
            <div>
                <div class="text-red-400 text-xs font-semibold mb-1">${player1Name}'s comebacks (${gc.comebackByP1.length})</div>
                <div id="analysis-character-comeback-p1" class="space-y-0.5"></div>
            </div>
            <div>
                <div class="text-blue-400 text-xs font-semibold mb-1">${player2Name}'s comebacks (${gc.comebackByP2.length})</div>
                <div id="analysis-character-comeback-p2" class="space-y-0.5"></div>
            </div>
        </div>
    `;

    renderGameCharacterGameList(document.getElementById('analysis-character-thrown-p1'), gc.thrownByP1, 'text-red-400');
    renderGameCharacterGameList(document.getElementById('analysis-character-thrown-p2'), gc.thrownByP2, 'text-blue-400');
    renderGameCharacterGameList(document.getElementById('analysis-character-comeback-p1'), gc.comebackByP1, 'text-red-400');
    renderGameCharacterGameList(document.getElementById('analysis-character-comeback-p2'), gc.comebackByP2, 'text-blue-400');
}

// Stacked bar: player1 win % — draw % — player2 win %, always shown side by side.
function renderMatchupBar(container, label, p1, draw, p2, extra) {
    const n = p1 + draw + p2;
    if (n === 0) return;
    const p1Pct = (p1 / n * 100);
    const drawPct = (draw / n * 100);
    const p2Pct = (p2 / n * 100);

    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 mb-1.5';
    row.innerHTML = `
        <div class="w-40 sm:w-56 text-right text-xs text-gray-400 truncate" title="${label}${extra ? ' — ' + extra : ''}">${label}${extra ? ` <span class="text-gray-600">(${extra})</span>` : ''}</div>
        <div class="flex-1 h-4 rounded overflow-hidden flex bg-gray-700">
            <div class="h-full bg-red-400" style="width:${p1Pct}%" title="P1: ${p1}/${n} (${p1Pct.toFixed(1)}%)"></div>
            <div class="h-full bg-gray-500" style="width:${drawPct}%" title="Draws: ${draw}/${n}"></div>
            <div class="h-full bg-blue-400" style="width:${p2Pct}%" title="P2: ${p2}/${n} (${p2Pct.toFixed(1)}%)"></div>
        </div>
        <div class="w-40 flex-none text-xs text-gray-400 font-mono">${p1Pct.toFixed(0)}% / ${p2Pct.toFixed(0)}% (n=${n})</div>
    `;
    container.appendChild(row);
}

function displayAnalysisTab(gamesByMonth, player1Name, player2Name) {
    const monthly = computeMonthlySummary(gamesByMonth, player1Name);
    const allGames = Object.values(gamesByMonth).flat();
    if (allGames.length === 0) {
        ['analysis-hero', 'analysis-character', 'analysis-openings', 'analysis-splits', 'analysis-streaks', 'analysis-reco'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<div class="text-xs text-gray-500">No games in this range.</div>';
        });
        return;
    }

    const totalP1 = monthly.reduce((s, m) => s + m.p1, 0);
    const totalP2 = monthly.reduce((s, m) => s + m.p2, 0);
    const totalDraw = monthly.reduce((s, m) => s + m.draw, 0);
    const totalGames = totalP1 + totalP2 + totalDraw;
    const monthsWonP1 = monthly.filter(m => m.p1 > m.p2).length;
    const monthsWonP2 = monthly.filter(m => m.p2 > m.p1).length;
    const isMultiMonth = monthly.length > 1;

    // Hero stats
    const heroEl = document.getElementById('analysis-hero');
    if (heroEl) {
        heroEl.innerHTML = `
            <div class="bg-gray-800 rounded-lg p-3 border border-gray-700 text-center">
                <div class="text-xs text-gray-400 mb-1">Record (P1–P2–Draw)</div>
                <div class="text-lg font-bold text-white">${totalP1}–${totalP2}–${totalDraw}</div>
                <div class="text-xs mt-1"><span class="text-red-400">${totalGames > 0 ? (totalP1 / totalGames * 100).toFixed(1) : 0}%</span> <span class="text-gray-600">/</span> <span class="text-blue-400">${totalGames > 0 ? (totalP2 / totalGames * 100).toFixed(1) : 0}%</span></div>
            </div>
            <div class="bg-gray-800 rounded-lg p-3 border border-gray-700 text-center">
                <div class="text-xs text-gray-400 mb-1">Months Won</div>
                <div class="text-lg font-bold"><span class="text-red-400">${monthsWonP1}</span><span class="text-gray-500 text-sm"> / </span><span class="text-blue-400">${monthsWonP2}</span></div>
                <div class="text-xs text-gray-500 mt-1">of ${monthly.length} months</div>
            </div>
            <div class="bg-gray-800 rounded-lg p-3 border border-gray-700 text-center" id="analysis-hero-streaks"></div>
            <div class="bg-gray-800 rounded-lg p-3 border border-gray-700 text-center" id="analysis-hero-rating"></div>
        `;
    }

    // Monthly win-rate chart — both players (needs multiple months to show a trend)
    const winrateContainer = document.getElementById('analysis-monthly-winrate-container');
    if (winrateContainer) winrateContainer.classList.toggle('hidden', !isMultiMonth);
    const winrateCanvas = document.getElementById('analysis-monthly-winrate-chart');
    if (winrateCanvas && typeof Chart !== 'undefined' && isMultiMonth) {
        if (window.analysisWinrateChart) {
            try { window.analysisWinrateChart.destroy(); } catch (e) {}
        }
        const winrateChartTheme = getChartThemeColors();
        window.analysisWinrateChart = new Chart(winrateCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: monthly.map(m => m.month),
                datasets: [
                    {
                        label: `${player1Name} win rate`,
                        data: monthly.map(m => m.n > 0 ? (m.p1 / m.n * 100).toFixed(1) : 0),
                        borderColor: 'rgb(248, 113, 113)',
                        backgroundColor: 'rgba(248, 113, 113, 0.1)',
                        tension: 0.2,
                        pointRadius: 3
                    },
                    {
                        label: `${player2Name} win rate`,
                        data: monthly.map(m => m.n > 0 ? (m.p2 / m.n * 100).toFixed(1) : 0),
                        borderColor: 'rgb(96, 165, 250)',
                        backgroundColor: 'rgba(96, 165, 250, 0.1)',
                        tension: 0.2,
                        pointRadius: 3
                    },
                    {
                        label: 'Break-even (50%)',
                        data: monthly.map(() => 50),
                        borderColor: 'rgba(156, 163, 175, 0.5)',
                        borderDash: [4, 4],
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { labels: { color: winrateChartTheme.legend, font: { size: 10 } } } },
                scales: {
                    x: { offset: true, ticks: { color: winrateChartTheme.ticks, font: { size: 9 } }, grid: { color: winrateChartTheme.grid } },
                    y: { min: 0, max: 100, ticks: { color: winrateChartTheme.ticks, font: { size: 9 }, callback: v => v + '%' }, grid: { color: winrateChartTheme.grid } }
                }
            }
        });
    } else if (window.analysisWinrateChart) {
        try { window.analysisWinrateChart.destroy(); } catch (e) {}
        window.analysisWinrateChart = null;
    }

    // Rating gap chart (needs multiple months to show a trend)
    const ratingContainer = document.getElementById('analysis-rating-container');
    const ratingCanvas = document.getElementById('analysis-rating-chart');
    const withRatings = monthly.filter(m => m.p1AvgRating !== null);
    if (ratingContainer) ratingContainer.classList.toggle('hidden', !isMultiMonth);
    if (ratingCanvas && typeof Chart !== 'undefined' && isMultiMonth && withRatings.length > 0) {
        if (window.analysisRatingChart) {
            try { window.analysisRatingChart.destroy(); } catch (e) {}
        }
        const ratingChartTheme = getChartThemeColors();
        window.analysisRatingChart = new Chart(ratingCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: withRatings.map(m => m.month),
                datasets: [
                    {
                        label: player1Name,
                        data: withRatings.map(m => m.p1AvgRating),
                        borderColor: 'rgb(248, 113, 113)',
                        backgroundColor: 'rgba(248, 113, 113, 0.1)',
                        tension: 0.2,
                        pointRadius: 2
                    },
                    {
                        label: player2Name,
                        data: withRatings.map(m => m.p2AvgRating),
                        borderColor: 'rgb(96, 165, 250)',
                        backgroundColor: 'rgba(96, 165, 250, 0.1)',
                        tension: 0.2,
                        pointRadius: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { labels: { color: ratingChartTheme.legend, font: { size: 10 } } } },
                scales: {
                    x: { offset: true, ticks: { color: ratingChartTheme.ticks, font: { size: 9 } }, grid: { color: ratingChartTheme.grid } },
                    y: { ticks: { color: ratingChartTheme.ticks, font: { size: 9 } }, grid: { color: ratingChartTheme.grid } }
                }
            }
        });
    } else if (window.analysisRatingChart) {
        try { window.analysisRatingChart.destroy(); } catch (e) {}
        window.analysisRatingChart = null;
    }

    const heroRating = document.getElementById('analysis-hero-rating');
    if (heroRating) {
        if (withRatings.length > 0) {
            const lastGap = withRatings[withRatings.length - 1].p2AvgRating - withRatings[withRatings.length - 1].p1AvgRating;
            heroRating.innerHTML = `
                <div class="text-xs text-gray-400 mb-1">Rating Gap${isMultiMonth ? ' (latest)' : ''}</div>
                <div class="text-lg font-bold text-white">${Math.abs(lastGap)}</div>
                <div class="text-xs mt-1">${lastGap > 0 ? `<span class="text-blue-400">${player2Name}</span>` : `<span class="text-red-400">${player1Name}</span>`} ahead</div>
            `;
        } else {
            heroRating.innerHTML = `<div class="text-xs text-gray-400 mb-1">Rating Gap</div><div class="text-lg font-bold text-gray-600">–</div>`;
        }
    }

    // Opening matchups (min 15 games), both players side by side, sorted by player1 win rate
    const openingsContainer = document.getElementById('analysis-openings');
    let openingRowsForReco = [];
    if (openingsContainer && typeof calculateOpeningStats === 'function') {
        openingsContainer.innerHTML = '';
        const openings = calculateOpeningStats(gamesByMonth, player1Name, player2Name);
        const rows = Object.entries(openings)
            .map(([name, s]) => {
                const n = s.games;
                const asColor = s.player1WhiteGames >= s.player1BlackGames ? `${player1Name} as White` : `${player1Name} as Black`;
                return { name, n, p1: s.player1Wins, p2: s.player2Wins, draw: s.draws, wr: n > 0 ? s.player1Wins / n : 0, asColor };
            })
            .filter(o => o.n >= 15)
            .sort((a, b) => b.wr - a.wr);

        openingRowsForReco = rows;

        if (rows.length === 0) {
            openingsContainer.innerHTML = '<div class="text-xs text-gray-500">Not enough games in this range for an opening breakdown (need 15+ per opening).</div>';
        } else {
            const legend = document.createElement('div');
            legend.className = 'flex items-center gap-4 text-[10px] text-gray-500 mb-2';
            legend.innerHTML = `
                <span class="flex items-center gap-1"><span class="w-2 h-2 bg-red-400 inline-block rounded-sm"></span>${player1Name}</span>
                <span class="flex items-center gap-1"><span class="w-2 h-2 bg-gray-500 inline-block rounded-sm"></span>draw</span>
                <span class="flex items-center gap-1"><span class="w-2 h-2 bg-blue-400 inline-block rounded-sm"></span>${player2Name}</span>
            `;
            openingsContainer.appendChild(legend);
            rows.forEach(o => renderMatchupBar(openingsContainer, o.name, o.p1, o.draw, o.p2, o.asColor));
        }
    }

    // Splits: color / length / day of week — both players side by side
    const splitsContainer = document.getElementById('analysis-splits');
    let splitsForReco = null;
    if (splitsContainer) {
        splitsContainer.innerHTML = '';
        const { byColor, byLength, byDow } = computeSplits(allGames, player1Name);
        splitsForReco = { byColor, byLength, byDow };

        const legend = document.createElement('div');
        legend.className = 'flex items-center gap-4 text-[10px] text-gray-500 mb-2';
        legend.innerHTML = `
            <span class="flex items-center gap-1"><span class="w-2 h-2 bg-red-400 inline-block rounded-sm"></span>${player1Name}</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 bg-gray-500 inline-block rounded-sm"></span>draw</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 bg-blue-400 inline-block rounded-sm"></span>${player2Name}</span>
        `;
        splitsContainer.appendChild(legend);

        const colorHeader = document.createElement('div');
        colorHeader.className = 'text-xs font-semibold text-gray-400 mb-2 mt-1';
        colorHeader.textContent = `By color (${player1Name}'s perspective)`;
        splitsContainer.appendChild(colorHeader);
        renderMatchupBar(splitsContainer, `${player1Name} plays White`, byColor.p1White.w, byColor.p1White.d, byColor.p1White.l);
        renderMatchupBar(splitsContainer, `${player1Name} plays Black`, byColor.p1Black.w, byColor.p1Black.d, byColor.p1Black.l);

        const lengthHeader = document.createElement('div');
        lengthHeader.className = 'text-xs font-semibold text-gray-400 mb-2 mt-4';
        lengthHeader.textContent = 'By game length';
        splitsContainer.appendChild(lengthHeader);
        renderMatchupBar(splitsContainer, 'Short (<30 ply)', byLength.short.w, byLength.short.d, byLength.short.l);
        renderMatchupBar(splitsContainer, 'Medium (30–60 ply)', byLength.medium.w, byLength.medium.d, byLength.medium.l);
        renderMatchupBar(splitsContainer, 'Long (>60 ply)', byLength.long.w, byLength.long.d, byLength.long.l);

        const dowHeader = document.createElement('div');
        dowHeader.className = 'text-xs font-semibold text-gray-400 mb-2 mt-4';
        dowHeader.textContent = 'By day of week';
        splitsContainer.appendChild(dowHeader);
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        byDow.forEach((bucket, i) => {
            const total = bucket.w + bucket.l + bucket.d;
            if (total > 0) renderMatchupBar(splitsContainer, dayNames[i], bucket.w, bucket.d, bucket.l);
        });
    }

    // Game character: blunders, thrown wins, comebacks, back-and-forth games
    displayGameCharacter(allGames, player1Name, player2Name);

    // Streak timeline
    const streakContainer = document.getElementById('analysis-streaks');
    if (streakContainer) {
        const runs = computeStreakTimeline(allGames, player1Name);
        const totalLen = runs.reduce((s, r) => s + r.length, 0);
        const longestP1 = Math.max(0, ...runs.filter(r => r.result === 'p1').map(r => r.length));
        const longestP2 = Math.max(0, ...runs.filter(r => r.result === 'p2').map(r => r.length));
        const longestDraw = Math.max(0, ...runs.filter(r => r.result === 'draw').map(r => r.length));

        const heroStreaks = document.getElementById('analysis-hero-streaks');
        if (heroStreaks) {
            heroStreaks.innerHTML = `
                <div class="text-xs text-gray-400 mb-1">Longest Streaks</div>
                <div class="text-lg font-bold"><span class="text-red-400">${longestP1}</span><span class="text-gray-500 text-sm"> / </span><span class="text-blue-400">${longestP2}</span></div>
                <div class="text-xs text-gray-500 mt-1">${player1Name} / ${player2Name} (games)</div>
                <div class="text-sm font-bold text-gray-400 mt-2">${longestDraw}</div>
                <div class="text-xs text-gray-500 mt-1">longest draw streak</div>
            `;
        }

        const fmtDate = t => new Date(t).toISOString().slice(0, 10);
        let stripHtml = '<div class="flex w-full h-6 rounded overflow-hidden border border-gray-700">';
        runs.forEach(r => {
            const widthPct = (r.length / totalLen * 100).toFixed(3);
            const color = r.result === 'p1' ? 'bg-red-400' : r.result === 'p2' ? 'bg-blue-400' : 'bg-gray-500';
            const who = r.result === 'p1' ? player1Name : r.result === 'p2' ? player2Name : 'Draws';
            const title = `${who}: ${r.length} in a row (${fmtDate(r.startDate)} to ${fmtDate(r.endDate)})`;
            stripHtml += `<div class="${color} h-full" style="width:${widthPct}%" title="${title}"></div>`;
        });
        stripHtml += '</div>';

        const topRuns = [...runs].filter(r => r.result !== 'draw').sort((a, b) => b.length - a.length).slice(0, 8);
        let listHtml = '<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">';
        topRuns.forEach(r => {
            const who = r.result === 'p1' ? player1Name : player2Name;
            const colorClass = r.result === 'p1' ? 'text-red-400' : 'text-blue-400';
            listHtml += `<div class="bg-gray-900 rounded p-2 text-center border border-gray-700">
                <div class="text-sm font-bold ${colorClass}">${r.length}</div>
                <div class="text-[10px] text-gray-500 truncate" title="${who}">${who}</div>
                <div class="text-[10px] text-gray-600">${fmtDate(r.startDate)}</div>
            </div>`;
        });
        listHtml += '</div>';

        streakContainer.innerHTML = `
            <div class="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                <span>${fmtDate(runs[0].startDate)}</span>
                <span>chronological, left → right</span>
                <span>${fmtDate(runs[runs.length - 1].endDate)}</span>
            </div>
            ${stripHtml}
            <div class="flex items-center gap-4 text-[10px] text-gray-500 mt-2">
                <span class="flex items-center gap-1"><span class="w-2 h-2 bg-red-400 inline-block rounded-sm"></span>${player1Name} streak</span>
                <span class="flex items-center gap-1"><span class="w-2 h-2 bg-blue-400 inline-block rounded-sm"></span>${player2Name} streak</span>
                <span class="flex items-center gap-1"><span class="w-2 h-2 bg-gray-500 inline-block rounded-sm"></span>draw</span>
            </div>
            <div class="text-xs text-gray-400 mt-3 mb-1">Longest runs</div>
            ${listHtml}
        `;
    }

    // Recommendations — best/worst matchups for BOTH players side by side
    const recoContainer = document.getElementById('analysis-reco');
    if (recoContainer) {
        const rows = openingRowsForReco;
        const bestForP1 = rows.slice(0, 2);
        const bestForP2 = [...rows].sort((a, b) => a.wr - b.wr).slice(0, 2);
        const { byColor, byLength, byDow } = splitsForReco || {};

        let html = '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-400">';

        html += `<div><div class="text-red-400 font-semibold mb-1">${player1Name}'s strengths</div><ul class="space-y-1.5 list-disc pl-4">`;
        if (bestForP1.length) html += `<li>Best openings: ${bestForP1.map(o => `${o.name} (${(o.wr*100).toFixed(0)}%, n=${o.n})`).join(', ')}</li>`;
        if (byColor) {
            const wrWhite = byColor.p1White.w / Math.max(1, byColor.p1White.w + byColor.p1White.l + byColor.p1White.d);
            const wrBlack = byColor.p1Black.w / Math.max(1, byColor.p1Black.w + byColor.p1Black.l + byColor.p1Black.d);
            html += `<li>Stronger as ${wrWhite >= wrBlack ? 'White' : 'Black'} (${(Math.max(wrWhite, wrBlack)*100).toFixed(1)}%)</li>`;
        }
        if (byDow) {
            const best = byDow.map((b, i) => ({ i, wr: b.w / Math.max(1, b.w+b.l+b.d), n: b.w+b.l+b.d })).filter(d => d.n >= 10).sort((a,b) => b.wr - a.wr)[0];
            const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
            if (best) html += `<li>Best day: ${dayNames[best.i]} (${(best.wr*100).toFixed(1)}%, n=${best.n})</li>`;
        }
        html += '</ul></div>';

        html += `<div><div class="text-blue-400 font-semibold mb-1">${player2Name}'s strengths</div><ul class="space-y-1.5 list-disc pl-4">`;
        if (bestForP2.length) html += `<li>Best openings: ${bestForP2.map(o => `${o.name} (${((1-o.wr)*100).toFixed(0)}%, n=${o.n})`).join(', ')}</li>`;
        if (byColor) {
            const wrWhiteP2 = byColor.p1Black.l / Math.max(1, byColor.p1Black.w + byColor.p1Black.l + byColor.p1Black.d);
            const wrBlackP2 = byColor.p1White.l / Math.max(1, byColor.p1White.w + byColor.p1White.l + byColor.p1White.d);
            html += `<li>Stronger as ${wrWhiteP2 >= wrBlackP2 ? 'White' : 'Black'} (${(Math.max(wrWhiteP2, wrBlackP2)*100).toFixed(1)}%)</li>`;
        }
        if (byDow) {
            const best = byDow.map((b, i) => ({ i, wr: b.l / Math.max(1, b.w+b.l+b.d), n: b.w+b.l+b.d })).filter(d => d.n >= 10).sort((a,b) => b.wr - a.wr)[0];
            const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
            if (best) html += `<li>Best day: ${dayNames[best.i]} (${(best.wr*100).toFixed(1)}%, n=${best.n})</li>`;
        }
        html += '</ul></div>';

        html += '</div>';
        recoContainer.innerHTML = html;
    }
}

window.displayAnalysisTab = displayAnalysisTab;
