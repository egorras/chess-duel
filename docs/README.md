# Chess Duel Dashboard

A GitHub Pages website displaying chess game statistics from Lichess for two players.

## Features

- 📊 Comprehensive statistics dashboard
- 📅 Activity calendar
- 📈 Win rate tracking and trends
- 🎯 Opening analysis
- 📱 Mobile-friendly design
- 🔄 Automatic game fetching via GitHub Actions

## Setup

### GitHub Configuration

**Secrets** (Settings > Secrets and variables > Actions > Secrets):
- `LICHESS_API_KEY`: Your Lichess API token from https://lichess.org/account/oauth/token

**Variables** (Settings > Secrets and variables > Actions > Variables):
- `PLAYER1_USERNAME`: First player's Lichess username
- `PLAYER2_USERNAME`: Second player's Lichess username

### GitHub Pages

1. Go to Settings > Pages
2. Select "Deploy from a branch"
3. Choose branch: `main` and folder: `/docs`
4. Site available at `https://username.github.io/repository-name/`

## How It Works

A GitHub Action runs every hour to:
- Fetch head-to-head games between the two players from Lichess API
- Organize games by month (`YYYY-MM.json` in `data/games/`)
- Only fetch new games since the last stored month

## Running Locally

1. Navigate to the docs folder:
   ```bash
   cd docs
   ```

2. Start a local web server:
   ```bash
   python -m http.server 8000
   ```

3. Open `http://localhost:8000` in your browser

4. To fetch game data manually (from repository root):
   ```bash
   export LICHESS_API_KEY="your_api_key_here"
   node scripts/fetch-games.js player1 player2
   ```
