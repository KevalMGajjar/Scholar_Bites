const fs = require('fs');
const pluginPath = 'C:\\Users\\KEVAL\\AppData\\Local\\Pub\\Cache\\hosted\\pub.dev\\flutter_local_notifications-21.0.0\\lib\\src\\flutter_local_notifications_plugin.dart';
const code = fs.readFileSync(pluginPath, 'utf8');

const regexes = [
    /Future<bool\?> initialize\([^)]*\)/,
    /Future<void> show\([^]*?\)\s*async/,
    /Future<void> zonedSchedule\([^]*?\)\s*async/,
    /Future<void> cancel\([^)]*\)/
];

let out = '';
for (const regex of regexes) {
    const match = code.match(regex);
    if (match) {
        out += "---- MATCH ----\n" + match[0] + "\n";
    }
}
fs.writeFileSync('sigs_utf8.txt', out, 'utf8');
