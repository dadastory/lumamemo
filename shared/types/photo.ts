import type { Tags } from 'exiftool-vendored'

export interface NeededExif {
  Title?: string
  XPTitle?: string
  Subject?: string[]
  Keywords?: string[]
  XPKeywords?: string

  Description?: Tags['Description']
  ImageDescription?: Tags['ImageDescription']
  CaptionAbstract?: Tags['Caption-Abstract']
  XPComment?: Tags['XPComment']
  UserComment?: Tags['UserComment']

  zone?: string
  tz?: string
  tzSource?: string

  Orientation?: number
  Make?: string
  Model?: string
  Software?: string
  Artist?: string
  Copyright?: string

  ExposureTime?: string | number
  FNumber?: number
  ExposureProgram?: string
  ISO?: number
  ShutterSpeedValue?: string | number
  ApertureValue?: number
  BrightnessValue?: number
  ExposureCompensation?: number
  MaxApertureValue?: number

  OffsetTime?: string
  OffsetTimeOriginal?: string
  OffsetTimeDigitized?: string

  LightSource?: string
  Flash?: string

  FocalLength?: string
  FocalLengthIn35mmFormat?: string

  LensMake?: string
  LensModel?: string

  ColorSpace?: string

  ExposureMode?: string
  SceneCaptureType?: string

  Aperture?: number
  ScaleFactor35efl?: number
  ShutterSpeed?: string | number
  LightValue?: number

  DateTimeOriginal?: string
  DateTimeDigitized?: string

  ImageWidth?: number
  ImageHeight?: number

  MeteringMode: Tags['MeteringMode']
  WhiteBalance: Tags['WhiteBalance']
  WBShiftAB: Tags['WBShiftAB']
  WBShiftGM: Tags['WBShiftGM']
  WhiteBalanceBias: Tags['WhiteBalanceBias']
  WhiteBalanceFineTune: Tags['WhiteBalanceFineTune']
  FlashMeteringMode: Tags['FlashMeteringMode']
  SensingMethod: Tags['SensingMethod']
  FocalPlaneXResolution: Tags['FocalPlaneXResolution']
  FocalPlaneYResolution: Tags['FocalPlaneYResolution']
  GPSAltitude: Tags['GPSAltitude']
  GPSLatitude: Tags['GPSLatitude']
  GPSLongitude: Tags['GPSLongitude']
  GPSAltitudeRef: Tags['GPSAltitudeRef']
  GPSLatitudeRef: Tags['GPSLatitudeRef']
  GPSLongitudeRef: Tags['GPSLongitudeRef']

  // HDR Type
  MPImageType?: Tags['MPImageType']

  Rating?: number

  // Motion Photo (XMP) related fields
  MotionPhoto?: Tags['MotionPhoto']
  MotionPhotoVersion?: Tags['MotionPhotoVersion']
  MotionPhotoPresentationTimestampUs?: Tags['MotionPhotoPresentationTimestampUs']
  MicroVideo?: Tags['MicroVideo']
  MicroVideoVersion?: Tags['MicroVideoVersion']
  MicroVideoOffset?: Tags['MicroVideoOffset']
  MicroVideoPresentationTimestampUs?: Tags['MicroVideoPresentationTimestampUs']
}

export interface PhotoInfo {
  title: string
  dateTaken: string
  tags: string[]
  description: string
}

export type PhotoAiAnalysisStage =
  | 'tags'
  | 'description'
  | 'score'
  | 'critique'
  | 'suggestions'

export type PhotoAiStageStatus = 'missing' | 'processing' | 'ready' | 'failed'

export interface PhotoAiStageState {
  status: PhotoAiStageStatus
  error?: string | null
  updatedAt?: string | null
}

export interface PhotoAiScoreBreakdown {
  composition?: number | null
  lighting?: number | null
  color?: number | null
  sharpness?: number | null
  overall?: number | null
}

export interface PhotoAiAnalysis {
  description?: string | null
  score?: number | null
  scoreBreakdown?: PhotoAiScoreBreakdown | null
  evaluation?: string | null
  strengths?: string[]
  suggestions?: string[]
  language?: string | null
  model?: string | null
  generatedAt?: string | null
  stages?: Partial<Record<PhotoAiAnalysisStage, PhotoAiStageState>>
}

export type PhotoSourceType = 'image' | 'raw'
export type PhotoAssetKind = 'embedded-preview' | 'uploaded-render'

export interface PhotoAsset {
  id: number
  photoId: string
  kind: PhotoAssetKind
  storageKey?: string
  fileName: string
  mimeType: string
  fileSize: number
  width: number
  height: number
  isPrimary: boolean
  url?: string | null
  createdAt: string | Date
}

export type PhotoImageVariantName = 'thumb' | 'card' | 'view'

export interface PhotoImageVariant {
  key?: string
  url: string
  width: number
  height: number
  size: number
  format: 'webp'
}

export type PhotoImageVariants = Partial<
  Record<PhotoImageVariantName, PhotoImageVariant>
>
