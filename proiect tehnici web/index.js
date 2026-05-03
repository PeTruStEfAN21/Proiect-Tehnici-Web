// ============================================================================
// 1. IMPORTURI MODULE
// ============================================================================
const express = require('express');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const sass = require('sass');

// Creăm aplicația de server
const app = express();
const PORT = 8080;

// ============================================================================
// 2. AFIȘARE CĂI (Cerința 3)
// ============================================================================
console.log("=========================================");
console.log("Calea folderului (__dirname):", __dirname);
console.log("Calea fișierului (__filename):", __filename);
console.log("Folderul curent de lucru (process.cwd()):", process.cwd());
console.log("Sunt la fel mereu? Răspuns: NU. __dirname e mereu locul unde e salvat scriptul, process.cwd() e locul din care ai scris comanda 'node index.js' în terminal.");
console.log("=========================================\n");

// ============================================================================
// 3. PREGĂTIRE CADRU DE LUCRU & FOLDERE (Cerințele 20 & SCSS Backup)
// ============================================================================
global.folderScss = path.join(__dirname, "resurse/scss");
global.folderCss = path.join(__dirname, "resurse/css");
let folderBackup = path.join(__dirname, "backup");

// Creare foldere automate
[path.join(__dirname, "temp"), folderBackup].forEach(f => {
    if (!fs.existsSync(f)) fs.mkdirSync(f);
});

const vect_foldere = ["temp", "logs", "backup", "fisiere_uploadate"];
for (let folder of vect_foldere) {
    let caleFolder = path.join(__dirname, folder);
    if (!fs.existsSync(caleFolder)) {
        fs.mkdirSync(caleFolder);
        console.log(`[Creare Folder] Am creat folderul lipsă: ${folder}`);
    } else {
        console.log(`[Verificare Folder] Folderul '${folder}' există deja.`);
    }
}

// ============================================================================
// 4. FUNCȚII UTILITARE (SCSS, Erori, Imagini)
// ============================================================================
// Aceste funcții trebuie definite înainte de a fi apelate.

// Funcția de compilare SCSS
function compileazaScss(caleScss, caleCss) {
    let numeFisier = path.basename(caleScss, path.extname(caleScss));
    let drumScss = path.isAbsolute(caleScss) ? caleScss : path.join(global.folderScss, caleScss);
    let drumCss = caleCss ? (path.isAbsolute(caleCss) ? caleCss : path.join(global.folderCss, caleCss)) 
                          : path.join(global.folderCss, numeFisier + ".css");

    // Salvare în backup înainte de suprascriere
    if (fs.existsSync(drumCss)) {
        let subcaleBackup = path.join(folderBackup, "resurse/css");
        if (!fs.existsSync(subcaleBackup)) fs.mkdirSync(subcaleBackup, { recursive: true });
        
        let acum = Date.now();
        let numeBackup = `${numeFisier}_${acum}.css`;
        
        try {
            fs.copyFileSync(drumCss, path.join(subcaleBackup, numeBackup));
        } catch (e) {
            console.error("Eroare la copierea în backup:", e);
        }
    }

    // Compilarea propriu-zisă
    try {
        const rez = sass.compile(drumScss);
        fs.writeFileSync(drumCss, rez.css);
        console.log(`🚀 Compilat: ${drumScss} -> ${drumCss}`);
    } catch (err) {
        console.error("Eroare la compilare SASS:", err);
    }
}

function verificaImagini(jsonImagini) {
    let caleGalerie = path.join(__dirname, jsonImagini.cale_galerie);
    if (!fs.existsSync(caleGalerie)) {
        console.error(`❌ EROARE: Folderul galeriei NU există: ${caleGalerie}`);
    }
    jsonImagini.imagini.forEach(img => {
        let drumFisier = path.join(caleGalerie, img.fisier_imagine); // Corectat din img.fisier
        if (!fs.existsSync(drumFisier)) {
            console.error(`🖼️ EROARE IMAGINE LIPSĂ: Fișierul "${img.fisier_imagine}" nu a fost găsit în ${caleGalerie}. Verifică JSON-ul!`);
        }
    });
}

// Obiect Global Erori
let obGlobal = {
    obErori: null
};

// Funcția de inițializare erori
function initErori() {
    let caleErori = path.join(__dirname, 'erori.json');

    if (!fs.existsSync(caleErori)) {
        console.error("FATAL ERROR: Fișierul 'erori.json' nu a fost găsit în rădăcina proiectului!");
        process.exit(1);
    }

    let textJson = fs.readFileSync(caleErori, 'utf8');
    let obJson;

    try {
        obJson = JSON.parse(textJson);
    } catch (e) {
        console.error("EROARE: Fișierul erori.json nu este un format JSON valid.");
        return;
    }

    let regexChei = /"([^"]+)"\s*:/g;
    let cheiGasite = [];
    let match;
    while ((match = regexChei.exec(textJson)) !== null) {
        let cheie = match[1];
        if (cheiGasite.includes(cheie)) {
            let aparitii = textJson.split(`"${cheie}"`).length - 1;
            if (aparitii > 1 && (cheie === "titlu" || cheie === "text" || cheie === "imagine")) {
                console.warn(`[VALIDARE JSON] ATENȚIE: Proprietatea "${cheie}" apare de mai multe ori în fișier!`);
            }
        }
        cheiGasite.push(cheie);
    }

    const propsRadacina = ["info_erori", "cale_baza", "eroare_default"];
    for (let prop of propsRadacina) {
        if (!obJson.hasOwnProperty(prop)) {
            console.error(`EROARE JSON: Lipsește proprietatea obligatorie din rădăcină: "${prop}"`);
        }
    }

    if (obJson.eroare_default) {
        const propsDefault = ["titlu", "text", "imagine"];
        for (let prop of propsDefault) {
            if (!obJson.eroare_default.hasOwnProperty(prop)) {
                console.error(`EROARE JSON: 'eroare_default' nu are proprietatea: "${prop}"`);
            }
        }
    }

    let caleAbsolutaBaza = path.join(__dirname, obJson.cale_baza || "");
    if (!fs.existsSync(caleAbsolutaBaza)) {
        console.error(`EROARE SISTEM: Folderul pentru imagini erori nu există la calea: ${caleAbsolutaBaza}`);
    }

    if (obJson.info_erori) {
        obJson.info_erori.forEach(eroare => {
            let caleImg = path.join(caleAbsolutaBaza, eroare.imagine);
            if (!fs.existsSync(caleImg)) {
                console.error(`EROARE IMAGINE: Fișierul "${eroare.imagine}" pentru eroarea ${eroare.identificator} nu a fost găsit în ${obJson.cale_baza}`);
            }
        });
        
        let caleImgDefault = path.join(caleAbsolutaBaza, obJson.eroare_default.imagine);
        if(!fs.existsSync(caleImgDefault)) {
            console.error(`EROARE IMAGINE: Imaginea default "${obJson.eroare_default.imagine}" lipsește de pe disc!`);
        }
    }

    let ids = [];
    let duplicateFound = false;
    for (let eroare of obJson.info_erori) {
        if (ids.includes(eroare.identificator)) {
            console.error(`EROARE JSON: Există mai multe erori cu același identificator: ${eroare.identificator}`);
            console.log(` > Detalii eroare duplicată: Titlu: ${eroare.titlu}, Text: ${eroare.text}, Imagine: ${eroare.imagine}`);
            duplicateFound = true;
        }
        ids.push(eroare.identificator);
    }

    obGlobal.obErori = obJson;
    obGlobal.obErori.eroare_default.imagine = path.join(obJson.cale_baza, obJson.eroare_default.imagine);
    for (let eroare of obGlobal.obErori.info_erori) {
        eroare.imagine = path.join(obJson.cale_baza, eroare.imagine);
    }

    console.log("[Bonus] Validare finalizată.");
}

function afisareEroare(res, identificator, titlu, text, imagine) {
    let eroareDeAfisat = null;
    if (identificator) {
        eroareDeAfisat = obGlobal.obErori.info_erori.find(e => e.identificator === identificator);
    }
    if (!eroareDeAfisat) {
        eroareDeAfisat = obGlobal.obErori.eroare_default;
    }

    let titluFinal = titlu || eroareDeAfisat.titlu;
    let textFinal = text || eroareDeAfisat.text;
    let imagineFinala = imagine || eroareDeAfisat.imagine;

    if (eroareDeAfisat.status && identificator) {
        res.status(identificator);
    }

    res.render('pagini/eroare', {
        titlu: titluFinal,
        text: textFinal,
        imagine: imagineFinala
    });
}

// ============================================================================
// 5. APELURI INIȚIALE (Erori și SCSS)
// ============================================================================
// Apelăm inițializarea erorilor
initErori();

// Compilare inițială SCSS la pornirea serverului
fs.readdirSync(global.folderScss).forEach(fisier => {
    if (fisier.endsWith(".scss")) compileazaScss(fisier);
});

// Compilare SCSS pe parcurs (Watch)
fs.watch(global.folderScss, (eveniment, fisier) => {
    if (fisier && fisier.endsWith(".scss")) {
        console.log(`🔄 Fișier modificat: ${fisier}`);
        compileazaScss(fisier);
    }
});

// ============================================================================
// 6. SETĂRI EXPRESS & MIDDLEWARE
// ============================================================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware IP
app.use((req, res, next) => {
    res.locals.ip = req.ip;
    next();
});

// Foldere Statice
app.use('/resurse', express.static(path.join(__dirname, 'resurse')));

// ============================================================================
// 7. RUTE EXPLICITE (De la specific la general)
// ============================================================================

// 7.1. Favicon
app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'resurse/ico/sigla.png'));
});

// 7.2. Blocare Acces Direct la EJS
app.get(/\.ejs$/, (req, res) => {
    afisareEroare(res, 400); 
});

// 7.3. Blocare Acces Direct Foldere Resurse
app.get(/^\/resurse\/([^\/]*\/)*$/, (req, res) => {
    afisareEroare(res, 403);
});

// 7.4. RUTA PRINCIPALĂ (Acasă / Galerie)
// Această rută TREBUIE să fie înaintea rutei Catch-All.
app.get(['/', '/index', '/acasa', '/home'], async function(req, res) {
    let caleJson = path.join(__dirname, 'resurse', 'json', 'galerie.json');
    
    // Asigurăm-ne că JSON-ul există înainte de a încerca să-l citim
    if (!fs.existsSync(caleJson)) {
        console.error("Nu s-a găsit fișierul galerie.json");
        return afisareEroare(res, 500, "Eroare Server", "Fișierul galerie.json lipsește.");
    }

    let dateJson = JSON.parse(fs.readFileSync(caleJson, 'utf8'));
    
    // Apelăm funcția de verificare imagini (opțional, dar util pentru debug)
    verificaImagini(dateJson);

    const zileSaptamana = ["duminica", "luni", "marti", "miercuri", "joi", "vineri", "sambata"];
    let azi = new Date().getDay(); 
    let numeZiAzi = zileSaptamana[azi];

    let imaginiZiuaCurenta = dateJson.imagini.filter(img => {
        return img.intervale_zile.some(interval => {
            let indexStart = zileSaptamana.indexOf(interval[0]);
            let indexEnd = zileSaptamana.indexOf(interval[1]);
            let indexAzi = zileSaptamana.indexOf(numeZiAzi);
            
            if (indexStart <= indexEnd) {
                return indexAzi >= indexStart && indexAzi <= indexEnd;
            } else {
                return indexAzi >= indexStart || indexAzi <= indexEnd;
            }
        });
    });

    if (imaginiZiuaCurenta.length % 2 !== 0) {
        imaginiZiuaCurenta.pop(); 
    }

    let folderCale = path.join(__dirname, dateJson.cale_galerie);
    
    for (let img of imaginiZiuaCurenta) {
        let caleImagineOriginala = path.join(folderCale, img.fisier_imagine);
        
        let numeFaraExtensie = img.fisier_imagine.split('.')[0];
        let caleMic = path.join(folderCale, numeFaraExtensie + "-mic.jpg");
        let caleMediu = path.join(folderCale, numeFaraExtensie + "-mediu.jpg");

        img.cale_absoluta = dateJson.cale_galerie + img.fisier_imagine;
        img.cale_mic = dateJson.cale_galerie + numeFaraExtensie + "-mic.jpg";
        img.cale_mediu = dateJson.cale_galerie + numeFaraExtensie + "-mediu.jpg";

        // IMPORTANT: Asigură-te că folderul destinație există înainte de a folosi sharp
        if(fs.existsSync(caleImagineOriginala)){
            if (!fs.existsSync(caleMic)) {
                await sharp(caleImagineOriginala).resize(300).toFile(caleMic);
            }
            if (!fs.existsSync(caleMediu)) {
                await sharp(caleImagineOriginala).resize(600).toFile(caleMediu);
            }
        } else {
             console.error(`Eroare Sharp: Nu găsesc imaginea originală: ${caleImagineOriginala}`);
        }
    }

    res.render('pagini/index', { imaginiGalerie: imaginiZiuaCurenta, titlu: 'Acasă - SportXtreme' });
});

// ============================================================================
// 8. RUTA CATCH-ALL (Pentru afișarea altor pagini sau 404)
// ============================================================================
// Această rută trebuie să fie ÎNTOTDEAUNA ultima rută `app.get` definită.
app.get(/^.*$/, (req, res) => {
    let paginaCeruta = req.path.substring(1); 
    
    res.render('pagini/' + paginaCeruta, function(err, rezultatRandare) {
        if (err) {
            if (err.message.includes("Failed to lookup view")) {
                afisareEroare(res, 404);
            } else {
                afisareEroare(res, null, "Eroare Internă", err.message, null);
            }
        } else {
            res.send(rezultatRandare);
        }
    });
});

// ============================================================================
// 9. PORNIRE SERVER
// ============================================================================
app.listen(PORT, () => {
    console.log(`\n🚀 Serverul a pornit și ascultă pe http://localhost:${PORT}`);
});