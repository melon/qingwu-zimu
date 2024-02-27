import { createHash, createHmac } from 'node:crypto';

export function randStr(len: number) {
  let str = '';
  while (str.length < len) {
    str += Math.random().toString(36).slice(2);
  }
  str = str.slice(0, len);
  return str.split('').map(char => Math.random() > 0.5 ? char.toUpperCase() : char).join('');
}

export function sha256(plaintext: string) {
  const hash = createHash('sha256');
  hash.update(plaintext);
  return hash.digest('hex');
}

export function md5(plaintext: string) {
  const hash = createHash('md5');
  hash.update(plaintext);
  return hash.digest('hex');
}

export function hmacSha256(secretkey: string | Buffer, plaintext: string) {
  const hmac = createHmac('sha256', secretkey);
  hmac.update(plaintext);
  return hmac.digest('hex');
}

export function hmacSha256Buffer(secretkey: string | Buffer, plaintext: string) {
  const hmac = createHmac('sha256', secretkey);
  hmac.update(plaintext);
  return hmac;
}
