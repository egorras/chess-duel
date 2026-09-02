# Chess Duel Plasma Widget

A Plasma 6 companion for a recurring Lichess duel. It shows the current
calendar month's score, opens or creates a casual challenge on demand,
and links to the full Chess Duel dashboard.

## Install locally

```bash
./install.sh
```

Then add **Chess Duel** from Plasma's widget picker. The installer installs only
for the current user and starts the helper as a user service.

On first opening the widget, choose **Sign in with Lichess**. Lichess grants only
`challenge:read` and `challenge:write`. The access token is stored in KDE Wallet.
After signing in, select from up to 10 recurring opponents found in the latest
20 games, or type a Lichess username manually.

The **Challenge** button first checks for a matching incoming challenge using
the configured time control. If one
exists it accepts and opens it; otherwise it reopens a matching outgoing
challenge or creates a new one. The monthly score is loaded only when the
refresh button is pressed, or on the interval set by **Auto-refresh score**
in the widget's settings (off by default); opening or reloading Plasma alone
makes no score request.

## Development

```bash
npm test
./install.sh
```

The helper listens only on `127.0.0.1:47831`. Plasma talks to its small local
HTTP API; the helper owns OAuth and KDE Wallet access. Challenge lookup is
always user-initiated. Score refresh is user-initiated by default too, unless
an auto-refresh interval is set in the widget's settings.
