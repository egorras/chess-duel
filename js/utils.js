// Utility functions for chess-duel application

/**
 * Counts king moves from a PGN moves string
 * @param {string} movesString - PGN moves string
 * @returns {{white: number, black: number}} - Count of king moves for each player
 */
function countKingMoves(movesString) {
    if (!movesString) return { white: 0, black: 0 };
    
    const moves = movesString.split(' ').filter(m => m.length > 0);
    let whiteKingMoves = 0;
    let blackKingMoves = 0;
    
    moves.forEach((move, index) => {
        // Castling moves (O-O or O-O-O) are king moves
        if (move === 'O-O' || move === 'O-O-O') {
            if (index % 2 === 0) {
                whiteKingMoves++;
            } else {
                blackKingMoves++;
            }
        }
        // Regular king moves start with 'K'
        else if (move.startsWith('K')) {
            if (index % 2 === 0) {
                whiteKingMoves++;
            } else {
                blackKingMoves++;
            }
        }
    });
    
    return { white: whiteKingMoves, black: blackKingMoves };
}

/**
 * Formats a date in 24-hour format
 * @param {Date} date - Date object to format
 * @param {boolean} includeYear - Whether to include the year
 * @returns {string} - Formatted date string
 */
function formatDate24h(date, includeYear = false) {
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const year = includeYear ? ` ${date.getFullYear()}` : '';
    return `${month} ${day}${year}, ${hours}:${minutes}`;
}

/**
 * Gets termination icon, label, and color for a game status
 * @param {string} status - Game termination status
 * @returns {{icon: string, label: string, color: string}} - Termination info
 */
function getTerminationIcon(status) {
    const terminationMap = {
        'mate': { icon: '♛', label: 'Checkmate', color: 'text-gray-400' },
        'resign': { icon: '✋', label: 'Resignation', color: 'text-gray-400' },
        'timeout': { icon: '⏱', label: 'Timeout', color: 'text-gray-400' },
        'outoftime': { icon: '⏰', label: 'Out of Time', color: 'text-gray-400' },
        'draw': { icon: '🤝', label: 'Draw Agreement', color: 'text-gray-400' },
        'stalemate': { icon: '⚖', label: 'Stalemate', color: 'text-gray-400' },
        'unknown': { icon: '?', label: 'Unknown', color: 'text-gray-400' }
    };
    
    return terminationMap[status] || terminationMap['unknown'];
}

/**
 * Determines player colors based on who is playing white
 * Player 1 = red, Player 2 = blue
 * @param {boolean} isPlayer1White - Whether player 1 is playing white
 * @returns {{whiteColor: string, blackColor: string}} - CSS color classes
 */
function getPlayerColors(isPlayer1White) {
    return {
        whiteColor: isPlayer1White ? 'text-red-400' : 'text-blue-400',
        blackColor: isPlayer1White ? 'text-blue-400' : 'text-red-400'
    };
}

/**
 * Gets result text and CSS class for a game
 * @param {string} winner - Game winner ('white', 'black', or 'draw')
 * @param {string} whiteColor - CSS class for white player color
 * @param {string} blackColor - CSS class for black player color
 * @returns {{text: string, class: string}} - Result text and CSS class
 */
function getGameResult(winner, whiteColor, blackColor) {
    if (winner === 'white') {
        return { text: '1-0', class: whiteColor };
    } else if (winner === 'black') {
        return { text: '0-1', class: blackColor };
    } else {
        return { text: '½-½', class: 'text-gray-400' };
    }
}

/**
 * Formats opening name for chess.com URL
 * @param {string} openingName - Full opening name
 * @returns {string} - URL-friendly opening name
 */
function formatOpeningUrl(openingName) {
    if (openingName === 'Unknown') return '';
    return openingName
        .replace(/[':,\.]/g, '')
        .replace(/\s+/g, '-')
        .replace(/--+/g, '-');
}

/**
 * Truncates opening name if too long
 * @param {string} openingName - Full opening name
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} - Truncated opening name
 */
function truncateOpeningName(openingName, maxLength = 50) {
    return openingName.length > maxLength ? openingName.substring(0, maxLength) + '...' : openingName;
}

/**
 * Calculates game duration in minutes, using clock data when available
 * @param {Object} game - Game object with createdAt, lastMoveAt, clock, clocks, speed, moves
 * @returns {number} - Duration in minutes
 */
function calculateGameDuration(game) {
    if (!game.createdAt || !game.lastMoveAt) return 0;
    
    const durationMs = game.lastMoveAt - game.createdAt;
    let durationMinutes = Math.round(durationMs / (1000 * 60));
    
    // Use clock data if available for more accurate estimate
    if (game.clock && game.clocks && game.clocks.length > 0) {
        const initialTime = game.clock.initial || 300; // seconds
        const lastClock = game.clocks[game.clocks.length - 1] / 1000; // convert ms to seconds
        const timeUsed = initialTime - lastClock;
        const moveCount = game.moves ? game.moves.split(' ').length : 0;
        const estimatedMinutes = Math.round((timeUsed + (moveCount * 2)) / 60);
        
        // Use clock-based estimate if it's more reasonable (less than 2 hours)
        if (estimatedMinutes < 120 && estimatedMinutes > 0) {
            durationMinutes = estimatedMinutes;
        }
    }
    
    // Cap at 2 hours for blitz/rapid games (likely data issue if longer)
    if (game.speed === 'blitz' || game.speed === 'rapid') {
        durationMinutes = Math.min(durationMinutes, 120);
    }
    
    return durationMinutes;
}

/**
 * Formats game duration as a string
 * @param {number} durationMinutes - Duration in minutes
 * @returns {string} - Formatted duration (e.g., "45m" or "1h 30m")
 */
function formatGameDuration(durationMinutes) {
    if (durationMinutes < 60) {
        return `${durationMinutes}m`;
    } else {
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
}

/**
 * Renders a game row HTML with all columns (like the main games table)
 * @param {Object} game - Game object
 * @param {string} player1Name - Player 1 name
 * @param {boolean} showYear - Whether to include year in date
 * @param {Object} options - Options for rendering (showIndex, showDate, showOpening, showTermination, showTime, showKingMoves)
 * @returns {string} - HTML string for the game row
 */
function renderGameRow(game, player1Name, showYear = false, options = {}) {
    const {
        showIndex = false,
        showDate = true,
        showOpening = true,
        showTermination = true,
        showTime = false,
        showKingMoves = true,
        mobile = false // If true, hide less important columns on mobile
    } = options;
    
    const whitePlayer = game.players.white.user.name;
    const blackPlayer = game.players.black.user.name;
    const isPlayer1White = whitePlayer === player1Name;
    const { whiteColor, blackColor } = getPlayerColors(isPlayer1White);
    
    const whiteAcc = game.players.white.analysis?.accuracy || '-';
    const blackAcc = game.players.black.analysis?.accuracy || '-';
    
    const moveCount = game.moves ? game.moves.split(' ').length : 0;
    const kingMoves = countKingMoves(game.moves);
    
    const { text: resultText, class: resultClass } = getGameResult(game.winner, whiteColor, blackColor);
    
    let rowHTML = '<tr class="hover:bg-gray-800">';
    
    // Index column (optional, for nested tables)
    if (showIndex) {
        rowHTML += `<td class="px-2 py-2 text-gray-500">${options.index || ''}</td>`;
    }
    
    // Date column
    if (showDate) {
        const gameDate = new Date(game.createdAt);
        const dateStr = formatDate24h(gameDate, showYear);
        rowHTML += `<td class="px-2 py-2 text-gray-500">${dateStr}</td>`;
    }
    
    // White player
    rowHTML += `<td class="px-2 py-2 text-center ${whiteColor}">${whitePlayer}</td>`;
    
    // Result
    rowHTML += `<td class="px-2 py-2 text-center font-bold ${resultClass}">${resultText}</td>`;
    
    // Black player
    rowHTML += `<td class="px-2 py-2 text-center ${blackColor}">${blackPlayer}</td>`;
    
    // Opening (optional) - hide on mobile
    if (showOpening) {
        const openingName = game.opening?.name || 'Unknown';
        const openingShort = truncateOpeningName(openingName);
        const openingUrl = formatOpeningUrl(openingName);
        const openingCell = openingUrl && openingName !== 'Unknown'
            ? `<a href="https://www.chess.com/openings/${openingUrl}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-gray-200 hover:text-gray-300 hover:underline"
                  title="${openingName}">${openingShort}</a>`
            : `<span title="${openingName}">${openingShort}</span>`;
        rowHTML += `<td class="px-2 py-2 hidden sm:table-cell">${openingCell}</td>`;
    }
    
    // Termination type (optional) - hide on mobile
    if (showTermination) {
        const termination = getTerminationIcon(game.status || 'unknown');
        rowHTML += `<td class="px-2 py-2 text-center hidden sm:table-cell" title="${termination.label}">
            <span class="${termination.color}" style="font-size: 1em; filter: grayscale(100%);">${termination.icon}</span>
        </td>`;
    }
    
    // Moves
    rowHTML += `<td class="px-2 py-2 text-center text-gray-400">${moveCount}</td>`;
    
    // Time (optional)
    if (showTime) {
        const durationMinutes = calculateGameDuration(game);
        const timeStr = durationMinutes > 0 ? formatGameDuration(durationMinutes) : '-';
        rowHTML += `<td class="px-2 py-2 text-center text-gray-400 hidden sm:table-cell">${timeStr}</td>`;
    }
    
    // White accuracy - hide on mobile
    rowHTML += `<td class="px-2 py-2 text-center hidden sm:table-cell ${whiteAcc !== '-' && whiteAcc >= 80 ? 'text-green-400' : 'text-gray-400'}">${whiteAcc !== '-' ? whiteAcc + '%' : '-'}</td>`;
    
    // Black accuracy - hide on mobile
    rowHTML += `<td class="px-2 py-2 text-center hidden sm:table-cell ${blackAcc !== '-' && blackAcc >= 80 ? 'text-green-400' : 'text-gray-400'}">${blackAcc !== '-' ? blackAcc + '%' : '-'}</td>`;
    
    // King moves (optional) - hide on mobile
    if (showKingMoves) {
        rowHTML += `<td class="px-2 py-2 text-center hidden sm:table-cell ${whiteColor}">${kingMoves.white}</td>`;
        rowHTML += `<td class="px-2 py-2 text-center hidden sm:table-cell ${blackColor}">${kingMoves.black}</td>`;
    }
    
    // Link
    rowHTML += `<td class="px-2 py-2 text-center">
        <a href="https://lichess.org/${game.id}" target="_blank" rel="noopener noreferrer" class="text-gray-300 hover:underline">View</a>
    </td>`;
    
    rowHTML += '</tr>';
    return rowHTML;
}

/**
 * Renders game table header HTML
 * @param {Object} options - Options for rendering (showIndex, showDate, showOpening, showTermination, showTime, showKingMoves)
 * @returns {string} - HTML string for the table header
 */
function renderGameTableHeader(options = {}) {
    const {
        showIndex = false,
        showDate = true,
        showOpening = true,
        showTermination = true,
        showTime = false,
        showKingMoves = true
    } = options;
    
    let headerHTML = '<tr class="border-b border-gray-700 text-gray-400">';
    
    if (showIndex) {
        headerHTML += '<th class="px-2 py-2 text-left">#</th>';
    }
    
    if (showDate) {
        headerHTML += '<th class="px-2 py-2 text-left">Date</th>';
    }
    
    headerHTML += `
        <th class="px-2 py-2 text-center">White</th>
        <th class="px-2 py-2 text-center">Result</th>
        <th class="px-2 py-2 text-center">Black</th>
    `;
    
    if (showOpening) {
        headerHTML += '<th class="px-2 py-2 text-left hidden sm:table-cell">Opening</th>';
    }
    
    if (showTermination) {
        headerHTML += '<th class="px-2 py-2 text-center hidden sm:table-cell">Type</th>';
    }
    
    headerHTML += '<th class="px-2 py-2 text-center">Moves</th>';
    
    if (showTime) {
        headerHTML += '<th class="px-2 py-2 text-center hidden sm:table-cell">Time</th>';
    }
    
    headerHTML += `
        <th class="px-2 py-2 text-center hidden sm:table-cell">W Acc</th>
        <th class="px-2 py-2 text-center hidden sm:table-cell">B Acc</th>
    `;
    
    if (showKingMoves) {
        headerHTML += `
            <th class="px-2 py-2 text-center hidden sm:table-cell">W K</th>
            <th class="px-2 py-2 text-center hidden sm:table-cell">B K</th>
        `;
    }
    
    headerHTML += '<th class="px-2 py-2 text-center">Link</th>';
    headerHTML += '</tr>';
    
    return headerHTML;
}
