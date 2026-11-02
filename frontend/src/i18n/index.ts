/**
 * Ghost Touch i18n — single source for every user-facing string.
 * English first (Hindi / Gujarati arrive in Task 12). All screens and
 * components must call `t()` rather than inlining visible text.
 *
 * Keeping strings here makes the non-visual-first app auditable: a quick
 * grep shows every spoken/visible message, which is essential when the UI
 * is secondary to TalkBack and speech.
 */

export type Lang = 'en';

/** English string table. Nested keys read like `t('start.tapToBegin')`. */
const en: Record<string, string> = {
  'app.name': 'Ghost Touch',
  'app.tagline': 'Feel diagrams you cannot see.',
  'start.intro': 'Ghost Touch. Tap anywhere to begin.',
  'start.tapToBegin': 'Tap anywhere to begin',
  'start.begin': 'Begin',
  'capture.takePhoto': 'Take photo',
  'capture.chooseImage': 'Choose image',
  'capture.samples': 'Sample diagrams',
  'capture.reading': 'Reading your diagram',
  'ask.placeholder': 'Type a question about the diagram…',
  'ask.button': 'Ask',
  'ask.send': 'Send',
  'ask.listening': 'Listening...',
  'ask.thinking': 'Thinking...',
  'ask.busy': 'Still answering the last question. Please wait.',
  'ask.errorNoSpeech': 'No speech heard. You can type your question instead.',
  'ask.errorDenied': 'Microphone permission denied. You can type your question instead.',
  'ask.errorTimeout': 'Request timed out. You can type your question instead.',
  'ask.errorListenTimeout': "I didn't hear anything. You can type your question instead.",
  'ask.errorServer': 'Server error. You can type your question instead.',
  'ask.errorOffline': 'Network error. Check your connection or type your question.',
  'ask.errorFailed': 'Could not hear your question. You can type your question instead.',
  'ask.errorUnsupported': 'Speech recognition is not supported. You can type your question.',
  'ask.errorEmpty': 'Please enter a question.',
  'raw.announce': "I couldn't fully read this diagram. You can still feel its outlines.",
  'common.vibrationUnsupported': 'Vibration is not supported. Use Chrome on Android for full haptics.',
  // Start and Capture screens (Task 6).
  'start.noVibration':
    'Vibration is not supported on this device. Please use Chrome on Android. Audio-only mode.',
  'capture.prompt': 'Take a photo, choose an image, or pick a sample diagram.',
  'capture.sampleTriangle': 'Sample: triangle',
  'capture.sampleSine': 'Sample: sine graph',
  'capture.sampleBarchart': 'Sample: bar chart',
  'capture.error': 'Something went wrong. Please try again, or pick a sample.',
  'capture.errorSample': 'Could not open that sample. Please try again.',
  'capture.errorType': 'That file type is not supported. Use a JPEG, PNG or WebP image.',
  'capture.errorSize': 'That file is too large. Maximum is 10 megabytes.',
  'capture.errorSizeCamera': 'That photo is too large to open. Please try again.',
  'capture.busy': 'Still reading your diagram. Please wait.',
  'capture.errorEmpty': 'That file is empty. Please choose another image.',
  'capture.firstPagePdf': 'Using the first page of the PDF.',
  'capture.errorPdfPassword': 'That PDF is password protected.',
  'capture.errorPdfInvalid': "I couldn't open that PDF. Try a screenshot of the page.",
  'capture.errorPdfEmpty': 'That PDF has no pages. Please choose another diagram.',
  'capture.errorPdfTimeout': 'That PDF took too long to read. Try a screenshot of the page.',
  'capture.errorPdf':
    'PDF files are not supported yet. Please upload a screenshot or photo of the page.',
  'explore.gestureHint':
    'Double-tap and hold, then drag to feel the diagram. You start at the centre.',
  'explore.backHint': 'Press Back to leave.',
  'explore.centre': 'Centre.',
  'explore.xAxis': 'x-axis',
  'explore.yAxis': 'y-axis',
  'explore.debugWaiting': 'Relative cursor: waiting for touch',
  'explore.debugOffset': 'First hold: dx={dx}px, dy={dy}px from centre',
  'common.back': 'Back',
  // Hidden #/debug page (English only).
  'debug.title': 'Ghost Touch debug',
  'debug.ready': 'Tap any button to test it.',
  'debug.vibration': 'Vibration API',
  'debug.audio': 'Audio',
  'debug.speechOut': 'Speech output',
  'debug.speechIn': 'Speech input',
  'debug.supported': 'supported',
  'debug.notSupported': 'NOT supported (use Chrome on Android)',
  'debug.yes': 'yes',
  'debug.no': 'no',
  'debug.returned': 'returned',
  'debug.tone': 'Tone',
  'debug.toneOff': 'Tone off',
  'debug.stopped': 'Vibration stopped',
  'debug.listening': 'Listening...',
  'debug.heard': 'Heard:',
  'debug.listenFailed': 'Listen failed:',
  'debug.sample': 'Point B. This is a speech test.',
  'debug.btnLine': 'Line buzz',
  'debug.btnCorner': 'Corner pattern',
  'debug.btnStop': 'Stop vibration',
  'debug.btnToneLow': 'Tone low',
  'debug.btnToneHigh': 'Tone high',
  'debug.btnToneOff': 'Tone off',
  'debug.btnBeep': 'Beep',
  'debug.btnSpeak': 'Speak sample',
  'debug.btnListen': 'Listen',
};

const tables: Record<Lang, Record<string, string>> = { en };

let currentLang: Lang = 'en';

/** Set the active language. */
export function setLang(lang: Lang): void {
  currentLang = lang;
}

/** Get the active language. */
export function getLang(): Lang {
  return currentLang;
}

/**
 * Translate a dot-path key. Falls back to the key itself when missing, so a
 * missing translation is loud during review rather than silently blank.
 */
export function t(key: string): string {
  return tables[currentLang][key] ?? key;
}
