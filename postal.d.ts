// Type definitions for PostalJS
// Project: https://github.com/postaljs/postal.js
// Definitions By: Bart Breen (https://github.com/barticus)

interface PostalEnvelope {
    channel: string;
    topic: string;
    timeStamp: any;
    data: any;
}

interface PostalSubscriptionQuery {
    channel?: string;
    topic?: string;
    context? : any;
}

interface PostalSubscriptionDefinition {
    channel: string;
    topic: string;
    callback: (data: any, env: PostalEnvelope) => {}
    unsubscribe();
}

interface PostalChannel {
    channel: string;
    topic?: string;
}

interface PostalChannelDefinition extends PostalChannel {
    subscribe(topic: string, callback: (data: any, env: PostalEnvelope) => {}): PostalSubscriptionDefinition;
    publish(topic: string, data: any);
    publish(env: PostalEnvelope);
}

interface PostalSubscriptionCollection {
    [channel: string]: PostalSubscriptionChannelCollection
}

interface PostalSubscriptionChannelCollection {
    [topic:string]:PostalSubscriptionDefinition[]
}

interface PostalConfiguration {
    resolver: any;
    DEFAULT_CHANNEL: string;
    SYSTEM_CHANNEL: string;
}

interface PostalStatic {
    addWireTap(wireTap: (data: any, env: PostalEnvelope) => {}): any;
    channel(channelName?: string): PostalChannelDefinition;
    configuration: PostalConfiguration;
    getSubscribersFor(options?: PostalSubscriptionQuery): PostalSubscriptionDefinition[];
    linkChannels(source: PostalChannel, destination: PostalChannel): PostalSubscriptionDefinition[];
    linkChannels(source: PostalChannel, destination: PostalChannel[]): PostalSubscriptionDefinition[];
    noConflict(): PostalStatic;
    publish(env: PostalEnvelope): PostalEnvelope;
    reset();
    subscribe(options: PostalSubscriptionDefinition): PostalSubscriptionDefinition;
    subscriptions: PostalSubscriptionCollection;
    unsubscribe(sub: PostalSubscriptionDefinition);
    unsubscribeFor();
    unsubscribeFor(PostalSubscriptionQuery);
    wiretaps:(data: any, env: PostalEnvelope) => {}[];
}


declare module "postal" {
    export = postal;
}

declare var postal: PostalStatic;