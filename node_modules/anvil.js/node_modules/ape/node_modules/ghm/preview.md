---
title: Live Preview
layout: default
---

<h1>GFM Live Preview</h1>

This page provides a live GFM preview, rendered client-side using javascript.
The majority of the credit goes to the wonderful [Showdown](http://softwaremaniacs.org/playground/showdown-highlight/) script, which handles the meat of the processing.
GFM modifications for newlines, underscore-words, autolinking and GitHub SHA1/issue link syntaxes were added.

<p class="warn">
  GitHub now has previews on all inputs that use GFM.
  <strong>This live preview should be considered depreciated.</strong>
  It may not render exactly the same way github.com
  will due to differences in markdown libraries.
</p>

User input
----------

<script type="text/javascript">
  var GitHub = {}
  GitHub.nameWithOwner = "mojombo/god";
</script>

<textarea id="user_input"></textarea>

Live preview
------------

<div id="result"></div>

### HTML

<textarea id="html_result"></textarea>
