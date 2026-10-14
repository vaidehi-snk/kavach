// Sample scam calls for the live call guardian demo. Modeled on public advisories (I4C/1930, FTC, FBI IC3).
// Each line is spoken by a different voice from Alexa, as if on speakerphone.
export const SAMPLE_CALLS = [
  {
    id: 'digital-arrest',
    label: 'Fake police "digital arrest" (India)',
    caller: 'Unknown +91 89XXX XXX21',
    lines: [
      'Hello, am I speaking with Mrs. Shanta Kulkarni?',
      'Madam, this is Inspector Vikram Singh from Mumbai Police cyber crime department.',
      'A FedEx parcel in your name was seized at Mumbai airport. It contains five fake passports and drugs.',
      'Your Aadhaar number is linked to a money laundering case, and an FIR has been registered against you.',
      'This is a confidential investigation. Do not tell your son or anyone in your family.',
      'You must stay on this video call. You are under digital arrest until we verify your funds.',
      'To prove you are innocent, transfer your savings to an RBI verified safe account. It will be returned after verification.',
    ],
  },
  {
    id: 'irs',
    label: 'Fake IRS agent (US)',
    caller: 'Unknown +1 (202) XXX-0148',
    lines: [
      'Hello, is this Margaret Collins?',
      'This is Officer Daniel Ross with the Internal Revenue Service, badge number 4471.',
      'Our records show you owe back taxes of 4,800 dollars from the last three years.',
      'A warrant has been issued for your arrest, and local police will come to your house today.',
      'You must stay on the line with me. Do not hang up and do not tell your family about this.',
      'You can clear this right now by paying with Target gift cards. Go to the nearest store immediately.',
    ],
  },
];
