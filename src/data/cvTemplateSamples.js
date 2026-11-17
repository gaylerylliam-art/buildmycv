const demos = {
  classic: ["Omar Haddad", "Senior Accountant", "Dubai, UAE", ["Month-end close", "IFRS reporting", "Financial controls", "Advanced Excel", "Audit preparation", "Financial forecasting"], ["Senior Accountant", "Accountant", "Assistant Accountant", "Junior Auditor"], "B.Com. Accounting", "Financial reporting certificate", [
    "Reconciled balance sheet accounts and documented the results for the monthly review.",
    "Prepared financial statements and supporting schedules for internal and external audits.",
    "Worked with operations teams to resolve variances and improve reporting accuracy.",
    "Maintained a checklist for recurring close activities and trained new team members.",
  ]],
  sidebar: ["Priya Nair", "Full-Stack Developer", "Dubai, UAE", ["TypeScript", "React", "Node.js", "PostgreSQL", "AWS", "Automated testing"], ["Senior Full-Stack Developer", "Full-Stack Developer", "Software Engineer"], "B.Tech. Computer Science", "Cloud developer certification", [
    "Delivered accessible application features with a cross-functional engineering team.",
    "Designed API endpoints and added integration tests for common customer workflows.",
    "Improved database queries and monitored performance after each production release.",
    "Reviewed code and documented deployment steps for the wider team.",
  ]],
  executive: ["Karim Mansour", "MEP Project Engineer", "Abu Dhabi, UAE", ["HVAC design", "Project planning", "Testing and commissioning", "Cost control", "Safety leadership", "AutoCAD"], ["MEP Project Engineer", "Mechanical Site Engineer", "Junior Mechanical Engineer"], "B.Sc. Mechanical Engineering", "Project management certification", [
    "Coordinated mechanical and electrical work with contractors and site supervisors.",
    "Reviewed technical drawings and tracked actions from weekly progress meetings.",
    "Prepared commissioning schedules and resolved open items before project handover.",
    "Monitored material deliveries and maintained clear records of approvals.",
  ]],
  timeline: ["Sofia Reyes", "Front Office Manager", "Dubai, UAE", ["Guest experience", "Team leadership", "Opera PMS", "Roster planning", "Complaint resolution", "Night audit"], ["Front Office Manager", "Assistant Front Office Manager", "Guest Relations Officer"], "B.S. Hospitality Management", "Guest service and first aid training", [
    "Managed reception and guest services across day, evening and night shifts.",
    "Coached new front desk colleagues on check-in procedures and service standards.",
    "Resolved guest requests in partnership with housekeeping and reservations teams.",
    "Prepared occupancy reports and shared operational updates with management.",
  ]],
  compact: ["Daniel Okafor", "Logistics Coordinator", "Jebel Ali, UAE", ["Import and export documentation", "Inventory control", "Customs clearance", "Carrier coordination", "SAP MM", "Excel reporting"], ["Logistics Coordinator", "Warehouse Supervisor", "Shipping Officer"], "B.Sc. Transport Management", "Logistics and transport certificate", [
    "Coordinated freight shipments and checked documentation before dispatch.",
    "Tracked inventory discrepancies and investigated failures with warehouse teams.",
    "Prepared delivery performance reports and helped resolve carrier issues.",
    "Documented standard procedures and trained new logistics coordinators.",
  ]],
};

export function getTemplateSample(id) {
  if (!Object.hasOwn(demos, id)) return null;
  const [fullName, jobTitle, country, skills, jobs, education, certifications, duties] = demos[id];
  return {
    fullName, jobTitle, country, email: fullName.toLowerCase().replace(" ", ".") + "@example.com", phone: "+1 202 555 0142",
    summary: `${jobTitle} with experience coordinating day-to-day operations, supporting colleagues and improving team workflows. Combines practical expertise with clear communication and attention to detail.`,
    skills: skills.join("\n"), education, certifications, languages: "English - fluent\nFrench - intermediate",
    projects: "Process improvement project\nCoordinated a team review and documented a simpler workflow with fewer manual steps.",
    awards: "Team contribution award",
    sectionOrder: ["summary", "skills", "experience", "education", "educationProjects", "certifications", "languages", "awards", "references"],
    workExperiences: jobs.map((title, index) => ({
      id: `sample-${id}-${index}`, jobTitle: title, employer: `Example ${["Group", "Partners", "Services", "Company"][index]}`,
      companyLocation: country, fromDate: String(2022 - index * 3), toDate: index ? String(2025 - index * 3) : "",
      isCurrent: index === 0, responsibilities: duties.slice(0, 4 - Math.min(index, 2)).join("\n"),
    })),
    references: { mode: "on-request", entries: [] },
  };
}

export const samplePersonalFields = ["fullName", "email", "phone"];
export const sameSampleValue = (a, b) => String(a ?? "").trim().replace(/\s+/g, " ").toLowerCase() === String(b ?? "").trim().replace(/\s+/g, " ").toLowerCase();

export function getTemplateSampleStatus(cv) {
  const sample = getTemplateSample(cv.sampleTemplateId);
  if (!sample) return { personal: [], sections: [] };
  const personal = samplePersonalFields.filter((key) => sameSampleValue(cv[key], sample[key]));
  const sections = ["jobTitle", "country", "summary", "skills", "education", "certifications", "languages", "projects", "awards"]
    .filter((key) => sameSampleValue(cv[key], sample[key]));
  if (cv.workExperiences?.some((entry) => sample.workExperiences.some((demo) =>
    sameSampleValue(entry.employer, demo.employer) || sameSampleValue(entry.responsibilities, demo.responsibilities)))) sections.push("experience");
  return { personal, sections };
}
