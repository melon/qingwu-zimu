import { randStr } from "../../../common/crypto";
import { ITranscriptItem } from "../../../whisper-node/conversion";

function vttTimeToMs(timeStr: string) {
  const [highPart, milliPart] = timeStr.split(/[.]/);
  const [hh, mm, ss] = highPart.split(':');
  return parseInt(hh, 10) * 3600000 + parseInt(mm, 10) * 60000 + parseInt(ss, 10) * 1000 + parseInt(milliPart, 10);
}

export function transformSubs(arr: ITranscriptItem[], refArr: ITranscriptItem[]) {
  const result:ITranscriptItem[] = [];
  for (let i = 0, j = 0; i < refArr.length;) {
    const refItem = refArr[i];
    const item = arr[j];
    if (!item) {
      break;
    }
    const refStart = vttTimeToMs(refItem.start);
    const refEnd = vttTimeToMs(refItem.end);
    const itemStart = vttTimeToMs(item.start);
    const itemEnd = vttTimeToMs(item.end);
    if (refStart === itemStart && refEnd === itemEnd) {
      result.push({
        ...arr[j],
        start: refItem.start,
        end: refItem.end,
      });
      i++;
      j++;
    } else if (
      refStart <= itemStart && refEnd > itemStart
      || itemStart <= refStart && itemEnd > refStart
    ) {
      result.push({
        ...arr[j],
        start: refItem.start,
        end: refItem.end,
      });
      i++;
      j++;
    } else if (refStart >= itemEnd) {
      j++;
    } else {
      result.push({
        start: refItem.start,
        end: refItem.end,
        content: '',
        id: randStr(6),
      });
      i++;
    }
  }
  return result;
}
