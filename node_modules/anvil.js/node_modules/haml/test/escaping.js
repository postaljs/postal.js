{
  locals: {
    apos: "'",
    amp: '&',
    carrots: '<>',
    quo: '"',
    sol: '/',
    attr:[
      '""><SCRIPT>alert("XSS")</SCRIPT>',
      'javascript:alert(String.fromCharCode(88,83,83)'
    ]
  }
}