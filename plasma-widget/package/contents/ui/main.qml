import QtQuick
import QtQuick.Layouts
import QtQuick.Controls as QQC2
import org.kde.kirigami as Kirigami
import org.kde.plasma.plasmoid
import org.kde.plasma.components as PlasmaComponents

PlasmoidItem {
    id: root
    property string apiBase: "http://127.0.0.1:47831"
    property var service: ({ authenticated: false, ready: false })
    property var summary: null
    property string errorText: ""
    property bool busy: false
    property bool summaryLoading: false
    property bool confirmArmed: false
    property double refreshedAt: 0
    property double clockNow: Date.now()

    Plasmoid.icon: "knights"
    toolTipMainText: "Chess Duel"
    toolTipSubText: summary ? summary.account + " " + points(summary.myPoints) + " – " + points(summary.opponentPoints) + " " + summary.opponent : "Open to set up"
    preferredRepresentation: fullRepresentation

    function points(value) { return Number.isInteger(value) ? String(value) : String(value).replace(".5", "½") }
    function refreshedAgo() {
        if (!refreshedAt) return "Not refreshed"
        var seconds = Math.max(0, Math.floor((clockNow - refreshedAt) / 1000))
        if (seconds < 10) return "just now"
        if (seconds < 60) return seconds + "s ago"
        var minutes = Math.floor(seconds / 60)
        if (minutes < 60) return minutes + "m ago"
        var hours = Math.floor(minutes / 60)
        return hours + "h ago"
    }
    function call(method, path, body, done, failed) {
        var xhr = new XMLHttpRequest()
        xhr.open(method, apiBase + path)
        xhr.setRequestHeader("X-Chess-Duel-Client", "plasma-widget")
        xhr.setRequestHeader("Content-Type", "application/json")
        xhr.onreadystatechange = function() {
            if (xhr.readyState !== XMLHttpRequest.DONE) return
            var value = {}
            try { value = JSON.parse(xhr.responseText || "{}") } catch (e) {}
            if (xhr.status >= 200 && xhr.status < 300) {
                errorText = ""
                if (done) done(value)
            } else {
                errorText = value.error || "Chess Duel helper is not running"
                if (failed) failed(value)
            }
        }
        xhr.send(body ? JSON.stringify(body) : "")
    }
    function refresh() {
        call("GET", "/status", null, function(value) {
            service = value
        })
    }
    function refreshScore() {
        if (summaryLoading) return
        summaryLoading = true
        busy = true
        call("GET", "/summary", null, function(score) {
            summary = score
            refreshedAt = Date.now()
            clockNow = refreshedAt
            summaryLoading = false
            busy = false
        }, function() {
            summaryLoading = false
            busy = false
        })
    }
    function syncSettings() {
        call("POST", "/settings", {
            opponent: plasmoid.configuration.opponent || "",
            statsUrl: plasmoid.configuration.statsUrl || "https://egorras.github.io/chess-duel/",
            timeControl: plasmoid.configuration.timeControl || "5+0"
        }, function() {
            summary = null
            refresh()
        })
    }
    function openSettings() {
        var action = plasmoid.internalAction("configure")
        if (action) action.trigger()
    }
    function timeControl() { return plasmoid.configuration.timeControl || "5+0" }
    function challenge() {
        if (plasmoid.configuration.confirmChallenge !== false && !confirmArmed) {
            confirmArmed = true
            confirmTimer.restart()
            return
        }
        confirmArmed = false
        playNow()
    }
    function playNow() {
        busy = true
        call("POST", "/play", null, function(result) {
            busy = false
            Qt.openUrlExternally(result.url)
        }, function() { busy = false })
    }
    Component.onCompleted: {
        call("GET", "/status", null, function(value) {
            service = value
            // Only push settings if this instance has its own opponent
            // configured, or the helper has none yet. Otherwise an
            // unconfigured second instance (or one that hasn't finished
            // loading its saved config) would blank out an opponent
            // already set through another instance.
            if ((plasmoid.configuration.opponent || "") || !value.opponent) {
                syncSettings()
            }
        })
    }

    Connections {
        target: plasmoid.configuration
        function onOpponentChanged() { root.syncSettings() }
        function onStatsUrlChanged() { root.syncSettings() }
        function onTimeControlChanged() { root.syncSettings() }
    }

    // OAuth finishes in the system browser. While signed out, briefly check the
    // localhost helper so the widget notices the completed callback. This timer
    // stops after authentication and never contacts Lichess itself.
    Timer {
        interval: 1500
        running: !root.service.ready
        repeat: true
        onTriggered: root.refresh()
    }
    Timer { id: confirmTimer; interval: 5000; onTriggered: root.confirmArmed = false }
    Timer { interval: 30000; running: root.refreshedAt > 0; repeat: true; onTriggered: root.clockNow = Date.now() }
    // Off (0) by default: the widget otherwise makes no periodic Lichess requests.
    Timer {
        property int minutes: plasmoid.configuration.autoRefreshMinutes || 0
        interval: Math.max(minutes, 1) * 60000
        running: minutes > 0 && service.ready && !!(plasmoid.configuration.opponent || "")
        repeat: true
        onTriggered: root.refreshScore()
    }

    fullRepresentation: Item {
        implicitWidth: Kirigami.Units.gridUnit * 20
        implicitHeight: Kirigami.Units.gridUnit * 23

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: Kirigami.Units.largeSpacing
            spacing: Kirigami.Units.smallSpacing

            RowLayout {
                Layout.fillWidth: true
                PlasmaComponents.Label {
                    text: "♞  CHESS DUEL · " + Qt.formatDate(new Date(), "MMMM").toUpperCase()
                    font.bold: true
                    Layout.fillWidth: true
                }
                PlasmaComponents.Label {
                    visible: service.ready && !!(plasmoid.configuration.opponent || "") && !!summary
                    text: root.refreshedAgo()
                    font.pixelSize: 11
                    opacity: 0.55
                }
                PlasmaComponents.ToolButton {
                    visible: service.ready && !!(plasmoid.configuration.opponent || "")
                    text: "Refresh score"
                    display: QQC2.AbstractButton.IconOnly
                    icon.name: "view-refresh"
                    enabled: !root.busy
                    onClicked: root.refreshScore()
                    QQC2.ToolTip.visible: hovered
                    QQC2.ToolTip.text: "Refresh monthly score"
                }
            }

            ColumnLayout {
                visible: !service.authenticated
                Layout.fillWidth: true
                Layout.fillHeight: true
                PlasmaComponents.Label { text: "Set up Lichess to begin."; wrapMode: Text.WordWrap; Layout.fillWidth: true }
                PlasmaComponents.Button {
                    text: "Set up Chess Duel"
                    icon.name: "configure"
                    onClicked: root.openSettings()
                }
                Item { Layout.fillHeight: true }
            }

            ColumnLayout {
                visible: service.authenticated && !service.ready
                Layout.fillWidth: true
                Layout.fillHeight: true
                PlasmaComponents.BusyIndicator { running: visible }
                PlasmaComponents.Label {
                    text: "Finishing Lichess sign-in…"
                    wrapMode: Text.WordWrap
                    Layout.fillWidth: true
                }
                Item { Layout.fillHeight: true }
            }

            ColumnLayout {
                visible: service.ready && !(plasmoid.configuration.opponent || "")
                Layout.fillWidth: true
                Layout.fillHeight: true
                PlasmaComponents.Button {
                    text: "Set up Chess Duel"
                    icon.name: "configure"
                    onClicked: root.openSettings()
                }
                Item { Layout.fillHeight: true }
            }

            ColumnLayout {
                visible: service.ready && !!(plasmoid.configuration.opponent || "")
                Layout.fillWidth: true
                Layout.fillHeight: true

                RowLayout {
                    Layout.alignment: Qt.AlignHCenter
                    Layout.fillWidth: true
                    spacing: Kirigami.Units.smallSpacing

                    // Both sides get the wider side's width, so "vs" stays
                    // centered no matter how the two player names compare.
                    readonly property real sideWidth: Math.max(scoreLeft.implicitWidth, scoreRight.implicitWidth)

                    RowLayout {
                        id: scoreLeft
                        Layout.preferredWidth: parent.sideWidth
                        layoutDirection: Qt.RightToLeft
                        spacing: Kirigami.Units.smallSpacing
                        PlasmaComponents.Label { text: summary ? root.points(summary.myPoints) : "–"; font.pixelSize: 26; font.bold: true }
                        PlasmaComponents.Label {
                            text: summary ? summary.account : (service.account || "You")
                            font.bold: true
                            elide: Text.ElideRight
                            Layout.maximumWidth: Kirigami.Units.gridUnit * 6
                        }
                    }
                    PlasmaComponents.Label { text: "vs"; opacity: 0.6 }
                    RowLayout {
                        id: scoreRight
                        Layout.preferredWidth: parent.sideWidth
                        spacing: Kirigami.Units.smallSpacing
                        PlasmaComponents.Label { text: summary ? root.points(summary.opponentPoints) : "–"; font.pixelSize: 26; font.bold: true }
                        PlasmaComponents.Label {
                            text: summary ? summary.opponent : (service.opponent || plasmoid.configuration.opponent || "Opponent")
                            font.bold: true
                            elide: Text.ElideRight
                            Layout.maximumWidth: Kirigami.Units.gridUnit * 6
                        }
                    }
                }
                RowLayout {
                    visible: !!summary
                    Layout.alignment: Qt.AlignHCenter
                    Repeater {
                        model: summary ? summary.form : []
                        delegate: Rectangle {
                            required property string modelData
                            implicitWidth: 9
                            implicitHeight: 9
                            radius: 5
                            color: modelData === "W" ? Kirigami.Theme.positiveTextColor
                                : modelData === "L" ? Kirigami.Theme.negativeTextColor
                                : Kirigami.Theme.neutralTextColor
                            QQC2.ToolTip.visible: formMouse.containsMouse
                            QQC2.ToolTip.text: modelData === "W" ? "Win" : modelData === "L" ? "Loss" : "Draw"
                            MouseArea { id: formMouse; anchors.fill: parent; hoverEnabled: true }
                        }
                    }
                }
                Kirigami.Separator { Layout.fillWidth: true }
                RowLayout {
                    visible: !!summary
                    Layout.fillWidth: true
                    Layout.topMargin: Kirigami.Units.smallSpacing
                    spacing: Kirigami.Units.largeSpacing

                    GridLayout {
                        Layout.alignment: Qt.AlignLeft | Qt.AlignTop
                        rows: 7
                        flow: GridLayout.TopToBottom
                        rowSpacing: 3
                        columnSpacing: 3
                        Repeater {
                            model: summary ? summary.calendar : []
                            delegate: Rectangle {
                                required property var modelData
                                implicitWidth: 15
                                implicitHeight: 15
                                radius: 3
                                color: modelData.blank ? "transparent"
                                    : modelData.outcome === "W" ? Kirigami.Theme.positiveTextColor
                                    : modelData.outcome === "L" ? Kirigami.Theme.negativeTextColor
                                    : modelData.outcome === "D" ? Kirigami.Theme.neutralTextColor
                                    : isToday ? "transparent"
                                    : Qt.rgba(Kirigami.Theme.textColor.r, Kirigami.Theme.textColor.g, Kirigami.Theme.textColor.b, 0.14)
                                readonly property bool isToday: !modelData.blank && modelData.day === new Date().getDate()
                                border.width: modelData.blank ? 0 : (isToday ? 2 : 1)
                                border.color: isToday ? Qt.rgba(Kirigami.Theme.textColor.r, Kirigami.Theme.textColor.g, Kirigami.Theme.textColor.b, 0.7)
                                    : Qt.rgba(Kirigami.Theme.textColor.r, Kirigami.Theme.textColor.g, Kirigami.Theme.textColor.b, 0.12)
                                QQC2.ToolTip.visible: calendarMouse.containsMouse && !modelData.blank
                                QQC2.ToolTip.text: modelData.blank ? "" : Qt.formatDate(new Date(new Date().getFullYear(), new Date().getMonth(), modelData.day), "MMMM d")
                                    + (isToday ? " · today" : "")
                                    + (modelData.games ? " · " + modelData.wins + "–" + modelData.losses + (modelData.draws ? " · " + modelData.draws + " draw" + (modelData.draws === 1 ? "" : "s") : "") : " · no games")
                                MouseArea { id: calendarMouse; anchors.fill: parent; hoverEnabled: true }
                            }
                        }
                    }

                    ColumnLayout {
                        id: streaksColumn
                        Layout.fillWidth: true
                        Layout.alignment: Qt.AlignTop
                        Layout.leftMargin: Kirigami.Units.smallSpacing
                        spacing: Kirigami.Units.smallSpacing

                        readonly property int myWinRate: summary && summary.games > 0 ? Math.round(summary.myPoints / summary.games * 100) : 0
                        readonly property int opponentWinRate: summary && summary.games > 0 ? Math.round(summary.opponentPoints / summary.games * 100) : 0
                        readonly property int drawRate: summary && summary.games > 0 ? Math.round(summary.draws / summary.games * 100) : 0

                        RowLayout {
                            Layout.fillWidth: true
                            spacing: 4
                            Kirigami.Icon {
                                source: "games-achievements"
                                implicitWidth: Kirigami.Units.iconSizes.small * 0.6
                                implicitHeight: Kirigami.Units.iconSizes.small * 0.6
                                opacity: 0.7
                            }
                            PlasmaComponents.Label {
                                text: "Best streaks"
                                font.bold: true
                                font.pixelSize: 11
                                opacity: 0.7
                            }
                        }

                        Repeater {
                            model: summary ? [
                                { name: summary.account, streak: summary.myMaxStreak },
                                { name: summary.opponent, streak: summary.opponentMaxStreak }
                            ] : []
                            delegate: RowLayout {
                                required property var modelData
                                readonly property bool leader: summary && modelData.streak > 0
                                    && modelData.streak === Math.max(summary.myMaxStreak, summary.opponentMaxStreak)
                                    && summary.myMaxStreak !== summary.opponentMaxStreak
                                Layout.fillWidth: true
                                spacing: 4
                                PlasmaComponents.Label {
                                    text: modelData.name
                                    elide: Text.ElideRight
                                    Layout.fillWidth: true
                                    opacity: leader ? 1 : 0.75
                                }
                                PlasmaComponents.Label {
                                    text: modelData.streak
                                    font.bold: leader
                                    color: leader ? Kirigami.Theme.positiveTextColor : Kirigami.Theme.textColor
                                }
                            }
                        }

                        RowLayout {
                            visible: !!summary
                            Layout.fillWidth: true
                            Layout.topMargin: Kirigami.Units.smallSpacing
                            spacing: 4
                            Kirigami.Icon {
                                source: "format-number-percent"
                                implicitWidth: Kirigami.Units.iconSizes.small * 0.6
                                implicitHeight: Kirigami.Units.iconSizes.small * 0.6
                                opacity: 0.7
                            }
                            PlasmaComponents.Label {
                                text: "Win rate"
                                font.bold: true
                                font.pixelSize: 11
                                opacity: 0.7
                            }
                        }
                        Repeater {
                            model: summary ? [
                                { name: summary.account, rate: streaksColumn.myWinRate },
                                { name: summary.opponent, rate: streaksColumn.opponentWinRate },
                                { name: "draws", rate: streaksColumn.drawRate, isDraw: true }
                            ] : []
                            delegate: RowLayout {
                                required property var modelData
                                readonly property bool leader: !modelData.isDraw && modelData.rate > 0
                                    && modelData.rate === Math.max(streaksColumn.myWinRate, streaksColumn.opponentWinRate)
                                    && streaksColumn.myWinRate !== streaksColumn.opponentWinRate
                                Layout.fillWidth: true
                                spacing: 4
                                PlasmaComponents.Label {
                                    text: modelData.name
                                    elide: Text.ElideRight
                                    Layout.fillWidth: true
                                    opacity: modelData.isDraw ? 0.5 : (leader ? 1 : 0.75)
                                }
                                PlasmaComponents.Label {
                                    text: modelData.rate + "%"
                                    font.bold: leader
                                    opacity: modelData.isDraw ? 0.5 : 1
                                    color: leader ? Kirigami.Theme.positiveTextColor : Kirigami.Theme.textColor
                                }
                            }
                        }
                    }
                }

                Item { Layout.fillHeight: true }

                Kirigami.Separator { Layout.fillWidth: true }

                RowLayout {
                    Layout.fillWidth: true
                    spacing: Kirigami.Units.smallSpacing
                    PlasmaComponents.Button {
                        Layout.fillWidth: true
                        Layout.preferredWidth: 1
                        Layout.minimumHeight: Kirigami.Units.gridUnit * 1.75
                        Layout.preferredHeight: Kirigami.Units.gridUnit * 1.75
                        Layout.maximumHeight: Kirigami.Units.gridUnit * 1.75
                        text: root.confirmArmed ? "Confirm" : "Challenge"
                        icon.name: root.confirmArmed ? "emblem-checked" : "knights"
                        highlighted: true
                        enabled: !root.busy
                        onClicked: root.challenge()
                    }
                    PlasmaComponents.Button {
                        Layout.fillWidth: true
                        Layout.preferredWidth: 1
                        Layout.minimumHeight: Kirigami.Units.gridUnit * 1.75
                        Layout.preferredHeight: Kirigami.Units.gridUnit * 1.75
                        Layout.maximumHeight: Kirigami.Units.gridUnit * 1.75
                        text: "Stats"
                        icon.name: "view-statistics"
                        onClicked: Qt.openUrlExternally(plasmoid.configuration.statsUrl || "https://egorras.github.io/chess-duel/")
                    }
                }
            }

            PlasmaComponents.Label {
                visible: root.errorText.length > 0
                text: root.errorText
                color: Kirigami.Theme.negativeTextColor
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }
        }
    }

}
