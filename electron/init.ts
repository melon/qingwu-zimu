import { app } from 'electron';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { log } from './log';
import { name } from '../package.json';

export function changeUserDataDirInDev() {
  const appData = app.getPath('appData');
  app.setPath('userData', path.join(appData, `${name}-dev`));
}

export function changeSessionDataDir() {
  const userDataDir = app.getPath('userData');
  const newSessionDataDir = path.join(userDataDir, 'sessionData');
  mkdirSync(newSessionDataDir, { recursive: true });
  app.setPath('sessionData', newSessionDataDir);
}
export function changeTempDir() {
  let newTempDir: string;
  newTempDir = path.join(app.getPath('temp'), `${name}-dev`);
  mkdirSync(newTempDir, { recursive: true });
  app.setPath('temp', newTempDir);
  const names = [
    'home',
    'appData',
    'userData',
    'sessionData',
    'temp',
    'exe',
    'module',
    'desktop',
    'documents',
    'downloads',
    'logs',
    'crashDumps',
  ] as const;
  names.forEach((name: (typeof names)[number]) => {
    log.info(name, app.getPath(name));
  });
}
