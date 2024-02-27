var FORMAT_NAME = "lrc";

var helper = {
  toMilliseconds: function(s) {
    var match = /^\s*(\d+):(\d{1,2})([.,](\d{1,3}))?\s*$/.exec(s);
    var mm = parseInt(match[1]);
    var ss = parseInt(match[2]);
    var ff = match[4] ? parseInt(match[4]) : 0;
    var ms = mm * 60 * 1000 + ss * 1000 + ff * 10;
    return ms;
  },
  toTimeString: function(ms) {
    var mm = Math.floor(ms / 1000 / 60);
    var ss = Math.floor(ms / 1000 % 60);
    var ff = Math.floor(ms % 1000);
    var time = (mm < 10 ? "0" : "") + mm + ":" + (ss < 10 ? "0" : "") + ss + "." + (ff < 100 ? "0" : "") + (ff < 10 ? "0" : Math.floor(ff / 10));
    return time;
  }
};

/******************************************************************************************
 * Parses captions in LRC format: https://en.wikipedia.org/wiki/LRC_%28file_format%29
 ******************************************************************************************/
function parse(content, options) {
  var prev = null;
  var captions = [ ];
  var eol = options.eol || "\r\n";
  var parts = content.split(/\r?\n/);
  for (var i = 0; i < parts.length; i++) {
    if (!parts[i] || parts[i].trim().length == 0) {
      continue;
    }

    //LRC content
    var regex = /^\[(\d{1,2}:\d{1,2}([.,]\d{1,3})?)\](.*)(\r?\n)*$/gi;
    var match = regex.exec(parts[i]);
    if (match) {
      var caption = { };
      caption.type = "caption";
      caption.start = helper.toMilliseconds(match[1]);
      caption.end = caption.start + 2000;
      caption.duration = caption.end - caption.start;
      caption.content = match[3];
      caption.text = caption.content;
      captions.push(caption);

      //Update previous
      if (prev) {
        prev.end = caption.start;
        prev.duration = prev.end - prev.start;
      }
      prev = caption;
      continue;
    }

    //LRC meta
    var meta = /^\[([\w\d]+):([^\]]*)\](\r?\n)*$/gi.exec(parts[i]);
    if (meta) {
      var caption = { };
      caption.type = "meta";
      caption.tag = meta[1];
      if (meta[2]) {
        caption.data = meta[2];
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
 * Builds captions in LRC format: https://en.wikipedia.org/wiki/LRC_%28file_format%29
 ******************************************************************************************/
function build(captions, options) {
  var content = "";
  var lyrics = false;
  var eol = options.eol || "\r\n";
  for (var i = 0; i < captions.length; i++) {
    var caption = captions[i];
    if (caption.type == "meta") {
      if (caption.tag && caption.data) {
        content += "[" + caption.tag + ":" + caption.data.replace(/[\r\n]+/g, " ") + "]" + eol;
      }
      continue;
    }

    if (typeof caption.type === "undefined" || caption.type == "caption") {
      if (!lyrics) {
        content += eol; //New line when lyrics start
        lyrics = true;
      }
      content += "[" + helper.toTimeString(caption.start) + "]" + caption.text + eol;
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
  if (typeof content === "string") {
    if (/\r?\n\[(\d+:\d{1,2}([.,]\d{1,3})?)\](.*)\r?\n/.test(content)) {
      /*
      [04:48.28]Sister, perfume?
      */
      //return "lrc";
      return true;
    }
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
