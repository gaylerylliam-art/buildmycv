export const MAX_CV_BYTES = 3 * 1024 * 1024;
export const MAX_CV_TEXT = 60000;
export const CV_FIELDS = {
  fullName: 'Full name',
  jobTitle: 'Professional title',
  email: 'Email',
  phone: 'Phone',
  location: 'Location',
  linkedIn: 'LinkedIn',
  portfolioUrl: 'Portfolio website',
  professionalLinks: 'Other professional links',
  nationality: 'Nationality (only if present)',
  visaStatus: 'Visa status (only if present)',
  drivingLicense: 'Driving license (only if present)',
  summary: 'Professional summary',
  education: 'Education',
  skills: 'Skills',
  certifications: 'Certifications',
  languages: 'Languages',
  projects: 'Projects',
  awards: 'Awards',
  volunteerExperience: 'Volunteer experience',
  references: 'References',
  originalLanguage: 'Document language',
  unclassifiedContent: 'Unclassified content (retained for review)'
};
const string = {
  type: 'string'
};
const object = properties => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false
});
export const WORK_SCHEMA = object({
  jobTitle: string,
  employer: string,
  companyLocation: string,
  fromDate: string,
  toDate: string,
  isCurrent: {
    type: 'boolean'
  },
  responsibilities: string
});
export const CV_IMPORT_SCHEMA = object({
  ...Object.fromEntries(Object.keys(CV_FIELDS).map(key => [key, string])),
  languageDirection: {
    type: 'string',
    enum: ['ltr', 'rtl']
  },
  workExperiences: {
    type: 'array',
    items: WORK_SCHEMA
  },
  uncertainties: {
    type: 'array',
    items: object({
      field: string,
      reason: string
    })
  }
});
export const OCR_SCHEMA = object({
  pages: {
    type: 'array',
    items: object({
      pageNumber: {
        type: 'integer'
      },
      text: string
    })
  },
  warnings: {
    type: 'array',
    items: string
  }
});
export function validateSchema(value, schema, path = 'result') {
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path} must be an object.`);
    if (Object.keys(value).some(key => !Object.hasOwn(schema.properties, key))) throw new Error(`${path} has unexpected fields.`);
    for (const key of schema.required) validateSchema(value[key], schema.properties[key], `${path}.${key}`);
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length > 100) throw new Error(`${path} must be a list with at most 100 items.`);
    value.forEach((item, i) => validateSchema(item, schema.items, `${path}.${i}`));
  } else if (schema.type === 'string') {
    if (typeof value !== 'string' || value.length > MAX_CV_TEXT || value.includes('\0')) throw new Error(`${path} contains invalid text.`);
    if (schema.enum && !schema.enum.includes(value)) throw new Error(`${path} has an invalid option.`);
  } else if (schema.type === 'boolean' && typeof value !== 'boolean') throw new Error(`${path} must be true or false.`);else if (schema.type === 'integer' && !Number.isInteger(value)) throw new Error(`${path} must be an integer.`);
  return value;
}
export function validateCvImport(value) {
  validateSchema(value, CV_IMPORT_SCHEMA);
  if (JSON.stringify(value).length > 180000 || value.workExperiences.length > 50) throw new Error('The structured CV is too large.');
  return value;
}
export function validateUploadFile(file) {
  if (!file || typeof file.name !== 'string' || file.name.length > 255 || /[\\/\u0000-\u001f]/.test(file.name) || !/\.(pdf|docx|jpe?g|png)$/i.test(file.name)) throw new Error('Choose a PDF, DOCX, JPG, or PNG file.');
  if (!Number.isInteger(file.size) || file.size < 1) throw new Error('This file is empty or corrupted.');
  if (file.size > MAX_CV_BYTES) throw new Error('The file is too large. The maximum size is 3 MB.');
}
export function toBuilderImport(review, importId) {
  validateCvImport(review);
  return {
    ...Object.fromEntries(Object.keys(CV_FIELDS).map(key => [key, review[key]])),
    country: review.location,
    languageDirection: review.languageDirection,
    outputLanguage: review.originalLanguage,
    workExperiences: review.workExperiences.map((entry, i) => ({
      ...entry,
      id: `${importId}-work-${i}`
    }))
  };
}
