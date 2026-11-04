/* Shared by React and pre-rendered pages. No CV data is accepted by this API. */
(() => {
  if (window.BuildMyCVAnalytics) return;
  const id = 'G-3RM5XEZD4C', key = 'bmcv:analytics-consent:v1';
  const production = ['buildmycvnow.com', 'www.buildmycvnow.com'].includes(location.hostname);
  let choice = null, started = false, lastPath = null;
  const once = new Set();
  try { choice = localStorage.getItem(key); } catch { /* Storage may be unavailable. */ }
  const allowedEvents = new Set(['builder_started','cv_import_completed','download_completed','cover_letter_downloaded','download_clicked','cv_draft_created','personal_info_completed','work_experience_added','education_added','skills_added','preview_viewed','contact_form_sent','contact_form_failed','share_clicked','email_subscribed','export_below_threshold','nextstep_clicked','completion_milestone','builder_opened','seo_page_to_builder','account_email_otp_sent','urgent_mode_start','signup','login','signup_confirmation_resend','account_email_otp_verified','save_cv','restore_cloud_draft','switch_template_keep_data','switch_template_load_sample','load_saved_cv','logout','cv_email_requested']);
  const enums = {format:['pdf','docx','word','image'],start_option:['scratch','upload','template'],channel:['native','copylink','whatsapp','facebook'],method:['local','email'],mode:['local','registered'],step:['personal','experience','education','skills','summary','extras','download','import'],moment:['download','completion','milestone'],source:['homepage','builder','blog','footer']};
  function clean(params) {
    const safe = {};
    for (const [name, values] of Object.entries(enums)) if (values.includes(params[name])) safe[name] = params[name];
    for (const name of ['completion_percent','percent']) if (Number.isFinite(params[name])) safe[name] = Math.max(0, Math.min(100, params[name]));
    return safe;
  }
  function permitted() { return production && choice === 'accepted'; }
  function send(name, params = {}) {
    if (!permitted() || !started || !allowedEvents.has(name)) return false;
    window.gtag('event', name, clean(params)); return true;
  }
  function sendOnce(name, params = {}) {
    if (once.has(name)) return false;
    // Count one builder entrance per tab session, including React StrictMode/remounts.
    let seen = false;
    try { seen = sessionStorage.getItem('bmcv:measured:' + name) === '1'; } catch {}
    if (seen || !send(name, params)) return false;
    once.add(name);
    try { sessionStorage.setItem('bmcv:measured:' + name, '1'); } catch {}
    return true;
  }
  const safeLocation = () => location.origin + location.pathname;
  function page() {
    if (!permitted() || !started || lastPath === location.pathname) return;
    lastPath = location.pathname;
    // Never send query strings, hashes, document titles or full referrer URLs.
    window.gtag('set', {page_location:safeLocation(), page_referrer:referrer()});
    window.gtag('event','page_view',{page_location:safeLocation(),page_title:location.pathname === '/' ? 'Home' : location.pathname,page_referrer:referrer()});
  }
  function referrer() { try { return document.referrer ? new URL(document.referrer).origin : ''; } catch { return ''; } }
  function init() {
    if (!permitted()) return;
    if (!started) {
      started = true;
      window['ga-disable-' + id] = false;
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
      window.gtag('consent','update',{analytics_storage:'granted'});
      window.gtag('js',new Date());
      const params = new URLSearchParams(location.search), campaign = {};
      const source = params.get('utm_source'), medium = params.get('utm_medium');
      if (['linkedin','facebook','instagram','whatsapp','youtube','tiktok','newsletter','partner','share','copylink'].includes(source) && ['social','referral','email','cpc'].includes(medium)) Object.assign(campaign,{campaign_source:source,campaign_medium:medium});
      window.gtag('config',id,{...campaign,send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,page_location:safeLocation(),page_referrer:referrer()});
      const script = document.createElement('script'); script.async = true; script.dataset.bmcvAnalytics = 'true';
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id; document.head.appendChild(script);
    }
    page();
  }
  function clearCookies() {
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.split('=')[0].trim();
      if (!/^_ga(?:_|$)|^_gid$|^_gat/.test(name)) continue;
      for (const domain of ['', location.hostname, '.buildmycvnow.com']) document.cookie = name + '=; Max-Age=0; path=/' + (domain ? '; domain=' + domain : '');
    }
  }
  function setConsent(value) {
    choice = value;
    try { localStorage.setItem(key,value); } catch {}
    if (value === 'accepted') {
      window['ga-disable-' + id] = false;
      if (started) window.gtag('consent','update',{analytics_storage:'granted'});
      init();
    }
    else {
      window['ga-disable-' + id] = true;
      if (started) window.gtag('consent','update',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
      clearCookies(); lastPath = null;
    }
    if (value === 'accepted' && started) window['ga-disable-' + id] = false;
    document.getElementById('bmcv-privacy-panel')?.remove();
    window.dispatchEvent(new Event('bmcv-analytics-consent'));
  }
  function showPreferences() {
    if (document.getElementById('bmcv-privacy-panel')) return;
    const panel = document.createElement('section'); panel.id = 'bmcv-privacy-panel'; panel.setAttribute('aria-label','Analytics preferences'); panel.setAttribute('data-html2canvas-ignore','true');
    const text = document.createElement('p'); text.textContent = 'Your CV drafts use essential browser storage. With your permission, Google Analytics measures visits and CV-builder actions. We do not send your CV text, name or email to Analytics.';
    panel.append(text);
    const actions = document.createElement('div');
    const privacy = document.createElement('a'); privacy.href = '/privacy/'; privacy.textContent = 'Privacy policy'; actions.append(privacy);
    for (const [value,label] of [['rejected','Reject analytics'],['accepted','Allow analytics']]) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.onclick = () => setConsent(value); actions.append(button);
    }
    if (choice) {const close = document.createElement('button'); close.type='button'; close.textContent='Close'; close.onclick=()=>panel.remove(); actions.append(close);}
    panel.append(actions); document.body.append(panel);
  }
  function mount() {
    const button = document.createElement('button'); button.type='button'; button.id='bmcv-privacy-settings'; button.setAttribute('data-html2canvas-ignore','true'); button.textContent='Privacy choices'; button.onclick=showPreferences; document.body.append(button);
    if (!choice) showPreferences();
  }
  window.BuildMyCVAnalytics = {init,page,track:send,trackOnce:sendOnce,showPreferences};
  init();
  window.addEventListener('storage', event => { if(event.key === key) {choice=event.newValue; if(choice==='accepted') init(); else setConsent('rejected');} });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',mount,{once:true}); else mount();
})();
