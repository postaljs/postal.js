## API docs? Nope, ape docs!

---
ape is a command line tool to generate documentation from your comments.
It parses your source code files, and strips markdown formatted comments out,
it then puts your code in github-flavored-markdown code blocks, and displays the comments in line.

It wasn't written to be fancy, but rather to have a simple, automated way of keeping docs on github up to date.

To use:

    sudo npm install -g ape
    ape [list of files or directories]

Require dependencies

```javascript
var fs = require('fs'),
    path = require('path'),
    gfm = require('ghm'),
    hljs = require('hljs'),
    jade = require('jade');

```

This function is a helper for frontends, to make it simpler to determine if a file can be processed by ape.
It returns a callback with a single boolean parameter indicating if the file is supported

```javascript
exports.supported = function (filename, callback) {
    var lang = languages[path.extname(filename)];
    if (typeof lang === 'undefined' ) {
        callback(false);
    } else {
        callback(true);
    }
};

```

A simple helper function to return the dictionary of comment regexs, determined by the file extension

```javascript
exports.get_language = function (filename) {
    var lang = languages[path.extname(filename)];
    return lang;
}

```

This is the main function to parse the line array of source code, and return a new line array
containing the formatted text

```javascript
function parse_code(code, lang, outputFormat, template, callback) {
    var parsed_code = [],
        this_line,
        in_comment,
        in_code,
        spaces,
        commentblock = [],
        codeblock = [],
        tempblock = [];

    if (code && typeof code !== 'string') code = code.toString().split("\n");
    if (typeof lang === 'undefined' || !code) return;
    
    function pushblock() {
        parsed_code.push({ code: codeblock.join('\n'), comment: commentblock.join('\n') });
        codeblock = [];
        commentblock = [];
        in_code = false;
    }

    for (var i = 0, l = code.length; i < l; i++) {
        this_line = code[i];
        if (this_line.match(lang.comment) && !in_comment && !this_line.match(/^#\!/)) {
            if (in_code) pushblock();
            commentblock.push(this_line.replace(lang.comment, ''))
        } else if (this_line.match(lang.start) && !in_comment) {
            if (lang.name === 'python' && in_code) {
                while (codeblock[codeblock.length - 1].trim() !== '') {
                    tempblock.push(codeblock.pop());
                }
            }
            if (in_code) pushblock(); 
            if (lang.name === 'python') {
                for (var ti = 0, tl = tempblock.length; ti < tl; ti++) {
                    codeblock.push(tempblock.pop());
                }
            }
            in_comment = true;
            spaces = this_line.match(/^\s+/);
            if (spaces) spaces = spaces[0].length;
            this_line = this_line.replace(lang.start, '');
            if (this_line.match(lang.end)) {
                this_line = this_line.replace(lang.end, '');
                in_comment = false;
            } 
            if (this_line.trim() !== '') commentblock.push(this_line);
        } else if (this_line.match(lang.end) && in_comment) {
            this_line = this_line.replace(lang.end, '');
            if (this_line.trim() !== '') commentblock.push(this_line);
            in_comment = false;
        } else if (this_line.trim() === '' && !in_comment && !in_code) {
            pushblock();
        } else {
            if (in_comment) {
                if (lang.name === 'python') this_line = this_line.substring(spaces);
                commentblock.push(this_line);
            } else {
                if (!in_code && this_line.trim() !== '') in_code = true; 
                codeblock.push(this_line);
            }
        }
    }

    pushblock();

    if (outputFormat === 'md') {
        generate_md(parsed_code, lang, callback);
    } else if (outputFormat === 'html') {
        generate_html(parsed_code, lang, template, callback);
    }
}

```

This is the exported method

```javascript
exports.generate_doc = parse_code;

```

This function writes the parsed output to a markdown file, matching the original source's filename but changing the extension to .md

```javascript
function generate_md(parsed_code, language, callback) {
    var outfile,
        outcode = '';
    
    for (var i = 0, l = parsed_code.length; i < l; i++) {
        if (parsed_code[i].comment !== '') outcode += parsed_code[i].comment + '\n\n';
        if (parsed_code[i].code !== '') outcode += '```' + language.name + '\n' + parsed_code[i].code + '\n```\n\n';
    }

    callback(null, outcode);
}

```

This function writes parsed output to html

```javascript
function generate_html(parsed_code, language, template, callback) {
    var outfile,
        templatePath,
        template;

    if (typeof template === 'undefined') {
        templatePath = path.join(__dirname, 'template.jade');
    } else {
        templatePath = template;
    }

    template = fs.readFileSync(__dirname + '/template.jade', 'utf-8');
    var fn = jade.compile(template);

    callback(null, fn({ gfm: gfm, data: parsed_code, hljs: hljs, lang: language.name }));
}

```

Here we define our supported languages. Each language is a dictionary, keyed on the file extension. Inside the dictionary
we have the the following items:

* 'name': the identifier that we output to the markdown for code blocks
* 'comment': is a regex that will match a single line comment for the specific language, but does NOT include the text on the line, only the comment
* 'start': a regular expression to match the beginning of a multi-line commment block. 'start' should only match if it's on the beginning
of a line
* 'end': the partner regex to 'start' matching the end of a multi-line comment only if the match is at the end of a line.

```javascript
var C_LINE_COMMENT = /^\s*\/\/\s?/, 
    C_BLOCK_COMMENT_START = /^\s*\/\*\s?/, 
    C_BLOCK_COMMENT_END = /\*\/\s*$/, 
    HASH_LINE_COMMENT = /^\s*#\s?/,
    NEVER_MATCH = /a\bc/;
var languages = {
    '.js': { name: 'javascript', comment: C_LINE_COMMENT, start: C_BLOCK_COMMENT_START, end: C_BLOCK_COMMENT_END },
    '.py': { name: 'python', comment: HASH_LINE_COMMENT, start: /^\s*\"\"\"\s?/, end: /\"\"\"\s*$/ },
    '.rb': { name: 'ruby', comment: HASH_LINE_COMMENT, start: /^\s*\=begin\s?/, end: /\=end\s*$/ },
    '.lua': { name: 'lua', comment: /^\s*--\s?/, start: /^\s*--\[\[\s?/, end: /--\]\]\s*$/ },
    '.coffee': { name: 'coffeescript', comment: /^\s*#(?!##)\s?/, start: /^\s*###\s?/, end: /###\s*$/ },
    '.php': { name: 'php', comment: /^\s*(?:#|\/\/\s?)/, start: C_BLOCK_COMMENT_START, end: C_BLOCK_COMMENT_END },
    '.c': { name: null, comment: C_LINE_COMMENT, start: C_BLOCK_COMMENT_START, end: C_BLOCK_COMMENT_END },
    '.h': { name: null, comment: C_LINE_COMMENT, start: C_BLOCK_COMMENT_START, end: C_BLOCK_COMMENT_END },
    '.pl': { name: 'perl', comment: HASH_LINE_COMMENT, start: NEVER_MATCH, end: NEVER_MATCH },
    '.cpp': { name: 'cpp', comment: C_LINE_COMMENT, start: C_BLOCK_COMMENT_START, end: C_BLOCK_COMMENT_END },
    '.cs': { name: 'cs', comment: C_LINE_COMMENT, start: C_BLOCK_COMMENT_START, end: C_BLOCK_COMMENT_END },
    '.m': { name: 'objectivec', comment: C_LINE_COMMENT, start: C_BLOCK_COMMENT_START, end: C_BLOCK_COMMENT_END },
    '.sql': { name: 'sql', comment: /^\s*--\s?/, start: C_BLOCK_COMMENT_START, end: C_BLOCK_COMMENT_END },
    '.sh': { name: 'bash', comment: HASH_LINE_COMMENT, start: NEVER_MATCH, end: NEVER_MATCH },
    '.css': { name: 'css', comment: NEVER_MATCH, start: C_BLOCK_COMMENT_START, end: C_BLOCK_COMMENT_END },
    '.as': { name: 'actionscript', comment: C_LINE_COMMENT, start: C_BLOCK_COMMENT_START, end: C_BLOCK_COMMENT_END }
};

```

