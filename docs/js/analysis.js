// Analysis tab: deep-dive learnings — rating gap, opening win rates, splits, streak timeline

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

function winRatePct(bucket) {
    const total = bucket.w + bucket.l + bucket.d;
    return total > 0 ? bucket.w / total : 0;
}

function renderDivergingBar(container, label, wr, n, extra) {
    const isGood = wr >= 0.5;
    const pctFromMid = Math.abs(wr - 0.5) * 2;
    const widthPct = (pctFromMid * 50).toFixed(1);
    const leftPct = isGood ? 50 : (50 - widthPct);
    const colorClass = isGood ? 'bg-red-400' : 'bg-blue-400';

    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 mb-1.5';
    row.innerHTML = `
        <div class="w-40 sm:w-56 text-right text-xs text-gray-400 truncate" title="${label}${extra ? ' — ' + extra : ''}">${label}${extra ? ` <span class="text-gray-600">(${extra})</span>` : ''}</div>
        <div class="flex-1 relative h-4 bg-gray-700 rounded">
            <div class="absolute -top-0.5 -bottom-0.5 w-px bg-gray-500" style="left:50%"></div>
            <div class="absolute top-0 bottom-0 rounded ${colorClass}" style="left:${leftPct}%;width:${widthPct}%"></div>
        </div>
        <div class="w-24 flex-none text-xs text-gray-400 font-mono">${(wr * 100).toFixed(1)}% (n=${n})</div>
    `;
    container.appendChild(row);
}

function displayAnalysisTab(gamesByMonth, player1Name, player2Name) {
    const monthly = computeMonthlySummary(gamesByMonth, player1Name);
    const allGames = Object.values(gamesByMonth).flat();
    if (allGames.length === 0) return;

    const totalP1 = monthly.reduce((s, m) => s + m.p1, 0);
    const totalP2 = monthly.reduce((s, m) => s + m.p2, 0);
    const totalDraw = monthly.reduce((s, m) => s + m.draw, 0);
    const totalGames = totalP1 + totalP2 + totalDraw;
    const monthsWonP1 = monthly.filter(m => m.p1 > m.p2).length;
    const monthsWonP2 = monthly.filter(m => m.p2 > m.p1).length;

    // Hero stats
    const heroEl = document.getElementById('analysis-hero');
    if (heroEl) {
        heroEl.innerHTML = `
            <div class="bg-gray-800 rounded-lg p-3 border border-gray-700 text-center">
                <div class="text-xs text-gray-400 mb-1">Overall Record</div>
                <div class="text-lg font-bold text-white">${totalP1}–${totalP2}–${totalDraw}</div>
                <div class="text-xs text-yellow-400 mt-1">${totalGames > 0 ? (totalP1 / totalGames * 100).toFixed(1) : 0}% win rate</div>
            </div>
            <div class="bg-gray-800 rounded-lg p-3 border border-gray-700 text-center">
                <div class="text-xs text-gray-400 mb-1">Months Won</div>
                <div class="text-lg font-bold text-red-400">${monthsWonP1}</div>
                <div class="text-xs text-gray-500 mt-1">vs ${monthsWonP2} for ${player2Name}, of ${monthly.length}</div>
            </div>
            <div class="bg-gray-800 rounded-lg p-3 border border-gray-700 text-center" id="analysis-hero-streaks">
            </div>
            <div class="bg-gray-800 rounded-lg p-3 border border-gray-700 text-center" id="analysis-hero-rating">
            </div>
        `;
    }

    // Monthly win-rate chart
    const winrateCanvas = document.getElementById('analysis-monthly-winrate-chart');
    if (winrateCanvas && typeof Chart !== 'undefined') {
        if (window.analysisWinrateChart) {
            try { window.analysisWinrateChart.destroy(); } catch (e) {}
        }
        window.analysisWinrateChart = new Chart(winrateCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: monthly.map(m => m.month),
                datasets: [
                    {
                        label: `${player1Name} win rate`,
                        data: monthly.map(m => (m.winRate * 100).toFixed(1)),
                        borderColor: 'rgb(248, 113, 113)',
                        backgroundColor: 'rgba(248, 113, 113, 0.1)',
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
                plugins: { legend: { labels: { color: 'rgb(209, 213, 219)', font: { size: 10 } } } },
                scales: {
                    x: { ticks: { color: 'rgb(156, 163, 175)', font: { size: 9 } }, grid: { color: 'rgba(75, 85, 99, 0.3)' } },
                    y: { min: 0, max: 100, ticks: { color: 'rgb(156, 163, 175)', font: { size: 9 }, callback: v => v + '%' }, grid: { color: 'rgba(75, 85, 99, 0.3)' } }
                }
            }
        });
    }

    // Rating gap chart
    const ratingCanvas = document.getElementById('analysis-rating-chart');
    const withRatings = monthly.filter(m => m.p1AvgRating !== null);
    if (ratingCanvas && typeof Chart !== 'undefined' && withRatings.length > 0) {
        if (window.analysisRatingChart) {
            try { window.analysisRatingChart.destroy(); } catch (e) {}
        }
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
                plugins: { legend: { labels: { color: 'rgb(209, 213, 219)', font: { size: 10 } } } },
                scales: {
                    x: { ticks: { color: 'rgb(156, 163, 175)', font: { size: 9 } }, grid: { color: 'rgba(75, 85, 99, 0.3)' } },
                    y: { ticks: { color: 'rgb(156, 163, 175)', font: { size: 9 } }, grid: { color: 'rgba(75, 85, 99, 0.3)' } }
                }
            }
        });

        const lastGap = withRatings[withRatings.length - 1].p2AvgRating - withRatings[withRatings.length - 1].p1AvgRating;
        const heroRating = document.getElementById('analysis-hero-rating');
        if (heroRating) {
            heroRating.innerHTML = `
                <div class="text-xs text-gray-400 mb-1">Current Rating Gap</div>
                <div class="text-lg font-bold text-white">${Math.abs(lastGap)}</div>
                <div class="text-xs text-gray-500 mt-1">${lastGap > 0 ? player2Name : player1Name} ahead</div>
            `;
        }
    }

    // Opening win rates (min 15 games)
    const openingsContainer = document.getElementById('analysis-openings');
    if (openingsContainer && typeof calculateOpeningStats === 'function') {
        openingsContainer.innerHTML = '';
        const openings = calculateOpeningStats(gamesByMonth, player1Name, player2Name);
        const rows = Object.entries(openings)
            .map(([name, s]) => {
                const n = s.games;
                const wr = n > 0 ? s.player1Wins / n : 0;
                const asColor = s.player1WhiteGames >= s.player1BlackGames ? 'White' : 'Black';
                return { name, n, wr, asColor };
            })
            .filter(o => o.n >= 15)
            .sort((a, b) => b.wr - a.wr);

        if (rows.length === 0) {
            openingsContainer.innerHTML = '<div class="text-xs text-gray-500">Not enough games in this range for opening breakdown (need 15+ per opening).</div>';
        } else {
            rows.forEach(o => renderDivergingBar(openingsContainer, o.name, o.wr, o.n, `as ${o.asColor}`));
        }
    }

    // Splits: color / length / day of week
    const splitsContainer = document.getElementById('analysis-splits');
    if (splitsContainer) {
        splitsContainer.innerHTML = '';
        const { byColor, byLength, byDow } = computeSplits(allGames, player1Name);

        const colorHeader = document.createElement('div');
        colorHeader.className = 'text-xs font-semibold text-gray-400 mb-2 mt-1';
        colorHeader.textContent = 'By color';
        splitsContainer.appendChild(colorHeader);
        renderDivergingBar(splitsContainer, 'As White', winRatePct(byColor.p1White), byColor.p1White.w + byColor.p1White.l + byColor.p1White.d);
        renderDivergingBar(splitsContainer, 'As Black', winRatePct(byColor.p1Black), byColor.p1Black.w + byColor.p1Black.l + byColor.p1Black.d);

        const lengthHeader = document.createElement('div');
        lengthHeader.className = 'text-xs font-semibold text-gray-400 mb-2 mt-4';
        lengthHeader.textContent = 'By game length';
        splitsContainer.appendChild(lengthHeader);
        renderDivergingBar(splitsContainer, 'Short (<30 ply)', winRatePct(byLength.short), byLength.short.w + byLength.short.l + byLength.short.d);
        renderDivergingBar(splitsContainer, 'Medium (30–60 ply)', winRatePct(byLength.medium), byLength.medium.w + byLength.medium.l + byLength.medium.d);
        renderDivergingBar(splitsContainer, 'Long (>60 ply)', winRatePct(byLength.long), byLength.long.w + byLength.long.l + byLength.long.d);

        const dowHeader = document.createElement('div');
        dowHeader.className = 'text-xs font-semibold text-gray-400 mb-2 mt-4';
        dowHeader.textContent = 'By day of week';
        splitsContainer.appendChild(dowHeader);
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        byDow.forEach((bucket, i) => {
            const total = bucket.w + bucket.l + bucket.d;
            if (total > 0) renderDivergingBar(splitsContainer, dayNames[i], winRatePct(bucket), total);
        });
    }

    // Streak timeline
    const streakContainer = document.getElementById('analysis-streaks');
    if (streakContainer) {
        const runs = computeStreakTimeline(allGames, player1Name);
        const totalLen = runs.reduce((s, r) => s + r.length, 0);
        const longestP1 = Math.max(0, ...runs.filter(r => r.result === 'p1').map(r => r.length));
        const longestP2 = Math.max(0, ...runs.filter(r => r.result === 'p2').map(r => r.length));

        const heroStreaks = document.getElementById('analysis-hero-streaks');
        if (heroStreaks) {
            heroStreaks.innerHTML = `
                <div class="text-xs text-gray-400 mb-1">Longest Streaks</div>
                <div class="text-lg font-bold"><span class="text-red-400">${longestP1}</span><span class="text-gray-500 text-sm"> / </span><span class="text-blue-400">${longestP2}</span></div>
                <div class="text-xs text-gray-500 mt-1">${player1Name} / ${player2Name} (games)</div>
            `;
        }

        // Only show runs of length >= 2 as segments worth labeling; render every run in the strip
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

        // Top streak call-outs
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

    // Recommendations (computed dynamically from openings/splits above)
    const recoContainer = document.getElementById('analysis-reco');
    if (recoContainer && typeof calculateOpeningStats === 'function') {
        const openings = calculateOpeningStats(gamesByMonth, player1Name, player2Name);
        const openingRows = Object.entries(openings)
            .map(([name, s]) => ({ name, n: s.games, wr: s.games > 0 ? s.player1Wins / s.games : 0 }))
            .filter(o => o.n >= 15)
            .sort((a, b) => b.wr - a.wr);

        const best = openingRows.slice(0, 2);
        const worst = openingRows.slice(-2).reverse();
        const { byColor, byLength, byDow } = computeSplits(allGames, player1Name);
        const wrWhite = winRatePct(byColor.p1White), wrBlack = winRatePct(byColor.p1Black);
        const wrShort = winRatePct(byLength.short), wrLong = winRatePct(byLength.long);
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const bestDayIdx = byDow.map((b, i) => ({ i, wr: winRatePct(b), n: b.w + b.l + b.d })).filter(d => d.n >= 10).sort((a, b) => b.wr - a.wr)[0];

        let html = '<ul class="text-xs text-gray-400 space-y-2 list-disc pl-4">';
        if (best.length) html += `<li><span class="text-white font-semibold">Best openings:</span> ${best.map(o => `${o.name} (${(o.wr*100).toFixed(0)}%, n=${o.n})`).join(', ')} — lean into these.</li>`;
        if (worst.length) html += `<li><span class="text-white font-semibold">Worst openings:</span> ${worst.map(o => `${o.name} (${(o.wr*100).toFixed(0)}%, n=${o.n})`).join(', ')} — biggest lever to cut from the rotation.</li>`;
        html += `<li><span class="text-white font-semibold">Color:</span> ${(wrWhite*100).toFixed(1)}% as White vs ${(wrBlack*100).toFixed(1)}% as Black.</li>`;
        html += `<li><span class="text-white font-semibold">Game length:</span> ${(wrShort*100).toFixed(1)}% in short games (&lt;30 ply) vs ${(wrLong*100).toFixed(1)}% in long games (&gt;60 ply) — play for longer, less forcing positions if the short-game number is lower.</li>`;
        if (bestDayIdx) html += `<li><span class="text-white font-semibold">Best day:</span> ${dayNames[bestDayIdx.i]} (${(bestDayIdx.wr*100).toFixed(1)}% win rate, n=${bestDayIdx.n}).</li>`;
        html += '</ul>';
        recoContainer.innerHTML = html;
    }
}

window.displayAnalysisTab = displayAnalysisTab;
