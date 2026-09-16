// Targeted: only media/font hosts. Never w3.org / react.dev / schema.org,
// whose URLs are XML namespaces that must stay byte-exact.
const fs=require('fs'), path=require('path');
const DIST='/home/user/zoorzio-mainweb/site/dist';
const HOSTS=['cdn.memorae.ai','static.memorae.ai','fonts.gstatic.com','fonts.googleapis.com'];
function walk(d,o=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);e.isDirectory()?walk(p,o):o.push(p);}return o;}
let n=0, hits=0;
for(const f of walk(DIST).filter(f=>/\.(js|css|html)$/.test(f))){
  let s=fs.readFileSync(f,'utf8'), before=s;
  for(const h of HOSTS){
    const local=`/_ext/${h}`;
    s=s.split(`https://${h}`).join(local);
    s=s.split(`https:\\/\\/${h}`).join(local);
    s=s.split(`https:\\u002F\\u002F${h}`).join(local);
  }
  if(s!==before){ fs.writeFileSync(f,s,'utf8'); n++; hits+=(before.length-s.length); }
}
console.log('rewrote asset hosts in',n,'files');
// sanity: namespaces must be untouched
let bad=0;
for(const f of walk(DIST).filter(f=>/\.js$/.test(f))){
  const s=fs.readFileSync(f,'utf8');
  if(s.includes('/_ext/www.w3.org')||s.includes('/_ext/react.dev')) bad++;
}
console.log('files with corrupted namespaces:',bad);
