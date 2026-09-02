#!/usr/bin/env bash
set -euo pipefail

widget_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
helper_dir="${HOME}/.local/lib/chess-duel-widget"
unit_dir="${HOME}/.config/systemd/user"

install -d -m 755 "$helper_dir" "$helper_dir/test" "$unit_dir"
install -m 755 "$widget_dir/helper/server.js" "$helper_dir/server.js"
install -m 644 "$widget_dir/helper/core.js" "$helper_dir/core.js"
install -m 644 "$widget_dir/systemd/chess-duel-widget.service" "$unit_dir/chess-duel-widget.service"

kpackagetool6 --type Plasma/Applet --upgrade "$widget_dir/package" 2>/dev/null || \
  kpackagetool6 --type Plasma/Applet --install "$widget_dir/package"
systemctl --user daemon-reload
systemctl --user enable --now chess-duel-widget.service

echo "Chess Duel installed. Add it from Plasma's widget picker."
