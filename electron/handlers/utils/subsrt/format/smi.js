var FORMAT_NAME = "smi";

var helper = {
  htmlEncode: function(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\</g, '&lt;')
      .replace(/\>/g, '&gt;')
      //.replace(/\s/g, '&nbsp;')
      .replace(/\r?\n/g, '<BR>');
  },
  htmlDecode: function(html, eol){
    return html
      .replace(/\<BR\s*\/?\>/gi, eol || '\r\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }
};

/******************************************************************************************
 * Parses captions in SAMI format (.smi)
 ******************************************************************************************/
function parse(content, options) {
  var captions = [ ];
  var eol = options.eol || "\r\n";

  var title = /\<TITLE[^\>]*\>([\s\S]*)\<\/TITLE\>/gi.exec(content);
  if (title) {
    var caption = { };
    caption.type = "meta";
    caption.name = "title";
    caption.data = title[1].replace(/^[\s\r\n]*/g, "").replace(/[\s\r\n]*$/g, "");
    captions.push(caption);
  }

  var style = /\<STYLE[^\>]*\>([\s\S]*)\<\/STYLE\>/gi.exec(content);
  if (style) {
    var caption = { };
    caption.type = "meta";
    caption.name = "style";
    caption.data = style[1];
    captions.push(caption);
  }

  var sami = content
    .replace(/^[\s\S]*\<BODY[^\>]*\>/gi, "") //Remove content before body
    .replace(/\<\/BODY[^\>]*\>[\s\S]*$/gi, ""); //Remove content after body

  var prev = null;
  var parts = sami.split(/\<SYNC/gi);
  for (var i = 0; i < parts.length; i++) {
    if (!parts[i] || parts[i].trim().length == 0) {
      continue;
    }

    var part = '<SYNC' + parts[i];

    //<SYNC Start = 1000>
    var match = /^\<SYNC[^\>]+Start\s*=\s*["']?(\d+)["']?[^\>]*\>([\s\S]*)/gi.exec(part);
    if (match) {
      var caption = { };
      caption.type = "caption";
      caption.start = parseInt(match[1]);
      caption.end = caption.start + 2000;
      caption.duration = caption.end - caption.start;
      caption.content = match[2].replace(/^\<\/SYNC[^\>]*>/gi, "");

      var blank = true;
      var p = /^\<P[^\>]+Class\s*=\s*["']?([\w\d\-_]+)["']?[^\>]*\>([\s\S]*)/gi.exec(caption.content);
      if (!p) {
        p = /^\<P([^\>]*)\>([\s\S]*)/gi.exec(caption.content);
      }
      if (p) {
        var html = p[2].replace(/\<P[\s\S]+$/gi, ""); //Remove string after another <P> tag
        html = html.replace(/\<BR\s*\/?\>[\s\r\n]+/gi, eol).replace(/\<BR\s*\/?\>/gi, eol).replace(/\<[^\>]+\>/g, ""); //Remove all tags
        html = html.replace(/^[\s\r\n]+/g, "").replace(/[\s\r\n]+$/g, ""); //Trim new lines and spaces
        blank = (html.replace(/&nbsp;/gi, " ").replace(/[\s\r\n]+/g, "").length == 0);
        caption.text  = helper.htmlDecode(html, eol);
      }

      if (!options.preserveSpaces && blank) {
        if (options.verbose) {
          console.log("INFO: Skipping white space caption at " + caption.start);
        }
      }
      else {
        captions.push(caption);
      }

      //Update previous
      if (prev) {
        prev.end = caption.start;
        prev.duration = prev.end - prev.start;
      }
      prev = caption;
      continue;
    }

    if (options.verbose) {
      console.log("WARN: Unknown part", parts[i]);
    }
  }

  return captions;
};

/******************************************************************************************
 * Builds captions in SAMI format (.smi)
 ******************************************************************************************/
function build(captions, options) {
  var eol = options.eol || "\r\n";

  var content = "";
  content += '<SAMI>' + eol;
  content += '<HEAD>' + eol;
  content += '<TITLE>' + (options.title || "") + '</TITLE>' + eol;
  content += '<STYLE TYPE="text/css">' + eol;
  content += '<!--' + eol;
  content += 'P { font-family: Arial; font-weight: normal; color: white; background-color: black; text-align: center; }' + eol;
  content += '.LANG { Name: ' + (options.langName || "English") + '; lang: ' + (options.langCode || "en-US") + '; SAMIType: CC; }' + eol;
  content += '-->' + eol;
  content += '</STYLE>' + eol;
  content += '</HEAD>' + eol;
  content += '<BODY>' + eol;

  for (var i = 0; i < captions.length; i++) {
    var caption = captions[i];
    if (caption.type == "meta") {
      continue;
    }

    if (typeof caption.type === "undefined" || caption.type == "caption") {
      //Start of caption
      content += '<SYNC Start=' + caption.start + '>' + eol;
      content += '  <P Class=LANG>' + helper.htmlEncode(caption.text || "") + (options.closeTags ? '</P>' : "") + eol;
      if (options.closeTags) {
        content += '</SYNC>' + eol;
      }

      //Blank line indicates the end of caption
      content += '<SYNC Start=' + caption.end + '>' + eol;
      content += '  <P Class=LANG>' + '&nbsp;' + (options.closeTags ? '</P>' : "") + eol;
      if (options.closeTags) {
        content += '</SYNC>' + eol;
      }

      continue;
    }

    if (options.verbose) {
      console.log("SKIP:", caption);
    }
  }

  content += '</BODY>' + eol;
  content += '</SAMI>' + eol;

  return content;
};

/******************************************************************************************
 * Detects a subtitle format from the content.
 ******************************************************************************************/
function detect(content) {
  if (typeof content === "string") {
    if (/\<SAMI[^\>]*\>[\s\S]*\<BODY[^\>]*\>/g.test(content)) {
      /*
      <SAMI>
      <BODY>
      <SYNC Start=...
      ...
      </BODY>
      </SAMI>
      */
      return "smi";
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
