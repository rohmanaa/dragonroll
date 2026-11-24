/* Jembatan navigasi ke shell Dragon Roll (SPA / iframe). Event dari tambang-ui.js. */
(function(){function go(e){var u=e.detail&&e.detail.url;if(!u)return;e.preventDefault();
 var S=(window.UT&&UT.Spa)||(window.parent!==window&&window.parent.UT&&window.parent.UT.Spa);
 if(S&&S.go)S.go(u);else location.href=u;}
 ['back','home','shop'].forEach(function(n){window.addEventListener('tambang:'+n,go);});})();
