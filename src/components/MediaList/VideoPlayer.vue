<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import iconUrl from 'plyr/dist/plyr.svg';
import { useMediasStore } from '../../stores/media';
import { useSubtitlesStore } from '../../stores/subtitles';

const mediasStore = useMediasStore();
const subtitlesStore = useSubtitlesStore();

const videoTarget = ref<HTMLVideoElement | null>(null);
let player: Plyr | null;

onMounted(() => {
  const videoElement = videoTarget.value!;
  player = new Plyr(videoElement!, {
    iconUrl: iconUrl,
    controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'captions', 'settings', 'fullscreen'],
    invertTime: false,
    autoplay: true,
    i18n: {
      speed: '速度',
      normal: '1x',
      loop: '循环播放',
      captions: '字幕',
      enableCaptions: '打开字幕',
      disableCaptions: '关闭字幕',
      disabled: '关闭',
      enabled: '打开',
    },
    blankVideo: '',
    captions: {
      active: true,
      update: true,
    },
    settings: ['loop', 'speed', 'captions'],
  });

  player.on('playing', async () => {
    if (mediasStore.selectedMedia?.location) {
      if (mediasStore.selectedMedia.media_type === 1) { // 仅视频文件截图 和 打开字幕
        const videoElement = player?.media!;
        await mediasStore.captureScreenshot(videoElement);
        player!.toggleCaptions(true);
      }
    }
  });
  player.on('timeupdate', () => {
    subtitlesStore.setActiveId(player?.currentTime || 0);
  });
});

watch(() => mediasStore.selectedMedia?.location, (_newSrc, _oldSrc) => {
  if (player && mediasStore.selectedMedia?.location) {
    player.source = {
      type: mediasStore.selectedMedia.media_type === 1 ? 'video' : 'audio',
      sources: [
        {
          src: mediasStore.selectedMedia.location,
        },
      ],
      tracks: mediasStore.selectedMedia.media_type === 1 ? [{
        kind: 'captions',
        label: '语言',
        srcLang: 'hybrid', // srclang ?
        src: subtitlesStore.vttTrackSrc,
        default: true,
      }] : [],
    };
  }
  setTimeout(() => {
    player?.play();
  }, 100);
}, { immediate: true });
watch(() => subtitlesStore.vttTrackSrc, () => {
  if (player) {
    const videoEle = (player as any).media! as HTMLVideoElement;
    const trackEle = videoEle.querySelector('track[srclang=hybrid]') as HTMLTrackElement;
    if (trackEle) {
      trackEle.src = subtitlesStore.vttTrackSrc;
    }
  }
});
watch(() => mediasStore.needUpdateJumpTime, () => {
  const jumpToTime = mediasStore.exptectJumpedToTime;
  if (player) {
    if (player.currentTime > jumpToTime) {
      player.rewind(player.currentTime - jumpToTime);
    } else {
      player.forward(jumpToTime - player.currentTime)
    }
  }
});

onBeforeUnmount(() => {
  player?.destroy();
  player = null;
});
</script>

<template>
  <div class="video-player">
    <div class="video-wrapper">
      <video class="video-target" ref="videoTarget"></video>
    </div>
  </div>
</template>

<style scoped>
.video-player {
  width: 100%;
  height: auto;
  background-color: #000;
  position: sticky;
  top: 0;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  --plyr-captions-background: rgba(0, 0, 0, 0);
  --plyr-font-size-large: 20px;
  --plyr-font-size-xlarge: 40px;
  --plyr-font-weight-regular: 600;
  --plyr-captions-text-color: #f0f0f0;

  --plyr-font-text-stroke-primary-color: #0491d8;
  --plyr-font-text-stroke-secondary-color: #333;
  --plyr-font-text-stroke-width: 1.2px;
  --plyr-font-text-stroke-width-negative: -1.2px;
  --plyr-font-text-stroke-width-secondary: 0.5px;
  --plyr-font-text-stroke-width-secondary-negative: -0.5px;
  --plyr-font-fullscreen-text-stroke-width: 2px;
  --plyr-font-fullscreen-text-stroke-width-negative: -2px;
  --plyr-font-fullscreen-text-stroke-width-secondary: 1px;
  --plyr-font-fullscreen-text-stroke-width-secondary-negative: -1px;
}
.video-wrapper {
  width: 100%;
  padding-top: 56.25%;
  position: relative;
}
.video-wrapper :deep(.plyr) {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.video-target {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.video-player :deep(.plyr--audio .plyr__controls) {
  position: absolute;
  bottom: 0;
  right: 0;
  left: 0;
}
.video-player :deep(.plyr__caption) {
  letter-spacing: 1px;
  /* -webkit-text-stroke: 1px var(--plyr-font-text-stroke-primary-color); */
  text-shadow:
    var(--plyr-font-text-stroke-width-negative) var(--plyr-font-text-stroke-width-negative) 0 var(--plyr-font-text-stroke-primary-color),
     0   var(--plyr-font-text-stroke-width-negative) 0 var(--plyr-font-text-stroke-primary-color),
     var(--plyr-font-text-stroke-width) var(--plyr-font-text-stroke-width-negative) 0 var(--plyr-font-text-stroke-primary-color),
     var(--plyr-font-text-stroke-width)  0   0 var(--plyr-font-text-stroke-primary-color),
     var(--plyr-font-text-stroke-width)  var(--plyr-font-text-stroke-width) 0 var(--plyr-font-text-stroke-primary-color),
     0    var(--plyr-font-text-stroke-width) 0 var(--plyr-font-text-stroke-primary-color),
    var(--plyr-font-text-stroke-width-negative)  var(--plyr-font-text-stroke-width) 0 var(--plyr-font-text-stroke-primary-color),
    var(--plyr-font-text-stroke-width-negative)  0   0 var(--plyr-font-text-stroke-primary-color);
  display: block;
  line-height: 100%;
}
.video-player :deep(.plyr:fullscreen .plyr__caption) {
  /* -webkit-text-stroke: 2px var(--plyr-font-text-stroke-primary-color); */
  text-shadow:
    var(--plyr-font-fullscreen-text-stroke-width-negative) var(--plyr-font-fullscreen-text-stroke-width-negative) 0 var(--plyr-font-text-stroke-primary-color),
     0   var(--plyr-font-fullscreen-text-stroke-width-negative) 0 var(--plyr-font-text-stroke-primary-color),
     var(--plyr-font-fullscreen-text-stroke-width) var(--plyr-font-fullscreen-text-stroke-width-negative) 0 var(--plyr-font-text-stroke-primary-color),
     var(--plyr-font-fullscreen-text-stroke-width)  0   0 var(--plyr-font-text-stroke-primary-color),
     var(--plyr-font-fullscreen-text-stroke-width)  var(--plyr-font-fullscreen-text-stroke-width) 0 var(--plyr-font-text-stroke-primary-color),
     0    var(--plyr-font-fullscreen-text-stroke-width) 0 var(--plyr-font-text-stroke-primary-color),
    var(--plyr-font-fullscreen-text-stroke-width-negative)  var(--plyr-font-fullscreen-text-stroke-width) 0 var(--plyr-font-text-stroke-primary-color),
    var(--plyr-font-fullscreen-text-stroke-width-negative)  0   0 var(--plyr-font-text-stroke-primary-color);
}
.video-player :deep(.plyr__caption > b), .video-player :deep(.plyr__caption > i) {
  font-size: 0.6em;
  display: block;
  direction: ltr;
  text-shadow:
    var(--plyr-font-text-stroke-width-secondary-negative) var(--plyr-font-text-stroke-width-secondary-negative) 0 var(--plyr-font-text-stroke-secondary-color),
     0   var(--plyr-font-text-stroke-width-secondary-negative) 0 var(--plyr-font-text-stroke-secondary-color),
     var(--plyr-font-text-stroke-width-secondary) var(--plyr-font-text-stroke-width-secondary-negative) 0 var(--plyr-font-text-stroke-secondary-color),
     var(--plyr-font-text-stroke-width-secondary)  0   0 var(--plyr-font-text-stroke-secondary-color),
     var(--plyr-font-text-stroke-width-secondary)  var(--plyr-font-text-stroke-width-secondary) 0 var(--plyr-font-text-stroke-secondary-color),
     0    var(--plyr-font-text-stroke-width-secondary) 0 var(--plyr-font-text-stroke-secondary-color),
    var(--plyr-font-text-stroke-width-secondary-negative)  var(--plyr-font-text-stroke-width-secondary) 0 var(--plyr-font-text-stroke-secondary-color),
    var(--plyr-font-text-stroke-width-secondary-negative)  0   0 var(--plyr-font-text-stroke-secondary-color);
}
.video-player :deep(.plyr__caption > i) {
  font-style: normal;
  direction: rtl;
}
.video-player :deep(.plyr:fullscreen .plyr__caption > b), .video-player :deep(.plyr:fullscreen .plyr__caption > i) {
  direction: ltr;
  text-shadow:
    var(--plyr-font-fullscreen-text-stroke-width-secondary-negative) var(--plyr-font-fullscreen-text-stroke-width-secondary-negative) 0 var(--plyr-font-text-stroke-secondary-color),
     0   var(--plyr-font-fullscreen-text-stroke-width-secondary-negative) 0 var(--plyr-font-text-stroke-secondary-color),
     var(--plyr-font-fullscreen-text-stroke-width-secondary) var(--plyr-font-fullscreen-text-stroke-width-secondary-negative) 0 var(--plyr-font-text-stroke-secondary-color),
     var(--plyr-font-fullscreen-text-stroke-width-secondary)  0   0 var(--plyr-font-text-stroke-secondary-color),
     var(--plyr-font-fullscreen-text-stroke-width-secondary)  var(--plyr-font-fullscreen-text-stroke-width-secondary) 0 var(--plyr-font-text-stroke-secondary-color),
     0    var(--plyr-font-fullscreen-text-stroke-width-secondary) 0 var(--plyr-font-text-stroke-secondary-color),
    var(--plyr-font-fullscreen-text-stroke-width-secondary-negative)  var(--plyr-font-fullscreen-text-stroke-width-secondary) 0 var(--plyr-font-text-stroke-secondary-color),
    var(--plyr-font-fullscreen-text-stroke-width-secondary-negative)  0   0 var(--plyr-font-text-stroke-secondary-color);
}
.video-player :deep(.plyr:fullscreen .plyr__caption > i) {
  font-style: normal;
  direction: rtl;
}
</style>
