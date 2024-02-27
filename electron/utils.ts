import { protocol } from 'electron';
import crypto from 'node:crypto';
import path from 'node:path';
import { stat } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { Stats } from 'original-fs';
import { log } from './log';

export function randomHexStr(len = 32) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex');
}

/**
 * generate a random filename according to orignal path
 * @param orignalPath
 * @param newExtname e.g. '.wav' | '.js'
 * @returns
 */
export function generateRandomFilename(orignalPath: string, newExtname?: string) {
  const ext = path.extname(orignalPath);
  const fileName = path.basename(orignalPath, ext);
  const newBasename = `${fileName}-${randomHexStr(8)}${newExtname ? newExtname : ext}`;
  return newBasename;
}

export function getFileStat(path: string): Promise<Stats> {
  return new Promise((resolve, reject) => {
    stat(path, (err, stats) => {
      if (err) {
        return reject(err);
      } else {
        return resolve(stats);
      }
    });
  });
}

export function registerLocalVideoProtocol () {
  protocol.registerFileProtocol('local-media', (req, callback) => {
    const url = req.url.replace(/^local-media:\/\//, '');
    // Decode URL to prevent errors when loading filenames with UTF-8 chars or chars like "#"
    const decodedUrl = decodeURI(url); // Needed in case URL contains spaces
    try {
      return callback(decodedUrl);
    } catch (e) {
      log.error(e);
    }
  });
}

export function parseSrtContentToArray(contents: string) {

  const TS_REG = /^\d\d:[0-5]\d:[0-5]\d,\d\d\d$/;
  const lines = contents.split('\n');

  let count = 0;
  let item: string[] = [];
  const result: string[][] = [];
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (count % 3 === 0) { // number line
      if (!isNaN(parseInt(line, 10))) {
        count++;
      } else {
        throw new Error('invalid srt format');
      }
    } else if (count % 3 === 1) { // timestamp line
      const pair = line.split(' --> ');
      if (pair.length === 2 && TS_REG.test(pair[0]) && TS_REG.test(pair[1])) {
        item.push(...pair);
        count++;
      } else {
        throw new Error('invalid srt format');
      }
    } else { // text line
      item.push(line);
      count++;
      result.push(item);
      item = [];
    }
  }

  return result;
}

export async function parseSrtToArray(filePath: string) {
  const contents = await readFile(filePath, { encoding: 'utf8' });

  return parseSrtContentToArray(contents);
}

export function wait(interval: number) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(undefined);
    }, interval);
  });
}
