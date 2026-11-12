/* Shared, app-only Ranked Hub welcome banner. Runs on verified MW4 and ARC origins. */
(function(){
  'use strict';
  var config=window.__rankedHubWelcomeConfig;
  if(!config||(config.site!=='dmz-v1'&&config.site!=='arc-raiders'))return;
  var existing=window.__rankedHubWelcome;
  if(existing&&existing.site===config.site){
    existing.refresh();
    return;
  }
  if(existing&&existing.destroy)existing.destroy();
  var id='ranked-hub-welcome-banner';
  var destroyed=false;
  var observer=null;
  var queued=false;
  var welcomeNode=null;
  var logoNode=null;
  var lastName=null;
  var timer=null;

  function ownName(){
    var text='';
    if(config.site==='dmz-v1'){
      // Prefer site-account state when available; the HUD uses the local operator callsign.
      var signed=document.querySelector('.hs-pin-cover-state');
      if(signed&&/\\bSigned in\\b/i.test(signed.textContent||'')){
        text=(signed.textContent||'').split(' · ')[0];
      }
      if(!text){
        var identity=document.querySelector('.top-hud .hud-identity > span');
        if(identity){
          for(var i=0;i<identity.childNodes.length;i++){
            var node=identity.childNodes[i];
            if(node.nodeType===3){text=(node.textContent||'').trim();if(text)break;}
          }
        }
      }
      if(/^(SELECT OPERATOR|OPERATOR|GUEST)$/i.test(text))text='';
    }else{
      // The identity element exists only when the Raider account is signed in.
      var signedRaider=document.querySelector('.my-standing-identity .my-standing-name');
      if(signedRaider)text=(signedRaider.textContent||'').trim();
    }
    return text.replace(/\\s+/g,' ').replace(/[.!]+$/,'').trim().slice(0,40);
  }
  function makeNode(tag,klass,content){
    var el=document.createElement(tag);
    el.className=klass;
    if(content!==undefined)el.textContent=content;
    return el;
  }
  function makeBanner(){
    var banner=document.getElementById(id);
    if(banner)return banner;
    banner=makeNode('section','ranked-hub-app-welcome');
    banner.id=id;
    banner.setAttribute('role','note');
    banner.setAttribute('aria-label',"Harley's Studios Ranked Hub Beta app welcome");
    welcomeNode=makeNode('div','dmz-hs-welcome');
    banner.appendChild(welcomeNode);
    var thanks=makeNode('div','dmz-hs-thanks');
    thanks.appendChild(document.createTextNode('Thank you for using '));
    thanks.appendChild(makeNode('span','dmz-hs-name',"Harley's Studios"));
    banner.appendChild(thanks);
    var line=makeNode('div','dmz-hs-app-line');
    logoNode=makeNode('img','dmz-hs-app-logo');
    logoNode.alt='Ranked Hub app logo';
    if(config.logo)logoNode.src=config.logo;
    line.appendChild(logoNode);
    line.appendChild(makeNode('span','dmz-hs-app-title','Ranked Hub'));
    line.appendChild(makeNode('span','dmz-hs-app-beta','BETA'));
    banner.appendChild(line);
    banner.appendChild(makeNode('div','dmz-hs-note',
      'App-only display override — this does not modify or affect the dmzranked.com website.'));
    return banner;
  }
  function refresh(){
    if(destroyed||!document.body)return;
    var banner=makeBanner();
    if(!banner.isConnected||banner.parentNode!==document.body){
      document.body.insertBefore(banner,document.body.firstChild);
    }
    if(!welcomeNode)welcomeNode=banner.querySelector('.dmz-hs-welcome');
    var name=ownName();
    if(name!==lastName&&welcomeNode){
      lastName=name;
      while(welcomeNode.firstChild)welcomeNode.removeChild(welcomeNode.firstChild);
      if(name){
        welcomeNode.appendChild(document.createTextNode('Welcome back, '));
        welcomeNode.appendChild(makeNode('span','dmz-hs-name',name));
        welcomeNode.appendChild(document.createTextNode('!'));
      }else{
        welcomeNode.textContent='Welcome, Guest!';
      }
    }
  }
  function schedule(){
    if(queued||destroyed)return;
    queued=true;
    timer=setTimeout(function(){queued=false;refresh();},250);
  }
  function destroy(){
    destroyed=true;
    clearTimeout(timer);
    if(observer)observer.disconnect();
    window.removeEventListener('hashchange',schedule);
    window.removeEventListener('focus',schedule);
    var banner=document.getElementById(id);
    if(banner)banner.remove();
    if(window.__rankedHubWelcome&&window.__rankedHubWelcome.destroy===destroy)
      delete window.__rankedHubWelcome;
  }
  window.__rankedHubWelcome={site:config.site,refresh:refresh,destroy:destroy};
  observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  window.addEventListener('hashchange',schedule);
  window.addEventListener('focus',schedule);
  refresh();
})();
