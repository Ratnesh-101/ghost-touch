/**
 * The i18n keys the Ghost Hand lanes must add (Requirement 52.15, task 86). Written by Kiro.
 * Prefix `build.`. The English text is the lane's; the placeholders are named in the review file.
 * The oracle tests read this list, so the lane and the test cannot drift.
 */
export const BUILD_I18N_KEYS: readonly string[] = [
  'build.open', // Capture button: "Make my own graph"
  'build.title', // screen heading
  'build.prompt', // entry announcement
  'build.xName', // accessible name of the x slider
  'build.yName', // accessible name of the y slider
  'build.pin',
  'build.undo',
  'build.stitch', // "Stitch in order"
  'build.feel',
  'build.handIn',
  'build.pinned', // {id} {label}
  'build.occupied', // {id} {label}
  'build.badInput',
  'build.undoPin', // {id}
  'build.undoStitch',
  'build.undoNothing',
  'build.stitched', // {count}
  'build.stitchNone',
  'build.needPin', // spoken when Feel or Hand in is pressed with no pin
  'build.feelSmall', // spoken once when the canvas scale is under 352
  'build.backToForm',
  'build.leaveConfirm',
  'build.work.empty',
  'build.work.count', // {count}
  'build.work.pin', // {id} {label}
  'build.work.stitched', // {count}
  'build.handin.title',
  'build.handin.madeBy', // {name}
  'build.handin.notChecked',
  'build.handin.copy',
  'build.handin.copied',
];
