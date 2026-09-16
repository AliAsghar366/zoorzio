(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,88653,e=>{"use strict";e.i(247167);var t=e.i(843476),a=e.i(271645),i=e.i(231178),o=e.i(947414),s=e.i(346267),n=e.i(821476),l=e.i(772846),r=a,c=e.i(737806);function d(e,t){if("function"==typeof e)return e(t);null!=e&&(e.current=t)}class m extends r.Component{getSnapshotBeforeUpdate(e){let t=this.props.childRef.current;if((0,l.isHTMLElement)(t)&&e.isPresent&&!this.props.isPresent&&!1!==this.props.pop){let e=t.offsetParent,a=(0,l.isHTMLElement)(e)&&e.offsetWidth||0,i=(0,l.isHTMLElement)(e)&&e.offsetHeight||0,o=getComputedStyle(t),s=this.props.sizeRef.current;s.height=parseFloat(o.height),s.width=parseFloat(o.width),s.top=t.offsetTop,s.left=t.offsetLeft,s.right=a-s.width-s.left,s.bottom=i-s.height-s.top}return null}componentDidUpdate(){}render(){return this.props.children}}function p({children:e,isPresent:i,anchorX:o,anchorY:s,root:n,pop:l}){let u=(0,r.useId)(),h=(0,r.useRef)(null),x=(0,r.useRef)({width:0,height:0,top:0,left:0,right:0,bottom:0}),{nonce:f}=(0,r.useContext)(c.MotionConfigContext),b=function(...e){return a.useCallback(function(...e){return t=>{let a=!1,i=e.map(e=>{let i=d(e,t);return a||"function"!=typeof i||(a=!0),i});if(a)return()=>{for(let t=0;t<i.length;t++){let a=i[t];"function"==typeof a?a():d(e[t],null)}}}}(...e),e)}(h,e.props?.ref??e?.ref);return(0,r.useInsertionEffect)(()=>{let{width:e,height:t,top:a,left:r,right:c,bottom:d}=x.current;if(i||!1===l||!h.current||!e||!t)return;let m="left"===o?`left: ${r}`:`right: ${c}`,p="bottom"===s?`bottom: ${d}`:`top: ${a}`;h.current.dataset.motionPopId=u;let b=document.createElement("style");f&&(b.nonce=f);let y=n??document.head;return y.appendChild(b),b.sheet&&b.sheet.insertRule(`
          [data-motion-pop-id="${u}"] {
            position: absolute !important;
            width: ${e}px !important;
            height: ${t}px !important;
            ${m}px !important;
            ${p}px !important;
          }
        `),()=>{h.current?.removeAttribute("data-motion-pop-id"),y.contains(b)&&y.removeChild(b)}},[i]),(0,t.jsx)(m,{isPresent:i,childRef:h,sizeRef:x,pop:l,children:!1===l?e:r.cloneElement(e,{ref:b})})}let u=({children:e,initial:i,isPresent:s,onExitComplete:l,custom:r,presenceAffectsLayout:c,mode:d,anchorX:m,anchorY:u,root:x})=>{let f=(0,o.useConstant)(h),b=(0,a.useId)(),y=!0,g=(0,a.useMemo)(()=>(y=!1,{id:b,initial:i,isPresent:s,custom:r,onExitComplete:e=>{for(let t of(f.set(e,!0),f.values()))if(!t)return;l&&l()},register:e=>(f.set(e,!1),()=>f.delete(e))}),[s,f,l]);return c&&y&&(g={...g}),(0,a.useMemo)(()=>{f.forEach((e,t)=>f.set(t,!1))},[s]),a.useEffect(()=>{s||f.size||!l||l()},[s]),e=(0,t.jsx)(p,{pop:"popLayout"===d,isPresent:s,anchorX:m,anchorY:u,root:x,children:e}),(0,t.jsx)(n.PresenceContext.Provider,{value:g,children:e})};function h(){return new Map}var x=e.i(464978);let f=e=>e.key||"";function b(e){let t=[];return a.Children.forEach(e,e=>{(0,a.isValidElement)(e)&&t.push(e)}),t}e.s(["AnimatePresence",0,({children:e,custom:n,initial:l=!0,onExitComplete:r,presenceAffectsLayout:c=!0,mode:d="sync",propagate:m=!1,anchorX:p="left",anchorY:h="top",root:y})=>{let[g,w]=(0,x.usePresence)(m),v=(0,a.useMemo)(()=>b(e),[e]),j=m&&!g?[]:v.map(f),N=(0,a.useRef)(!0),F=(0,a.useRef)(v),_=(0,o.useConstant)(()=>new Map),E=(0,a.useRef)(new Set),[k,C]=(0,a.useState)(v),[B,A]=(0,a.useState)(v);(0,s.useIsomorphicLayoutEffect)(()=>{N.current=!1,F.current=v;for(let e=0;e<B.length;e++){let t=f(B[e]);j.includes(t)?(_.delete(t),E.current.delete(t)):!0!==_.get(t)&&_.set(t,!1)}},[B,j.length,j.join("-")]);let P=[];if(v!==k){let e=[...v];for(let t=0;t<B.length;t++){let a=B[t],i=f(a);j.includes(i)||(e.splice(t,0,a),P.push(a))}return"wait"===d&&P.length&&(e=P),A(b(e)),C(v),null}let{forceRender:S}=(0,a.useContext)(i.LayoutGroupContext);return(0,t.jsx)(t.Fragment,{children:B.map(e=>{let a=f(e),i=(!m||!!g)&&(v===B||j.includes(a));return(0,t.jsx)(u,{isPresent:i,initial:(!N.current||!!l)&&void 0,custom:n,presenceAffectsLayout:c,mode:d,root:y,onExitComplete:i?void 0:()=>{if(E.current.has(a)||!_.has(a))return;E.current.add(a),_.set(a,!0);let e=!0;_.forEach(t=>{t||(e=!1)}),e&&(S?.(),A(F.current),m&&w?.(),r&&r())},anchorX:p,anchorY:h,children:e},a)})})}],88653)},233401,e=>{"use strict";let t=["utm_source","utm_medium","utm_campaign","utm_term","utm_content","utm_id","gclid","gad_source","gbraid","wbraid","dclid","gclsrc","campaignid","adgroupid","adid","creative","keyword","placement","targetid","device","devicemodel","matchtype","network","fbclid","msclkid","ad_id","adset_id","campaign_id","ad_name","adset_name","campaign_name","ad creative","placement","position","site_source_name","extra_targeting_data","social_click_id","ttclid","ttclid_tt","ad_id","campaign_id","adgroup_id","ad_name","adgroup_name","campaign_name","creative_id","placement","bid_type","site_source_name","social_click_id","pbo","content_id","ref","source","channel","offer","aff_id","subid","subid1","subid2","subid3","transaction_id","click_id","cid","oid","click_time","lpurl"],a=()=>{let e=localStorage.getItem("utm_data");return e?JSON.parse(e):null};e.s(["getStoredUtmParams",0,a,"getUtmQueryString",0,()=>{let e=a();if(!e)return"";let t=new URLSearchParams;return Object.entries(e).forEach(([e,a])=>{a&&t.append(e,String(a))}),t.toString()},"storeUtmParams",0,()=>{let e=new URLSearchParams(window.location.search),a={},i=!1;t.forEach(t=>{let o=e.get(t);o&&(a[t]=o,i=!0)}),i&&localStorage.setItem("utm_data",JSON.stringify({...a,landing_page:window.location.pathname,timestamp:new Date().toISOString()}))}])},871689,e=>{"use strict";let t=(0,e.i(475254).default)("arrow-left",[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]]);e.s(["ArrowLeft",0,t],871689)},694351,e=>{"use strict";let t=(0,e.i(475254).default)("house",[["path",{d:"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",key:"5wwlr5"}],["path",{d:"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",key:"r6nss1"}]]);e.s(["Home",0,t],694351)},329306,e=>{"use strict";var t=e.i(843476),a=e.i(846932),i=e.i(88653),o=e.i(694351),s=e.i(871689),n=e.i(558739),l=e.i(233401);e.s(["default",0,()=>{let{t:e}=(0,n.default)(),r=()=>{let e=(0,l.getUtmQueryString)(),t=window.location.pathname,a=t.startsWith("/es/")||t.startsWith("/en/")?t.split("/")[1]:"",i=e?`/${a?a+"/":""}?${e}`:`/${a?a+"/":""}`;window.location.href=i};return(0,t.jsxs)("div",{className:"relative w-full min-h-[100dvh] flex flex-col bg-white",children:[(0,t.jsx)("img",{src:"/_ext/assets/l3/Homepage-new-desktop.webp",alt:"Desktop Background",className:"fixed inset-0 w-full h-full object-cover z-0"}),(0,t.jsxs)("div",{className:"absolute inset-0 overflow-hidden pointer-events-none z-10",children:[(0,t.jsx)("img",{src:"/_ext/assets/l4/Bubble.svg",alt:"Floating Bubble",className:"absolute w-[80px] h-[80px] sm:w-[120px] sm:h-[120px] bubble-1 bubble-small sm:bubble-large"}),(0,t.jsx)("img",{src:"/_ext/assets/l4/Bubble.svg",alt:"Floating Bubble",className:"absolute w-[60px] h-[60px] sm:w-[90px] sm:h-[90px] bubble-2 bubble-medium sm:bubble-small"}),(0,t.jsx)("img",{src:"/_ext/assets/l4/Bubble.svg",alt:"Floating Bubble",className:"absolute w-[70px] h-[70px] sm:w-[100px] sm:h-[100px] bubble-3 bubble-large sm:bubble-medium"})]}),(0,t.jsx)("style",{children:`
                @keyframes floatBubble1 {
                    0% {
                        transform: translate(-20px, 100vh) rotate(0deg);
                        opacity: 0;
                    }
                    10% {
                        opacity: 0.8;
                    }
                    50% {
                        transform: translate(30px, 20vh) rotate(180deg);
                        opacity: 1;
                    }
                    90% {
                        opacity: 0.7;
                    }
                    100% {
                        transform: translate(80px, -20px) rotate(360deg);
                        opacity: 0;
                    }
                }
                @keyframes floatBubble2 {
                    0% {
                        transform: translate(100vw, 80vh) rotate(0deg) scale(0.8);
                        opacity: 0;
                    }
                    15% {
                        opacity: 0.8;
                    }
                    40% {
                        transform: translate(20vw, 40vh) rotate(-90deg) scale(1.1);
                        opacity: 1;
                    }
                    70% {
                        transform: translate(-10vw, 10vh) rotate(-180deg) scale(0.9);
                        opacity: 0.8;
                    }
                    95% {
                        opacity: 0.4;
                    }
                    100% {
                        transform: translate(-50px, -20px) rotate(-270deg) scale(0.8);
                        opacity: 0;
                    }
                }
                @keyframes floatBubble3 {
                    0% {
                        transform: translate(50vw, 100vh) rotate(0deg) scale(1);
                        opacity: 0;
                    }
                    20% {
                        opacity: 0.9;
                    }
                    35% {
                        transform: translate(70vw, 60vh) rotate(45deg) scale(1.2);
                        opacity: 1;
                    }
                    65% {
                        transform: translate(90vw, 30vh) rotate(135deg) scale(0.9);
                        opacity: 0.7;
                    }
                    85% {
                        transform: translate(110vw, 10vh) rotate(225deg) scale(1.1);
                        opacity: 0.5;
                    }
                    100% {
                        transform: translate(120vw, -20px) rotate(360deg) scale(1);
                        opacity: 0;
                    }
                }
                @keyframes moderateBounce {
                    0%, 100% {
                        transform: translateY(0);
                    }
                    50% {
                        transform: translateY(-10px);
                    }
                }
                .bubble-1 {
                    animation: floatBubble1 8s ease-in-out infinite;
                    animation-delay: 0s;
                }
                .bubble-2 {
                    animation: floatBubble2 10s ease-in-out infinite;
                    animation-delay: 2s;
                }
                .bubble-3 {
                    animation: floatBubble3 12s ease-in-out infinite;
                    animation-delay: 4s;
                }
                .moderate-bounce {
                    animation: moderateBounce 3s ease-in-out infinite;
                }
            `}),(0,t.jsxs)("div",{className:"relative z-10 flex flex-col flex-1 px-4",children:[(0,t.jsxs)("div",{className:"hidden lg:flex min-h-screen items-center justify-center px-12 max-w-6xl mx-auto w-full",children:[(0,t.jsx)("div",{className:"flex-1 flex justify-center items-center",children:(0,t.jsx)("div",{className:"relative",children:(0,t.jsx)(i.AnimatePresence,{mode:"wait",children:(0,t.jsx)(a.motion.div,{initial:{opacity:0,y:80,scale:.8},animate:{opacity:1,y:0,scale:1},exit:{opacity:0,y:50,scale:.9},transition:{duration:1,ease:[.22,1,.36,1],delay:.4},children:(0,t.jsx)("img",{src:"/_ext/assets/l3/memorae_ultra.webp",alt:e("notFound.logoAlt"),className:"w-[400px] h-[400px] object-contain drop-shadow-2xl moderate-bounce"})},"notfound-character-desktop")})})}),(0,t.jsx)("div",{className:"flex-1 flex justify-center items-center",children:(0,t.jsxs)("div",{className:"w-96",children:[(0,t.jsxs)("div",{className:"bg-[#F3F3FE] rounded-2xl p-6 mb-6 shadow-lg relative",children:[(0,t.jsxs)("div",{className:"flex items-center gap-2 mb-4 w-fit bg-[#557BF4]/10 px-3 py-1 rounded-lg",children:[(0,t.jsx)("img",{src:"/_ext/assets/l4/MemoraeLogo.svg",alt:"Memorae Logo",className:"w-5 h-5"}),(0,t.jsx)("span",{className:"text-[#557BF4] text-sm font-semibold",children:"Memorae"})]}),(0,t.jsxs)("div",{className:"text-center",children:[(0,t.jsx)(a.motion.h1,{initial:{scale:.5,opacity:0},animate:{scale:1,opacity:1},transition:{duration:.5,ease:"easeOut"},className:"text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#9333EA] to-[#EC4899] mb-4",children:"404"}),(0,t.jsx)(a.motion.h2,{initial:{y:-20,opacity:0},animate:{y:0,opacity:1},transition:{delay:.2},className:"text-2xl font-semibold text-[#1F2937] mb-4",children:e("notFound.title")}),(0,t.jsx)(a.motion.p,{initial:{y:-20,opacity:0},animate:{y:0,opacity:1},transition:{delay:.3},className:"text-lg text-[#1F2937] mb-6",children:e("notFound.description")})]}),(0,t.jsx)("div",{className:"absolute top-6 -left-4 w-0 h-0 border-t-[15px] border-t-transparent border-r-[20px] border-r-[#F3F3FE] border-b-[15px] border-b-transparent"})]}),(0,t.jsxs)("div",{className:"w-full flex flex-col gap-4",children:[(0,t.jsxs)(a.motion.button,{initial:{y:20,opacity:0},animate:{y:0,opacity:1},transition:{delay:.4},onClick:r,className:"w-full inline-flex items-center justify-center bg-gradient-to-r from-[#9333EA] to-[#EC4899] text-white px-8 py-4 rounded-full font-semibold shadow-lg transition-all hover:scale-105 hover:shadow-xl",whileHover:{scale:1.05},whileTap:{scale:.95},children:[(0,t.jsx)(o.Home,{className:"w-5 h-5 mr-2"}),e("notFound.backToHome")]}),(0,t.jsxs)(a.motion.button,{initial:{y:20,opacity:0},animate:{y:0,opacity:1},transition:{delay:.5},onClick:()=>window.history.back(),className:"w-full inline-flex items-center justify-center bg-white text-[#1F2937] px-8 py-4 rounded-full font-semibold shadow-lg transition-all hover:scale-105 hover:shadow-xl border border-gray-200",whileHover:{scale:1.05},whileTap:{scale:.95},children:[(0,t.jsx)(s.ArrowLeft,{className:"w-5 h-5 mr-2"}),e("notFound.goBack")]})]}),(0,t.jsxs)(a.motion.div,{initial:{opacity:0},animate:{opacity:1},transition:{delay:.6},className:"mt-6 text-center text-sm text-[#1F2937]",children:[(0,t.jsx)("p",{children:e("notFound.needHelp")}),(0,t.jsx)("a",{href:`mailto:${e("notFound.supportEmail")}`,className:"text-[#9333EA] hover:text-[#EC4899] transition-colors",children:e("notFound.supportEmail")})]})]})})]}),(0,t.jsxs)("div",{className:"lg:hidden flex flex-col flex-1 items-center justify-center py-8",children:[(0,t.jsx)("div",{className:"w-full max-w-[500px] mx-auto mb-6 md:max-w-[350px]",children:(0,t.jsxs)("div",{className:"bg-[#F3F3FE] rounded-2xl p-4 shadow-lg relative mx-4",children:[(0,t.jsxs)("div",{className:"flex items-center gap-2 mb-3 w-fit bg-[#557BF4]/10 px-3 py-1 rounded-lg",children:[(0,t.jsx)("img",{src:"/_ext/assets/l4/MemoraeLogo.svg",alt:"Memorae Logo",className:"w-5 h-5"}),(0,t.jsx)("span",{className:"text-[#557BF4] text-sm font-semibold",children:"Memorae"})]}),(0,t.jsxs)("div",{className:"text-center",children:[(0,t.jsx)(a.motion.h1,{initial:{scale:.5,opacity:0},animate:{scale:1,opacity:1},transition:{duration:.5,ease:"easeOut"},className:"text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#9333EA] to-[#EC4899] mb-3",children:"404"}),(0,t.jsx)(a.motion.h2,{initial:{y:-20,opacity:0},animate:{y:0,opacity:1},transition:{delay:.2},className:"text-xl font-semibold text-[#1F2937] mb-3",children:e("notFound.title")}),(0,t.jsx)(a.motion.p,{initial:{y:-20,opacity:0},animate:{y:0,opacity:1},transition:{delay:.3},className:"text-base text-[#1F2937] mb-4",children:e("notFound.description")})]}),(0,t.jsx)("div",{className:"absolute left-1/2 transform -translate-x-1/2 -bottom-3 w-0 h-0  border-l-[10px] border-l-transparent  border-r-[10px] border-r-transparent  border-t-[12px] border-t-[#F3F3FE]"})]})}),(0,t.jsx)("div",{className:"w-full mx-auto flex justify-center mb-6",children:(0,t.jsx)(i.AnimatePresence,{mode:"wait",children:(0,t.jsx)(a.motion.img,{src:"/_ext/assets/l3/memorae_ultra.webp",alt:e("notFound.logoAlt"),initial:{opacity:0,y:80,scale:.8},animate:{opacity:1,y:0,scale:1},exit:{opacity:0,y:50,scale:.7},transition:{duration:1,ease:[.22,1,.36,1],delay:.4},className:"w-48 h-48 sm:w-64 sm:h-64 md:w-[280px] md:h-[280px] object-contain drop-shadow-2xl moderate-bounce"},"notfound-character-mobile")})}),(0,t.jsxs)("div",{className:"w-full flex flex-col gap-3 px-4 pb-6",children:[(0,t.jsxs)(a.motion.button,{initial:{y:20,opacity:0},animate:{y:0,opacity:1},transition:{delay:.4},onClick:r,className:"w-full inline-flex items-center justify-center bg-gradient-to-r from-[#9333EA] to-[#EC4899] text-white px-6 py-3 rounded-full font-semibold shadow-lg transition-all hover:scale-105 hover:shadow-xl",whileHover:{scale:1.05},whileTap:{scale:.95},children:[(0,t.jsx)(o.Home,{className:"w-4 h-4 mr-2"}),e("notFound.backToHome")]}),(0,t.jsxs)(a.motion.button,{initial:{y:20,opacity:0},animate:{y:0,opacity:1},transition:{delay:.5},onClick:()=>window.history.back(),className:"w-full inline-flex items-center justify-center bg-white text-[#1F2937] px-6 py-3 rounded-full font-semibold shadow-lg transition-all hover:scale-105 hover:shadow-xl border border-gray-200",whileHover:{scale:1.05},whileTap:{scale:.95},children:[(0,t.jsx)(s.ArrowLeft,{className:"w-4 h-4 mr-2"}),e("notFound.goBack")]})]}),(0,t.jsxs)(a.motion.div,{initial:{opacity:0},animate:{opacity:1},transition:{delay:.6},className:"text-center text-sm text-[#1F2937] px-4",children:[(0,t.jsx)("p",{children:e("notFound.needHelp")}),(0,t.jsx)("a",{href:`mailto:${e("notFound.supportEmail")}`,className:"text-[#9333EA] hover:text-[#EC4899] transition-colors",children:e("notFound.supportEmail")})]})]})]})]})}])}]);