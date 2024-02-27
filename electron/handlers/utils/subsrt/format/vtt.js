var FORMAT_NAME = "vtt";

var helper = {
  toMilliseconds: function(s) {
    var match = /^\s*(\d{1,2}:)?(\d{1,2}):(\d{1,2})([.,](\d{1,3}))?\s*$/.exec(s);
    var hh = match[1] ? parseInt(match[1].replace(":", "")) : 0;
    var mm = parseInt(match[2]);
    var ss = parseInt(match[3]);
    var ff = match[5] ? parseInt(match[5]) : 0;
    var ms = hh * 3600 * 1000 + mm * 60 * 1000 + ss * 1000 + ff;
    return ms;
  },
  toTimeString: function(ms) {
    var hh = Math.floor(ms / 1000 / 3600);
    var mm = Math.floor(ms / 1000 / 60 % 60);
    var ss = Math.floor(ms / 1000 % 60);
    var ff = Math.floor(ms % 1000);
    var time = (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm + ":" + (ss < 10 ? "0" : "") + ss + "." + (ff < 100 ? "0" : "") + (ff < 10 ? "0" : "") + ff;
    return time;
  }
};

/******************************************************************************************
 * Parses captions in WebVTT format (Web Video Text Tracks Format)
 ******************************************************************************************/
function parse(content, options) {
  var index = 1;
  var captions = [ ];
  var eol = options.eol || "\r\n";
  var parts = content.split(/\r?\n\r?\n/);
  for (var i = 0; i < parts.length; i++) {
    //WebVTT data
    var regex = /^([^\r\n]+\r?\n)?((\d{1,2}:)?\d{1,2}:\d{1,2}([.,]\d{1,3})?)\s*\-\-\>\s*((\d{1,2}:)?\d{1,2}:\d{1,2}([.,]\d{1,3})?)\r?\n([\s\S]*)(\r?\n)*$/gi;
    var match = regex.exec(parts[i]);
    if (match) {
      var caption = { };
      caption.type = "caption";
      caption.index = index++;
      if (match[1]) {
        caption.cue = match[1].replace(/[\r\n]*/gi, "");
      }
      caption.start = helper.toMilliseconds(match[2]);
      caption.end = helper.toMilliseconds(match[5]);
      caption.duration = caption.end - caption.start;
      var lines = match[8].split(/\r?\n/);
      caption.content = lines.join(eol);
      caption.text = caption.content
        .replace(/\<[^\>]+\>/g, "") //<b>bold</b> or <i>italic</i>
        .replace(/\{[^\}]+\}/g, ""); //{b}bold{/b} or {i}italic{/i}
      captions.push(caption);
      continue;
    }

    //WebVTT meta
    var meta = /^([A-Z]+)(\r?\n([\s\S]*))?$/.exec(parts[i]);
    if (!meta) {
      //Try inline meta
      meta = /^([A-Z]+)\s+([^\r\n]*)?$/.exec(parts[i]);
    }
    if (meta) {
      var caption = { };
      caption.type = "meta";
      caption.name = meta[1];
      if (meta[3]) {
        caption.data = meta[3];
      }
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
 * Builds captions in WebVTT format (Web Video Text Tracks Format)
 ******************************************************************************************/
function build(captions, options) {
  var eol = options.eol || "\r\n";
  var content = "WEBVTT" + eol + eol;
  for (var i = 0; i < captions.length; i++) {
    var caption = captions[i];
    if (caption.type == "meta") {
      if (caption.name == "WEBVTT") continue;
      content += caption.name + eol;
      content += caption.data ? caption.data + eol : "";
      content += eol;
      continue;
    }

    if (typeof caption.type === "undefined" || caption.type == "caption") {
      // content += (i + 1).toString() + eol;
      content += helper.toTimeString(caption.start) + " --> " + helper.toTimeString(caption.end) + eol;
      content += caption.text + eol;
      content += eol;
      continue;
    }

    if (options.verbose) {
      console.log("SKIP:", caption);
    }
  }

  return content;
};

/******************************************************************************************
 * Detects a subtitle format from the content.
 ******************************************************************************************/
function detect(content) {
  if (typeof content !== "string") {
    throw new Error("Expected string content!");
  }

  if (/^[\s\r\n]*WEBVTT\r?\n/g.test(content)) {
    /*
    WEBVTT
    ...
    */
    return "vtt";
  }
};

/******************************************************************************************
 * Export
 ******************************************************************************************/
export default {
  name: FORMAT_NAME,
  helper: helper,
  detect: detect,
  parse: parse,
  build: build
};
