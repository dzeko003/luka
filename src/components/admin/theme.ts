export const THEME_KEY = "luka-admin-theme";

/** Script exécuté avant l'affichage : applique le thème choisi, sinon celui du système, sans clignotement. */
export const themeScript = `(function(){var t;try{t=localStorage.getItem("${THEME_KEY}")}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.currentScript.parentElement.dataset.theme=t})()`;
