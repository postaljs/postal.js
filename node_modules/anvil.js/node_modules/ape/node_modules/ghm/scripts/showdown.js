//
// showdown.js -- A javascript port of Markdown.
//
// Copyright (c) 2007 John Fraser.
//
// Original Markdown Copyright (c) 2004-2005 John Gruber
//   <http://daringfireball.net/projects/markdown/>
//
// Redistributable under a BSD-style open source license.
// See license.txt for more information.
//
// Apres fork from: 
//
// https://github.com/apres/github-flavored-markdown

//
// Wherever possible, Showdown is a straight, line-by-line port
// of the Perl version of Markdown.
//
// This is not a normal parser design; it's basically just a
// series of string substitutions.  It's hard to read and
// maintain this way,  but keeping Showdown close to the original
// design makes it easier to port new features.
//
// More importantly, Showdown behaves like markdown.pl in most
// edge cases.  So web applications can do client-side preview
// in Javascript, and then build identical HTML on the server.
//
// This port needs the new RegExp functionality of ECMA 262,
// 3rd Edition (i.e. Javascript 1.5).  Most modern web browsers
// should do fine.  Even with the new regular expression features,
// We do a lot of work to emulate Perl's regex functionality.
// The tricky changes in this file mostly have the "attacklab:"
// label.  Major or self-explanatory changes don't.
//
// Smart diff tools like Araxis Merge will be able to match up
// this file with markdown.pl in a useful way.  A little tweaking
// helps: in a copy of markdown.pl, replace "#" with "//" and
// replace "$text" with "text".  Be sure to ignore whitespace
// and line endings.


// Showdown usage:
//
//   var text = "Markdown *rocks*.";
//
//   var converter = new Showdown.converter();
//   var html = converter.makeHtml(text);
//
//   alert(html);


// **************************************************
// GitHub Flavored Markdown modifications by Tekkub
// http://github.github.com/github-flavored-markdown/
//
// Modifications are tagged with "GFM"
// **************************************************

// **************************************************
// Node.JS port by Isaac Z. Schlueter
//
// Modifications are tagged with "isaacs"
// **************************************************

// **************************************************
// Minor modifications and
//  brutal stylistic changes by Thom Blake
// Modifications are **everywhere**
// **************************************************

// **************************************************
// AMD compatibility by Casey Duncan
//
// Modifications are **AMD**
// **************************************************

// Showdown namespace
var Showdown = {}

// isaacs: export the Showdown object
if (typeof exports === "object") {
  Showdown = exports
  // isaacs: expose top-level parse() method, like other to-html parsers.
  Showdown.parse = function (md, gh) {
    var converter = new Showdown.converter()
    return converter.makeHtml(md, gh)
  }
}

// AMD: define showdown module
if (typeof define === 'function' && define.amd) {
  define(function() {
    // All we want to do is parse, really
    Showdown.parse = function(md, gh) {
      var converter = new Showdown.converter();
      return converter.makeHtml(md, gh);
    }
    return Showdown;
  });
}

// isaacs: Declare "GitHub" object in here, since Node modules
// execute in a closure or separate context, rather than right
// in the global scope.  If in the browser, this does nothing.
var GitHub

// converter
// Wraps all "globals" so that the only thing
// exposed is makeHtml().
Showdown.converter = function () {

  // Globals:

  // Global hashes, used by various utility routines
  var g_urls
  var g_titles
  var g_html_blocks

  // Used to track when we're inside an ordered or unordered list
  // (see _ProcessListItems() for details):
  var g_list_level = 0

  // A home for long-winded regex
  // re.html is via Friedl's "Mastering Regular Expressions", 2nd Ed.
  var re =
      { url: /https?\:\/\/[^"\s\<\>]*[^.,;'">\:\s\<\>\)\]\!]/g
      , email: /[a-z0-9_\-+=.]+@[a-z0-9\-]+(\.[a-z0-9-]+)+/ig
      , sha1: /[a-f0-9]{40}/ig
      , userSha1: /([a-z0-9_\-+=.]+)@([a-f0-9]{40})/ig
      , repoSha1: /([a-z0-9_\-+=.]+\/[a-z0-9_\-+=.]+)@([a-f0-9]{40})/ig
      , issue: /#([0-9]+)/ig
      , userIssue: /([a-z0-9_\-+=.]+)#([0-9]+)/ig
      , repoIssue: /([a-z0-9_\-+=.]+\/[a-z0-9_\-+=.]+)#([0-9]+)/ig
      , linkDef: /^[ ]{0,3}\[(.+)\]:[ \t]*\n?[ \t]*<?(\S+?)>?[ \t]*\n?[ \t]*(?:(\n*)["(](.+?)[")][ \t]*)?(?:\n+|\Z)/gm
      , nested: /^(<(p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math|ins|del)\b[^\r]*?\n<\/\2>[ \t]*(?=\n+))/gm
      , liberal: /^(<(p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math)\b[^\r]*?.*<\/\2>[ \t]*(?=\n+)\n)/gm
      , hr: /(\n[ ]{0,3}(<(hr)\b([^<>])*?\/?>)[ \t]*(?=\n{2,}))/g
      , comment: /(\n\n[ ]{0,3}<!(--[^\r]*?--\s*)+>[ \t]*(?=\n{2,}))/g
      , processor: /(?:\n\n)([ ]{0,3}(?:<([?%])[^\r]*?\2>)[ \t]*(?=\n{2,}))/g
      , html: /(<[a-z\/!$]("[^"]*"|'[^']*'|[^'">])*>|<!(--.*?--\s*)+>)/gi
      , referenceLink: /(\[((?:\[[^\]]*\]|[^\[\]])*)\][ ]?(?:\n[ ]*)?\[(.*?)\])()()()()/g
      , inlineLink: /(\[((?:\[[^\]]*\]|[^\[\]])*)\]\([ \t]*()<?(.*?)>?[ \t]*((['"])(.*?)\6[ \t]*)?\))/g
      , shortcutLink: /(\[([^\[\]]+)\])()()()()()/g
      , referenceImage: /(!\[(.*?)\][ ]?(?:\n[ ]*)?\[(.*?)\])()()()()/g
      , inlineImage: /(!\[(.*?)\]\s?\([ \t]*()<?(\S+?)>?[ \t]*((['"])(.*?)\6[ \t]*)?\))/g
      , setextH1: /^(.+)[ \t]*\n=+[ \t]*\n+/gm
      , setextH2: /^(.+)[ \t]*\n-+[ \t]*\n+/gm
      , atxHeader: /^(\#{1,6})[ \t]*(.+?)[ \t]*\#*\n+/gm
      , list: /^(([ ]{0,3}([*+-]|\d+[.])[ \t]+)[^\r]+?(~0|\n{2,}(?=\S)(?![ \t]*(?:[*+-]|\d+[.])[ \t]+)))/gm
      , list2: /(\n\n|^\n?)(([ ]{0,3}([*+-]|\d+[.])[ \t]+)[^\r]+?(~0|\n{2,}(?=\S)(?![ \t]*(?:[*+-]|\d+[.])[ \t]+)))/g
      , listStr: /(\n)?(^[ \t]*)([*+-]|\d+[.])[ \t]+([^\r]+?(\n{1,2}))(?=\n*(~0|\2([*+-]|\d+[.])[ \t]+))/gm
      , codeBlock: /(?:\n\n|^)((?:(?:[ ]{4}|\t).*\n+)+)(\n*[ ]{0,3}[^ \t\n]|(?=~0))/g
      , codeSpan: /(^|[^\\])(`+)([^\r]*?[^`])\2(?!`)/gm
      , fenced: /\s*```(\w*)\s*$([\s\S]*)$\s*```\s*$/gm
      , strong: /(\*\*|__)(?=\S)([^\r]*?\S[*_]*)\1/g
      , em: /(\*|_)(?=\S)([^\r]*?\S)\1/g
      , blockQuote: /((^[ \t]*>[ \t]?.+\n(.+\n)*\n*)+)/gm
      , autoLink: /<((https?|ftp|dict):[^'">\s]+)>/gi
      , autoEmail: /<(?:mailto:)?([-.\w]+\@[-a-z0-9]+(\.[-a-z0-9]+)*\.[a-z]+)>/gi
      , pre: /(\s*<pre>[^\r]+?<\/pre>)/gm
      }

  // isaacs - Allow passing in the GitHub object as an argument.
  this.makeHtml = function (text, gh) {
    if (typeof gh !== "undefined") {
      if (typeof gh === "string") gh = {nameWithOwner:gh}
      GitHub = gh
    }

    // Main function. The order in which other subs are called here is
    // essential. Link and image substitutions need to happen before
    // _EscapeSpecialCharsWithinTagAttributes(), so that any *'s or _'s in the
    // <a> and <img> tags get encoded.

    // Clear the global hashes. If we don't clear these, you get conflicts
    // from other articles when generating a page which contains more than
    // one article (e.g. an index page that shows the N most recent
    // articles):
    g_urls = new Array()
    g_titles = new Array()
    g_html_blocks = new Array()

    // attacklab: Replace ~ with ~T
    // This lets us use tilde as an escape char to avoid md5 hashes
    // The choice of character is arbitray; anything that isn't
    // magic in Markdown will work.
    text = text.replace(/~/g,"~T")

    // attacklab: Replace $ with ~D
    // RegExp interprets $ as a special character
    // when it's in a replacement string
    text = text.replace(/\$/g,"~D")

    // Standardize line endings
    text = text.replace(/\r\n/g,"\n") // DOS to Unix
    text = text.replace(/\r/g,"\n") // Mac to Unix

    // Make sure text begins and ends with a couple of newlines:
    text = "\n\n" + text + "\n\n"

    // Convert all tabs to spaces.
    text = _Detab(text)

    // Strip any lines consisting only of spaces and tabs.
    // This makes subsequent regexen easier to write, because we can
    // match consecutive blank lines with /\n+/ instead of something
    // contorted like /[ \t]*\n+/ .
    text = text.replace(/^[ \t]+$/mg,"")

    // Turn block-level HTML blocks into hash entries
    text = _HashHTMLBlocks(text)

    // Strip link definitions, store in hashes.
    text = _StripLinkDefinitions(text)

    text = _RunBlockGamut(text)

    text = _UnescapeSpecialChars(text)

    // attacklab: Restore dollar signs
    text = text.replace(/~D/g,"$$")

    // attacklab: Restore tildes
    text = text.replace(/~T/g,"~")

    // ** GFM **  Auto-link URLs and emails
    text = text.replace(re.url, function (wholeMatch,matchIndex) {
             var left = text.slice(0, matchIndex)
               , right = text.slice(matchIndex)
             if (left.match(/<[^>]+$/) && right.match(/^[^>]*>/)) {
               return wholeMatch
             }
             var href = wholeMatch.replace( /^http:\/\/github.com\//
                                          , "https://github.com/"
                                          )
             return "<a href='" + href + "'>" + wholeMatch + "</a>"
           })

    text = text.replace(re.email, function (wholeMatch) {
             return "<a href='mailto:" + wholeMatch + "'>" + wholeMatch + "</a>"
           })

    // ** GFM ** Auto-link sha1 if GitHub.nameWithOwner is defined
    text = text.replace(re.sha1, function (wholeMatch,matchIndex) {
             if ( typeof(GitHub) == "undefined"
               || typeof(GitHub.nameWithOwner) == "undefined" ) {
               return wholeMatch
             }
             var left = text.slice(0, matchIndex)
               , right = text.slice(matchIndex)
             if ( left.match(/@$/)
               || ( left.match(/<[^>]+$/) && right.match(/^[^>]*>/) ) ) {
               return wholeMatch
             }
             return "<a href='http://github.com/" + GitHub.nameWithOwner
                  + "/commit/" + wholeMatch + "'>"
                  + wholeMatch.substring(0,7) + "</a>"
           })

    // ** GFM ** Auto-link user@sha1 if GitHub.nameWithOwner is defined
    text = text.replace(re.userSha1, function (wholeMatch,username,sha,matchIndex) {
             if ( typeof(GitHub) == "undefined"
               || typeof(GitHub.nameWithOwner) == "undefined" ) {
               return wholeMatch
             }
             GitHub.repoName = GitHub.repoName || _GetRepoName()
             var left = text.slice(0, matchIndex)
               , right = text.slice(matchIndex)
             if ( left.match(/\/$/)
               || ( left.match(/<[^>]+$/) && right.match(/^[^>]*>/) ) ) {
               return wholeMatch
             }
             return "<a href='http://github.com/" + username + "/"
                  + GitHub.repoName + "/commit/" + sha + "'>" + username
                  + "@" + sha.substring(0,7) + "</a>"
           })

    // ** GFM ** Auto-link user/repo@sha1
    text = text.replace(re.repoSha1, function (wholeMatch,repo,sha) {
             return "<a href='http://github.com/" + repo + "/commit/"
                  + sha + "'>" + repo + "@" + sha.substring(0,7) + "</a>"
           })

    // ** GFM ** Auto-link #issue if GitHub.nameWithOwner is defined
    text = text.replace(re.issue, function (wholeMatch,issue,matchIndex) {
             if ( typeof(GitHub) == "undefined"
               || typeof(GitHub.nameWithOwner) == "undefined") {
               return wholeMatch
             }
             var left = text.slice(0, matchIndex)
               , right = text.slice(matchIndex)
             if ( left == "" || left.match(/[a-z0-9_\-+=.]$/)
                             || ( left.match(/<[^>]+$/)
                               && right.match(/^[^>]*>/) )) {
               return wholeMatch
             }
             return "<a href='http://github.com/" + GitHub.nameWithOwner
                  + "/issues/#issue/" + issue + "'>" + wholeMatch + "</a>"
           })

    // ** GFM ** Auto-link user#issue if GitHub.nameWithOwner is defined
    text = text.replace(re.userIssue, function (wholeMatch,username,issue,matchIndex) {
             if ( typeof(GitHub) == "undefined"
               || typeof(GitHub.nameWithOwner) == "undefined" ) {
               return wholeMatch
             }
             GitHub.repoName = GitHub.repoName || _GetRepoName()
             var left = text.slice(0, matchIndex)
               , right = text.slice(matchIndex)
             if ( left.match(/\/$/)
               || ( left.match(/<[^>]+$/) && right.match(/^[^>]*>/) ) ) {
               return wholeMatch
             }
             return "<a href='http://github.com/" + username
                  + "/" + GitHub.repoName + "/issues/#issue/"
                  + issue + "'>" + wholeMatch + "</a>"
           })

    // ** GFM ** Auto-link user/repo#issue
    text = text.replace(re.repoIssue, function (wholeMatch,repo,issue) {
             return "<a href='http://github.com/" + repo + "/issues/#issue/"
                  + issue + "'>" + wholeMatch + "</a>"
           })

    return text
  }

  function _GetRepoName () {
    return GitHub.nameWithOwner.match(/^.+\/(.+)$/)[1]
  }

  function _StripLinkDefinitions (text) {
    // Strips link definitions from text, stores the URLs and titles in
    // hash references.
    // Link defs are in the form: ^[id]: url "optional title"
    var rv = text.replace(re.linkDef, function (wholeMatch,m1,m2,m3,m4) {
               m1 = m1.toLowerCase()
               // Link IDs are case-insensitive
               g_urls[m1] = _EncodeAmpsAndAngles(m2)
               if (m3) {
                 // found blank lines, so it's not a title.
                 // Put back the parenthetical statement
                 return m3 + m4
               }
               else if (m4) {
                 g_titles[m1] = m4.replace(/"/g,"&quot;")
               }
               // Completely remove the definition from the text
               return ""
             })
    return rv
  }


  function _HashHTMLBlocks (text) {
    // attacklab: Double up blank lines to reduce lookaround
    text = text.replace(/\n/g,"\n\n")

    // Hashify HTML blocks:
    // We only want to do this for block-level HTML tags, such as headers,
    // lists, and tables. That's because we still want to wrap <p>s around
    // "paragraphs" that are wrapped in non-block-level tags, such as anchors,
    // phrase emphasis, and spans. The list of tags we're looking for is
    // hard-coded:
    var block_tags_a = "p|div|h[1-6]|blockquote|pre|table|dl|ol|"
                     + "ul|script|noscript|form|fieldset|iframe|math|ins|del"
    var block_tags_b = "p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|"
                     + "noscript|form|fieldset|iframe|math"

    // First, look for nested blocks, e.g.:
    //   <div>
    //     <div>
    //     tags for inner block must be indented.
    //     </div>
    //   </div>
    //
    // The outermost tags must start at the left margin for this to match, and
    // the inner nested divs must be indented.
    // We need to do this before the next, more liberal match, because the next
    // match will start at the first `<div>` and stop at the first `</div>`.

    function hashElement (wholeMatch,m1) {
      var blockText = m1
      // Undo double lines
      blockText = blockText.replace(/\n\n/g,"\n")
      blockText = blockText.replace(/^\n/,"")
      // strip trailing blank lines
      blockText = blockText.replace(/\n+$/g,"")
      // Replace the element text with a marker "~KxK" where x is its key
      blockText = "\n\n~K" + (g_html_blocks.push(blockText)-1) + "K\n\n"
      return blockText
    }

    // attacklab: This regex can be expensive when it fails.
    text = text.replace(re.nested, hashElement)

    // Now match more liberally, simply from `\n<tag>` to `</tag>\n`
    text = text.replace(re.liberal, hashElement)

    // Special case just for <hr />. It was easier to make a special case than
    // to make the other regex more complicated.
    text = text.replace(re.hr, hashElement)

    // Special case for standalone HTML comments:
    text = text.replace(re.comment, hashElement)

    // PHP and ASP-style processor instructions (<?...?> and <%...%>)
    text = text.replace(re.processor, hashElement)

    // attacklab: Undo double lines (see comment at top of this function)
    text = text.replace(/\n\n/g,"\n")
    return text
  }

  function _RunBlockGamut (text) {
    // These are all the transformations that form block-level
    // tags like paragraphs, headers, and list items.
    text = _DoHeaders(text)

    // Do Horizontal Rules:
    var key = hashBlock("<hr />")
    text = text.replace(/^[ ]{0,2}([ ]?\*[ ]?){3,}[ \t]*$/gm,key)
    text = text.replace(/^[ ]{0,2}([ ]?\-[ ]?){3,}[ \t]*$/gm,key)
    text = text.replace(/^[ ]{0,2}([ ]?\_[ ]?){3,}[ \t]*$/gm,key)

    text = _DoLists(text)
    text = _DoCodeBlocks(text)
    text = _DoBlockQuotes(text)

    // We already ran _HashHTMLBlocks() before, in Markdown(), but that
    // was to escape raw HTML in the original Markdown source. This time,
    // we're escaping the markup we've just created, so that we don't wrap
    // <p> tags around block-level tags.
    text = _HashHTMLBlocks(text)
    text = _FormParagraphs(text)

    return text
  }

  function _RunSpanGamut (text) {
    // These are all the transformations that occur *within* block-level
    // tags like paragraphs, headers, and list items.

    text = _DoCodeSpans(text)
    text = _EscapeSpecialCharsWithinTagAttributes(text)
    text = _EncodeBackslashEscapes(text)

    // Process anchor and image tags. Images must come first,
    // because ![foo][f] looks like an anchor.
    text = _DoImages(text)
    text = _DoAnchors(text)

    // Make links out of things like `<http://example.com/>`
    // Must come after _DoAnchors(), because you can use < and >
    // delimiters in inline links like [this](<url>).
    text = _DoAutoLinks(text)
    text = _EncodeAmpsAndAngles(text)
    text = _DoItalicsAndBold(text)

    // Do hard breaks:
    text = text.replace(/  +\n/g," <br />\n")

    return text
  }

  function _EscapeSpecialCharsWithinTagAttributes (text) {
    // Within tags -- meaning between < and > -- encode [\ ` * _] so they
    // don't conflict with their use in Markdown for code, italics and strong.
    text = text.replace(re.html, function (wholeMatch) {
             var tag = wholeMatch.replace(/(.)<\/?code>(?=.)/g, "$1`")
             tag = escapeCharacters(tag,"\\`*_")
             return tag
           })
    return text
  }

  function _DoAnchors (text) {
    // Turn Markdown link shortcuts into XHTML <a> tags.

    function writeAnchorTag (wholeMatch,m1,m2,m3,m4,m5,m6,m7) {
      if (m7 == undefined) m7 = ""
      var whole_match = m1
        , link_text   = m2
        , link_id     = m3.toLowerCase()
        , url         = m4
        , title       = m7

      if (url == "") {
        if (link_id == "") {
          // lower-case and turn embedded newlines into spaces
          link_id = link_text.toLowerCase().replace(/ ?\n/g," ")
        }
        url = "#"+link_id

        if (g_urls[link_id] != undefined) {
          url = g_urls[link_id]
          if (g_titles[link_id] != undefined) {
            title = g_titles[link_id]
          }
        }
        else {
          if (whole_match.search(/\(\s*\)$/m)>-1) {
            // Special case for explicit empty url
            url = ""
          }
          else {
            return whole_match
          }
        }
      }

      url = escapeCharacters(url,"*_")
      var result = "<a href=\"" + url + "\""

      if (title != "") {
        title = title.replace(/"/g,"&quot;")
        title = escapeCharacters(title,"*_")
        result +=  " title=\"" + title + "\""
      }
      result += ">" + link_text + "</a>"
      return result
    }

    // First, handle reference-style links: [link text] [id]
    text = text.replace(re.referenceLink, writeAnchorTag)

    // Next, inline-style links: [link text](url "optional title")
    text = text.replace(re.inlineLink, writeAnchorTag)

    // Last, handle reference-style shortcuts: [link text]
    // These must come last in case you've also got [link test][1]
    // or [link test](/foo)
    text = text.replace(re.shortcutLink, writeAnchorTag)

    return text
  }

  function _DoImages (text) {
    // Turn Markdown image shortcuts into <img> tags.

    function writeImageTag (wholeMatch,m1,m2,m3,m4,m5,m6,m7) {
      var whole_match = m1
      var alt_text    = m2
      var link_id     = m3.toLowerCase()
      var url         = m4
      var title       = m7

      if (!title) title = ""

      if (url == "") {
        if (link_id == "") {
          // lower-case and turn embedded newlines into spaces
          link_id = alt_text.toLowerCase().replace(/ ?\n/g," ")
        }
        url = "#"+link_id

        if (g_urls[link_id] != undefined) {
          url = g_urls[link_id]
          if (g_titles[link_id] != undefined) {
            title = g_titles[link_id]
          }
        }
        else {
          return whole_match
        }
      }

      alt_text = alt_text.replace(/"/g,"&quot;")
      url = escapeCharacters(url,"*_")
      var result = "<img src=\"" + url + "\" alt=\"" + alt_text + "\""

      // attacklab: Markdown.pl adds empty title attributes to images.
      // Replicate this bug.

      //if (title != "") {
      title = title.replace(/"/g,"&quot;")
      title = escapeCharacters(title,"*_")
      result +=  " title=\"" + title + "\""
      //}

      result += " />"

      return result
    }

    // First, handle reference-style labeled images: ![alt text][id]
    text = text.replace(re.referenceImage, writeImageTag)

    // Next, handle inline images:  ![alt text](url "optional title")
    // Don't forget: encode * and _
    text = text.replace(re.inlineImage, writeImageTag)

    return text
  }

  function _DoHeaders (text) {
    // Setext-style headers:
    // Header 1
    // ========
    //
    // Header 2
    // --------
    //
    text = text.replace(re.setextH1, function (wholeMatch,m1) {
             return hashBlock("<h1>" + _RunSpanGamut(m1) + "</h1>")
           })
    text = text.replace(re.setextH2, function (matchFound,m1) {
             return hashBlock("<h2>" + _RunSpanGamut(m1) + "</h2>")
           })

    // atx-style headers:
    //  # Header 1
    //  ## Header 2
    //  ## Header 2 with closing hashes ##
    //  ...
    //  ###### Header 6
    //

    text = text.replace(re.atxHeader, function (wholeMatch,m1,m2) {
             var h_level = m1.length
             return hashBlock( "<h" + h_level + ">" + _RunSpanGamut(m2) + "</h"
                             + h_level + ">"
                             )
           })

    return text
  }

  function _DoLists (text) {
    // Form HTML ordered (numbered) and unordered (bulleted) lists.
    // attacklab: add sentinel to hack around khtml/safari bug:
    // http://bugs.webkit.org/show_bug.cgi?id=11231
    text += "~0"
    if (g_list_level) {
      text = text.replace(re.list, function (wholeMatch,m1,m2) {
               var list = m1
               var list_type = (m2.search(/[*+-]/g)>-1) ? "ul" : "ol"

               // Turn double returns into triple returns,
               //  so that we can make a
               // paragraph for the last item in a list,
               //  if necessary:
               list = list.replace(/\n{2,}/g,"\n\n\n")
               var result = _ProcessListItems(list)

               // Trim any trailing whitespace, to put the closing </$list_type>
               // up on the preceding line, to get it past the current stupid
               // HTML block parser. This is a hack to work around the terrible
               // hack that is the HTML block parser.
               result = result.replace(/\s+$/,"")
               result = "<"+list_type+">" + result + "</"+list_type+">\n"
               return result
             })
    }
    else {
      text = text.replace(re.list2, function (wholeMatch,m1,m2,m3) {
               var runup = m1
               var list = m2

               var list_type = (m3.search(/[*+-]/g)>-1) ? "ul" : "ol"
               // Turn double returns into triple returns, so that we can make a
               // paragraph for the last item in a list, if necessary:
               list = list.replace(/\n{2,}/g,"\n\n\n")
               var result = _ProcessListItems(list)
               result = runup + "<"+list_type+">\n"
                      + result + "</"+list_type+">\n"
               return result
             })
    }
    // attacklab: strip sentinel
    text = text.replace(/~0/,"")
    return text
  }

  function _ProcessListItems (list_str) {
    //  Process the contents of a single ordered or unordered list, splitting it
    //  into individual list items.
    //
    // The $g_list_level global keeps track of when we're inside a list.
    // Each time we enter a list, we increment it; when we leave a list,
    // we decrement. If it's zero, we're not in a list anymore.
    //
    // We do this because when we're not inside a list, we want to treat
    // something like this:
    //
    //    I recommend upgrading to version
    //    8. Oops, now this line is treated
    //    as a sub-list.
    //
    // As a single paragraph, despite the fact that the second line starts
    // with a digit-period-space sequence.
    //
    // Whereas when we're inside a list (or sub-list), that line will be
    // treated as the start of a sub-list. What a kludge, huh? This is
    // an aspect of Markdown's syntax that's hard to parse perfectly
    // without resorting to mind-reading. Perhaps the solution is to
    // change the syntax rules such that sub-lists must start with a
    // starting cardinal number; e.g. "1." or "a.".

    g_list_level++
    // trim trailing blank lines:
    list_str = list_str.replace(/\n{2,}$/,"\n")
    // attacklab: add sentinel to emulate \z
    list_str += "~0"
    list_str = list_str.replace(re.listStr, function (wholeMatch,m1,m2,m3,m4) {
                 var item = m4
                 var leading_line = m1
                 var leading_space = m2
                 if (leading_line || (item.search(/\n{2,}/)>-1)) {
                   item = _RunBlockGamut(_Outdent(item))
                 }
                 else {
                   // Recursion for sub-lists:
                   item = _DoLists(_Outdent(item))
                   item = item.replace(/\n$/,"") // chomp(item)
                   item = _RunSpanGamut(item)
                 }
                 return  "<li>" + item + "</li>\n"
               })
    // attacklab: strip sentinel
    list_str = list_str.replace(/~0/g,"")
    g_list_level--
    return list_str
  }

  function _DoCodeBlocks (text) {
    //  Process Markdown `<pre><code>` blocks.
    // attacklab: sentinel workarounds for lack of \A and \Z, safari\khtml bug
    text += "~0"
    text = text.replace(re.codeBlock, function (wholeMatch,m1,m2) {
             var codeblock = m1
             var nextChar = m2
             codeblock = _EncodeCode( _Outdent(codeblock))
             codeblock = _Detab(codeblock)
             codeblock = codeblock.replace(/^\n+/g,"") // trim leading newlines
             codeblock = codeblock.replace(/\n+$/g,"") // trim trailing newlines
             codeblock = "<pre><code>" + codeblock + "\n</code></pre>"
             return hashBlock(codeblock) + nextChar
           })
    // attacklab: strip sentinel
    text = text.replace(/~0/,"")
    return text
  }

  function hashBlock (text) {
    text = text.replace(/(^\n+|\n+$)/g,"")
    return "\n\n~K" + (g_html_blocks.push(text)-1) + "K\n\n"
  }

  function _DoCodeSpans (text) {
    //   *  Backtick quotes are used for <code></code> spans.
    //   *  You can use multiple backticks as the delimiters if you want to
    //  include literal backticks in the code span. So, this input:
    //
    //   Just type ``foo `bar` baz`` at the prompt.
    //    Will translate to:
    //   <p>Just type <code>foo `bar` baz</code> at the prompt.</p>
    //
    // There's no arbitrary limit to the number of backticks you
    // can use as delimters. If you need three consecutive backticks
    // in your code, use four for delimiters, etc.
    //
    //  *  You can use spaces to get literal backticks at the edges:
    //
    //   ... type `` `bar` `` ...
    //
    //    Turns to:
    //
    //   ... type <code>`bar`</code> ...
    text = text.replace(re.codeSpan, function (wholeMatch,m1,m2,m3,m4) {
             var c = '\0\0\0\0' + m3 + '\0\0\0\0'
             c = c.replace(/\0\0\0\0([ \t]*)/,"") // leading whitespace
             c = c.replace(/[ \t]*\0\0\0\0/,"") // trailing whitespace
             c = _EncodeCode(c)
             return m1 + "<code>" + c + "</code>"
           })
    return text
  }

  function _DoBacktickCodeBlocks (text) {
    //   *  Backtick quotes are used for <pre><code></code></pre> blocks.
    // There's no arbitrary limit to the number of backticks you
    // can use as delimters. If you need three consecutive backticks
    // in your code, use four for delimiters, etc.
    //
    text = text.replace(re.fenced, function (wholeMatch,m1,m2) {
             var c = '\0\0\0\0' + m2 + '\0\0\0\0'
             c = c.replace(/\0\0\0\0([ \t\n]*)/,"") // leading whitespace
             c = c.replace(/[ \t]*\0\0\0\0/,"") // trailing whitespace
             c = _EncodeCode(c, m1)
             return "<pre><code>" + c + "</code></pre>"
           })
    return text
  }

  function _EncodeCode (text, syntax) {
    // Encode/escape certain characters inside Markdown code runs.
    // The point is that in code, these characters are literals,ee
    // and lose their special Markdown meanings.
    // 'syntax' reserved for future syntax highlighting
    // Encode all ampersands; HTML entities are not
    // entities within a Markdown code span.
    text = text.replace(/&/g,"&amp;")

    // Do the angle bracket song and dance:
    text = text.replace(/</g,"&lt;")
    text = text.replace(/>/g,"&gt;")

    // Now, escape characters that are magic in Markdown:
    text = escapeCharacters(text,"\*_{}[]\\",false)

    // jj the line above breaks this:
    //---

    //* Item
    //   1. Subitem
    //            special char: *
    //---

    return text
  }

  function _DoItalicsAndBold (text) {
    // <strong> must go first:
    text = text.replace(re.strong, "<strong>$2</strong>")
    text = text.replace(/(\w)_(\w)/g, "$1~E95E$2") // "~E95E" == escaped "_"
    text = text.replace(re.em, "<em>$2</em>")
    return text
  }

  function _DoBlockQuotes (text) {
    text = text.replace(re.blockQuote, function (wholeMatch,m1) {
             var bq = m1
             // attacklab: hack around Konqueror 3.5.4 bug:
             // "----------bug".replace(/^-/g,"") == "bug"
             bq = bq.replace(/^[ \t]*>[ \t]?/gm,"~0") // trim one level of quote
             // attacklab: clean up hack
             bq = bq.replace(/~0/g,"")
             bq = bq.replace(/^[ \t]+$/gm,"")  // trim whitespace-only lines
             bq = _RunBlockGamut(bq)    // recurse
             bq = bq.replace(/(^|\n)/g,"$1  ")
             // These leading spaces screw with <pre> content, so we need to fix
             bq = bq.replace(re.pre, function (wholeMatch,m1) {
                    var pre = m1
                    // attacklab: hack around Konqueror 3.5.4 bug:
                    pre = pre.replace(/^  /mg,"~0")
                    pre = pre.replace(/~0/g,"")
                    return pre
                  })
             return hashBlock("<blockquote>\n" + bq + "\n</blockquote>")
           })
    return text
  }

  function _FormParagraphs (text) {
    //  Params:
    //    $text - string to process with html <p> tags
    // Strip leading and trailing lines:
    text = text.replace(/^\n+/g,"")
    text = text.replace(/\n+$/g,"")
    // Do code block stuff early
    text = _DoBacktickCodeBlocks(text)
    var grafs = text.split(/\n{2,}/g)
    var grafsOut = new Array()
    // Wrap <p> tags.
    var end = grafs.length
    for (var i = 0; i < end; i++) {
      var str = grafs[i]
      // if this is an HTML marker, copy it
      if (str.search(/~K(\d+)K/g) >= 0) {
        grafsOut.push(str)
      }
      else if (str.search(/\S/) >= 0) {
        str = _RunSpanGamut(str)
        str = str.replace(/\n/g,"<br />")  // ** GFM **
        str = str.replace(/^([ \t]*)/g,"<p>")
        str += "</p>"
        grafsOut.push(str)
      }
    }
    // Unhashify HTML blocks
    end = grafsOut.length
    for (var j = 0; j < end; j++) {
      // if this is a marker for an html block...
      while (grafsOut[j].search(/~K(\d+)K/) >= 0) {
        var blockText = g_html_blocks[RegExp.$1]
        blockText = blockText.replace(/\$/g,"$$$$") // Escape any dollar signs
        grafsOut[j] = grafsOut[j].replace(/~K\d+K/,blockText)
      }
    }
    return grafsOut.join("\n\n")
  }

  function _EncodeAmpsAndAngles (text) {
    // Smart processing for ampersands and angle brackets to be encoded.
    // Ampersand-encoding based entirely on Nat Irons's Amputator MT plugin:
    //   http://bumppo.net/projects/amputator/
    text = text.replace(/&(?!#?[xX]?(?:[0-9a-fA-F]+|\w+);)/g,"&amp;")
    // Encode naked <'s
    text = text.replace(/<(?![a-z\/?\$!])/gi,"&lt;")
    return text
  }

  function _EncodeBackslashEscapes (text) {
    //   Parameter:  String.
    //   Returns: The string, with after processing the following backslash
    //      escape sequences.
    // attacklab: The polite way to do this is with the new
    // escapeCharacters() function:
    //
    //  text = escapeCharacters(text,"\\",true)
    //  text = escapeCharacters(text,"`*_{}[]()>#+-.!",true)
    //
    // ...but we're sidestepping its use of the (slow) RegExp constructor
    // as an optimization for Firefox.  This function gets called a LOT.
    text = text.replace(/\\(\\)/g,escapeCharacters_callback)
    text = text.replace(/\\([`*_{}\[\]()>#+-.!])/g,escapeCharacters_callback)
    return text
  }

  function _DoAutoLinks (text) {
    text = text.replace(re.autoLink,"<a href=\"$1\">$1</a>")
    // Email addresses: <address@domain.foo>
    text = text.replace(re.autoEmail, function (wholeMatch,m1) {
             return _EncodeEmailAddress(_UnescapeSpecialChars(m1))
           })
    return text
  }

  function _EncodeEmailAddress (addr) {
    //  Input: an email address, e.g. "foo@example.com"
    //  Output: the email address as a mailto link, with each character
    // of the address encoded as either a decimal or hex entity, in
    // the hopes of foiling most address harvesting spam bots. E.g.:
    // <a href="&#x6D;&#97;&#105;&#108;&#x74;&#111;:&#102;&#111;&#111;&#64;
    //    x&#x61;&#109;&#x70;&#108;&#x65;&#x2E;&#99;&#111;&#109;">&#102;&#111;
    //    &#64;&#101;x&#x61;&#109;&#x70;&#108;&#x65;&#x2E;&#99;&#111;</a>
    //  Based on a filter by Matthew Wickline, posted to the BBEdit-Talk
    //  mailing list: <http://tinyurl.com/yu7ue>

    // attacklab: why can't javascript speak hex?
    function char2hex (ch) {
      var hexDigits = '0123456789ABCDEF'
      var dec = ch.charCodeAt(0)
      return (hexDigits.charAt(dec>>4) + hexDigits.charAt(dec&15))
    }

    var encode = [ function (ch) { return "&#"+ch.charCodeAt(0)+";" }
                 , function (ch) { return "&#x"+char2hex(ch)+";" }
                 , function (ch) { return ch }
                 ]

    addr = "mailto:" + addr
    addr = addr.replace(/./g, function (ch) {
             if (ch == "@") {
               // this *must* be encoded. I insist.
               ch = encode[Math.floor(Math.random()*2)](ch)
             }
             else if (ch !=":") {
               // leave ':' alone (to spot mailto: later)
               var r = Math.random()
               // roughly 10% raw, 45% hex, 45% dec
               ch =  (
                 r > .9  ? encode[2](ch)   :
                   r > .45 ? encode[1](ch)   :
                   encode[0](ch)
               )
             }
             return ch
           })
    addr = "<a href=\"" + addr + "\">" + addr + "</a>"
    addr = addr.replace(/">.+:/g,"\">") // strip mailto: from visible part

    return addr
  }

  function _UnescapeSpecialChars (text) {
    // Swap back in all the special characters we've hidden.
    text = text.replace(/~E(\d+)E/g, function (wholeMatch,m1) {
             var charCodeToReplace = parseInt(m1)
             return String.fromCharCode(charCodeToReplace)
           })
    return text
  }

  function _Outdent (text) {
    // Remove one level of line-leading tabs or spaces

    // attacklab: hack around Konqueror 3.5.4 bug:
    // "----------bug".replace(/^-/g,"") == "bug"
    text = text.replace(/^(\t|[ ]{1,4})/gm,"~0") // attacklab: g_tab_width

    // attacklab: clean up hack
    text = text.replace(/~0/g,"")
    return text
  }

  function _Detab (text) {
    // attacklab: Detab's completely rewritten for speed.
    // In perl we could fix it by anchoring the regexp with \G.
    // In javascript we're less fortunate.

    // expand first n-1 tabs
    text = text.replace(/\t(?=\t)/g,"    ") // attacklab: g_tab_width
    // replace the nth with two sentinels
    text = text.replace(/\t/g,"~A~B")
    // use the sentinel to anchor our regex so it doesn't explode
    text = text.replace(/~B(.+?)~A/g, function(wholeMatch,m1,m2) {
             var leadingText = m1
             var numSpaces = 4 - leadingText.length % 4 // attacklab:g_tab_width
             // there *must* be a better way to do this:
             for (var i=0; i<numSpaces; i++) leadingText+=" "
             return leadingText
           })
    // clean up sentinels
    text = text.replace(/~A/g,"    ")  // attacklab: g_tab_width
    text = text.replace(/~B/g,"")
    return text
  }

  //  attacklab: Utility functions

  function escapeCharacters (text, charsToEscape, afterBackslash) {
    // First we have to escape the escape characters so that
    // we can build a character class out of them
    var regexString = "([" + charsToEscape.replace(/([\[\]\\])/g,"\\$1") + "])"

    if (afterBackslash) {
      regexString = "\\\\" + regexString
    }

    var regex = new RegExp(regexString,"g")
    text = text.replace(regex,escapeCharacters_callback)

    return text
  }

  function escapeCharacters_callback (wholeMatch,m1) {
    var charCodeToEscape = m1.charCodeAt(0)
    return "~E"+charCodeToEscape+"E"
  }

} // end of Showdown.converter
