import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import org.kde.kcmutils as KCM

KCM.SimpleKCM {
    id: root
    property string apiBase: "http://127.0.0.1:47831"
    property string cfg_opponent
    property string cfg_opponentDefault: ""
    property alias cfg_statsUrl: statsUrl.text
    property string cfg_statsUrlDefault: "https://egorras.github.io/chess-duel/"
    property alias cfg_confirmChallenge: confirmation.checked
    property bool cfg_confirmChallengeDefault: true
    property string cfg_timeControl: "5+0"
    property string cfg_timeControlDefault: "5+0"
    property int cfg_autoRefreshMinutes: 0
    property int cfg_autoRefreshMinutesDefault: 0
    property var service: ({ authenticated: false, ready: false })
    property var recentModel: []
    property string errorText: ""

    function call(method, path, body, done) {
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
            } else errorText = value.error || "Chess Duel helper is not running"
        }
        xhr.send(body ? JSON.stringify(body) : "")
    }
    function refreshStatus() {
        call("GET", "/status", null, function(value) { service = value })
    }
    function loadOpponents() {
        call("GET", "/opponents", null, function(value) {
            recentModel = value.opponents
            // Assigning a new model to an editable ComboBox can reset its
            // editText out from under the cfg_opponent binding; reassert it.
            opponentBox.editText = root.cfg_opponent
        })
    }

    Component.onCompleted: refreshStatus()
    Timer {
        interval: 1500
        running: !root.service.ready
        repeat: true
        onTriggered: root.refreshStatus()
    }

    Kirigami.FormLayout {
        Label {
            Kirigami.FormData.label: "Lichess account:"
            text: root.service.ready ? root.service.account : root.service.authenticated ? "Connecting…" : "Not connected"
        }
        Button {
            text: root.service.authenticated ? "Reconnect Lichess" : "Sign in with Lichess"
            icon.name: "user-identity"
            onClicked: root.call("GET", "/auth/start", null, function(value) { Qt.openUrlExternally(value.url) })
        }

        ComboBox {
            id: opponentBox
            Kirigami.FormData.label: "Duel opponent:"
            Layout.fillWidth: true
            editable: true
            model: root.recentModel
            enabled: root.service.ready
            onEditTextChanged: root.cfg_opponent = editText
            onPressedChanged: if (pressed && root.recentModel.length === 0) root.loadOpponents()
            Component.onCompleted: editText = root.cfg_opponent
        }
        Label {
            text: "The list uses recurring opponents from your latest 20 games. You can type any username."
            wrapMode: Text.WordWrap
            opacity: 0.7
            Layout.fillWidth: true
        }

        TextField {
            id: statsUrl
            Kirigami.FormData.label: "Full statistics URL:"
            Layout.fillWidth: true
            inputMethodHints: Qt.ImhUrlCharactersOnly
            Component.onCompleted: if (!text) text = root.cfg_statsUrlDefault
        }
        ComboBox {
            id: timeControl
            Kirigami.FormData.label: "Time control:"
            Layout.fillWidth: true
            model: ["1+0", "2+1", "3+0", "3+2", "5+0", "5+3", "10+0", "10+5"]
            Component.onCompleted: currentIndex = Math.max(0, model.indexOf(root.cfg_timeControl || "5+0"))
            onActivated: root.cfg_timeControl = currentText
        }
        CheckBox {
            id: confirmation
            Kirigami.FormData.label: "Challenge:"
            text: "Confirm before opening or creating a game"
            Component.onCompleted: checked = root.cfg_confirmChallenge
        }
        ComboBox {
            id: autoRefresh
            Kirigami.FormData.label: "Auto-refresh score:"
            Layout.fillWidth: true
            textRole: "text"
            valueRole: "minutes"
            model: [
                { text: "Off", minutes: 0 },
                { text: "Every 5 minutes", minutes: 5 },
                { text: "Every 15 minutes", minutes: 15 },
                { text: "Every 30 minutes", minutes: 30 },
                { text: "Every hour", minutes: 60 }
            ]
            Component.onCompleted: currentIndex = Math.max(0, indexOfValue(root.cfg_autoRefreshMinutes || 0))
            onActivated: root.cfg_autoRefreshMinutes = currentValue
        }
        Label {
            text: "Off by default: the widget makes no periodic Lichess requests unless you pick an interval here."
            wrapMode: Text.WordWrap
            opacity: 0.7
            Layout.fillWidth: true
        }
        Label {
            visible: root.errorText.length > 0
            text: root.errorText
            color: Kirigami.Theme.negativeTextColor
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
    }
}
