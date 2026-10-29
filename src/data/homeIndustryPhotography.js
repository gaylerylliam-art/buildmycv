const photo = (category, id, page, alt, photographer) => ({
  src: `/assets/industries/${category}.jpg`,
  alt,
  credit: `${photographer} / Pexels`,
  source: `https://www.pexels.com/photo/${page}-${id}/`,
});

export const homeIndustryPhotography = {
  hospitality: photo('hospitality', 36684286, 'hotel-reception-desk-attendant-in-lobby', 'A hotel receptionist at the front desk', 'abdo alshreef'),
  it: photo('it', 340152, 'selective-focus-photography-of-man-facing-computer', 'A technology professional working at computer monitors', 'hitesh choudhary'),
  engineering: photo('engineering', 8961133, 'a-man-and-a-woman-with-ppe-s-looking-at-a-blue-print', 'Engineers in safety equipment reviewing plans on site', 'Mikael Blomkvist'),
  finance: photo('finance', 4476375, 'bookkeeper-writing-down-on-paper-while-using-calculator', 'A bookkeeper checking figures with a calculator', 'Kaboompics.com'),
  marketing: photo('marketing', 7688106, 'people-discuss-strategy-documents', 'Colleagues reviewing marketing strategy documents', 'Kindel Media'),
  'supply-chain-logistics': photo('supply-chain-logistics', 4481528, 'men-working-in-a-warehouse', 'Warehouse employees organising stock', 'Tiger Lily'),
  education: photo('education', 5212703, 'a-teacher-standing-in-the-classroom', 'A teacher working with students in a classroom', 'Max Fischer'),
  domestic: photo('domestic', 3818956, 'photo-of-woman-reading-a-story-to-her-child', 'An adult reading a story with children at home', 'Andrea Piacquadio'),
  skilled: photo('skilled', 34526423, 'female-technician-working-on-electrical-control-panel', 'A technician working on an electrical control panel', 'mickael ange konan'),
  helper: photo('helper', 12234106, 'close-up-shot-of-a-person-doing-a-checklist', 'A warehouse worker reviewing an inventory checklist', 'Daniel Andraski'),
};
