# BuildMyCVNow Analytics

North-star funnel: visit -> builder_opened -> cv_downloaded.

## Funnel Events

- `builder_opened` `{ source, role }`
- `section_completed` `{ section }`
- `template_selected` `{ templateId }`
- `cv_downloaded` `{ templateId, completionPercent }`
- `cover_letter_downloaded` `{ templateId }`

## Growth Events

- `seo_page_view` `{ job, city }`
- `seo_page_to_builder` `{ role, city }`
- `blog_to_builder` `{ article }`
- `share_clicked` `{ channel, moment }`
- `email_subscribed` `{ source }`

## Quality Events

- `ats_score_viewed` `{ score }`
- `import_linkedin_used` `{ path }`

## Share UTM Map

- Native share: `utm_source=share&utm_medium=native`
- WhatsApp share: `utm_source=whatsapp&utm_medium=share`
- Facebook share: `utm_source=facebook&utm_medium=share`
- Copy link: `utm_source=copylink&utm_medium=share`

Configure `cv_downloaded` and `email_subscribed` as Plausible goals.
