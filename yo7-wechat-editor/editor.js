(function(scope){
  'use strict';
  function documents(doc,depth=0){const result=[doc];if(depth>3)return result;for(const f of doc.querySelectorAll('iframe'))try{if(f.contentDocument?.body)result.push(...documents(f.contentDocument,depth+1));}catch{}return result;}
  function candidates(doc){
    const found=[];
    for(const d of documents(doc))for(const e of d.querySelectorAll('[contenteditable="true"],body[contenteditable], [role="textbox"][contenteditable]')){
      if(e.closest('[data-yo7-panel]')||e.parentElement?.closest('[contenteditable="true"]'))continue;
      if(e.getAttribute('aria-hidden')==='true'||e.hidden||!['true',''].includes(e.getAttribute('contenteditable')))continue;
      const box=e.getBoundingClientRect();if(box.width<100||box.height<40)continue;
      found.push(e);
    }
    return [...new Set(found)];
  }
  function within(range,root){return !!range&&root.isConnected&&root.contains(range.startContainer)&&root.contains(range.endContainer);}
  class Editor {
    constructor(doc){this.doc=doc;this.root=null;this.range=null;this.history=[];this.listeners=new Map();this.capture();}
    capture(){for(const d of documents(this.doc)){if(this.listeners.has(d))continue;const fn=()=>{const s=d.getSelection();if(s?.rangeCount&&this.root&&within(s.getRangeAt(0),this.root))this.range=s.getRangeAt(0).cloneRange();};d.addEventListener('selectionchange',fn);d.addEventListener('pointerup',fn);d.addEventListener('keyup',fn);this.listeners.set(d,fn);}}
    choose(root){if(!candidates(this.doc).includes(root))throw new Error('正文区域已变化，请重新检测。');this.root=root;this.range=null;this.history=[];this.capture();}
    requireRoot(){if(!this.root?.isConnected)throw new Error('请先检测并确认正文区域。');if(!['true',''].includes(this.root.getAttribute('contenteditable')))throw new Error('该区域现在不可编辑。');return this.root;}
    selectedBlock(){const root=this.requireRoot();if(!within(this.range,root))throw new Error('请先在正文中选择要修改的块。');let e=this.range.commonAncestorContainer;e=e.nodeType===1?e:e.parentElement;const block=e.closest('[data-yo7-id]')||e.closest('p,h1,h2,h3,h4,blockquote,pre,figure,li');if(!block||block===root||!root.contains(block))throw new Error('选区跨越多个块；请将光标放在一个段落或图块内。');if(!block.contains(this.range.startContainer)||!block.contains(this.range.endContainer))throw new Error('选区跨越多个块，请缩小选区。');return block;}
    change(label,fn){const root=this.requireRoot(),before=root.innerHTML;try{fn(root);}catch(e){if(root.innerHTML!==before)root.innerHTML=before;throw e;}const after=root.innerHTML;if(before===after)throw new Error('正文没有发生变化。');this.history.push({label,before,after});if(this.history.length>12)this.history.shift();root.dispatchEvent(new root.ownerDocument.defaultView.InputEvent('input',{bubbles:true,inputType:'insertReplacementText'}));return {label,before,after};}
    insert(html,mode='cursor'){
      const root=this.requireRoot();let range;
      if(mode==='append'){range=root.ownerDocument.createRange();range.selectNodeContents(root);range.collapse(false);}
      else{if(!within(this.range,root))throw new Error('插入位置已失效，请在正文中重新放置光标，或选择文末追加。');range=this.range.cloneRange();range.collapse(false);}
      return this.change(mode==='append'?'文末追加':'光标后插入',()=>{
        const view=root.ownerDocument.defaultView;const event=new view.InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'insertFromPaste',data:null});if(!root.dispatchEvent(event))throw new Error('公众号编辑器拒绝了此次插入，请使用富文本复制。');
        root.focus();const sel=root.ownerDocument.getSelection();sel.removeAllRanges();sel.addRange(range);
        let native=false;try{native=root.ownerDocument.execCommand('insertHTML',false,html);}catch{}
        if(!native){const fragment=range.createContextualFragment(html),last=fragment.lastChild;range.insertNode(fragment);if(last){range.setStartAfter(last);range.collapse(true);sel.removeAllRanges();sel.addRange(range);}}
        this.range=sel.rangeCount?sel.getRangeAt(0).cloneRange():null;
      });
    }
    replaceBlock(html){const b=this.selectedBlock();return this.change('替换所选块',()=>{const r=b.ownerDocument.createRange();r.selectNode(b);r.deleteContents();r.insertNode(r.createContextualFragment(html));this.range=null;});}
    styleBlock(style){const b=this.selectedBlock();if(b.closest('svg'))throw new Error('SVG 内部文字请在源稿中修改，避免破坏图形关系。');return this.change('修改所选块样式',()=>{for(const [key,value]of Object.entries(style))b.style.setProperty(key,value);});}
    undo(){const root=this.requireRoot(),last=this.history.at(-1);if(!last)throw new Error('没有可撤销的插件操作。');if(root.innerHTML!==last.after)throw new Error('此后正文已有其他修改。为保留新内容，未执行撤销；可导出备份后手动恢复。');root.innerHTML=last.before;this.history.pop();this.range=null;root.dispatchEvent(new root.ownerDocument.defaultView.InputEvent('input',{bubbles:true,inputType:'historyUndo'}));return last.label;}
    latestBackup(){return this.history.at(-1)?.before||null;}
  }
  scope.Yo7Editor={Editor,candidates,documents,within};
})(globalThis);
