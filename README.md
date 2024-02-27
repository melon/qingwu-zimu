# 青梧字幕

青梧字幕是一款基于whisper的字幕自动提取工具。

![](./main-preview.jpg)

青梧字幕AI文字提取程序具体使用的是C语言版本改写的 [whisper.cpp](https://github.com/ggerganov/whisper.cpp)，前端界面使用Electron + vite + typescript，开源版本的青梧字幕是完全本地化的程序，不需要联网，所有数据存于本地，数据库使用的是sqlite。

## 0.官网

[https://zimu.qijingdict.com/zimu/home](https://zimu.qijingdict.com/zimu/home)

## 1.安装

### 1.1 安装npm依赖

```
npm install
```

### 1.1 编译whisper

编译需要`cmake`程序，可以在[这里](https://cmake.org/download/)下载你使用的平台的cmake安装程序，然后根据你的平台执行以下对应的命令：

#### Mac(Arm芯片)

```npm run build```

#### Mac(Intel芯片)

```npm run build-old-mac```

#### Windows

```npm run build-win```

### 1.2 执行

```
npm run dev
```

执行上述命令之后，即可出现青梧字幕的可视化界面。


