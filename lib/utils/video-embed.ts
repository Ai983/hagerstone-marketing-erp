export type VideoProvider = "youtube" | "vimeo" | "loom" | "drive" | "unknown"

export interface VideoMeta {
  provider: VideoProvider
  videoId: string
  thumbnailUrl: string
  embedUrl: string
  originalUrl: string
}

export function parseVideoUrl(url: string): VideoMeta | null {
  const youtubeMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  )
  if (youtubeMatch) {
    const videoId = youtubeMatch[1]
    return {
      provider: "youtube",
      videoId,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      embedUrl: `https://www.youtube.com/watch?v=${videoId}`,
      originalUrl: url,
    }
  }

  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) {
    const videoId = vimeoMatch[1]
    return {
      provider: "vimeo",
      videoId,
      thumbnailUrl: `https://vumbnail.com/${videoId}.jpg`,
      embedUrl: `https://vimeo.com/${videoId}`,
      originalUrl: url,
    }
  }

  const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/)
  if (loomMatch) {
    const videoId = loomMatch[1]
    return {
      provider: "loom",
      videoId,
      thumbnailUrl: `https://cdn.loom.com/sessions/thumbnails/${videoId}-with-play.gif`,
      embedUrl: url,
      originalUrl: url,
    }
  }

  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (driveMatch) {
    const videoId = driveMatch[1]
    return {
      provider: "drive",
      videoId,
      thumbnailUrl: `https://drive.google.com/thumbnail?id=${videoId}&sz=w640`,
      embedUrl: `https://drive.google.com/file/d/${videoId}/preview`,
      originalUrl: url,
    }
  }

  return null
}

export function generateVideoHTML(meta: VideoMeta, caption?: string): string {
  const providerLabel = {
    youtube: "Watch on YouTube",
    vimeo: "Watch on Vimeo",
    loom: "Watch on Loom",
    drive: "Watch on Google Drive",
    unknown: "Watch Video",
  }[meta.provider]

  const providerColor = {
    youtube: "#FF0000",
    vimeo: "#1AB7EA",
    loom: "#625DF5",
    drive: "#4285F4",
    unknown: "#333333",
  }[meta.provider]

  return `
<div style="margin: 20px 0; text-align: center;">
  <a href="${meta.originalUrl}" 
     target="_blank" 
     rel="noopener noreferrer"
     style="display: inline-block; text-decoration: none; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.2); max-width: 500px; width: 100%;">
    
    <!-- Thumbnail with play button overlay -->
    <div style="position: relative; display: block; background: #000;">
      <img 
        src="${meta.thumbnailUrl}" 
        alt="Video thumbnail"
        style="width: 100%; max-width: 500px; height: auto; display: block; opacity: 0.85;"
      />
      <!-- Play button overlay -->
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                  width: 70px; height: 70px; background: rgba(0,0,0,0.75); 
                  border-radius: 50%; display: flex; align-items: center; 
                  justify-content: center;">
        <div style="width: 0; height: 0; border-top: 18px solid transparent; 
                    border-bottom: 18px solid transparent; 
                    border-left: 30px solid #ffffff; 
                    margin-left: 6px;">
        </div>
      </div>
    </div>

    <!-- Caption bar -->
    <div style="background: ${providerColor}; padding: 10px 16px; text-align: center;">
      <span style="color: #ffffff; font-size: 14px; font-weight: bold; 
                   font-family: Arial, sans-serif;">
        ▶ ${caption || providerLabel}
      </span>
    </div>

  </a>
  ${caption ? `<p style="color: #666; font-size: 13px; margin: 8px 0 0 0; 
    font-family: Arial, sans-serif;">${caption}</p>` : ""}
</div>
`
}
