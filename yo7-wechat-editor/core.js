/* Original implementation. No remote code, tracking or API calls. */
(function (scope) {
  'use strict';
  const HTML = new Set('section article div p span h1 h2 h3 h4 h5 h6 strong b em i u s del br hr blockquote pre code ul ol li table thead tbody tfoot tr td th a img figure figcaption sup sub ruby rt rp'.split(' '));
  const SVG = new Set('svg g path rect circle ellipse line polyline polygon text tspan defs clipPath mask linearGradient radialGradient stop pattern title desc use animate animateTransform set'.toLowerCase().split(' '));
  const DROP = new Set('script style iframe frame frameset object embed video audio source link meta base form input button textarea select option template noscript foreignobject annotation-xml'.split(' '));
  const CSS = new Set('color background background-color font-family font-size font-weight font-style font-variant line-height letter-spacing word-spacing text-align text-indent text-decoration text-transform white-space word-break overflow-wrap display width min-width max-width height min-height max-height margin margin-top margin-right margin-bottom margin-left padding padding-top padding-right padding-bottom padding-left border border-top border-right border-bottom border-left border-color border-width border-style border-radius box-sizing overflow overflow-x overflow-y vertical-align opacity fill stroke stroke-width'.split(' '));
  const ATTR = new Set('viewbox preserveaspectratio x y x1 x2 y1 y2 cx cy r rx ry width height d points fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset pathlength opacity transform font-family font-size font-weight font-style text-anchor dominant-baseline alignment-baseline dx dy rotate textlength lengthadjust clippathunits maskunits maskcontentunits patternunits patterncontentunits patterntransform gradientunits gradienttransform offset stop-color stop-opacity'.split(' '));
  const ANIM = new Set('opacity fill-opacity stroke-opacity stroke-dasharray stroke-dashoffset transform x y x1 x2 y1 y2 cx cy r rx ry width height d fill stroke'.split(' '));
  const MAP = {viewbox:'viewBox',preserveaspectratio:'preserveAspectRatio',pathlength:'pathLength',clippathunits:'clipPathUnits',maskunits:'maskUnits',maskcontentunits:'maskContentUnits',patternunits:'patternUnits',patterncontentunits:'patternContentUnits',patterntransform:'patternTransform',gradientunits:'gradientUnits',gradienttransform:'gradientTransform',textlength:'textLength',lengthadjust:'lengthAdjust'};
  let sequence = 0;
  function safeURL(value, image=false) {
    const s = value.trim();
    if (/^https:\/\//i.test(s)) return s;
    if (!image && /^#[\w:.-]+$/.test(s)) return s;
    if (image && /^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(s)) return s;
    return '';
  }
  function cleanStyle(value, issues) {
    const out=[];
    for (const part of value.split(';')) {
      const idx=part.indexOf(':'); if(idx<0)continue;
      const key=part.slice(0,idx).trim().toLowerCase(), val=part.slice(idx+1).trim();
      if (!CSS.has(key) || !val || /url\s*\(|expression|javascript|@|\\|[<>]|behavior|binding|!important/i.test(val)) {issues.push('移除样式 '+key);continue;}
      out.push(key+':'+val);
    }
    return out.join(';');
  }
  function sanitize(source, doc) {
    if (typeof source !== 'string' || source.length > 3_000_000) throw new Error('HTML 超过 3MB，或格式不是文本。请分块导入。');
    const parsed=new (doc.defaultView?.DOMParser || DOMParser)().parseFromString(source, 'text/html');
    const holder=doc.createElement('div'), issues=[], idMap=new Map(), prefix='yo7i'+(++sequence)+'x'+Date.now().toString(36)+'x';
    if(parsed.head.querySelector('style,link'))issues.push('移除文档级样式；请把所需样式写成内联 style');
    const originalIds=[...parsed.body.querySelectorAll('[id]')].map(e=>e.id);
    if(new Set(originalIds).size!==originalIds.length)throw new Error('HTML 中有重复 ID，可能破坏 SVG 或脚注。请先修复源文件。');
    parsed.body.querySelectorAll('[id]').forEach((e,i)=>idMap.set(e.id,prefix+i));
    function walk(node, parent, inSvg=false) {
      if(node.nodeType===3){parent.appendChild(doc.createTextNode(node.nodeValue));return;}
      if(node.nodeType!==1)return;
      const tag=node.localName.toLowerCase(), svg=inSvg||tag==='svg';
      if(DROP.has(tag)){issues.push('移除标签 '+tag);return;}
      if(!(svg?SVG:HTML).has(tag)){issues.push('展开不支持标签 '+tag);for(const c of node.childNodes)walk(c,parent,inSvg);return;}
      if(['animate','animatetransform','set'].includes(tag)) {
        const attr=node.getAttribute('attributeName');
        if((tag!=='animatetransform'&&!ANIM.has(attr)) || (tag==='animatetransform'&&attr!=='transform')){issues.push('移除不安全动画');return;}
      }
      const actual={clippath:'clipPath',lineargradient:'linearGradient',radialgradient:'radialGradient',animatetransform:'animateTransform'}[tag]||tag;
      const e=svg?doc.createElementNS('http://www.w3.org/2000/svg',actual):doc.createElement(actual);
      for(const a of node.attributes){
        const n=a.name.toLowerCase(),v=a.value;
        if(/^on/.test(n)){issues.push('移除事件属性 '+n);continue;}
        if(n==='style'){const s=cleanStyle(v,issues);if(s)e.setAttribute('style',s);continue;}
        if(n==='id'){e.id=idMap.get(v);continue;}
        if(n==='data-yo7-id' && /^[a-z0-9][a-z0-9_.:-]{0,100}$/i.test(v)){e.setAttribute(n,v);continue;}
        if(['data-presentation','data-motion-role','data-yo7-source','data-yo7-type'].includes(n)){e.setAttribute(n,v.slice(0,200));continue;}
        if(['aria-label','aria-hidden','role','title','alt','lang','dir'].includes(n)){e.setAttribute(n,v);continue;}
        if(n==='href'||n==='xlink:href'||n==='src'){
          let url='';
          if(svg && n!=='src' && /^#[\w:.-]+$/.test(v) && idMap.has(v.slice(1)))url='#'+idMap.get(v.slice(1));
          if(!svg && tag==='a'&&n==='href')url=v.startsWith('#')&&idMap.has(v.slice(1))?'#'+idMap.get(v.slice(1)):safeURL(v);
          if(!svg && tag==='img'&&n==='src')url=safeURL(v,true);
          if(url)e.setAttribute(n==='xlink:href'?'href':n,url);else issues.push('移除不支持的资源地址');
          continue;
        }
        if(svg && ['clip-path','mask','filter'].includes(n)){
          const match=v.match(/^url\(#([\w:.-]+)\)$/);if(match&&idMap.has(match[1]))e.setAttribute(n,'url(#'+idMap.get(match[1])+')');else issues.push('移除外部 SVG 引用');continue;
        }
        if(svg&&ATTR.has(n)&&!/[<>]|javascript:|url\s*\(|\\/i.test(v)){e.setAttribute(MAP[n]||n,v);continue;}
        if(svg&&['animate','animatetransform','set'].includes(tag)){
          const names={attributename:'attributeName',attributetype:'attributeType',repeatcount:'repeatCount',repeatdur:'repeatDur',keytimes:'keyTimes',keysplines:'keySplines',calcmode:'calcMode'};
          if(n==='begin'){
            const times=v.split(';').map(x=>x.trim());let valid=true;
            const fixed=times.map(x=>{if(/^\d+(\.\d+)?m?s$/.test(x))return x;const m=x.match(/^([\w:.-]+)\.click(\+\d+(?:\.\d+)?s)?$/);if(m&&idMap.has(m[1]))return idMap.get(m[1])+'.click'+(m[2]||'');valid=false;return '';});
            if(valid)e.setAttribute('begin',fixed.join(';'));else issues.push('移除不支持的动画触发');continue;
          }
          if(['attributename','attributetype','type','values','from','to','by','dur','end','repeatcount','repeatdur','keytimes','keysplines','calcmode','fill','additive','accumulate','restart'].includes(n)&&!/[<>]|url\s*\(|javascript|\\/i.test(v)){e.setAttribute(names[n]||n,v);continue;}
        }
        if(!svg&&['width','height','colspan','rowspan','start','value'].includes(n)&&/^\d{1,6}%?$/.test(v))e.setAttribute(n,v);
        else if(n!=='xmlns')issues.push('移除属性 '+n);
      }
      if(tag==='a'){e.setAttribute('rel','noopener noreferrer');}
      if(tag==='img'&&!e.getAttribute('src')){issues.push('图片地址不可用，保留替代文字');const span=doc.createElement('span');span.textContent='[缺图：'+(node.getAttribute('alt')||'未填写说明')+']';parent.appendChild(span);return;}
      for(const c of node.childNodes)walk(c,e,svg);
      parent.appendChild(e);
    }
    for(const n of parsed.body.childNodes)walk(n,holder);
    const media=[...holder.querySelectorAll('img')].map(i=>({src:i.getAttribute('src').slice(0,160),alt:i.getAttribute('alt')||''}));
    return {html:holder.innerHTML,text:holder.textContent,issues:[...new Set(issues)],images:media.length,remoteImages:media.filter(x=>/^https?:/.test(x.src)).length,animations:holder.querySelectorAll('animate,animateTransform,set').length,blocks:holder.querySelectorAll('[data-yo7-id]').length};
  }
  function statistics(root){return {text:root.textContent.replace(/\s+/g,' ').trim(),textLength:root.textContent.replace(/\s/g,'').length,images:root.querySelectorAll('img').length,svg:root.querySelectorAll('svg').length,animations:root.querySelectorAll('animate,animateTransform,set').length,blockIds:[...root.querySelectorAll('[data-yo7-id]')].map(e=>e.getAttribute('data-yo7-id'))};}
  scope.Yo7Core={sanitize,safeURL,cleanStyle,statistics};
})(globalThis);
