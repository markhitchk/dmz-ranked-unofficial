(function(){
  try{
    if(window.__hsBetaQolInstalled){return 'already';}
    window.__hsBetaQolInstalled=true;

    function q(sel){try{return document.querySelector(sel);}catch(e){return null;}}
    function qa(sel){try{return Array.prototype.slice.call(document.querySelectorAll(sel));}catch(e){return [];}}
    function visible(el){if(!el)return false;var s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&el.getClientRects().length>0;}

    var top=document.createElement('button');
    top.id='hs-beta-back-top';
    top.type='button';
    top.setAttribute('aria-label','Back to top');
    top.setAttribute('title','Back to top');
    top.textContent='↑';
    top.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'});});
    (document.body||document.documentElement).appendChild(top);

    function updateTop(){
      var y=window.scrollY||document.documentElement.scrollTop||0;
      if(y>700)top.classList.add('hs-show'); else top.classList.remove('hs-show');
    }
    window.addEventListener('scroll',updateTop,{passive:true});
    updateTop();

    function centerActiveTab(){
      if(window.matchMedia&&window.matchMedia('(max-width:900px)').matches)return;
      var tabs=q('.tabs');
      if(!tabs)return;
      var active=q('.tabs .active,.tabs [aria-selected="true"],.tabs .selected,.tabs .current');
      if(active&&visible(active)){
        try{active.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});}catch(e){}
      }
    }
    document.addEventListener('click',function(ev){
      var t=ev.target&&ev.target.closest?ev.target.closest('.tabs button,.tabs a,.tabs [role="button"]'):null;
      if(t)setTimeout(centerActiveTab,80);
    },true);

    var observer=new MutationObserver(function(){centerActiveTab();});
    var tabs=q('.tabs');
    if(tabs)observer.observe(tabs,{subtree:true,attributes:true,attributeFilter:['class','aria-selected']});
    centerActiveTab();

    // Keep focused form controls visible above the keyboard and app chrome.
    document.addEventListener('focusin',function(ev){
      var el=ev.target;
      if(!el||!/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName))return;
      setTimeout(function(){try{el.scrollIntoView({behavior:'smooth',block:'center'});}catch(e){}},180);
    });

    return 'installed';
  }catch(e){return 'error:'+String(e&&e.message||e);}
})();