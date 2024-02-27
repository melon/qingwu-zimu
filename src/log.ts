import _log from 'electron-log';

// Optional, initialize the logger for any renderer processses
_log.initialize({ preload: true });

_log.transports.console.format = '[{h}:{i}:{s}.{ms}][{level}] › {text}';
_log.transports.console.level = 'info';

export const log = _log;
