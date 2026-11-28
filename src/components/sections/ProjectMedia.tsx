"use client";

import Image from "next/image";
import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/knowledge";
import {
  embedSrc,
  mediaLabel,
  mediaThumbSrc,
  PROVIDER_NAME,
  type ProjectMedia,
} from "@/lib/project-media";

// Media never plays on its own (battery, motion, data): a video shows its
// poster and a "Play demo" button, and plays muted inline after the click; an
// embed is a facade (poster + button) whose iframe loads only after the click.
// Without media, the components that use these render nothing at all.

type Fit = "cover" | "natural";

function Still({
  src,
  alt,
  width,
  height,
  fit,
  sizes,
}: Readonly<{ src: string; alt: string; width: number; height: number; fit: Fit; sizes: string }>) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      loading="lazy"
      className={`block w-full ${fit === "cover" ? "h-full object-cover" : "h-auto"}`}
    />
  );
}

function PlayButton({
  label,
  ariaLabel,
  onPlay,
}: Readonly<{ label: string; ariaLabel: string; onPlay: () => void }>) {
  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={ariaLabel}
      className="tap absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-lg bg-ink px-4 text-[15px] font-semibold text-ground hover:bg-[color-mix(in_oklab,var(--ink)_88%,var(--ground))] forced-colors:border forced-colors:border-[ButtonText]"
    >
      <Play size={16} aria-hidden="true" fill="currentColor" />
      {label}
    </button>
  );
}

/** One media item, inline. `fit="cover"` fills a fixed-ratio frame (the 16:10 cover). */
export function MediaItem({
  media,
  projectName,
  fit = "natural",
  sizes = "(min-width: 64rem) 46rem, 100vw",
}: Readonly<{ media: ProjectMedia; projectName: string; fit?: Fit; sizes?: string }>) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // The button that was focused is gone once the player mounts; hand focus
  // to the player so the keyboard is not dropped on <body>.
  useEffect(() => {
    if (playing) (videoRef.current ?? frameRef.current)?.focus({ preventScroll: true });
  }, [playing]);

  const frame =
    "relative overflow-hidden rounded-lg border border-hairline bg-surface " +
    (fit === "cover" ? "aspect-[16/10]" : "");
  const fill = fit === "cover" ? "absolute inset-0 h-full w-full object-cover" : "block h-auto w-full";

  if (media.kind === "image") {
    return (
      <div className={frame}>
        <Still
          src={media.src}
          alt={media.alt}
          width={media.width}
          height={media.height}
          fit={fit}
          sizes={sizes}
        />
      </div>
    );
  }

  if (!playing) {
    const label =
      media.kind === "embed" ? `Play demo (loads ${PROVIDER_NAME[media.provider]})` : "Play demo";
    return (
      <div className={frame}>
        <Still
          src={media.poster}
          alt={mediaLabel(media)}
          width={media.width}
          height={media.height}
          fit={fit}
          sizes={sizes}
        />
        <PlayButton
          label={label}
          ariaLabel={`${label}: ${mediaLabel(media)}, ${projectName}`}
          onPlay={() => setPlaying(true)}
        />
      </div>
    );
  }

  if (media.kind === "video") {
    return (
      <div className={frame}>
        <video
          ref={videoRef}
          src={media.src}
          poster={media.poster}
          width={media.width}
          height={media.height}
          aria-label={media.alt}
          controls
          muted
          playsInline
          autoPlay
          preload="metadata"
          className={fill}
        />
      </div>
    );
  }

  return (
    <div className={frame} style={fit === "natural" ? { aspectRatio: `${media.width} / ${media.height}` } : undefined}>
      <iframe
        ref={frameRef}
        src={embedSrc(media)}
        title={media.title}
        width={media.width}
        height={media.height}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}

/** Home page, featured project: the first item as a 16:10 cover. */
export function ProjectCover({
  media,
  projectName,
}: Readonly<{ media: ProjectMedia; projectName: string }>) {
  return (
    <div className="mb-4">
      <MediaItem media={media} projectName={projectName} fit="cover" sizes="(min-width: 48rem) 15rem, 100vw" />
    </div>
  );
}

/** Home page, other projects: a 64px thumbnail (decorative: the row's title names it). */
export function ProjectThumb({ media }: Readonly<{ media: ProjectMedia }>) {
  return (
    <Image
      src={mediaThumbSrc(media)}
      alt=""
      width={64}
      height={64}
      sizes="64px"
      loading="lazy"
      className="size-16 shrink-0 rounded-md border border-hairline object-cover"
    />
  );
}

/** Project page: every item in one column, with captions. */
export function ProjectGallery({ project }: Readonly<{ project: Project }>) {
  const media = project.media ?? [];
  if (media.length === 0) return null;
  return (
    <section className="mt-12" aria-labelledby="media-title">
      <h2 id="media-title" className="section-title">
        See it working
      </h2>
      <ul className="flex flex-col gap-8">
        {media.map((item, index) => (
          <li key={`${item.kind}-${index}`}>
            <figure>
              <MediaItem media={item} projectName={project.name} />
              {item.caption ? (
                <figcaption className="mt-2 text-[15px] text-muted">{item.caption}</figcaption>
              ) : null}
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
