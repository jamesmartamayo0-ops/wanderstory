// Keep the storage key literal synchronized with THEME_STORAGE_KEY in lib/theme.ts.
const THEME_SCRIPT = `(function(){try{var el=document.documentElement;if(!el){return;}if(location.pathname==="/admin"||location.pathname.indexOf("/admin/")===0){try{el.setAttribute("data-theme","light");}catch(_){}try{el.style.colorScheme="light";}catch(_){}return;}var stored=null;try{stored=localStorage.getItem("wanderstory-theme");}catch(_){stored=null;}var pref="system";if(stored==="light"||stored==="dark"||stored==="system"){pref=stored;}var effective="light";if(pref==="system"){try{effective=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}catch(_){effective="light";}}else{effective=pref;}try{el.setAttribute("data-theme",effective);}catch(_){}try{el.style.colorScheme=effective;}catch(_){}}catch(_){}})();`;

export default function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
    />
  );
}
