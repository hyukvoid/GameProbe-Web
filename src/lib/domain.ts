// Shared vocabulary. Safe to import from client and server code.

export const CONTROLS = [
  'menu',
  'movement',
  'camera',
  'face_buttons',
  'shoulders',
  'triggers',
  'dpad',
  'vibration',
] as const
export type Control = (typeof CONTROLS)[number]

export const CONTROL_LABELS: Record<Control, string> = {
  menu: 'Menu navigation',
  movement: 'Movement (left stick)',
  camera: 'Camera (right stick)',
  face_buttons: 'A/B/X/Y',
  shoulders: 'L1/R1',
  triggers: 'L2/R2',
  dpad: 'D-pad',
  vibration: 'Vibration',
}

/** Short labels for dense tables. */
export const CONTROL_SHORT: Record<Control, string> = {
  menu: 'Menu',
  movement: 'Movement',
  camera: 'Camera',
  face_buttons: 'A/B/X/Y',
  shoulders: 'L1/R1',
  triggers: 'L2/R2',
  dpad: 'D-pad',
  vibration: 'Vibration',
}

/**
 * Evidence-side subjects. Direct tests stay on the eight physical controls above: a
 * tester only ever reports what an input did. A reviewed source can additionally state
 * whether the game accepts a controller at all, which is what the Genshin Impact
 * Android Bluetooth/USB question turns on. It is never offered as a button to press.
 */
export const EVIDENCE_CONTROLS = [...CONTROLS, 'controller_support'] as const
export type EvidenceControl = (typeof EVIDENCE_CONTROLS)[number]

export const EVIDENCE_CONTROL_LABELS: Record<EvidenceControl, string> = {
  ...CONTROL_LABELS,
  controller_support: 'Controller support',
}

export const EVIDENCE_CONTROL_SHORT: Record<EvidenceControl, string> = {
  ...CONTROL_SHORT,
  controller_support: 'Controller support',
}

/** /submit answer for "Controller detected by the game?". Stored as NULL when unknown. */
export const DETECTED_ANSWERS = ['yes', 'no', 'not_sure'] as const
export type DetectedAnswer = (typeof DETECTED_ANSWERS)[number]

export const RESULTS = ['works', 'broken'] as const
export type Result = (typeof RESULTS)[number]

export const CONNECTION_TYPES = ['bluetooth', 'usb', 'dongle'] as const
export type ConnectionType = (typeof CONNECTION_TYPES)[number]

export const CONNECTION_LABELS: Record<ConnectionType, string> = {
  bluetooth: 'Bluetooth',
  usb: 'USB cable',
  dongle: '2.4 GHz USB receiver',
}

/** Android versions offered in the form. Stored as text; NULL means unknown. */
export const ANDROID_VERSIONS = ['17', '16', '15', '14', '13', '12', '11', '10', '9', '8.1', '8.0'] as const

export const CONTROLLER_MODE_SUGGESTIONS = [
  'Android mode',
  'XInput',
  'DInput',
  'Switch mode',
  'Apple mode',
]

export const SOURCE_TYPES = ['reddit', 'youtube', 'forum', 'discord', 'official', 'article', 'other'] as const
export type SourceType = (typeof SOURCE_TYPES)[number]

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  reddit: 'Reddit',
  youtube: 'YouTube',
  forum: 'Forum',
  discord: 'Discord',
  official: 'Official',
  article: 'Article',
  other: 'Other',
}

export const REVIEW_STATUSES = ['new', 'lead', 'needs_direct_test', 'published', 'duplicate', 'rejected'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  new: 'New',
  lead: 'Research lead',
  needs_direct_test: 'Needs direct test',
  published: 'Published',
  duplicate: 'Duplicate',
  rejected: 'Rejected',
}

export const TEST_STATUSES = ['pending', 'approved', 'rejected'] as const
export type TestStatus = (typeof TEST_STATUSES)[number]

export const UNKNOWN = 'Unknown'

/**
 * Game versions must look like a real version string ("2.8.1", "5.1", "3.4.0-hotfix").
 * Words such as "latest" or "current patch" are refused so they can never be stored as
 * if they were a concrete version.
 */
export const GAME_VERSION_PATTERN = /^[0-9]+(\.[0-9]+){0,3}(-[0-9A-Za-z]+)?$/

export const ANDROID_VERSION_PATTERN = /^[0-9]{1,2}(\.[0-9]{1,2})?$/
