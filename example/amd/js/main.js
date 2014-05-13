require.config({
    paths: {
        underscore: "../../../bower/underscore/underscore-min",
        postal: "../../../lib/postal",
        postaldiags: "../../../bower/postal.diagnostics/lib/postal.diagnostics",
        jquery: "../../../bower/jquery/jquery.min",
        conduit: "../../../bower/conduitjs/lib/conduit.min"
    },
    shim: {
        underscore: {
            exports: "_"
        }
    }
});

require(["jquery"], function($) {
    $(function() {
        require(["examples"]);
    });
});