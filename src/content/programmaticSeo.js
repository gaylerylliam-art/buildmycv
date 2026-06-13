export const cities = [
  { slug: "dubai", name: "Dubai", country: "UAE" },
  { slug: "abu-dhabi", name: "Abu Dhabi", country: "UAE" },
  { slug: "sharjah", name: "Sharjah", country: "UAE" },
  { slug: "uae", name: "the UAE", country: "UAE" },
  { slug: "riyadh", name: "Riyadh", country: "Saudi Arabia" },
  { slug: "doha", name: "Doha", country: "Qatar" },
];

const industryDefaults = {
  "sales-marketing": {
    duties: ["Build customer pipeline", "Follow up leads", "Prepare quotations", "Maintain CRM records"],
    skills: ["CRM", "Lead generation", "Negotiation", "Customer service", "Cold calling", "Product knowledge", "Reporting", "English communication"],
    tips: ["Show sales targets and revenue numbers.", "Mention UAE market or GCC customer experience.", "Add languages used with customers."],
  },
  finance: {
    duties: ["Prepare reports", "Check invoices", "Reconcile accounts", "Support audits"],
    skills: ["Excel", "VAT", "Tally", "QuickBooks", "Reconciliation", "Invoicing", "Payroll", "Reporting"],
    tips: ["Mention VAT and UAE compliance exposure.", "Show monthly volume of invoices or reports.", "Keep finance CV formatting simple and ATS friendly."],
  },
  engineering: {
    duties: ["Review drawings", "Coordinate site teams", "Prepare progress reports", "Follow HSE rules"],
    skills: ["AutoCAD", "Site supervision", "HSE", "BOQ", "MS Project", "Quality control", "Shop drawings", "UAE standards"],
    tips: ["Mention project type and value in AED.", "Include authority approvals if you handled them.", "List software and certifications clearly."],
  },
  hospitality: {
    duties: ["Serve guests", "Maintain service standards", "Handle guest requests", "Follow hygiene rules"],
    skills: ["Guest service", "Food safety", "POS", "Housekeeping", "Teamwork", "Upselling", "Complaint handling", "English communication"],
    tips: ["Mention hotel, restaurant, or QSR experience.", "Add guest-facing languages.", "Use a neat professional photo for UAE roles."],
  },
  logistics: {
    duties: ["Coordinate shipments", "Update WMS records", "Track documents", "Support suppliers"],
    skills: ["WMS", "Inventory control", "Excel", "Customs documents", "ERP", "Dispatch", "Vendor coordination", "Warehouse safety"],
    tips: ["Use shipment, SKU, or inventory accuracy numbers.", "Mention JAFZA or free-zone experience if true.", "Add UAE driving or forklift license if relevant."],
  },
  admin: {
    duties: ["Manage documents", "Schedule meetings", "Prepare reports", "Support staff records"],
    skills: ["MS Office", "Excel", "Document control", "Scheduling", "Email writing", "Data entry", "Filing", "Customer support"],
    tips: ["Mention visa, labour card, or Emirates ID support if true.", "Use a professional email address.", "Show typing, reporting, and document accuracy."],
  },
  it: {
    duties: ["Support users", "Troubleshoot systems", "Maintain tickets", "Document fixes"],
    skills: ["Helpdesk", "SQL", "Networking", "React", "Python", "Git", "Cloud tools", "Jira"],
    tips: ["Add GitHub or portfolio links as text.", "Show tickets resolved or systems supported.", "List technical tools by exact name."],
  },
  healthcare: {
    duties: ["Support patient care", "Maintain records", "Follow safety procedures", "Coordinate with clinical teams"],
    skills: ["Patient care", "DHA", "BLS", "EMR", "Medication support", "Infection control", "Communication", "Documentation"],
    tips: ["Mention DHA, DOH, MOH, or eligibility status.", "Do not include patient photos or private details.", "List licenses and clinical certifications clearly."],
  },
  education: {
    duties: ["Prepare lessons", "Support students", "Communicate with parents", "Track progress"],
    skills: ["Lesson planning", "Classroom management", "Assessment", "LMS", "Communication", "SEN support", "Activity planning", "Curriculum knowledge"],
    tips: ["Mention curriculum such as British, CBSE, or American.", "Show grade levels and class size.", "Use a warm professional photo."],
  },
  skilled: {
    duties: ["Inspect faults", "Perform repairs", "Follow safety steps", "Maintain tools"],
    skills: ["Troubleshooting", "Preventive maintenance", "Safety", "Tools handling", "Installation", "Repair", "Customer service", "UAE site work"],
    tips: ["List tools, machines, and systems you can handle.", "Add UAE driving license if site visits are needed.", "Mention safety training such as HSE or NEBOSH if true."],
  },
};

const jobRows = [
  ["software-engineer", "Software Engineer", "it", "AED 8,000 - 22,000"],
  ["sales-executive", "Sales Executive", "sales-marketing", "AED 4,000 - 9,000"],
  ["business-development-executive", "Business Development Executive", "sales-marketing", "AED 5,000 - 12,000"],
  ["accountant", "Accountant", "finance", "AED 4,500 - 10,000"],
  ["civil-engineer", "Civil Engineer", "engineering", "AED 5,000 - 12,000"],
  ["mep-engineer", "MEP Engineer", "engineering", "AED 6,000 - 14,000"],
  ["quantity-surveyor", "Quantity Surveyor", "engineering", "AED 5,500 - 13,000"],
  ["electrician", "Electrician", "skilled", "AED 2,000 - 4,500"],
  ["hvac-technician", "HVAC Technician", "skilled", "AED 2,500 - 5,500"],
  ["waiter", "Waiter / Waitress", "hospitality", "AED 1,800 - 3,500"],
  ["barista", "Barista", "hospitality", "AED 2,000 - 4,000"],
  ["commis-chef", "Commis Chef", "hospitality", "AED 1,800 - 3,800"],
  ["chef-de-partie", "Chef de Partie", "hospitality", "AED 3,500 - 7,000"],
  ["housekeeping-attendant", "Housekeeping Attendant", "hospitality", "AED 1,500 - 3,000"],
  ["front-desk-receptionist", "Front Desk Receptionist", "hospitality", "AED 2,500 - 5,000"],
  ["hotel-manager", "Hotel Manager", "hospitality", "AED 8,000 - 22,000"],
  ["guest-service-agent", "Guest Service Agent", "hospitality", "AED 2,500 - 5,000"],
  ["security-guard", "Security Guard", "skilled", "AED 1,800 - 3,200"],
  ["driver-light-vehicle", "Driver (Light Vehicle)", "logistics", "AED 2,500 - 5,000"],
  ["heavy-truck-driver", "Heavy Truck Driver", "logistics", "AED 3,000 - 6,500"],
  ["delivery-driver", "Delivery Driver", "logistics", "AED 2,200 - 5,000"],
  ["storekeeper", "Storekeeper", "logistics", "AED 2,500 - 5,500"],
  ["warehouse-supervisor", "Warehouse Supervisor", "logistics", "AED 4,000 - 8,500"],
  ["logistics-coordinator", "Logistics Coordinator", "logistics", "AED 4,000 - 8,000"],
  ["procurement-officer", "Procurement Officer", "logistics", "AED 4,500 - 9,500"],
  ["office-administrator", "Office Administrator", "admin", "AED 3,000 - 6,500"],
  ["admin-assistant", "Admin Assistant", "admin", "AED 2,500 - 5,500"],
  ["executive-assistant", "Executive Assistant", "admin", "AED 5,000 - 12,000"],
  ["hr-officer", "HR Officer", "admin", "AED 4,500 - 9,500"],
  ["receptionist", "Receptionist", "admin", "AED 2,500 - 5,000"],
  ["data-entry-operator", "Data Entry Operator", "admin", "AED 2,200 - 4,500"],
  ["it-support-specialist", "IT Support Specialist", "it", "AED 4,000 - 8,500"],
  ["software-developer", "Software Developer", "it", "AED 7,000 - 18,000"],
  ["graphic-designer", "Graphic Designer", "sales-marketing", "AED 3,500 - 8,000"],
  ["digital-marketing-executive", "Digital Marketing Executive", "sales-marketing", "AED 4,500 - 10,000"],
  ["customer-service-representative", "Customer Service Representative", "admin", "AED 3,000 - 6,000"],
  ["customer-service", "Customer Service", "admin", "AED 3,000 - 6,000"],
  ["virtual-assistant", "Virtual Assistant", "admin", "AED 3,000 - 8,000"],
  ["retail-sales-associate", "Retail Sales Associate", "sales-marketing", "AED 2,500 - 5,000"],
  ["cashier", "Cashier", "sales-marketing", "AED 2,000 - 4,000"],
  ["nurse", "Nurse", "healthcare", "AED 4,500 - 10,000"],
  ["pharmacist", "Pharmacist", "healthcare", "AED 5,500 - 12,000"],
  ["teacher", "Teacher", "education", "AED 5,000 - 12,000"],
  ["beautician", "Beautician", "hospitality", "AED 2,500 - 6,000"],
  ["tailor", "Tailor", "skilled", "AED 2,000 - 5,000"],
];

export const seoJobs = jobRows.map(([slug, title, industry, salaryRange]) => {
  const defaults = industryDefaults[industry];
  return {
    slug,
    title,
    industry,
    salaryRange,
    intro: `${title} roles in the Gulf need a CV that is clear, direct, and easy for recruiters to scan. Employers usually look for practical experience, local availability, communication skills, and evidence that you can do the job without long training. A strong ${title} CV should show your most relevant duties, tools, achievements, visa or notice status when useful, and contact details in a simple ATS-friendly format.`,
    duties: defaults.duties,
    skills: defaults.skills,
    sampleSummary: `Reliable ${title} with practical experience supporting busy teams, following company standards, and delivering accurate daily work. Skilled in ${defaults.skills.slice(0, 3).join(", ")}, with a professional attitude, clear communication, and readiness to contribute to UAE and GCC employers.`,
    sampleBullets: [
      `Handled daily ${title.toLowerCase()} responsibilities while meeting company quality and safety standards.`,
      `Improved team coordination by keeping records accurate and communicating updates on time.`,
      `Supported customers, managers, and colleagues with reliable service during busy work periods.`,
    ],
    tips: defaults.tips,
  };
});

export const topCityJobSlugs = seoJobs.slice(0, 15).map((job) => job.slug);
