var FORMAT_NAME = "sbv";

var helper = {
  toMilliseconds: function(s) {
    var match = /^\s*(\d{1,2}):(\d{1,2}):(\d{1,2})([.,](\d{1,3}))?\s*$/.exec(s);
    var hh = parseInt(match[1]);
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
 * Parses captions in SubViewer format (.sbv)
 ******************************************************************************************/
function parse(content, options) {
  var captions = [ ];
  var eol = options.eol || "\r\n";
  var parts = content.split(/\r?\n\s+\r?\n/);
  for (var i = 0; i < parts.length; i++) {
    var regex = /^(\d{1,2}:\d{1,2}:\d{1,2}([.,]\d{1,3})?)\s*[,;]\s*(\d{1,2}:\d{1,2}:\d{1,2}([.,]\d{1,3})?)\r?\n([\s\S]*)(\r?\n)*$/gi;
    var match = regex.exec(parts[i]);
    if (match) {
      var caption = { };
      caption.type = "caption";
      caption.start = helper.toMilliseconds(match[1]);
      caption.end = helper.toMilliseconds(match[3]);
      caption.duration = caption.end - caption.start;
      var lines = match[5].split(/\[br\]|\r?\n/gi);
      caption.content = lines.join(eol);
      caption.text = caption.content.replace(/\>\>\s*[^:]+:\s*/g, ""); //>> SPEAKER NAME:
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
 * Builds captions in SubViewer format (.sbv)
 ******************************************************************************************/
function build(captions, options) {
  var content = "";
  var eol = options.eol || "\r\n";
  for (var i = 0; i < captions.length; i++) {
    var caption = captions[i];
    if (typeof caption.type === "undefined" || caption.type == "caption") {
      content += helper.toTimeString(caption.start) + "," + helper.toTimeString(caption.end) + eol;
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

  if (/\d{1,2}:\d{1,2}:\d{1,2}([.,]\d{1,3})?\s*[,;]\s*\d{1,2}:\d{1,2}:\d{1,2}([.,]\d{1,3})?/g.test(content)) {
    /*
    00:04:48.280,00:04:50.510
    Sister, perfume?
    */
    return "sbv";
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
