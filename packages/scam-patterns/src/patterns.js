// Scam pattern library.
// Two layers:
//   TACTICS  - manipulation techniques shared by almost every scam (urgency, secrecy, odd payment...)
//   PATTERNS - named scam families (US + India + global) with the cues that identify them
// Every pattern carries a plain-language "truth" (the fact that breaks the scam) and advice,
// written to be spoken aloud by a voice assistant to an older adult.

const r = (...parts) => parts.map((p) => new RegExp(p, 'i'));

export const TACTICS = {
  urgency: {
    label: 'Pressure to act right now',
    weight: 0.14,
    cues: r(
      '\\b(immediately|right now|right away|urgent(ly)?|(within|in) (the )?(next )?\\d+ (minutes?|hours?)|today itself|before (tonight|midnight|5 ?pm|the end of the day)|last (chance|warning|notice)|final (notice|warning)|expires? (today|tonight))\\b',
      '\\b(turant|abhi ke abhi|jaldi karo|aaj raat)\\b',
      "\\b(don'?t|do not) hang up\\b",
      '\\b(or else|otherwise) (your|you|we)\\b',
    ),
  },
  secrecy: {
    label: 'Asked to keep it secret',
    weight: 0.2,
    cues: r(
      "\\b(don'?t|do not|never) (tell|inform|share this with|let) (anyone|anybody|your (family|son|daughter|kids|children|husband|wife|bank|parents)|mom|dad)\\b",
      '\\b(keep (this|it) (a )?(secret|confidential|between us)|confidential (investigation|matter|case))\\b',
      '\\b(kisi ko (mat|na) bata(na|o)|ghar (walon|waalon) ko mat)\\b',
      '\\b(teller|employee|staff|manager|bank (staff|employees?))s?( at (the|your) bank)?( who)? (is|are|may be|might be|could be) (involved|in on it)\\b',
    ),
  },
  stay_on_line: {
    label: 'Told to stay on the call or camera',
    weight: 0.16,
    cues: r(
      '\\b(stay on (the )?(line|call|video|camera)|keep (the )?(camera|video|call) on|remain on (video|camera|call)|do not (disconnect|leave the call|switch off))\\b',
      '\\b(video call|skype|whatsapp video)\\b.*\\b(verify|statement|interrogation|investigation|surveillance)\\b',
      '\\b(under (digital|online|video) (arrest|surveillance))\\b',
    ),
  },
  threat: {
    label: 'Threat of arrest, fine, or cut-off',
    weight: 0.18,
    cues: r(
      '\\b(arrest(ed)?|warrant|jail|police (will|are coming)|legal action|lawsuit|deport(ed|ation)?|case (has been|is) (registered|filed)|fir (registered|filed)|money laundering|narcotics|drugs (were )?found)\\b',
      '\\b(disconnect(ed|ion)?|cut off|shut ?off|suspend(ed)?|block(ed)?|frozen|deactivat(ed|e)|seized?)\\b.*\\b(tonight|today|hours?|immediately|account|number|sim|electricity|power|service|social security|aadhaar|pan)\\b',
      '\\b(giraftar|giraftaari|band ho jayega|kaat di jayegi)\\b',
    ),
  },
  odd_payment: {
    label: 'Unusual payment method',
    weight: 0.24,
    cues: r(
      '\\b(gift ?cards?|itunes|google play cards?|apple cards?|steam cards?|target cards?|amazon (gift )?cards?)\\b',
      '\\b(bitcoin|crypto(currency)?|usdt|bitcoin atm|crypto atm)\\b',
      '\\b(wire (the )?money|western union|moneygram|zelle|cash app|venmo)\\b.*\\b(now|today|immediately|asap|right away|fee|bail|fine)\\b',
      '\\b(cash (in|inside) (a|the) (box|envelope|book)|courier (will|is going to) (collect|pick up) (the )?(cash|money|gold))\\b',
      '\\b(safe (account|wallet)|secure (account|wallet)|rbi (verified|safe) account|government (safe )?account)\\b',
      '\\b(scan (this|the) qr( code)?|enter (your )?upi pin)\\b.*\\b(receive|refund|get|credit)\\b',
      '\\b(processing|clearance|release|customs|registration|tax|insurance|verification) (fee|charges?|amount)\\b',
    ),
  },
  credential_request: {
    label: 'Asking for codes, PINs, or ID numbers',
    weight: 0.3,
    cues: r(
      '\\b(share|tell|read|give|send|provide|confirm|forward) (me |us )?(the |your )?(otp|one[- ]time (password|code|pin)|verification code|6[- ]digit code|security code|pin|cvv|password)\\b',
      '\\b(otp|code)\\b.*\\b(you (will|just) (get|got|receive|received)|sent to your (phone|mobile))\\b.*\\b(tell|share|read|give)\\b',
      '\\b(otp|code|pin)\\b.*\\b(read|tell|share|give|say) (it|them|the (code|otp|numbers?)) (to|back to) (him|her|them|me|the caller)\\b',
      '\\b(confirm|verify|read out|tell me|give me|provide|need) (your |the |my |his |her )?(social security( number)?|ssn|medicare (number|card)|bank account( number)?|card number|aadhaar( number)?|pan( card)?( number)?|net ?banking (id|password|login))\\b',
    ),
  },
  remote_access: {
    label: 'Asked to install an app or give screen access',
    weight: 0.22,
    cues: r(
      '\\b(anydesk|teamviewer|quick ?support|rustdesk|ultraviewer|ammyy|screen ?shar(e|ing)|remote (access|desktop|control))\\b',
      '\\b(download|install) (this|an|the) (app|apk|application|software)\\b',
      '\\b(open|click) (this|the) (link|apk)\\b.*\\b(update|verify|kyc|refund|install)\\b',
    ),
  },
  authority_claim: {
    label: 'Claims to be police, government, or a big company',
    weight: 0.1,
    cues: r(
      '\\b(cbi|ed officer|enforcement directorate|narcotics (control )?bureau|ncb|cyber (crime|cell) (officer|department|police)|customs (officer|department)|income tax (officer|department)|trai|dot officer|rbi (officer|official))\\b',
      '\\b(irs|social security administration|ssa|medicare|fbi|dea|homeland security|us marshal|federal agent|sheriff)\\b',
      '\\b(microsoft|apple|amazon|windows) (support|security|technician|tech support|fraud (department|team))\\b',
      '\\b(fraud (department|team|investigation unit)|security department) (of|from|at) (your|the) bank\\b',
    ),
  },
  unsolicited_prize: {
    label: 'Unexpected prize, refund, or money offer',
    weight: 0.14,
    cues: r(
      '\\b(you (have )?won|(i|we) (have )?won|(said|says) i won|winner|lottery|lucky draw|sweepstakes|jackpot|kbc|kaun banega crorepati|prize (money)?|claim your (reward|prize|refund))\\b',
      '\\b(guaranteed (returns?|profits?)|double your money|\\d+% (daily|weekly|monthly) (returns?|profit))\\b',
      '\\b(earn|make) (rs\\.? ?|₹|\\$)?\\d[\\d,]* (per|a|every) (day|task|hour)\\b',
    ),
  },
  robocall: {
    label: 'Recorded call telling you to press a number',
    weight: 0.12,
    cues: r(
      '\\bpress (1|one|9|nine|0|zero)\\b.*\\b(officer|agent|speak|talk|representative|connect|now)\\b',
      '\\b(recorded|automated|pre-?recorded) (call|message|voice)\\b.*\\b(press|suspend|block|warrant|arrest)\\b',
    ),
  },
  suspicious_link: {
    label: 'A link to an unfamiliar website',
    weight: 0.12,
    cues: r(
      '\\b[a-z0-9]+-[a-z0-9-]+\\.(com|net|info|top|xyz|site|online|live|vip|icu|cc)\\b',
      '\\b(bit\\.ly|tinyurl|t\\.co|rb\\.gy|cutt\\.ly)\\b',
      '\\b(click|tap|open) (on )?(this|the) link\\b',
    ),
  },
  new_number_family: {
    label: 'A "family member" on a new number needing money',
    weight: 0.16,
    cues: r(
      "\\b(new number|changed my number|lost my phone|phone (broke|is broken)|this is my new)\\b",
      "\\b(it'?s me|hi (mom|mum|dad|grandma|grandpa|nani|dadi|nana|dada))\\b.*\\b(money|transfer|send|pay|bail|hospital|accident)\\b",
    ),
  },
};

// Things legitimate institutions say that scammers usually don't.
export const LEGIT_CUES = {
  label: 'Signs of a genuine message',
  weight: -0.22,
  cues: r(
    '\\b(call the number on the back of your card|visit (your|the) (nearest|local) branch|log in to (the|your) official (app|website) yourself|we will never ask (you )?for)\\b',
    '\\b(never (share|ask for) (your )?(otp|pin|password))\\b',
    "\\b(no action (is )?(needed|required)|you don'?t need to do anything|ignore this (message|email) if)\\b",
    '\\b(reply stop to (opt[- ]out|unsubscribe)|to reschedule,? call (the|our) (clinic|office))\\b',
    '\\b(scheduled maintenance|planned (outage|shutdown)|power will be restored)\\b',
  ),
};

export const PATTERNS = [
  // ---------------- India ----------------
  {
    id: 'digital_arrest',
    weight: 0.35,
    name: 'Fake "digital arrest" by police or CBI',
    region: 'IN',
    cues: r(
      '\\b(digital arrest|online arrest|video arrest)\\b',
      '\\b(parcel|package|courier|fedex|dhl|blue ?dart)\\b.*\\b(drugs|narcotics|mdma|passports?|illegal items?|contraband|seized)\\b',
      '\\b(your )?(aadhaar|aadhar|pan|sim|phone number)\\b.*\\b(used|linked|involved)\\b.*\\b(money laundering|crime|illegal|fraud|terror)\\b',
      '\\b(cbi|ed|ncb|narcotics|cyber ?crime|mumbai police|delhi police)\\b.*\\b(video call|skype|interrogation|statement|verify (your )?(funds|money|account))\\b',
      '\\b(verify|check|audit) (your |all )?(funds|money|savings|accounts?)\\b.*\\b(return(ed)?|refund(ed)?|after (verification|investigation))\\b',
    ),
    truth: 'Police, CBI or ED never arrest anyone over a phone or video call, and never ask you to move money to "verify" it. "Digital arrest" does not exist in Indian law.',
    advice: 'Hang up now. Do not transfer any money. Report it on 1930 or cybercrime.gov.in.',
  },
  {
    id: 'electricity_disconnection',
    name: 'Fake electricity bill disconnection',
    region: 'IN',
    cues: r(
      '\\b(electricity|power|bijli|light) (connection|supply|bill)\\b.*\\b(disconnect(ed)?|cut|band|kaat)\\b',
      '\\b(previous month|last month)\\b.*\\bbill\\b.*\\b(not (been )?updated|pending|unpaid)\\b',
      '\\b(electricity|power) (officer|department)\\b.*\\b(call|contact)\\b.*\\b(immediately|tonight|\\d)',
      '\\b(officer|lineman|department)\\b.*\\b(his|her|personal|this) (mobile|number|whatsapp)\\b',
      '\\b(msedcl|mseb|bescom|tata power|adani electricity|torrent power|bses|tneb)\\b.*\\b(disconnect|tonight|9:?30|immediately)\\b',
    ),
    truth: 'Electricity companies send a printed disconnection notice and never ask you to call a personal mobile number or install an app to pay.',
    advice: 'Do not call that number. Check your bill only on your power company\'s official app or website, or visit their office.',
  },
  {
    id: 'kyc_update',
    name: 'Fake bank KYC / account block',
    region: 'IN',
    cues: r(
      '\\b(kyc|e-?kyc|pan card|aadhaar)\\b.*\\b(expire[sd]?|pending|update|not updated|incomplete|block(ed)?|suspend(ed)?)\\b',
      '\\b(account|card|netbanking|yono|paytm|phonepe)\\b.*\\b(will be )?(block(ed)?|suspend(ed)?|frozen|deactivat(ed|e))\\b.*\\b(today|24 hours|link|click|update)\\b',
      '\\b(reward points?)\\b.*\\b(expir(e|ing)|redeem)\\b.*\\b(link|apk|click)\\b',
    ),
    truth: 'Banks never ask you to update KYC through a link or a phone call, and never ask for an OTP or PIN.',
    advice: 'Do not click the link. If you are worried, visit your bank branch or call the number printed on your passbook or card.',
  },
  {
    id: 'upi_refund_qr',
    weight: 0.35,
    name: 'UPI "receive money" / QR code trick',
    region: 'IN',
    cues: r(
      '\\b(scan|enter (your )?upi pin|accept (the )?(collect )?request)\\b.*\\b(receive|get|credit(ed)?|refund|payment for)\\b',
      '\\b(by mistake|wrongly (sent|transferred)|accidentally (sent|transferred))\\b.*\\b(return|send (it )?back|refund)\\b',
      '\\b(army|crpf|cisf) (officer|man|person)\\b.*\\b(buy|purchase|olx|rent)\\b',
    ),
    truth: 'You never need to scan a QR code or enter your UPI PIN to receive money. The PIN is only for sending money.',
    advice: 'Do not scan or enter your PIN. If someone says they sent money by mistake, check your bank statement yourself first.',
  },
  {
    id: 'sim_trai_block',
    weight: 0.35,
    name: 'Fake TRAI / telecom number block',
    region: 'IN',
    cues: r(
      '\\b(trai|dot|department of telecom(munication)?s?|jio|airtel|vi|bsnl)\\b.*\\b(number|sim|mobile)\\b.*\\b(block(ed)?|deactivat|suspend|disconnect)\\b',
      '\\bpress (9|1|0)\\b.*\\b(number|sim|connection|block)\\b',
    ),
    truth: 'TRAI does not block phone numbers and never calls customers. Recorded calls saying "press 9" are scams.',
    advice: 'Hang up. You can report the call on the Sanchar Saathi Chakshu portal.',
  },
  {
    id: 'task_job_investment',
    weight: 0.35,
    name: 'Online task job or stock-tip investment scam',
    region: 'IN',
    cues: r(
      '\\b(part[- ]time job|work from home|online task|like (youtube )?videos|rate (hotels|products)|review tasks?)\\b.*\\b(earn|pay|salary|income|commission|rs|₹)\\b',
      '\\b(prepaid task|recharge to unlock|deposit to (withdraw|unlock))\\b',
      '\\b(whatsapp|telegram) (group|channel)\\b.*\\b(stock|share|ipo|trading|tips|returns?)\\b',
      '\\b(sebi registered|institutional account|vip trading|block trade|ipo allotment)\\b.*\\b(app|guaranteed|profit|returns?)\\b',
    ),
    truth: 'Real jobs never ask you to pay first, and nobody can guarantee stock market profits.',
    advice: 'Stop paying and do not deposit more to "unlock" your money. Report it on 1930.',
  },
  {
    id: 'lottery_kbc',
    weight: 0.35,
    name: 'Lottery / KBC prize scam',
    region: 'IN',
    cues: r(
      '\\b(kbc|kaun banega crorepati|jio lottery|lucky draw|amazon lucky)\\b',
      '\\b(won|prize of)\\b.*\\b(lakh|crore|25,?00,?000)\\b',
    ),
    truth: 'You cannot win a lottery you never entered, and real prizes never ask for a fee to release them.',
    advice: 'Do not pay any fee or share bank details. Block the number.',
  },
  // ---------------- United States ----------------
  {
    id: 'grandparent_emergency',
    name: 'Grandparent / family emergency scam',
    region: 'US',
    cues: r(
      '\\b(grand(son|daughter|child|kid)|nephew|niece|(my|your|her|his) (son|daughter))\\b.*\\b(jail|arrest(ed)?|accident|hospital|lawyer|attorney|in trouble|stuck|stranded|hit (a|someone))\\b.*\\b(money|bail|pay|send|cash|wire|fee|dollars|\\$|rupees|lakh)\\b',
      '\\b(bail (money|bond)|public defender|bail bonds?man)\\b',
      '\\b(grandma|grandpa|nana|nani|dadi|dada|gran)\\b.*\\b(it\'?s me|please help|need money|don\'?t tell)\\b',
      '\\b(car accident|hit a (pregnant )?(woman|lady|child|kid)|wreck|caught in a .*case)\\b.*\\b(money|bail|pay|cash|lawyer)\\b',
    ),
    truth: 'Scammers copy voices with AI and pretend to be a grandchild in trouble. A real emergency can wait two minutes while you call your family back.',
    advice: 'Hang up and call your grandchild or their parents on the number you already have. Never send cash, gift cards, or crypto.',
  },
  {
    id: 'government_impersonation_us',
    weight: 0.35,
    name: 'Fake IRS / Social Security / law enforcement',
    region: 'US',
    cues: r(
      '\\b(irs|internal revenue)\\b.*\\b(owe|back taxes|lawsuit|warrant|arrest|pay)\\b',
      '\\b(social security (number|benefits?)|ssn)\\b.*\\b(suspend(ed)?|block(ed)?|compromised|used in (a )?crime|frozen)\\b',
      '\\b(missed jury duty|jury duty)\\b.*\\b(fine|warrant|pay)\\b',
      '\\b(us marshal|federal agent|fbi|dea|sheriff)\\b.*\\b(pay|fine|warrant|gift card|bitcoin)\\b',
    ),
    truth: 'The IRS, Social Security, and police never call to demand payment, never threaten immediate arrest, and never take gift cards or crypto.',
    advice: 'Hang up. If you are unsure, call the agency using the number on its official .gov website.',
  },
  {
    id: 'tech_support',
    weight: 0.35,
    name: 'Fake tech support / computer virus',
    region: 'US',
    cues: r(
      '\\b(virus|malware|hack(ed|ers?)|infected|security (alert|breach)|compromised)\\b.*\\b(computer|pc|laptop|windows|device|ip address)\\b',
      '\\b(microsoft|apple|windows|norton|mcafee|geek squad) (support|security|technician|refund|subscription)\\b',
      '\\b(pop[- ]?up|screen (froze|locked|went red))\\b.*\\b(call|number)\\b',
      '\\b(auto[- ]?renew(ed|al)?|subscription)\\b.*\\b(refund|\\$\\d{3})\\b.*\\b(call|remote|connect)\\b',
    ),
    truth: 'Microsoft, Apple, and antivirus companies never call you about a virus, and real warnings never tell you to call a phone number.',
    advice: 'Hang up or close the browser. Do not install anything or let anyone into your computer.',
  },
  {
    id: 'bank_safe_account',
    weight: 0.35,
    name: 'Fake bank fraud team: "move your money to a safe account"',
    region: 'GLOBAL',
    cues: r(
      '\\b(move|transfer|withdraw)\\b.*\\b(money|funds|savings|cash)\\b.*\\b(safe|secure|protected|new) (account|wallet|place)\\b',
      '\\b(fraud (department|team|alert))\\b.*\\b(move|transfer|withdraw|gift card|bitcoin|courier)\\b',
      '\\bwithdraw\\b.*\\b(cash|money)\\b.*\\b(courier|agent|officer|someone|a man|driver)\\b.*\\b(collect|pick (it )?up|come (by|to))\\b',
      '\\b(chase|wells fargo|bank of america|citi|sbi|hdfc|icici|zelle|bank)\\b.*\\b(verification code|otp|code)\\b.*\\b(read|tell|give|share)\\b',
      '\\b(read|tell|give|share)\\b.*\\b(verification code|otp)\\b.*\\b(stop|cancel|block|reverse)\\b',
    ),
    truth: 'Your bank will never ask you to move money to a "safe account" or hand cash to a courier.',
    advice: 'Hang up and call your bank on the number printed on your card.',
  },
  {
    id: 'medicare_health',
    weight: 0.35,
    name: 'Medicare / health benefit scam',
    region: 'US',
    cues: r(
      '\\b(medicare)\\b.*\\b(new card|free|braces?|genetic test|dna test|covid test|number|verify|update)\\b',
      '\\b(free (back|knee) brace|free genetic (test|screening)|cancer screening kit)\\b',
    ),
    truth: 'Medicare does not call to offer free equipment or tests, and never asks for your Medicare number on an unexpected call.',
    advice: 'Hang up. Call 1-800-MEDICARE if you have questions.',
  },
  {
    id: 'romance',
    name: 'Online romance scam',
    region: 'GLOBAL',
    cues: r(
      '\\b(met (online|on facebook|on instagram|on (a )?dating (site|app))|never met (in person|face to face))\\b.*\\b(money|send|pay|wire|gift card|crypto|loan)\\b',
      '\\b(oil rig|deployed|peacekeeping|offshore|working overseas|stuck (at|in) customs)\\b.*\\b(money|send|ticket|fee|help)\\b',
      '\\b(my love|darling|sweetheart)\\b.*\\b(send|money|ticket|fee|customs)\\b',
    ),
    truth: 'Someone you have never met in person who asks for money is almost always a scammer, no matter how real the feelings seem.',
    advice: 'Do not send money. Talk it over with someone you trust.',
  },
  {
    id: 'sweepstakes_us',
    weight: 0.35,
    name: 'Sweepstakes / prize with fees',
    region: 'US',
    cues: r(
      '\\b(publishers clearing house|pch|sweepstakes|mega millions|jamaican lottery)\\b',
      '\\b(government grant|free grant|grant of)\\b.*\\b(fee|pay|card)\\b',
      '\\b(won|winner)\\b.*\\b(pay|fee|taxes|shipping)\\b.*\\b(first|before|release|claim)\\b',
    ),
    truth: 'Real prizes are free. If you have to pay fees or taxes up front, it is a scam.',
    advice: 'Do not pay anything. Hang up.',
  },
  {
    id: 'package_toll_smishing',
    weight: 0.35,
    name: 'Fake delivery or toll text',
    region: 'GLOBAL',
    cues: r(
      '\\b(usps|ups|fedex|india post|dhl|e-?zpass|fastrak|sunpass|toll)\\b.*\\b(unpaid|failed|on hold|redeliver|address (is )?incomplete|update (your )?address|fee)\\b.*\\b(link|click|http|pay)\\b',
      '\\b(unpaid toll|outstanding toll)\\b',
      '\\b(usps|ups|fedex|india post|dhl|e-?zpass|toll)\\b.*\\b(on hold|incomplete address|redeliver)\\b.*\\b(here|[a-z0-9-]+\\.(com|net|info|top|xyz|site|in))\\b',
    ),
    truth: 'Delivery companies and toll agencies do not text you links to pay small fees.',
    advice: 'Do not click the link. Check the official app or website yourself.',
  },
  {
    id: 'utility_shutoff_us',
    name: 'Utility shutoff threat',
    region: 'US',
    cues: r(
      '\\b(power|gas|water|utility|electric) (company|service|bill)\\b.*\\b(shut ?off|disconnect(ed)?|cut off)\\b.*\\b(hour|today|tonight|minutes|immediately)\\b',
    ),
    truth: 'Utility companies send written notices first and never demand payment by gift card, crypto, or app.',
    advice: 'Hang up and call the number on your actual bill.',
  },
  {
    id: 'voice_clone_family',
    name: 'Family member on a new number / cloned voice',
    region: 'GLOBAL',
    cues: r(
      '\\b(new number|changed my number|lost my phone|phone (broke|is broken|fell))\\b.*\\b(money|send|transfer|pay|upi|gpay|urgent)\\b',
      '\\b(sounded (exactly )?like|it was (his|her) voice|voice (was )?(exactly )?like)\\b.*\\b(money|send|bail|hospital|help)\\b',
    ),
    truth: 'AI can copy a loved one\'s voice from a few seconds of video. A new number asking for money is a classic warning sign.',
    advice: 'Call your family member back on their old number, or ask a question only the real person would know.',
  },
  {
    id: 'crypto_investment',
    weight: 0.35,
    name: 'Crypto investment scam',
    region: 'GLOBAL',
    cues: r(
      '\\b(crypto|bitcoin|usdt|forex)\\b.*\\b(invest(ment)?|platform|trading|returns?|profit|mentor)\\b',
      '\\b(withdraw(al)?)\\b.*\\b(tax|fee|unlock|verification)\\b.*\\b(pay|deposit) (first|before)\\b',
    ),
    truth: 'Real investments never guarantee profits, and you never pay a fee to withdraw your own money.',
    advice: 'Stop sending money. Talk to someone you trust before doing anything else.',
  },
];
