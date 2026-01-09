// Tab switching functionality
document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');

    const switchTab = (targetTab, updateUrl = true) => {
        if (!targetTab) return;
        
        // Remove active class from all buttons and panes
        tabButtons.forEach(btn => {
            btn.classList.remove('active');
            btn.classList.remove('border-gray-400', 'text-gray-300');
            btn.classList.add('border-transparent', 'text-gray-400');
        });

        tabPanes.forEach(pane => {
            const tabName = pane.dataset.tabContent;
            const wasActive = pane.classList.contains('active');
            
            // Only cleanup charts when tabs are being hidden (not when switching to them)
            if (wasActive && tabName !== targetTab) {
                if (tabName === 'overview' && window.pointsChart) {
                    // Destroy points chart when overview tab is hidden
                    try {
                        window.pointsChart.destroy();
                        window.pointsChart = null;
                    } catch (e) {
                        console.warn('Error destroying points chart:', e);
                    }
                }
                if (tabName === 'monthly' && window.monthlyWinrateChart) {
                    // Destroy monthly chart when monthly tab is hidden
                    try {
                        window.monthlyWinrateChart.destroy();
                        window.monthlyWinrateChart = null;
                    } catch (e) {
                        console.warn('Error destroying monthly chart:', e);
                    }
                }
            }
            
            pane.classList.remove('active');
        });

        // Add active class to clicked button and corresponding pane
        const button = document.querySelector(`[data-tab="${targetTab}"]`);
        if (button) {
            button.classList.add('active');
            button.classList.remove('border-transparent', 'text-gray-400');
            button.classList.add('border-gray-400', 'text-gray-300');
        }

        const targetPane = document.querySelector(`[data-tab-content="${targetTab}"]`);
        if (targetPane) {
            targetPane.classList.add('active');
            
            // Render charts when their tab becomes active (lazy rendering)
            if (targetTab === 'overview' && typeof renderPointsChart === 'function') {
                // Get current filtered games from cache or global
                const route = typeof Router !== 'undefined' ? Router.getCurrentRoute() : {};
                const { year = 'all', month = 'all', day = 'all' } = route;
                const cacheKey = `${year}-${month}-${day || 'all'}`;
                let filteredGames = typeof window !== 'undefined' && window.filteredGamesCache 
                    ? window.filteredGamesCache.get(cacheKey) 
                    : null;
                
                if (!filteredGames && typeof window !== 'undefined' && window.globalGamesByMonth) {
                    if (typeof filterGamesByDateRange === 'function') {
                        filteredGames = filterGamesByDateRange(window.globalGamesByMonth, year, month, day);
                    }
                }
                
                if (filteredGames && typeof getPlayerNames === 'function') {
                    const [player1Name, player2Name] = getPlayerNames(window.globalGamesByMonth || {});
                    // Use requestAnimationFrame to ensure DOM is ready
                    requestAnimationFrame(() => {
                        renderPointsChart(filteredGames, player1Name, player2Name);
                    });
                }
            }
            
            if (targetTab === 'monthly' && typeof renderMonthlyWinrateChart === 'function') {
                // Get current stats
                const route = typeof Router !== 'undefined' ? Router.getCurrentRoute() : {};
                const { year = 'all', month = 'all', day = 'all' } = route;
                const cacheKey = `${year}-${month}-${day || 'all'}`;
                let filteredGames = typeof window !== 'undefined' && window.filteredGamesCache 
                    ? window.filteredGamesCache.get(cacheKey) 
                    : null;
                
                if (!filteredGames && typeof window !== 'undefined' && window.globalGamesByMonth) {
                    if (typeof filterGamesByDateRange === 'function') {
                        filteredGames = filterGamesByDateRange(window.globalGamesByMonth, year, month, day);
                    }
                }
                
                if (filteredGames && typeof calculateStats === 'function' && typeof getPlayerNames === 'function') {
                    const stats = calculateStats(filteredGames, window.globalGamesByMonth || {}, getPlayerNames);
                    const [player1Name, player2Name] = getPlayerNames(window.globalGamesByMonth || {});
                    // Use requestAnimationFrame with a small delay to ensure DOM is ready and tab is visible
                    requestAnimationFrame(() => {
                        setTimeout(() => {
                            const metricSelector = document.getElementById('monthly-metric-selector');
                            const metric = metricSelector ? metricSelector.value : 'winrate';
                            renderMonthlyWinrateChart(stats, player1Name, player2Name, metric);
                        }, 50);
                    });
                }
            }
            
            if (targetTab === 'fun' && typeof displayInterestingGames === 'function') {
                // Get current filtered games
                const route = typeof Router !== 'undefined' ? Router.getCurrentRoute() : {};
                const { year = 'all', month = 'all', day = 'all' } = route;
                const cacheKey = `${year}-${month}-${day || 'all'}`;
                let filteredGames = typeof window !== 'undefined' && window.filteredGamesCache 
                    ? window.filteredGamesCache.get(cacheKey) 
                    : null;
                
                if (!filteredGames && typeof window !== 'undefined' && window.globalGamesByMonth) {
                    if (typeof filterGamesByDateRange === 'function') {
                        filteredGames = filterGamesByDateRange(window.globalGamesByMonth, year, month, day);
                    }
                }
                
                if (filteredGames && typeof getPlayerNames === 'function') {
                    const [player1Name, player2Name] = getPlayerNames(window.globalGamesByMonth || {});
                    // Use requestAnimationFrame to ensure DOM is ready
                    requestAnimationFrame(() => {
                        displayInterestingGames(filteredGames, player1Name, player2Name);
                    });
                }
            }
        } else {
            console.warn(`Tab pane not found for tab: ${targetTab}`);
        }

        // Update URL if requested
        if (updateUrl && typeof Router !== 'undefined' && Router.updateRoute) {
            Router.updateRoute({ tab: targetTab });
        }
    };

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            switchTab(targetTab, true);
        });
    });

    // Expose switchTab for external use (e.g., from router)
    window.switchTab = switchTab;
});
