(function(){
"use strict";
const SERVER="Fintables";
const $=id=>document.getElementById(id);
/* hesaba bağlı kalıcı kayıt durumu (bkz. 10a-kalici-kayit) */
const CLOUD={ref:null,ready:false,dirty:false,timer:null};
const S={code:null, mcp:null, sample:null, data:{}, charts:null, turns:[]};

