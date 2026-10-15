/**
 * AssetDiet Core — Capability Report
 * Describes available engines and platform capabilities.
 */

export interface BinaryCapability {
  available: boolean;
  path?: string | undefined;
  version?: string | undefined;
  error?: string | undefined;
}

export interface ImageEngineCapability {
  sharp: {
    available: boolean;
    version?: string | undefined;
    formats: string[];
    supportsAvif: boolean;
    supportsWebP: boolean;
  };
}

export interface VideoEngineCapability {
  ffmpeg: BinaryCapability;
  ffprobe: BinaryCapability;
  /** Available codecs (only populated if ffmpeg is available) */
  encoders: string[];
  decoders: string[];
}

export interface Model3DEngineCapability {
  gltfTransform: {
    available: boolean;
    version?: string | undefined;
  };
  draco: {
    available: boolean;
    version?: string | undefined;
  };
}

export interface FontEngineCapability {
  analysis: boolean;
  subsetting: false; // Always false in v1 — experimental
}

export interface SvgEngineCapability {
  svgo: {
    available: boolean;
    version?: string | undefined;
  };
}

export interface CapabilityReport {
  platform: {
    os: string;
    arch: string;
    nodeVersion: string;
    assetDietVersion: string;
  };
  images: ImageEngineCapability;
  video: VideoEngineCapability;
  model3d: Model3DEngineCapability;
  fonts: FontEngineCapability;
  svg: SvgEngineCapability;
  /** Human-readable list of supported formats */
  supportedFormats: string[];
  /** Human-readable list of limitations/missing capabilities */
  limitations: string[];
}
