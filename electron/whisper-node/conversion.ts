export type ITranscriptItem = {
  start: string;
  end: string;
  content: string;
  id: string;
}

const LINE_REG = /^\[(\d\d:[0-5]\d:[0-5]\d.\d\d\d) \-\-> (\d\d:[0-5]\d:[0-5]\d.\d\d\d)\](.*)$/;
export function whisperOutputToArray(vtt: string): ITranscriptItem[] {
  const lines: string[] = vtt.trim().split('\n');

  let item: ITranscriptItem = {
    start: '',
    end: '',
    content: '',
    id: ''
  };
  const arr: ITranscriptItem[] = [];
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    const result = LINE_REG.exec(line);
    if (result) {
      item.start = result[1];
      item.end = result[2];
      item.content = result[3].trim();
      item.id = String(arr.length);
      arr.push(item);
      // clear
      item = {
        start: '',
        end: '',
        content: '',
        id: ''
      };
    }
  }

  return arr;
}

// log(whisperOutputToArray(`[00:08:22.000 --> 00:08:25.580]   [ visãoale / Lin란한 반가 vagy / 같은 문제들과 관계힛 바구니 ]
// [00:08:25.580 --> 00:08:28.100]   [ 기존경상 /rod]
// [00:08:28.100 --> 00:08:31.180]   [ 예전! / Share! beads / 사 cult ]
// [00:08:31.180 --> 00:08:34.620]   [ cs ]
// [00:08:34.620 --> 00:08:38.360]   [ 부풍 ]
// [00:08:38.360 --> 00:08:42.560]   [ 팬 ]
// [00:08:42.560 --> 00:08:45.280]   [ 부품 1. 10회]
// [00:08:45.280 --> 00:08:49.240]   [ 7회 / 부품 3. 10회 / 비교]`));

export function arrayToVttWithoutHeader(arr: ITranscriptItem[]) {
  return arr.map(item => {
    const tsLine = `${item.start} --> ${item.end}`;
    return `${tsLine}\n${item.content}\n`;
  }).join('\n');
}

export function arrayToVtt(arr: ITranscriptItem[]) {
  return `WEBVTT\n\n${arrayToVttWithoutHeader(arr)}`;
}

export function arrayToSrt(arr: ITranscriptItem[]) {
  return arr.map((item, index) => {
    const tsLine = `${item.start} --> ${item.end}`.replace(/\./g, ',');
    return `${index + 1}\n${tsLine}\n${item.content}\n`;
  }).join('\n');
}

function vttTimeToLrcTime(timeStr: string) {
  const [highPart, milliPart] = timeStr.split(/[.]/);
  const newHS = milliPart.slice(0, 2);
  const [hh, mm, second] = highPart.split(':');
  const mmNum = (parseInt(hh, 10) * 60 + parseInt(mm , 10)) % 100;
  const newMM = mmNum < 10 ? `0${mmNum}` : `${mmNum}`;
  return `${newMM}:${second}.${newHS}`;
}
export function arrayToLrc(arr: ITranscriptItem[]) {
  return arr.map((item) => {
    const time = vttTimeToLrcTime(item.start);
    return `[${time}]${item.content.replace(/\n/g, ' ')}\n`;
  }).join('');
}

const TS_REG = /^(\d\d:[0-5]\d:[0-5]\d.\d\d\d) \-\-> (\d\d:[0-5]\d:[0-5]\d.\d\d\d)$/;
export function vttToArray(rawVtt: string): ITranscriptItem[] {
  if (typeof rawVtt !== 'string') {
    throw new Error('vttToArray invalid input');
  }
  const vtt = rawVtt.replace('WEBVTT\n\n', '').trim();
  const lines: string[] = vtt.split('\n');

  let item: ITranscriptItem = {
    start: '',
    end: '',
    content: '',
    id: ''
  };
  const arr: ITranscriptItem[] = [];

  function collect() {
    if (item.start && item.end && item.content) {
      item.content = item.content.trim(); // remove trailing '\n'
      item.id = String(arr.length);
      arr.push(item);
      // clear
      item = {
        start: '',
        end: '',
        content: '',
        id: ''
      };
    }
  }
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    const result = TS_REG.exec(line);
    if (result) {
      collect();
      item.start = result[1];
      item.end = result[2];
    } else {
      item.content += line + '\n';
    }
  }
  collect();
  return arr;
}
