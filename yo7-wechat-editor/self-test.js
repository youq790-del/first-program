(function(){
const results=[],assert=(v,m)=>{if(!v)throw Error(m);},root=document.querySelector('article'),before=root.innerHTML;
function test(name,fn){try{fn();results.push('✓ '+name);}catch(e){results.push('✗ '+name+'：'+e.message);}}
test('清理可执行 HTML 与事件',()=>{const r=Yo7Core.sanitize('<script>alert(1)</script><p onclick="x()">保留</p>',document);assert(!/script|onclick/.test(r.html),'危险内容未移除');assert(r.text==='保留','原文丢失');});
test('脚注锚点与目标一致',()=>{const r=Yo7Core.sanitize('<p id="n">说明</p><a href="#n">注</a>',document),e=document.createElement('div');e.innerHTML=r.html;assert(e.querySelector('a').getAttribute('href')==='#'+e.querySelector('p').id,'引用未同步');});
const editor=new Yo7Editor.Editor(document);editor.choose(root);
test('插入后可精确撤销',()=>{editor.insert('<p>新增内容</p>','append');assert(root.textContent.includes('新增内容'),'插入未生效');editor.undo();assert(root.innerHTML===before,'撤销不一致');});
test('只替换选中块',()=>{const range=document.createRange();range.selectNodeContents(root.querySelector('p'));range.collapse(false);editor.range=range;const sibling=root.children[1].outerHTML;editor.replaceBlock('<section data-yo7-id="test-first"><p>修改的第一段。</p></section>');assert(root.children[1].outerHTML===sibling,'其他块发生变化');editor.undo();});
test('后续手工修改不会被撤销覆盖',()=>{editor.insert('<p>新内容</p>','append');root.lastElementChild.append('手工补充');const now=root.innerHTML;let stopped=false;try{editor.undo();}catch{stopped=true;}assert(stopped&&root.innerHTML===now,'没有保留后续修改');});
root.innerHTML=before;document.getElementById('result').textContent=results.join('\n')+'\n\n这只是本地页面行为测试，不代表微信保存或手机验证通过。';
})();
