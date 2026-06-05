const sharedClosing =
  "Thank you for considering my application. I would be happy to discuss how my skills and experience can support your team. I am available for an interview at your convenience.";

export const coverLetterTemplates = {
  hospitality: {
    position: "Hospitality Assistant",
    opening:
      "I am writing to apply for the hospitality position at your company. I am a friendly and reliable worker who understands the importance of good service, cleanliness, and teamwork.",
    body:
      "My experience includes assisting guests, preparing service areas, following supervisor instructions, and staying calm during busy shifts. I can support daily operations and treat customers with respect.",
    closing: sharedClosing,
  },
  finance: {
    position: "Accounts Assistant",
    opening:
      "I am applying for the finance position at your company. I am careful with details and interested in supporting accurate records, invoices, payments, and reports.",
    body:
      "I can help with data entry, invoice checking, filing, Excel work, and basic finance support. I understand that accuracy and confidentiality are important in finance roles.",
    closing: sharedClosing,
  },
  engineering: {
    position: "Junior Site Engineer",
    opening:
      "I am writing to apply for the engineering position at your company. I am practical, safety-conscious, and willing to learn from senior engineers and site teams.",
    body:
      "My experience includes site support, measurements, reporting, checking materials, and following safety procedures. I am ready to contribute with a responsible and hardworking attitude.",
    closing: sharedClosing,
  },
  it: {
    position: "IT Support Assistant",
    opening:
      "I am applying for the IT support position at your company. I enjoy helping users solve technical problems and explaining solutions in a simple way.",
    body:
      "I can assist with troubleshooting, software setup, basic networking, documentation, and help desk tasks. I am organized and willing to keep learning new systems.",
    closing: sharedClosing,
  },
  marketing: {
    position: "Marketing Assistant",
    opening:
      "I am writing to apply for the marketing position at your company. I am creative, organized, and interested in supporting campaigns, social media, and customer communication.",
    body:
      "My skills include content writing, social media support, customer follow-up, Canva, and task coordination. I can help the team prepare clear and useful marketing materials.",
    closing: sharedClosing,
  },
  education: {
    position: "Teaching Assistant / Tutor",
    opening:
      "I am applying for the education position at your institution. I am patient, supportive, and interested in helping students learn in a positive environment.",
    body:
      "I can assist with lesson preparation, student support, classroom activities, and communication with teachers or parents. I understand the importance of patience and responsibility.",
    closing: sharedClosing,
  },
  domestic: {
    position: "Nanny / Maid / Personal Driver",
    opening:
      "I am writing to apply for the domestic service position. I am trustworthy, hardworking, and respectful when supporting families and household needs.",
    body:
      "My experience includes child care, cleaning, laundry, meal preparation, errands, and safe driving duties. I can follow instructions and complete daily tasks responsibly.",
    closing: sharedClosing,
  },
  skilled: {
    position: "AC Technician / Electrician",
    opening:
      "I am applying for the skilled worker position at your company. I am a hands-on worker with experience in installation, repair, maintenance, and safe tool handling.",
    body:
      "I can support technical work, inspect equipment, report completed tasks, keep work areas clean, and follow safety procedures. I am dependable and ready to work with a team.",
    closing: sharedClosing,
  },
  helper: {
    position: "General Helper",
    opening:
      "I am writing to apply for the general helper position at your company. I am reliable, punctual, and ready to support daily tasks wherever help is needed.",
    body:
      "My experience includes loading and unloading, packing, cleaning, arranging materials, and following supervisor instructions. I am hardworking and willing to learn.",
    closing: sharedClosing,
  },
};

export const coverLetterFonts = [
  { id: "sans", name: "Clean Sans", className: "font-sans" },
  { id: "serif", name: "Classic Serif", className: "font-serif" },
  { id: "mono", name: "Modern Mono", className: "font-mono" },
];

export const coverLetterLayouts = [
  { id: "classic", name: "Classic letter" },
  { id: "accent", name: "Accent header" },
  { id: "compact", name: "Compact letter" },
];
