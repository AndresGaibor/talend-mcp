import React from "react";
import { Composition } from "remotion";
import { DURATION, FPS, HEIGHT, MyComposition, WIDTH } from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Demo"
      component={MyComposition}
      durationInFrames={DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
