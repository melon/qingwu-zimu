// https://github.com/tguichaoua/promised-sqlite3/tree/main
import sqlite3 from "sqlite3";

/**
 * A thin wrapper around {@link sqlite3.Database} that expose an async API.
 */
export class AsyncDatabase {
  /**
   * Create a new {@link AsyncDatabase} from a {@link sqlite3.Database} object.
   *
   * @see Use {@link AsyncDatabase.open} to create and open the database with the async API.
   *
   * @param db - The {@link sqlite3.Database} object.
   */
  constructor(private db: sqlite3.Database) {}

  /**
   * @returns The inner {@link sqlite3.Database} object.
   */
  get inner() {
    return this.db;
  }

  /**
   * Returns a new {@link AsyncDatabase} object and automatically opens the database.
   *
   * @see {@link https://github.com/TryGhost/node-sqlite3/wiki/API#new-sqlite3databasefilename--mode--callback | new sqlite3.Database} for further informations.
   * @param filename - The filename used to instantiate the {@link sqlite3.Database} object.
   * @param mode - The mode used to instantiate the {@link sqlite3.Database} object.
   */
  static open(
    filename: string,
    mode: number = sqlite3.OPEN_READWRITE |
      sqlite3.OPEN_CREATE |
      sqlite3.OPEN_FULLMUTEX
  ): Promise<AsyncDatabase> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(filename, mode, (err) => {
        if (err) reject(err);
        else resolve(new AsyncDatabase(db));
      });
    });
  }

  /**
   * Close the database.
   *
   * @see {@link https://github.com/TryGhost/node-sqlite3/wiki/API#closecallback | sqlite3.Database.close} for further informations.
   */
  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Runs the SQL query with the specified parameters.
   *
   * @see {@link https://github.com/TryGhost/node-sqlite3/wiki/API#runsql--param---callback | sqlite3.Database.run} for further informations.
   * @param sql - The sql request.
   * @param params - Parameters for the request.
   */
  run(sql: string, ...params: unknown[]): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      // If there is only one argument, unwrap it to allow the user to pass an object for named parameters.
      const p = params.length === 1 ? params[0] : params;
      this.db.run(sql, p, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  /**
   * Runs the SQL query with the specified parameters.
   *
   * @see {@link https://github.com/TryGhost/node-sqlite3/wiki/API#getsql--param---callback | sqlite3.Database.get} for further informations.
   * @param sql - The sql request.
   * @param params - Parameters for the request.
   */
  get<T>(sql: string, ...params: unknown[]): Promise<T> {
    return new Promise((resolve, reject) => {
      // If there is only one argument, unwrap it to allow the user to pass an object for named parameters.
      const p = params.length === 1 ? params[0] : params;
      this.db.get<T>(sql, p, function (err, row) {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Runs the SQL query with the specified parameters.
   *
   * @see {@link https://github.com/TryGhost/node-sqlite3/wiki/API#allsql--param---callback | sqlite3.Database.all} for further informations.
   * @param sql - The sql request.
   * @param params - Parameters for the request.
   */
  all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    return new Promise((resolve, reject) => {
      // If there is only one argument, unwrap it to allow the user to pass an object for named parameters.
      const p = params.length === 1 ? params[0] : params;
      this.db.all<T>(sql, p, function (err, rows) {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Runs the SQL query with the specified parameters and calls the callback once for each result row.
   *
   * @see {@link https://github.com/TryGhost/node-sqlite3/wiki/API#eachsql--param---callback--complete | sqlite3.Database.each} for further informations.
   * @param sql - The sql request.
   * @param params - Parameters for the request.
   * @param callback - A callback that take a row.
   */
  each<T>(
    sql: string,
    params: any,
    callback: (row: T) => void
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.each<T>(
        sql,
        params,
        function (err, row) {
          if (err) reject(err);
          else {
            try {
              callback(row);
            } catch (e) {
              reject(e);
            }
          }
        },
        function (err, count) {
          if (err) reject(err);
          else resolve(count);
        }
      );
    });
  }

  /**
   * Runs all SQL queries in the supplied string.
   *
   * @see {@link https://github.com/TryGhost/node-sqlite3/wiki/API#execsql--callback | sqlite3.Database.exec} for further informations.
   * @param sql - The sql request.
   */
  exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, function (err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Prepares the SQL statement and optionally binds the specified parameters.
   *
   * @see {@link https://github.com/TryGhost/node-sqlite3/wiki/API#preparesql--param---callback | sqlite3.Database.prepare} for further informations.
   * @param sql - The sql request.
   * @param params - Parameters for the request.
   */
  prepare(sql: string, ...params: unknown[]): Promise<AsyncStatement> {
    return new Promise((resolve, reject) => {
      // If there is only one argument, unwrap it to allow the user to pass an object for named parameters.
      const p = params.length === 1 ? params[0] : params;
      this.db.prepare(sql, p, function (err) {
        if (err) reject(err);
        else resolve(new AsyncStatement(this));
      });
    });
  }
}

/**
 * A thin wrapper around {@link sqlite3.Statement} that expose an async API.
 */
export class AsyncStatement {
  /**
   * Create a new {@link AsyncStatement} from a {@link sqlite3.Statement} object.
   *
   * @see Use {@link AsyncDatabase.prepare} to create a statement with the async API.
   *
   * @param statement - The {@link sqlite3.Statement} object.
   */
  constructor(private statement: sqlite3.Statement) {}

  /**
   * @returns The inner {@link sqlite3.Statement} object.
   */
  get inner() {
    return this.statement;
  }

  /**
   * Binds parameters to the prepared statement.
   *
   * @see {@link https://github.com/TryGhost/node-sqlite3/wiki/API#bindparam---callback | sqlite3.Statement.bind} for further informations.
   * @param params - Parameters for the request.
   */
  bind(...params: unknown[]): Promise<void> {
    return new Promise((resolve, reject) => {
      // If there is only one argument, unwrap it to allow the user to pass an object for named parameters.
      const p = params.length === 1 ? params[0] : params;
      this.statement.bind(p, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Resets the row cursor of the statement and preserves the parameter bindings.
   *
   * @see {@link https://github.com/TryGhost/node-sqlite3/wiki/API#resetcallback | sqlite3.Statement.reset} for further informations.
   */
  reset(): Promise<void> {
    return new Promise((resolve) => {
      this.statement.reset(() => {
        resolve();
      });
    });
  }

  /**
   * Finalizes the statement.
   *
   * @see {@link https://github.com/TryGhost/node-sqlite3/wiki/API#finalizecallback | sqlite3.Statement.finalize} for further informations.
   */
  finalize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.statement.finalize((err) => {
        if (err) reject();
        else resolve();
      });
    });
  }

  /**
   * Binds parameters and executes the statement.
   *
   * @see {@link https://github.com/TryGhost/node-sqlite3/wiki/API#runparam---callback | sqlite3.Statement.run} for further informations.
   * @param params - Parameters for the request.
   */
  run(...params: unknown[]): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      // If there is only one argument, unwrap it to allow the user to pass an object for named parameters.
      const p = params.length === 1 ? params[0] : params;
      this.statement.run(p, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  /**
   * Binds parameters, executes the statement and retrieves the first result row.
   *
   * @see {@link https://github.com/TryGhost/node-sqlite3/wiki/API#getparam---callback | sqlite3.Statement.get} for further informations.
   * @param params - Parameters for the request.
   */
  get<T>(...params: unknown[]): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      // If there is only one argument, unwrap it to allow the user to pass an object for named parameters.
      const p = params.length === 1 ? params[0] : params;
      this.statement.get<T>(p, function (err, row) {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Binds parameters, executes the statement and calls the callback with all result rows.
   *
   * @see {@link https://github.com/TryGhost/node-sqlite3/wiki/API#allparam---callback | sqlite3.Statement.all} for further informations.
   * @param params - Parameters for the request.
   */
  all<T>(...params: unknown[]): Promise<T[]> {
    return new Promise((resolve, reject) => {
      // If there is only one argument, unwrap it to allow the user to pass an object for named parameters.
      const p = params.length === 1 ? params[0] : params;
      this.statement.all<T>(p, function (err, rows) {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Binds parameters, executes the statement and calls the callback for each result row.
   *
   * @see {@link https://github.com/TryGhost/node-sqlite3/wiki/API#eachparam---callback--complete | sqlite3.Statement.each} for further informations.
   * @param params - Parameters for the request.
   * @param callback - A callback that take a row.
   */
  each<T>(params: any, callback: (row: T) => void): Promise<number> {
    return new Promise((resolve, reject) => {
      this.statement.each<T>(
        params,
        function (err, row) {
          if (err) reject(err);
          else {
            try {
              callback(row);
            } catch (e) {
              reject(e);
            }
          }
        },
        function (err, count) {
          if (err) reject(err);
          else resolve(count);
        }
      );
    });
  }
}
