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

function renderPointsChart(gamesByMonth, player1Name, player2Name) {
    const canvas = document.getElementById('points-chart');
    if (!canvas) return;

    const chartData = generateChartData(gamesByMonth, player1Name);

    // Destroy existing chart if it exists
    if (pointsChart) {
        pointsChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    pointsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: player1Name,
                    data: chartData.player1Points,
                    borderColor: 'rgb(96, 165, 250)',
                    backgroundColor: 'rgba(96, 165, 250, 0.1)',
                    borderWidth: 2,
                    tension: 0.1,
                    fill: false
                },
                {
                    label: player2Name,
                    data: chartData.player2Points,
                    borderColor: 'rgb(248, 113, 113)',
                    backgroundColor: 'rgba(248, 113, 113, 0.1)',
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
