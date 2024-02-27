import _log from 'electron-log';

/**
 * on Linux: ~/.config/{app name}/logs/main.log
 * on macOS: ~/Library/Logs/{app name}/main.log
 * on Windows: %USERPROFILE%\AppData\Roaming\{app name}\logs\main.log
 */

// Optional, initialize the logger for any renderer processses
_log.initialize({ preload: true });

_log.transports.console.format = '[{h}:{i}:{s}.{ms}][{processType}][{level}] > {text}';
_log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}][{processType}][{level}] {text}';

export const log = _log;
