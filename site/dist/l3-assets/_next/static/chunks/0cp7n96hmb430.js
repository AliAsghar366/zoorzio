(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,191476,e=>{"use strict";let{Axios:t,AxiosError:a,CanceledError:r,isCancel:i,CancelToken:o,VERSION:l,all:n,Cancel:s,isAxiosError:c,spread:d,toFormData:u,AxiosHeaders:p,HttpStatusCode:m,formToJSON:g,getAdapter:f,mergeConfig:h}=e.i(581949).default;e.s(["isAxiosError",0,c])},833277,695,e=>{"use strict";var t=e.i(843476),a=e.i(271645),r=e.i(489837),i=e.i(191476);let o=async()=>{let e=await r.axiosApi.get("/me?cello=true");if(e.data.error||!e.data.data)throw Error(e.data.message||"Failed to fetch user details");return e.data.data},l=async e=>{try{let t,a=e?.trim()||(t=void 0)||("u">typeof Intl?Intl.DateTimeFormat().resolvedOptions().timeZone:void 0),i=await r.axiosApi.get("/getLatestSubscription",{params:a?{timezone:a}:void 0});if(i.data.error||!i.data.data)return null;return i.data.data}catch(t){let e=(0,i.isAxiosError)(t)?t.response?.status:void 0;return 401!==e&&console.warn("getLatestSubscription unavailable",e??"network"),null}},n=async e=>{let t=await r.axiosApi.post("/reset-password",e);if(t.data.error)throw Error(t.data.message||"Failed to update password")},s=async e=>{let t=await r.axiosApi.post("/resetMobile",e);if(t.data.error)throw Error(t.data.message||"Failed to change mobile number")},c=async e=>{let t=await r.axiosApi.post("/verifyChangeMobile",e);if(t.data.error)throw Error(t.data.message||"Failed to verify OTP");return t.data.data&&t.data.data.user?t.data.data.user:null},d=async e=>{let t=await r.axiosApi.post("/app/set-notification-channel",{channel:e});if(t.data.error)throw Error(t.data.message||"Failed to set notification channel")},u=async e=>{let t=await r.axiosApi.patch("/update-language",JSON.stringify({language:e}),{headers:{"Content-Type":"application/json"}});if(t.data.error)throw Error(t.data.message||"Failed to update language")};e.s(["changeMobileNumber",0,s,"getCurrentUser",0,o,"getLatestSubscription",0,l,"setNotificationChannel",0,d,"updateLanguage",0,u,"updatePassword",0,n,"verifyChangeMobile",0,c],695);let p="memorae-auth-token-updated",m=(0,a.createContext)(void 0);e.s(["MEMORAE_AUTH_TOKEN_UPDATED_EVENT",0,p,"UserProvider",0,({children:e})=>{let[r,i]=(0,a.useState)(null),[n,s]=(0,a.useState)(null),[c,d]=(0,a.useState)(!0),[u,g]=(0,a.useState)(null),f=(0,a.useRef)(null),h=(0,a.useRef)(async()=>{}),_=async()=>{try{g(null);let e=await o();return i(e),f.current=e,e}catch(e){if(g(e instanceof Error?e.message:"Failed to fetch user data"),console.error("Error fetching user:",e),i(null),f.current=null,e?.response?.status===401||e?.status===401)try{localStorage.removeItem("token")}catch(e){console.warn("Failed to clear token:",e)}return null}},y=async e=>{let t=e??f.current;if(!t)return void s(null);let a=String(t.package_id??"");if(!0!==t.is_subscribed&&(""===a||"1"===a))return void s(null);let r=t.payment_timezone?.trim()||t.timezone?.trim()||("u">typeof Intl?Intl.DateTimeFormat().resolvedOptions().timeZone:void 0);s(await l(r))};h.current=async()=>{d(!0);let e=await _();await y(e),d(!1)};let b=(0,a.useCallback)(async()=>{let e=await _();await y(e)},[]),w=async()=>{await y(f.current)};return(0,a.useEffect)(()=>{try{let e=new URLSearchParams(window.location.search).get("token");if(e){try{localStorage.setItem("token",e)}catch(e){console.warn("Failed to save token from URL:",e)}let t=new URL(window.location.href);t.searchParams.delete("token"),window.history.replaceState({},"",t.toString()),h.current();return}}catch(e){console.warn("Failed to check URL for token:",e)}try{localStorage.getItem("token")?h.current():d(!1)}catch(e){console.warn("Failed to access localStorage:",e),d(!1)}},[]),(0,a.useEffect)(()=>{let e=()=>{h.current()};return window.addEventListener(p,e),()=>window.removeEventListener(p,e)},[]),(0,t.jsx)(m.Provider,{value:{user:r,subscription:n,isLoading:c,error:u,refetchUser:b,refetchSubscription:w},children:e})},"useUser",0,()=>{let e=(0,a.useContext)(m);if(void 0===e)throw Error("useUser must be used within a UserProvider");return e}],833277)},618566,(e,t,a)=>{t.exports=e.r(976562)},598690,e=>{"use strict";let t=["en","es","pt","fr"];function a(e){return t.includes(e)}e.s(["getLocaleFromPathname",0,function(e){let t=e?.split("/").filter(Boolean)[0];return a(t)?t:null},"isSupportedLocale",0,a])},558739,e=>{"use strict";var t=e.i(271645),a=e.i(618566),r=e.i(598690),i=e.i(687342),o=e.i(648026),l=e.i(650392),n=e.i(372257),s=e.i(700391);let c={es:o.default,en:l.default,pt:n.default,fr:s.default},d="memorae-language",u="memorae-language-manual",p=new Set(["onboarding","onboarding-one","onboarding-two","onboarding-three","onboarding-four","onboarding-seven","onboarding-eight"]),m=(e,t)=>{if((0,r.isSupportedLocale)(t))return!1;let a=e[0];return"string"==typeof a&&p.has(a)};e.s(["default",0,function(){let e=(0,a.useRouter)(),o=(0,a.usePathname)(),[l,n]=(0,t.useState)(()=>{{let e=window.location.pathname.split("/").filter(e=>e),t=e.length>0&&(0,r.isSupportedLocale)(e[0])?e[0]:"";if((0,r.isSupportedLocale)(t))return t;if(m(e,t))return"en";let a=localStorage.getItem(d);if((0,r.isSupportedLocale)(a))return a}return"en"}),[s,p]=(0,t.useState)(!0);return(0,t.useEffect)(()=>{let e=window.location.pathname.split("/").filter(e=>e),t=e.length>0&&(0,r.isSupportedLocale)(e[0])?e[0]:"";!m(e,t)&&(0,r.isSupportedLocale)(t)&&(localStorage.setItem(d,l),"pt"===l||"fr"===l?document.cookie=`user-locale=${l};path=/`:("en"===l||"es"===l)&&(document.cookie="user-locale=;path=/;max-age=0"))},[l,o]),(0,t.useEffect)(()=>{let t=o.split("/").filter(e=>e),a="/"===o||""===o,l=t.length>0&&(0,r.isSupportedLocale)(t[0])?t[0]:"",s=localStorage.getItem(d),c=(()=>{try{let e=Intl.DateTimeFormat().resolvedOptions().timeZone;if(i.PORTUGUESE_TIMEZONES.includes(e))return"pt";if(i.FRENCH_TIMEZONES.includes(e))return"fr";if(i.SPANISH_TIMEZONES.includes(e))return"es";return null}catch{return null}})();if(a){let t=localStorage.getItem(u),a=window.location.search;if((0,r.isSupportedLocale)(t)&&"en"!==t){e.replace(a?`/${t}${a}`:`/${t}`),p(!1);return}if(c&&!(0,r.isSupportedLocale)(s)||c&&(0,r.isSupportedLocale)(s)&&s===c&&"en"!==s){e.replace(a?`/${c}${a}`:`/${c}`),p(!1);return}if(c&&(0,r.isSupportedLocale)(s)&&s!==c&&!(0,r.isSupportedLocale)(t)){localStorage.removeItem(d),e.replace(a?`/${c}${a}`:`/${c}`),p(!1);return}p(!1);return}if(1===t.length&&(0,r.isSupportedLocale)(t[0])){n(l),localStorage.setItem(d,l),p(!1);return}let g=(e=>{for(let t of e)if("l3"===t||t.startsWith("l3-"))return t;return null})(t),f=null!==g,h=t.includes("l7"),_=t.includes("l8"),y=t.includes("l17"),b=(e=>{for(let t of e)if("l5"===t||t.startsWith("l5-")||"homepage"===t||"feature"===t)return t;return null})(t),w=null!==b,v=(e=>{for(let t of e)if("l6"===t||t.startsWith("l6-"))return t;return null})(t),S=null!==v,x=t.includes("pricing"),k=t.includes("feature"),E=t.includes("meet-memorae"),L=t.includes("plan-find"),$=t.includes("new-homepage")||E||L||0===t.length;if(f||w||S||h||_||y||x||k||$){let t=!1;if(f&&g){let e=(0,r.isSupportedLocale)(l);t=(o.endsWith("/")&&o.length>1?o.slice(0,-1):o)===`/${g}`&&!e}else if(h){let e=(0,r.isSupportedLocale)(l);t="/l7"===(o.endsWith("/")&&o.length>1?o.slice(0,-1):o)&&!e}else if(_){let e=(0,r.isSupportedLocale)(l);t="/l8"===(o.endsWith("/")&&o.length>1?o.slice(0,-1):o)&&!e}else if(y){let e=(0,r.isSupportedLocale)(l);t="/l17"===(o.endsWith("/")&&o.length>1?o.slice(0,-1):o)&&!e}else if(x){let e=(0,r.isSupportedLocale)(l);t="/pricing"===(o.endsWith("/")&&o.length>1?o.slice(0,-1):o)&&!e}else if(k){let e=(0,r.isSupportedLocale)(l);t="/feature"===(o.endsWith("/")&&o.length>1?o.slice(0,-1):o)&&!e}else if($){let e=(0,r.isSupportedLocale)(l),a=o.endsWith("/")&&o.length>1?o.slice(0,-1):o;t=!e&&("/"===a||""===a||"/new-homepage"===a||"/meet-memorae"===a||"/plan-find"===a)}else if(w&&b||S&&v){let e=(0,r.isSupportedLocale)(l);t=(o.endsWith("/")&&o.length>1?o.slice(0,-1):o)===`/${b||v}`&&!e}if(t&&c&&!(0,r.isSupportedLocale)(l)){let t=localStorage.getItem(u),a=window.location.search;if((0,r.isSupportedLocale)(t)){n(t),p(!1);return}let i=(0,r.isSupportedLocale)(s)&&s===c;(0,r.isSupportedLocale)(s)&&!i&&localStorage.removeItem(d);let l=o.endsWith("/")&&o.length>1?o.slice(0,-1):o,m=`/${c}${l}`,g=a?`${m}${a}`:m;e.replace(g),p(!1);return}(0,r.isSupportedLocale)(l)?(n(l),localStorage.setItem(d,l)):n("en"),p(!1);return}(0,r.isSupportedLocale)(l)?(n(l),localStorage.setItem(d,l)):m(t,l)?n("en"):n((0,r.isSupportedLocale)(s)?s:"en"),p(!1)},[o,e]),{t:(e,t)=>{let a=e.split("."),r=c[l];for(let t of a)if(!r||"object"!=typeof r)return e;else r=r[t];let i="string"==typeof r?r:e;return t&&"string"==typeof i&&Object.entries(t).forEach(([e,t])=>{let a=RegExp(`{{${e}}}`,"g");i=i.replace(a,String(t))}),i},currentLocale:l,changeLanguage:t=>{if((0,r.isSupportedLocale)(t)){{localStorage.setItem(d,t),localStorage.setItem(u,t);let a=o.split("/").filter(e=>e),i=a.length>0&&(0,r.isSupportedLocale)(a[0]),l=o;i?a[0]!==t&&(a[0]=t,l="/"+a.join("/")):l="/"===o?`/${t}`:`/${t}${o}`;let n=window.location.search,s=n?`${l}${n}`:l;o!==l&&e.replace(s)}n(t)}},isSpanish:"es"===l,isEnglish:"en"===l,isLoading:s}}])},489837,134483,e=>{"use strict";e.i(247167);var t=e.i(581949);let a="acquisition_source",r=["paid_meta","paid_google","paid_tiktok","organic","direct"];function i(e){return r.includes(e)}function o(e,t){return t.some(t=>e.includes(t))}function l(){try{let e=new URLSearchParams(window.location.search),t=e.get("ref")??e.get("referral"),a=e.get("utm_source")?.toLowerCase()||"",r=e.get("utm_medium")?.toLowerCase(),i=e.has("utm_source")||e.has("utm_medium")||e.has("utm_campaign")||e.has("utm_content")||e.has("utm_term"),l=e.has("gclid")||e.has("gbraid")||e.has("wbraid")||e.has("dclid"),n=e.has("ttclid"),s=e.has("fbclid")||e.has("fbc")||e.has("fbp"),c=!r||["cpc","ppc","paid","paid_social","paid-search","paid_search"].includes(r);if(t||"referral"===r)return"organic";if(n||c&&o(a,["tiktok"]))return"paid_tiktok";if(l||c&&o(a,["google","youtube"]))return"paid_google";if(s||c&&o(a,["facebook","instagram","meta"])||i)return"paid_meta";return"direct"}catch{return"direct"}}function n(){try{let e=localStorage.getItem(a);if(i(e))return e}catch{}let e=l();try{localStorage.setItem(a,e)}catch{}return e}e.s(["getAcquisitionSource",0,n,"initAcquisitionSource",0,function(){let e=localStorage.getItem(a);if(i(e))return e;let t=l();try{localStorage.setItem(a,t)}catch{}try{let e=window.mixpanel;e&&"function"==typeof e.register&&e.register({acquisition_source:t}),e&&e.people&&"function"==typeof e.people.set_once&&e.people.set_once({acquisition_source:t})}catch{}return t}],134483);let s=t.default.create({baseURL:"https://memorae.ai/api"}),c=null,d=()=>{try{let e=localStorage.getItem("token");if(e)return e}catch(e){}try{let e=sessionStorage.getItem("token");if(e)return e}catch(e){}if(c)return c;try{let e=new URLSearchParams(window.location.search).get("token");if(e){try{localStorage.setItem("token",e)}catch{}try{sessionStorage.setItem("token",e)}catch{}return c=e,e}}catch(e){}return null};s.interceptors.request.use(e=>{let t=d();t&&(e.headers.Authorization=`Bearer ${t}`);let a=/^\/lists(\/|$|\?)/.test(e.url||"");if("post"===e.method&&e.data&&!(e.data instanceof FormData)&&!a){let t=Intl.DateTimeFormat().resolvedOptions().timeZone;"object"!=typeof e.data||e.data.timezone||(e.data={...e.data,timezone:t})}if("post"===e.method&&e.url?.includes("checkout-session-stripe")&&e.data&&"object"==typeof e.data){let t=n();e.data={...e.data,metadata:{...e.data.metadata||{},acquisition_source:t}}}return e.data instanceof FormData&&delete e.headers["Content-Type"],e},e=>Promise.reject(e)),s.interceptors.response.use(e=>e,async e=>{let t=e.config;if(e.response?.status===401&&!t._retry){t._retry=!0;try{localStorage.removeItem("token")}catch{}try{sessionStorage.removeItem("token")}catch{}c=null}return Promise.reject(e)});let u=`${"https://memorae.ai/api".replace(/\/$/,"")}/auth`,p=t.default.create({baseURL:u});e.s(["authApi",0,{login:async e=>{try{return(await s.post("/login",e)).data}catch(e){throw e.response?.data||e}},register:async e=>{try{let t=n(),a={...e,timezone:e.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone,acquisition_source:t};return(await s.post("/register-user",a)).data}catch(e){throw e.response?.data||e}},forgotPassword:async(e,t)=>{try{return(await s.post("/generate-otp",{mobile:e.startsWith("+")?e:`+${e}`,timezone:t})).data}catch(e){throw e.response?.data||e}},verifyRegistration:async(e,t,a)=>{try{return(await s.post("/verify-register",{mobile:e.startsWith("+")?e:`+${e}`,otp:t,...a&&{service:a}})).data}catch(e){throw e.response?.data||e}},confirmForgotPassword:async(e,t,a,r)=>{try{let i=Intl.DateTimeFormat().resolvedOptions().timeZone;return(await s.post("/confirm-forget-password",{mobile:e.startsWith("+")?e:`+${e}`,otp:t,password:a,timezone:i,...r&&{service:r}})).data}catch(e){throw e.response?.data||e}},sendOtpSms:async e=>{try{return(await p.post("/otp/sms/send",{mobile:e.startsWith("+")?e:`+${e}`})).data}catch(e){throw e.response?.data||e}},sendOtpEmail:async(e,t)=>{try{return(await p.post("/otp/email/send",{mobile:e.startsWith("+")?e:`+${e}`,email:t})).data}catch(e){throw e.response?.data||e}},requestLoginCode:async(e,t)=>{try{return(await s.post("/request-login-code",{mobile:e.startsWith("+")?e:`+${e}`,timezone:t||Intl.DateTimeFormat().resolvedOptions().timeZone})).data}catch(e){throw e.response?.data||e}},verifyLoginCode:async(e,t,a)=>{try{return(await s.post("/verify-login-code",{mobile:e.startsWith("+")?e:`+${e}`,otp:t,timezone:a||Intl.DateTimeFormat().resolvedOptions().timeZone})).data}catch(e){throw e.response?.data||e}},setAccountPassword:async(e,t,a,r)=>{try{return(await s.post("/set-account-password",{mobile:e.startsWith("+")?e:`+${e}`,otp:t,password:a,timezone:r||Intl.DateTimeFormat().resolvedOptions().timeZone})).data}catch(e){throw e.response?.data||e}}},"axiosApi",0,s,"getToken",0,d,"setMemoryToken",0,function(e){c=e}],489837)},45018,e=>{"use strict";let t="ad_attribution_data";function a(e){if("u"<typeof document)return null;let t=document.cookie.match(RegExp("(?:^|; )"+e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"=([^;]*)"));return t?decodeURIComponent(t[1]):null}e.s(["captureAdAttribution",0,function(){try{var e,r;let i,o=new URLSearchParams(window.location.search),l=o.get("fbclid"),n=a("_fbp")||o.get("fbp")||null,s=a("_fbc")||o.get("fbc")||null,c=o.get("gclid"),d=o.get("gbraid"),u=o.get("wbraid"),p=o.get("dclid"),m=o.get("gclsrc"),g=o.get("gad_source"),f=o.get("gad_campaignid"),h=a("_gcl_aw"),_=a("_gcl_dc"),y=a("_gcl_gb"),b=o.get("ttclid"),w=a("_ttp")||o.get("ttp")||null,v=o.get("tt_campaign_id"),S=o.get("tt_adgroup_id"),x=o.get("tt_ad_id"),k=o.get("tt_placement"),E=o.get("tt_keyword"),L=o.get("tt_creative_id")||o.get("ttcreative_id"),$=o.get("utm_source"),I=o.get("utm_medium"),A=o.get("utm_campaign"),O=o.get("utm_content"),C=o.get("utm_term"),F=o.get("utm_id"),T=o.get("tw_source"),P=o.get("tw_adid"),D=window.location.href,j=(e={fbclid:l,gclid:c,gbraid:d,wbraid:u,dclid:p,ttclid:b,utm_source:$,tw_source:T},i=e.utm_source?.toLowerCase()||"",e.ttclid||i.includes("tiktok")?"tiktok":e.gclid||e.gbraid||e.wbraid||e.dclid||i.includes("google")||i.includes("youtube")?"google":e.fbclid||i.includes("facebook")||i.includes("instagram")||i.includes("meta")?"meta":e.tw_source||i.includes("twitter")||i.includes("x.com")?"twitter":null),N=(r={fbclid:l,gclid:c,gbraid:d,wbraid:u,dclid:p,ttclid:b}).ttclid||r.gclid||r.gbraid||r.wbraid||r.dclid||r.fbclid||null,R={fbclid:l,fbp:n,fbc:s,gclid:c,gbraid:d,wbraid:u,dclid:p,gclsrc:m,gad_source:g,gad_campaignid:f,gcl_aw:h,gcl_dc:_,gcl_gb:y,ttclid:b,ttp:w,tt_campaign_id:v,tt_adgroup_id:S,tt_ad_id:x,tt_placement:k,tt_keyword:E,tt_creative_id:L,ad_platform:j,ad_click_id:N,event_source_url:D,utm_source:$,utm_medium:I,utm_campaign:A,utm_content:O,utm_term:C,utm_id:F,tw_source:T,tw_adid:P};return(l||c||d||u||p||b||w||$||A||T)&&localStorage.setItem(t,JSON.stringify({...R,captured_at:new Date().toISOString()})),R}catch(e){return console.warn("[adAttribution] Failed to capture:",e),null}},"getAdAttributionForApi",0,function(){let e=function(){try{let e=localStorage.getItem(t);if(e){let t=JSON.parse(e);return{fbclid:t.fbclid||null,fbp:t.fbp||null,fbc:t.fbc||null,gclid:t.gclid||null,gbraid:t.gbraid||null,wbraid:t.wbraid||null,dclid:t.dclid||null,gclsrc:t.gclsrc||null,gad_source:t.gad_source||null,gad_campaignid:t.gad_campaignid||null,gcl_aw:t.gcl_aw||null,gcl_dc:t.gcl_dc||null,gcl_gb:t.gcl_gb||null,ttclid:t.ttclid||null,ttp:t.ttp||null,tt_campaign_id:t.tt_campaign_id||null,tt_adgroup_id:t.tt_adgroup_id||null,tt_ad_id:t.tt_ad_id||null,tt_placement:t.tt_placement||null,tt_keyword:t.tt_keyword||null,tt_creative_id:t.tt_creative_id||null,ad_platform:t.ad_platform||null,ad_click_id:t.ad_click_id||null,event_source_url:t.event_source_url||null,utm_source:t.utm_source||null,utm_medium:t.utm_medium||null,utm_campaign:t.utm_campaign||null,utm_content:t.utm_content||null,utm_term:t.utm_term||null,utm_id:t.utm_id||null,tw_source:t.tw_source||null,tw_adid:t.tw_adid||null}}}catch(e){console.warn("[adAttribution] Failed to get stored data:",e)}return{fbclid:null,fbp:null,fbc:null,gclid:null,gbraid:null,wbraid:null,dclid:null,gclsrc:null,gad_source:null,gad_campaignid:null,gcl_aw:null,gcl_dc:null,gcl_gb:null,ttclid:null,ttp:null,tt_campaign_id:null,tt_adgroup_id:null,tt_ad_id:null,tt_placement:null,tt_keyword:null,tt_creative_id:null,ad_platform:null,ad_click_id:null,event_source_url:null,utm_source:null,utm_medium:null,utm_campaign:null,utm_content:null,utm_term:null,utm_id:null,tw_source:null,tw_adid:null}}(),a=e.event_source_url;return a&&e.fbclid&&!a.includes("fbclid=")&&(a=`${a}${a.includes("?")?"&":"?"}fbclid=${e.fbclid}`),{fbclid:e.fbclid,fbp:e.fbp,fbc:e.fbc,gclid:e.gclid,gbraid:e.gbraid,wbraid:e.wbraid,dclid:e.dclid,gclsrc:e.gclsrc,gad_source:e.gad_source,gad_campaignid:e.gad_campaignid,gcl_aw:e.gcl_aw,gcl_dc:e.gcl_dc,gcl_gb:e.gcl_gb,ttclid:e.ttclid,ttp:e.ttp,tt_campaign_id:e.tt_campaign_id,tt_adgroup_id:e.tt_adgroup_id,tt_ad_id:e.tt_ad_id,tt_placement:e.tt_placement,tt_keyword:e.tt_keyword,tt_creative_id:e.tt_creative_id,ad_platform:e.ad_platform,ad_click_id:e.ad_click_id,event_source_url:a,utm_source:e.utm_source,utm_medium:e.utm_medium,utm_campaign:e.utm_campaign,utm_content:e.utm_content,utm_term:e.utm_term,utm_id:e.utm_id,tw_source:e.tw_source,tw_adid:e.tw_adid}}])},705766,e=>{"use strict";let t,a;var r,i=e.i(271645);let o={data:""},l=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,n=/\/\*[^]*?\*\/|  +/g,s=/\n+/g,c=(e,t)=>{let a="",r="",i="";for(let o in e){let l=e[o];"@"==o[0]?"i"==o[1]?a=o+" "+l+";":r+="f"==o[1]?c(l,o):o+"{"+c(l,"k"==o[1]?"":t)+"}":"object"==typeof l?r+=c(l,t?t.replace(/([^,])+/g,e=>o.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)):o):null!=l&&(o=/^--/.test(o)?o:o.replace(/[A-Z]/g,"-$&").toLowerCase(),i+=c.p?c.p(o,l):o+":"+l+";")}return a+(t&&i?t+"{"+i+"}":i)+r},d={},u=e=>{if("object"==typeof e){let t="";for(let a in e)t+=a+u(e[a]);return t}return e};function p(e){let t,a,r=this||{},i=e.call?e(r.p):e;return((e,t,a,r,i)=>{var o;let p=u(e),m=d[p]||(d[p]=(e=>{let t=0,a=11;for(;t<e.length;)a=101*a+e.charCodeAt(t++)>>>0;return"go"+a})(p));if(!d[m]){let t=p!==e?e:(e=>{let t,a,r=[{}];for(;t=l.exec(e.replace(n,""));)t[4]?r.shift():t[3]?(a=t[3].replace(s," ").trim(),r.unshift(r[0][a]=r[0][a]||{})):r[0][t[1]]=t[2].replace(s," ").trim();return r[0]})(e);d[m]=c(i?{["@keyframes "+m]:t}:t,a?"":"."+m)}let g=a&&d.g?d.g:null;return a&&(d.g=d[m]),o=d[m],g?t.data=t.data.replace(g,o):-1===t.data.indexOf(o)&&(t.data=r?o+t.data:t.data+o),m})(i.unshift?i.raw?(t=[].slice.call(arguments,1),a=r.p,i.reduce((e,r,i)=>{let o=t[i];if(o&&o.call){let e=o(a),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;o=t?"."+t:e&&"object"==typeof e?e.props?"":c(e,""):!1===e?"":e}return e+r+(null==o?"":o)},"")):i.reduce((e,t)=>Object.assign(e,t&&t.call?t(r.p):t),{}):i,(e=>{if("object"==typeof window){let t=(e?e.querySelector("#_goober"):window._goober)||Object.assign(document.createElement("style"),{innerHTML:" ",id:"_goober"});return t.nonce=window.__nonce__,t.parentNode||(e||document.head).appendChild(t),t.firstChild}return e||o})(r.target),r.g,r.o,r.k)}p.bind({g:1});let m,g,f,h=p.bind({k:1});function _(e,t){let a=this||{};return function(){let r=arguments;function i(o,l){let n=Object.assign({},o),s=n.className||i.className;a.p=Object.assign({theme:g&&g()},n),a.o=/ *go\d+/.test(s),n.className=p.apply(a,r)+(s?" "+s:""),t&&(n.ref=l);let c=e;return e[0]&&(c=n.as||e,delete n.as),f&&c[0]&&f(n),m(c,n)}return t?t(i):i}}var y=(e,t)=>"function"==typeof e?e(t):e,b=(t=0,()=>(++t).toString()),w=()=>{if(void 0===a&&"u">typeof window){let e=matchMedia("(prefers-reduced-motion: reduce)");a=!e||e.matches}return a},v="default",S=(e,t)=>{let{toastLimit:a}=e.settings;switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,a)};case 1:return{...e,toasts:e.toasts.map(e=>e.id===t.toast.id?{...e,...t.toast}:e)};case 2:let{toast:r}=t;return S(e,{type:+!!e.toasts.find(e=>e.id===r.id),toast:r});case 3:let{toastId:i}=t;return{...e,toasts:e.toasts.map(e=>e.id===i||void 0===i?{...e,dismissed:!0,visible:!1}:e)};case 4:return void 0===t.toastId?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(e=>e.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let o=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(e=>({...e,pauseDuration:e.pauseDuration+o}))}}},x=[],k={toasts:[],pausedAt:void 0,settings:{toastLimit:20}},E={},L=(e,t=v)=>{E[t]=S(E[t]||k,e),x.forEach(([e,a])=>{e===t&&a(E[t])})},$=e=>Object.keys(E).forEach(t=>L(e,t)),I=(e=v)=>t=>{L(t,e)},A={blank:4e3,error:4e3,success:2e3,loading:1/0,custom:4e3},O=e=>(t,a)=>{let r,i=((e,t="blank",a)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:"status","aria-live":"polite"},message:e,pauseDuration:0,...a,id:(null==a?void 0:a.id)||b()}))(t,e,a);return I(i.toasterId||(r=i.id,Object.keys(E).find(e=>E[e].toasts.some(e=>e.id===r))))({type:2,toast:i}),i.id},C=(e,t)=>O("blank")(e,t);C.error=O("error"),C.success=O("success"),C.loading=O("loading"),C.custom=O("custom"),C.dismiss=(e,t)=>{let a={type:3,toastId:e};t?I(t)(a):$(a)},C.dismissAll=e=>C.dismiss(void 0,e),C.remove=(e,t)=>{let a={type:4,toastId:e};t?I(t)(a):$(a)},C.removeAll=e=>C.remove(void 0,e),C.promise=(e,t,a)=>{let r=C.loading(t.loading,{...a,...null==a?void 0:a.loading});return"function"==typeof e&&(e=e()),e.then(e=>{let i=t.success?y(t.success,e):void 0;return i?C.success(i,{id:r,...a,...null==a?void 0:a.success}):C.dismiss(r),e}).catch(e=>{let i=t.error?y(t.error,e):void 0;i?C.error(i,{id:r,...a,...null==a?void 0:a.error}):C.dismiss(r)}),e};var F=1e3,T=h`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,P=h`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,D=h`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,j=_("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${T} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${P} 0.15s ease-out forwards;
    animation-delay: 150ms;
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: ${e=>e.secondary||"#fff"};
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
  }

  &:before {
    animation: ${D} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,N=h`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,R=_("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${e=>e.secondary||"#e0e0e0"};
  border-right-color: ${e=>e.primary||"#616161"};
  animation: ${N} 1s linear infinite;
`,U=h`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,z=h`
0% {
	height: 0;
	width: 0;
	opacity: 0;
}
40% {
  height: 0;
	width: 6px;
	opacity: 1;
}
100% {
  opacity: 1;
  height: 10px;
}`,W=_("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${U} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${z} 0.2s ease-out forwards;
    opacity: 0;
    animation-delay: 200ms;
    position: absolute;
    border-right: 2px solid;
    border-bottom: 2px solid;
    border-color: ${e=>e.secondary||"#fff"};
    bottom: 6px;
    left: 6px;
    height: 10px;
    width: 6px;
  }
`,M=_("div")`
  position: absolute;
`,Z=_("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,q=h`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,H=_("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${q} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,B=({toast:e})=>{let{icon:t,type:a,iconTheme:r}=e;return void 0!==t?"string"==typeof t?i.createElement(H,null,t):t:"blank"===a?null:i.createElement(Z,null,i.createElement(R,{...r}),"loading"!==a&&i.createElement(M,null,"error"===a?i.createElement(j,{...r}):i.createElement(W,{...r})))},J=_("div")`
  display: flex;
  align-items: center;
  background: #fff;
  color: #363636;
  line-height: 1.3;
  will-change: transform;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1), 0 3px 3px rgba(0, 0, 0, 0.05);
  max-width: 350px;
  pointer-events: auto;
  padding: 8px 10px;
  border-radius: 8px;
`,K=_("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`,G=i.memo(({toast:e,position:t,style:a,children:r})=>{let o=e.height?((e,t)=>{let a=e.includes("top")?1:-1,[r,i]=w()?["0%{opacity:0;} 100%{opacity:1;}","0%{opacity:1;} 100%{opacity:0;}"]:[`
0% {transform: translate3d(0,${-200*a}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${-150*a}%,-1px) scale(.6); opacity:0;}
`];return{animation:t?`${h(r)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${h(i)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}})(e.position||t||"top-center",e.visible):{opacity:0},l=i.createElement(B,{toast:e}),n=i.createElement(K,{...e.ariaProps},y(e.message,e));return i.createElement(J,{className:e.className,style:{...o,...a,...e.style}},"function"==typeof r?r({icon:l,message:n}):i.createElement(i.Fragment,null,l,n))});r=i.createElement,c.p=void 0,m=r,g=void 0,f=void 0;var V=({id:e,className:t,style:a,onHeightUpdate:r,children:o})=>{let l=i.useCallback(t=>{if(t){let a=()=>{r(e,t.getBoundingClientRect().height)};a(),new MutationObserver(a).observe(t,{subtree:!0,childList:!0,characterData:!0})}},[e,r]);return i.createElement("div",{ref:l,className:t,style:a},o)},Y=p`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`;e.s(["Toaster",0,({reverseOrder:e,position:t="top-center",toastOptions:a,gutter:r,children:o,toasterId:l,containerStyle:n,containerClassName:s})=>{let{toasts:c,handlers:d}=((e,t="default")=>{let{toasts:a,pausedAt:r}=((e={},t=v)=>{let[a,r]=(0,i.useState)(E[t]||k),o=(0,i.useRef)(E[t]);(0,i.useEffect)(()=>(o.current!==E[t]&&r(E[t]),x.push([t,r]),()=>{let e=x.findIndex(([e])=>e===t);e>-1&&x.splice(e,1)}),[t]);let l=a.toasts.map(t=>{var a,r,i;return{...e,...e[t.type],...t,removeDelay:t.removeDelay||(null==(a=e[t.type])?void 0:a.removeDelay)||(null==e?void 0:e.removeDelay),duration:t.duration||(null==(r=e[t.type])?void 0:r.duration)||(null==e?void 0:e.duration)||A[t.type],style:{...e.style,...null==(i=e[t.type])?void 0:i.style,...t.style}}});return{...a,toasts:l}})(e,t),o=(0,i.useRef)(new Map).current,l=(0,i.useCallback)((e,t=F)=>{if(o.has(e))return;let a=setTimeout(()=>{o.delete(e),n({type:4,toastId:e})},t);o.set(e,a)},[]);(0,i.useEffect)(()=>{if(r)return;let e=Date.now(),i=a.map(a=>{if(a.duration===1/0)return;let r=(a.duration||0)+a.pauseDuration-(e-a.createdAt);if(r<0){a.visible&&C.dismiss(a.id);return}return setTimeout(()=>C.dismiss(a.id,t),r)});return()=>{i.forEach(e=>e&&clearTimeout(e))}},[a,r,t]);let n=(0,i.useCallback)(I(t),[t]),s=(0,i.useCallback)(()=>{n({type:5,time:Date.now()})},[n]),c=(0,i.useCallback)((e,t)=>{n({type:1,toast:{id:e,height:t}})},[n]),d=(0,i.useCallback)(()=>{r&&n({type:6,time:Date.now()})},[r,n]),u=(0,i.useCallback)((e,t)=>{let{reverseOrder:r=!1,gutter:i=8,defaultPosition:o}=t||{},l=a.filter(t=>(t.position||o)===(e.position||o)&&t.height),n=l.findIndex(t=>t.id===e.id),s=l.filter((e,t)=>t<n&&e.visible).length;return l.filter(e=>e.visible).slice(...r?[s+1]:[0,s]).reduce((e,t)=>e+(t.height||0)+i,0)},[a]);return(0,i.useEffect)(()=>{a.forEach(e=>{if(e.dismissed)l(e.id,e.removeDelay);else{let t=o.get(e.id);t&&(clearTimeout(t),o.delete(e.id))}})},[a,l]),{toasts:a,handlers:{updateHeight:c,startPause:s,endPause:d,calculateOffset:u}}})(a,l);return i.createElement("div",{"data-rht-toaster":l||"",style:{position:"fixed",zIndex:9999,top:16,left:16,right:16,bottom:16,pointerEvents:"none",...n},className:s,onMouseEnter:d.startPause,onMouseLeave:d.endPause},c.map(a=>{let l,n,s=a.position||t,c=d.calculateOffset(a,{reverseOrder:e,gutter:r,defaultPosition:t}),u=(l=s.includes("top"),n=s.includes("center")?{justifyContent:"center"}:s.includes("right")?{justifyContent:"flex-end"}:{},{left:0,right:0,display:"flex",position:"absolute",transition:w()?void 0:"all 230ms cubic-bezier(.21,1.02,.73,1)",transform:`translateY(${c*(l?1:-1)}px)`,...l?{top:0}:{bottom:0},...n});return i.createElement(V,{id:a.id,key:a.id,onHeightUpdate:d.updateHeight,className:a.visible?Y:"",style:u},"custom"===a.type?y(a.message,a):o?o(a):i.createElement(G,{toast:a,position:s}))}))},"default",0,C,"toast",0,C],705766)}]);