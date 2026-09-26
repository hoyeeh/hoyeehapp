// Cast adapters: the legacy CastController/CastReceiver direct-DB adapters were removed.
// All casting goes through the cast-signaling function (see useUniversalCast).
export {
  CastCommandType,
  parseCastSession,
  validateCommand,
} from './commandSchema';

export type {
  CastCommandTypeValue,
  CastCommandPayload,
  CastSessionState,
  LoadCommandPayload,
  SeekCommandPayload,
  VolumeCommandPayload,
  QueueItem,
  CastCommand,
} from './commandSchema';
