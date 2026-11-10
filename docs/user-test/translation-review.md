# Native Speaker Translation Review Sheet (Hindi & Gujarati)

Welcome to the translation review for **Ghost Touch**!

---

### Instructions for the Reviewer

Thank you for helping review the translations for Ghost Touch!

1. **Who you are and your role:**
   - You are reviewing the translations as a native speaker of Hindi and/or Gujarati.
   - You only need to judge the wording, grammar, tone, and natural phrasing. **You do not need to edit any code.**
   - Please indicate whether each translation is acceptable in the **Hindi OK?** and **Gujarati OK?** columns (e.g., "Yes" / "No" or checkmarks). If phrasing could be improved, please provide your suggestion in the **Better wording** column.

2. **Crucial Context: Auditory & Spoken Phrasing:**
   - Ghost Touch is an assistive web tool designed for blind and visually impaired students to explore diagrams through touch, vibrations, audio tones, and spoken descriptions.
   - **Many strings are SPOKEN ALOUD** by Text-to-Speech (marked with `(spoken)` next to the key).
   - For spoken strings, **natural spoken phrasing, cadence, and clarity when read aloud matter far more than literal word-for-word accuracy**. Sentences should be concise, conversational, and easy to understand when heard through a speaker or headphones.

3. **Placeholders / Variables (`{...}`):**
   - Text inside curly braces like `{title}`, `{index}`, `{total}`, `{label}`, `{pos}`, `{errors}`, `{lang}`, or `{rate}` represents dynamic values filled in by the app at runtime (for example: `{title}` might be replaced with "Triangle ABC").
   - **Keep all placeholders intact.** Do not delete, translate, or remove them. If you suggest better wording, make sure to retain the placeholder tokens exactly as shown (see the **Notes** column).

---

## 1. Application Strings (`app.*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `app.name (spoken)` | Ghost Touch | घोस्ट टच | ગોસ્ટ ટચ | | | | |
| `app.tagline` | Feel diagrams you can't see. | वे चित्र महसूस करें जो आप देख नहीं सकते। | જે આકૃતિઓ તમે જોઈ શકતા નથી તેને સ્પર્શથી અનુભવો. | | | | |

---

## 2. Start Screen (`start.*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `start.intro (spoken)` | Ghost Touch. Tap anywhere to begin. | घोस्ट टच। शुरू करने के लिए कहीं भी टैप करें। | ગોસ્ટ ટચ. શરૂ કરવા માટે ગમે ત્યાં ટેપ કરો. | | | | |
| `start.tapToBegin` | Tap anywhere to begin | शुरू करने के लिए कहीं भी टैप करें | શરૂ કરવા માટે ગમે ત્યાં ટેપ કરો | | | | |
| `start.begin` | Begin | शुरू करें | શરૂ કરો | | | | |
| `start.noVibration (spoken)` | Vibration is not supported on this device. Please use Chrome on Android. Audio-only mode. | इस डिवाइस पर कंपन समर्थित नहीं है। कृपया एंड्रॉइड पर क्रोम का उपयोग करें। केवल ऑडियो मोड। | આ ઉપકરણ પર વાઇબ્રેશન સપોર્ટેડ નથી. કૃપા કરીને Android પર Chrome વાપરો. માત્ર ઓડિયો મોડ. | | | | |

---

## 3. Capture Screen (`capture.*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `capture.takePhoto` | Take photo | फोटो लें | ફોટો લો | | | | |
| `capture.chooseImage` | Choose image | छवि चुनें | ઇમેજ પસંદ કરો | | | | |
| `capture.samples` | Sample diagrams | नमूना चित्र | નમૂના આકૃતિઓ | | | | |
| `capture.reading (spoken)` | Reading your diagram | आपके चित्र को पढ़ा जा रहा है | તમારી આકૃતિ વાંચી રહ્યા છીએ | | | | |
| `capture.prompt (spoken)` | Take a photo, choose an image, or pick a sample diagram. | फोटो लें, कोई छवि चुनें, या कोई नमूना चित्र चुनें। | ફોટો લો, ઇમેજ પસંદ કરો, અથવા નમૂના આકૃતિ પસંદ કરો. | | | | |
| `capture.sampleTriangle` | Sample: triangle | नमूना: त्रिभुज | નમૂનો: ત્રિકોણ | | | | |
| `capture.sampleSine` | Sample: sine graph | नमूना: साइन ग्राफ़ | નમૂનો: સાઇન આલેખ | | | | |
| `capture.sampleBarchart` | Sample: bar chart | नमूना: बार चार्ट | નમૂનો: સ્તંભ આલેખ | | | | |
| `capture.error (spoken)` | Something went wrong. Please try again, or pick a sample. | कुछ गलत हो गया। कृपया पुन: प्रयास करें, या कोई नमूना चुनें। | કંઈક ખોટું થયું. કૃપા કરીને ફરી પ્રયાસ કરો, અથવા નમૂનો પસંદ કરો. | | | | |
| `capture.errorSample (spoken)` | Could not open that sample. Please try again. | वह नमूना नहीं खोला जा सका। कृपया पुन: प्रयास करें। | તે નમૂનો ખોલી શકાયો નથી. કૃપા કરીને ફરી પ્રયાસ કરો. | | | | |
| `capture.errorType (spoken)` | That file type is not supported. Use a JPEG, PNG or WebP image. | वह फ़ाइल प्रकार समर्थित नहीं है। JPEG, PNG या WebP छवि का उपयोग करें। | તે ફાઇલ પ્રકાર સપોર્ટેડ નથી. JPEG, PNG અથવા WebP ઇમેજ વાપરો. | | | | |
| `capture.errorSize (spoken)` | That file is too large. Maximum is 10 megabytes. | वह फ़ाइल बहुत बड़ी है। अधिकतम 10 मेगाबाइट है। | તે ફાઇલ ખૂબ મોટી છે. મહત્તમ 10 મેગાબાઇટ છે. | | | | |
| `capture.errorSizeCamera (spoken)` | That photo is too large to open. Please try again. | वह फोटो बहुत बड़ी है। कृपया पुन: प्रयास करें। | તે ફોટો ખૂબ મોટો છે. કૃપા કરીને ફરી પ્રયાસ કરો. | | | | |
| `capture.busy (spoken)` | Still reading your diagram. Please wait. | चित्र अभी भी पढ़ा जा रहा है। कृपया प्रतीक्षा करें। | હજુ તમારી આકૃતિ વાંચી રહ્યા છીએ. કૃપા કરીને રાહ જુઓ. | | | | |
| `capture.errorEmpty (spoken)` | That file is empty. Please choose another image. | वह फ़ाइल खाली है। कृपया दूसरी छवि चुनें। | તે ફાઇલ ખાલી છે. કૃપા કરીને બીજી ઇમેજ પસંદ કરો. | | | | |
| `capture.errorBusy (spoken)` | The server is busy right now. Please try again in a moment. | सर्वर अभी व्यस्त है। कृपया थोड़ी देर में पुन: प्रयास करें। | સર્વર અત્યારે વ્યસ્ત છે. કૃપા કરીને થોડીવારમાં ફરી પ્રયાસ કરો. | | | | |
| `capture.firstPagePdf (spoken)` | Using the first page of the PDF. | पीडीएफ के पहले पृष्ठ का उपयोग कर रहे हैं। | પીડીએફના પ્રથમ પાનાનો ઉપયોગ કરી રહ્યા છીએ. | | | | |
| `capture.errorPdfPassword (spoken)` | That PDF is password protected. | वह पीडीएफ पासवर्ड से सुरक्षित है। | તે પીડીએફ પાસવર્ડ સુરક્ષિત છે. | | | | |
| `capture.errorPdfInvalid (spoken)` | I couldn't open that PDF. Try a screenshot of the page. | मैं उस पीडीएफ को नहीं खोल सका। पृष्ठ का स्क्रीनशॉट आज़माएं। | હું તે પીડીએફ ખોલી શક્યો નથી. પાનાનો સ્ક્રીનશોટ અજમાવો. | | | | |
| `capture.errorPdfEmpty (spoken)` | That PDF has no pages. Please choose another diagram. | उस पीडीएफ में कोई पृष्ठ नहीं है। कृपया दूसरा चित्र चुनें। | તે પીડીએફમાં કોઈ પાના નથી. કૃપા કરીને બીજી આકૃતિ પસંદ કરો. | | | | |
| `capture.errorPdfTimeout (spoken)` | That PDF took too long to read. Try a screenshot of the page. | उस पीडीएफ को पढ़ने में बहुत समय लगा। पृष्ठ का स्क्रीनशॉट आज़माएं। | તે પીડીએફ વાંચવામાં ઘણો સમય લાગ્યો. સ્ક્રીનશોટ અજમાવો. | | | | |
| `capture.errorPdf (spoken)` | PDF files are not supported yet. Please upload a screenshot or photo of the page. | पीडीएफ फाइलें अभी समर्थित नहीं हैं। कृपया पृष्ठ का स्क्रीनशॉट या फोटो अपलोड करें। | પીડીએફ ફાઇલો હજી સપોર્ટેડ નથી. કૃપા કરીને સ્ક્રીનશોટ અથવા ફોટો અપલોડ કરો. | | | | |
| `capture.savedDiagrams` | Saved diagrams | सहेजे गए आरेख | સેવ કરેલ આકૃતિઓ | | | | |

---

## 4. Ask Screen & Voice Queries (`ask.*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `ask.placeholder` | Type a question about the diagram… | चित्र के बारे में प्रश्न पूछें… | આકૃતિ વિશે પ્રશ્ન પૂછો… | | | | |
| `ask.button` | Ask | पूछें | પૂછો | | | | |
| `ask.send` | Send | भेजें | મોકલો | | | | |
| `ask.listening` | Listening... | सुन रहा हूँ... | સાંભળી રહ્યા છીએ... | | | | |
| `ask.thinking (spoken)` | Thinking... | सोच रहा हूँ... | વિચારી રહ્યા છીએ... | | | | |
| `ask.busy (spoken)` | Still answering the last question. Please wait. | पिछले प्रश्न का उत्तर अभी दिया जा रहा है। कृपया प्रतीक्षा करें। | હજુ પાછલા પ્રશ્નનો ઉત્તર આપી રહ્યા છીએ. કૃપા કરીને રાહ જુઓ. | | | | |
| `ask.errorNoSpeech (spoken)` | No speech heard. You can type your question instead. | कोई आवाज़ सुनाई नहीं दी। आप अपना प्रश्न टाइप कर सकते हैं। | કોઈ અવાજ સંભળાયો નથી. તમે તમારો પ્રશ્ન લખી શકો છો. | | | | |
| `ask.errorDenied (spoken)` | Microphone permission denied. You can type your question instead. | माइक्रोफ़ोन की अनुमति अस्वीकृत। आप अपना प्रश्न टाइप कर सकते हैं। | માઇક્રોફોન પરવાનગી નકારી. તમે તમારો પ્રશ્ન લખી શકો છો. | | | | |
| `ask.errorTimeout (spoken)` | Request timed out. You can type your question instead. | अनुरोध का समय समाप्त हो गया। आप अपना प्रश्न टाइप कर सकते हैं। | સમય સમાપ્ત થયો. તમે તમારો પ્રશ્ન લખી શકો છો. | | | | |
| `ask.errorListenTimeout (spoken)` | I didn't hear anything. You can type your question instead. | मुझे कुछ सुनाई नहीं दिया। आप अपना प्रश्न टाइप कर सकते हैं। | મને કંઈ સંભળાયું નથી. તમે તમારો પ્રશ્ન લખી શકો છો. | | | | |
| `ask.errorServer (spoken)` | Server error. You can type your question instead. | सर्वर त्रुटि। आप अपना प्रश्न टाइप कर सकते हैं। | સર્વર ક્ષતિ. તમે તમારો પ્રશ્ન લખી શકો છો. | | | | |
| `ask.errorOffline (spoken)` | Network error. Check your connection or type your question. | नेटवर्क त्रुटि। अपना कनेक्शन जांचें या अपना प्रश्न टाइप करें। | નેટવર્ક ક્ષતિ. તમારું જોડાણ તપાસો અથવા પ્રશ્ન લખો. | | | | |
| `ask.errorFailed (spoken)` | Could not hear your question. You can type your question instead. | आपका प्रश्न सुना नहीं जा सका। आप अपना प्रश्न टाइप कर सकते हैं। | તમારો પ્રશ્ન સંભળાયો નથી. તમે તમારો પ્રશ્ન લખી શકો છો. | | | | |
| `ask.errorUnsupported (spoken)` | Speech recognition is not supported. You can type your question. | वाणी पहचान समर्थित नहीं है। आप अपना प्रश्न टाइप कर सकते हैं। | વાણી ઓળખ સપોર્ટેડ નથી. તમે તમારો પ્રશ્ન લખી શકો છો. | | | | |
| `ask.errorEmpty (spoken)` | Please enter a question. | कृपया एक प्रश्न दर्ज करें। | કૃપા કરીને પ્રશ્ન દાખલ કરો. | | | | |

---

## 5. Raw Mode Announcement (`raw.*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `raw.announce (spoken)` | I couldn't fully read this diagram. You can still feel its outlines. | मैं इस चित्र को पूरी तरह नहीं पढ़ सका। आप अभी भी इसकी रूपरेखा महसूस कर सकते हैं। | હું આ આકૃતિ સંપૂર્ણ રીતે વાંચી શક્યો નથી. તમે હજી પણ તેની રૂપરેખા અનુભવી શકો છો. | | | | |

---

## 6. Common Controls & Banners (`common.*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `common.vibrationUnsupported` | Vibration is not supported. Use Chrome on Android for full haptics. | कंपन समर्थित नहीं है। पूर्ण हैप्टिक्स के लिए एंड्रॉइड पर क्रोम का उपयोग करें। | વાઇબ્રેશન સપોર્ટેડ નથી. સંપૂર્ણ હેપ્ટિક્સ માટે Android પર Chrome વાપરો. | | | | |
| `common.back` | Back | वापस | પાછા | | | | |

---

## 7. Explore Mode Navigation (`explore.*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `explore.gestureHint (spoken)` | Double-tap and hold, then drag to feel the diagram. You start at the centre. | डबल-टैप करके दबाए रखें, फिर चित्र महसूस करने के लिए खींचें। आप केंद्र से शुरू करते हैं। | ડબલ-ટેપ કરીને દબાવી રાખો, પછી આકૃતિ અનુભવવા માટે ખેંચો. તમે કેન્દ્રથી શરૂ કરો છો. | | | | |
| `explore.backHint (spoken)` | Press Back to leave. | वापस जाने के लिए बैक दबाएं। | પાછા જવા માટે બેક દબાવો. | | | | |
| `explore.centre (spoken)` | Centre. | केंद्र। | કેન્દ્ર. | | | | |
| `vertex.unlabelled (spoken)` | Point {id} | बिंदु {id} | બિંદુ {id} | | | | |
| `explore.xAxis (spoken)` | x-axis | x-अक्ष | x-અક્ષ | | | | |
| `explore.yAxis (spoken)` | y-axis | y-अक्ष | y-અક્ષ | | | | |
| `explore.debugWaiting` | Relative cursor: waiting for touch | सापेक्ष कर्सर: स्पर्श की प्रतीक्षा | સાપેક્ષ કર્સર: સ્પર્શની રાહ | | | | |
| `explore.debugOffset` | First hold: dx={dx}px, dy={dy}px from centre | पहला स्पर्श: dx={dx}px, dy={dy}px केंद्र से | પ્રથમ સ્પર્શ: dx={dx}px, dy={dy}px કેન્દ્રથી | | | | keep {dx}, {dy} |
| `explore.correct` | Correct | सुधारें | સુધારો | | | | |

---

## 8. Teacher Correction Mode (`correct.*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `correct.title` | Teacher Correction | शिक्षक सुधार | શિક્ષક સુધારણા | | | | |
| `correct.intro (spoken)` | Correction mode. Tap elements to select, drag points to adjust, and save when done. | सुधार मोड। चुनने के लिए तत्वों पर टैप करें, समायोजित करने के लिए बिंदुओं को खींचें, और पूरा होने पर सहेजें। | સુધારણા મોડ. પસંદ કરવા માટે ઘટકો પર ટેપ કરો, ગોઠવવા માટે બિંદુઓને ખેંચો અને પૂર્ણ થાય ત્યારે સાચવો. | | | | |
| `correct.save` | Save | सहेजें | સાચવો | | | | |
| `correct.undo (spoken)` | Undo | पूर्ववत करें | પૂર્વવત્ કરો | | | | |
| `correct.redo (spoken)` | Redo | फिर से करें | ફરીથી કરો | | | | |
| `correct.delete` | Delete | हटाएं | કાઢી નાખો | | | | |
| `correct.label` | Label | लेबल | લેબલ | | | | |
| `correct.applyLabel` | Apply label | लेबल लागू करें | લેબલ લાગુ કરો | | | | |
| `correct.pointMoved (spoken)` | Moved point | बिंदु स्थानांतरित किया | બિંદુ ખસેડ્યું | | | | |
| `correct.pointDeleted (spoken)` | Deleted point | बिंदु हटाया गया | બિંદુ કાઢી નાખ્યું | | | | |
| `correct.segmentDeleted (spoken)` | Deleted line | रेखा हटाई गई | રેખા કાઢી નાખી | | | | |
| `correct.labelUpdated (spoken)` | Label updated | लेबल अपडेट किया गया | લેબલ અપડેટ થયું | | | | |
| `correct.labelEmpty (spoken)` | Label cannot be empty. | लेबल खाली नहीं हो सकता। | લેબલ ખાલી હોઈ શકે નહીં. | | | | |
| `correct.validating (spoken)` | Validating diagram… | आरेख का सत्यापन किया जा रहा है… | આકૃતિની ચકાસણી થઈ રહી છે… | | | | |
| `correct.saved (spoken)` | Corrections saved. | सुधार सहेजे गए। | સુધારા સાચવવામાં આવ્યા. | | | | |
| `correct.validationFailed (spoken)` | Validation failed: {errors} | सत्यापन विफल: {errors} | ચકાસણી નિષ્ફળ: {errors} | | | | keep {errors} |
| `correct.noSelection (spoken)` | No element selected | कोई तत्व चयनित नहीं है | કોઈ ઘટક પસંદ કરેલ નથી | | | | |
| `correct.selectedPoint (spoken)` | Selected point | चयनित बिंदु | પસંદ કરેલ બિંદુ | | | | |
| `correct.selectedSegment (spoken)` | Selected line | चयनित रेखा | પસંદ કરેલ રેખા | | | | |
| `correct.photoOverlay` | Original photo with diagram overlay | आरेख ओवरले के साथ मूल फोटो | આકૃતિ ઓવરલે સાથે મૂળ ફોટો | | | | |
| `correct.cancel` | Cancel | रद्द करें | રદ કરો | | | | |

---

## 9. Saved Diagrams Library (`saved.*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `saved.heading (spoken)` | Saved diagrams | सहेजे गए आरेख | સેવ કરેલ આકૃતિઓ | | | | |
| `saved.empty (spoken)` | No saved diagrams yet. | अभी कोई सहेजा गया आरेख नहीं। | હજી કોઈ સેવ કરેલ આકૃતિ નથી. | | | | |
| `saved.open` | Open | खोलें | ખોલો | | | | |
| `saved.delete` | Delete | हटाएं | ભૂંસો | | | | |
| `saved.pin` | Pin | पिन करें | પિન કરો | | | | |
| `saved.unpin` | Unpin | पिन हटाएं | પિન દૂર કરો | | | | |
| `saved.pinned` | Pinned | पिन किया गया | પિન કર્યું | | | | |
| `saved.back` | Back to Capture | कैप्चर पर वापस | કેપ્ચર પર પાછા | | | | |
| `saved.opened (spoken)` | Opening {title}. | {title} खोल रहे हैं। | {title} ખોલી રહ્યા છીએ. | | | | keep {title} |
| `saved.deleted (spoken)` | Deleted {title}. | {title} हटा दिया। | {title} ભૂંસી નાખ્યું. | | | | keep {title} |
| `saved.pinned.announced (spoken)` | {title} pinned. | {title} पिन किया गया। | {title} પિન કર્યું. | | | | keep {title} |
| `saved.unpinned.announced (spoken)` | {title} unpinned. | {title} अनपिन किया गया। | {title} અનપિન કર્યું. | | | | keep {title} |
| `saved.errorSave (spoken)` | Could not save this diagram. | यह आरेख सहेजा नहीं जा सका। | આ આકૃતિ સેવ થઈ શકી નહીં. | | | | |
| `saved.errorStorageUnavailable (spoken)` | Saving is unavailable on this device. | इस डिवाइस पर सहेजना उपलब्ध नहीं है। | આ ઉપકરણ પર સેવ કરવું ઉપલબ્ધ નથી. | | | | |
| `saved.errorAllPinned (spoken)` | Could not save: all slots are pinned. | सहेजा नहीं जा सका: सभी स्लॉट पिन हैं। | સેવ ન થઈ: બધા સ્લૉટ પિન છે. | | | | |
| `saved.errorLoad (spoken)` | Could not load saved diagrams. | सहेजे गए आरेख लोड नहीं हो सके। | સેવ કરેલ આકૃતિઓ લોડ થઈ શકી નહીં. | | | | |
| `saved.errorDelete (spoken)` | Could not delete that diagram. | वह आरेख हटाया नहीं जा सका। | તે આકૃતિ ભૂંસી ન શકાઈ. | | | | |
| `saved.deleteConfirm (spoken)` | Delete {title}? Tap confirm to delete. | {title} हटाएं? हटाने के लिए पुष्टि करें पर टैप करें। | {title} ભૂંસવું છે? ખાતરી કરવા માટે ટેપ કરો. | | | | keep {title} |
| `saved.confirmDelete` | Confirm delete | हटाने की पुष्टि करें | ભૂંસવાની ખાતરી કરો | | | | |
| `saved.cancel` | Cancel | रद्द करें | રદ કરો | | | | |
| `saved.cancelled (spoken)` | Delete cancelled. | हटाना रद्द कर दिया गया। | ભૂંસવાનું રદ કર્યું. | | | | |

---

## 10. Speech Rate Settings (`rate.*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `rate.label` | Speech rate | बोलने की गति | વાણી ગતિ | | | | |
| `rate.slow (spoken)` | Slow speech | धीमी गति | ધીમી વાણી | | | | |
| `rate.normal (spoken)` | Normal speech | सामान्य गति | સામાન્ય વાણી | | | | |
| `rate.fast (spoken)` | Fast speech | तेज़ गति | ઝડપી વાણી | | | | |
| `rate.setSlow (spoken)` | Speech rate set to slow. | बोलने की गति धीमी कर दी गई है। | વાણી ગતિ ધીમી કરી દેવામાં આવી છે. | | | | |
| `rate.setNormal (spoken)` | Speech rate set to normal. | बोलने की गति सामान्य कर दी गई है। | વાણી ગતિ સામાન્ય કરી દેવામાં આવી છે. | | | | |
| `rate.setFast (spoken)` | Speech rate set to fast. | बोलने की गति तेज़ कर दी गई है। | વાણી ગતિ ઝડપી કરી દેવામાં આવી છે. | | | | |

---

## 11. Language Preference (`lang.*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `lang.label` | Language | भाषा | ભાષા | | | | |
| `lang.en` | English | अंग्रेज़ी | અંગ્રેજી | | | | |
| `lang.hi` | Hindi | हिन्दी | હિન્દી | | | | |
| `lang.gu` | Gujarati | गुजराती | ગુજરાતી | | | | |
| `lang.changedEn (spoken)` | Language set to English. | Language set to English. | Language set to English. | | | | |
| `lang.changedHi (spoken)` | भाषा हिंदी में सेट की गई। | भाषा हिंदी में सेट की गई। | भाषा हिंदी में सेट की गई। | | | | |
| `lang.changedGu (spoken)` | ભાષા ગુજરાતીમાં સેટ થઈ. | ભાષા ગુજરાતીમાં સેટ થઈ. | ભાષા ગુજરાતીમાં સેટ થઈ. | | | | |

---

## 12. Voice & Speech Engine Notices (`speech.*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `speech.noVoiceNotice` | No system voice found for {lang}. Using default voice. | {lang} के लिए कोई सिस्टम आवाज़ नहीं मिली। डिफ़ॉल्ट आवाज़ का उपयोग कर रहे हैं। | {lang} માટે કોઈ સિસ્ટમ અવાજ મળ્યો નથી. મૂળભૂત અવાજનો ઉપયોગ થઈ રહ્યો છે. | | | | keep {lang} |

---

## 13. Voice Commands (`commands.*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `commands.button` | Voice command | ध्वनि कमांड | વૉઇસ કમાન્ડ | | | | |
| `commands.help (spoken)` | Available commands: where am I, repeat, next corner, describe, rate, help. | उपलब्ध कमांड: कहाँ हूँ मैं, दोहराएं, अगला कोना, वर्णन करें, गति, मदद। | ઉપલબ્ધ કમાન્ડ્સ: હું ક્યાં છું, ફરી બોલો, આગળનો ખૂણો, વર્ણન કરો, ગતિ, મદદ. | | | | |
| `commands.noSpoken (spoken)` | Nothing has been spoken yet. | अभी तक कुछ नहीं बोला गया है। | હજુ સુધી કંઈ બોલાયું નથી. | | | | |
| `commands.noPoints (spoken)` | This diagram has no labelled corners. | इस चित्र में कोई लेबल वाले कोने नहीं हैं। | આ આકૃતિમાં કોઈ લેબલવાળા ખૂણા નથી. | | | | |
| `commands.cornerAnnounce (spoken)` | Corner {index} of {total}: Point {label} at {pos}. | कोना {index}/{total}: बिंदु {label}, स्थिति {pos}। | ખૂણો {index}/{total}: બિંદુ {label}, સ્થાન {pos}. | | | | keep {index}, {total}, {label}, {pos} |
| `commands.whereNearVertex (spoken)` | Near Point {label}, {pos}. | बिंदु {label} के पास, {pos}। | બિંદુ {label} નજીક, {pos}. | | | | keep {label}, {pos} |
| `commands.whereNearLine` | Near line {label}, {pos}. | रेखा {label} के पास, {pos}। | રેખા {label} નજીક, {pos}. | | | | keep {label}, {pos} |
| `commands.whereEmpty (spoken)` | In open space, {pos}. | खाली जगह में, {pos}। | ખુલ્લી જગ્યામાં, {pos}. | | | | keep {pos} |
| `commands.describe (spoken)` | Diagram: {title}. {facts} | चित्र: {title}। {facts} | આકૃતિ: {title}. {facts} | | | | keep {title}, {facts} |
| `commands.noFacts (spoken)` | No extra facts available. | कोई अतिरिक्त तथ्य उपलब्ध नहीं हैं। | કોઈ વધારાની વિગતો ઉપલબ્ધ નથી. | | | | |
| `commands.unrecognized (spoken)` | Command not recognized. Say help for commands. | कमांड समझ में नहीं आया। कमांड जानने के लिए मदद बोलें। | કમાન્ડ સમજાયો નથી. કમાન્ડ જાણવા માટે મદદ બોલો. | | | | |

---

## 14. Coarse Spatial Positions (`pos.*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `pos.centre (spoken)` | centre | केंद्र | કેન્દ્ર | | | | |
| `pos.topLeft (spoken)` | top left | ऊपर बाएँ | ઉપર ડાબે | | | | |
| `pos.topRight (spoken)` | top right | ऊपर दाएँ | ઉપર જમણે | | | | |
| `pos.bottomLeft (spoken)` | bottom left | नीचे बाएँ | નીચે ડાબે | | | | |
| `pos.bottomRight (spoken)` | bottom right | नीचे दाएँ | નીચે જમણે | | | | |
| `pos.top (spoken)` | top | ऊपर | ઉપર | | | | |
| `pos.bottom (spoken)` | bottom | नीचे | નીચે | | | | |
| `pos.left (spoken)` | left | बाएँ | ડાબે | | | | |
| `pos.right (spoken)` | right | दाएँ | જમણે | | | | |

---

## 15. Svara Creature Voice Controls (`svara.*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `svara.skip` | Tap to skip creature voice. | जीव की आवाज़ छोड़ने के लिए टैप करें। | અવાજ છોડવા માટે ટેપ કરો. | | | | |

---

## 16. Diagnostic & Debugging Panel (`debug.*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `debug.title` | Ghost Touch debug | घोस्ट टच डिबग | ગોસ્ટ ટચ ડિબગ | | | | |
| `debug.ready` | Tap any button to test it. | परीक्षण के लिए किसी भी बटन पर टैप करें। | ચકાસણી માટે કોઈપણ બટન પર ટેપ કરો. | | | | |
| `debug.vibration` | Vibration API | वाइब्रेशन एपीआई | વાઇબ્રેશન API | | | | |
| `debug.audio` | Audio | ऑडियो | ઓડિયો | | | | |
| `debug.speechOut` | Speech output | आवाज़ आउटपुट | વાણી આઉટપુટ | | | | |
| `debug.speechIn` | Speech input | आवाज़ इनपुट | વાણી ઇનપુટ | | | | |
| `debug.supported` | supported | समर्थित | સપોર્ટેડ | | | | |
| `debug.notSupported` | NOT supported (use Chrome on Android) | समर्थित नहीं है (एंड्रॉइड पर क्रोम का उपयोग करें) | સપોર્ટેડ નથી (Android પર Chrome વાપરો) | | | | |
| `debug.yes` | yes | हाँ | હા | | | | |
| `debug.no` | no | नहीं | ના | | | | |
| `debug.returned` | returned | लौटाया गया | પરત આવ્યું | | | | |
| `debug.tone` | Tone | टोन | ટોન | | | | |
| `debug.toneOff` | Tone off | टोन बंद | ટોન બંધ | | | | |
| `debug.stopped` | Vibration stopped | वाइब्रेशन बंद | વાઇબ્રેશન બંધ | | | | |
| `debug.listening` | Listening... | सुन रहा हूँ... | સાંભળી રહ્યા છીએ... | | | | |
| `debug.heard` | Heard: | सुना गया: | સાંભળ્યું: | | | | |
| `debug.listenFailed` | Listen failed: | सुनने में विफल: | સાંભળવામાં નિષ્ફળ: | | | | |
| `debug.sample (spoken)` | Point B. This is a speech test. | बिंदु B। यह एक वाणी परीक्षण है। | બિંદુ B. આ એક વાણી પરીક્ષણ છે. | | | | |
| `debug.btnLine` | Line buzz | रेखा बज़ | લાઇન બઝ | | | | |
| `debug.btnCorner` | Corner pattern | कोना पैटर्न | ખૂણો પેટર્ન | | | | |
| `debug.btnStop` | Stop vibration | वाइब्रेशन रोकें | વાઇબ્રેશન બંધ | | | | |
| `debug.btnToneLow` | Tone low | कम टोन | ધીમો ટોન | | | | |
| `debug.btnToneHigh` | Tone high | उच्च टोन | ઊંચો ટોન | | | | |
| `debug.btnToneOff` | Tone off | टोन बंद | ટોન બંધ | | | | |
| `debug.btnBeep` | Beep | बीप | બીપ | | | | |
| `debug.btnSpeak` | Speak sample | नमूना बोलें | નમૂનો બોલો | | | | |
| `debug.btnListen` | Listen | सुनें | સાંભળો | | | | |

---

## 17. Frankenstein Laboratory Theme (`lab.*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `lab.start.wake` | Wake the creature | जीव को जगाएं | પ્રાણીને જગાડો | | | | |
| `lab.start.tagline` | Feel diagrams you can't see | वे चित्र महसूस करें जो आप देख नहीं सकते | જે આકૃતિઓ તમે જોઈ શકતા નથી તેને સ્પર્શથી અનુભવો | | | | |
| `lab.start.subhint` | TalkBack & touch ready | टॉकबैक और स्पर्श तैयार | ટોકબેક અને સ્પર્શ તૈયાર | | | | |
| `lab.organ.nerves.title` | Nerves | तंत्रिकाएं | ચેતાઓ | | | | |
| `lab.organ.nerves.line` | Feel lines and corners as vibration | रेखाओं और कोनों को कंपन के रूप में महसूस करें | રેખાઓ અને ખૂણાઓને વાઇબ્રેશન તરીકે અનુભવો | | | | |
| `lab.organ.eyes.title` | Eyes | आंखें | આંખો | | | | |
| `lab.organ.eyes.line` | AI reads your diagram | एआई आपके चित्र को पढ़ता है | AI તમારી આકૃતિ વાંચે છે | | | | |
| `lab.organ.voice.title` | Voice | आवाज़ | અવાજ | | | | |
| `lab.organ.voice.line` | Tones and speech tell you more | टोन और आवाज़ आपको अधिक बताते हैं | ટોન અને વાણી તમને વધુ વિગત જણાવે છે | | | | |
| `lab.settings.button` | Settings: {lang}, {rate} | सेटिंग्स: {lang}, {rate} | સેટિંગ્સ: {lang}, {rate} | | | | keep {lang}, {rate} |
| `lab.settings.title` | Lab settings | लैब सेटिंग्स | લેબ સેટિંગ્સ | | | | |
| `lab.settings.close` | Close settings | सेटिंग्स बंद करें | સેટિંગ્સ બંધ કરો | | | | |
| `lab.settings.language` | Language | भाषा | ભાષા | | | | |
| `lab.settings.rate` | Speech speed | बोलने की गति | વાણી ગતિ | | | | |
| `lab.settings.opened (spoken)` | Lab settings opened | लैब सेटिंग्स खुली | લેબ સેટિંગ્સ ખુલી | | | | |
| `lab.settings.closed (spoken)` | Lab settings closed | लैब सेटिंग्स बंद | લેબ સેટિંગ્સ બંધ | | | | |
| `lab.loading.title` | The lab is powering up | प्रयोगशाला चालू हो रही है | લેબ ચાલુ થઈ રહી છે | | | | |
| `lab.loading.hint` | Reading your diagram… | आपके चित्र को पढ़ा जा रहा है… | તમારી આકૃતિ વાંચી રહ્યા છીએ… | | | | |
| `lab.raw.notice` | The creature's eyes are blurry — you can still feel the outlines. | जीव की आंखें धुंधली हैं — आप अभी भी रूपरेखा महसूस कर सकते हैं। | પ્રાણીની આંખો ઝાંખી છે — તમે હજી પણ રૂપરેખા અનુભવી શકો છો। | | | | |
| `lab.specimen.triangle` | Right triangle | समकोण त्रिभुज | કાટકોણ ત્રિકોણ | | | | |
| `lab.specimen.sine` | Sine wave | साइन तरंग | સાઇન તરંગ | | | | |
| `lab.specimen.bars` | Bar chart | बार चार्ट | સ્તંભ આલેખ | | | | |
| `lab.empty.saved` | No saved diagrams yet. Take a photo and save one. | अभी कोई सहेजा गया चित्र नहीं है। एक फोटो लें और सहेजें। | હજી કોઈ સેવ કરેલી આકૃતિ નથી. ફોટો લો અને સેવ કરો. | | | | |
| `lab.empty.generic` | Nothing here yet. | यहाँ अभी कुछ नहीं है। | અહીં હજી કંઈ નથી. | | | | |

---

## 18. Teacher Share & Student Open (`share.*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `share.verified` | Verified | सत्यापित | પ્રમાણિત | | | | |
| `share.verifiedBy (spoken)` | Verified by {name} | {name} द्वारा सत्यापित | {name} દ્વારા પ્રમાણિત | | | | keep {name} |
| `share.readNote` | Read note | नोट पढ़ें | નોંધ વાંચો | | | | |
| `share.hideNote` | Hide note | नोट छिपाएं | નોંધ છુપાવો | | | | |
| `share.goToStart` | Go to start | शुरुआत पर जाएं | શરૂઆત પર જાઓ | | | | |
| `share.honesty` | Verified means a person reviewed this diagram. It is not cryptographic proof. | सत्यापित का अर्थ है कि किसी व्यक्ति ने इस आरेख की समीक्षा की है। यह कोई क्रिप्टोग्राफ़िक प्रमाण नहीं है। | પ્રમાણિતનો અર્થ એ છે કે કોઈ વ્યક્તિએ આ આકૃતિની સમીક્ષા કરી છે. તે કોઈ ક્રિપ્ટોગ્રાફિક પુરાવો નથી. | | | | |
| `share.error.title` | Could not open diagram | आरेख नहीं खोला जा सका | આકૃતિ ખોલી શકાઈ નથી | | | | |
| `share.error.tooLarge (spoken)` | This shared link is too large to open. | यह साझा किया गया लिंक खोलने के लिए बहुत बड़ा है। | આ શેર કરેલી લિંક ખોલવા માટે ખૂબ મોટી છે. | | | | |
| `share.error.badFormat (spoken)` | This shared link is corrupted or incomplete. | यह साझा किया गया लिंक दूषित या अधूरा है। | આ શેર કરેલી લિંક ખરાબ થયેલી અથવા અધૂરી છે. | | | | |
| `share.error.badVersion (spoken)` | This shared link was created by an incompatible version. | यह साझा किया गया लिंक एक असंगत संस्करण द्वारा बनाया गया था। | આ શેર કરેલી લિંક અસંગત સંસ્કરણ દ્વારા બનાવવામાં આવી હતી. | | | | |
| `share.error.badScene (spoken)` | This shared diagram could not be read. | यह साझा किया गया आरेख पढ़ा नहीं जा सका। | આ શેર કરેલી આકૃતિ વાંચી શકાઈ નથી. | | | | |
| `share.error.empty (spoken)` | This shared link has no diagram. | इस साझा किए गए लिंक में कोई आरेख नहीं है। | આ શેર કરેલી લિંકમાં કોઈ આકૃતિ નથી. | | | | |
| `share.error.generic (spoken)` | Something went wrong opening this shared link. | इस साझा किए गए लिंक को खोलने में कुछ गलत हो गया। | આ શેર કરેલી લિંક ખોલવામાં કંઈક ખોટું થયું. | | | | |

---

## 22. Ask Accuracy & Semantic Explanations (`guide.semantic.accuracy.*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `guide.semantic.tie.tallestBar (spoken)` | There is a tie for the tallest bar between {labels}. | सबसे ऊँचे बार में {labels} के बीच बराबरी है। | સૌથી ઊંચા બારમાં {labels} વચ્ચે બરાબરી છે. | | | | |
| `guide.semantic.tie.shortestBar (spoken)` | There is a tie for the shortest bar between {labels}. | सबसे छोटे बार में {labels} के बीच बराबरी है। | સૌથી નાના બારમાં {labels} વચ્ચે બરાબરી છે. | | | | |
| `guide.semantic.mismatch.tallestBar (spoken)` | The tallest bar by value is {val_lbl}, but {h_lbl} is tallest in height at the {pos}. | मान के अनुसार सबसे ऊँचा बार {val_lbl} है, लेकिन ऊँचाई में {pos} पर {h_lbl} सबसे बड़ा है। | મૂલ્ય મુજબ સૌથી ઊંચો બાર {val_lbl} છે, પરંતુ ઊંચાઈમાં {pos} પર {h_lbl} સૌથી મોટો છે. | | | | |
| `guide.semantic.mismatch.shortestBar (spoken)` | The shortest bar by value is {val_lbl}, but {h_lbl} is shortest in height at the {pos}. | मान के अनुसार सबसे छोटा बार {val_lbl} है, लेकिन ऊँचाई में {pos} पर {h_lbl} सबसे छोटा है। | મૂલ્ય મુજબ સૌથી નાનો બાર {val_lbl} છે, પરંતુ ઊંચાઈમાં {pos} પર {h_lbl} સૌથી નાનો છે. | | | | |
| `guide.semantic.highestPoint (spoken)` | The highest point {label} is at the {pos}. | सबसे ऊँचा बिंदु {label}, {pos} है। | સૌથી ઊંચું બિંદુ {label}, {pos} છે. | | | | |
| `guide.semantic.lowestPoint (spoken)` | The lowest point {label} is at the {pos}. | सबसे निचला बिंदु {label}, {pos} है। | સૌથી નીચું બિંદુ {label}, {pos} છે. | | | | |

---

## 23. Internationalisation Fixes (Lane k8-i18n)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `guide.semantic.label.peak (spoken)` | peak | शिखर | શિખર | | | | needs native review |
| `guide.semantic.label.trough (spoken)` | lowest point | न्यूनतम बिंदु | સૌથી નીચું બિંદુ | | | | needs native review |
| `guide.semantic.label.origin (spoken)` | origin | मूल बिंदु | ઉદ્ભવ બિંદુ | | | | needs native review |
| `commands.cornerAnnounce (spoken)` | Corner {index} of {total}: Point {label} at {pos}. | कोना {total} में से {index}: बिंदु {label}, स्थिति {pos}। | ખૂણો {total} માંથી {index}: બિંદુ {label}, સ્થાન {pos}. | | | | needs native review (conversational phrasing replacing fraction slash) |
| `guide.semantic.none.trough (spoken)` | There is no lowest point in this diagram. | इस आरेख में कोई न्यूनतम बिंदु नहीं है। | આ આકૃતિમાં કોઈ સૌથી નીચું બિંદુ નથી. | | | | needs native review (Gujarati neuter gender agreement) |
| `backend.semantic.trough.answer (spoken)` | The lowest point is at the {pos}. | सबसे निचला बिंदु {pos} है। | સૌથી નીચું બિંદુ {pos} છે. | | | | needs native review (backend Gujarati neuter gender agreement) |
| `backend.semantic.trough.absence (spoken)` | There is no lowest point in this diagram. | इस आरेख में कोई निचला बिंदु नहीं है। | આ આકૃતિમાં કોઈ નીચું બિંદુ નથી. | | | | needs native review (backend Gujarati neuter gender agreement) |


---

## 19. Suspicious Strings (Automated Analysis & Review Hints)

The following items were identified during static codebase analysis as potentially problematic machine translations. These are provided as **hints only** for the native reviewer; the source code has **not** been modified.

### 1. Identical Text / Untranslated Across Languages
- **`lang.changedEn`**:
  - English: `Language set to English.`
  - Hindi: `Language set to English.` (Untranslated English string retained in Hindi table).
  - Gujarati: `Language set to English.` (Untranslated English string retained in Gujarati table).
  - *Recommendation:* When the user switches to English, should the spoken confirmation in Hindi be something like "भाषा अंग्रेज़ी में सेट की गई।", or is English expected? Note that `lang.changedHi` and `lang.changedGu` are also identical across all three tables (each speaking the target language confirmation).

### 2. Missing Script / English Latin Script in Indic Tables
- **`common.vibrationUnsupported` & `start.noVibration`**:
  - In Hindi, "Android" and "Chrome" are transliterated in Devanagari (`एंड्रॉइड पर क्रोम`).
  - In Gujarati, "Android" and "Chrome" are left in Latin English script (`Android પર Chrome`). Reviewer should verify if Latin script or Gujarati transliteration (`એન્ડ્રોઇડ પર ક્રોમ`) is preferred for TTS engines.
- **`debug.vibration`**:
  - Hindi transliterates "API" into Devanagari: `वाइब्रेशन एपीआई`.
  - Gujarati leaves "API" in Latin script: `વાઇબ્રેશન API`.
- **`lab.organ.eyes.line`**:
  - Hindi transliterates "AI" into Devanagari: `एआई आपके चित्र को पढ़ता है`.
  - Gujarati keeps "AI" in Latin script: `AI તમારી આકૃતિ વાંચે છે`.
- **`debug.notSupported`**:
  - Hindi: `(एंड्रॉइड पर क्रोम का उपयोग करें)` (Devanagari).
  - Gujarati: `(Android પર Chrome વાપરો)` (Latin script).
- **`debug.sample`**:
  - Both Hindi (`बिंदु B।`) and Gujarati (`બિંદુ B.`) contain Latin character `B`.
- **`explore.xAxis` & `explore.yAxis`**:
  - Hindi (`x-अक्ष`, `y-अक्ष`) and Gujarati (`x-અક્ષ`, `y-અક્ષ`) retain Latin letters `x` and `y`. While standard for math coordinate axes, reviewer should verify how native speech synthesizers pronounce these when hyphenated.

### 3. Inconsistent Vocabulary & Terminology
- **Diagram Translation Inconsistency in Hindi (`चित्र` vs `आरेख`):**
  - General UI & Explore use `चित्र` (picture/image): e.g. `capture.samples` (`नमूना चित्र`), `ask.placeholder` (`चित्र के बारे में प्रश्न पूछें…`), `lab.empty.saved` (`सहेजा गया चित्र`).
  - Correct & Saved modes use `आरेख` (diagram): e.g. `correct.validating` (`आरेख का सत्यापन...`), `correct.photoOverlay` (`आरेख ओवरले...`), `saved.heading` (`सहेजे गए आरेख`), `saved.empty` (`सहेजा गया आरेख`).
  - *Review Hint:* A STEM educational tool usually prefers a consistent term (e.g., `आरेख` or `चित्र`).
- **Save / Delete Inconsistency in Gujarati:**
  - "Save": `correct.save` uses pure Gujarati `સાચવો`, while `saved.*` and `lab.empty.saved` consistently use the English transliteration `સેવ` (`સેવ કરેલ આકૃતિઓ`, `સેવ કરવું`, `સેવ થઈ`).
  - "Delete": `correct.delete` uses `કાઢી નાખો` (remove/delete), whereas `saved.delete` uses `ભૂંસો` (literally "erase/wipe off"). Reviewer should check if `ભૂંસો` sounds natural or colloquial for deleting a saved file.
- **Creature Translation (`जीव` vs `પ્રાણી`):**
  - In English, the app features a Frankenstein phone "creature".
  - Hindi uses `जीव` (`जीव को जगाएं`, `जीव की आंखें धुंधली हैं`, `जीव की आवाज़`).
  - Gujarati uses `પ્રાણી` (`પ્રાણીને જગાડો`, `પ્રાણીની આંખો ઝાંખી છે`). Note that `પ્રાણી` typically means an animal/beast rather than an invention/creature.
  - In `svara.skip`, Gujarati completely drops the word creature (`અવાજ છોડવા માટે ટેપ કરો.` vs Hindi `जीव की आवाज़ छोड़ने के लिए टैप करें।`).
- **Laboratory Translation:**
  - In Hindi: `lab.settings.title` uses transliterated `लैब` (`लैब सेटिंग्स`), but `lab.loading.title` switches to formal Sanskritized `प्रयोगशाला` (`प्रयोगशाला चालू हो रही है`).
  - In Gujarati: Consistently uses `લેબ` (`લેબ સેટિંગ્સ`, `લેબ ચાલુ થઈ રહી છે`).

### 4. Placeholder & Formatting Discrepancies
- **`commands.cornerAnnounce`**:
  - English: `Corner {index} of {total}: Point {label} at {pos}.`
  - Hindi: `कोना {index}/{total}: बिंदु {label}, स्थिति {pos}।` (Uses fraction slash `{index}/{total}` and inserts `स्थिति` before `{pos}`).
  - Gujarati: `ખૂણો {index}/{total}: બિંદુ {label}, સ્થાન {pos}.` (Uses fraction slash `{index}/{total}` and inserts `સ્થાન` before `{pos}`).
  - *Review Hint:* When read aloud by speech synthesizers, `{index}/{total}` is often read as "index slash total" or "index divide by total", which sounds unnatural compared to "index of total" (e.g., "3 में से 1" or "3 માંથી 1").
- **`commands.describe`**:
  - English uses periods between sentences (`Diagram: {title}. {facts}`).
  - Hindi uses danda (`चित्र: {title}। {facts}`). Check whether TTS pauses naturally at danda.

### 5. Excessively Long Spoken Strings
The following spoken strings may be difficult for blind students to follow in a single breath:
- **`start.noVibration`**:
  - Hindi (90 chars): `इस डिवाइस पर कंपन समर्थित नहीं है। कृपया एंड्रॉइड पर क्रोम का उपयोग करें। केवल ऑडियो मोड।`
  - Gujarati (87 chars): `આ ઉપકરણ પર વાઇબ્રેશન સપોર્ટેડ નથી. કૃપા કરીને Android પર Chrome વાપરો. માત્ર ઓડિયો મોડ.`
- **`explore.gestureHint`**:
  - Hindi (87 chars): `डबल-टैप करके दबाए रखें, फिर चित्र महसूस करने के लिए खींचें। आप केंद्र से शुरू करते हैं।`
  - Gujarati (81 chars): `ડબલ-ટેપ કરીને દબાવી રાખો, પછી આકૃતિ અનુભવવા માટે ખેંચો. તમે કેન્દ્રથી શરૂ કરો છો.`
- **`correct.intro`**:
  - Hindi (106 chars): `सुधार मोड। चुनने के लिए तत्वों पर टैप करें, समायोजित करने के लिए बिंदुओं को खींचें, और पूरा होने पर सहेजें।`
  - Gujarati (98 chars): `સુધારણા મોડ. પસંદ કરવા માટે ઘટકો પર ટેપ કરો, ગોઠવવા માટે બિંદુઓને ખેંચો અને પૂર્ણ થાય ત્યારે સાચવો.`

---

## 19. Guide My Finger Strings (`guide.*`, `ask.guide*`, `lab.settings.guide*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `guide.start (spoken)` | Guiding to {label}. | {label} का मार्गदर्शन कर रहे हैं। | {label} તરફ માર્ગદર્શન આપી રહ્યા છીએ. | | | | keep {label} |
| `guide.stopped (spoken)` | Guide stopped. | मार्गदर्शन रोक दिया गया। | માર્ગદર્શન રોકી દીધું. | | | | |
| `guide.arrived (spoken)` | Arrived at {label}. | {label} पर पहुँच गए। | {label} પર પહોંચી ગયા. | | | | keep {label} |
| `guide.notFound (spoken)` | Could not find {label} in this diagram. | इस चित्र में {label} नहीं मिला। | આ આકૃતિમાં {label} મળ્યું નથી. | | | | keep {label} |
| `guide.notGuiding (spoken)` | Not currently guiding. | अभी मार्गदर्शन नहीं किया जा रहा है। | હાલમાં માર્ગદર્શન ચાલુ નથી. | | | | |
| `guide.hint.left (spoken)` | Move left | बाएँ चलें | ડાબે ખસો | | | | |
| `guide.hint.right (spoken)` | Move right | दाएँ चलें | જમણે ખસો | | | | |
| `guide.hint.up (spoken)` | Move up | ऊपर चलें | ઉપર ખસો | | | | |
| `guide.hint.down (spoken)` | Move down | नीचे चलें | નીચે ખસો | | | | |
| `guide.hint.up-left (spoken)` | Move up and left | ऊपर और बाएँ चलें | ઉપર અને ડાબે ખસો | | | | |
| `guide.hint.up-right (spoken)` | Move up and right | ऊपर और दाएँ चलें | ઉપર અને જમણે ખસો | | | | |
| `guide.hint.down-left (spoken)` | Move down and left | नीचे और बाएँ चलें | નીચે અને ડાબે ખસો | | | | |
| `guide.hint.down-right (spoken)` | Move down and right | नीचे और दाएँ चलें | નીચે અને જમણે ખસો | | | | |
| `guide.hint.here (spoken)` | You are here | आप यहाँ हैं | તમે અહીં છો | | | | |
| `ask.guideMe` | Guide me | मार्गदर्शन करें | માર્ગદર્શન આપો | | | | |
| `ask.guideOffer (spoken)` | Tap Guide me to feel it. | महसूस करने के लिए मार्गदर्शन करें पर टैप करें। | અનુભવવા માટે માર્ગદર્શન આપો પર ટેપ કરો. | | | | |
| `lab.settings.guide` | Guide my finger | उंगली मार्गदर्शन | આંગળી માર્ગદર્શન | | | | |
| `lab.settings.guideOn (spoken)` | Finger guidance enabled. | उंगली मार्गदर्शन सक्षम किया गया। | આંગળી માર્ગદર્શન સક્ષમ કર્યું. | | | | |
| `lab.settings.guideOff (spoken)` | Finger guidance disabled. | उंगली मार्गदर्शन अक्षम किया गया। | આંગળી માર્ગદર્શન અક્ષમ કર્યું. | | | | |
| `lab.settings.guideHint` | Tones and vibration guide your finger to targets. | टोन और कंपन आपकी उंगली को लक्ष्य तक ले जाते हैं। | ટોન અને વાઇબ્રેશન તમારી આંગળીને લક્ષ્ય સુધી લઈ જાય છે. | | | | |

---

## 20. Teacher Editor Strings (`teach.*`, `lab.settings.teacher*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `lab.settings.teacher` | Teacher tools | शिक्षक उपकरण | શિક્ષક સાધનો | | | | |
| `lab.settings.teacherHint` | Enable diagram editing, verification, and sharing tools. | आरेख संपादन, सत्यापन और साझाकरण उपकरण सक्षम करें। | આકૃતિ સંપાદન, ચકાસણી અને શેરિંગ સાધનો સક્ષમ કરો. | | | | |
| `lab.settings.teacherOn (spoken)` | Teacher tools enabled. | शिक्षक उपकरण सक्षम किए गए। | શિક્ષક સાધનો સક્ષમ કર્યા. | | | | |
| `lab.settings.teacherOff (spoken)` | Teacher tools disabled. | शिक्षक उपकरण अक्षम किए गए। | શિક્ષક સાધનો અક્ષમ કર્યા. | | | | |
| `lab.settings.openTeacher` | Open Teacher Editor | शिक्षक संपादक खोलें | શિક્ષક સંપાદક ખોલો | | | | |
| `teach.title` | Teacher Editor | शिक्षक संपादक | શિક્ષક સંપાદક | | | | |
| `teach.intro (spoken)` | Teacher editor. Edit diagrams, verify accuracy, and share with students. | शिक्षक संपादक। आरेखों को संपादित करें, सटीकता सत्यापित करें और छात्रों के साथ साझा करें। | શિક્ષક સંપાદક. આકૃતિઓ સંપાદિત કરો, ચોકસાઈ પ્રમાણિત કરો અને વિદ્યાર્થીઓ સાથે શેર કરો. | | | | |
| `teach.back` | Back | वापस | પાછા | | | | |
| `teach.load` | Load diagram | आरेख लोड करें | આકૃતિ લોડ કરો | | | | |
| `teach.loadCurrent` | Current diagram | वर्तमान आरेख | હાલની આકૃતિ | | | | |
| `teach.loadSaved` | Saved diagrams | सहेजे गए आरेख | સેવ કરેલી આકૃતિઓ | | | | |
| `teach.loadShareLink` | Paste share link | साझा लिंक पेस्ट करें | શેર લિંક પેસ્ટ કરો | | | | |
| `teach.loadInputPlaceholder` | Paste link or #s= hash | लिंक या #s= हैश पेस्ट करें | લિંક અથવા #s= હેશ પેસ્ટ કરો | | | | |
| `teach.loadBtn` | Load | लोड करें | લોડ કરો | | | | |
| `teach.loadedSuccess (spoken)` | Loaded diagram: {title} | आरेख लोड किया गया: {title} | આકૃતિ લોડ થઈ: {title} | | | | keep {title} |
| `teach.loadError (spoken)` | Could not load diagram from share link. | साझा लिंक से आरेख लोड नहीं किया जा सका। | શેર લિંક પરથી આકૃતિ લોડ થઈ શકી નથી. | | | | |
| `teach.noSavedDiagrams` | No saved diagrams available. | कोई सहेजा गया आरेख उपलब्ध नहीं है। | કોઈ સેવ કરેલી આકૃતિઓ ઉપલબ્ધ નથી. | | | | |
| `teach.closeModal` | Close | बंद करें | બંધ કરો | | | | |
| `teach.canvasLabel` | Diagram editor canvas. Use arrow keys to move selected point, Delete to remove. | आरेख संपादक कैनवास। चयनित बिंदु को स्थानांतरित करने के लिए तीर कुंजियों का उपयोग करें, हटाने के लिए Delete दबाएं। | આકૃતિ સંપાદક કેનવાસ. પસંદ કરેલા બિંદુને ખસેડવા માટે એરો કી વાપરો, કાઢી નાખવા માટે Delete દબાવો. | | | | |
| `teach.addVertex` | Add vertex | शीर्ष जोड़ें | બિંદુ ઉમેરો | | | | |
| `teach.vertexAdded (spoken)` | Added vertex {id} | शीर्ष {id} जोड़ा गया | બિંદુ {id} ઉમેરાયું | | | | keep {id} |
| `teach.delete` | Delete | हटाएं | કાઢી નાખો | | | | |
| `teach.undo` | Undo | पूर्ववत करें | પૂર્વવત્ કરો | | | | |
| `teach.redo` | Redo | फिर से करें | ફરીથી કરો | | | | |
| `teach.selectedVertex (spoken)` | Selected vertex: {label} | चयनित शीर्ष: {label} | પસંદ કરેલું બિંદુ: {label} | | | | keep {label} |
| `teach.selectedSegment (spoken)` | Selected segment: {label} | चयनित रेखा खंड: {label} | પસંદ કરેલો રેખાખંડ: {label} | | | | keep {label} |
| `teach.noSelection (spoken)` | No element selected. | कोई तत्व चयनित नहीं है। | કોઈ ઘટક પસંદ નથી. | | | | |
| `teach.vertexMoved (spoken)` | Moved vertex {id} | शीर्ष {id} स्थानांतरित किया गया | બિંદુ {id} ખસેડાયું | | | | keep {id} |
| `teach.label` | Label | लेबल | લેબલ | | | | |
| `teach.applyLabel` | Apply label | लेबल लागू करें | લેબલ લાગુ કરો | | | | |
| `teach.labelUpdated (spoken)` | Label updated | लेबल अद्यतन किया गया | લેબલ અપડેટ થયું | | | | |
| `teach.labelEmpty (spoken)` | Label cannot be empty. | लेबल खाली नहीं हो सकता। | લેબલ ખાલી હોઈ શકે નહીં. | | | | |
| `teach.axisRanges` | Axis positions (function graph) | अक्ष स्थिति (फ़ंक्शन ग्राफ़) | અક્ષ સ્થાન (વિધેય આલેખ) | | | | |
| `teach.xAxisY` | X-axis vertical position (0 to 1, empty for none) | X-अक्ष लंबवत स्थिति (0 से 1, या खाली) | X-અક્ષ ઊભી સ્થિતિ (0 થી 1, અથવા ખાલી) | | | | |
| `teach.yAxisX` | Y-axis horizontal position (0 to 1, empty for none) | Y-अक्ष क्षैतिज स्थिति (0 से 1, या खाली) | Y-અક્ષ આડી સ્થિતિ (0 થી 1, અથવા ખાલી) | | | | |
| `teach.axisInvalid (spoken)` | Axis coordinate must be between 0 and 1, or empty. | अक्ष निर्देशांक 0 और 1 के बीच होना चाहिए, या खाली। | અક્ષ યામ 0 અને 1 વચ્ચે હોવો જોઈએ, અથવા ખાલી. | | | | |
| `teach.validationTitle` | Validation status | सत्यापन स्थिति | પ્રમાણીકરણ સ્થિતિ | | | | |
| `teach.validDiagram` | Diagram is valid and ready to verify. | आरेख मान्य है और सत्यापित करने के लिए तैयार है। | આકૃતિ માન્ય છે અને પ્રમાણિત કરવા માટે તૈયાર છે. | | | | |
| `teach.invalidDiagram` | Diagram validation issues: {errors} | आरेख सत्यापन त्रुटियां: {errors} | આકૃતિ પ્રમાણીકરણ સમસ્યાઓ: {errors} | | | | keep {errors} |
| `teach.verifySection` | Verify & Share | सत्यापित करें और साझा करें | પ્રમાણિત કરો અને શેર કરો | | | | |
| `teach.teacherName` | Teacher name (required) | शिक्षक का नाम (आवश्यक) | શિક્ષકનું નામ (જરૂરી) | | | | |
| `teach.teacherNamePlaceholder` | Enter your name (max 60 chars) | अपना नाम दर्ज करें (अधिकतम 60 वर्ण) | તમારું નામ દાખલ કરો (મહત્તમ 60 અક્ષર) | | | | |
| `teach.teacherNote` | Note (optional) | नोट (वैकल्पिक) | નોંધ (વૈકલ્પિક) | | | | |
| `teach.teacherNotePlaceholder` | Optional guidance note for students (max 280 chars) | छात्रों के लिए वैकल्पिक नोट (अधिकतम 280 वर्ण) | વિદ્યાર્થીઓ માટે વૈકલ્પિક નોંધ (મહત્તમ 280 અક્ષર) | | | | |
| `teach.markVerified` | Mark verified | सत्यापित चिह्नित करें | પ્રમાણિત તરીકે ચિહ્નિત કરો | | | | |
| `teach.verifiedSuccess (spoken)` | Diagram verified and share link ready. | आरेख सत्यापित किया गया और साझा लिंक तैयार है। | આકૃતિ પ્રમાણિત થઈ અને શેર લિંક તૈયાર છે. | | | | |
| `teach.shareLink` | Share link | साझा लिंक | શેર લિંક | | | | |
| `teach.copyLink` | Copy link | लिंक कॉपी करें | લિંક કોપી કરો | | | | |
| `teach.linkCopied (spoken)` | Link copied | लिंक कॉपी हो गया | લિંક કોપી થઈ ગઈ | | | | |
| `teach.share` | Share | साझा करें | શેર કરો | | | | |
| `teach.qrCodeAlt` | QR code to open this verified diagram | इस सत्यापित आरेख को खोलने के लिए क्यूआर कोड | આ પ્રમાણિત આકૃતિ ખોલવા માટે ક્યુઆર કોડ | | | | |
| `teach.qrTooLong` | Link too long for a QR code; use Copy link | क्यूआर कोड के लिए लिंक बहुत लंबा है; लिंक कॉपी करें का उपयोग करें | ક્યુઆર કોડ માટે લિંક ખૂબ લાંબી છે; લિંક કોપી કરો વાપરો | | | | |
| `teach.qrTooLong` | Link too long for a QR code; use Copy link | क्यूआर कोड के लिए लिंक बहुत लंबा है; लिंक कॉपी करें का उपयोग करें | ક્યુઆર કોડ માટે લિંક ખૂબ લાંબી છે; લિંક કોપી કરો વાપરો | | | | exact contract message |
| `teach.linkSize` | Size: {chars} characters | आकार: {chars} वर्ण | કદ: {chars} અક્ષરો | | | | keep {chars} |
| `teach.toolbar` | Editing toolbar | संपादन उपकरण पट्टी | સંપાદન ટૂલબાર | | | | |
| `teach.verifyError` | Verification failed | सत्यापन विफल रहा | પ્રમાણીકરણ નિષ્ફળ રહ્યું | | | | |
| `teach.confirmLeave` | You have unsaved changes. Are you sure you want to leave? | आपके पास बिना सहेजे गए परिवर्तन हैं। क्या आप वाकई छोड़ना चाहते हैं? | તમારી પાસે સેવ ન કરેલા ફેરફારો છે. શું તમે ખરેખર બહાર નીકળવા માંગો છો? | | | | |
| `teach.stayingInEditor (spoken)` | Still in the editor. | अभी भी संपादक में हैं। | હજુ પણ સંપાદકમાં છો. | | | | |

---

## 20. Semantic Targets & Voice Phrases (`guide.semantic.*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `guide.semantic.none.peak (spoken)` | There is no peak in this diagram. | इस आरेख में कोई शिखर नहीं है। | આ આકૃતિમાં કોઈ શિખર નથી. | | | | |
| `guide.semantic.none.trough (spoken)` | There is no lowest point in this diagram. | इस आरेख में कोई न्यूनतम बिंदु नहीं है। | આ આકૃતિમાં કોઈ સૌથી નીચો બિંદુ નથી. | | | | |
| `guide.semantic.none.origin (spoken)` | There is no origin in this diagram. | इस आरेख में कोई मूल बिंदु नहीं है। | આ આકૃતિમાં કોઈ ઉદ્ભવ બિંદુ નથી. | | | | |
| `guide.semantic.none.tallestBar (spoken)` | There is no tallest bar in this diagram. | इस आरेख में कोई सबसे ऊँचा बार नहीं है। | આ આકૃતિમાં કોઈ સૌથી ઊંચો બાર નથી. | | | | |
| `guide.semantic.none.shortestBar (spoken)` | There is no shortest bar in this diagram. | इस आरेख में कोई सबसे छोटा बार नहीं है। | આ આકૃતિમાં કોઈ સૌથી નાનો બાર નથી. | | | | |
| `guide.semantic.none.rightAngle (spoken)` | There is no right angle in this diagram. | इस आरेख में कोई समकोण नहीं है। | આ આકૃતિમાં કોઈ કાટખૂણો નથી. | | | | |
| `guide.semantic.none.longestSide (spoken)` | There is no longest side in this diagram. | इस आरेख में कोई सबसे लंबी भुजा नहीं है। | આ આકૃતિમાં કોઈ સૌથી લાંબી બાજુ નથી. | | | | |
| `voice.target.peak (spoken phrase)` | peak / highest point / maximum / top of the curve | शिखर / सबसे ऊँचा बिंदु / अधिकतम / वक्र का शीर्ष | શિખર / સૌથી ઊંચો બિંદુ / મહત્તમ / વળાંકની ટોચ | | | | Voice command triggers |
| `voice.target.trough (spoken phrase)` | lowest point / minimum / trough / bottom of the curve | न्यूनतम बिंदु / सबसे निचला बिंदु / न्यूनतम / गर्त / वक्र का तल | સૌથી નીચો બિંદુ / ન્યૂનતમ / ગર્ત / ખાડો / વળાંકનું તળિયું | | | | Voice command triggers |
| `voice.target.origin (spoken phrase)` | origin / where the axes cross / axes crossing | मूल बिंदु / उद्गम बिंदु / जहां अक्ष मिलते हैं / अक्ष मिलन | ઉદ્ભવ બિંદુ / મૂળ બિંદુ / જ્યાં ધરીઓ મળે છે | | | | Voice command triggers |
| `voice.target.tallestBar (spoken phrase)` | tallest bar / highest bar / biggest bar | सबसे ऊँचा बार / सबसे बड़ा बार / उच्चतम बार / सबसे ऊँचा स्तंभ | સૌથી ઊંચો બાર / સૌથી મોટો બાર / સૌથી ઊંચો સ્તંભ | | | | Voice command triggers |
| `voice.target.shortestBar (spoken phrase)` | shortest bar / smallest bar / lowest bar | सबसे छोटा बार / सबसे निचला बार / सबसे छोटा स्तंभ | સૌથી ટૂંકો બાર / સૌથી નાનો બાર / સૌથી ટૂંકો સ્તંભ | | | | Voice command triggers |
| `voice.target.rightAngle (spoken phrase)` | right angle / right corner / 90 degree angle | समकोण / नब्बे अंश का कोण / 90 डिग्री का कोण | કાટખૂણો / કાટકોણ / 90 ડિગ્રીનો ખૂણો | | | | Voice command triggers |
| `voice.target.longestSide (spoken phrase)` | longest side / longest segment / longest line | सबसे लंबी भुजा / सबसे लंबा किनारा / सबसे बड़ी भुजा | સૌથી લાંબી બાજુ / સૌથી મોટો કાંઠો | | | | Voice command triggers |

---

## 21. Teacher Share & Student Open (`share.*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `share.verified` | Verified | सत्यापित | પ્રમાણિત | | | | |
| `share.verifiedBy (spoken)` | Verified by {name} | {name} द्वारा सत्यापित | {name} દ્વારા પ્રમાણિત | | | | keep {name} |
| `share.readNote` | Read note | नोट पढ़ें | નોંધ વાંચો | | | | |
| `share.hideNote` | Hide note | नोट छिपाएं | નોંધ છુપાવો | | | | |
| `share.goToStart` | Go to start | शुरुआत पर जाएं | શરૂઆત પર જાઓ | | | | |
| `share.honesty (spoken)` | Verified means a person reviewed this diagram. It is not cryptographic proof. | सत्यापित का अर्थ है कि किसी व्यक्ति ने इस आरेख की समीक्षा की है। यह कोई क्रिप्टोग्राफ़िक प्रमाण नहीं है। | પ્રમાણિતનો અર્થ એ છે કે કોઈ વ્યક્તિએ આ આકૃતિની સમીક્ષા કરી છે. તે કોઈ ક્રિપ્ટોગ્રાફિક પુરાવો નથી. | | | | spoken on request |
| `share.error.title` | Could not open diagram | आरेख नहीं खोला जा सका | આકૃતિ ખોલી શકાઈ નથી | | | | |
| `share.error.tooLarge (spoken)` | This shared link is too large to open. | यह साझा किया गया लिंक खोलने के लिए बहुत बड़ा है। | આ શેર કરેલી લિંક ખોલવા માટે ખૂબ મોટી છે. | | | | |
| `share.error.badFormat (spoken)` | This shared link is corrupted or incomplete. | यह साझा किया गया लिंक दूषित या अधूरा है। | આ શેર કરેલી લિંક ખરાબ થયેલી અથવા અધૂરી છે. | | | | |
| `share.error.badVersion (spoken)` | This shared link was created by an incompatible version. | यह साझा किया गया लिंक एक असंगत संस्करण द्वारा बनाया गया था। | આ શેર કરેલી લિંક અસંગત સંસ્કરણ દ્વારા બનાવવામાં આવી હતી. | | | | |
| `share.error.badScene (spoken)` | This shared diagram could not be read. | यह साझा किया गया आरेख पढ़ा नहीं जा सका। | આ શેર કરેલી આકૃતિ વાંચી શકાઈ નથી. | | | | |
| `share.error.empty (spoken)` | This shared link has no diagram. | इस साझा किए गए लिंक में कोई आरेख नहीं है। | આ શેર કરેલી લિંકમાં કોઈ આકૃતિ નથી. | | | | |
| `share.error.generic (spoken)` | Something went wrong opening this shared link. | इस साझा किए गए लिंक को खोलने में कुछ गलत हो गया। | આ શેર કરેલી લિંક ખોલવામાં કંઈક ખોટું થયું. | | | | |

---

## 22. Ask Accuracy & Semantic Explanations (`guide.semantic.accuracy.*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `guide.semantic.tie.tallestBar (spoken)` | There is a tie for the tallest bar between {labels}. | सबसे ऊँचे बार में {labels} के बीच बराबरी है। | સૌથી ઊંચા બારમાં {labels} વચ્ચે બરાબરી છે. | | | | |
| `guide.semantic.tie.shortestBar (spoken)` | There is a tie for the shortest bar between {labels}. | सबसे छोटे बार में {labels} के बीच बराबरी है। | સૌથી નાના બારમાં {labels} વચ્ચે બરાબરી છે. | | | | |
| `guide.semantic.mismatch.tallestBar (spoken)` | The tallest bar by value is {val_lbl}, but {h_lbl} is tallest in height at the {pos}. | मान के अनुसार सबसे ऊँचा बार {val_lbl} है, लेकिन ऊँचाई में {pos} पर {h_lbl} सबसे बड़ा है। | મૂલ્ય મુજબ સૌથી ઊંચો બાર {val_lbl} છે, પરંતુ ઊંચાઈમાં {pos} પર {h_lbl} સૌથી મોટો છે. | | | | |
| `guide.semantic.mismatch.shortestBar (spoken)` | The shortest bar by value is {val_lbl}, but {h_lbl} is shortest in height at the {pos}. | मान के अनुसार सबसे छोटा बार {val_lbl} है, लेकिन ऊँचाई में {pos} पर {h_lbl} सबसे छोटा है। | મૂલ્ય મુજબ સૌથી નાનો બાર {val_lbl} છે, પરંતુ ઊંચાઈમાં {pos} પર {h_lbl} સૌથી નાનો છે. | | | | |
| `guide.semantic.highestPoint (spoken)` | The highest point {label} is at the {pos}. | सबसे ऊँचा बिंदु {label}, {pos} है। | સૌથી ઊંચું બિંદુ {label}, {pos} છે. | | | | |
| `guide.semantic.lowestPoint (spoken)` | The lowest point {label} is at the {pos}. | सबसे निचला बिंदु {label}, {pos} है। | સૌથી નીચું બિંદુ {label}, {pos} છે. | | | | |

---

## 23. Internationalisation Fixes (Lane k8-i18n)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `guide.semantic.label.peak (spoken)` | peak | शिखर | શિખર | | | | needs native review |
| `guide.semantic.label.trough (spoken)` | lowest point | न्यूनतम बिंदु | સૌથી નીચું બિંદુ | | | | needs native review |
| `guide.semantic.label.origin (spoken)` | origin | मूल बिंदु | ઉદ્ભવ બિંદુ | | | | needs native review |
| `commands.cornerAnnounce (spoken)` | Corner {index} of {total}: Point {label} at {pos}. | कोना {total} में से {index}: बिंदु {label}, स्थिति {pos}। | ખૂણો {total} માંથી {index}: બિંદુ {label}, સ્થાન {pos}. | | | | needs native review (conversational phrasing replacing fraction slash) |
| `guide.semantic.none.trough (spoken)` | There is no lowest point in this diagram. | इस आरेख में कोई न्यूनतम बिंदु नहीं है। | આ આકૃતિમાં કોઈ સૌથી નીચું બિંદુ નથી. | | | | needs native review (Gujarati neuter gender agreement) |
| `backend.semantic.trough.answer (spoken)` | The lowest point is at the {pos}. | सबसे निचला बिंदु {pos} है। | સૌથી નીચું બિંદુ {pos} છે. | | | | needs native review (backend Gujarati neuter gender agreement) |
| `backend.semantic.trough.absence (spoken)` | There is no lowest point in this diagram. | इस आरेख में कोई निचला बिंदु नहीं है। | આ આકૃતિમાં કોઈ નીચું બિંદુ નથી. | | | | needs native review (backend Gujarati neuter gender agreement) |




---

## 23. Consistency Verification (SPEC GHOST, `verify.*`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `verify.disagree (spoken)` | Facts and drawing disagree on {name}. I can't tell which is right. | तथ्य और चित्र {name} पर असहमत हैं। मैं नहीं बता सकता कि कौन सा सही है। | તથ્યો અને આકૃતિ {name} પર અસંમત છે. હું કહી શકતો નથી કે કયું સાચું છે. | | | | keep {name}; marked for native review; never says "verified" or "trust the text" |
| `verify.angleName (spoken)` | angle {vertex} | कोण {vertex} | ખૂણા {vertex} | | | | New (Kiro, M4-10): fills {name} above for a disputed angle, e.g. "disagree on angle C". Gujarati uses the oblique form ખૂણા because પર follows. Needs native review. |


---

## 23. Offline & Cold Start Resilience (`k6-pwa-offline`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `correct.savedOffline (spoken)` | Saved without server check. | सर्वर जांच के बिना सहेजा गया। | સર્વર તપાસ વિના સાચવવામાં આવ્યું. | | | | Teacher correction saved offline |
| `capture.wakingUp (spoken)` | Waking up the server… | सर्वर चालू किया जा रहा है… | સર્વર શરૂ થઈ રહ્યું છે… | | | | Server cold-start retry notice |
| `capture.errorGateway (spoken)` | The server is waking up. Please try again in a few seconds. | सर्वर चालू हो रहा है। कृपया कुछ सेकंड में पुनः प्रयास करें। | સર્વર શરૂ થઈ રહ્યું છે. કૃપા કરીને થોડી સેકંડમાં ફરી પ્રયાસ કરો. | | | | Cold-start 502/504 notice |
| `capture.errorTimeout (spoken)` | The server took too long to respond. It may still be waking up, please try again. | सर्वर ने प्रतिक्रिया देने में बहुत अधिक समय लिया। यह अभी भी चालू हो रहा हो सकता है, कृपया पुनः प्रयास करें। | સર્વરે પ્રતિસાદ આપવામાં ઘણો સમય લીધો. તે હજી પણ શરૂ થઈ રહ્યું હોઈ શકે છે, કૃપા કરીને ફરી પ્રયાસ કરો. | | | | Scene request timeout notice |

---

## 23. Offline & Cold Start Resilience (`k6-pwa-offline`)

| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `correct.savedOffline (spoken)` | Saved without server check. | सर्वर जांच के बिना सहेजा गया। | સર્વર તપાસ વિના સાચવવામાં આવ્યું. | | | | Teacher correction saved offline |
| `capture.wakingUp (spoken)` | Waking up the server… | सर्वर चालू किया जा रहा है… | સર્વર શરૂ થઈ રહ્યું છે… | | | | Server cold-start retry notice |
| `capture.errorGateway (spoken)` | The server is waking up. Please try again in a few seconds. | सर्वर चालू हो रहा है। कृपया कुछ सेकंड में पुनः प्रयास करें। | સર્વર શરૂ થઈ રહ્યું છે. કૃપા કરીને થોડી સેકંડમાં ફરી પ્રયાસ કરો. | | | | Cold-start 502/504 notice |
| `capture.errorTimeout (spoken)` | The server took too long to respond. It may still be waking up, please try again. | सर्वर ने प्रतिक्रिया देने में बहुत अधिक समय लिया। यह अभी भी चालू हो रहा हो सकता है, कृपया पुनः प्रयास करें। | સર્વરે પ્રતિસાદ આપવામાં ઘણો સમય લીધો. તે હજી પણ શરૂ થઈ રહ્યું હોઈ શકે છે, કૃપા કરીને ફરી પ્રયાસ કરો. | | | | Scene request timeout notice |

---
## 24. Shared Link Gate & Share Honesty (`m3-shared-link-gate`)
| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `share.gate.open (button/spoken)` | Open the shared diagram | साझा किया गया आरेख खोलें | શેર કરેલી આકૃતિ ખોલો | | | | User activation gate button (GT-05) |
| `share.gate.heading` | Shared diagram | साझा किया गया आरेख | શેર કરેલી આકૃતિ | | | | Gate screen heading |
| `share.sharedBy (spoken)` | Shared by {name}, not checked | {name} द्वारा साझा किया गया, जाँचा नहीं गया | {name} દ્વારા શેર કરેલ, ચકાસાયેલ નથી | | | | R1 honesty wording; keep {name} |
| `share.sharedUnnamed (spoken)` | Shared diagram, not checked | साझा किया गया आरेख, जाँचा नहीं गया | શેર કરેલી આકૃતિ, ચકાસાયેલ નથી | | | | Fallback when name empty / stripped |
| `share.titlePrefix (spoken)` | Title: {title} | शीर्षक: {title} | શીર્ષક: {title} | | | | R3 title prefix; keep {title} |
---
## 24. Shared Link Gate & Share Honesty (`m3-shared-link-gate`)
| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `share.gate.open (button/spoken)` | Open the shared diagram | साझा किया गया आरेख खोलें | શેર કરેલી આકૃતિ ખોલો | | | | User activation gate button (GT-05) |
| `share.gate.heading` | Shared diagram | साझा किया गया आरेख | શેર કરેલી આકૃતિ | | | | Gate screen heading |
| `share.sharedBy (spoken)` | Shared by {name}, not checked | {name} द्वारा साझा किया गया, जाँचा नहीं गया | {name} દ્વારા શેર કરેલ, ચકાસાયેલ નથી | | | | R1 honesty wording; keep {name} |
| `share.sharedUnnamed (spoken)` | Shared diagram, not checked | साझा किया गया आरेख, जाँचा नहीं गया | શેર કરેલી આકૃતિ, ચકાસાયેલ નથી | | | | Fallback when name empty / stripped |
| `share.titlePrefix (spoken)` | Title: {title} | शीर्षक: {title} | શીર્ષક: {title} | | | | R3 title prefix; keep {title} |
| `capture.errorTimeout (spoken)` | The server took too long; please try again. | सर्वर ने बहुत लंबा समय लिया; कृपया पुनः प्रयास करें। | સર્વરે ઘણો સમય લીધો; કૃપા કરીને ફરી પ્રયાસ કરો. | | | | Scene request timeout notice |
| `capture.errorTimeout (spoken)` | The server took too long; please try again. | सर्वर ने बहुत लंबा समय लिया; कृपया पुनः प्रयास करें। | સર્વરે ઘણો સમય લીધો; કૃપા કરીને ફરી પ્રયાસ કરો. | | | | Scene request timeout notice |
---
## 25. Teacher Correct Exit Confirmation (`p2-r5-saved-fixes`)
| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `correct.confirmLeave (spoken)` | You have unsaved changes. Are you sure you want to leave? | आपके पास बिना सहेजे गए परिवर्तन हैं। क्या आप वाकई छोड़ना चाहते हैं? | તમારી પાસે સેવ ન કરેલા ફેરફારો છે. શું તમે ખરેખર બહાર નીકળવા માંગો છો? | | | | Confirmation dialog when leaving Teacher Correct with unsaved edits |
| `correct.stayingInEditor (spoken)` | Still in correction mode. | अभी भी सुधार मोड में हैं। | હજુ પણ સુધારણા મોડમાં છો. | | | | Spoken when cancelling exit from Teacher Correct |
---
## 25. Teacher Correct Exit Confirmation (`p2-r5-saved-fixes`)
| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `correct.confirmLeave (spoken)` | You have unsaved changes. Are you sure you want to leave? | आपके पास बिना सहेजे गए परिवर्तन हैं। क्या आप वाकई छोड़ना चाहते हैं? | તમારી પાસે સેવ ન કરેલા ફેરફારો છે. શું તમે ખરેખર બહાર નીકળવા માંગો છો? | | | | Confirmation dialog when leaving Teacher Correct with unsaved edits |
| `correct.stayingInEditor (spoken)` | Still in correction mode. | अभी भी सुधार मोड में हैं। | હજુ પણ સુધારણા મોડમાં છો. | | | | Spoken when cancelling exit from Teacher Correct |
---
## 25. Share Honesty & A11Y Fixes (`p3-r5-share-fixes`)
| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `share.honesty (spoken)` | This diagram was shared as a link. Ghost Touch has not verified it. | यह आरेख एक लिंक के रूप में साझा किया गया है। घोस्ट टच ने इसे जाँचा नहीं है। | આ આકૃતિ લિંક તરીકે શેર કરવામાં આવી છે. ગોસ્ટ ટચે આને ચકાસ્યું નથી. | | | | R5-02 honest disclaimer; marked for native review |
| `kind.geometry (spoken)` | Geometry diagram | ज्यामिति आरेख | ભૂમિતિ આકૃતિ | | | | R5-07 scene kind label; marked for native review |
| `kind.function_graph (spoken)` | Function graph | फलन ग्राफ़ | વિધેય આલેખ | | | | R5-07 scene kind label; marked for native review |
| `kind.bar_chart (spoken)` | Bar chart | बार चार्ट | સ્તંભ આલેખ | | | | R5-07 scene kind label; marked for native review |
| `kind.unknown (spoken)` | Diagram | आरेख | આકૃતિ | | | | R5-07 scene kind label; marked for native review |
---
## 25. Share Honesty & A11Y Fixes (`p3-r5-share-fixes`)
| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `share.honesty (spoken)` | This diagram was shared as a link. Ghost Touch has not verified it. | यह आरेख एक लिंक के रूप में साझा किया गया है। घोस्ट टच ने इसे जाँचा नहीं है। | આ આકૃતિ લિંક તરીકે શેર કરવામાં આવી છે. ગોસ્ટ ટચે આને ચકાસ્યું નથી. | | | | R5-02 honest disclaimer; marked for native review |
| `kind.geometry (spoken)` | Geometry diagram | ज्यामिति आरेख | ભૂમિતિ આકૃતિ | | | | R5-07 scene kind label; marked for native review |
| `kind.function_graph (spoken)` | Function graph | फलन ग्राफ़ | વિધેય આલેખ | | | | R5-07 scene kind label; marked for native review |
| `kind.bar_chart (spoken)` | Bar chart | बार चार्ट | સ્તંભ આલેખ | | | | R5-07 scene kind label; marked for native review |
| `kind.unknown (spoken)` | Diagram | आरेख | આકૃતિ | | | | R5-07 scene kind label; marked for native review |
---
## 25. Ghostwriter in Teach Mode (Requirement 20, lane g1)
| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `teach.addPoint` | Add point | बिंदु जोड़ें | બિંદુ ઉમેરો | | | | Toolbar button; marked for native review |
| `teach.addPointArmed (spoken)` | Tap the drawing where the new point goes, or press Add point again to put it in the centre. | चित्र में वहाँ टैप करें जहाँ नया बिंदु रखना है, या इसे केंद्र में रखने के लिए फिर से बिंदु जोड़ें दबाएं। | આકૃતિમાં ત્યાં ટેપ કરો જ્યાં નવું બિંદુ મૂકવું છે, અથવા તેને કેન્દ્રમાં મૂકવા માટે ફરીથી બિંદુ ઉમેરો દબાવો. | | | | Spoken when add-point armed; marked for native review |
| `teach.pointAddedUnlabelled (spoken)` | Added {point}. | {point} जोड़ा गया। | {point} ઉમેર્યું. | | | | Spoken confirmation; keep {point}; marked for native review |
| `teach.pointAddedLabelled (spoken)` | Added point {id}, labelled {label}. | बिंदु {id} जोड़ा गया, लेबल {label}। | બિંદુ {id} ઉમેર્યું, લેબલ {label}. | | | | Spoken confirmation; keep {id}, {label}; marked for native review |
| `teach.pointLimit (spoken)` | This diagram already has {max} points, the most that can be shared. | इस आरेख में पहले से ही {max} बिंदु हैं, जो साझा किए जा सकने वाले अधिकतम हैं। | આ આકૃતિમાં પહેલેથી જ {max} બિંદુઓ છે, જે શેર કરી શકાય તેટલા મહત્તમ છે. | | | | Point cap notice; keep {max}; marked for native review |
| `teach.pointBadCoords (spoken)` | That spot is outside the drawing. Try again. | वह स्थान चित्र से बाहर है। पुनः प्रयास करें। | તે સ્થાન આકૃતિની બહાર છે. ફરી પ્રયાસ કરો. | | | | Out of bounds coordinate warning; marked for native review |
| `teach.addEdge` | Add edge | किनारा जोड़ें | કાંઠો ઉમેરો | | | | Toolbar button; marked for native review |
| `teach.addEdgeFirst (spoken)` | Choose the first point. | पहला बिंदु चुनें। | પ્રથમ બિંદુ પસંદ કરો. | | | | Spoken prompt for first point; marked for native review |
| `teach.addEdgeSecond (spoken)` | {id} chosen. Choose the second point. | {id} चुना गया। दूसरा बिंदु चुनें। | {id} પસંદ કર્યું. બીજું બિંદુ પસંદ કરો. | | | | Spoken prompt for second point; keep {id}; marked for native review |
| `teach.edgeAdded (spoken)` | Joined {a} and {b}. | {a} और {b} को जोड़ा गया। | {a} અને {b} જોડ્યા. | | | | Spoken confirmation; keep {a}, {b}; marked for native review |
| `teach.edgeSamePoint (spoken)` | That is the same point. Choose a different second point. | वह वही बिंदु है। एक अलग दूसरा बिंदु चुनें। | તે એ જ બિંદુ છે. એક અલગ બીજું બિંદુ પસંદ કરો. | | | | Disallow duplicate endpoint; marked for native review |
| `teach.edgeAlreadyJoined (spoken)` | {a} and {b} are already joined. | {a} और {b} पहले से जुड़े हुए हैं। | {a} અને {b} પહેલેથી જોડાયેલા છે. | | | | Existing edge notice; keep {a}, {b}; marked for native review |
| `teach.edgeUnknownPoint (spoken)` | That point is no longer in the diagram. | वह बिंदु अब आरेख में नहीं है। | તે બિંદુ હવે આકૃતિમાં નથી. | | | | Missing point notice; marked for native review |
| `teach.edgeLimit (spoken)` | This diagram already has {max} edges, the most that can be shared. | इस आरेख में पहले से ही {max} किनारे हैं, जो साझा किए जा सकने वाले अधिकतम हैं। | આ આકૃતિમાં પહેલેથી જ {max} કાંઠા છે, જે શેર કરી શકાય તેટલા મહત્તમ છે. | | | | Edge cap notice; keep {max}; marked for native review |
| `teach.addCancelled (spoken)` | Adding cancelled. | जोड़ना रद्द किया गया। | ઉમેરવાનું રદ કર્યું. | | | | Cancelled notice; marked for native review |
| `teach.undidAddPoint (spoken)` | Undone: point {id} removed. | पूर्ववत: बिंदु {id} हटाया गया। | પૂર્વવત્: બિંદુ {id} દૂર કર્યું. | | | | Undo point notice; keep {id}; marked for native review |
| `teach.undidAddEdge (spoken)` | Undone: edge from {a} to {b} removed. | पूर्ववत: {a} से {b} तक का किनारा हटाया गया। | પૂર્વવત્: {a} થી {b} સુધીનો કાંઠો દૂર કર્યો. | | | | Undo edge notice; keep {a}, {b}; marked for native review |
---
## 25. Ghostwriter in Teach Mode (Requirement 20, lane g1)
| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `teach.addPoint` | Add point | बिंदु जोड़ें | બિંદુ ઉમેરો | | | | Toolbar button; marked for native review |
| `teach.addPointArmed (spoken)` | Tap the drawing where the new point goes, or press Add point again to put it in the centre. | चित्र में वहाँ टैप करें जहाँ नया बिंदु रखना है, या इसे केंद्र में रखने के लिए फिर से बिंदु जोड़ें दबाएं। | આકૃતિમાં ત્યાં ટેપ કરો જ્યાં નવું બિંદુ મૂકવું છે, અથવા તેને કેન્દ્રમાં મૂકવા માટે ફરીથી બિંદુ ઉમેરો દબાવો. | | | | Spoken when add-point armed; marked for native review |
| `teach.pointAddedUnlabelled (spoken)` | Added {point}. | {point} जोड़ा गया। | {point} ઉમેર્યું. | | | | Spoken confirmation; keep {point}; marked for native review |
| `teach.pointAddedLabelled (spoken)` | Added point {id}, labelled {label}. | बिंदु {id} जोड़ा गया, लेबल {label}। | બિંદુ {id} ઉમેર્યું, લેબલ {label}. | | | | Spoken confirmation; keep {id}, {label}; marked for native review |
| `teach.pointLimit (spoken)` | This diagram already has {max} points, the most that can be shared. | इस आरेख में पहले से ही {max} बिंदु हैं, जो साझा किए जा सकने वाले अधिकतम हैं। | આ આકૃતિમાં પહેલેથી જ {max} બિંદુઓ છે, જે શેર કરી શકાય તેટલા મહત્તમ છે. | | | | Point cap notice; keep {max}; marked for native review |
| `teach.pointBadCoords (spoken)` | That spot is outside the drawing. Try again. | वह स्थान चित्र से बाहर है। पुनः प्रयास करें। | તે સ્થાન આકૃતિની બહાર છે. ફરી પ્રયાસ કરો. | | | | Out of bounds coordinate warning; marked for native review |
| `teach.addEdge` | Add edge | किनारा जोड़ें | કાંઠો ઉમેરો | | | | Toolbar button; marked for native review |
| `teach.addEdgeFirst (spoken)` | Choose the first point. | पहला बिंदु चुनें। | પ્રથમ બિંદુ પસંદ કરો. | | | | Spoken prompt for first point; marked for native review |
| `teach.addEdgeSecond (spoken)` | {id} chosen. Choose the second point. | {id} चुना गया। दूसरा बिंदु चुनें। | {id} પસંદ કર્યું. બીજું બિંદુ પસંદ કરો. | | | | Spoken prompt for second point; keep {id}; marked for native review |
| `teach.edgeAdded (spoken)` | Joined {a} and {b}. | {a} और {b} को जोड़ा गया। | {a} અને {b} જોડ્યા. | | | | Spoken confirmation; keep {a}, {b}; marked for native review |
| `teach.edgeSamePoint (spoken)` | That is the same point. Choose a different second point. | वह वही बिंदु है। एक अलग दूसरा बिंदु चुनें। | તે એ જ બિંદુ છે. એક અલગ બીજું બિંદુ પસંદ કરો. | | | | Disallow duplicate endpoint; marked for native review |
| `teach.edgeAlreadyJoined (spoken)` | {a} and {b} are already joined. | {a} और {b} पहले से जुड़े हुए हैं। | {a} અને {b} પહેલેથી જોડાયેલા છે. | | | | Existing edge notice; keep {a}, {b}; marked for native review |
| `teach.edgeUnknownPoint (spoken)` | That point is no longer in the diagram. | वह बिंदु अब आरेख में नहीं है। | તે બિંદુ હવે આકૃતિમાં નથી. | | | | Missing point notice; marked for native review |
| `teach.edgeLimit (spoken)` | This diagram already has {max} edges, the most that can be shared. | इस आरेख में पहले से ही {max} किनारे हैं, जो साझा किए जा सकने वाले अधिकतम हैं। | આ આકૃતિમાં પહેલેથી જ {max} કાંઠા છે, જે શેર કરી શકાય તેટલા મહત્તમ છે. | | | | Edge cap notice; keep {max}; marked for native review |
| `teach.addCancelled (spoken)` | Adding cancelled. | जोड़ना रद्द किया गया। | ઉમેરવાનું રદ કર્યું. | | | | Cancelled notice; marked for native review |
| `teach.undidAddPoint (spoken)` | Undone: point {id} removed. | पूर्ववत: बिंदु {id} हटाया गया। | પૂર્વવત્: બિંદુ {id} દૂર કર્યું. | | | | Undo point notice; keep {id}; marked for native review |
| `teach.undidAddEdge (spoken)` | Undone: edge from {a} to {b} removed. | पूर्ववत: {a} से {b} तक का किनारा हटाया गया। | પૂર્વવત્: {a} થી {b} સુધીનો કાંઠો દૂર કર્યો. | | | | Undo edge notice; keep {a}, {b}; marked for native review |
---
## 26. Teacher Correct Mode: Delete Curves & Bars (`r1-correct-delete-curves`)
| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `correct.selectedPolyline (spoken)` | Selected curve | चयनित वक्र | પસંદ કરેલ વક્ર | | | | marked for native review |
| `correct.selectedBar (spoken)` | Selected bar | चयनित बार | પસંદ કરેલ બાર | | | | marked for native review |
| `correct.polylineDeleted (spoken)` | Deleted curve | वक्र हटाया गया | વક્ર કાઢી નાખ્યો | | | | marked for native review |
| `correct.barDeleted (spoken)` | Deleted bar | बार हटाया गया | બાર કાઢી નાખ્યો | | | | marked for native review |
| `correct.nothingLeft (spoken)` | Nothing is left to feel in this diagram. Undo brings it back. | इस आरेख में महसूस करने के लिए कुछ नहीं बचा है। पूर्ववत करने से यह वापस आ जाएगा। | આ આકૃતિમાં અનુભવવા માટે કંઈ બાકી નથી. પૂર્વવત્ કરવાથી તે પાછું આવશે. | | | | marked for native review |
---
## 26. Teacher Correct Mode: Delete Curves & Bars (`r1-correct-delete-curves`)
| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `correct.selectedPolyline (spoken)` | Selected curve | चयनित वक्र | પસંદ કરેલ વક્ર | | | | marked for native review |
| `correct.selectedBar (spoken)` | Selected bar | चयनित बार | પસંદ કરેલ બાર | | | | marked for native review |
| `correct.polylineDeleted (spoken)` | Deleted curve | वक्र हटाया गया | વક્ર કાઢી નાખ્યો | | | | marked for native review |
| `correct.barDeleted (spoken)` | Deleted bar | बार हटाया गया | બાર કાઢી નાખ્યો | | | | marked for native review |
| `correct.nothingLeft (spoken)` | Nothing is left to feel in this diagram. Undo brings it back. | इस आरेख में महसूस करने के लिए कुछ नहीं बचा है। पूर्ववत करने से यह वापस आ जाएगा। | આ આકૃતિમાં અનુભવવા માટે કંઈ બાકી નથી. પૂર્વવત્ કરવાથી તે પાછું આવશે. | | | | marked for native review |
| `share.honesty (spoken)` | This diagram was shared as a link. Ghost Touch cannot confirm it is right. | यह आरेख एक लिंक के रूप में साझा किया गया है। घोस्ट टच इसकी पुष्टि नहीं कर सकता कि यह सही है। | આ આકૃતિ લિંક તરીકે શેર કરવામાં આવી છે. ગોસ્ટ ટચ તે સાચી છે તેની પુષ્ટિ કરી શકતું નથી. | | | | Requirement 22.12 honest disclaimer; marked for native review |
| `share.honesty (spoken)` | This diagram was shared as a link. Ghost Touch cannot confirm it is right. | यह आरेख एक लिंक के रूप में साझा किया गया है। घोस्ट टच इसकी पुष्टि नहीं कर सकता कि यह सही है। | આ આકૃતિ લિંક તરીકે શેર કરવામાં આવી છે. ગોસ્ટ ટચ તે સાચી છે તેની પુષ્ટિ કરી શકતું નથી. | | | | Requirement 22.12 honest disclaimer; marked for native review |
---
## 27. Teacher Mode & Share Claims Removal (Lane z3-app-merged-fixes)
| Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `teach.validationTitle` | Validation status | मान्यता स्थिति | માન્યતા સ્થિતિ | | | | Lane z3: removed audit finding claim words; marked for native review |
| `teach.validDiagram` | Diagram is valid and ready to share. | आरेख मान्य है और साझा करने के लिए तैयार है। | આકૃતિ માન્ય છે અને શેર કરવા માટે તૈયાર છે. | | | | Lane z3: rephrased away from claim words; marked for native review |
| `teach.invalidDiagram` | Diagram validation issues: {errors} | आरेख मान्यता त्रुटियां: {errors} | આકૃતિ માન્યતા સમસ્યાઓ: {errors} | | | | Lane z3: keep {errors}; marked for native review |
| `teach.verifySection` | Ready to share | साझा करें | શેર કરો | | | | Lane z3: rephrased away from claim words; marked for native review |
| `teach.markVerified` | Ready to share | साझा करने के लिए तैयार | શેર કરવા માટે તૈયાર | | | | Lane z3: rephrased away from claim words; marked for native review |
| `teach.verifiedSuccess (spoken)` | Diagram prepared for sharing and share link ready. | आरेख तैयार किया गया और साझा लिंक तैयार है। | આકૃતિ તૈયાર કરવામાં આવી અને શેર લિંક તૈયાર છે. | | | | Lane z3: rephrased away from claim words; marked for native review |
| `teach.qrCodeAlt` | QR code to open this shared diagram | इस साझा आरेख को खोलने के लिए क्यूआर कोड | આ શેર કરેલી આકૃતિ ખોલવા માટે ક્યુઆર કોડ | | | | Lane z3: rephrased away from claim words; marked for native review |
| `teach.verifyError (spoken)` | Sharing failed | साझा करना विफल रहा | શેર કરવાનું નિષ્ફળ રહ્યું | | | | Lane z3: rephrased away from claim words; marked for native review |
| `share.honesty (spoken)` | This diagram was shared as a link. Ghost Touch cannot confirm it is right. | यह आरेख एक लिंक के रूप में साझा किया गया है। घोस्ट टच इसकी पुष्टि नहीं कर सकता कि यह सही है। | આ આકૃતિ લિંક તરીકે શેર કરવામાં આવી છે. ગોસ્ટ ટચ તે સાચી છે તેની પુષ્ટિ કરી શકતું નથી. | | | | Requirement 22.12 honest disclaimer; marked for native review |
## 27. Capture Cancellation & Offline Handling (`y1-w3-fixes-a`)
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `capture.cancelled (spoken)` | No photo was taken. Choose Take photo, Choose image, or a sample. | कोई फोटो नहीं ली गई। फोटो लें, छवि चुनें, या कोई नमूना चुनें। | કોઈ ફોટો લેવામાં આવ્યો નથી. ફોટો લો, ઇમેજ પસંદ કરો, અથવા નમૂનો પસંદ કરો. | | | | Spoken when camera dialog is cancelled or returns no photo; marked for native review |
| `capture.errorOffline (spoken)` | You are offline. Samples still work. Try again when you are connected. | आप ऑफ़लाइन हैं। नमूने अभी भी काम करते हैं। कनेक्ट होने पर पुनः प्रयास करें। | તમે ઑફલાઇન છો. નમૂનાઓ હજુ પણ કામ કરે છે. તમે કનેક્ટ થાઓ ત્યારે ફરી પ્રયાસ કરો. | | | | Spoken on network disconnection during photo or upload; marked for native review |
