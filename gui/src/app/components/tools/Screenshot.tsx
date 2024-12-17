import Image from 'next/image';

type ScreenshotProps = {
  base64Image: string;
  timestamp?: string;
};

export function Screenshot({ base64Image, timestamp }: ScreenshotProps) {
  return (
    <div className="rounded-lg overflow-hidden bg-zinc-800 p-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-400">Screenshot</span>
        {timestamp && (
          <span className="text-xs text-zinc-500">{timestamp}</span>
        )}
      </div>
      <img
        src={`data:image/png;base64,${base64Image}`}
        alt="Screenshot"
        className="max-w-full rounded"
      />
    </div>
  );
} 