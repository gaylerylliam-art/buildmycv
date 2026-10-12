import { categories, layouts } from "./categories.js";

// Examples use only selectable builder layouts; PNGs come from LiveCVPreview.
export const homeCvExamples = [
  ["hospitality", "green", "sidebar", "Amina Williams", "Hotel Receptionist", "Guest service", "Welcomed guests and coordinated check-in with the front desk team."],
  ["it", "blue", "classic", "Rahul Kumar", "IT Support Specialist", "Technical support", "Resolved support tickets and documented solutions for colleagues."],
  ["engineering", "blue", "header", "Daniel Harris", "Mechanical Engineer", "Equipment maintenance", "Coordinated preventive maintenance and reviewed equipment performance."],
  ["finance", "slate", "classic", "Carlos Martin", "Accounts Assistant", "Financial reporting", "Reconciled invoices and maintained accurate transaction records."],
  ["marketing", "red", "header", "Sara Lewis", "Marketing Assistant", "Campaign planning", "Prepared campaign content and tracked social media engagement."],
  ["supply-chain-logistics", "teal", "compact", "James Morgan", "Logistics Coordinator", "Shipment coordination", "Coordinated dispatch schedules and maintained shipment records."],
  ["education", "blue", "header", "Maria Santos", "Teaching Assistant", "Student support", "Prepared learning materials and supported classroom activities."],
  ["domestic", "green", "classic", "Anna Reyes", "Nanny", "Child care", "Supported daily routines and maintained a safe home environment."],
  ["skilled", "slate", "compact", "Ravi Singh", "Electrician", "Electrical maintenance", "Inspected installations and carried out repairs following safety procedures."],
  ["helper", "blue", "classic", "John Davis", "General Helper", "Team support", "Organised materials and supported daily warehouse operations."],
].map(([id, theme, layout, person, role, skill, duty]) => ({
  id, theme, layout, person, role, skill, duty,
  category: categories.find((category) => category.id === id).name,
  name: layouts.find((item) => item.id === layout).name,
  image: `/assets/cv-examples/${id}-${layout}-v2.png`,
}));
