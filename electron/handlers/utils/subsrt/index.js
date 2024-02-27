import vttFormat from './format/vtt';
import srtFormat from './format/srt';
import lrcFormat from './format/lrc';
// import ssaFormat from './format/ssa';
// import assFormat from './format/ass';

var subsrt = {
  format: {
    [vttFormat.name]: vttFormat,
    [srtFormat.name]: srtFormat,
    [lrcFormat.name]: lrcFormat,
    // [ssaFormat.name]: ssaFormat,
    // [assFormat.name]: assFormat,
  }
};

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/******************************************************************************************
 * Loads the subtitle format parsers and builders
 ******************************************************************************************/
// (async function init() {
//   //Load in the predefined order
//   var formats = [ "vtt", "lrc", "smi", "ssa", "ass", "sub", "srt", "sbv", "json" ];
//   for (var i = 0; i < formats.length; i++) {
//     var f = formats[i];
//     var handler = await import('./format/' + f + '.js');
//     subsrt.format[handler.name] = handler;
//   }
//   console.log(subsrt.format);
// })();

/******************************************************************************************
 * Gets a list of supported subtitle formats.
 ******************************************************************************************/
subsrt.list = function() {
  return Object.keys(subsrt.format);
};

/******************************************************************************************
 * Detects a subtitle format from the content.
 ******************************************************************************************/
subsrt.detect = function(content) {
  var formats = subsrt.list();
  for (var i = 0; i < formats.length; i++) {
    var f = formats[i];
    var handler = subsrt.format[f];
    if (typeof handler == "undefined") {
      continue;
    }
    if (typeof handler.detect != "function") {
      continue;
    }
    //Function 'detect' can return true or format name
    var d = handler.detect(content);
    if (d === true) { //Logical true
      return f;
    }
    if (f == d) { //Format name
      return d;
    }
  }
};

/******************************************************************************************
 * Parses a subtitle content.
 ******************************************************************************************/
subsrt.parse = function(content, options) {
  options = options || { };
  var format = options.format || subsrt.detect(content);
  if (!format || format.trim().length == 0) {
    throw new Error("Cannot determine subtitle format!");
  }

  var handler = subsrt.format[format];
  if (typeof handler == "undefined") {
    throw new Error("Unsupported subtitle format: " + format);
  }

  var func = handler.parse;
  if (typeof func != "function") {
    throw new Error("Subtitle format does not support 'parse' op: " + format);
  }

  return func(content, options);
};

/******************************************************************************************
 * Builds a subtitle content
 ******************************************************************************************/
subsrt.build = function(captions, options) {
  options = options || { };
  var format = options.format || "srt";
  if (!format || format.trim().length == 0) {
    throw new Error("Cannot determine subtitle format!");
  }

  var handler = subsrt.format[format];
  if (typeof handler == "undefined") {
    throw new Error("Unsupported subtitle format: " + format);
  }

  var func = handler.build;
  if (typeof func != "function") {
    throw new Error("Subtitle format does not support 'build' op: " + format);
  }

  return func(captions, options);
};

/******************************************************************************************
 * Converts subtitle format
 ******************************************************************************************/
subsrt.convert = function(content, options) {
  if (typeof options == "string") {
    options = { to: options };
  }
  options = options || { };

  var opt = clone(options);
  delete opt.format;

  if (opt.from) {
    opt.format = opt.from;
  }

  var captions = subsrt.parse(content, opt);
  if (opt.resync) {
    captions = subsrt.resync(captions, opt.resync);
  }

  opt.format = opt.to || options.format;
  var result = subsrt.build(captions, opt);

  return result;
};

/******************************************************************************************
 * Shifts the time of the captions.
 ******************************************************************************************/
subsrt.resync = function(captions, options) {
  options = options || { };

  var func, ratio, frame, offset;
  if (typeof options == "function") {
    func = options; //User's function to handle time shift
  }
  else if (typeof options == "number") {
    offset = options; //Time shift (+/- offset)
    func = function(a) {
      return [ a[0] + offset, a[1] + offset ];
    };
  }
  else if (typeof options == "object") {
    offset = (options.offset || 0) * (options.frame ? options.fps || 25 : 1);
    ratio = options.ratio || 1.0;
    frame = options.frame;
    func = function(a) {
      return [ Math.round(a[0] * ratio + offset), Math.round(a[1] * ratio + offset) ];
    };
  }
  else {
    throw new Error("Argument 'options' not defined!");
  }

  var resynced = [ ];
  for (var i = 0; i < captions.length; i++) {
    var caption = clone(captions[i]);
    if (typeof caption.type === "undefined" || caption.type == "caption") {
      if (frame) {
        var shift = func([ caption.frame.start, caption.frame.end ]);
        if (shift && shift.length == 2) {
          caption.frame.start = shift[0];
          caption.frame.end = shift[1];
          caption.frame.count = caption.frame.end - caption.frame.start;
        }
      }
      else {
        var shift = func([ caption.start, caption.end ]);
        if (shift && shift.length == 2) {
          caption.start = shift[0];
          caption.end = shift[1];
          caption.duration = caption.end - caption.start;
        }
      }
    }
    resynced.push(caption);
  }

  return resynced;
};

export default subsrt;
