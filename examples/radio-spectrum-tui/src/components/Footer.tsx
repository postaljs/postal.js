// Footer — current track (from metadata-worker via SomaFM API) and keyboard hints.
// Track info updates every 30 seconds via the metadata polling interval.

import React from "react";
import { Text } from "ink";
import chalk from "chalk";
import type { StationMeta } from "../types.js";

export type FooterProps = {
    /** Live metadata from SomaFM (null until first fetch). */
    stationMeta: StationMeta | null;
};

export const Footer: React.FC<FooterProps> = ({ stationMeta }) => {
    const track = stationMeta?.track ? `♫  ${stationMeta.track}` : "♫  --";
    const hints = chalk.dim("  ←/→: station, q: quit");

    return (
        <Text>
            {" "}
            {track}
            {hints}
        </Text>
    );
};
