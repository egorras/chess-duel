// Global state
let globalGamesByMonth = {};
let globalPlayerNames = [];
window.globalGamesByMonth = globalGamesByMonth; // Expose for calendar

// Cache for filtered games to avoid repeated filtering (LRU cache with max 20 entries)
let filteredGamesCache = null;
if (typeof window !== 'undefined' && window.optimizations && window.optimizations.LRUCache) {
    filteredGamesCache = new window.optimizations.LRUCache(20);
} else {
    // Fallback to Map if LRU cache not available
    filteredGamesCache = new Map();
}
window.filteredGamesCache = filteredGamesCache; // Expose for tabs.js

function displayStatsWithChart(gamesByMonth) {
    const stats = calculateStats(gamesByMonth, globalGamesByMonth, getPlayerNames);
    displayStats(stats);

    // Render the points chart, opening stats, and skirmishes
    if (stats && Object.keys(gamesByMonth).length > 0) {
        const [player1Name, player2Name] = getPlayerNames(globalGamesByMonth);
        
        // Only render charts if their tabs are active (prevents blinking)
        const overviewTab = document.querySelector('[data-tab-content="overview"]');
        const monthlyTab = document.querySelector('[data-tab-content="monthly"]');
        
        if (overviewTab && overviewTab.classList.contains('active')) {
            renderPointsChart(gamesByMonth, player1Name, player2Name);
        }
        
        if (monthlyTab && monthlyTab.classList.contains('active')) {
            const metricSelector = document.getElementById('monthly-metric-selector');
            const metric = metricSelector ? metricSelector.value : 'winrate';
            renderMonthlyWinrateChart(stats, player1Name, player2Name, metric);
        }
        
        displayOpeningStats(gamesByMonth, player1Name, player2Name);
        displaySessionStats(gamesByMonth, player1Name, player2Name);
        displayGames(gamesByMonth, player1Name, player2Name);
        if (typeof displayInterestingGames === 'function') {
            displayInterestingGames(gamesByMonth, player1Name, player2Name);
        }
    }
    
    // Calendar is initialized separately and always visible
}

function setupDateRangeSelectors() {
    // Get all unique years and months from game data
    const years = new Set();
    const monthsByYear = {};
    const allMonthKeys = [];

    Object.keys(globalGamesByMonth).forEach(monthKey => {
        const [year, month] = monthKey.split('-');
        years.add(year);
        allMonthKeys.push(monthKey);
        if (!monthsByYear[year]) {
            monthsByYear[year] = new Set();
        }
        monthsByYear[year].add(month);
    });

    const sortedMonthKeys = allMonthKeys.sort();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];

    // Populate year selector
    const yearSelect = document.getElementById('year-select');
    if (yearSelect) {
        Array.from(years).sort().forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });
    }

    // Get games by day for a specific month
    const getDaysByMonth = (year, month) => {
        const days = new Set();
        if (year !== 'all' && month !== 'all') {
            const monthKey = `${year}-${month}`;
            const games = globalGamesByMonth[monthKey] || [];
            games.forEach(game => {
                const date = new Date(game.createdAt);
                const day = String(date.getDate()).padStart(2, '0');
                days.add(day);
            });
        }
        return Array.from(days).sort((a, b) => parseInt(a) - parseInt(b));
    };

    // Update month selector when year changes
    const monthSelect = document.getElementById('month-select');
    const daySelect = document.getElementById('day-select');
    const updateMonthSelector = (year) => {
        if (!monthSelect) return;
        monthSelect.innerHTML = '<option value="all">All Months</option>';

        if (year !== 'all' && monthsByYear[year]) {
            Array.from(monthsByYear[year]).sort().forEach(month => {
                const option = document.createElement('option');
                option.value = month;
                option.textContent = monthNames[parseInt(month) - 1];
                monthSelect.appendChild(option);
            });
        }
    };

    // Update day selector when month changes
    const updateDaySelector = (year, month) => {
        if (!daySelect) return;
        daySelect.innerHTML = '<option value="all">All Days</option>';

        if (year !== 'all' && month !== 'all') {
            const days = getDaysByMonth(year, month);
            days.forEach(day => {
                const option = document.createElement('option');
                option.value = day;
                option.textContent = parseInt(day); // Remove leading zero for display
                daySelect.appendChild(option);
            });
        }
    };

    // Update quick filter button states
    const updateQuickFilterButtons = (year, month) => {
        const buttons = document.querySelectorAll('.quick-filter-btn');
        buttons.forEach(btn => {
            btn.classList.remove('bg-blue-600', 'border-blue-500', 'text-white', 'active');
            btn.classList.add('bg-gray-800', 'border-gray-700', 'text-gray-300');
        });

        // Determine which button should be active
        const currentYear = new Date().getFullYear().toString();
        const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
        
        if (year === 'all') {
            const allBtn = document.querySelector('[data-filter="all"]');
            if (allBtn) {
                allBtn.classList.remove('bg-gray-800', 'border-gray-700', 'text-gray-300');
                allBtn.classList.add('bg-blue-600', 'border-blue-500', 'text-white', 'active');
            }
        } else if (year === currentYear && month === currentMonth) {
            const thisMonthBtn = document.querySelector('[data-filter="this-month"]');
            if (thisMonthBtn) {
                thisMonthBtn.classList.remove('bg-gray-800', 'border-gray-700', 'text-gray-300');
                thisMonthBtn.classList.add('bg-blue-600', 'border-blue-500', 'text-white', 'active');
            }
        } else if (year === currentYear && month === 'all') {
            const thisYearBtn = document.querySelector('[data-filter="this-year"]');
            if (thisYearBtn) {
                thisYearBtn.classList.remove('bg-gray-800', 'border-gray-700', 'text-gray-300');
                thisYearBtn.classList.add('bg-blue-600', 'border-blue-500', 'text-white', 'active');
            }
        }
    };

    // Get available months for navigation
    const getAvailableMonths = () => {
        return sortedMonthKeys;
    };

    // Update navigation button states
    const updateNavigationButtons = (year, month) => {
        const availableMonths = getAvailableMonths();

        if (year === 'all') {
            return;
        }

        let currentIndex = -1;
        if (month === 'all') {
            // Find first month of the year
            const yearMonths = availableMonths.filter(m => m.startsWith(year + '-'));
            if (yearMonths.length > 0) {
                currentIndex = availableMonths.indexOf(yearMonths[0]);
            }
        } else {
            const currentKey = `${year}-${month}`;
            currentIndex = availableMonths.indexOf(currentKey);
        }
    };

    // Navigate to previous/next period
    const navigatePeriod = (direction) => {
        const route = Router.getCurrentRoute();
        const { year, month } = route;
        
        if (year === 'all') return; // Can't navigate from "all"

        const availableMonths = getAvailableMonths();
        let currentIndex = -1;

        if (month === 'all') {
            // Find first month of the year
            const yearMonths = availableMonths.filter(m => m.startsWith(year + '-'));
            if (yearMonths.length > 0) {
                currentIndex = availableMonths.indexOf(yearMonths[0]);
            }
        } else {
            const currentKey = `${year}-${month}`;
            currentIndex = availableMonths.indexOf(currentKey);
        }

        if (currentIndex === -1) return;

        const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= availableMonths.length) return;

        const [newYear, newMonth] = availableMonths[newIndex].split('-');
        Router.updateRoute({ year: newYear, month: newMonth });
    };

    // Apply quick filter
    const applyQuickFilter = (filter) => {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');

        let year = 'all';
        let month = 'all';

        switch (filter) {
            case 'all':
                year = 'all';
                month = 'all';
                break;
            case 'this-year':
                year = currentYear.toString();
                month = 'all';
                break;
            case 'this-month':
                year = currentYear.toString();
                month = currentMonth;
                break;
        }

        Router.updateRoute({ year, month, day: 'all' });
    };

    // Handle URL hash routing
    const updateFromHash = () => {
        const route = Router.getCurrentRoute();
        const { year, month, day } = route;

        if (yearSelect) yearSelect.value = year;
        updateMonthSelector(year);
        if (monthSelect) monthSelect.value = month;
        updateDaySelector(year, month);
        if (daySelect) daySelect.value = day || 'all';

        updateQuickFilterButtons(year, month);
        updateNavigationButtons(year, month);

        // Recalculate stats and render chart (with caching)
        const cacheKey = `${year}-${month}-${day || 'all'}`;
        let filteredGames = filteredGamesCache.get(cacheKey);
        if (!filteredGames) {
            filteredGames = filterGamesByDateRange(globalGamesByMonth, year, month, day);
            filteredGamesCache.set(cacheKey, filteredGames);
        }
        displayStatsWithChart(filteredGames);

        // Update calendar if it exists (keep showing full year view)
        if (typeof displayCalendar === 'function') {
            const calendarYearSelect = document.getElementById('calendar-year-select');
            const calendarYear = calendarYearSelect ? parseInt(calendarYearSelect.value) : (year !== 'all' ? parseInt(year) : new Date().getFullYear());
            const calendarGames = filterGamesByDateRange(globalGamesByMonth, calendarYear.toString(), 'all', 'all');
            displayCalendar(calendarGames, calendarYear);
        }

        // Update active tab if needed
        if (route.tab && typeof window.switchTab === 'function') {
            window.switchTab(route.tab, false); // false = don't update URL (already in sync)
        }
    };

    // Event listeners
    if (yearSelect) {
        yearSelect.addEventListener('change', () => {
            const year = yearSelect.value;
            updateMonthSelector(year);
            if (monthSelect) monthSelect.value = 'all';
            updateDaySelector(year, 'all');
            if (daySelect) daySelect.value = 'all';
            Router.updateRoute({ year, month: 'all', day: 'all' });
        });
    }

    if (monthSelect) {
        monthSelect.addEventListener('change', () => {
            const year = yearSelect ? yearSelect.value : 'all';
            const month = monthSelect.value;
            updateDaySelector(year, month);
            if (daySelect) daySelect.value = 'all';
            Router.updateRoute({ year, month, day: 'all' });
        });
    }

    if (daySelect) {
        daySelect.addEventListener('change', () => {
            const year = yearSelect ? yearSelect.value : 'all';
            const month = monthSelect ? monthSelect.value : 'all';
            const day = daySelect.value;
            Router.updateRoute({ year, month, day });
        });
    }

    // Date navigation buttons
    const setupDateNavigation = () => {
        const prevBtn = document.getElementById('date-nav-prev');
        const nextBtn = document.getElementById('date-nav-next');
        
        if (!prevBtn || !nextBtn) return;

        const navigateDate = (direction) => {
            const currentYear = yearSelect ? yearSelect.value : 'all';
            const currentMonth = monthSelect ? monthSelect.value : 'all';
            const currentDay = daySelect ? daySelect.value : 'all';

            let newYear = currentYear;
            let newMonth = currentMonth;
            let newDay = currentDay;

            // Get all available dates
            const allYears = Array.from(years).sort();
            const allMonthKeys = sortedMonthKeys;

            if (currentDay !== 'all') {
                // Navigate days
                const days = getDaysByMonth(currentYear, currentMonth);
                const currentDayIndex = days.indexOf(currentDay);
                const currentMonthKey = `${currentYear}-${currentMonth}`;
                const currentMonthKeyIndex = allMonthKeys.indexOf(currentMonthKey);
                
                if (direction === 'prev') {
                    if (currentDayIndex > 0) {
                        newDay = days[currentDayIndex - 1];
                    } else if (currentMonthKeyIndex > 0) {
                        // Move to previous month's last day
                        const prevMonthKey = allMonthKeys[currentMonthKeyIndex - 1];
                        const [prevYear, prevMonth] = prevMonthKey.split('-');
                        const prevDays = getDaysByMonth(prevYear, prevMonth);
                        if (prevDays.length > 0) {
                            newYear = prevYear;
                            newMonth = prevMonth;
                            newDay = prevDays[prevDays.length - 1];
                            updateMonthSelector(newYear);
                            updateDaySelector(newYear, newMonth);
                        }
                    }
                } else {
                    if (currentDayIndex < days.length - 1) {
                        newDay = days[currentDayIndex + 1];
                    } else if (currentMonthKeyIndex < allMonthKeys.length - 1) {
                        // Move to next month's first day
                        const nextMonthKey = allMonthKeys[currentMonthKeyIndex + 1];
                        const [nextYear, nextMonth] = nextMonthKey.split('-');
                        const nextDays = getDaysByMonth(nextYear, nextMonth);
                        if (nextDays.length > 0) {
                            newYear = nextYear;
                            newMonth = nextMonth;
                            newDay = nextDays[0];
                            updateMonthSelector(newYear);
                            updateDaySelector(newYear, newMonth);
                        }
                    }
                }
            } else if (currentMonth !== 'all') {
                // Navigate months
                const currentMonthKey = `${currentYear}-${currentMonth}`;
                const currentMonthIndex = allMonthKeys.indexOf(currentMonthKey);
                
                if (direction === 'prev') {
                    if (currentMonthIndex > 0) {
                        const prevMonthKey = allMonthKeys[currentMonthIndex - 1];
                        const [prevYear, prevMonth] = prevMonthKey.split('-');
                        newYear = prevYear;
                        newMonth = prevMonth;
                        newDay = 'all';
                        updateMonthSelector(newYear);
                        updateDaySelector(newYear, newMonth);
                    }
                } else {
                    if (currentMonthIndex < allMonthKeys.length - 1) {
                        const nextMonthKey = allMonthKeys[currentMonthIndex + 1];
                        const [nextYear, nextMonth] = nextMonthKey.split('-');
                        newYear = nextYear;
                        newMonth = nextMonth;
                        newDay = 'all';
                        updateMonthSelector(newYear);
                        updateDaySelector(newYear, newMonth);
                    }
                }
            } else {
                // Navigate years
                const currentYearIndex = allYears.indexOf(currentYear);
                
                if (direction === 'prev') {
                    if (currentYearIndex > 0) {
                        newYear = allYears[currentYearIndex - 1];
                        newMonth = 'all';
                        newDay = 'all';
                        updateMonthSelector(newYear);
                        updateDaySelector(newYear, 'all');
                    }
                } else {
                    if (currentYearIndex < allYears.length - 1) {
                        newYear = allYears[currentYearIndex + 1];
                        newMonth = 'all';
                        newDay = 'all';
                        updateMonthSelector(newYear);
                        updateDaySelector(newYear, 'all');
                    }
                }
            }

            // Update selectors
            if (yearSelect) yearSelect.value = newYear;
            if (monthSelect) {
                if (newMonth !== currentMonth) {
                    updateMonthSelector(newYear);
                }
                monthSelect.value = newMonth;
            }
            if (daySelect) {
                if (newDay !== currentDay || newMonth !== currentMonth) {
                    updateDaySelector(newYear, newMonth);
                }
                daySelect.value = newDay;
            }

            // Update route
            Router.updateRoute({ year: newYear, month: newMonth, day: newDay });
        };

        prevBtn.addEventListener('click', () => navigateDate('prev'));
        nextBtn.addEventListener('click', () => navigateDate('next'));
    };

    setupDateNavigation();

    // Quick filter buttons
    const quickFilterButtons = document.querySelectorAll('.quick-filter-btn');
    quickFilterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;
            applyQuickFilter(filter);
        });
    });

    // Debounce hash changes to avoid excessive recalculations
    const debouncedUpdateFromHash = typeof window.optimizations !== 'undefined' && window.optimizations.debounce
        ? window.optimizations.debounce(updateFromHash, 100)
        : updateFromHash;

    // Handle hash changes
    window.addEventListener('hashchange', debouncedUpdateFromHash);

    // Initial load from hash
    updateFromHash();
}

function setupMonthlyMetricSelector() {
    const metricSelector = document.getElementById('monthly-metric-selector');
    if (!metricSelector) return;
    
    metricSelector.addEventListener('change', () => {
        const route = Router.getCurrentRoute();
        const { year = 'all', month = 'all', day = 'all' } = route;
        const cacheKey = `${year}-${month}-${day || 'all'}`;
        let filteredGames = window.filteredGamesCache ? window.filteredGamesCache.get(cacheKey) : null;
        
        if (!filteredGames && window.globalGamesByMonth) {
            if (typeof filterGamesByDateRange === 'function') {
                filteredGames = filterGamesByDateRange(window.globalGamesByMonth, year, month, day);
            }
        }
        
        if (filteredGames && typeof calculateStats === 'function' && typeof getPlayerNames === 'function') {
            const stats = calculateStats(filteredGames, window.globalGamesByMonth || {}, getPlayerNames);
            const [player1Name, player2Name] = getPlayerNames(window.globalGamesByMonth || {});
            const metric = metricSelector.value;
            renderMonthlyWinrateChart(stats, player1Name, player2Name, metric);
        }
    });
}

// Initialize
function getLastFetchedTime(gamesByMonth) {
    let mostRecentTime = 0;
    
    // Find the most recent game timestamp
    Object.values(gamesByMonth).forEach(games => {
        games.forEach(game => {
            // Use lastMoveAt if available, otherwise createdAt
            const gameTime = game.lastMoveAt || game.createdAt;
            if (gameTime > mostRecentTime) {
                mostRecentTime = gameTime;
            }
        });
    });
    
    return mostRecentTime;
}

function setupRecentGamesLoader() {
    const loadBtn = document.getElementById('load-recent-games-btn');
    const loadText = document.getElementById('load-recent-games-text');
    const errorEl = document.getElementById('error');
    
    if (!loadBtn) return;
    
    loadBtn.addEventListener('click', async () => {
        if (loadBtn.disabled) return;
        
        // Disable button and show loading state
        loadBtn.disabled = true;
        const originalText = loadText.textContent;
        loadText.textContent = 'Loading...';
        
        // Hide any previous errors
        if (errorEl) {
            errorEl.classList.add('hidden');
        }
        
        try {
            const [player1Name, player2Name] = getPlayerNames(globalGamesByMonth);
            
            // Callback to update UI during retries
            const onRetry = (retryNum, maxRetries, waitTime) => {
                loadText.textContent = `Rate limited. Retrying ${retryNum}/${maxRetries} in ${waitTime/1000}s...`;
            };
            
            const result = await loadRecentGames(globalGamesByMonth, player1Name, player2Name, onRetry);
            
            if (result.success) {
                if (result.newCount > 0) {
                    // Update global games data
                    globalGamesByMonth = result.mergedGames;
                    window.globalGamesByMonth = globalGamesByMonth;
                    
                    // Clear the filtered games cache since we have new data
                    filteredGamesCache.clear();
                    
                    // Update the display with new data
                    const route = Router.getCurrentRoute();
                    const { year, month, day } = route;
                    const filteredGames = filterGamesByDateRange(globalGamesByMonth, year, month, day);
                    displayStatsWithChart(filteredGames);
                    
                    // Update calendar
                    if (typeof displayCalendar === 'function') {
                        const calendarYearSelect = document.getElementById('calendar-year-select');
                        const calendarYear = calendarYearSelect ? parseInt(calendarYearSelect.value) : (year !== 'all' ? parseInt(year) : new Date().getFullYear());
                        const calendarGames = filterGamesByDateRange(globalGamesByMonth, calendarYear.toString(), 'all', 'all');
                        displayCalendar(calendarGames, calendarYear);
                    }
                    
                    // Show success message
                    loadText.textContent = result.message;
                    setTimeout(() => {
                        loadText.textContent = originalText;
                    }, 2000);
                } else {
                    loadText.textContent = result.message || 'No new games';
                    setTimeout(() => {
                        loadText.textContent = originalText;
                    }, 2000);
                }
            } else {
                // Show error
                if (errorEl) {
                    errorEl.textContent = `Error: ${result.error || 'Failed to load recent games'}`;
                    errorEl.classList.remove('hidden');
                }
                loadText.textContent = originalText;
            }
        } catch (error) {
            console.error('Error loading recent games:', error);
            if (errorEl) {
                errorEl.textContent = `Error: ${error.message || 'Failed to load recent games'}`;
                errorEl.classList.remove('hidden');
            }
            loadText.textContent = originalText;
        } finally {
            loadBtn.disabled = false;
        }
    });
}

function displayLastFetchedTime(gamesByMonth) {
    const lastFetchedEl = document.getElementById('last-fetched-time');
    if (!lastFetchedEl) return;
    
    const lastFetchedTime = getLastFetchedTime(gamesByMonth);
    if (lastFetchedTime === 0) {
        lastFetchedEl.textContent = '';
        return;
    }
    
    const date = new Date(lastFetchedTime);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    let timeAgo = '';
    if (diffMinutes < 60) {
        timeAgo = `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
        timeAgo = `${diffHours}h ago`;
    } else if (diffDays < 7) {
        timeAgo = `${diffDays}d ago`;
    } else {
        // Use formatDate24h from utils.js if available, otherwise format manually
        if (typeof formatDate24h === 'function') {
            timeAgo = formatDate24h(date, true);
        } else {
            timeAgo = date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }
    
    lastFetchedEl.textContent = `Last updated: ${timeAgo}`;
    // Set full date/time as tooltip
    if (typeof formatDate24h === 'function') {
        lastFetchedEl.title = formatDate24h(date, true);
    } else {
        lastFetchedEl.title = date.toLocaleString('en-US', { 
            month: 'short', 
            day: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

async function init() {
    try {
        globalGamesByMonth = await loadAllGames();
        window.globalGamesByMonth = globalGamesByMonth; // Expose for calendar
        globalPlayerNames = getPlayerNames(globalGamesByMonth);

        setupDateRangeSelectors();
        displayLastFetchedTime(globalGamesByMonth);
        setupRecentGamesLoader();
        
        // Start memory cleanup
        if (typeof window !== 'undefined' && window.optimizations && window.optimizations.startMemoryCleanup) {
            window.optimizations.startMemoryCleanup();
        }
        
        // Initialize calendar after a short delay to ensure DOM is ready
        setTimeout(() => {
            if (typeof initializeCalendar === 'function') {
                initializeCalendar(globalGamesByMonth);
            }
            // Setup games table sorting
            if (typeof setupGamesTableSorting === 'function') {
                setupGamesTableSorting();
            }
            // Setup openings table sorting
            if (typeof setupOpeningsTableSorting === 'function') {
                setupOpeningsTableSorting();
            }
            // Setup sessions table sorting
            if (typeof setupSessionsTableSorting === 'function') {
                setupSessionsTableSorting();
            }
            // Setup monthly metric selector
            setupMonthlyMetricSelector();
        }, 200);
    } catch (error) {
        console.error('Error loading games:', error);
        const errorEl = document.getElementById('error');
        const loadingEl = document.getElementById('loading');
        if (errorEl) {
            errorEl.textContent = `Error loading game data: ${error.message}`;
            errorEl.classList.remove('hidden');
        }
        if (loadingEl) {
            loadingEl.classList.add('hidden');
        }
    }
}

init();
