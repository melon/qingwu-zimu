import path from 'node:path';
import { generateRandomFilename } from '../utils';

import orignal_ffmpeg from 'fluent-ffmpeg';
import { app } from 'electron';
import { log } from '../log';

const ffmpegPath = require('ffmpeg-static').replace(
  'app.asar',
  'app.asar.unpacked'
);
const ffprobePath = require('ffprobe-static').path.replace(
  'app.asar',
  'app.asar.unpacked'
);

log.info('ffmpegPath', ffmpegPath);
log.info('ffprobePath', ffprobePath);
orignal_ffmpeg.setFfmpegPath(ffmpegPath);
orignal_ffmpeg.setFfprobePath(ffprobePath);

export const ffmpeg = orignal_ffmpeg;

export async function probe(filePath: string) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      return resolve(metadata);
    });
  });
}

export interface IExtractAudio {
  audioFilePath: string;
}
export async function extractAudio(filePath: string): Promise<IExtractAudio> {
  return new Promise(async (resolve, reject) => {
    try {
      const TMP_DIR = app.getPath('temp');
      const tmpAudioPath = path.join(TMP_DIR, generateRandomFilename(filePath, '.wav'));

      log.info('extractAudio - start ffmpeg');
      // ffmpeg -i input_video.mp4 -vn -acodec pcm_s16le -ar 16000 -ac 1 output_audio.wav
      ffmpeg(filePath)
      .noVideo()
      .audioCodec('pcm_s16le')
      .audioFrequency(16000)
      .audioChannels(1)
      .output(tmpAudioPath)
      .on('start', (commandLine: string) => {
        log.info('start: ', commandLine);
      })
      .on('error', function(err: Error, _stdout: string, _stderr: string) {
        log.error('Cannot process video: ', err.message, err);
        reject(err);
      })
      .on('end', function(stdout: string, _stderr: string) {
        log.info('Transcoding succeeded !');
        log.info(stdout);

        resolve({
          audioFilePath: tmpAudioPath,
        });
      })
      .run();
    } catch (e) {
      log.error('extractAudio', e);
      reject(e);
    }
  });
}

export interface IFileInfo {
  media_type: 'audio' | 'video' | 'unknown';
  duration: number;
}
export function getFileInfo(filePath: string): Promise<IFileInfo> {
  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .ffprobe(function(err, metadata) {
        if (err) {
          log.error('getFileInfo - error ffprobe media', err);
          return reject(err);
        }

        const streams = metadata.streams;

        let media_type: IFileInfo['media_type'];
        let duration: number;

        log.info('getFileInfo - metadata', metadata);
        const videoStream = streams.find(stream => stream.codec_type === 'video');
        // https://stackoverflow.com/questions/56397732/how-can-i-know-a-certain-file-is-a-video-file
        if (videoStream && !isNaN(Number(videoStream.bit_rate))) {
          media_type = 'video';
          duration = Math.floor(parseFloat(videoStream.duration || '0') * 1000);
        } else {
          const audioStream = streams.find(stream => stream.codec_type === 'audio');
          if (audioStream) {
            media_type = 'audio';
            duration = Math.floor(parseFloat(audioStream.duration || '0') * 1000);
          } else {
            media_type = 'unknown';
            duration = 0;
          }
        }

        resolve({
          media_type,
          duration,
        });
      });
  });
}
