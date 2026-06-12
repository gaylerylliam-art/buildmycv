const general = {
  summary: [
    "Start with years of experience and your strongest skill.",
    "Mention visa status or immediate joining if it helps your application.",
  ],
  experience: [
    "Begin bullets with action verbs: Managed, Delivered, Reduced, Achieved.",
    "Add numbers where possible, such as daily customers or AED value handled.",
  ],
  skills: [
    "Use exact job-posting keywords so ATS systems can match your CV.",
    "Keep skills specific: Excel reports beats computer skills.",
  ],
  photo: [
    "Use a clear head-and-shoulders photo with a plain background.",
    "For UAE applications, a neat professional photo is often expected.",
  ],
  contact: [
    "Write your phone with country code, such as +971.",
    "Keep LinkedIn as text even if you add a QR code.",
  ],
};

export const tips = {
  general,
  hospitality: {
    summary: ["Mention hotel, restaurant, QSR, or guest-facing experience.", "List guest languages like English, Arabic, Hindi, or Tagalog."],
    experience: ["Add covers per shift, room occupancy, or guest satisfaction results.", "Name known UAE brands if true: Jumeirah, Rotana, Emaar, Address."],
    skills: ["Include POS, food safety, housekeeping, reservation, and guest service.", "Add hygiene and grooming standards for hotel roles."],
    photo: ["Wear clean business or hospitality uniform style.", "Smile naturally; guest-facing roles value warmth."],
    contact: ["Add UAE mobile number and city if already in UAE.", "Mention immediate joining if your visa allows it."],
  },
  "construction-engineering": {
    summary: ["Mention project type: villa, tower, road, fit-out, or MEP.", "Add authority exposure like Dubai Municipality or Trakhees."],
    experience: ["List project value such as AED 50M if accurate.", "Mention site inspections, HSE, drawings, and handover work."],
    skills: ["Name tools: AutoCAD, Revit, Primavera P6, ETABS, MS Project.", "List certifications in a separate section, not only skills."],
    photo: ["A neat shirt is enough; hard-hat photos are optional.", "Avoid busy site backgrounds that hide your face."],
    contact: ["Include UAE driving license if site travel is required.", "Add Emirate location, such as Dubai or Abu Dhabi."],
  },
  "it-software": {
    summary: ["Mention stack, support level, cloud tools, or ticket volume.", "Add remote, hybrid, or UAE client support experience if relevant."],
    experience: ["Show metrics: tickets resolved, uptime, users supported, deployments.", "Include GitHub, portfolio, or LinkedIn links as text."],
    skills: ["List exact tools: React, SQL, Python, AWS, Azure, ITIL, Jira.", "Separate technical skills from soft skills for scanning."],
    photo: ["Use a simple professional photo; casual hoodie is okay if neat.", "Keep the CV photo small so projects remain visible."],
    contact: ["Add GitHub or portfolio URL for developer roles.", "Use a professional email, not a nickname email."],
  },
  "finance-accounting": {
    summary: ["Mention accounting system and reporting experience.", "Add DIFC, audit, VAT, or UAE compliance exposure if true."],
    experience: ["Use numbers: invoices processed, monthly reports, reconciliations.", "Mention VAT filing, petty cash, payroll, and bank reconciliation."],
    skills: ["Include Excel, Tally, QuickBooks, SAP, Oracle, VAT, payroll.", "Add accuracy, reporting, and audit support keywords."],
    photo: ["Choose formal attire; finance employers expect a polished look.", "Use a clean background and neutral expression."],
    contact: ["Add LinkedIn and UAE contact number.", "Mention CPA, ACCA, CMA, or degree in certifications."],
  },
  healthcare: {
    summary: ["Mention DHA, DOH, HAAD, MOH, or eligibility status.", "State patient-care setting: clinic, hospital, homecare, dental."],
    experience: ["Add patient volume, wards, equipment, or specialty exposure.", "Mention infection control and documentation standards."],
    skills: ["Include BLS, ACLS, EMR, triage, patient care, medication support.", "Licenses should be visible near certifications."],
    photo: ["Clinical uniform or formal photo both work if neat.", "Avoid ward or patient backgrounds for privacy."],
    contact: ["Add license number only if comfortable sharing it.", "Use UAE number if applying locally."],
  },
  "sales-marketing": {
    summary: ["Mention market, channel, product type, and sales target size.", "Add UAE, GCC, retail, B2B, or social media experience."],
    experience: ["Show numbers: leads, conversion, revenue, footfall, ROAS.", "Mention CRM, campaigns, events, and customer follow-up."],
    skills: ["Include CRM, Canva, Meta Ads, Google Ads, lead generation.", "Add languages if selling to mixed UAE customers."],
    photo: ["Use a confident, friendly professional photo.", "For customer-facing sales, a warm expression helps."],
    contact: ["Add LinkedIn if you have client-facing achievements.", "Keep WhatsApp number same as mobile if used for sales."],
  },
  "logistics-supply-chain": {
    summary: ["Mention warehouse, freight, customs, or last-mile experience.", "Add GCC trade route or JAFZA/free-zone exposure if true."],
    experience: ["Use metrics: shipments, SKUs, inventory accuracy, delivery time.", "Mention customs documents, WMS, ERP, and vendor coordination."],
    skills: ["Include WMS, ERP, Excel, customs clearance, inventory control.", "Add forklift or UAE driving license if relevant."],
    photo: ["Formal or smart casual works; avoid warehouse clutter.", "Keep your face clear and centered."],
    contact: ["Add UAE location and availability for shift roles.", "Mention visa status if immediate joining is possible."],
  },
  "admin-hr": {
    summary: ["Mention office support, HR records, visas, or PRO coordination.", "Add Emirates ID, labour card, or onboarding exposure if true."],
    experience: ["Show volume: staff files, applications, calls, reports.", "Mention document control, scheduling, payroll support, and filing."],
    skills: ["Include MS Office, Excel, HRMS, typing, document control.", "Add English and Arabic typing only if accurate."],
    photo: ["Use formal office attire and a plain background.", "A polished photo matters for front-office admin roles."],
    contact: ["Add LinkedIn and current UAE city.", "Use a professional email for HR/admin trust."],
  },
  retail: {
    summary: ["Mention store type, cashier, merchandising, or customer service.", "Add mall, supermarket, fashion, or electronics experience."],
    experience: ["Use numbers: daily sales, customers served, stock counts.", "Mention POS, upselling, cash handling, and stock replenishment."],
    skills: ["Include POS, inventory, visual merchandising, cash handling.", "Add languages for UAE mall customer service."],
    photo: ["Choose a friendly, neat photo for customer-facing roles.", "Avoid filters; recruiters prefer a natural look."],
    contact: ["Add UAE phone and city for walk-in interview calls.", "Mention flexible shifts if available."],
  },
  "oil-gas": {
    summary: ["Mention offshore, refinery, EPC, maintenance, or HSE exposure.", "Add ADNOC, Aramco, QatarEnergy, or PDO only if true."],
    experience: ["Include permit to work, shutdowns, inspections, and safety records.", "Use equipment names and project sites where allowed."],
    skills: ["List HSE, PTW, rigging, welding, QA/QC, NDT, SAP PM.", "Put certifications like NEBOSH or IOSH clearly."],
    photo: ["Use formal photo; PPE photo is optional if professional.", "Never include restricted site images."],
    contact: ["Add availability for rotation or relocation if relevant.", "Include license or certification numbers only if safe."],
  },
  education: {
    summary: ["Mention curriculum, grade levels, and classroom size.", "Add KHDA, MOE, British, American, CBSE, or EYFS exposure."],
    experience: ["Show outcomes: lesson plans, parent communication, student progress.", "Mention tutoring, classroom support, SEN, or activity planning."],
    skills: ["Include classroom management, LMS, lesson planning, assessment.", "List languages and teaching licenses clearly."],
    photo: ["Use a warm, professional photo suitable for parents.", "Avoid classroom photos with children for privacy."],
    contact: ["Add LinkedIn or portfolio if it shows teaching materials.", "Mention UAE availability and school location preference."],
  },
};

export const industryOptions = [
  ["general", "General"],
  ["hospitality", "Hospitality"],
  ["construction-engineering", "Construction / Engineering"],
  ["it-software", "IT / Software"],
  ["finance-accounting", "Finance / Accounting"],
  ["healthcare", "Healthcare"],
  ["sales-marketing", "Sales / Marketing"],
  ["logistics-supply-chain", "Logistics / Supply Chain"],
  ["admin-hr", "Admin / HR"],
  ["retail", "Retail"],
  ["oil-gas", "Oil & Gas"],
  ["education", "Education"],
];

export const getTips = (industry = "general", field = "summary") =>
  tips[industry]?.[field] || tips.general[field] || [];
