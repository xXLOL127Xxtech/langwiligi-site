# Passt den Quellcode von shapez (tobspr Games, GPL-3.0) für langwiligi.site an.
# Wird von bauen.sh aufgerufen:  python3 anpassen.py <shapez-Ordner>
# Jede Ersetzung muss genau einmal passen, sonst bricht das Skript ab (z.B. bei einer neuen shapez-Version).
import pathlib, sys

root = pathlib.Path(sys.argv[1])


def rep(rel, old, new, count=1):
    p = root / rel
    s = p.read_bytes().decode("utf-8")
    if "\r\n" in s:
        old, new = old.replace("\n", "\r\n"), new.replace("\n", "\r\n")
    n = s.count(old)
    if n != count:
        sys.exit(f"{rel}: erwartet {count}x, gefunden {n}x:\n{old}")
    p.write_bytes(s.replace(old, new).encode("utf-8"))


js = "src/js/"

# Vollversion: keine Demo-Sperren
rep(js + "core/restriction_manager.js",
    "    isLimitedVersion() {\n",
    "    isLimitedVersion() {\n        // langwiligi.site: immer Vollversion\n        return false;\n")
rep(js + "game/modes/levels.js",
    "    } else if (G_IS_STANDALONE || WEB_STEAM_SSO_AUTHENTICATED) {\n        return STANDALONE_LEVELS();",
    "    } else if (true) {\n        // langwiligi.site: alle Level\n        return STANDALONE_LEVELS();")
rep(js + "game/modes/regular.js",
    "    get difficultyMultiplicator() {\n        if (G_IS_STANDALONE || WEB_STEAM_SSO_AUTHENTICATED) {",
    "    get difficultyMultiplicator() {\n        if (true) {")

# Kein Steam-Login
rep(js + "core/steam_sso.js",
    "export async function authorizeViaSSOToken(app, dialogs) {\n    if (G_IS_STANDALONE) {",
    "export async function authorizeViaSSOToken(app, dialogs) {\n    // langwiligi.site: kein Steam-Login\n    if (true) {")

# Kein Tracking
rep(js + "application.js",
    "        this.analytics = new GoogleAnalyticsImpl(this);\n        this.gameAnalytics = new ShapezGameAnalytics(this);",
    "        // langwiligi.site: kein Tracking\n        this.analytics = new NoAnalytics(this);\n"
    "        this.gameAnalytics = /** @type {ShapezGameAnalytics} */ (/** @type {unknown} */ (new NoGameAnalytics(this)));")
rep(js + "application.js",
    'import { AnalyticsInterface } from "./platform/analytics";',
    """import { AnalyticsInterface } from "./platform/analytics";
import { GameAnalyticsInterface } from "./platform/game_analytics";

// langwiligi.site: Tracking-Attrappen, die nichts senden
class NoAnalytics extends AnalyticsInterface {
    initialize() {
        return Promise.resolve();
    }
}

class NoGameAnalytics extends GameAnalyticsInterface {
    initialize() {
        return Promise.resolve();
    }
    handleLevelCompleted(level) {
        // Bewertungsfrage der Webseite nach dem ersten geschafften Level
        if (window["LW"]) {
            window["LW"].rundeFertig();
        }
    }
    activateDlc(dlc) {
        return Promise.resolve();
    }
    note(action) {}
    noteMinor(action, payload = "") {}
}""")
rep(js + "states/preload.js",
    "    async fetchDiscounts() {\n",
    "    async fetchDiscounts() {\n        // langwiligi.site: keine Abfragen an fremde Server\n        return;\n")
rep(js + "states/preload.js",
    "    async sendBeacon() {\n",
    "    async sendBeacon() {\n        // langwiligi.site: kein Tracking\n        return;\n")
rep(js + "states/main_menu.js",
    "    fetchPlayerCount() {\n",
    "    fetchPlayerCount() {\n        // langwiligi.site: keine Abfragen an fremde Server\n        return;\n")

# Keine Werbung, keine Einbettungs-Anbieter
rep(js + "platform/browser/wrapper.js",
    "        if (!G_IS_STANDALONE && !WEB_STEAM_SSO_AUTHENTICATED && queryParamOptions.embedProvider) {",
    "        // langwiligi.site: keine Werbe-Anbieter\n        if (false) {")
rep(js + "platform/browser/wrapper.js",
    "    initializeAdProvider() {\n",
    "    initializeAdProvider() {\n        // langwiligi.site: keine Werbung\n        this.app.adProvider = new NoAdProvider(this.app);\n        return Promise.resolve();\n")

# Hauptmenue: keine Steam-, Puzzle-DLC- und shapez-2-Werbung
rep(js + "states/main_menu.js",
    "        const showPuzzleDLC =\n            !G_WEGAME_VERSION &&",
    "        const showPuzzleDLC =\n            false &&\n            !G_WEGAME_VERSION &&")
rep(js + "states/main_menu.js",
    "        const hasSteamBridge = !G_GOG_VERSION && !G_IS_STEAM_DEMO;",
    "        const hasSteamBridge = false;")
rep(js + "states/main_menu.js",
    "        let showExternalLinks = true;",
    "        let showExternalLinks = false;")
rep(js + "states/main_menu.js",
    "        const showShapez2 = showExternalLinks && MODS.mods.length === 0;",
    "        const showShapez2 = false;")

# Ohne Musik (Rechte am Soundtrack unklar)
rep(js + "platform/sound.js",
    """export const MUSIC = {
    // The theme always depends on the standalone only, even if running the full
    // version in the browser
    theme: G_IS_STANDALONE ? "theme-full" : "theme-short",
};

if (G_IS_STANDALONE) {
    MUSIC.menu = "menu";
}

if (G_IS_STANDALONE) {
    MUSIC.puzzle = "puzzle-full";
}""",
    """// langwiligi.site: ohne Musik (der Soundtrack wird separat verkauft)
/** @type {{theme?: string, menu?: string, puzzle?: string}} */
export const MUSIC = {};""")

# Deutsch als Standardsprache
rep(js + "profile/application_settings.js",
    '        this.language = "auto-detect";',
    '        this.language = "de";')

# Handy-Hinweis auf Deutsch, ohne Steam-Link und Tracking
rep(js + "states/mobile_warning.js",
    """            <p>I'm sorry, but shapez.io is not available on mobile devices yet!</p>
            <p>If you have a desktop device, you can get shapez on Steam:</p>


            <a href="https://get.shapez.io/shapez_mobile" class="standaloneLink" target="_blank">Play on Steam!</a>""",
    """            <p>Die Formenfabrik läuft nur am Computer mit Maus und Tastatur.</p>
            <p>Öffne langwiligi.site am PC, um zu spielen.</p>

            <a href="../" class="standaloneLink">Zurück zu allen Spielen</a>""")
rep(js + "states/mobile_warning.js",
    """    onEnter() {
        try {""",
    """    onEnter() {
        return;
        try {""")

# Schweizer Schreibweise
p = root / "translations/base-de.yaml"
p.write_bytes(p.read_bytes().decode("utf-8").replace("ß", "ss").encode("utf-8"))

# Startseite des Spiels: Kopf nach SPIEL-VORGABEN.md, keine Verweise auf shapez.io
rep("src/html/index.html",
    """<html lang="en" style="--ui-scale: 1.33;">
    <head>
        <title>shapez Demo - Factory Automation Game</title>
""",
    """<html lang="de" style="--ui-scale: 1.33;">
    <head>
        <meta charset="UTF-8" />
        <title>Formenfabrik</title>
        <meta name="description" content="Schneiden, drehen, färben, stapeln: Bau eine riesige Fabrik für Formen und automatisiere alles." />
        <meta name="theme-color" content="#9b8cff" />
        <meta name="spiel-modi" content="Solo" />
        <meta name="spiel-tags" content="Fabrik,Aufbau" />
        <meta name="spiel-typ" content="Aufbau,Strategie" />
""")
rep("src/html/index.html", """        <meta name="theme-color" content="#393747" />
""", "")
p = root / "src/html/index.html"
s = p.read_bytes().decode("utf-8")
start = s.index("        <!-- seo -->")
end = s.index("    </head>")
s = s[:start] + """        <!-- Original: shapez von tobspr Games (GPL-3.0), https://github.com/tobspr-games/shapez.io -->
        <!-- Geänderte Fassung für langwiligi.site, Quellen und Lizenz: siehe LIZENZ.md -->
        <meta name="author" content="tobspr Games (Original), angepasst für langwiligi.site" />
        <link rel="shortcut icon" type="image/x-icon" href="favicon.ico" />
""" + s[end:]
p.write_bytes(s.encode("utf-8"))

# Relative Pfade statt /v/<commit>/ (das braucht auf shapez.io eine Server-Umleitung)
rep("gulp/buildutils.js",
    '        return "/v/" + commitHash + "/" + url;',
    '        // langwiligi.site: relative Pfade, damit das Spiel in einem Unterordner läuft\n        return url;')
rep("src/js/core/cachebust.js",
    '        return "/v/" + G_BUILD_COMMIT_HASH + "/" + path;',
    '        // langwiligi.site: relative Pfade\n        return path;')
rep("gulp/html.js",
    "                return buildUtils.cachebust(url, commitHash);",
    "                // langwiligi.site: Version als Parameter, damit nach Updates nichts Altes im Cache bleibt\n"
    '                return url + "?v=" + commitHash;')

# Ladebildschirm: kein Steam-Login, keine Links nach draussen, Deutsch
rep("gulp/preloader/preloader.js",
    """    var searchString = window.location.search;
    if (searchString.includes("steam_sso_auth_token=")) {
        var pos = searchString.indexOf("steam_sso_auth_token");
        const authToken = searchString.substring(pos + 21, pos + 57);
        try {
            window.localStorage.setItem("steam_sso_auth_token", authToken);
            window.location.replace(window.location.protocol + "//" + window.location.host);
        } catch (ex) {
            alert("Failed to login via Steam SSO: " + ex);
            window.location.replace("https://shapez.io");
        }
        return;
    }

""", "")
rep("gulp/preloader/preloader.js",
    """"Please report this error in the <strong>#bugs</strong> channel of the <a href='https://discord.gg/rtuRRJDc7u' target='_blank'>official discord</a>!";""",
    """"Bitte lade die Seite neu. Wenn der Fehler bleibt, probier einen anderen Browser (Chrome, Edge oder Firefox).";""")
rep("gulp/preloader/preloader.html",
    """            Page does not load? Try the
            <a href="https://get.shapez.io/slowpageload" target="_blank">Steam Version</a>!""",
    """            Lädt es nicht? Seite neu laden oder einen anderen Browser probieren.""")
rep("gulp/preloader/preloader.html",
    """<div id="ll_preload_status">Downloading Game</div>""",
    """<div id="ll_preload_status">Spiel wird geladen</div>""")

# Tipp-Videos kämen von static.shapez.io: weglassen (die eingebauten Tutorial-Animationen bleiben)
rep(js + "game/modes/regular.js",
    "            if (!G_WEGAME_VERSION) {\n                this.additionalHudParts.tutorialHints = HUDPartTutorialHints;",
    "            if (false) {\n                // langwiligi.site: Videos lägen auf fremdem Server\n                this.additionalHudParts.tutorialHints = HUDPartTutorialHints;")

# Logo ohne "Demo"-Schriftzug
rep(js + "core/utils.js",
    '    if (G_IS_STANDALONE || WEB_STEAM_SSO_AUTHENTICATED) {\n        return "logo.png";',
    '    if (true) {\n        // langwiligi.site: Vollversion\n        return "logo.png";')

# Speicher mit der Spiel-ID benennen (alle Spiele teilen sich langwiligi.site)
rep(js + "platform/browser/storage_indexed_db.js",
    'window.indexedDB.open("app_storage", 10)',
    'window.indexedDB.open("formenfabrik", 10)')
rep(js + "platform/browser/storage.js",
    "window.localStorage.setItem(filename, contents);",
    'window.localStorage.setItem("formenfabrik-" + filename, contents);')
rep(js + "platform/browser/storage.js",
    "window.localStorage.getItem(filename);",
    'window.localStorage.getItem("formenfabrik-" + filename);')
rep(js + "platform/browser/storage.js",
    "window.localStorage.removeItem(filename);",
    'window.localStorage.removeItem("formenfabrik-" + filename);')

# Knöpfe der Webseite ("Alle Spiele", Bewertung: IDs lw-...) beim Bildschirmwechsel nicht wegräumen
rep(js + "core/state_manager.js",
    "        // Clean up old elements\n",
    "        // langwiligi.site: Elemente der Webseite behalten\n"
    "        const keepElements = Array.from(document.body.children).filter(el => el.id.startsWith(\"lw-\"));\n\n"
    "        // Clean up old elements\n")
rep(js + "core/state_manager.js",
    "            document.body.innerHTML = this.currentState.internalGetFullHtml();\n        }\n",
    "            document.body.innerHTML = this.currentState.internalGetFullHtml();\n        }\n"
    "        keepElements.forEach(el => document.body.appendChild(el));\n")

# Kein "Mods"-Knopf (Mods laufen im Browser nicht)
rep(js + "states/main_menu.js",
    """        // Mods
        this.trackClicks(
            makeButton(outerDiv, ["modsButton", "styledButton"], T.mods.title),
            this.onModsClicked
        );
""",
    """        // langwiligi.site: kein Mods-Knopf (Mods laufen im Browser nicht)
""")

# Einführungs-Box nach rechts rücken: links in der Mitte sitzt der "Alle Spiele"-Knopf der Webseite
rep("src/css/ingame_hud/interactive_tutorial.scss",
    "#ingame_HUD_InteractiveTutorial {\n    position: absolute;\n    @include S(left, 10px);",
    "#ingame_HUD_InteractiveTutorial {\n    position: absolute;\n    // langwiligi.site: Platz für den \"Alle Spiele\"-Knopf\n    left: 145px;")
rep(js + "states/preload.js",
    'window.localStorage.setItem("local_storage_feature_detection", "1");',
    'window.localStorage.setItem("formenfabrik-storage-test", "1");')
rep(js + "platform/browser/wrapper.js",
    'window.indexedDB.open("indexeddb_feature_detection", 1);',
    'window.indexedDB.open("formenfabrik-test", 1);')
