import { log } from "../log";
import { connectDb } from "../sql";

export type IGetStoreValue = {
  keys: string[];
}
export type IKeyValueStoreDbRes = {
  id: number;
  key: string;
  value: string;
  create_time: string;
  modify_time: string;
}
export type IKeyValueStoreRes = {
  values: IKeyValueStoreDbRes[];
  errno?: never;
} | {
  values?: never;
  errno: string;
}
export async function getStoreValue(_event: Electron.IpcMainInvokeEvent, { keys }: IGetStoreValue): Promise<IKeyValueStoreRes> {
  return await _getStoreValue({ keys });
}
export async function _getStoreValue({ keys }: IGetStoreValue): Promise<IKeyValueStoreRes> {
  try {
    const db = await connectDb();
    const result = await db.all<IKeyValueStoreDbRes>(`SELECT * FROM key_value_store WHERE key IN (${keys.map(_ => '?').join(',')})`, [
      ...keys,
    ]);
    if (!result) {
      return {
        errno: 'ERROR_KEY_VALUE_STORE_GET',
      };
    }
    // final return might be:
    // { values: [undefined, undefined] }
    return {
      values: keys.map(key => {
        const item = result.find(item => item.key === key)!;
        return item;
      }),
    };
  } catch (e) {
    log.error('getStoreValue: ', e);
    return {
      errno: 'ERROR_KEY_VALUE_STORE_GET_CAUGHT',
    };
  }
}

export type ISetStoreValue = {
  key: string;
  value: string;
}
export type ISetStoreValueRes = {
  errno?: string;
}
export async function setStoreValue(_event: Electron.IpcMainInvokeEvent, { key, value }: ISetStoreValue): Promise<ISetStoreValueRes> {
  return await _setStoreValue({ key, value });
}
export async function _setStoreValue({ key, value }: ISetStoreValue): Promise<ISetStoreValueRes> {
  try {
    const db = await connectDb();
    const result = await db.get<IKeyValueStoreDbRes>(`SELECT * FROM key_value_store WHERE key = ?`, [
      key,
    ]);
    if (result) {
      await db.run(`UPDATE key_value_store SET value = ? WHERE key = ?`, [
        value,
        key,
      ]);
    } else {
      await db.run(`INSERT INTO key_value_store (key, value) VALUES (?, ?)`, [
        key,
        value,
      ]);
    }
    return {};
  } catch (e) {
    log.error('setStoreValue: ', e);
    return {
      errno: 'ERROR_KEY_VALUE_STORE_SET_CAUGHT',
    };
  }
}
