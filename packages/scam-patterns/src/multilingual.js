// Spanish and Hindi warning signs, merged into the English tactics and scam families.
// JavaScript's \b only understands ASCII letters, so these use Unicode-aware boundaries
// that work for accented Spanish and for Devanagari (letters + vowel signs).

const B = '[\\p{L}\\p{M}\\p{N}]';
export const w = (...parts) => parts.map((p) => new RegExp(`(?<!${B})(?:${p})(?!${B})`, 'iu'));

export const ML_TACTICS = {
  urgency: w(
    'ahora mismo|inmediatamente|urgente|hoy mismo|antes de esta noche|última advertencia|último aviso|en \\d+ (minutos|horas)',
    'तुरंत|अभी के अभी|जल्दी करो|आज रात|आज ही|फौरन',
  ),
  secrecy: w(
    'no (le )?(diga|cuente|avise|comente) (nada )?a (nadie|su familia|sus hijos|su hijo|su hija|su banco)|es (un asunto )?confidencial|mant[eé]ngalo en secreto|que quede entre nosotros',
    'किसी को (मत|न|ना) (बताना|बताओ|बताइए|बताएं|बताएँ)|घर वालों को (मत|न)|गोपनीय|बेटे को (मत|न) बताना',
  ),
  stay_on_line: w(
    'no cuelgue|qu[eé]dese en la l[ií]nea|mant[eé]ngase en la llamada|no corte la llamada',
    'वीडियो कॉल (पर|में) (ही )?(रहें|रहिए|रहो|बने रहें)|(कॉल|फोन|फ़ोन) (मत|न|ना) काट(ना|ें|िए)|डिजिटल अरेस्ट',
  ),
  threat: w(
    'arresto|arrestad[oa]|orden de (arresto|captura)|c[aá]rcel|detenid[oa]|deportad[oa]|deportaci[oó]n|(cortaremos|cortar[aá]n|suspenderemos|bloquearemos)',
    'गिरफ्तार|गिरफ़्तार|गिरफ्तारी|जेल|एफआईआर|केस दर्ज|मनी लॉन्ड्रिंग|(बिजली|कनेक्शन) (काट|कट)|(खाता|अकाउंट|सिम) (बंद|ब्लॉक)',
  ),
  odd_payment: w(
    'tarjetas? de regalo|bitcoin|criptomonedas?|western union|moneygram|zelle|cash app|(env[ií]e|mande|transfiera|deposite) (el |su )?dinero|cuenta segura',
    'गिफ्ट कार्ड|(पैसे|रकम|रुपये) (भेजो|भेजें|भेजिए|ट्रांसफर)|ट्रांसफर (करो|करें|कीजिए)|सुरक्षित खाते|आरबीआई (के )?खाते|यूपीआई पिन|क्यूआर कोड',
  ),
  credential_request: w(
    '(diga|d[ií]game|l[eé]ame|deme|comparta|confirme)( el| su)? (c[oó]digo|clave|pin|contraseña|n[uú]mero de seguro social)|c[oó]digo de verificaci[oó]n',
    'ओटीपी|पिन (बताओ|बताइए|बताएं)|पासवर्ड|सीवीवी',
  ),
  remote_access: w('anydesk|teamviewer|acceso remoto|(descargue|instale) (esta|la|una) (aplicaci[oó]n|app)', 'एनीडेस्क|ऐप (डाउनलोड|इंस्टॉल)|लिंक पर क्लिक'),
  authority_claim: w(
    'polic[ií]a|servicio de impuestos|seguro social|agente federal|alguacil|soporte t[eé]cnico|departamento de fraude',
    'पुलिस|सीबीआई|ईडी|कस्टम|इनकम टैक्स|आयकर|ट्राई|साइबर (क्राइम|सेल)',
  ),
  unsolicited_prize: w('(usted )?(ha )?ganad[oa]|ganador|loter[ií]a|premio|sorteo', 'लॉटरी|इनाम|केबीसी|कौन बनेगा करोड़पति'),
  new_number_family: w(
    '(mi )?nuevo n[uú]mero|cambi[eé] (de|mi) n[uú]mero|perd[ií] mi (tel[eé]fono|celular)|soy tu niet[oa]',
    'नया नंबर|मेरा (फोन|फ़ोन) (खो|टूट)|मम्मी,? मैं (हूँ|हूं)',
  ),
};

export const ML_PATTERNS = {
  digital_arrest: w('डिजिटल अरेस्ट', '(पार्सल|कूरियर).*(ड्रग्स|नशीले|पासपोर्ट)', 'आधार.*(मनी लॉन्ड्रिंग|अपराध)'),
  electricity_disconnection: w('बिजली.*(काट|कट|बंद).*(आज|रात|तुरंत)', 'बिजली (का )?बिल.*(अपडेट|बकाया)'),
  kyc_update: w('केवाईसी.*(अपडेट|बंद|ब्लॉक|समाप्त)'),
  upi_refund_qr: w('(क्यूआर|पिन).*(पैसे (आएंगे|मिलेंगे)|रिफंड)', 'गलती से.*(भेज|ट्रांसफर)'),
  lottery_kbc: w('लॉटरी', 'केबीसी'),
  otp_sharing: w('ओटीपी.*(बताओ|बताइए|बताएं|बता दो|शेयर)', '(l[eé]ame|d[ií]game|deme|comparta).*c[oó]digo'),
  grandparent_emergency: w('niet[oa].*(c[aá]rcel|arrestad|accidente|hospital|abogado).*(dinero|fianza|pagar|pague|transfer|tarjetas|env[ií]e|mande)', 'dinero para la fianza', '(पोता|पोती|नाती|बेटा).*(जेल|गिरफ्तार|एक्सीडेंट|अस्पताल).*(पैसे|रुपये)'),
  government_impersonation_us: w('(irs|impuestos).*(debe|arresto|orden|pagar)', 'seguro social.*(suspendid|bloquead|congelad)'),
  tech_support: w('(virus|hackead|infectad).*(computadora|ordenador|pc)', 'soporte t[eé]cnico de (microsoft|apple)'),
  bank_safe_account: w('(mover|transferir|retirar).*(dinero|ahorros).*(cuenta segura|cuenta nueva|lugar seguro)'),
  sweepstakes_us: w('(gan[oó]|ganado|ganador).*(pagar|cuota|impuestos|env[ií]o)'),
  utility_shutoff_us: w('(luz|electricidad|gas|agua).*(cortar|cortaremos|cortar[aá]n|desconectar).*(hoy|minutos|horas|inmediatamente)'),
  voice_clone_family: w('nuevo n[uú]mero.*(dinero|transferencia|pague|env[ií]e)', 'नया नंबर.*(पैसे|यूपीआई|भेज)'),
};

export const ML_LEGIT = w(
  'no tiene que hacer nada|nunca le pediremos|llame al n[uú]mero (que aparece )?en (el reverso de )?su tarjeta',
  'ओटीपी किसी (को|से) (साझा|शेयर) (न|ना) करें|बैंक कभी (भी )?ओटीपी नहीं',
);

const ES_WORDS = /(?<![\p{L}])(usted|llamada|dinero|polic[ií]a|tarjeta|hijo|hija|nieto|nieta|abuela|abuelo|c[oó]digo|banco|pagar|ahora|dice|dijo|que|para|con|una|los|las|mi|su|por|es|est[aá]|estoy|tengo|me|hoy|bien|siento|buenos|buenas|d[ií]as|gracias|muy|pero|del|el|la|y|no|se|le|lo)(?![\p{L}])/giu;
// No one-letter words: 'a' is also Spanish.
const EN_WORDS = /\b(the|you|your|is|and|my|said|says|from|that|this|to|of|he|she|they|have|will|i|am|it|was|with|for|me|on)\b/gi;

/** 'hi' if the text is mostly Devanagari, 'es' if it reads as Spanish, otherwise 'en'. */
export function detectLanguage(text) {
  const t = String(text || '');
  const deva = (t.match(/[ऀ-ॿ]/g) || []).length;
  const letters = (t.match(/\p{L}/gu) || []).length || 1;
  if (deva / letters > 0.3) return 'hi';
  const es = (t.match(ES_WORDS) || []).length + 2 * (t.match(/[ñ¿¡]/g) || []).length + (t.match(/[áéíóú]/gi) || []).length;
  const en = (t.match(EN_WORDS) || []).length;
  return es > en ? 'es' : 'en';
}
