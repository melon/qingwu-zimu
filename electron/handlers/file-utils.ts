import fsPromises from 'node:fs/promises';
import fs from 'node:fs';
import decompress from 'decompress';
import { randomHexStr } from '../utils';
import { app } from 'electron';
import path from 'node:path';
import { log } from '../log';

export function setImagesDir() {
  const userDataDir = app.getPath('userData');
  fs.mkdirSync(path.join(userDataDir, 'images'), { recursive: true });
}

function getImageExtensionFromBase64(base64Data: string) {
  const prefix = base64Data.substring(0, base64Data.indexOf(';base64,'));
  const imageFormat = prefix.substring(prefix.indexOf('/') + 1);

  const formatToExtension = {
    'jpeg': 'jpg',
    'png': 'png',
    'gif': 'gif',
    'bmp': 'bmp',
    'tiff': 'tif',
    'webp': 'webp',
    'svg+xml': 'svg',
  };

  return formatToExtension[imageFormat as keyof typeof formatToExtension] || '';
}

function stripBase64Data(data: string) {
  return data.slice(data.indexOf(';base64,') + 8);
}

export async function saveBase64DataAsAnImage(_event: Electron.IpcMainInvokeEvent, base64Data: string) {
  try {
    const binaryData = Buffer.from(stripBase64Data(base64Data), 'base64');

    const extentions = getImageExtensionFromBase64(base64Data);

    if (!extentions) {
      throw new Error('base64 data is not an image');
    }

    const userDataDir = app.getPath('userData');
    const filePath = path.join(userDataDir, 'images', `${randomHexStr()}.${extentions}`);

    await fsPromises.writeFile(filePath, binaryData, 'binary');

    return filePath;
  } catch (e) {
    log.error('saveBase64DataAsAnImage', e);
  }
}

export async function copyDir(src: string, dest: string) {
  await fsPromises.mkdir(dest, { recursive: true });
  let entries = await fsPromises.readdir(src, { withFileTypes: true });

  for (let entry of entries) {
    let srcPath = path.join(src, entry.name);
    let destPath = path.join(dest, entry.name);

    entry.isDirectory() ?
      await copyDir(srcPath, destPath) :
      await fsPromises.copyFile(srcPath, destPath);
  }
}

export function extractFile(filePath: string, extractTo: string) {
  return new Promise((resolve, reject) => {
    decompress(filePath, extractTo)
    .then((files) => {
      resolve(files);
    })
    .catch((e: Error) => {
      log.error(`extractFile catch: `, e);
      reject(e);
    });
  });
}
