# chess-duel

A GitHub Pages website to display chess game statistics from Lichess.

## Setup

### 1. Configure GitHub Secrets and Variables

You need to set up the following in your repository settings:

**Secrets** (Settings > Secrets and variables > Actions > Secrets):
- `LICHESS_API_KEY`: Your Lichess API token (get one from https://lichess.org/account/oauth/token)

**Variables** (Settings > Secrets and variables > Actions > Variables):
- `PLAYER1_USERNAME`: First player's Lichess username
- `PLAYER2_USERNAME`: Second player's Lichess username

### 2. How It Works

The GitHub Action `fetch-games.yml` runs daily at 2 AM UTC to:
1. Fetch head-to-head games between the two players from Lichess API
2. Use the `since` parameter to only fetch games for specific months (efficient incremental updates)
3. Organize games by month (format: `YYYY-MM.json`)
4. Merge with existing data to avoid duplicates
5. Commit changes to the `data/games/` directory

**Optimization features:**
- Only fetches games month-by-month using `since` and `until` parameters
- On first run, fetches all games since January 2024
- On subsequent runs, only updates from the last stored month to present
- Rate limiting (100ms delay between month requests)

### 3. Manual Trigger

You can manually trigger the game fetch:
1. Go to Actions tab in GitHub
2. Select "Fetch Chess Games" workflow
3. Click "Run workflow"

### 4. Data Structure

Games are stored in `data/games/` with the following structure:
- Filename: `YYYY-MM.json` (e.g., `2024-01.json`, `2025-12.json`)
- Each file contains an array of games between the two players in that month
- Games include full data: moves, clocks, accuracy, division points
- Games are sorted by creation date
- Duplicates are automatically handled by merging based on game ID

### 5. Local Testing

To test the fetch script locally:

```bash
export LICHESS_API_KEY="your_api_key_here"
node scripts/fetch-games.js player1 player2
```

### 6. API Parameters Used

The script fetches games with these Lichess API parameters:
- `rated=false` - Include both rated and unrated games
- `since` & `until` - Fetch specific month ranges (timestamps in milliseconds)
- `vs` - Filter games between two specific players
- `accuracy=true` - Include accuracy percentage
- `clocks=true` - Include clock states
- `division=true` - Include middlegame/endgame division
- `moves=true` - Include PGN moves
- `sort=dateAsc` - Sort by date ascending