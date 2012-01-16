var DEFAULT_EXCHANGE = "/",
    DEFAULT_PRIORITY = 50,
    DEFAULT_DISPOSEAFTER = 0,
    NO_OP = function() { },
    parsePublishArgs = function(args) {
        var parsed = { envelope: { } }, env;
        switch(args.length) {
            case 3:
                if(typeof args[1] === "Object" && typeof args[2] === "Object") {
                    parsed.envelope.exchange = DEFAULT_EXCHANGE;
                    parsed.envelope.topic = args[0];
                    parsed.payload = args[1];
                    env = parsed.envelope;
                    parsed.envelope = _.extend(env, args[2]);
                }
                else {
                    parsed.envelope.exchange = args[0];
                    parsed.envelope.topic = args[1];
                    parsed.payload = args[2];
                }
                break;
            case 4:
                parsed.envelope.exchange = args[0];
                parsed.envelope.topic = args[1];
                parsed.payload = args[2];
                env = parsed.envelope;
                parsed.envelope = _.extend(env, args[3]);
                break;
            default:
                parsed.envelope.exchange = DEFAULT_EXCHANGE;
                parsed.envelope.topic = args[0];
                parsed.payload = args[1];
                break;
        }
        return parsed;
    };
