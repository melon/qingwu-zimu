/**
 *
 * @param timeStr e.g. '00:00:12,134'
 * @returns seconds
 */
export function parseVttOrSrtTimeToSeconds(timeStr: string) {
  const [highPart, milliPart] = timeStr.split(/[.,]/); // vtt or timestamp format
  const ms = parseInt(milliPart, 10) / 1000;
  const [hh, mm, second] = highPart.split(':');
  return parseInt(hh, 10) * 3600 + parseInt(mm, 10) * 60 + parseInt(second, 10) + ms;
}

export function vttTimeToMs(timeStr: string) {
  const [highPart, milliPart] = timeStr.split(/[.]/);
  const [hh, mm, ss] = highPart.split(':');
  return parseInt(hh, 10) * 3600000 + parseInt(mm, 10) * 60000 + parseInt(ss, 10) * 1000 + parseInt(milliPart, 10);
}

export function msToVttTime(ms: number) {
  const milliPart = ms % 1000;
  const ssTotal = Math.floor(ms / 1000);
  const ss = ssTotal % 60;
  const mmTotal = Math.floor(ssTotal / 60);
  const mm = mmTotal % 60;
  const hhTotal = Math.floor(mmTotal / 60);
  const hh = hhTotal % 60;
  return `${('0'+hh).slice(-2)}:${
    ('0'+mm).slice(-2)
  }:${('0'+ss).slice(-2)}.${('00'+milliPart).slice(-3)}`;
}

function generateAlphanumericChars() {
  let result = '';
  for (let i = 97; i <= 122; i++) {
    result += String.fromCharCode(i);
  }
  for (let i = 48; i <= 57; i++) {
    result += String.fromCharCode(i);
  }
  return result;
}
const alphanumericChars = generateAlphanumericChars();
export function randomAlphanumericStr(len = 32) {
  let result = '';
  const characters = alphanumericChars;
  for (let i = 0; i < len; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }
  return result;
}

export function wait(interval: number) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(undefined);
    }, interval);
  });
}

export type CreateStackRes<T> = {
  isOldest: boolean,
  isNewest: boolean,
  push: (value: T | ((current: T) => T)) => T,
  undo: () => T,
  redo: () => T,
}
export function createStack<T>(current: T): CreateStackRes<T> {
  const stack = [current]

  let index = stack.length

  function update() {
    current = stack[index - 1]

    return current
  }

  return {
    get isOldest() {
      return current === stack[0];
    },
    get isNewest() {
      return current === stack[stack.length - 1];
    },
    push: (value: T | ((current: T) => T)) => {
      stack.length = index
      // @ts-expect-error: Value can be a function
      stack[index++] = typeof value === 'function' ? (value)(current) : value

      return update()
    },
    undo: () => {
      if (index > 1)
        index -= 1
      return update()
    },
    redo: () => {
      if (index < stack.length)
        index += 1
      return update()
    },
  }
}
