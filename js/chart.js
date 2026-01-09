let pointsChart = null;

function generateChartData(gamesByMonth, player1Name) {
    const allGames = [];

    // Flatten and sort all games by date
    Object.keys(gamesByMonth).sort().forEach(monthKey => {
        allGames.push(...gamesByMonth[monthKey]);
    });

    allGames.sort((a, b) => a.createdAt - b.createdAt);

    const labels = [];
    const player1Points = [];
    const player2Points = [];

    let p1Cumulative = 0;
    let p2Cumulative = 0;

    allGames.forEach((game, index) => {
        const whitePlayer = game.players.white.user.name;
        const winner = game.winner;

        // Calculate points for this game
        let p1GamePoints = 0;
        let p2GamePoints = 0;

        if (winner === 'white') {
            if (whitePlayer === player1Name) {
                p1GamePoints = 1;
                p2GamePoints = 0;
            } else {
                p1GamePoints = 0;
                p2GamePoints = 1;
            }
        } else if (winner === 'black') {
            if (whitePlayer === player1Name) {
                p1GamePoints = 0;
                p2GamePoints = 1;
            } else {
                p1GamePoints = 1;
                p2GamePoints = 0;
            }
        } else {
            // Draw
            p1GamePoints = 0.5;
            p2GamePoints = 0.5;
        }

        p1Cumulative += p1GamePoints;
        p2Cumulative += p2GamePoints;

        // Format label
        const label = `Game ${index + 1}`;

        labels.push(label);
        player1Points.push(p1Cumulative);
        player2Points.push(p2Cumulative);
    });

    return { labels, player1Points, player2Points };
}

// Cache for chart data to avoid unnecessary recreation
let lastPointsChartData = null;
let lastPointsChartKey = null;

function renderPointsChart(gamesByMonth, player1Name, player2Name) {
    const canvas = document.getElementById('points-chart');
    if (!canvas) return;

    // Check if canvas is visible (tab is active)
    const canvasParent = canvas.closest('.tab-pane');
    if (canvasParent && !canvasParent.classList.contains('active')) {
        // Tab is not active, don't render yet
        return;
    }

    const chartData = generateChartData(gamesByMonth, player1Name);
    const dataKey = JSON.stringify(chartData);

    // Only recreate chart if data has changed or chart doesn't exist
    if (pointsChart && dataKey === lastPointsChartKey) {
        // Data hasn't changed, just update if needed
        return;
    }

    // Destroy existing chart if it exists
    if (pointsChart) {
        pointsChart.destroy();
        pointsChart = null;
    }

    lastPointsChartData = chartData;
    lastPointsChartKey = dataKey;

    const ctx = canvas.getContext('2d');
    pointsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: player1Name,
                    data: chartData.player1Points,
                    borderColor: 'rgb(248, 113, 113)',
                    backgroundColor: 'rgba(248, 113, 113, 0.1)',
                    borderWidth: 2,
                    tension: 0.1,
                    fill: false
                },
                {
                    label: player2Name,
                    data: chartData.player2Points,
                    borderColor: 'rgb(96, 165, 250)',
                    backgroundColor: 'rgba(96, 165, 250, 0.1)',
                    borderWidth: 2,
                    tension: 0.1,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: 'rgb(209, 213, 219)',
                        font: {
                            family: "'Fira Code', monospace"
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: 'rgb(156, 163, 175)',
                        font: {
                            family: "'Fira Code', monospace"
                        },
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 10
                    },
                    grid: {
                        color: 'rgba(75, 85, 99, 0.3)'
                    }
                },
                y: {
                    ticks: {
                        color: 'rgb(156, 163, 175)',
                        font: {
                            family: "'Fira Code', monospace"
                        }
                    },
                    grid: {
                        color: 'rgba(75, 85, 99, 0.3)'
                    }
                }
            }
        }
    });
}

let monthlyWinrateChart = null;
let lastMonthlyChartData = null;
let lastMonthlyChartKey = null;
let currentMonthlyMetric = 'winrate';

function renderMonthlyWinrateChart(stats, player1Name, player2Name, metric = 'winrate') {
    const canvas = document.getElementById('monthly-winrate-chart');
    if (!canvas || !stats || !stats.monthlyStats) return;

    // Check if canvas is visible (tab is active)
    const canvasParent = canvas.closest('.tab-pane');
    if (canvasParent && !canvasParent.classList.contains('active')) {
        // Tab is not active, don't render yet
        return;
    }

    // Prepare data from monthly stats
    const monthlyStatsList = Object.entries(stats.monthlyStats)
        .map(([monthKey, data]) => {
            const [year, month] = monthKey.split('-');
            return {
                monthKey,
                month: parseInt(month),
                year: parseInt(year),
                games: data.games,
                player1Wins: data.player1Wins,
                player2Wins: data.player2Wins,
                draws: data.draws !== undefined ? data.draws : (data.games - data.player1Wins - data.player2Wins),
                player1KingMoves: data.player1KingMoves || [],
                player2KingMoves: data.player2KingMoves || [],
                player1Accuracy: data.player1Accuracy || [],
                player2Accuracy: data.player2Accuracy || [],
                player1Streak: data.streaks?.player1 || 0,
                player2Streak: data.streaks?.player2 || 0
            };
        })
        .sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
        });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const labels = monthlyStatsList.map(m => `${monthNames[m.month - 1]} ${m.year}`);
    
    // Calculate data based on selected metric
    let player1Data, player2Data, yAxisLabel, yAxisCallback, yAxisMin, yAxisMax;
    
    switch(metric) {
        case 'winrate':
            // Win rates ignoring draws: wins / (wins + losses)
            player1Data = monthlyStatsList.map(m => {
                const p1Losses = m.games - m.player1Wins - m.draws;
                const p1DecisiveGames = m.player1Wins + p1Losses;
                return p1DecisiveGames > 0 ? (m.player1Wins / p1DecisiveGames) * 100 : 0;
            });
            player2Data = monthlyStatsList.map(m => {
                const p2Losses = m.games - m.player2Wins - m.draws;
                const p2DecisiveGames = m.player2Wins + p2Losses;
                return p2DecisiveGames > 0 ? (m.player2Wins / p2DecisiveGames) * 100 : 0;
            });
            yAxisLabel = 'Win Rate (%)';
            yAxisCallback = (value) => value + '%';
            yAxisMin = 0;
            yAxisMax = 100;
            break;
        case 'wins':
            player1Data = monthlyStatsList.map(m => m.player1Wins);
            player2Data = monthlyStatsList.map(m => m.player2Wins);
            yAxisLabel = 'Wins';
            yAxisCallback = (value) => value;
            yAxisMin = 0;
            yAxisMax = null;
            break;
        case 'kingmoves':
            player1Data = monthlyStatsList.map(m => {
                const moves = m.player1KingMoves || [];
                return moves.length > 0 ? moves.reduce((sum, val) => sum + val, 0) / moves.length : 0;
            });
            player2Data = monthlyStatsList.map(m => {
                const moves = m.player2KingMoves || [];
                return moves.length > 0 ? moves.reduce((sum, val) => sum + val, 0) / moves.length : 0;
            });
            yAxisLabel = 'Avg King Moves';
            yAxisCallback = (value) => value.toFixed(1);
            yAxisMin = 0;
            yAxisMax = null;
            break;
        case 'accuracy':
            player1Data = monthlyStatsList.map(m => {
                const acc = m.player1Accuracy || [];
                return acc.length > 0 ? acc.reduce((sum, val) => sum + val, 0) / acc.length : 0;
            });
            player2Data = monthlyStatsList.map(m => {
                const acc = m.player2Accuracy || [];
                return acc.length > 0 ? acc.reduce((sum, val) => sum + val, 0) / acc.length : 0;
            });
            yAxisLabel = 'Avg Accuracy (%)';
            yAxisCallback = (value) => value.toFixed(1) + '%';
            yAxisMin = 0;
            yAxisMax = 100;
            break;
        case 'streaks':
            player1Data = monthlyStatsList.map(m => m.player1Streak || 0);
            player2Data = monthlyStatsList.map(m => m.player2Streak || 0);
            yAxisLabel = 'Best Streak';
            yAxisCallback = (value) => value;
            yAxisMin = 0;
            yAxisMax = null;
            break;
        default:
            // Win rates ignoring draws: wins / (wins + losses)
            player1Data = monthlyStatsList.map(m => {
                const p1Losses = m.games - m.player1Wins - m.draws;
                const p1DecisiveGames = m.player1Wins + p1Losses;
                return p1DecisiveGames > 0 ? (m.player1Wins / p1DecisiveGames) * 100 : 0;
            });
            player2Data = monthlyStatsList.map(m => {
                const p2Losses = m.games - m.player2Wins - m.draws;
                const p2DecisiveGames = m.player2Wins + p2Losses;
                return p2DecisiveGames > 0 ? (m.player2Wins / p2DecisiveGames) * 100 : 0;
            });
            yAxisLabel = 'Win Rate (%)';
            yAxisCallback = (value) => value + '%';
            yAxisMin = 0;
            yAxisMax = 100;
    }

    const dataKey = JSON.stringify({ labels, player1Data, player2Data, metric });

    // Only recreate chart if data has changed or chart doesn't exist
    if (monthlyWinrateChart && dataKey === lastMonthlyChartKey) {
        // Data hasn't changed, just update if needed
        return;
    }

    // Destroy existing chart if it exists
    if (monthlyWinrateChart) {
        monthlyWinrateChart.destroy();
        monthlyWinrateChart = null;
    }

    lastMonthlyChartData = { labels, player1Data, player2Data };
    lastMonthlyChartKey = dataKey;
    currentMonthlyMetric = metric;

    const ctx = canvas.getContext('2d');
    monthlyWinrateChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: player1Name,
                    data: player1Data,
                    borderColor: 'rgb(248, 113, 113)',
                    backgroundColor: 'rgba(248, 113, 113, 0.1)',
                    borderWidth: 2,
                    tension: 0.1,
                    fill: false,
                    pointRadius: 4,
                    pointBackgroundColor: 'rgb(248, 113, 113)'
                },
                {
                    label: player2Name,
                    data: player2Data,
                    borderColor: 'rgb(96, 165, 250)',
                    backgroundColor: 'rgba(96, 165, 250, 0.1)',
                    borderWidth: 2,
                    tension: 0.1,
                    fill: false,
                    pointRadius: 4,
                    pointBackgroundColor: 'rgb(96, 165, 250)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: 'rgb(209, 213, 219)',
                        font: {
                            family: "'Fira Code', monospace"
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y;
                            if (metric === 'winrate' || metric === 'accuracy') {
                                return context.dataset.label + ': ' + value.toFixed(1) + '%';
                            } else if (metric === 'kingmoves') {
                                return context.dataset.label + ': ' + value.toFixed(1);
                            } else {
                                return context.dataset.label + ': ' + value;
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: 'rgb(156, 163, 175)',
                        font: {
                            family: "'Fira Code', monospace"
                        },
                        maxRotation: 45,
                        autoSkip: true
                    },
                    grid: {
                        color: 'rgba(75, 85, 99, 0.3)'
                    }
                },
                y: {
                    min: yAxisMin,
                    max: yAxisMax,
                    ticks: {
                        color: 'rgb(156, 163, 175)',
                        font: {
                            family: "'Fira Code', monospace"
                        },
                        callback: yAxisCallback
                    },
                    grid: {
                        color: 'rgba(75, 85, 99, 0.3)'
                    }
                }
            }
        }
    });
}
