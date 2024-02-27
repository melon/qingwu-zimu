var FORMAT_NAME = "sub";
var DEFAULT_FPS = 25;

/******************************************************************************************
 * Parses captions in MicroDVD format: https://en.wikipedia.org/wiki/MicroDVD
 ******************************************************************************************/
function parse(content, options) {
  var fps = options.fps > 0 ? options.fps : DEFAULT_FPS;
  var captions = [ ];
  var eol = options.eol || "\r\n";
  var parts = content.split(/\r?\n/g);
  for (var i = 0; i < parts.length; i++) {
    var regex = /^\{(\d+)\}\{(\d+)\}(.*)$/gi;
    var match = regex.exec(parts[i]);
    if (match) {
      var caption = { };
      caption.type = "caption";
      caption.index = i + 1;
      caption.frame = {
        start: parseInt(match[1]),
        end: parseInt(match[2])
      };
      caption.frame.count = caption.frame.end - caption.frame.start;
      caption.start = Math.round(caption.frame.start / fps);
      caption.end = Math.round(caption.frame.end / fps);
      caption.duration = caption.end - caption.start;
      var lines = match[3].split(/\|/g);
      caption.content = lines.join(eol);
      caption.text = caption.content.replace(/\{[^\}]+\}/g, ""); //{0}{25}{c:$0000ff}{y:b,u}{f:DeJaVuSans}{s:12}Hello!
      captions.push(caption);
      continue;
    }

    if (options.verbose) {
      console.log("WARN: Unknown part", parts[i]);
    }
  }
  return captions;
};

/******************************************************************************************
 * Builds captions in MicroDVD format: https://en.wikipedia.org/wiki/MicroDVD
 ******************************************************************************************/
function build(captions, options) {
  var fps = options.fps > 0 ? options.fps : DEFAULT_FPS;

  var sub = "";
  var eol = options.eol || "\r\n";
  for (var i = 0; i < captions.length; i++) {
    var caption = captions[i];
    if (typeof caption.type === "undefined" || caption.type == "caption") {
      var startFrame = typeof caption.frame == "object" && caption.frame.start >= 0 ? caption.frame.start : caption.start * fps;
      var endFrame = typeof caption.frame == "object" && caption.frame.end >= 0 ? caption.frame.end : caption.end * fps;
      var text = caption.text.replace(/\r?\n/, "|");
      sub += "{" + startFrame + "}" + "{" + endFrame + "}" + text + eol;
      continue;
    }

    if (options.verbose) {
      console.log("SKIP:", caption);
    }
  }

  return sub;
};

/******************************************************************************************
 * Detects a subtitle format from the content.
 ******************************************************************************************/
function detect(content) {
  if (typeof content === "string") {
    if (/^\{\d+\}\{\d+\}(.*)/.test(content)) {
      /*
      {7207}{7262}Sister, perfume?
      */
      return FORMAT_NAME;
    }
  }
};

/******************************************************************************************
 * Export
 ******************************************************************************************/
export default {
  name: FORMAT_NAME,
  detect: detect,
  parse: parse,
  build: build
};
