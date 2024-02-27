// import _sqlite3 from 'sqlite3';
import { AsyncDatabase } from './promised-sqlite3';
// import type { Database } from 'sqlite3';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { log } from '../log';
import { LANGUAGES } from '../config';

// const sqlite3 = _sqlite3.verbose();

export function setDatabaseDir() {
  const userDataDir = app.getPath('userData');
  const databseDir = path.join(userDataDir, 'database');
  fs.mkdirSync(databseDir, { recursive: true });
}

let db: AsyncDatabase;
export async function connectDb() {
  if (!db) {
    const sqlFilePath = path.join(app.getPath('userData'), 'database/sql.db');
    log.info('database', sqlFilePath);
    // db = new sqlite3.Database(sqlFilePath);
    db = await AsyncDatabase.open(sqlFilePath);
  };
  return db;
}

export const ITRANSCRIBE_STATE = {
  CREATED: 1,
  STARTED: 2,
  COMPLETED: 3,
  FAILED: 4,
} as const;

export interface ITRANSCRIPTION_TASK {
  id: number;
  task_name: string;
  cover_img: string | null;
  subtitles_id: number | null;
  transcribe_state: number | null;
  media_type: number | null;
  location: string | null;
  duration: number | null;
  create_time: string;
  modify_time: string;
}
export type LANGS = {
  -readonly [k in keyof typeof LANGUAGES]?: string;
}
export type ISUBTITLE = {
  subtitles_id: number;
  default_lang?: keyof LANGS;
  selected_translation_lang?: keyof LANGS;
  create_time: string;
  modify_time: string;
} & LANGS;
export async function initDb() {
  const db = await connectDb();

  try {
    log.info('try creating table `transcription_tasks`');
    /**
     * trascribe_state: CREATED = 1, STARTED = 2, COMPLETED = 3, FAILED = 4
     * media_type: VIDEO = 1, AUDIO = 2
     */
    await db.run(`
      CREATE TABLE IF NOT EXISTS transcription_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        task_name TEXT NOT NULL,
        cover_img TEXT,
        subtitles_id INTEGER,
        transcribe_state INTEGER,
        media_type INTEGER,
        location TEXT,
        duration INTEGER,
        delete_flag INTEGER NOT NULL DEFAULT 0,
        create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        modify_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    log.info('try creating table `subtitles`');
    await db.run(`
      CREATE TABLE IF NOT EXISTS subtitles (
        subtitles_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        default_lang TEXT,
        selected_translation_lang TEXT,
        en TEXT,
        zh_CN TEXT,
        zh_TW TEXT,
        ja TEXT,
        ko TEXT,
        fr TEXT,
        es TEXT,
        ru TEXT,
        ar TEXT,
        th TEXT,
        de TEXT,
        pt TEXT,
        it TEXT,
        hi TEXT,
        id TEXT,
        create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    log.info('try creating table `key_value_store`');
    await db.run(`
      CREATE TABLE IF NOT EXISTS key_value_store (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_key ON key_value_store (key)
    `);

    const res = await db.get<{ sql: string }>('SELECT sql FROM sqlite_master WHERE type = "table" AND name = "subtitles"');
    try {
      if (res.sql.indexOf('zh_CN') === -1) {
        log.info('`zh_CN` column not found in table `subtitles`, start adding');
        await db.run(`
          ALTER TABLE subtitles RENAME COLUMN "zh" TO "zh_CN"
        `);
        await db.run(`
          ALTER TABLE subtitles ADD COLUMN "zh_TW" TEXT
        `);
        await db.run(`
          UPDATE subtitles SET default_lang = 'zh_CN' WHERE default_lang = 'zh'
        `);
        await db.run(`
          UPDATE subtitles SET selected_translation_lang = 'zh_CN' WHERE selected_translation_lang = 'zh'
        `);
      }
    } catch (err) {
      log.error('failed: add `zh_CN` and `zh_TW` columns to `subtitles`, and remove `zh` column' ,err);
    }

    try {
      // v0.9.11 add new lang codes
      if (res.sql.indexOf('ta') === -1) {
        const addedLangs = ['tr', 'vi', 'he', 'el', 'pl', 'nl', 'hu', 'no', 'sv', 'fi', 'cs', 'da', 'lt', 'sk', 'ms', 'ro', 'bg', 'hr', 'lo', 'ur', 'ta'];
        for (let lang of addedLangs) {
          await db.run(`
            ALTER TABLE subtitles ADD COLUMN "${lang}" TEXT
          `);
        }
      }
    } catch (err) {
      log.error('failed: add `tr` columns to `subtitles`', err);
    }
  } catch (err) {
    if (err) {
      log.error(err);
    }
  }
}
