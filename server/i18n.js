// Product phrases the MCP tools speak, beyond the scam advice (which lives in kavach-scam-patterns).
// He/she: the demo families have a son; keep phrasing neutral where it's easy.
export const T = {
  en: {
    checkin: {
      good: (n) => `Lovely to hear, ${n}. I've noted it for the family.`,
      okay: (n) => `Thanks for telling me, ${n}. I've noted it.`,
      not_good: (n) => `I'm sorry you're not feeling well, ${n}.`,
      ask: (names) => `Shall I ask ${names} to give you a call?`,
      asked: (names) => ` I've asked ${names} to call you.`,
      offer: (names) => ` Would you like me to ask ${names} to call you?`,
    },
    verify: {
      denied: (p, f) => `${p}, that is not ${f}. ${f} just told me he is not calling you. This is a scam, and the voice may be copied by a computer. Hang up now and do not send any money.`,
      confirmed: (p, f) => `Good news, ${p}. ${f} confirmed on his own phone that it really is him calling.`,
      no_answer: (p, f) => `${f} hasn't answered yet. Until he does, please don't send any money or share any codes. Hang up and call ${f} on the number saved in your phone.`,
      unknown: (who, known) => `${who} isn't someone I know in your family (I know ${known}). Please be very careful: hang up and call your family on numbers you already have.`,
    },
    call: {
      endAsk: (p, names) => `You did the right thing hanging up, ${p}. Shall I let ${names} know about this call?`,
      alerted: (names) => `I've let ${names} know. You're safe now.`,
      safe: `Okay. You're safe now.`,
      offer: (names) => `You're safe now. Would you like me to let ${names} know?`,
      wary: (p) => `That call had a few warning signs, ${p}. If they call again, let me listen in.`,
    },
  },
  es: {
    checkin: {
      good: (n) => `Qué bueno escucharlo, ${n}. Se lo comento a la familia.`,
      okay: (n) => `Gracias por contarme, ${n}. Lo anoté.`,
      not_good: (n) => `Siento que no se sienta bien, ${n}.`,
      ask: (names) => `¿Quiere que le pida a ${names} que le llame?`,
      asked: (names) => ` Le pedí a ${names} que le llame.`,
      offer: (names) => ` ¿Quiere que le pida a ${names} que le llame?`,
    },
    verify: {
      denied: (p, f) => `${p}, esa persona no es ${f}. ${f} me acaba de decir que no la está llamando. Es una estafa, y la voz puede estar copiada por computadora. Cuelgue ahora y no envíe dinero.`,
      confirmed: (p, f) => `Buenas noticias, ${p}. ${f} confirmó desde su propio teléfono que de verdad es él.`,
      no_answer: (p, f) => `${f} todavía no contesta. Hasta que conteste, no envíe dinero ni comparta códigos. Cuelgue y llame a ${f} al número que tiene guardado.`,
      unknown: (who, known) => `No conozco a ${who} en su familia (conozco a ${known}). Tenga mucho cuidado: cuelgue y llame a su familia a los números que ya tiene.`,
    },
    call: {
      endAsk: (p, names) => `Hizo bien en colgar, ${p}. ¿Quiere que le avise a ${names} de esta llamada?`,
      alerted: (names) => `Ya le avisé a ${names}. Ya está a salvo.`,
      safe: `Muy bien. Ya está a salvo.`,
      offer: (names) => `Ya está a salvo. ¿Quiere que le avise a ${names}?`,
      wary: (p) => `Esa llamada tenía algunas señales de alerta, ${p}. Si vuelven a llamar, déjeme escuchar.`,
    },
  },
  hi: {
    checkin: {
      good: (n) => `यह सुनकर अच्छा लगा, ${n}। मैंने परिवार के लिए नोट कर लिया है।`,
      okay: (n) => `बताने के लिए धन्यवाद, ${n}। मैंने नोट कर लिया है।`,
      not_good: (n) => `मुझे दुख है कि आपकी तबीयत ठीक नहीं है, ${n}।`,
      ask: (names) => `क्या मैं ${names} से कहूँ कि वे आपको फ़ोन करें?`,
      asked: (names) => ` मैंने ${names} से आपको फ़ोन करने को कह दिया है।`,
      offer: (names) => ` क्या मैं ${names} से कहूँ कि वे आपको फ़ोन करें?`,
    },
    verify: {
      denied: (p, f) => `${p}, यह ${f} नहीं है। ${f} ने अभी मुझे बताया कि वह आपको फ़ोन नहीं कर रहा। यह धोखाधड़ी है, आवाज़ कंप्यूटर से नकल की गई हो सकती है। अभी फ़ोन रख दीजिए और कोई पैसा न भेजें।`,
      confirmed: (p, f) => `अच्छी खबर, ${p}। ${f} ने अपने फ़ोन से पक्का किया है कि सच में वही फ़ोन कर रहा है।`,
      no_answer: (p, f) => `${f} ने अभी तक जवाब नहीं दिया। तब तक कोई पैसा न भेजें और कोई कोड न बताएं। फ़ोन रखिए और ${f} को उसके सेव किए नंबर पर फ़ोन कीजिए।`,
      unknown: (who, known) => `${who} आपके परिवार में कोई नहीं है जिसे मैं जानती हूँ (मैं ${known} को जानती हूँ)। बहुत सावधान रहें: फ़ोन रखें और परिवार को उनके पुराने नंबर पर फ़ोन करें।`,
    },
    call: {
      endAsk: (p, names) => `आपने फ़ोन रखकर सही किया, ${p}। क्या मैं ${names} को इस कॉल के बारे में बता दूँ?`,
      alerted: (names) => `मैंने ${names} को बता दिया है। अब आप सुरक्षित हैं।`,
      safe: `ठीक है। अब आप सुरक्षित हैं।`,
      offer: (names) => `अब आप सुरक्षित हैं। क्या मैं ${names} को बता दूँ?`,
      wary: (p) => `उस कॉल में कुछ चेतावनी के संकेत थे, ${p}। अगर वे फिर फ़ोन करें, तो मुझे सुनने दीजिए।`,
    },
  },
};

export const t = (lang) => T[lang] || T.en;
