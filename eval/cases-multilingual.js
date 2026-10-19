// Spanish and Hindi evaluation cases. Written AFTER the Spanish/Hindi rules and never used to
// tune them: the score is reported as-is. Includes genuine look-alikes in both languages.
export const ML_CASES = [
  // ---- Spanish: scams ----
  { id: 'es-s1', lang: 'es', label: 'scam', region: 'US', text: 'Abuela, soy yo, tu nieto. Choqué el carro y la policía me detuvo. Necesito que mandes dinero por Western Union para el abogado. Por favor no le digas a mamá.' },
  { id: 'es-s2', lang: 'es', label: 'scam', region: 'US', text: 'Recibí una llamada grabada: su número de Seguro Social ha sido suspendido por actividad sospechosa. Marque 1 para hablar con un agente.' },
  { id: 'es-s3', lang: 'es', label: 'scam', region: 'US', text: 'Un señor del banco me dijo que hay fraude en mi cuenta y que debo transferir mis ahorros a una cuenta segura que ellos abrieron.' },
  { id: 'es-s4', lang: 'es', label: 'scam', region: 'US', text: 'Me apareció un aviso en la computadora diciendo que tengo un virus y que llame a soporte técnico de Microsoft. El técnico quiere que instale una aplicación.' },
  { id: 'es-s5', lang: 'es', label: 'scam', region: 'US', text: 'Me dijeron que gané la lotería de Jamaica, pero primero tengo que pagar los impuestos con tarjetas de regalo.' },
  { id: 'es-s6', lang: 'es', label: 'scam', region: 'US', text: 'Llamaron de la compañía de luz. Dicen que van a cortar la electricidad en 30 minutos si no pago ahora mismo por Zelle.' },
  // ---- Spanish: genuine ----
  { id: 'es-l1', lang: 'es', label: 'legit', region: 'US', text: 'Mensaje del banco: ¿Reconoce una compra de 45 dólares en Walmart? Si no, llame al número en el reverso de su tarjeta. Nunca le pediremos su clave.' },
  { id: 'es-l2', lang: 'es', label: 'legit', region: 'US', text: 'Mi hijo me llamó desde su celular de siempre para preguntarme si necesito algo del supermercado.' },
  { id: 'es-l3', lang: 'es', label: 'legit', region: 'US', text: 'La farmacia me mandó un mensaje: su receta está lista para recoger.' },
  { id: 'es-l4', lang: 'es', label: 'legit', region: 'US', text: 'Mi nieta me llamó desde la universidad para contarme que aprobó su examen.' },
  { id: 'es-l5', lang: 'es', label: 'legit', region: 'US', text: 'El consultorio del doctor me recordó mi cita del jueves a las diez. Para cambiarla, llame al consultorio.' },
  { id: 'es-l6', lang: 'es', label: 'legit', region: 'US', text: 'Su paquete de Amazon fue entregado en la puerta. No tiene que hacer nada.' },
  // ---- Hindi: scams ----
  { id: 'hi-s1', lang: 'hi', label: 'scam', region: 'IN', text: 'मुंबई पुलिस से फ़ोन आया कि मेरे आधार से मनी लॉन्ड्रिंग हुई है, एफआईआर दर्ज है, और वीडियो कॉल पर ही रहना है।' },
  { id: 'hi-s2', lang: 'hi', label: 'scam', region: 'IN', text: 'मैसेज आया है कि आज रात 9:30 बजे आपकी बिजली काट दी जाएगी क्योंकि पिछला बिल अपडेट नहीं हुआ, तुरंत इस नंबर पर फ़ोन करें।' },
  { id: 'hi-s3', lang: 'hi', label: 'scam', region: 'IN', text: 'एक आदमी ओएलएक्स पर मेरा सोफ़ा खरीदना चाहता है, उसने क्यूआर कोड भेजा है और कह रहा है स्कैन करके पिन डालो तो पैसे आएंगे।' },
  { id: 'hi-s4', lang: 'hi', label: 'scam', region: 'IN', text: 'मुबारक हो, आपने केबीसी लॉटरी में 25 लाख जीते हैं। इनाम पाने के लिए 12,000 रुपये रजिस्ट्रेशन फ़ीस भेजिए।' },
  { id: 'hi-s5', lang: 'hi', label: 'scam', region: 'IN', text: 'अनजान नंबर से मैसेज: मम्मी, मैं हूँ, मेरा फ़ोन टूट गया, यह मेरा नया नंबर है, अस्पताल के लिए तुरंत 40,000 रुपये भेज दो।' },
  { id: 'hi-s6', lang: 'hi', label: 'scam', region: 'IN', text: 'कोई कह रहा था कि वह बैंक से है, मेरा खाता ब्लॉक हो जाएगा, और जो ओटीपी आएगा वह उसे बता दूँ।' },
  // ---- Hindi: genuine ----
  { id: 'hi-l1', lang: 'hi', label: 'legit', region: 'IN', text: 'बैंक का मैसेज: आपके खाते में पेंशन जमा हो गई है। ओटीपी किसी को शेयर न करें।' },
  { id: 'hi-l2', lang: 'hi', label: 'legit', region: 'IN', text: 'मेरे बेटे ने अपने रोज़ वाले नंबर से फ़ोन करके बताया कि वह रविवार को घर आएगा।' },
  { id: 'hi-l3', lang: 'hi', label: 'legit', region: 'IN', text: 'सोसाइटी के सेक्रेटरी ने बताया कि मंगलवार सुबह टंकी की सफाई के लिए पानी बंद रहेगा।' },
  { id: 'hi-l4', lang: 'hi', label: 'legit', region: 'IN', text: 'डॉक्टर के क्लिनिक से फ़ोन आया कि गुरुवार को आँखों की जांच का समय 11 बजे है।' },
  { id: 'hi-l5', lang: 'hi', label: 'legit', region: 'IN', text: 'गैस एजेंसी ने बताया कि सिलेंडर कल सुबह आएगा, पैसे डिलीवरी पर देने हैं।' },
  { id: 'hi-l6', lang: 'hi', label: 'legit', region: 'IN', text: 'मेरी पोती ने कॉलेज से फ़ोन करके बताया कि उसकी परीक्षा अच्छी गई।' },
];
