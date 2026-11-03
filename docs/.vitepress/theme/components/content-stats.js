import {reactive,onMounted,onUnmounted} from 'vue';
import {api} from './cms-client';
const state=reactive({data:null,loading:false,error:''});
let consumers=0,timer=null,pending=null,lastLoaded=0;
async function refresh(){
  if(pending)return pending;
  state.loading=true;
  pending=(async()=>{try{state.data=await api('/api/content-stats');state.error='';lastLoaded=Date.now();}catch{state.error='统计暂时不可用';}finally{state.loading=false;pending=null;}})();
  return pending;
}
function visible(){if(!document.hidden&&Date.now()-lastLoaded>10000)refresh();}
export function useContentStats(){
  onMounted(()=>{if(consumers++===0){timer=setInterval(visible,60000);document.addEventListener('visibilitychange',visible);}if(!state.data||Date.now()-lastLoaded>10000)refresh();});
  onUnmounted(()=>{if(--consumers===0){clearInterval(timer);timer=null;document.removeEventListener('visibilitychange',visible);}});
  return {state,refresh};
}
