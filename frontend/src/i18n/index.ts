/**
 * Ghost Touch i18n — single source for every user-facing string.
 * Supports English ('en'), Hindi ('hi'), and Gujarati ('gu').
 * All screens and components call `t()` rather than inlining visible text.
 *
 * Language preference is persisted to localStorage (wrapped in try/catch).
 */

import { safeGet, safeSet } from '../drivers/storage';

export type Lang = 'en' | 'hi' | 'gu';

export const SUPPORTED_LANGS: readonly Lang[] = ['en', 'hi', 'gu'] as const;

export const LANG_BCP47: Record<Lang, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  gu: 'gu-IN',
};

export const LANG_NAMES: Record<Lang, { native: string; english: string }> = {
  en: { native: 'English', english: 'English' },
  hi: { native: 'हिन्दी', english: 'Hindi' },
  gu: { native: 'ગુજરાતી', english: 'Gujarati' },
};

export const STORAGE_KEY_LANG = 'gt_language';

export function getStoredLang(): Lang {
  const val = safeGet(STORAGE_KEY_LANG);
  if (val === 'en' || val === 'hi' || val === 'gu') return val;
  return 'en';
}

export function setStoredLang(lang: Lang): void {
  safeSet(STORAGE_KEY_LANG, lang);
}

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
  // Speech rate
  'rate.label': 'Speech rate',
  'rate.slow': 'Slow speech',
  'rate.normal': 'Normal speech',
  'rate.fast': 'Fast speech',
  'rate.setSlow': 'Speech rate set to slow.',
  'rate.setNormal': 'Speech rate set to normal.',
  'rate.setFast': 'Speech rate set to fast.',
  // Languages
  'lang.label': 'Language',
  'lang.en': 'English',
  'lang.hi': 'Hindi',
  'lang.gu': 'Gujarati',
  'lang.changedEn': 'Language set to English.',
  'lang.changedHi': 'भाषा हिंदी में सेट की गई।',
  'lang.changedGu': 'ભાષા ગુજરાતીમાં સેટ થઈ.',
  'speech.noVoiceNotice': 'No system voice found for {lang}. Using default voice.',
  // Explore voice commands
  'commands.button': 'Voice command',
  'commands.help': 'Available commands: where am I, repeat, next corner, describe, rate, help.',
  'commands.noSpoken': 'Nothing has been spoken yet.',
  'commands.noPoints': 'This diagram has no labelled corners.',
  'commands.cornerAnnounce': 'Corner {index} of {total}: Point {label} at {pos}.',
  'commands.whereNearVertex': 'Near Point {label}, {pos}.',
  'commands.whereNearLine': 'Near line {label}, {pos}.',
  'commands.whereEmpty': 'In open space, {pos}.',
  'pos.centre': 'centre',
  'pos.topLeft': 'top left',
  'pos.topRight': 'top right',
  'pos.bottomLeft': 'bottom left',
  'pos.bottomRight': 'bottom right',
  'pos.top': 'top',
  'pos.bottom': 'bottom',
  'pos.left': 'left',
  'pos.right': 'right',
  'commands.describe': 'Diagram: {title}. {facts}',
  'commands.noFacts': 'No extra facts available.',
  'commands.unrecognized': 'Command not recognized. Say help for commands.',
  'svara.skip': 'Tap to skip creature voice.',
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

// TODO-REVIEW: machine-translated strings for Hindi
const hi: Record<string, string> = {
  'app.name': 'घोस्ट टच',
  'app.tagline': 'वे चित्र महसूस करें जो आप देख नहीं सकते।',
  'start.intro': 'घोस्ट टच। शुरू करने के लिए कहीं भी टैप करें।',
  'start.tapToBegin': 'शुरू करने के लिए कहीं भी टैप करें',
  'start.begin': 'शुरू करें',
  'capture.takePhoto': 'फोटो लें',
  'capture.chooseImage': 'छवि चुनें',
  'capture.samples': 'नमूना चित्र',
  'capture.reading': 'आपके चित्र को पढ़ा जा रहा है',
  'ask.placeholder': 'चित्र के बारे में प्रश्न पूछें…',
  'ask.button': 'पूछें',
  'ask.send': 'भेजें',
  'ask.listening': 'सुन रहा हूँ...',
  'ask.thinking': 'सोच रहा हूँ...',
  'ask.busy': 'पिछले प्रश्न का उत्तर अभी दिया जा रहा है। कृपया प्रतीक्षा करें।',
  'ask.errorNoSpeech': 'कोई आवाज़ सुनाई नहीं दी। आप अपना प्रश्न टाइप कर सकते हैं।',
  'ask.errorDenied': 'माइक्रोफ़ोन की अनुमति अस्वीकृत। आप अपना प्रश्न टाइप कर सकते हैं।',
  'ask.errorTimeout': 'अनुरोध का समय समाप्त हो गया। आप अपना प्रश्न टाइप कर सकते हैं।',
  'ask.errorListenTimeout': 'मुझे कुछ सुनाई नहीं दिया। आप अपना प्रश्न टाइप कर सकते हैं।',
  'ask.errorServer': 'सर्वर त्रुटि। आप अपना प्रश्न टाइप कर सकते हैं।',
  'ask.errorOffline': 'नेटवर्क त्रुटि। अपना कनेक्शन जांचें या अपना प्रश्न टाइप करें।',
  'ask.errorFailed': 'आपका प्रश्न सुना नहीं जा सका। आप अपना प्रश्न टाइप कर सकते हैं।',
  'ask.errorUnsupported': 'वाणी पहचान समर्थित नहीं है। आप अपना प्रश्न टाइप कर सकते हैं।',
  'ask.errorEmpty': 'कृपया एक प्रश्न दर्ज करें।',
  'raw.announce': 'मैं इस चित्र को पूरी तरह नहीं पढ़ सका। आप अभी भी इसकी रूपरेखा महसूस कर सकते हैं।',
  'common.vibrationUnsupported': 'कंपन समर्थित नहीं है। पूर्ण हैप्टिक्स के लिए एंड्रॉइड पर क्रोम का उपयोग करें।',
  'start.noVibration':
    'इस डिवाइस पर कंपन समर्थित नहीं है। कृपया एंड्रॉइड पर क्रोम का उपयोग करें। केवल ऑडियो मोड।',
  'capture.prompt': 'फोटो लें, कोई छवि चुनें, या कोई नमूना चित्र चुनें।',
  'capture.sampleTriangle': 'नमूना: त्रिभुज',
  'capture.sampleSine': 'नमूना: साइन ग्राफ़',
  'capture.sampleBarchart': 'नमूना: बार चार्ट',
  'capture.error': 'कुछ गलत हो गया। कृपया पुन: प्रयास करें, या कोई नमूना चुनें।',
  'capture.errorSample': 'वह नमूना नहीं खोला जा सका। कृपया पुन: प्रयास करें।',
  'capture.errorType': 'वह फ़ाइल प्रकार समर्थित नहीं है। JPEG, PNG या WebP छवि का उपयोग करें।',
  'capture.errorSize': 'वह फ़ाइल बहुत बड़ी है। अधिकतम 10 मेगाबाइट है।',
  'capture.errorSizeCamera': 'वह फोटो बहुत बड़ी है। कृपया पुन: प्रयास करें।',
  'capture.busy': 'चित्र अभी भी पढ़ा जा रहा है। कृपया प्रतीक्षा करें।',
  'capture.errorEmpty': 'वह फ़ाइल खाली है। कृपया दूसरी छवि चुनें।',
  'capture.firstPagePdf': 'पीडीएफ के पहले पृष्ठ का उपयोग कर रहे हैं।',
  'capture.errorPdfPassword': 'वह पीडीएफ पासवर्ड से सुरक्षित है।',
  'capture.errorPdfInvalid': 'मैं उस पीडीएफ को नहीं खोल सका। पृष्ठ का स्क्रीनशॉट आज़माएं।',
  'capture.errorPdfEmpty': 'उस पीडीएफ में कोई पृष्ठ नहीं है। कृपया दूसरा चित्र चुनें।',
  'capture.errorPdfTimeout': 'उस पीडीएफ को पढ़ने में बहुत समय लगा। पृष्ठ का स्क्रीनशॉट आज़माएं।',
  'capture.errorPdf':
    'पीडीएफ फाइलें अभी समर्थित नहीं हैं। कृपया पृष्ठ का स्क्रीनशॉट या फोटो अपलोड करें।',
  'explore.gestureHint':
    'डबल-टैप करके दबाए रखें, फिर चित्र महसूस करने के लिए खींचें। आप केंद्र से शुरू करते हैं।',
  'explore.backHint': 'वापस जाने के लिए बैक दबाएं।',
  'explore.centre': 'केंद्र।',
  'explore.xAxis': 'x-अक्ष',
  'explore.yAxis': 'y-अक्ष',
  'explore.debugWaiting': 'सापेक्ष कर्सर: स्पर्श की प्रतीक्षा',
  'explore.debugOffset': 'पहला स्पर्श: dx={dx}px, dy={dy}px केंद्र से',
  'common.back': 'वापस',
  // Speech rate
  'rate.label': 'बोलने की गति',
  'rate.slow': 'धीमी गति',
  'rate.normal': 'सामान्य गति',
  'rate.fast': 'तेज़ गति',
  'rate.setSlow': 'बोलने की गति धीमी कर दी गई है।',
  'rate.setNormal': 'बोलने की गति सामान्य कर दी गई है।',
  'rate.setFast': 'बोलने की गति तेज़ कर दी गई है।',
  // Languages
  'lang.label': 'भाषा',
  'lang.en': 'अंग्रेज़ी',
  'lang.hi': 'हिन्दी',
  'lang.gu': 'गुजराती',
  'lang.changedEn': 'Language set to English.',
  'lang.changedHi': 'भाषा हिंदी में सेट की गई।',
  'lang.changedGu': 'ભાષા ગુજરાતીમાં સેટ થઈ.',
  'speech.noVoiceNotice': '{lang} के लिए कोई सिस्टम आवाज़ नहीं मिली। डिफ़ॉल्ट आवाज़ का उपयोग कर रहे हैं।',
  // Explore voice commands
  'commands.button': 'ध्वनि कमांड',
  'commands.help': 'उपलब्ध कमांड: कहाँ हूँ मैं, दोहराएं, अगला कोना, वर्णन करें, गति, मदद।',
  'commands.noSpoken': 'अभी तक कुछ नहीं बोला गया है।',
  'commands.noPoints': 'इस चित्र में कोई लेबल वाले कोने नहीं हैं।',
  'commands.cornerAnnounce': 'कोना {index}/{total}: बिंदु {label}, स्थिति {pos}।',
  'commands.whereNearVertex': 'बिंदु {label} के पास, {pos}।',
  'commands.whereNearLine': 'रेखा {label} के पास, {pos}।',
  'commands.whereEmpty': 'खाली जगह में, {pos}।',
  'pos.centre': 'केंद्र',
  'pos.topLeft': 'ऊपर बाएँ',
  'pos.topRight': 'ऊपर दाएँ',
  'pos.bottomLeft': 'नीचे बाएँ',
  'pos.bottomRight': 'नीचे दाएँ',
  'pos.top': 'ऊपर',
  'pos.bottom': 'नीचे',
  'pos.left': 'बाएँ',
  'pos.right': 'दाएँ',
  'commands.describe': 'चित्र: {title}। {facts}',
  'commands.noFacts': 'कोई अतिरिक्त तथ्य उपलब्ध नहीं हैं।',
  'commands.unrecognized': 'कमांड समझ में नहीं आया। कमांड जानने के लिए मदद बोलें।',
  'svara.skip': 'जीव की आवाज़ छोड़ने के लिए टैप करें।',
  // Hidden #/debug page
  'debug.title': 'घोस्ट टच डिबग',
  'debug.ready': 'परीक्षण के लिए किसी भी बटन पर टैप करें।',
  'debug.vibration': 'वाइब्रेशन एपीआई',
  'debug.audio': 'ऑडियो',
  'debug.speechOut': 'आवाज़ आउटपुट',
  'debug.speechIn': 'आवाज़ इनपुट',
  'debug.supported': 'समर्थित',
  'debug.notSupported': 'समर्थित नहीं है (एंड्रॉइड पर क्रोम का उपयोग करें)',
  'debug.yes': 'हाँ',
  'debug.no': 'नहीं',
  'debug.returned': 'लौटाया गया',
  'debug.tone': 'टोन',
  'debug.toneOff': 'टोन बंद',
  'debug.stopped': 'वाइब्रेशन बंद',
  'debug.listening': 'सुन रहा हूँ...',
  'debug.heard': 'सुना गया:',
  'debug.listenFailed': 'सुनने में विफल:',
  'debug.sample': 'बिंदु B। यह एक वाणी परीक्षण है।',
  'debug.btnLine': 'रेखा बज़',
  'debug.btnCorner': 'कोना पैटर्न',
  'debug.btnStop': 'वाइब्रेशन रोकें',
  'debug.btnToneLow': 'कम टोन',
  'debug.btnToneHigh': 'उच्च टोन',
  'debug.btnToneOff': 'टोन बंद',
  'debug.btnBeep': 'बीप',
  'debug.btnSpeak': 'नमूना बोलें',
  'debug.btnListen': 'सुनें',
};

// TODO-REVIEW: machine-translated strings for Gujarati
const gu: Record<string, string> = {
  'app.name': 'ગોસ્ટ ટચ',
  'app.tagline': 'જે આકૃતિઓ તમે જોઈ શકતા નથી તેને સ્પર્શથી અનુભવો.',
  'start.intro': 'ગોસ્ટ ટચ. શરૂ કરવા માટે ગમે ત્યાં ટેપ કરો.',
  'start.tapToBegin': 'શરૂ કરવા માટે ગમે ત્યાં ટેપ કરો',
  'start.begin': 'શરૂ કરો',
  'capture.takePhoto': 'ફોટો લો',
  'capture.chooseImage': 'ઇમેજ પસંદ કરો',
  'capture.samples': 'નમૂના આકૃતિઓ',
  'capture.reading': 'તમારી આકૃતિ વાંચી રહ્યા છીએ',
  'ask.placeholder': 'આકૃતિ વિશે પ્રશ્ન પૂછો…',
  'ask.button': 'પૂછો',
  'ask.send': 'મોકલો',
  'ask.listening': 'સાંભળી રહ્યા છીએ...',
  'ask.thinking': 'વિચારી રહ્યા છીએ...',
  'ask.busy': 'હજુ પાછલા પ્રશ્નનો ઉત્તર આપી રહ્યા છીએ. કૃપા કરીને રાહ જુઓ.',
  'ask.errorNoSpeech': 'કોઈ અવાજ સંભળાયો નથી. તમે તમારો પ્રશ્ન લખી શકો છો.',
  'ask.errorDenied': 'માઇક્રોફોન પરવાનગી નકારી. તમે તમારો પ્રશ્ન લખી શકો છો.',
  'ask.errorTimeout': 'સમય સમાપ્ત થયો. તમે તમારો પ્રશ્ન લખી શકો છો.',
  'ask.errorListenTimeout': 'મને કંઈ સંભળાયું નથી. તમે તમારો પ્રશ્ન લખી શકો છો.',
  'ask.errorServer': 'સર્વર ક્ષતિ. તમે તમારો પ્રશ્ન લખી શકો છો.',
  'ask.errorOffline': 'નેટવર્ક ક્ષતિ. તમારું જોડાણ તપાસો અથવા પ્રશ્ન લખો.',
  'ask.errorFailed': 'તમારો પ્રશ્ન સંભળાયો નથી. તમે તમારો પ્રશ્ન લખી શકો છો.',
  'ask.errorUnsupported': 'વાણી ઓળખ સપોર્ટેડ નથી. તમે તમારો પ્રશ્ન લખી શકો છો.',
  'ask.errorEmpty': 'કૃપા કરીને પ્રશ્ન દાખલ કરો.',
  'raw.announce': 'હું આ આકૃતિ સંપૂર્ણ રીતે વાંચી શક્યો નથી. તમે હજી પણ તેની રૂપરેખા અનુભવી શકો છો.',
  'common.vibrationUnsupported': 'વાઇબ્રેશન સપોર્ટેડ નથી. સંપૂર્ણ હેપ્ટિક્સ માટે Android પર Chrome વાપરો.',
  'start.noVibration':
    'આ ઉપકરણ પર વાઇબ્રેશન સપોર્ટેડ નથી. કૃપા કરીને Android પર Chrome વાપરો. માત્ર ઓડિયો મોડ.',
  'capture.prompt': 'ફોટો લો, ઇમેજ પસંદ કરો, અથવા નમૂના આકૃતિ પસંદ કરો.',
  'capture.sampleTriangle': 'નમૂનો: ત્રિકોણ',
  'capture.sampleSine': 'નમૂનો: સાઇન આલેખ',
  'capture.sampleBarchart': 'નમૂનો: સ્તંભ આલેખ',
  'capture.error': 'કંઈક ખોટું થયું. કૃપા કરીને ફરી પ્રયાસ કરો, અથવા નમૂનો પસંદ કરો.',
  'capture.errorSample': 'તે નમૂનો ખોલી શકાયો નથી. કૃપા કરીને ફરી પ્રયાસ કરો.',
  'capture.errorType': 'તે ફાઇલ પ્રકાર સપોર્ટેડ નથી. JPEG, PNG અથવા WebP ઇમેજ વાપરો.',
  'capture.errorSize': 'તે ફાઇલ ખૂબ મોટી છે. મહત્તમ 10 મેગાબાઇટ છે.',
  'capture.errorSizeCamera': 'તે ફોટો ખૂબ મોટો છે. કૃપા કરીને ફરી પ્રયાસ કરો.',
  'capture.busy': 'હજુ તમારી આકૃતિ વાંચી રહ્યા છીએ. કૃપા કરીને રાહ જુઓ.',
  'capture.errorEmpty': 'તે ફાઇલ ખાલી છે. કૃપા કરીને બીજી ઇમેજ પસંદ કરો.',
  'capture.firstPagePdf': 'પીડીએફના પ્રથમ પાનાનો ઉપયોગ કરી રહ્યા છીએ.',
  'capture.errorPdfPassword': 'તે પીડીએફ પાસવર્ડ સુરક્ષિત છે.',
  'capture.errorPdfInvalid': 'હું તે પીડીએફ ખોલી શક્યો નથી. પાનાનો સ્ક્રીનશોટ અજમાવો.',
  'capture.errorPdfEmpty': 'તે પીડીએફમાં કોઈ પાના નથી. કૃપા કરીને બીજી આકૃતિ પસંદ કરો.',
  'capture.errorPdfTimeout': 'તે પીડીએફ વાંચવામાં ઘણો સમય લાગ્યો. સ્ક્રીનશોટ અજમાવો.',
  'capture.errorPdf':
    'પીડીએફ ફાઇલો હજી સપોર્ટેડ નથી. કૃપા કરીને સ્ક્રીનશોટ અથવા ફોટો અપલોડ કરો.',
  'explore.gestureHint':
    'ડબલ-ટેપ કરીને દબાવી રાખો, પછી આકૃતિ અનુભવવા માટે ખેંચો. તમે કેન્દ્રથી શરૂ કરો છો.',
  'explore.backHint': 'પાછા જવા માટે બેક દબાવો.',
  'explore.centre': 'કેન્દ્ર.',
  'explore.xAxis': 'x-અક્ષ',
  'explore.yAxis': 'y-અક્ષ',
  'explore.debugWaiting': 'સાપેક્ષ કર્સર: સ્પર્શની રાહ',
  'explore.debugOffset': 'પ્રથમ સ્પર્શ: dx={dx}px, dy={dy}px કેન્દ્રથી',
  'common.back': 'પાછા',
  // Speech rate
  'rate.label': 'વાણી ગતિ',
  'rate.slow': 'ધીમી વાણી',
  'rate.normal': 'સામાન્ય વાણી',
  'rate.fast': 'ઝડપી વાણી',
  'rate.setSlow': 'વાણી ગતિ ધીમી કરી દેવામાં આવી છે.',
  'rate.setNormal': 'વાણી ગતિ સામાન્ય કરી દેવામાં આવી છે.',
  'rate.setFast': 'વાણી ગતિ ઝડપી કરી દેવામાં આવી છે.',
  // Languages
  'lang.label': 'ભાષા',
  'lang.en': 'અંગ્રેજી',
  'lang.hi': 'હિન્દી',
  'lang.gu': 'ગુજરાતી',
  'lang.changedEn': 'Language set to English.',
  'lang.changedHi': 'भाषा हिंदी में सेट की गई।',
  'lang.changedGu': 'ભાષા ગુજરાતીમાં સેટ થઈ.',
  'speech.noVoiceNotice': '{lang} માટે કોઈ સિસ્ટમ અવાજ મળ્યો નથી. મૂળભૂત અવાજનો ઉપયોગ થઈ રહ્યો છે.',
  // Explore voice commands
  'commands.button': 'વૉઇસ કમાન્ડ',
  'commands.help': 'ઉપલબ્ધ કમાન્ડ્સ: હું ક્યાં છું, ફરી બોલો, આગળનો ખૂણો, વર્ણન કરો, ગતિ, મદદ.',
  'commands.noSpoken': 'હજુ સુધી કંઈ બોલાયું નથી.',
  'commands.noPoints': 'આ આકૃતિમાં કોઈ લેબલવાળા ખૂણા નથી.',
  'commands.cornerAnnounce': 'ખૂણો {index}/{total}: બિંદુ {label}, સ્થાન {pos}.',
  'commands.whereNearVertex': 'બિંદુ {label} નજીક, {pos}.',
  'commands.whereNearLine': 'રેખા {label} નજીક, {pos}.',
  'commands.whereEmpty': 'ખુલ્લી જગ્યામાં, {pos}.',
  'pos.centre': 'કેન્દ્ર',
  'pos.topLeft': 'ઉપર ડાબે',
  'pos.topRight': 'ઉપર જમણે',
  'pos.bottomLeft': 'નીચે ડાબે',
  'pos.bottomRight': 'નીચે જમણે',
  'pos.top': 'ઉપર',
  'pos.bottom': 'નીચે',
  'pos.left': 'ડાબે',
  'pos.right': 'જમણે',
  'commands.describe': 'આકૃતિ: {title}. {facts}',
  'commands.noFacts': 'કોઈ વધારાની વિગતો ઉપલબ્ધ નથી.',
  'commands.unrecognized': 'કમાન્ડ સમજાયો નથી. કમાન્ડ જાણવા માટે મદદ બોલો.',
  'svara.skip': 'અવાજ છોડવા માટે ટેપ કરો.',
  // Hidden #/debug page
  'debug.title': 'ગોસ્ટ ટચ ડિબગ',
  'debug.ready': 'ચકાસણી માટે કોઈપણ બટન પર ટેપ કરો.',
  'debug.vibration': 'વાઇબ્રેશન API',
  'debug.audio': 'ઓડિયો',
  'debug.speechOut': 'વાણી આઉટપુટ',
  'debug.speechIn': 'વાણી ઇનપુટ',
  'debug.supported': 'સપોર્ટેડ',
  'debug.notSupported': 'સપોર્ટેડ નથી (Android પર Chrome વાપરો)',
  'debug.yes': 'હા',
  'debug.no': 'ના',
  'debug.returned': 'પરત આવ્યું',
  'debug.tone': 'ટોન',
  'debug.toneOff': 'ટોન બંધ',
  'debug.stopped': 'વાઇબ્રેશન બંધ',
  'debug.listening': 'સાંભળી રહ્યા છીએ...',
  'debug.heard': 'સાંભળ્યું:',
  'debug.listenFailed': 'સાંભળવામાં નિષ્ફળ:',
  'debug.sample': 'બિંદુ B. આ એક વાણી પરીક્ષણ છે.',
  'debug.btnLine': 'લાઇન બઝ',
  'debug.btnCorner': 'ખૂણો પેટર્ન',
  'debug.btnStop': 'વાઇબ્રેશન બંધ',
  'debug.btnToneLow': 'ધીમો ટોન',
  'debug.btnToneHigh': 'ઊંચો ટોન',
  'debug.btnToneOff': 'ટોન બંધ',
  'debug.btnBeep': 'બીપ',
  'debug.btnSpeak': 'નમૂનો બોલો',
  'debug.btnListen': 'સાંભળો',
};

const tables: Record<Lang, Record<string, string>> = { en, hi, gu };

let currentLang: Lang = getStoredLang();

const listeners = new Set<(lang: Lang) => void>();

/** Set the active language. Persists to localStorage and notifies listeners. */
export function setLang(lang: Lang): void {
  currentLang = lang;
  setStoredLang(lang);
  for (const listener of listeners) {
    try {
      listener(lang);
    } catch {
      // listener errors should not break state change
    }
  }
}

/** Get the active language. */
export function getLang(): Lang {
  return currentLang;
}

/** Subscribe to language changes (e.g. for React components). */
export function subscribeLang(listener: (lang: Lang) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Translate a dot-path key. Falls back to English, then to the key itself
 * when missing, so a missing translation is loud during review rather than
 * silently blank.
 */
export function t(key: string): string {
  const table = tables[currentLang];
  if (table && key in table) {
    return table[key] ?? key;
  }
  const enTable = tables.en;
  if (enTable && key in enTable) {
    return enTable[key] ?? key;
  }
  return key;
}
