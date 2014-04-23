/*jshint -W098 */
(function(root, factory) {
    if (typeof module === "object" && module.exports) {
        // Node, or CommonJS-Like environments
        module.exports = factory(require("underscore"), this);
    } else if (typeof define === "function" && define.amd) {
        // AMD. Register as an anonymous module.
        define(["underscore"], function(_) {
            return factory(_, root);
        });
    } else {
        // Browser globals
        root.postal = factory(root._, root);
    }
}(this, function(_, global, undefined) {

    var _postal;
    var prevPostal = global.postal;

    //import("conduit.js");
    //import("ChannelDefinition.js");
    //import("SubscriptionDefinition.js");
    //import("strategies.js");
    //import("AmqpBindingsResolver.js");
    //import("Api.js");
    //import("linkChannels.js");

    /*jshint -W106 */
    if (global && Object.prototype.hasOwnProperty.call(global, "__postalReady__") && _.isArray(global.__postalReady__)) {
        while (global.__postalReady__.length) {
            global.__postalReady__.shift().onReady(_postal);
        }
    }
    /*jshint +W106 */

    return _postal;
}));