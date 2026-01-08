// Global state
let globalGamesByMonth = {};
let globalPlayerNames = [];

function displayStatsWithChart(gamesByMonth) {
    const stats = calculateStats(gamesByMonth, globalGamesByMonth, getPlayerNames);
    displayStats(stats);

    // Render the points chart and opening stats
    if (stats && Object.keys(gamesByMonth).length > 0) {
        const [player1Name, player2Name] = getPlayerNames(globalGamesByMonth);
        renderPointsChart(gamesByMonth, player1Name, player2Name);
        displayOpeningStats(gamesByMonth, player1Name, player2Name);
    }
}

function setupDateRangeSelectors() {
    // Get all unique years and months from game data
    const years = new Set();
    const monthsByYear = {};

    Object.keys(globalGamesByMonth).forEach(monthKey => {
        const [year, month] = monthKey.split('-');
        years.add(year);
        if (!monthsByYear[year]) {
            monthsByYear[year] = new Set();
        }
        monthsByYear[year].add(month);
    });

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

    // Update month selector when year changes
    const monthSelect = document.getElementById('month-select');
    const updateMonthSelector = (year) => {
        if (!monthSelect) return;
        monthSelect.innerHTML = '<option value="all">All Months</option>';

        if (year !== 'all' && monthsByYear[year]) {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            Array.from(monthsByYear[year]).sort().forEach(month => {
                const option = document.createElement('option');
                option.value = month;
                option.textContent = monthNames[parseInt(month) - 1];
                monthSelect.appendChild(option);
            });
        }
    };

    // Handle URL hash routing
    const updateFromHash = () => {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const year = params.get('year') || 'all';
        const month = params.get('month') || 'all';

        if (yearSelect) yearSelect.value = year;
        updateMonthSelector(year);
        if (monthSelect) monthSelect.value = month;

        // Recalculate stats and render chart
        const filteredGames = filterGamesByDateRange(globalGamesByMonth, year, month);
        displayStatsWithChart(filteredGames);
    };

    // Event listeners
    if (yearSelect) {
        yearSelect.addEventListener('change', () => {
            const year = yearSelect.value;
            updateMonthSelector(year);
            if (monthSelect) monthSelect.value = 'all';
            const hash = year === 'all' ? '' : `year=${year}&month=all`;
            window.location.hash = hash;
        });
    }

    if (monthSelect) {
        monthSelect.addEventListener('change', () => {
            const year = yearSelect ? yearSelect.value : 'all';
            const month = monthSelect.value;
            const hash = year === 'all' ? '' : `year=${year}&month=${month}`;
            window.location.hash = hash;
        });
    }

    // Handle hash changes
    window.addEventListener('hashchange', updateFromHash);

    // Initial load from hash
    updateFromHash();
}

// Initialize
async function init() {
    try {
        globalGamesByMonth = await loadAllGames();
        globalPlayerNames = getPlayerNames(globalGamesByMonth);

        setupDateRangeSelectors();
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
