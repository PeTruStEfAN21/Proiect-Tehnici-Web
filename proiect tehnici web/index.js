// Importăm modulele necesare (Express pentru server, path și fs pentru fișiere)
const express = require('express');
const path = require('path');
const fs = require('fs');

// Creăm aplicația de server
const app = express();
const PORT = 8080;

/* --- Cerința 3: Afișarea căilor --- */
console.log("=========================================");
console.log("Calea folderului (__dirname):", __dirname);
console.log("Calea fișierului (__filename):", __filename);
console.log("Folderul curent de lucru (process.cwd()):", process.cwd());
console.log("Sunt la fel mereu? Răspuns: NU. __dirname e mereu locul unde e salvat scriptul, process.cwd() e locul din care ai scris comanda 'node index.js' în terminal.");
console.log("=========================================\n");


/* --- Cerința 20: Verificarea și crearea folderelor generatoare de fișiere --- */
// Definim vectorul cu folderele necesare
const vect_foldere = ["temp", "logs", "backup", "fisiere_uploadate"];

// Iterăm prin vector
for (let folder of vect_foldere) {
    // Construim calea absolută folosind path.join()
    let caleFolder = path.join(__dirname, folder);
    
    // Testăm dacă folderul NU există
    if (!fs.existsSync(caleFolder)) {
        // Îl creăm
        fs.mkdirSync(caleFolder);
        console.log(`[Creare Folder] Am creat folderul lipsă: ${folder}`);
    } else {
        console.log(`[Verificare Folder] Folderul '${folder}' există deja.`);
    }
}



let obGlobal = {
    obErori: null
};

// Cerința 12: Funcția care citește și memorează erorile la pornire
function initErori() {
    let caleErori = path.join(__dirname, 'erori.json');

    // (0.025) Verificare existență fișier
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

    /* --- (0.2) Verificare duplicate chei în string (Task-ul greu) --- */
    // Căutăm orice cheie de forma "cheie": care apare de mai multe ori
    let regexChei = /"([^"]+)"\s*:/g;
    let cheiGasite = [];
    let match;
    while ((match = regexChei.exec(textJson)) !== null) {
        let cheie = match[1];
        // Aceasta este o verificare simplificată. 
        // Într-un JSON complex, ar trebui verificat scope-ul {}.
        // Dar pentru nivelul acestui bonus, verificăm dacă o cheie se repetă suspect.
        if (cheiGasite.includes(cheie)) {
            // Verificăm dacă cheia se repetă în același obiect (numărând aparițiile manual în text)
            let aparitii = textJson.split(`"${cheie}"`).length - 1;
            if (aparitii > 1 && (cheie === "titlu" || cheie === "text" || cheie === "imagine")) {
                console.warn(`[VALIDARE JSON] ATENȚIE: Proprietatea "${cheie}" apare de mai multe ori în fișier!`);
            }
        }
        cheiGasite.push(cheie);
    }

    /* --- (0.025) Verificare proprietăți rădăcină --- */
    const propsRadacina = ["info_erori", "cale_baza", "eroare_default"];
    for (let prop of propsRadacina) {
        if (!obJson.hasOwnProperty(prop)) {
            console.error(`EROARE JSON: Lipsește proprietatea obligatorie din rădăcină: "${prop}"`);
        }
    }

    /* --- (0.025) Verificare eroare_default --- */
    if (obJson.eroare_default) {
        const propsDefault = ["titlu", "text", "imagine"];
        for (let prop of propsDefault) {
            if (!obJson.eroare_default.hasOwnProperty(prop)) {
                console.error(`EROARE JSON: 'eroare_default' nu are proprietatea: "${prop}"`);
            }
        }
    }

    /* --- (0.025) Verificare existență folder cale_baza --- */
    let caleAbsolutaBaza = path.join(__dirname, obJson.cale_baza || "");
    if (!fs.existsSync(caleAbsolutaBaza)) {
        console.error(`EROARE SISTEM: Folderul pentru imagini erori nu există la calea: ${caleAbsolutaBaza}`);
    }

    /* --- (0.05) Verificare existență imagini pe disc --- */
    if (obJson.info_erori) {
        obJson.info_erori.forEach(eroare => {
            let caleImg = path.join(caleAbsolutaBaza, eroare.imagine);
            if (!fs.existsSync(caleImg)) {
                console.error(`EROARE IMAGINE: Fișierul "${eroare.imagine}" pentru eroarea ${eroare.identificator} nu a fost găsit în ${obJson.cale_baza}`);
            }
        });
        
        // Verificăm și imaginea default
        let caleImgDefault = path.join(caleAbsolutaBaza, obJson.eroare_default.imagine);
        if(!fs.existsSync(caleImgDefault)) {
            console.error(`EROARE IMAGINE: Imaginea default "${obJson.eroare_default.imagine}" lipsește de pe disc!`);
        }
    }

    /* --- (0.15) Verificare identificatori DUPLICAT --- */
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

    // Dacă totul e ok (sau am afișat doar warning-uri), salvăm obiectul
    obGlobal.obErori = obJson;
    
    // Setăm căile relative pentru a fi folosite în render (cum am făcut data trecută)
    // Atenție: aici folosim cale_baza din JSON
    obGlobal.obErori.eroare_default.imagine = path.join(obJson.cale_baza, obJson.eroare_default.imagine);
    for (let eroare of obGlobal.obErori.info_erori) {
        eroare.imagine = path.join(obJson.cale_baza, eroare.imagine);
    }

    console.log("[Bonus] Validare finalizată.");
}
// Apelăm funcția la pornirea serverului
initErori();


// Cerința 13: Funcția principală de afișare a erorilor
function afisareEroare(res, identificator, titlu, text, imagine) {
    let eroareDeAfisat = null;

    // 1. Căutăm eroarea în JSON după identificator (dacă s-a dat unul)
    if (identificator) {
        eroareDeAfisat = obGlobal.obErori.info_erori.find(e => e.identificator === identificator);
    }

    // 2. Dacă nu am găsit-o SAU nu s-a dat identificator, folosim eroarea default
    if (!eroareDeAfisat) {
        eroareDeAfisat = obGlobal.obErori.eroare_default;
    }

    // 3. Suprascriem cu argumentele primite în funcție (dacă există, ele au prioritate)
    // Asta vrea profa când zice "are prioritate asupra datelor din JSON"
    let titluFinal = titlu || eroareDeAfisat.titlu;
    let textFinal = text || eroareDeAfisat.text;
    let imagineFinala = imagine || eroareDeAfisat.imagine;

    // Setăm statusul HTTP (ex: 404, 403), default e 404
    if (eroareDeAfisat.status && identificator) {
        res.status(identificator);
    }

    // 4. Randăm șablonul eroare.ejs și îi trimitem variabilele locals
    res.render('pagini/eroare', {
        titlu: titluFinal,
        text: textFinal,
        imagine: imagineFinala
    });
}


/* --- Cerințele 4 & 6: Setări Express și Static --- */
// Spunem serverului că vom folosi EJS pentru randarea paginilor (views)
app.set('view engine', 'ejs');

// Spunem serverului unde sunt fișierele EJS (în folderul 'views')
app.set('views', path.join(__dirname, 'views'));

// Cerința 16: Middleware pentru IP (Trebuie pus AICI, înainte de rute)
app.use((req, res, next) => {
    res.locals.ip = req.ip;
    next();
});

// Definim folderul 'resurse' ca fiind STATIC (ca să putem trage imagini și CSS de acolo)
app.use('/resurse', express.static(path.join(__dirname, 'resurse')));


/* --- Cerința 8: Prima pagină (Vector pentru rute multiple) --- */
// Răspunde la / , /index și /home trimițând pagina principală
app.get(['/', '/index', '/home'], (req, res) => {
    // momentan trimitem doar un text de test ca să vedem că merge serverul
    res.render('pagini/index', { titlu: 'Acasă - SportXtreme' });
});


app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'resurse/ico/sigla.png'));
});


// Cerința 18: Blocarea fișierelor EJS
// Dacă cineva încearcă să citească codul sursă (.ejs) din browser, dăm 400 Bad Request.
// (MODIFICATĂ PENTRU EXPRESS 5 - folosim RegEx direct)
app.get(/\.ejs$/, (req, res) => {
    afisareEroare(res, 400); 
});


// Cerința 17: Blocarea accesului direct la folderele din resurse
// Când scrii /resurse/*, prinde rute precum /resurse/css/ sau /resurse/imagini/
// (MODIFICATĂ PENTRU EXPRESS 5 - verifică dacă calea se termină cu / )
app.get(/^\/resurse\/([^\/]*\/)*$/, (req, res) => {
    afisareEroare(res, 403);
});


// Cerința 9: Ruta generală (CATCH-ALL) - TREBUIE SĂ FIE ULTIMA RUTĂ APP.GET!
// Randează automat pagina cerută, sau dă 404 dacă nu există.
// (MODIFICATĂ PENTRU EXPRESS 5 - folosim /^.*$/ care prinde absolut orice text, garantat fără eroare)
app.get(/^.*$/, (req, res) => {
    // Extragem numele paginii (tăind slash-ul din față cu substring(1))
    let paginaCeruta = req.path.substring(1); 
    
    // Express va căuta fișierul 'views/pagini/paginaCeruta.ejs'
    res.render('pagini/' + paginaCeruta, function(err, rezultatRandare) {
        if (err) {
            // Dacă Express returnează eroare că nu găsește view-ul (EJS-ul)
            if (err.message.includes("Failed to lookup view")) {
                afisareEroare(res, 404);
            } else {
                // Pentru orice altă eroare internă a serverului (Eroare Default)
                afisareEroare(res, null, "Eroare Internă", err.message, null);
            }
        } else {
            // Dacă a găsit pagina, o trimite browserului (status 200)
            res.send(rezultatRandare);
        }
    });
});

// Pornim serverul să asculte pe portul 8080
app.listen(PORT, () => {
    console.log(`\n🚀 Serverul a pornit și ascultă pe http://localhost:${PORT}`);
});