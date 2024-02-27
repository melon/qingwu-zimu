import { log } from "../log";
import { getModelsDir } from "../models";
import fsPromised from 'node:fs/promises';
import path from 'node:path';
import { extractFile as extractFileFunc } from "./file-utils";

export type ICopyFilesToDirOptions = {
  filePaths: string[];
  targetDir: 'models';
  extractFile?: boolean | RegExp;
}
export type ICopyFilesToDirRes = {
  errno: string;
  succeeded?: never,
  failed?: never,
} | {
  errno?: never;
  succeeded: string[],
  failed: string[],
}
export async function copyFilesToDir(_event: Electron.IpcMainInvokeEvent, { filePaths, targetDir, extractFile }: ICopyFilesToDirOptions): Promise<ICopyFilesToDirRes> {
  try {
    let targetDirPath;
    if (targetDir === 'models') {
      targetDirPath = getModelsDir();
    } else {
      return {
        errno: 'ERROR_COPY_FILES_TO_DIR_DIR_NOT_SUPPORTED',
      };
    }
    const succeeded: string[] = [];
    const failed: string[] = [];
    for (let filePath of filePaths) {
      const targetPath = path.join(targetDirPath, path.basename(filePath));
      try {
        await fsPromised.copyFile(filePath, targetPath);
        if (
          extractFile === true
          || (extractFile instanceof RegExp && extractFile.test(filePath))
        ) {
          await extractFileFunc(filePath, targetDirPath);
        }
        succeeded.push(filePath);
      } catch (e) {
        failed.push(filePath);
      }
    }
    return {
      succeeded,
      failed,
    };
  } catch (e) {
    log.error('copyFilesToDir: ', e);
    return {
      errno: 'ERROR_COPY_FILES_TO_DIR_CAUGHT',
    };
  }
}
