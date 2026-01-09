// Calendar view component - GitHub-style activity calendar

function getGamesByDay(gamesByMonth) {
    const gamesByDay = {};
    
    Object.values(gamesByMonth).forEach(games => {
        games.forEach(game => {
            const date = new Date(game.createdAt);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dayKey = `${year}-${month}-${day}`;
            
            if (!gamesByDay[dayKey]) {
                gamesByDay[dayKey] = [];
            }
            gamesByDay[dayKey].push(game);
        });
    });
    
    return gamesByDay;
}

function getIntensityLevel(count, maxCount) {
    if (count === 0) return 0;
    if (maxCount === 0) return 0;
    
    const ratio = count / maxCount;
    if (ratio >= 0.8) return 5;
    if (ratio >= 0.6) return 4;
    if (ratio >= 0.4) return 3;
    if (ratio >= 0.2) return 2;
    return 1;
}

function getDayColor(intensity) {
    switch (intensity) {
        case 0: return 'bg-gray-700 border-gray-600';
        case 1: return 'bg-green-900 border-gray-600';
        case 2: return 'bg-green-700 border-gray-600';
        case 3: return 'bg-green-500 border-gray-600';
        case 4: return 'bg-green-400 border-gray-600';
        case 5: return 'bg-green-300 border-gray-600';
        default: return 'bg-gray-700 border-gray-600';
    }
}

function getDayOfWeek(date) {
    const day = date.getDay();
    return day === 0 ? 6 : day - 1; // Monday = 0, Sunday = 6
}

function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
}

function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function displayCalendar(gamesByMonth, selectedYear) {
    const container = document.getElementById('calendar-container');
    if (!container) return;

    const gamesByDay = getGamesByDay(gamesByMonth);
    
    // Find max games per day for intensity calculation
    const maxGames = Math.max(...Object.values(gamesByDay).map(games => games.length), 1);
    
    // Get all months for the selected year
    const year = selectedYear || new Date().getFullYear();
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Build array of all days in the year
    const allDays = [];
    for (let month = 1; month <= 12; month++) {
        const daysInMonth = getDaysInMonth(year, month);
        for (let day = 1; day <= daysInMonth; day++) {
            const dayKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const date = new Date(year, month - 1, day);
            const dayOfWeek = getDayOfWeek(date);
            const monthKey = `${year}-${String(month).padStart(2, '0')}`;
            
            allDays.push({
                dayKey,
                monthKey,
                day,
                month,
                dayOfWeek,
                date
            });
        }
    }
    
    // Group days by week (starting from first Monday of the year or before)
    const firstDay = new Date(year, 0, 1);
    const firstDayOfWeek = getDayOfWeek(firstDay);
    const weeks = [];
    let currentWeek = [];
    
    // Add empty cells for days before the first day of the year
    for (let i = 0; i < firstDayOfWeek; i++) {
        currentWeek.push(null);
    }
    
    allDays.forEach(dayInfo => {
        currentWeek.push(dayInfo);
        if (currentWeek.length === 7) {
            weeks.push([...currentWeek]);
            currentWeek = [];
        }
    });
    
    // Add remaining days to last week
    if (currentWeek.length > 0) {
        while (currentWeek.length < 7) {
            currentWeek.push(null);
        }
        weeks.push(currentWeek);
    }
    
    // GitHub-style: Rows are days of week (Mon-Sun), Columns are weeks
    let calendarHTML = `
        <div class="overflow-x-auto">
            <table class="border-collapse" style="border-spacing: 0;">
                <thead>
                    <tr class="leading-none">
                        <th class="text-xs text-gray-500 font-normal py-1 px-2 text-right pr-2"></th>
    `;
    
    // Add week column headers with month labels (clickable)
    // Track which months we've seen to show labels at the start of each month
    const monthsSeen = new Set();
    
    // Ensure we have the same number of header cells as weeks
    for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
        const week = weeks[weekIndex];
        // Find all non-null days in this week
        const daysInWeek = week.filter(d => d !== null);
        const firstDayInWeek = daysInWeek[0];
        
        let monthLabel = '';
        let monthKey = '';
        
        if (firstDayInWeek) {
            // Check if this week contains the 1st of a month
            const firstOfMonth = daysInWeek.find(d => d.day === 1);
            
            if (firstOfMonth) {
                // Week contains the 1st of a month - show that month's label
                monthLabel = monthNames[firstOfMonth.month - 1];
                monthKey = firstOfMonth.monthKey;
                monthsSeen.add(firstOfMonth.month);
            } else if (!monthsSeen.has(firstDayInWeek.month)) {
                // This is the first week with days from a new month (but doesn't contain the 1st)
                // Show label for the first time we see this month
                monthLabel = monthNames[firstDayInWeek.month - 1];
                monthKey = firstDayInWeek.monthKey;
                monthsSeen.add(firstDayInWeek.month);
            }
        }
        
        if (monthLabel) {
            calendarHTML += `<th class="text-xs text-gray-500 font-normal py-1 px-0.5 text-center min-w-[11px] cursor-pointer hover:text-gray-300 transition-colors" data-month="${monthKey}" title="Click to filter to ${monthLabel}">${monthLabel}</th>`;
        } else {
            calendarHTML += `<th class="text-xs text-gray-500 font-normal py-1 px-0.5 text-center min-w-[11px]"></th>`;
        }
    }
    
    calendarHTML += `
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Create rows for each day of week (Mon=0, Sun=6)
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (let dow = 0; dow < 7; dow++) {
        calendarHTML += `<tr class="leading-none">`;
        calendarHTML += `<td class="text-xs text-gray-500 font-normal py-0.5 px-2 text-right pr-2">${dayLabels[dow]}</td>`;
        
        // Add cells for each week (column) - ensure same number as header
        for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
            const week = weeks[weekIndex];
            const dayInfo = week[dow];
            calendarHTML += '<td class="p-0">';
            
            if (dayInfo) {
                const dayGames = gamesByDay[dayInfo.dayKey] || [];
                const gameCount = dayGames.length;
                const intensity = getIntensityLevel(gameCount, maxGames);
                const colorClass = getDayColor(intensity);
                
                const tooltip = gameCount > 0 
                    ? `${gameCount} game${gameCount !== 1 ? 's' : ''} on ${formatDate(dayInfo.dayKey)}`
                    : `No games on ${formatDate(dayInfo.dayKey)}`;
                
                calendarHTML += `
                    <div class="relative group">
                        <div 
                            class="w-2.5 h-2.5 ${colorClass} rounded-sm cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                            data-day="${dayInfo.dayKey}"
                            data-month="${dayInfo.monthKey}"
                            data-year="${year}"
                            title="${tooltip}"
                        ></div>
                        <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 border border-gray-600">
                            ${tooltip}
                        </div>
                    </div>
                `;
            } else {
                calendarHTML += '<div class="w-2.5 h-2.5"></div>';
            }
            
            calendarHTML += '</td>';
        }
        
        calendarHTML += '</tr>';
    }
    
    calendarHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = calendarHTML;
    
    // Add click handlers for days
    container.querySelectorAll('[data-day]').forEach(cell => {
        cell.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling
            const dayKey = cell.dataset.day;
            const [year, month, day] = dayKey.split('-');
            Router.updateRoute({ year, month, day });
        });
    });
    
    // Add click handlers for month labels (only on header cells, not day cells)
    container.querySelectorAll('th[data-month]').forEach(cell => {
        cell.addEventListener('click', (e) => {
            e.stopPropagation();
            const monthKey = cell.dataset.month;
            const [year, month] = monthKey.split('-');
            Router.updateRoute({ year, month, day: 'all' });
        });
    });
}

function setupCalendarYearSelector(gamesByMonth) {
    const yearSelect = document.getElementById('calendar-year-select');
    if (!yearSelect) return;
    
    // Get all available years
    const years = new Set();
    Object.keys(gamesByMonth).forEach(monthKey => {
        const [year] = monthKey.split('-');
        years.add(parseInt(year));
    });
    
    yearSelect.innerHTML = '';
    Array.from(years).sort().reverse().forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });
    
    // Set current year as default
    const currentYear = new Date().getFullYear();
    if (years.has(currentYear)) {
        yearSelect.value = currentYear;
    } else {
        yearSelect.value = Math.max(...Array.from(years));
    }
    
    // Update calendar when year changes
    yearSelect.addEventListener('change', () => {
        const selectedYear = parseInt(yearSelect.value);
        const filteredGames = filterGamesByDateRange(gamesByMonth, selectedYear.toString(), 'all');
        displayCalendar(filteredGames, selectedYear);
    });
}

function initializeCalendar(gamesByMonth) {
    setupCalendarYearSelector(gamesByMonth);
    const yearSelect = document.getElementById('calendar-year-select');
    const selectedYear = yearSelect ? parseInt(yearSelect.value) : new Date().getFullYear();
    const filteredGames = filterGamesByDateRange(gamesByMonth, selectedYear.toString(), 'all');
    displayCalendar(filteredGames, selectedYear);
}
