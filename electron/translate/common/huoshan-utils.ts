import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import qs from 'qs';
import { hmacSha256, hmacSha256Buffer, sha256 } from '../../common/crypto';

dayjs.extend(utc);
dayjs.extend(timezone);

export function getCurrentFormattedTime() {
  return dayjs().utc().format('YYYYMMDD[T]HHmmss[Z]');
}

function toDate(formattedTimeStr: string) {
  return formattedTimeStr.slice(0, 8);
}


function buildAuthHeader(algorithm: string, accessKeyID: string, credentialScope: string, signedHeaders: string, signature: string) {
  return `${algorithm} `
      + `Credential=${accessKeyID}/${credentialScope}, `
      + `SignedHeaders=${signedHeaders}, `
      + `Signature=${signature}`;
}

function getCanonicalQueryString(query: Record<string, string>) {
  return qs.stringify(query, {
    sort: (a, b) => {
      return a.localeCompare(b)
    },
  });
}
function getCanonicalHeadersInfo(headers: Record<string, string>) {
  const keys = Object.keys(headers);
  const sortedKeys = keys.sort((a, b) => a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase()));
  const signedHeaders = sortedKeys.map(key => key.toLocaleLowerCase()).join(';');
  const canonicalHeaders = sortedKeys.map(key => {
    return key.toLocaleLowerCase() + ':' + headers[key].trim() + '\n';
  }).join('');
  return {
    signedHeaders,
    canonicalHeaders,
  };
}
export type ICanonicalRequest = {
  method: 'GET' | 'POST';
  uri: string;
  query: Record<string, string>;
  bodyHash: string;
}
export function getCanonicalRequest(request: ICanonicalRequest, canonicalHeaders: string, signedHeaders: string) {
  const { method, uri, query, bodyHash } = request;

  return `${method}\n`
    + `${uri}\n`
    + `${getCanonicalQueryString(query)}\n`
    + `${canonicalHeaders}\n`
    + `${signedHeaders}\n`
    + bodyHash;
}

function getSigningKey(secretAccessKey: string, date: string, region: string, service: string) {
  const kDate = hmacSha256Buffer(secretAccessKey, date).digest();
  const kRegion = hmacSha256Buffer(kDate, region).digest();
  const kService = hmacSha256Buffer(kRegion, service).digest();
  return hmacSha256Buffer(kService, 'request').digest();
}

export type IGetAuthorizationHeaderOptions = {
  method: 'GET' | 'POST',
  bodyHash: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  service?: string;
  accessKeyID: string;
  secretAccessKey: string;
}
export function getAuthorizationHeader({ method, bodyHash, query, headers, service = 'translate', accessKeyID, secretAccessKey }: IGetAuthorizationHeaderOptions) {
  const region = 'cn-north-1';

  const time = headers['X-Date'];
  const date = toDate(time);

  const { canonicalHeaders, signedHeaders } = getCanonicalHeadersInfo(headers);
  const canonicalRequestStr = getCanonicalRequest({
    method,
    uri: '/',
    query: query,
    bodyHash,
  }, canonicalHeaders, signedHeaders);

  const algorithm = 'HMAC-SHA256';
  const credentialScope = `${date}/${region}/${service}/request`;
  const stringToSign = `${algorithm}\n`
    + `${time}\n`
    + `${credentialScope}\n`
    + `${sha256(canonicalRequestStr)}`;

  const signingKey = getSigningKey(secretAccessKey, date, region, service);
  const signature = hmacSha256(signingKey, stringToSign);

  return buildAuthHeader(algorithm, accessKeyID, credentialScope, signedHeaders, signature);
}
