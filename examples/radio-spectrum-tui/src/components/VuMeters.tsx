// VuMeters — L + R stereo VU meter pair.
// Thin wrapper that stacks two VuMeter components vertically.

import React from "react";
import { Box } from "ink";
import { VuMeter } from "./VuMeter.js";
import type { LevelData } from "../types.js";

export type VuMetersProps = {
    leftLevel: LevelData;
    rightLevel: LevelData;
    width: number;
};

export const VuMeters: React.FC<VuMetersProps> = ({ leftLevel, rightLevel, width }) => (
    <Box flexDirection="column">
        <VuMeter label="L" level={leftLevel} width={width} />
        <VuMeter label="R" level={rightLevel} width={width} />
    </Box>
);
