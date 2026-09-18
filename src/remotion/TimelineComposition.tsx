import { AbsoluteFill, Audio, Img, OffthreadVideo, Series } from "remotion";

export type TimelineClip = {
  mediaUrl: string;
  type: "IMAGE" | "VIDEO";
  durationInFrames: number;
  trimStartSec: number;
};

export type TimelineCompositionProps = {
  items: TimelineClip[];
  audioUrl?: string;
  audioVolume: number;
  fps: number;
};

export function TimelineComposition({ items, audioUrl, audioVolume, fps }: TimelineCompositionProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Series>
        {items.map((item, index) => (
          <Series.Sequence key={index} durationInFrames={item.durationInFrames} layout="none">
            <AbsoluteFill>
              {item.type === "IMAGE" ? (
                <Img
                  src={item.mediaUrl}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <OffthreadVideo
                  src={item.mediaUrl}
                  startFrom={Math.round(item.trimStartSec * fps)}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}
            </AbsoluteFill>
          </Series.Sequence>
        ))}
      </Series>
      {audioUrl && <Audio src={audioUrl} volume={audioVolume} />}
    </AbsoluteFill>
  );
}
