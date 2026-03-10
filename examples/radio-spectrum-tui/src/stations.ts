// Station registry for the radio spectrum analyzer.
//
// SomaFM is a non-profit, listener-supported internet radio service.
// Streams are plain Icecast HTTP — no auth, no API key required.
// SomaFM explicitly encourages third-party players. Support them at somafm.com/support.

export type Station = {
    /** Unique identifier matching the SomaFM channel ID used in channels.json. */
    id: string;
    /** Display name for the UI header. */
    name: string;
    /** Genre description shown below the station name. */
    genre: string;
    /** Direct Icecast stream URL. */
    url: string;
    /** Stream bitrate in kbps. */
    bitrate: number;
    /** Audio format — always MP3 for these streams. */
    format: string;
};

export const STATIONS: Station[] = [
    {
        id: "groovesalad",
        name: "Groove Salad",
        genre: "Ambient Chill",
        url: "http://ice1.somafm.com/groovesalad-256-mp3",
        bitrate: 256,
        format: "MP3",
    },
    {
        id: "dronezone",
        name: "Drone Zone",
        genre: "Atmospheric Ambient",
        url: "http://ice1.somafm.com/dronezone-256-mp3",
        bitrate: 256,
        format: "MP3",
    },
    {
        id: "defcon",
        name: "DEF CON Radio",
        genre: "Electronic Hacking",
        url: "http://ice1.somafm.com/defcon-256-mp3",
        bitrate: 256,
        format: "MP3",
    },
    {
        id: "spacestation",
        name: "Space Station",
        genre: "Space Electronica",
        url: "http://ice1.somafm.com/spacestation-128-mp3",
        bitrate: 128,
        format: "MP3",
    },
];

/** Index of the default station on startup. */
export const DEFAULT_STATION_INDEX = 0;

/** Wrap-around navigation: returns the next station index. */
export const nextStation = (currentIndex: number): number => (currentIndex + 1) % STATIONS.length;

/** Wrap-around navigation: returns the previous station index. */
export const prevStation = (currentIndex: number): number =>
    (currentIndex - 1 + STATIONS.length) % STATIONS.length;
