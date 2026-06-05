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

export const experienceLevels = [
  "Fresher / Entry Level",
  "Junior",
  "Mid-Level",
  "Senior",
  "Supervisor",
  "Manager",
];

export const regionalFormats = [
  { id: "gcc", name: "UAE / GCC Format", locationLabel: "Location", tone: "polite, direct, and suitable for recruitment agencies in the UAE and GCC" },
  { id: "uk", name: "United Kingdom Format", locationLabel: "Address", tone: "concise, formal, and suitable for UK employers" },
  { id: "us", name: "United States Format", locationLabel: "Location", tone: "confident, achievement-focused, and suitable for US employers" },
  { id: "canada", name: "Canada Format", locationLabel: "Location", tone: "clear, inclusive, and suitable for Canadian employers" },
  { id: "australia", name: "Australia Format", locationLabel: "Location", tone: "practical, warm, and suitable for Australian employers" },
  { id: "international", name: "International Standard Format", locationLabel: "Location", tone: "professional, simple, and suitable for global employers" },
];

export const coverLetterRoleGroups = [
  {
    group: "Professional & Office Roles",
    roles: [
      "Digital Marketing Specialist",
      "Social Media Manager",
      "Graphic Designer",
      "Video Editor",
      "Web Developer",
      "Software Engineer",
      "Data Analyst",
      "Project Manager",
      "Administrative Assistant",
      "Customer Service Representative",
      "Sales Executive",
      "Accountant",
      "Human Resources Specialist",
      "Teacher",
      "Healthcare Professional",
      "Real Estate Agent",
      "Logistics & Supply Chain",
      "Hospitality Professional",
      "General Professional",
    ],
  },
  {
    group: "Education Roles",
    roles: ["Nursery Teacher", "Primary School Teacher", "Secondary School Teacher", "ESL Teacher", "Teaching Assistant", "Special Education Teacher"],
  },
  {
    group: "Domestic & Household Roles",
    roles: ["Nanny", "Babysitter", "House Maid", "Domestic Helper", "Caregiver", "Elderly Care Assistant", "Housekeeper", "Family Driver", "Cook / Private Chef"],
  },
  {
    group: "Skilled Technician Roles",
    roles: [
      "Electrician",
      "Plumber",
      "HVAC Technician",
      "AC Technician",
      "Mechanical Technician",
      "Electrical Technician",
      "Maintenance Technician",
      "CCTV Technician",
      "Network Technician",
      "IT Support Technician",
      "Solar Technician",
      "Automotive Technician",
      "Auto Mechanic",
      "Heavy Equipment Mechanic",
      "Welding Technician",
      "Fabricator",
      "Carpenter",
      "Painter",
    ],
  },
  {
    group: "Construction & Industrial Roles",
    roles: ["Construction Worker", "Site Supervisor", "Foreman", "Mason", "Steel Fixer", "Scaffolder", "Safety Officer", "Civil Technician"],
  },
  {
    group: "General Worker Roles",
    roles: ["General Helper", "Warehouse Helper", "Packing Helper", "Factory Worker", "Storekeeper", "Delivery Assistant", "Cleaner", "Kitchen Helper", "Restaurant Helper", "Laborer", "Loading & Unloading Worker"],
  },
];

export const allCoverLetterRoles = coverLetterRoleGroups.flatMap((group) => group.roles);

const roleKeywords = {
  "Digital Marketing Specialist": ["campaign planning", "analytics", "ROI tracking", "content creation", "lead generation"],
  "Social Media Manager": ["content calendars", "community management", "engagement", "brand voice", "social analytics"],
  "Graphic Designer": ["visual design", "branding", "layout", "Adobe Creative Suite", "marketing materials"],
  "Video Editor": ["video editing", "storytelling", "motion graphics", "color correction", "post-production"],
  "Teacher": ["classroom management", "student engagement", "lesson planning", "curriculum delivery", "assessment"],
  "Nursery Teacher": ["early childhood care", "play-based learning", "child safety", "parent communication", "class routines"],
  "Primary School Teacher": ["lesson planning", "student engagement", "classroom management", "curriculum delivery", "assessment"],
  "Secondary School Teacher": ["subject knowledge", "student progress", "curriculum delivery", "assessment", "classroom management"],
  "ESL Teacher": ["English language instruction", "student engagement", "lesson planning", "speaking practice", "assessment"],
  "Teaching Assistant": ["student support", "classroom assistance", "learning materials", "teacher support", "patience"],
  "Special Education Teacher": ["individual learning support", "inclusive education", "student care", "behavior support", "parent communication"],
  "Nanny": ["childcare", "safety", "child development", "daily routines", "family communication"],
  "Babysitter": ["child supervision", "safety", "meal support", "play activities", "responsibility"],
  "House Maid": ["cleaning", "laundry", "organization", "household management", "time management"],
  "Domestic Helper": ["cleaning", "meal preparation", "laundry", "errands", "household support"],
  "Caregiver": ["patient care", "compassion", "daily living assistance", "safety", "communication"],
  "Elderly Care Assistant": ["elderly care", "mobility assistance", "daily living support", "compassion", "safety"],
  "Housekeeper": ["cleaning standards", "room preparation", "organization", "laundry", "attention to detail"],
  "Family Driver": ["safe driving", "route planning", "vehicle care", "punctuality", "family support"],
  "Electrician": ["installation", "troubleshooting", "wiring", "maintenance", "safety compliance"],
  "Plumber": ["pipe repair", "installation", "leak detection", "maintenance", "safety compliance"],
  "HVAC Technician": ["HVAC maintenance", "troubleshooting", "installation", "repair", "safety compliance"],
  "AC Technician": ["AC installation", "preventive maintenance", "fault diagnosis", "repair", "safety compliance"],
  "Warehouse Helper": ["packing", "loading", "inventory support", "teamwork", "physical work capability"],
  "General Helper": ["teamwork", "reliability", "physical work capability", "adaptability", "following instructions"],
  "Customer Service Representative": ["customer support", "problem solving", "communication", "service quality", "CRM documentation"],
};

const fallbackKeywords = {
  professional: ["communication", "organization", "problem solving", "teamwork", "attention to detail"],
  technician: ["troubleshooting", "maintenance", "repair", "tools handling", "safety compliance"],
  domestic: ["trustworthiness", "daily routines", "cleanliness", "family support", "communication"],
  education: ["student support", "lesson preparation", "classroom management", "patience", "learning outcomes"],
  worker: ["reliability", "teamwork", "physical work capability", "punctuality", "adaptability"],
};

const getRoleKeywords = (role = "") => {
  if (roleKeywords[role]) return roleKeywords[role];
  if (/teacher|school|education|teaching|esl/i.test(role)) return fallbackKeywords.education;
  if (/nanny|maid|helper|caregiver|house|driver|cook/i.test(role)) return fallbackKeywords.domestic;
  if (/technician|electrician|plumber|mechanic|welder|fabricator|carpenter|painter|cctv|network|solar|hvac|ac/i.test(role)) return fallbackKeywords.technician;
  if (/worker|helper|cleaner|laborer|warehouse|packing|factory|delivery|kitchen|loading/i.test(role)) return fallbackKeywords.worker;
  return fallbackKeywords.professional;
};

const getLevelPhrase = (level = "Fresher / Entry Level", years = "") => {
  if (/fresher|entry/i.test(level)) return "I am ready to learn quickly, follow instructions carefully, and bring a reliable attitude to the role";
  if (/junior/i.test(level)) return `I bring ${years || "some"} practical experience and a strong willingness to grow in this role`;
  if (/mid/i.test(level)) return `I bring ${years || "several years of"} hands-on experience and can work independently while supporting team goals`;
  if (/senior/i.test(level)) return `I bring senior-level experience, practical judgment, and the ability to handle responsibilities with limited supervision`;
  if (/supervisor/i.test(level)) return "I can guide team members, coordinate daily work, and maintain quality and safety standards";
  return "I can manage responsibilities, communicate clearly with stakeholders, and help the team deliver strong results";
};

export function generateCoverLetterTemplate({ cv, role, letter = {} }) {
  const selectedRole = role || letter.position || cv.jobTitle || "General Professional";
  const keywords = getRoleKeywords(selectedRole);
  const level = letter.experienceLevel || "Fresher / Entry Level";
  const region = regionalFormats.find((item) => item.id === letter.region) || regionalFormats[0];
  const company = letter.companyName || "your company";
  const jobDescription = letter.jobDescription ? ` Based on the job description, I understand that this role requires ${letter.jobDescription.slice(0, 180)}${letter.jobDescription.length > 180 ? "..." : ""}` : "";
  return {
    role: selectedRole,
    position: selectedRole,
    hiringManager: letter.hiringManager || "Hiring Manager",
    companyName: letter.companyName || "Company Name",
    companyAddress: letter.companyAddress || cv.country || "Company Location",
    nationality: letter.nationality || "",
    visaStatus: letter.visaStatus || "",
    linkedIn: letter.linkedIn || "",
    yearsExperience: letter.yearsExperience || "",
    experienceLevel: level,
    region: letter.region || "gcc",
    jobDescription: letter.jobDescription || "",
    opening: `I am writing to apply for the ${selectedRole} position at ${company}. ${getLevelPhrase(level, letter.yearsExperience)}. I am interested in contributing to your team with professionalism, honesty, and a strong work ethic.`,
    body: `My background includes ${cv.summary || "relevant practical experience"}${jobDescription}. I can support this role through ${keywords.slice(0, 3).join(", ")}, and ${keywords.slice(3).join(", ")}. My key skills include ${cv.skills || keywords.join(", ")}.`,
    qualifications: `I understand the importance of ATS-friendly details, clear communication, and role-specific responsibilities. For this ${region.name}, I have kept the letter ${region.tone}.`,
    value: `I can add value by being dependable, learning quickly, following company standards, and helping the team complete daily work with care and consistency.`,
    closing: sharedClosing,
  };
}

export const sampleCoverLetters = [
  "Digital Marketing Specialist",
  "Social Media Manager",
  "Graphic Designer",
  "Teacher",
  "Nanny",
  "House Maid",
  "Caregiver",
  "Electrician",
  "AC Technician",
  "Plumber",
  "Warehouse Helper",
  "General Helper",
  "Customer Service Representative",
].map((role) => ({
  role,
  sample: generateCoverLetterTemplate({
    role,
    cv: {
      fullName: "Sample Applicant",
      jobTitle: role,
      email: "sample@email.com",
      phone: "+971 50 000 0000",
      country: "United Arab Emirates",
      summary: `Reliable ${role.toLowerCase()} with practical experience and a strong commitment to quality work.`,
      skills: getRoleKeywords(role).join(", "),
    },
    letter: { companyName: "ABC Company", yearsExperience: "2 years", experienceLevel: "Junior" },
  }),
}));
