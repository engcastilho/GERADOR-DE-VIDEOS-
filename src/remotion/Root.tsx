import { Composition } from "remotion";
import { TimelineComposition, TimelineCompositionProps } from "./TimelineComposition";

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

const defaultProps: TimelineCompositionProps = {
  items: [],
  audioVolume: 1,
  fps: FPS,
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Timeline"
      component={TimelineComposition}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      durationInFrames={1}
      defaultProps={defaultProps}
      calculateMetadata={async ({ props }) => {
        const totalFrames = props.items.reduce((sum, item) => sum + item.durationInFrames, 0);
        return { durationInFrames: Math.max(totalFrames, 1) };
      }}
    />
  );
};
