// ================================
// POPOTE EMH2 - Apps Script
// VERSION COMPLÈTE AVEC NOUVELLES FONCTIONNALITÉS
// ================================

const SHEETS = {
  USERS: "UTILISATEUR",
  PRODUCTS: "PRODUITS",
  TX: "TRANSACTIONS",
  SUMUP: "SUMUP"
};

// ID du fichier Google Sheets "Historique utilisateur" (séparé)
const HISTORIQUE_SPREADSHEET_ID = "1JqV5GOtpgPdQZ1-XJM7VJO4M8TSWQNnUyT1g31MZVXw";

// ID du fichier Google Sheets principal (base de données)
const MAIN_SPREADSHEET_ID = "1heTSm4UtsqtGvMfG2jRSLqKyDVQ5uHRp7ttvpbJskMI";

// ID du fichier Google Sheets "Boîte à idées"
const IDEES_SPREADSHEET_ID = "1wBC2B19xf5IE-e8GonBXCDHu5yCTBmOyNV3Zyetl5Wk";

// ID du fichier Google Sheets "Goodies" (contient aussi TEASERS)
const GOODIES_SPREADSHEET_ID = "1xT33XEN6UQKhUWipCE4kt3MR6OnYS7KB5MGmqElzGnk";

// ID du fichier Google Sheets "Sondages"
const SONDAGES_SPREADSHEET_ID = "1KzowJkPDi9vcl5zfc35-9AywSIP1MG5lgsW_4CskQUQ";

// ID du fichier Google Sheets "Événements"
const EVENEMENTS_SPREADSHEET_ID = "1bZRpIGxmzr4kXvEZE9bVc9QAWbx0oJxuBXafPQMM7mc";

// ID du fichier Google Sheets "Mascottes"
const MASCOTTES_SPREADSHEET_ID = "1wOHVt0uGUeOyVqit8NJ8HO6c4NhEIvIv6L2L-ZuCL9Y";

// ================================
// UTILITAIRES SHEETS
// ================================

function getSS() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  const sh = getSS().getSheetByName(name);
  if (!sh) throw new Error('Feuille "' + name + '" introuvable');
  return sh;
}

function getSheetSafe(name) {
  const sh = getSS().getSheetByName(name);
  return sh || null;
}

function getDataAsObjects(sheetName) {
  const sh = getSheet(sheetName);
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0].map(h => String(h).toLowerCase().replace(/[^a-z0-9_]/g, ''));
  const rows = data.slice(1);
  
  return rows.map(row => {
    const obj = {};
    headers.forEach((key, i) => {
      obj[key] = row[i];
    });
    return obj;
  });
}

function findRowIndex(sheetName, predicate) {
  const sh = getSheet(sheetName);
  const values = sh.getDataRange().getValues();
  
  for (let i = 1; i < values.length; i++) {
    if (predicate(values[i])) return i + 1;
  }
  return -1;
}

function updateCell(sheetName, row, col, value) {
  const sh = getSheet(sheetName);
  sh.getRange(row, col).setValue(value);
}

// ================================
// CRÉATION FEUILLE D'HISTORIQUE
// ================================

function createHistoriqueSheet(username, nom) {
  try {
    const histoSpreadsheet = SpreadsheetApp.openById(HISTORIQUE_SPREADSHEET_ID);
    const sheetName = nom;
    let sheet = histoSpreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = histoSpreadsheet.insertSheet(sheetName);
      
      const formula = '=FILTER(' +
        'IMPORTRANGE("https://docs.google.com/spreadsheets/d/' + MAIN_SPREADSHEET_ID + '"; "TRANSACTIONS!A:H"); ' +
        'INDEX(IMPORTRANGE("https://docs.google.com/spreadsheets/d/' + MAIN_SPREADSHEET_ID + '"; "TRANSACTIONS!B:B")) = "' + username + '"' +
      ')';
      
      sheet.getRange('A1').setFormula(formula);
    }
    
    const spreadsheetUrl = histoSpreadsheet.getUrl();
    const sheetId = sheet.getSheetId();
    let sheetUrl = spreadsheetUrl;
    
    if (sheetUrl.indexOf('#gid=') !== -1) {
      sheetUrl = sheetUrl.substring(0, sheetUrl.indexOf('#gid='));
    }
    if (sheetUrl.indexOf('/edit') !== -1) {
      sheetUrl = sheetUrl.substring(0, sheetUrl.indexOf('/edit'));
    }
    sheetUrl = sheetUrl + '/edit#gid=' + sheetId;
    
    return { ok: true, sheetName: sheetName, sheetUrl: sheetUrl };
    
  } catch (error) {
    return { ok: false, msg: error.message };
  }
}

// ================================
// VÉRIFICATION BLOCAGE UTILISATEUR
// ================================

function checkUserBloque(username) {
  const sh = getSheet(SHEETS.USERS);
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  
  let colBlocage = -1;
  let colRaisonBlocage = -1;
  
  for (let j = 0; j < headers.length; j++) {
    if (headers[j] === 'BLOQUE_JUSQU') colBlocage = j;
    if (headers[j] === 'RAISON_BLOCAGE') colRaisonBlocage = j;
  }
  
  if (colBlocage === -1) {
    return { bloque: false };
  }
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(username).toLowerCase()) {
      const finBlocage = data[i][colBlocage];
      
      if (finBlocage && finBlocage instanceof Date) {
        if (finBlocage > new Date()) {
          return {
            bloque: true,
            finBlocage: finBlocage.toISOString(),
            raison: colRaisonBlocage !== -1 ? (data[i][colRaisonBlocage] || 'Non spécifiée') : 'Non spécifiée'
          };
        }
      }
      break;
    }
  }
  
  return { bloque: false };
}

// ================================
// INSCRIPTION
// ================================

function registerUser(username, nom, password) {
  username = String(username || "").trim().toLowerCase();
  nom = String(nom || "").trim();
  password = String(password || "").trim();
  
  if (!username || !nom || !password) {
    return {ok: false, msg: "Tous les champs sont requis"};
  }
  
  if (username.length < 3) {
    return {ok: false, msg: "Le nom d'utilisateur doit faire au moins 3 caractères"};
  }
  
  if (password.length < 6) {
    return {ok: false, msg: "Le mot de passe doit faire au moins 6 caractères"};
  }
  
  if (!/^[a-z0-9_]+$/.test(username)) {
    return {ok: false, msg: "Le nom d'utilisateur ne peut contenir que lettres, chiffres et underscore"};
  }
  
  const users = getDataAsObjects(SHEETS.USERS);
  const exists = users.find(u => String(u.username).toLowerCase() === username);
  
  if (exists) {
    return {ok: false, msg: "Ce nom d'utilisateur existe déjà"};
  }
  
  const histoResult = createHistoriqueSheet(username, nom);
  
  const sh = getSheet(SHEETS.USERS);
  sh.appendRow([
    username,
    nom,
    password,
    0,
    "",
    histoResult.ok ? histoResult.sheetUrl : "",
    "USER",
    false,
    "",
    "",
    false // COTISANT (nouvelle colonne)
  ]);
  
  return { ok: true, msg: "Compte créé avec succès ! Vous pouvez maintenant vous connecter." };
}

// ================================
// AUTHENTIFICATION
// ================================

function loginUser(username, password) {
  username = String(username || "").trim().toLowerCase();
  password = String(password || "").trim();
  
  if (!username || !password) {
    return {ok: false, msg: "Nom d'utilisateur et mot de passe requis"};
  }
  
  const sh = getSheet(SHEETS.USERS);
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  
  let colBlocage = -1;
  let colRaisonBlocage = -1;
  let colCotisant = -1;
  
  for (let j = 0; j < headers.length; j++) {
    if (headers[j] === 'BLOQUE_JUSQU') colBlocage = j;
    if (headers[j] === 'RAISON_BLOCAGE') colRaisonBlocage = j;
    if (headers[j] === 'COTISANT') colCotisant = j;
  }
  
  let user = null;
  let rowIndex = -1;
  let bloque = false;
  let finBlocage = null;
  let raisonBlocage = null;
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === username) {
      user = {
        username: data[i][0],
        nom: data[i][1],
        mdp: data[i][2],
        solde: Number(data[i][3] || 0),
        historiqueUrl: data[i][5] || "",
        role: data[i][6] || "USER",
        detteAutorisee: data[i][7] === true || data[i][7] === "TRUE",
        cotisant: colCotisant !== -1 ? (data[i][colCotisant] === true || data[i][colCotisant] === "TRUE") : false
      };
      rowIndex = i + 1;
      
      if (colBlocage !== -1 && data[i][colBlocage]) {
        const blocageDate = data[i][colBlocage];
        if (blocageDate instanceof Date && blocageDate > new Date()) {
          bloque = true;
          finBlocage = blocageDate.toISOString();
          raisonBlocage = colRaisonBlocage !== -1 ? (data[i][colRaisonBlocage] || 'Non spécifiée') : 'Non spécifiée';
        }
      }
      break;
    }
  }
  
  if (!user) {
    return {ok: false, msg: "Nom d'utilisateur inconnu"};
  }
  
  if (String(user.mdp).trim() !== password) {
    return {ok: false, msg: "Mot de passe incorrect"};
  }
  
  const token = Utilities.getUuid();
  updateCell(SHEETS.USERS, rowIndex, 5, token);
  
  return {
    ok: true,
    token: token,
    user: {
      username: user.username,
      nom: user.nom,
      solde: user.solde,
      historiqueUrl: user.historiqueUrl,
      role: user.role,
      detteAutorisee: user.detteAutorisee,
      cotisant: user.cotisant,
      bloque: bloque,
      finBlocage: finBlocage,
      raisonBlocage: raisonBlocage
    }
  };
}

function getUserByToken(token) {
  if (!token) return null;
  
  try {
    const sh = getSheet(SHEETS.USERS);
    const data = sh.getDataRange().getValues();
    const headers = data[0];
    
    let colCotisant = -1;
    for (let j = 0; j < headers.length; j++) {
      if (headers[j] === 'COTISANT') colCotisant = j;
    }
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][4]) === String(token)) {
        return {
          username: data[i][0],
          nom: data[i][1],
          mdp: data[i][2],
          solde: Number(data[i][3] || 0),
          token: data[i][4],
          historiqueUrl: data[i][5] || "",
          role: data[i][6] || "USER",
          detteAutorisee: data[i][7] === true || data[i][7] === "TRUE",
          cotisant: colCotisant !== -1 ? (data[i][colCotisant] === true || data[i][colCotisant] === "TRUE") : false
        };
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

function isAdmin(token) {
  const user = getUserByToken(token);
  return user && user.role === "ADMIN";
}

function logout(token) {
  const user = getUserByToken(token);
  if (!user) return {ok: false};
  
  const rowIndex = findRowIndex(SHEETS.USERS, r => String(r[0]).toLowerCase() === String(user.username).toLowerCase());
  if (rowIndex !== -1) {
    updateCell(SHEETS.USERS, rowIndex, 5, "");
  }
  
  return {ok: true};
}

// ================================
// PRODUITS
// ================================

function getProduits() {
  return getDataAsObjects(SHEETS.PRODUCTS);
}

function getProduitByCode(code) {
  const produits = getProduits();
  return produits.find(p => String(p.code) === String(code));
}

// ================================
// TRANSACTIONS
// ================================

function logTransaction(username, nom, codeProduit, nomProduit, montant, nouveauSolde, statut) {
  const sh = getSheet(SHEETS.TX);
  sh.appendRow([
    new Date(),
    username,
    nom,
    codeProduit,
    nomProduit,
    montant,
    nouveauSolde,
    statut || "OK"
  ]);
}

function getTransactions(token) {
  try {
    if (!token) return {ok: false, msg: "Token manquant"};
    
    const sh = getSheet(SHEETS.USERS);
    const userData = sh.getDataRange().getValues();
    
    let user = null;
    for (let i = 1; i < userData.length; i++) {
      if (String(userData[i][4]) === String(token)) {
        user = { username: userData[i][0], nom: userData[i][1], solde: userData[i][3] };
        break;
      }
    }
    
    if (!user) return {ok: false, msg: "Session expirée"};
    
    const txSheet = getSheet(SHEETS.TX);
    const txData = txSheet.getDataRange().getValues();
    
    if (txData.length <= 1) return {ok: true, data: []};
    
    const transactions = [];
    const username = String(user.username).toLowerCase();
    
    for (let i = 1; i < txData.length; i++) {
      const row = txData[i];
      if (!row[1]) continue;
      
      if (String(row[1]).toLowerCase() === username) {
        let dateISO = '';
        if (row[0] instanceof Date) {
          dateISO = row[0].toISOString();
        } else if (row[0]) {
          dateISO = String(row[0]);
        }
        
        transactions.push({
          date: dateISO,
          username: String(row[1] || ''),
          nom: String(row[2] || ''),
          codeproduit: String(row[3] || ''),
          nomproduit: String(row[4] || ''),
          montant: Number(row[5]) || 0,
          nouveausolde: Number(row[6]) || 0,
          statut: String(row[7] || 'OK')
        });
      }
    }
    
    return { ok: true, data: transactions.reverse() };
    
  } catch (error) {
    return { ok: false, msg: "Erreur serveur : " + error.message };
  }
}

// ================================
// ACHAT (AVEC VÉRIFICATION BLOCAGE)
// ================================

function processAchat(token, codeProduit) {
  const user = getUserByToken(token);
  if (!user) return {ok: false, msg: "Session expirée"};
  
  // Vérifier si bloqué
  const blocage = checkUserBloque(user.username);
  if (blocage.bloque) {
    return {
      ok: false, 
      msg: "Votre compte est bloqué jusqu'au " + new Date(blocage.finBlocage).toLocaleString('fr-FR'),
      bloque: true,
      finBlocage: blocage.finBlocage
    };
  }
  
  const produit = getProduitByCode(codeProduit);
  if (!produit) return {ok: false, msg: "Produit introuvable"};
  
  const prix = Number(produit.prix || 0);
  const soldeActuel = Number(user.solde || 0);
  const nouveauSolde = soldeActuel - prix;
  
  if (nouveauSolde < 0 && !user.detteAutorisee) {
    return {ok: false, msg: "Solde insuffisant"};
  }
  
  const rowIndex = findRowIndex(SHEETS.USERS, r => String(r[0]).toLowerCase() === String(user.username).toLowerCase());
  
  updateCell(SHEETS.USERS, rowIndex, 4, nouveauSolde);
  logTransaction(user.username, user.nom, produit.code, produit.nom, -prix, nouveauSolde, "OK");
  
  return { ok: true, nomProduit: produit.nom, prix: prix, nouveauSolde: nouveauSolde };
}

// ================================
// ROUTEUR WEB
// ================================

function doGet(e) {
  const page = e && e.parameter && e.parameter.page ? e.parameter.page : "login";
  
  if (page === "admin") {
    return HtmlService.createHtmlOutputFromFile("admin")
      .setTitle("POPOTE EMH2 - Admin")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  
  return HtmlService.createHtmlOutputFromFile("login")
    .setTitle("POPOTE EMH2")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ================================
// API UTILISATEUR
// ================================

function apiRegister(username, nom, password) {
  try {
    return registerUser(username, nom, password);
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiLogin(username, password) {
  try {
    return loginUser(username, password);
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiGetProduits(token) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    return {ok: true, data: getProduits()};
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiAchat(token, code) {
  try {
    return processAchat(token, code);
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

// Change password
function apiChangePassword(token, oldPassword, newPassword) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    if (!oldPassword || !newPassword) {
      return {ok: false, msg: "Veuillez remplir tous les champs"};
    }
    
    if (newPassword.length < 6) {
      return {ok: false, msg: "Le nouveau mot de passe doit faire au moins 6 caractères"};
    }
    
    const usersSheet = getSheet(SHEETS.USERS);
    const usersData = usersSheet.getDataRange().getValues();
    
    for (let i = 1; i < usersData.length; i++) {
      if (String(usersData[i][0]).toLowerCase() === user.username.toLowerCase()) {
        const currentHash = String(usersData[i][2]);
        const oldHash = hashPassword(oldPassword);
        
        if (currentHash !== oldHash) {
          return {ok: false, msg: "L'ancien mot de passe est incorrect"};
        }
        
        // Update password
        const newHash = hashPassword(newPassword);
        usersSheet.getRange(i + 1, 3).setValue(newHash);
        
        return {ok: true, msg: "Mot de passe modifié avec succès"};
      }
    }
    
    return {ok: false, msg: "Utilisateur introuvable"};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiGetTransactions(token) {
  try {
    return getTransactions(token);
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiLogout(token) {
  try {
    return logout(token);
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiGetUser(token) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    const blocage = checkUserBloque(user.username);
    
    return {
      ok: true, 
      user: {
        username: user.username,
        nom: user.nom,
        solde: user.solde,
        historiqueUrl: user.historiqueUrl,
        role: user.role,
        detteAutorisee: user.detteAutorisee,
        cotisant: user.cotisant,
        bloque: blocage.bloque,
        finBlocage: blocage.finBlocage || null,
        raisonBlocage: blocage.raison || null
      }
    };
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiGetUserInfo(token) {
  return apiGetUser(token);
}

function apiGetStats(token) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    const txSheet = getSheet(SHEETS.TX);
    const txData = txSheet.getDataRange().getValues();
    
    const username = String(user.username).toLowerCase();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    let nbAchatsMois = 0;
    let totalDepenseMois = 0;
    
    // Badge counters
    let totalAchats = 0;
    let cafeCount = 0;
    let biereCount = 0;
    
    for (let i = 1; i < txData.length; i++) {
      const row = txData[i];
      if (!row[1]) continue;
      
      if (String(row[1]).toLowerCase() === username) {
        const dateValue = row[0];
        const montant = Number(row[5]) || 0;
        const produit = String(row[4] || '').toLowerCase();
        
        // Count total purchases (achats only, not recharges)
        if (montant < 0) {
          totalAchats++;
          
          // Count by category
          if (produit.includes('café') || produit.includes('cafe')) {
            cafeCount++;
          }
          if (produit.includes('bière') || produit.includes('biere')) {
            biereCount++;
          }
        }
        
        if (dateValue instanceof Date) {
          if (dateValue.getMonth() === currentMonth && dateValue.getFullYear() === currentYear) {
            if (montant < 0) {
              nbAchatsMois++;
              totalDepenseMois += Math.abs(montant);
            }
          }
        }
      }
    }
    
    return { 
      ok: true, 
      nbAchatsMois: nbAchatsMois, 
      totalDepenseMois: totalDepenseMois,
      badges: {
        total: totalAchats,
        cafe: cafeCount,
        biere: biereCount
      }
    };
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

// ================================
// API ADMIN - UTILISATEURS
// ================================

function apiAdminGetAllUsers(token) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    const sh = getSheet(SHEETS.USERS);
    const data = sh.getDataRange().getValues();
    const headers = data[0];
    
    let colBlocage = -1;
    let colRaisonBlocage = -1;
    let colCotisant = -1;
    
    for (let j = 0; j < headers.length; j++) {
      if (headers[j] === 'BLOQUE_JUSQU') colBlocage = j;
      if (headers[j] === 'RAISON_BLOCAGE') colRaisonBlocage = j;
      if (headers[j] === 'COTISANT') colCotisant = j;
    }
    
    const users = [];
    const now = new Date();
    
    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      
      const user = {
        username: String(data[i][0] || ''),
        nom: String(data[i][1] || ''),
        solde: Number(data[i][3]) || 0,
        role: String(data[i][6] || 'USER'),
        detteAutorisee: data[i][7] === true || data[i][7] === "TRUE",
        cotisant: colCotisant !== -1 ? (data[i][colCotisant] === true || data[i][colCotisant] === "TRUE") : false,
        bloque: false,
        finBlocage: null,
        raisonBlocage: null
      };
      
      if (colBlocage !== -1 && data[i][colBlocage]) {
        const finBlocage = data[i][colBlocage];
        if (finBlocage instanceof Date && finBlocage > now) {
          user.bloque = true;
          user.finBlocage = finBlocage.toISOString();
          user.raisonBlocage = colRaisonBlocage !== -1 ? (data[i][colRaisonBlocage] || 'Non spécifiée') : 'Non spécifiée';
        }
      }
      
      users.push(user);
    }
    
    return {ok: true, data: users};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiAdminRechargeUser(token, username, montant) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    username = String(username).toLowerCase();
    montant = Number(montant);
    
    if (isNaN(montant) || montant <= 0) return {ok: false, msg: "Montant invalide"};
    
    const sh = getSheet(SHEETS.USERS);
    const data = sh.getDataRange().getValues();
    
    let rowIndex = -1;
    let currentSolde = 0;
    let userNom = '';
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === username) {
        rowIndex = i + 1;
        currentSolde = Number(data[i][3]) || 0;
        userNom = data[i][1];
        break;
      }
    }
    
    if (rowIndex === -1) return {ok: false, msg: "Utilisateur introuvable"};
    
    const nouveauSolde = currentSolde + montant;
    updateCell(SHEETS.USERS, rowIndex, 4, nouveauSolde);
    logTransaction(username, userNom, "RECHARGE", "Recharge compte", montant, nouveauSolde, "OK");
    
    return { ok: true, username: username, ancienSolde: currentSolde, nouveauSolde: nouveauSolde };
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiAdminSetDette(token, username, autorisee) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    username = String(username).toLowerCase();
    const rowIndex = findRowIndex(SHEETS.USERS, r => String(r[0]).toLowerCase() === username);
    
    if (rowIndex === -1) return {ok: false, msg: "Utilisateur introuvable"};
    
    updateCell(SHEETS.USERS, rowIndex, 8, autorisee === true);
    
    return { ok: true, username: username, detteAutorisee: autorisee === true };
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiAdminSetCotisant(token, username, cotisant) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    username = String(username).toLowerCase();
    
    const sh = getSheet(SHEETS.USERS);
    const data = sh.getDataRange().getValues();
    const headers = data[0];
    
    // Trouver ou créer la colonne COTISANT
    let colCotisant = -1;
    for (let j = 0; j < headers.length; j++) {
      if (headers[j] === 'COTISANT') {
        colCotisant = j + 1;
        break;
      }
    }
    
    if (colCotisant === -1) {
      const lastCol = headers.length + 1;
      sh.getRange(1, lastCol).setValue('COTISANT');
      colCotisant = lastCol;
    }
    
    const rowIndex = findRowIndex(SHEETS.USERS, r => String(r[0]).toLowerCase() === username);
    if (rowIndex === -1) return {ok: false, msg: "Utilisateur introuvable"};
    
    sh.getRange(rowIndex, colCotisant).setValue(cotisant === true);
    
    return { ok: true, username: username, cotisant: cotisant === true };
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiAdminCreateUser(token, username, nom, password, soldeInitial) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    username = String(username || "").trim().toLowerCase();
    nom = String(nom || "").trim();
    password = String(password || "").trim();
    soldeInitial = Number(soldeInitial) || 0;
    
    if (!username || !nom || !password) return {ok: false, msg: "Tous les champs sont requis"};
    if (!/^[a-z0-9_]+$/.test(username)) return {ok: false, msg: "Username invalide"};
    
    const users = getDataAsObjects(SHEETS.USERS);
    if (users.find(u => String(u.username).toLowerCase() === username)) {
      return {ok: false, msg: "Ce nom d'utilisateur existe déjà"};
    }
    
    const histoResult = createHistoriqueSheet(username, nom);
    
    const sh = getSheet(SHEETS.USERS);
    sh.appendRow([username, nom, password, soldeInitial, "", histoResult.ok ? histoResult.sheetUrl : "", "USER", false, "", "", false]);
    
    return { ok: true, msg: "Utilisateur créé avec succès", username: username };
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

// ================================
// API ADMIN - BLOCAGE
// ================================

function apiAdminBloquerUser(token, username, dureeMinutes, raison) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    const sh = getSheet(SHEETS.USERS);
    const data = sh.getDataRange().getValues();
    const headers = data[0];
    
    let userRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === String(username).toLowerCase()) {
        userRow = i + 1;
        break;
      }
    }
    
    if (userRow === -1) return {ok: false, msg: "Utilisateur non trouvé"};
    
    const maintenant = new Date();
    const finBlocage = new Date(maintenant.getTime() + dureeMinutes * 60 * 1000);
    
    let colBlocage = -1;
    let colRaisonBlocage = -1;
    
    for (let j = 0; j < headers.length; j++) {
      if (headers[j] === 'BLOQUE_JUSQU') colBlocage = j + 1;
      if (headers[j] === 'RAISON_BLOCAGE') colRaisonBlocage = j + 1;
    }
    
    if (colBlocage === -1) {
      const lastCol = headers.length + 1;
      sh.getRange(1, lastCol).setValue('BLOQUE_JUSQU');
      colBlocage = lastCol;
    }
    
    if (colRaisonBlocage === -1) {
      const lastCol = sh.getLastColumn() + 1;
      sh.getRange(1, lastCol).setValue('RAISON_BLOCAGE');
      colRaisonBlocage = lastCol;
    }
    
    sh.getRange(userRow, colBlocage).setValue(finBlocage);
    sh.getRange(userRow, colRaisonBlocage).setValue(raison || 'Abus');
    
    let dureeTexte = '';
    if (dureeMinutes < 60) {
      dureeTexte = dureeMinutes + ' minute(s)';
    } else if (dureeMinutes < 1440) {
      dureeTexte = Math.round(dureeMinutes / 60) + ' heure(s)';
    } else {
      dureeTexte = Math.round(dureeMinutes / 1440) + ' jour(s)';
    }
    
    return { ok: true, msg: username + " bloqué pour " + dureeTexte, finBlocage: finBlocage.toISOString(), duree: dureeTexte };
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiAdminDebloquerUser(token, username) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    const sh = getSheet(SHEETS.USERS);
    const data = sh.getDataRange().getValues();
    const headers = data[0];
    
    let userRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === String(username).toLowerCase()) {
        userRow = i + 1;
        break;
      }
    }
    
    if (userRow === -1) return {ok: false, msg: "Utilisateur non trouvé"};
    
    let colBlocage = -1;
    let colRaisonBlocage = -1;
    
    for (let j = 0; j < headers.length; j++) {
      if (headers[j] === 'BLOQUE_JUSQU') colBlocage = j + 1;
      if (headers[j] === 'RAISON_BLOCAGE') colRaisonBlocage = j + 1;
    }
    
    if (colBlocage !== -1) sh.getRange(userRow, colBlocage).setValue('');
    if (colRaisonBlocage !== -1) sh.getRange(userRow, colRaisonBlocage).setValue('');
    
    return {ok: true, msg: username + " débloqué"};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

// ================================
// API ADMIN - STATISTIQUES
// ================================

function apiAdminGetGlobalStats(token) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    const txSheet = getSheet(SHEETS.TX);
    const txData = txSheet.getDataRange().getValues();
    
    const usersSheet = getSheet(SHEETS.USERS);
    const usersData = usersSheet.getDataRange().getValues();
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    let totalVentesMois = 0;
    let nbTransactionsMois = 0;
    let produitsVendus = {};
    
    for (let i = 1; i < txData.length; i++) {
      const row = txData[i];
      if (!row[0]) continue;
      
      const dateValue = row[0];
      const montant = Number(row[5]) || 0;
      const nomProduit = String(row[4] || '');
      
      if (montant < 0 && dateValue instanceof Date) {
        if (dateValue.getMonth() === currentMonth && dateValue.getFullYear() === currentYear) {
          totalVentesMois += Math.abs(montant);
          nbTransactionsMois++;
          
          if (nomProduit && nomProduit !== 'Recharge compte') {
            produitsVendus[nomProduit] = (produitsVendus[nomProduit] || 0) + 1;
          }
        }
      }
    }
    
    const topProduits = Object.entries(produitsVendus)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nom, count]) => ({nom: nom, count: count}));
    
    const nbUtilisateurs = usersData.length - 1;
    
    let totalSoldes = 0;
    let nbCotisants = 0;
    const headers = usersData[0];
    let colCotisant = -1;
    
    for (let j = 0; j < headers.length; j++) {
      if (headers[j] === 'COTISANT') colCotisant = j;
    }
    
    for (let i = 1; i < usersData.length; i++) {
      totalSoldes += Number(usersData[i][3]) || 0;
      if (colCotisant !== -1 && (usersData[i][colCotisant] === true || usersData[i][colCotisant] === "TRUE")) {
        nbCotisants++;
      }
    }
    
    return {
      ok: true,
      totalVentesMois: totalVentesMois,
      nbTransactionsMois: nbTransactionsMois,
      topProduits: topProduits,
      nbUtilisateurs: nbUtilisateurs,
      nbCotisants: nbCotisants,
      totalSoldes: totalSoldes
    };
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiAdminGetAllTransactions(token, limit) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    limit = Number(limit) || 100;
    
    const txSheet = getSheet(SHEETS.TX);
    const txData = txSheet.getDataRange().getValues();
    
    const transactions = [];
    
    for (let i = 1; i < txData.length; i++) {
      const row = txData[i];
      if (!row[0]) continue;
      
      let dateISO = '';
      if (row[0] instanceof Date) {
        dateISO = row[0].toISOString();
      } else if (row[0]) {
        dateISO = String(row[0]);
      }
      
      transactions.push({
        date: dateISO,
        username: String(row[1] || ''),
        nom: String(row[2] || ''),
        codeproduit: String(row[3] || ''),
        nomproduit: String(row[4] || ''),
        montant: Number(row[5]) || 0,
        nouveausolde: Number(row[6]) || 0,
        statut: String(row[7] || 'OK')
      });
    }
    
    return { ok: true, data: transactions.reverse().slice(0, limit) };
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

// ================================
// API ADMIN - PRODUITS
// ================================

function apiAdminGetAllProducts(token) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    return {ok: true, data: getProduits()};
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiAdminAddProduct(token, code, nom, prix) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    code = String(code || "").trim().toUpperCase();
    nom = String(nom || "").trim();
    prix = Number(prix);
    
    if (!code || !nom || isNaN(prix) || prix < 0) return {ok: false, msg: "Données invalides"};
    
    const produits = getProduits();
    if (produits.find(p => String(p.code).toUpperCase() === code)) {
      return {ok: false, msg: "Ce code produit existe déjà"};
    }
    
    const sh = getSheet(SHEETS.PRODUCTS);
    sh.appendRow([code, nom, prix]);
    
    return { ok: true, msg: "Produit ajouté", produit: {code: code, nom: nom, prix: prix} };
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiAdminUpdateProduct(token, code, nom, prix) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    code = String(code || "").trim().toUpperCase();
    nom = String(nom || "").trim();
    prix = Number(prix);
    
    if (!code || !nom || isNaN(prix) || prix < 0) return {ok: false, msg: "Données invalides"};
    
    const rowIndex = findRowIndex(SHEETS.PRODUCTS, r => String(r[0]).toUpperCase() === code);
    if (rowIndex === -1) return {ok: false, msg: "Produit introuvable"};
    
    updateCell(SHEETS.PRODUCTS, rowIndex, 2, nom);
    updateCell(SHEETS.PRODUCTS, rowIndex, 3, prix);
    
    return { ok: true, msg: "Produit mis à jour", produit: {code: code, nom: nom, prix: prix} };
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiAdminDeleteProduct(token, code) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    code = String(code || "").trim().toUpperCase();
    const rowIndex = findRowIndex(SHEETS.PRODUCTS, r => String(r[0]).toUpperCase() === code);
    
    if (rowIndex === -1) return {ok: false, msg: "Produit introuvable"};
    
    const sh = getSheet(SHEETS.PRODUCTS);
    sh.deleteRow(rowIndex);
    
    return { ok: true, msg: "Produit supprimé" };
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

// ================================
// API SUMUP
// ================================

function apiAdminRechargeWithMethod(token, username, montant, methode, notes) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    const sh = getSheet(SHEETS.USERS);
    const data = sh.getDataRange().getValues();
    
    let userRow = -1;
    let user = null;
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === String(username).toLowerCase()) {
        userRow = i + 1;
        user = { username: data[i][0], nom: data[i][1], solde: Number(data[i][3]) || 0 };
        break;
      }
    }
    
    if (!user) return {ok: false, msg: "Utilisateur non trouvé"};
    
    const nouveauSolde = user.solde + Number(montant);
    const idTransaction = methode + '-' + Date.now();
    
    updateCell(SHEETS.USERS, userRow, 4, nouveauSolde);
    
    const sumupSheet = getSheet(SHEETS.SUMUP);
    sumupSheet.appendRow([new Date(), username, Number(montant), methode, idTransaction, 'OK', notes || '']);
    
    logTransaction(username, user.nom, 'RECHARGE', 'Recharge ' + methode, Number(montant), nouveauSolde, 'OK');
    
    return { ok: true, msg: "Recharge effectuée", nouveauSolde: nouveauSolde, idTransaction: idTransaction };
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiAdminGetSumupTransactions(token, limit) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    const sumupSheet = getSheet(SHEETS.SUMUP);
    const data = sumupSheet.getDataRange().getValues();
    
    const transactions = [];
    
    for (let i = data.length - 1; i >= 1; i--) {
      if (transactions.length >= (limit || 100)) break;
      
      const row = data[i];
      if (row[0]) {
        transactions.push({
          date: row[0] instanceof Date ? row[0].toISOString() : String(row[0]),
          username: String(row[1] || ''),
          montant: Number(row[2]) || 0,
          methode: String(row[3] || ''),
          idTransaction: String(row[4] || ''),
          statut: String(row[5] || ''),
          notes: String(row[6] || '')
        });
      }
    }
    
    return {ok: true, data: transactions};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiAdminGetSumupStats(token) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    const sumupSheet = getSheet(SHEETS.SUMUP);
    const data = sumupSheet.getDataRange().getValues();
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const stats = {
      totalTerminal: 0, totalEspeces: 0, totalLien: 0,
      countTerminal: 0, countEspeces: 0, countLien: 0,
      totalMois: 0, countMois: 0
    };
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      const date = new Date(row[0]);
      const montant = Number(row[2]) || 0;
      const methode = String(row[3] || '').toUpperCase();
      const statut = String(row[5] || '').toUpperCase();
      
      if (statut !== 'OK') continue;
      
      if (methode === 'TERMINAL') { stats.totalTerminal += montant; stats.countTerminal++; }
      else if (methode === 'ESPECES') { stats.totalEspeces += montant; stats.countEspeces++; }
      else if (methode === 'LIEN') { stats.totalLien += montant; stats.countLien++; }
      
      if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
        stats.totalMois += montant;
        stats.countMois++;
      }
    }
    
    stats.totalGeneral = stats.totalTerminal + stats.totalEspeces + stats.totalLien;
    stats.countGeneral = stats.countTerminal + stats.countEspeces + stats.countLien;
    
    return {ok: true, stats: stats};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

// ================================
// API BOÎTE À IDÉES
// ================================

function apiPostIdee(token, titre, description) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    titre = String(titre || "").trim();
    description = String(description || "").trim();
    
    if (!titre) return {ok: false, msg: "Le titre est requis"};
    if (titre.length > 100) return {ok: false, msg: "Titre trop long (100 caractères max)"};
    if (description.length > 1000) return {ok: false, msg: "Description trop longue (1000 caractères max)"};
    
    const id = 'IDEE-' + Date.now();
    
    const ss = SpreadsheetApp.openById(IDEES_SPREADSHEET_ID);
    const sh = ss.getSheetByName('IDEES');
    sh.appendRow([
      id,
      new Date(),
      user.username,
      user.nom,
      titre,
      description,
      0,
      "ACTIVE"
    ]);
    
    return {ok: true, msg: "Idée publiée !", id: id};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiGetIdees(token, limit) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    limit = Number(limit) || 50;
    
    const ss = SpreadsheetApp.openById(IDEES_SPREADSHEET_ID);
    const sh = ss.getSheetByName('IDEES');
    const data = sh.getDataRange().getValues();
    
    // Récupérer les likes de l'utilisateur
    const likesSheet = ss.getSheetByName('LIKES');
    const likesData = likesSheet.getDataRange().getValues();
    const userLikes = new Set();
    
    for (let i = 1; i < likesData.length; i++) {
      if (String(likesData[i][1]).toLowerCase() === user.username.toLowerCase()) {
        userLikes.add(likesData[i][0]);
      }
    }
    
    // Récupérer le nombre de commentaires par idée
    const commentsSheet = ss.getSheetByName('COMMENTAIRES');
    const commentsData = commentsSheet.getDataRange().getValues();
    const commentCounts = {};
    
    for (let i = 1; i < commentsData.length; i++) {
      const idIdee = commentsData[i][1];
      commentCounts[idIdee] = (commentCounts[idIdee] || 0) + 1;
    }
    
    const idees = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      const statut = String(row[7] || 'ACTIVE');
      if (statut !== 'ACTIVE') continue;
      
      let dateISO = '';
      if (row[1] instanceof Date) {
        dateISO = row[1].toISOString();
      }
      
      const idIdee = String(row[0]);
      
      idees.push({
        id: idIdee,
        date: dateISO,
        username: String(row[2] || ''),
        nom: String(row[3] || ''),
        titre: String(row[4] || ''),
        description: String(row[5] || ''),
        likes: Number(row[6]) || 0,
        nbCommentaires: commentCounts[idIdee] || 0,
        userLiked: userLikes.has(idIdee),
        isAuthor: String(row[2]).toLowerCase() === user.username.toLowerCase()
      });
    }
    
    // Trier par date (plus récentes d'abord)
    idees.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return {ok: true, data: idees.slice(0, limit)};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiLikeIdee(token, idIdee) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    const ss = SpreadsheetApp.openById(IDEES_SPREADSHEET_ID);
    const likesSheet = ss.getSheetByName('LIKES');
    const likesData = likesSheet.getDataRange().getValues();
    
    // Vérifier si l'utilisateur a déjà liké
    let alreadyLiked = false;
    let likeRow = -1;
    
    for (let i = 1; i < likesData.length; i++) {
      if (likesData[i][0] === idIdee && String(likesData[i][1]).toLowerCase() === user.username.toLowerCase()) {
        alreadyLiked = true;
        likeRow = i + 1;
        break;
      }
    }
    
    const ideesSheet = ss.getSheetByName('IDEES');
    const ideesData = ideesSheet.getDataRange().getValues();
    
    // Trouver l'idée
    let ideeRow = -1;
    let currentLikes = 0;
    
    for (let i = 1; i < ideesData.length; i++) {
      if (ideesData[i][0] === idIdee) {
        ideeRow = i + 1;
        currentLikes = Number(ideesData[i][6]) || 0;
        break;
      }
    }
    
    if (ideeRow === -1) return {ok: false, msg: "Idée introuvable"};
    
    if (alreadyLiked) {
      // Retirer le like
      likesSheet.deleteRow(likeRow);
      ideesSheet.getRange(ideeRow, 7).setValue(Math.max(0, currentLikes - 1));
      return {ok: true, liked: false, likes: Math.max(0, currentLikes - 1)};
    } else {
      // Ajouter le like
      likesSheet.appendRow([idIdee, user.username, new Date()]);
      ideesSheet.getRange(ideeRow, 7).setValue(currentLikes + 1);
      return {ok: true, liked: true, likes: currentLikes + 1};
    }
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiPostCommentaire(token, idIdee, commentaire) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    commentaire = String(commentaire || "").trim();
    
    if (!commentaire) return {ok: false, msg: "Le commentaire est vide"};
    if (commentaire.length > 500) return {ok: false, msg: "Commentaire trop long (500 caractères max)"};
    
    const id = 'COM-' + Date.now();
    
    const ss = SpreadsheetApp.openById(IDEES_SPREADSHEET_ID);
    const sh = ss.getSheetByName('COMMENTAIRES');
    sh.appendRow([
      id,
      idIdee,
      new Date(),
      user.username,
      user.nom,
      commentaire
    ]);
    
    return {ok: true, msg: "Commentaire ajouté !", id: id};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiGetCommentaires(token, idIdee) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    const ss = SpreadsheetApp.openById(IDEES_SPREADSHEET_ID);
    const sh = ss.getSheetByName('COMMENTAIRES');
    const data = sh.getDataRange().getValues();
    
    const commentaires = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[1] !== idIdee) continue;
      
      let dateISO = '';
      if (row[2] instanceof Date) {
        dateISO = row[2].toISOString();
      }
      
      commentaires.push({
        id: String(row[0] || ''),
        date: dateISO,
        username: String(row[3] || ''),
        nom: String(row[4] || ''),
        commentaire: String(row[5] || ''),
        isAuthor: String(row[3]).toLowerCase() === user.username.toLowerCase()
      });
    }
    
    // Trier par date (plus anciens d'abord)
    commentaires.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return {ok: true, data: commentaires};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiDeleteIdee(token, idIdee) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    const ss = SpreadsheetApp.openById(IDEES_SPREADSHEET_ID);
    const sh = ss.getSheetByName('IDEES');
    const data = sh.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === idIdee) {
        // Vérifier que c'est l'auteur ou un admin
        if (String(data[i][2]).toLowerCase() !== user.username.toLowerCase() && user.role !== 'ADMIN') {
          return {ok: false, msg: "Vous ne pouvez pas supprimer cette idée"};
        }
        
        // Marquer comme supprimée (soft delete)
        sh.getRange(i + 1, 8).setValue('SUPPRIMEE');
        return {ok: true, msg: "Idée supprimée"};
      }
    }
    
    return {ok: false, msg: "Idée introuvable"};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

// ================================
// API GOODIES
// ================================

function apiGetGoodies(token) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    const ss = SpreadsheetApp.openById(GOODIES_SPREADSHEET_ID);
    const sh = ss.getSheetByName('GOODIES');
    const data = sh.getDataRange().getValues();
    
    const goodies = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      const stock = Number(row[3]) || 0;
      if (stock <= 0) continue; // Ne pas afficher si rupture
      
      goodies.push({
        code: String(row[0] || ''),
        nom: String(row[1] || ''),
        prix: Number(row[2]) || 0,
        stock: stock
      });
    }
    
    return {ok: true, data: goodies};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiGetGoodiesAdmins(token) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    const ss = SpreadsheetApp.openById(GOODIES_SPREADSHEET_ID);
    const sh = ss.getSheetByName('ADMINS');
    const data = sh.getDataRange().getValues();
    
    const admins = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0] || !row[1]) continue;
      
      admins.push({
        nom: String(row[0] || ''),
        whatsapp: String(row[1] || '')
      });
    }
    
    return {ok: true, data: admins};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiCommanderGoodies(token, codeGoodies, codeAdmin) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    // Vérifier si bloqué
    const blocage = checkUserBloque(user.username);
    if (blocage.bloque) {
      return {ok: false, msg: "Votre compte est bloqué"};
    }
    
    const ss = SpreadsheetApp.openById(GOODIES_SPREADSHEET_ID);
    
    // Récupérer le goodies
    const goodiesSheet = ss.getSheetByName('GOODIES');
    const goodiesData = goodiesSheet.getDataRange().getValues();
    
    let goodies = null;
    let goodiesRow = -1;
    
    for (let i = 1; i < goodiesData.length; i++) {
      if (goodiesData[i][0] === codeGoodies) {
        goodies = {
          code: goodiesData[i][0],
          nom: goodiesData[i][1],
          prix: Number(goodiesData[i][2]) || 0,
          stock: Number(goodiesData[i][3]) || 0
        };
        goodiesRow = i + 1;
        break;
      }
    }
    
    if (!goodies) return {ok: false, msg: "Goodies introuvable"};
    if (goodies.stock <= 0) return {ok: false, msg: "Rupture de stock"};
    
    // Récupérer l'admin
    const adminsSheet = ss.getSheetByName('ADMINS');
    const adminsData = adminsSheet.getDataRange().getValues();
    
    let admin = null;
    
    for (let i = 1; i < adminsData.length; i++) {
      if (adminsData[i][0] === codeAdmin) {
        admin = {
          nom: adminsData[i][0],
          whatsapp: String(adminsData[i][1] || '')
        };
        break;
      }
    }
    
    if (!admin) return {ok: false, msg: "Admin introuvable"};
    
    // Vérifier le solde
    const soldeActuel = Number(user.solde || 0);
    const nouveauSolde = soldeActuel - goodies.prix;
    
    if (nouveauSolde < 0 && !user.detteAutorisee) {
      return {ok: false, msg: "Solde insuffisant (" + soldeActuel.toFixed(2) + "€)"};
    }
    
    // Débiter le compte
    const usersSheet = getSheet(SHEETS.USERS);
    const usersData = usersSheet.getDataRange().getValues();
    
    for (let i = 1; i < usersData.length; i++) {
      if (String(usersData[i][0]).toLowerCase() === user.username.toLowerCase()) {
        usersSheet.getRange(i + 1, 4).setValue(nouveauSolde);
        break;
      }
    }
    
    // Décrémenter le stock
    goodiesSheet.getRange(goodiesRow, 4).setValue(goodies.stock - 1);
    
    // Enregistrer la commande
    const commandesSheet = ss.getSheetByName('COMMANDES');
    const idCommande = 'CMD-' + Date.now();
    
    commandesSheet.appendRow([
      idCommande,
      new Date(),
      user.username,
      user.nom,
      goodies.nom,
      goodies.prix,
      admin.nom,
      'EN ATTENTE'
    ]);
    
    // Enregistrer dans les transactions
    logTransaction(user.username, user.nom, 'GOODIES', goodies.nom, -goodies.prix, nouveauSolde, 'OK');
    
    return {
      ok: true,
      msg: "Commande enregistrée !",
      nouveauSolde: nouveauSolde,
      idCommande: idCommande,
      adminNom: admin.nom
    };
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiGetMesCommandes(token) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    const ss = SpreadsheetApp.openById(GOODIES_SPREADSHEET_ID);
    const sh = ss.getSheetByName('COMMANDES');
    const data = sh.getDataRange().getValues();
    
    const commandes = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (String(row[2]).toLowerCase() !== user.username.toLowerCase()) continue;
      
      let dateISO = '';
      if (row[1] instanceof Date) {
        dateISO = row[1].toISOString();
      }
      
      commandes.push({
        id: String(row[0] || ''),
        date: dateISO,
        goodies: String(row[4] || ''),
        prix: Number(row[5]) || 0,
        admin: String(row[6] || ''),
        statut: String(row[7] || 'EN ATTENTE')
      });
    }
    
    // Plus récentes d'abord
    commandes.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return {ok: true, data: commandes};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

// ================================
// API SONDAGES
// ================================

function apiGetSondages(token) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    const ss = SpreadsheetApp.openById(SONDAGES_SPREADSHEET_ID);
    const sh = ss.getSheetByName('SONDAGES');
    if (!sh) return {ok: true, data: []};
    
    const data = sh.getDataRange().getValues();
    if (data.length <= 1) return {ok: true, data: []};
    
    const optionsSheet = ss.getSheetByName('SONDAGES_OPTIONS');
    const votesSheet = ss.getSheetByName('SONDAGES_VOTES');
    
    const optionsData = optionsSheet ? optionsSheet.getDataRange().getValues() : [];
    const votesData = votesSheet ? votesSheet.getDataRange().getValues() : [];
    
    const now = new Date();
    const sondages = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      const actif = row[6] === true || row[6] === 'TRUE' || row[6] === 'ACTIF';
      if (!actif) continue;
      
      const dateFin = row[5];
      if (dateFin instanceof Date && dateFin < now) continue;
      
      const idSondage = String(row[0]);
      
      // Récupérer les options
      const options = [];
      for (let j = 1; j < optionsData.length; j++) {
        if (String(optionsData[j][1]) === idSondage) {
          const idOption = String(optionsData[j][0]);
          
          // Compter les votes pour cette option
          let nbVotes = 0;
          for (let k = 1; k < votesData.length; k++) {
            if (String(votesData[k][1]) === idOption) {
              nbVotes++;
            }
          }
          
          options.push({
            id: idOption,
            texte: String(optionsData[j][2] || ''),
            votes: nbVotes
          });
        }
      }
      
      // Vérifier si l'utilisateur a voté
      const userVotes = [];
      for (let k = 1; k < votesData.length; k++) {
        if (String(votesData[k][0]) === idSondage && String(votesData[k][2]).toLowerCase() === user.username.toLowerCase()) {
          userVotes.push(String(votesData[k][1]));
        }
      }
      
      let dateFinISO = '';
      if (dateFin instanceof Date) {
        dateFinISO = dateFin.toISOString();
      }
      
      let dateCreationISO = '';
      if (row[4] instanceof Date) {
        dateCreationISO = row[4].toISOString();
      }
      
      sondages.push({
        id: idSondage,
        titre: String(row[1] || ''),
        description: String(row[2] || ''),
        type: String(row[3] || 'unique'), // unique ou multiple
        dateCreation: dateCreationISO,
        dateFin: dateFinISO,
        options: options,
        userVotes: userVotes,
        hasVoted: userVotes.length > 0
      });
    }
    
    // Trier par date de création (plus récentes d'abord)
    sondages.sort((a, b) => new Date(b.dateCreation) - new Date(a.dateCreation));
    
    return {ok: true, data: sondages};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiVoterSondage(token, idSondage, idOptions) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    if (!idSondage || !idOptions || !Array.isArray(idOptions) || idOptions.length === 0) {
      return {ok: false, msg: "Données de vote invalides"};
    }
    
    const ss = SpreadsheetApp.openById(SONDAGES_SPREADSHEET_ID);
    const sh = ss.getSheetByName('SONDAGES');
    const data = sh.getDataRange().getValues();
    
    // Vérifier que le sondage existe et est actif
    let sondage = null;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === idSondage) {
        const actif = data[i][6] === true || data[i][6] === 'TRUE' || data[i][6] === 'ACTIF';
        if (!actif) return {ok: false, msg: "Ce sondage n'est plus actif"};
        
        const dateFin = data[i][5];
        if (dateFin instanceof Date && dateFin < new Date()) {
          return {ok: false, msg: "Ce sondage est terminé"};
        }
        
        sondage = {
          type: String(data[i][3] || 'unique')
        };
        break;
      }
    }
    
    if (!sondage) return {ok: false, msg: "Sondage introuvable"};
    
    // Vérifier le type de vote
    if (sondage.type === 'unique' && idOptions.length > 1) {
      return {ok: false, msg: "Ce sondage n'accepte qu'un seul choix"};
    }
    
    const votesSheet = ss.getSheetByName('SONDAGES_VOTES');
    const votesData = votesSheet.getDataRange().getValues();
    
    // Supprimer les anciens votes de l'utilisateur pour ce sondage
    const rowsToDelete = [];
    for (let i = 1; i < votesData.length; i++) {
      if (String(votesData[i][0]) === idSondage && String(votesData[i][2]).toLowerCase() === user.username.toLowerCase()) {
        rowsToDelete.push(i + 1);
      }
    }
    
    // Supprimer en partant de la fin pour ne pas décaler les indices
    for (let i = rowsToDelete.length - 1; i >= 0; i--) {
      votesSheet.deleteRow(rowsToDelete[i]);
    }
    
    // Ajouter les nouveaux votes
    const now = new Date();
    idOptions.forEach(function(idOption) {
      votesSheet.appendRow([idSondage, idOption, user.username, now]);
    });
    
    return {ok: true, msg: "Vote enregistré !"};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiAdminCreateSondage(token, titre, description, type, options, dateFin) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    titre = String(titre || "").trim();
    description = String(description || "").trim();
    type = String(type || "unique").toLowerCase();
    
    if (!titre) return {ok: false, msg: "Le titre est requis"};
    if (!options || !Array.isArray(options) || options.length < 2) {
      return {ok: false, msg: "Au moins 2 options sont requises"};
    }
    if (type !== 'unique' && type !== 'multiple') {
      type = 'unique';
    }
    
    const idSondage = 'SOND-' + Date.now();
    const now = new Date();
    
    // Créer le sondage
    const ss = SpreadsheetApp.openById(SONDAGES_SPREADSHEET_ID);
    const sh = ss.getSheetByName('SONDAGES');
    sh.appendRow([idSondage, titre, description, type, now, dateFin || '', 'ACTIF']);
    
    // Créer les options
    const optionsSheet = ss.getSheetByName('SONDAGES_OPTIONS');
    options.forEach(function(optionText, index) {
      const idOption = idSondage + '-OPT' + (index + 1);
      optionsSheet.appendRow([idOption, idSondage, String(optionText).trim()]);
    });
    
    return {ok: true, msg: "Sondage créé !", id: idSondage};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiAdminCloseSondage(token, idSondage) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    const ss = SpreadsheetApp.openById(SONDAGES_SPREADSHEET_ID);
    const sh = ss.getSheetByName('SONDAGES');
    const data = sh.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === idSondage) {
        sh.getRange(i + 1, 7).setValue('CLOS');
        return {ok: true, msg: "Sondage clôturé"};
      }
    }
    
    return {ok: false, msg: "Sondage introuvable"};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

// ================================
// API EVENEMENTS
// ================================

function apiGetEvenements(token) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    const ss = SpreadsheetApp.openById(EVENEMENTS_SPREADSHEET_ID);
    const sh = ss.getSheetByName('EVENEMENTS');
    if (!sh) return {ok: true, data: []};
    
    const data = sh.getDataRange().getValues();
    if (data.length <= 1) return {ok: true, data: []};
    
    const inscriptionsSheet = ss.getSheetByName('EVENEMENTS_INSCRIPTIONS');
    const inscriptionsData = inscriptionsSheet ? inscriptionsSheet.getDataRange().getValues() : [];
    
    const now = new Date();
    const evenements = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      const actif = row[8] === true || row[8] === 'TRUE' || row[8] === 'ACTIF';
      if (!actif) continue;
      
      const idEvent = String(row[0]);
      const dateEvent = row[3];
      
      // Compter les inscriptions
      let nbInscrits = 0;
      let userInscrit = false;
      
      for (let j = 1; j < inscriptionsData.length; j++) {
        if (String(inscriptionsData[j][1]) === idEvent) {
          nbInscrits++;
          if (String(inscriptionsData[j][2]).toLowerCase() === user.username.toLowerCase()) {
            userInscrit = true;
          }
        }
      }
      
      let dateEventISO = '';
      if (dateEvent instanceof Date) {
        dateEventISO = dateEvent.toISOString();
      }
      
      const prixNormal = Number(row[6]) || 0;
      const prixCotisant = Number(row[7]) || 0;
      const prixUser = user.cotisant ? prixCotisant : prixNormal;
      
      evenements.push({
        id: idEvent,
        titre: String(row[1] || ''),
        description: String(row[2] || ''),
        dateEvent: dateEventISO,
        lieu: String(row[4] || ''),
        inscriptionRequise: row[5] === true || row[5] === 'TRUE' || row[5] === 'OUI',
        prixNormal: prixNormal,
        prixCotisant: prixCotisant,
        prixUser: prixUser,
        gratuit: prixNormal === 0 && prixCotisant === 0,
        nbInscrits: nbInscrits,
        userInscrit: userInscrit,
        isPast: dateEvent instanceof Date && dateEvent < now
      });
    }
    
    // Trier par date (prochains d'abord)
    evenements.sort((a, b) => new Date(a.dateEvent) - new Date(b.dateEvent));
    
    return {ok: true, data: evenements};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiInscrireEvenement(token, idEvenement) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    const ss = SpreadsheetApp.openById(EVENEMENTS_SPREADSHEET_ID);
    const sh = ss.getSheetByName('EVENEMENTS');
    const data = sh.getDataRange().getValues();
    
    let evenement = null;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === idEvenement) {
        evenement = {
          titre: data[i][1],
          prixNormal: Number(data[i][6]) || 0,
          prixCotisant: Number(data[i][7]) || 0
        };
        break;
      }
    }
    
    if (!evenement) return {ok: false, msg: "Événement introuvable"};
    
    const inscriptionsSheet = ss.getSheetByName('EVENEMENTS_INSCRIPTIONS');
    const inscriptionsData = inscriptionsSheet.getDataRange().getValues();
    
    // Vérifier si déjà inscrit
    for (let i = 1; i < inscriptionsData.length; i++) {
      if (String(inscriptionsData[i][1]) === idEvenement && 
          String(inscriptionsData[i][2]).toLowerCase() === user.username.toLowerCase()) {
        return {ok: false, msg: "Vous êtes déjà inscrit(e) à cet événement"};
      }
    }
    
    // Calculer le prix
    const prix = user.cotisant ? evenement.prixCotisant : evenement.prixNormal;
    
    // Vérifier le solde si payant
    if (prix > 0) {
      const soldeActuel = Number(user.solde || 0);
      const nouveauSolde = soldeActuel - prix;
      
      if (nouveauSolde < 0 && !user.detteAutorisee) {
        return {ok: false, msg: "Solde insuffisant (" + soldeActuel.toFixed(2) + "€)"};
      }
      
      // Débiter le compte
      const usersSheet = getSheet(SHEETS.USERS);
      const rowIndex = findRowIndex(SHEETS.USERS, r => String(r[0]).toLowerCase() === user.username.toLowerCase());
      updateCell(SHEETS.USERS, rowIndex, 4, nouveauSolde);
      
      // Log transaction
      logTransaction(user.username, user.nom, 'EVENT', evenement.titre, -prix, nouveauSolde, 'OK');
    }
    
    // Créer l'inscription
    const idInscription = 'INSC-' + Date.now();
    inscriptionsSheet.appendRow([idInscription, idEvenement, user.username, new Date(), prix]);
    
    return {ok: true, msg: "Inscription confirmée !", prix: prix};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiDesinscrireEvenement(token, idEvenement) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    const ss = SpreadsheetApp.openById(EVENEMENTS_SPREADSHEET_ID);
    const inscriptionsSheet = ss.getSheetByName('EVENEMENTS_INSCRIPTIONS');
    const inscriptionsData = inscriptionsSheet.getDataRange().getValues();
    
    for (let i = 1; i < inscriptionsData.length; i++) {
      if (String(inscriptionsData[i][1]) === idEvenement && 
          String(inscriptionsData[i][2]).toLowerCase() === user.username.toLowerCase()) {
        
        const montantPaye = Number(inscriptionsData[i][4]) || 0;
        
        // Rembourser si payant
        if (montantPaye > 0) {
          const usersSheet = getSheet(SHEETS.USERS);
          const rowIndex = findRowIndex(SHEETS.USERS, r => String(r[0]).toLowerCase() === user.username.toLowerCase());
          const currentSolde = Number(user.solde || 0);
          const nouveauSolde = currentSolde + montantPaye;
          
          updateCell(SHEETS.USERS, rowIndex, 4, nouveauSolde);
          logTransaction(user.username, user.nom, 'EVENT-REMB', 'Remboursement événement', montantPaye, nouveauSolde, 'OK');
        }
        
        inscriptionsSheet.deleteRow(i + 1);
        return {ok: true, msg: "Désinscription effectuée", remboursement: montantPaye};
      }
    }
    
    return {ok: false, msg: "Inscription introuvable"};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiAdminCreateEvenement(token, titre, description, dateEvent, lieu, inscriptionRequise, prixNormal, prixCotisant) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    titre = String(titre || "").trim();
    description = String(description || "").trim();
    lieu = String(lieu || "").trim();
    prixNormal = Number(prixNormal) || 0;
    prixCotisant = Number(prixCotisant) || 0;
    
    if (!titre) return {ok: false, msg: "Le titre est requis"};
    if (!dateEvent) return {ok: false, msg: "La date est requise"};
    
    const idEvent = 'EVT-' + Date.now();
    
    const ss = SpreadsheetApp.openById(EVENEMENTS_SPREADSHEET_ID);
    const sh = ss.getSheetByName('EVENEMENTS');
    sh.appendRow([
      idEvent,
      titre,
      description,
      new Date(dateEvent),
      lieu,
      inscriptionRequise === true || inscriptionRequise === 'true',
      prixNormal,
      prixCotisant,
      'ACTIF'
    ]);
    
    return {ok: true, msg: "Événement créé !", id: idEvent};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiAdminDeleteEvenement(token, idEvenement) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    const ss = SpreadsheetApp.openById(EVENEMENTS_SPREADSHEET_ID);
    const sh = ss.getSheetByName('EVENEMENTS');
    const data = sh.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === idEvenement) {
        sh.getRange(i + 1, 9).setValue('SUPPRIME');
        return {ok: true, msg: "Événement supprimé"};
      }
    }
    
    return {ok: false, msg: "Événement introuvable"};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

// ================================
// API MASCOTTES (CROCOS)
// ================================

function apiGetMascottes(token) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    const ss = SpreadsheetApp.openById(MASCOTTES_SPREADSHEET_ID);
    const sh = ss.getSheetByName('MASCOTTES');
    if (!sh) return {ok: true, data: []};
    
    const data = sh.getDataRange().getValues();
    if (data.length <= 1) return {ok: true, data: []};
    
    const reservationsSheet = ss.getSheetByName('MASCOTTES_RESERVATIONS');
    const reservationsData = reservationsSheet ? reservationsSheet.getDataRange().getValues() : [];
    
    const now = new Date();
    const mascottes = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      const idMascotte = String(row[0]);
      
      // Vérifier les réservations en cours
      let reservationActuelle = null;
      let prochainesDispo = null;
      const reservations = [];
      
      for (let j = 1; j < reservationsData.length; j++) {
        if (String(reservationsData[j][1]) === idMascotte) {
          const dateDebut = reservationsData[j][3];
          const dateFin = reservationsData[j][4];
          const statut = String(reservationsData[j][5] || '');
          
          if (statut === 'ANNULEE') continue;
          
          const resa = {
            id: String(reservationsData[j][0]),
            username: String(reservationsData[j][2]),
            dateDebut: dateDebut instanceof Date ? dateDebut.toISOString() : '',
            dateFin: dateFin instanceof Date ? dateFin.toISOString() : '',
            statut: statut
          };
          
          reservations.push(resa);
          
          // Réservation en cours ?
          if (dateDebut instanceof Date && dateFin instanceof Date) {
            if (dateDebut <= now && dateFin >= now && statut === 'CONFIRMEE') {
              reservationActuelle = resa;
            }
          }
        }
      }
      
      // Ma réservation en cours ?
      let maReservation = null;
      for (let j = 0; j < reservations.length; j++) {
        if (reservations[j].username.toLowerCase() === user.username.toLowerCase() && 
            reservations[j].statut !== 'TERMINEE') {
          maReservation = reservations[j];
          break;
        }
      }
      
      mascottes.push({
        id: idMascotte,
        nom: String(row[1] || ''),
        description: String(row[2] || ''),
        disponible: !reservationActuelle,
        reservationActuelle: reservationActuelle,
        maReservation: maReservation,
        reservations: reservations
      });
    }
    
    return {ok: true, data: mascottes};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiReserverMascotte(token, idMascotte, dateDebut, dateFin) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    if (!dateDebut || !dateFin) {
      return {ok: false, msg: "Les dates sont requises"};
    }
    
    const debut = new Date(dateDebut);
    const fin = new Date(dateFin);
    
    if (fin <= debut) {
      return {ok: false, msg: "La date de fin doit être après la date de début"};
    }
    
    // Vérifier que la mascotte existe
    const ss = SpreadsheetApp.openById(MASCOTTES_SPREADSHEET_ID);
    const sh = ss.getSheetByName('MASCOTTES');
    const data = sh.getDataRange().getValues();
    
    let mascotte = null;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === idMascotte) {
        mascotte = { nom: data[i][1] };
        break;
      }
    }
    
    if (!mascotte) return {ok: false, msg: "Mascotte introuvable"};
    
    // Vérifier les conflits de réservation
    const reservationsSheet = ss.getSheetByName('MASCOTTES_RESERVATIONS');
    const reservationsData = reservationsSheet.getDataRange().getValues();
    
    for (let i = 1; i < reservationsData.length; i++) {
      if (String(reservationsData[i][1]) === idMascotte) {
        const statut = String(reservationsData[i][5] || '');
        if (statut === 'ANNULEE' || statut === 'TERMINEE') continue;
        
        const resaDebut = reservationsData[i][3];
        const resaFin = reservationsData[i][4];
        
        if (resaDebut instanceof Date && resaFin instanceof Date) {
          // Vérifier le chevauchement
          if (debut < resaFin && fin > resaDebut) {
            return {ok: false, msg: "Cette mascotte est déjà réservée pour cette période"};
          }
        }
      }
    }
    
    // Créer la réservation
    const idReservation = 'RESA-' + Date.now();
    reservationsSheet.appendRow([
      idReservation,
      idMascotte,
      user.username,
      debut,
      fin,
      'CONFIRMEE'
    ]);
    
    return {ok: true, msg: mascotte.nom + " réservé(e) !", id: idReservation};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiAnnulerReservationMascotte(token, idReservation) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    const ss = SpreadsheetApp.openById(MASCOTTES_SPREADSHEET_ID);
    const reservationsSheet = ss.getSheetByName('MASCOTTES_RESERVATIONS');
    const reservationsData = reservationsSheet.getDataRange().getValues();
    
    for (let i = 1; i < reservationsData.length; i++) {
      if (String(reservationsData[i][0]) === idReservation) {
        // Vérifier que c'est bien la réservation de l'utilisateur (ou admin)
        if (String(reservationsData[i][2]).toLowerCase() !== user.username.toLowerCase() && user.role !== 'ADMIN') {
          return {ok: false, msg: "Vous ne pouvez pas annuler cette réservation"};
        }
        
        reservationsSheet.getRange(i + 1, 6).setValue('ANNULEE');
        return {ok: true, msg: "Réservation annulée"};
      }
    }
    
    return {ok: false, msg: "Réservation introuvable"};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiAdminCreateMascotte(token, nom, description) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    nom = String(nom || "").trim();
    description = String(description || "").trim();
    
    if (!nom) return {ok: false, msg: "Le nom est requis"};
    
    const idMascotte = 'MASC-' + Date.now();
    
    const ss = SpreadsheetApp.openById(MASCOTTES_SPREADSHEET_ID);
    const sh = ss.getSheetByName('MASCOTTES');
    sh.appendRow([idMascotte, nom, description, true]);
    
    return {ok: true, msg: "Mascotte créée !", id: idMascotte};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

// ================================
// API TEASERS (PRODUITS À VENIR)
// ================================

function apiGetTeasers(token) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    const ss = SpreadsheetApp.openById(GOODIES_SPREADSHEET_ID);
    const sh = ss.getSheetByName('TEASERS');
    if (!sh) return {ok: true, data: []};
    
    const data = sh.getDataRange().getValues();
    if (data.length <= 1) return {ok: true, data: []};
    
    const precoSheet = ss.getSheetByName('TEASERS_PRECOMMANDES');
    const precoData = precoSheet ? precoSheet.getDataRange().getValues() : [];
    
    const teasers = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      const actif = row[6] === true || row[6] === 'TRUE' || row[6] === 'ACTIF';
      if (!actif) continue;
      
      const idTeaser = String(row[0]);
      
      // Compter les précommandes
      let nbPrecommandes = 0;
      let userPrecommande = false;
      let userPrecommandePaid = false;
      
      for (let j = 1; j < precoData.length; j++) {
        if (String(precoData[j][1]) === idTeaser) {
          nbPrecommandes++;
          if (String(precoData[j][2]).toLowerCase() === user.username.toLowerCase()) {
            userPrecommande = true;
            // Column 4 is payment status (PAYE or empty)
            userPrecommandePaid = String(precoData[j][4] || '').toUpperCase() === 'PAYE';
          }
        }
      }
      
      let dateSortieISO = '';
      if (row[3] instanceof Date) {
        dateSortieISO = row[3].toISOString();
      }
      
      teasers.push({
        id: idTeaser,
        nom: String(row[1] || ''),
        description: String(row[2] || ''),
        dateSortie: dateSortieISO,
        precommandePossible: row[4] === true || row[4] === 'TRUE' || row[4] === 'OUI',
        prix: Number(row[5]) || 0,
        nbPrecommandes: nbPrecommandes,
        userPrecommande: userPrecommande,
        userPrecommandePaid: userPrecommandePaid
      });
    }
    
    // Trier par date de sortie (prochains d'abord)
    teasers.sort((a, b) => new Date(a.dateSortie) - new Date(b.dateSortie));
    
    return {ok: true, data: teasers};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiPrecommanderTeaser(token, idTeaser) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    const ss = SpreadsheetApp.openById(GOODIES_SPREADSHEET_ID);
    const sh = ss.getSheetByName('TEASERS');
    const data = sh.getDataRange().getValues();
    
    let teaser = null;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === idTeaser) {
        const precommandePossible = data[i][4] === true || data[i][4] === 'TRUE' || data[i][4] === 'OUI';
        if (!precommandePossible) {
          return {ok: false, msg: "Les précommandes ne sont pas ouvertes pour ce produit"};
        }
        teaser = { nom: data[i][1] };
        break;
      }
    }
    
    if (!teaser) return {ok: false, msg: "Produit introuvable"};
    
    const precoSheet = ss.getSheetByName('TEASERS_PRECOMMANDES');
    const precoData = precoSheet.getDataRange().getValues();
    
    // Vérifier si déjà précommandé
    for (let i = 1; i < precoData.length; i++) {
      if (String(precoData[i][1]) === idTeaser && 
          String(precoData[i][2]).toLowerCase() === user.username.toLowerCase()) {
        return {ok: false, msg: "Vous avez déjà précommandé ce produit"};
      }
    }
    
    // Créer la précommande
    const idPreco = 'PRECO-' + Date.now();
    precoSheet.appendRow([idPreco, idTeaser, user.username, new Date()]);
    
    return {ok: true, msg: "Précommande enregistrée pour " + teaser.nom + " !"};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiAnnulerPrecommande(token, idTeaser) {
  try {
    const user = getUserByToken(token);
    if (!user) return {ok: false, msg: "Session expirée"};
    
    const ss = SpreadsheetApp.openById(GOODIES_SPREADSHEET_ID);
    const precoSheet = ss.getSheetByName('TEASERS_PRECOMMANDES');
    const precoData = precoSheet.getDataRange().getValues();
    
    for (let i = 1; i < precoData.length; i++) {
      if (String(precoData[i][1]) === idTeaser && 
          String(precoData[i][2]).toLowerCase() === user.username.toLowerCase()) {
        precoSheet.deleteRow(i + 1);
        return {ok: true, msg: "Précommande annulée"};
      }
    }
    
    return {ok: false, msg: "Précommande introuvable"};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

// Admin: Get all precommandes for a teaser
function apiAdminGetPrecommandes(token, idTeaser) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    const ss = SpreadsheetApp.openById(GOODIES_SPREADSHEET_ID);
    const precoSheet = ss.getSheetByName('TEASERS_PRECOMMANDES');
    if (!precoSheet) return {ok: true, data: []};
    
    const precoData = precoSheet.getDataRange().getValues();
    const usersSheet = getSheet(SHEETS.USERS);
    const usersData = usersSheet.getDataRange().getValues();
    
    // Build users map
    const usersMap = {};
    for (let i = 1; i < usersData.length; i++) {
      usersMap[String(usersData[i][0]).toLowerCase()] = String(usersData[i][1] || usersData[i][0]);
    }
    
    const precommandes = [];
    
    for (let i = 1; i < precoData.length; i++) {
      if (!idTeaser || String(precoData[i][1]) === idTeaser) {
        const username = String(precoData[i][2] || '');
        precommandes.push({
          id: String(precoData[i][0]),
          idTeaser: String(precoData[i][1]),
          username: username,
          nom: usersMap[username.toLowerCase()] || username,
          date: precoData[i][3] instanceof Date ? precoData[i][3].toISOString() : '',
          paid: String(precoData[i][4] || '').toUpperCase() === 'PAYE',
          rowIndex: i + 1
        });
      }
    }
    
    return {ok: true, data: precommandes};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

// Admin: Mark precommande as paid
function apiAdminMarkPrecommandePaid(token, idPrecommande, paid) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    const ss = SpreadsheetApp.openById(GOODIES_SPREADSHEET_ID);
    const precoSheet = ss.getSheetByName('TEASERS_PRECOMMANDES');
    const precoData = precoSheet.getDataRange().getValues();
    
    for (let i = 1; i < precoData.length; i++) {
      if (String(precoData[i][0]) === idPrecommande) {
        // Ensure column E exists (payment status)
        precoSheet.getRange(i + 1, 5).setValue(paid ? 'PAYE' : '');
        return {ok: true, msg: paid ? "Marqué comme payé" : "Marqué comme non payé"};
      }
    }
    
    return {ok: false, msg: "Précommande introuvable"};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

// Admin: Get all precommandes grouped by teaser
function apiAdminGetAllPrecommandes(token) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    const ss = SpreadsheetApp.openById(GOODIES_SPREADSHEET_ID);
    
    // Get teasers
    const teasersSheet = ss.getSheetByName('TEASERS');
    const teasersData = teasersSheet ? teasersSheet.getDataRange().getValues() : [];
    
    const teasersMap = {};
    for (let i = 1; i < teasersData.length; i++) {
      const id = String(teasersData[i][0]);
      teasersMap[id] = {
        nom: String(teasersData[i][1] || ''),
        prix: Number(teasersData[i][5]) || 0
      };
    }
    
    // Get precommandes
    const precoSheet = ss.getSheetByName('TEASERS_PRECOMMANDES');
    if (!precoSheet) return {ok: true, data: []};
    
    const precoData = precoSheet.getDataRange().getValues();
    
    // Get users for names
    const usersSheet = getSheet(SHEETS.USERS);
    const usersData = usersSheet.getDataRange().getValues();
    const usersMap = {};
    for (let i = 1; i < usersData.length; i++) {
      usersMap[String(usersData[i][0]).toLowerCase()] = String(usersData[i][1] || usersData[i][0]);
    }
    
    const precommandes = [];
    
    for (let i = 1; i < precoData.length; i++) {
      const idTeaser = String(precoData[i][1]);
      const username = String(precoData[i][2] || '');
      const teaser = teasersMap[idTeaser] || { nom: 'Inconnu', prix: 0 };
      
      precommandes.push({
        id: String(precoData[i][0]),
        idTeaser: idTeaser,
        teaserNom: teaser.nom,
        teaserPrix: teaser.prix,
        username: username,
        nom: usersMap[username.toLowerCase()] || username,
        date: precoData[i][3] instanceof Date ? precoData[i][3].toISOString() : '',
        paid: String(precoData[i][4] || '').toUpperCase() === 'PAYE'
      });
    }
    
    // Sort by date descending
    precommandes.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return {ok: true, data: precommandes};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiAdminCreateTeaser(token, nom, description, dateSortie, precommandePossible, prix) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    nom = String(nom || "").trim();
    description = String(description || "").trim();
    prix = Number(prix) || 0;
    
    if (!nom) return {ok: false, msg: "Le nom est requis"};
    
    const idTeaser = 'TEAS-' + Date.now();
    
    const ss = SpreadsheetApp.openById(GOODIES_SPREADSHEET_ID);
    const sh = ss.getSheetByName('TEASERS');
    sh.appendRow([
      idTeaser,
      nom,
      description,
      dateSortie ? new Date(dateSortie) : '',
      precommandePossible === true || precommandePossible === 'true',
      prix,
      'ACTIF'
    ]);
    
    return {ok: true, msg: "Teaser créé !", id: idTeaser};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

function apiAdminDeleteTeaser(token, idTeaser) {
  try {
    if (!isAdmin(token)) return {ok: false, msg: "Accès non autorisé"};
    
    const ss = SpreadsheetApp.openById(GOODIES_SPREADSHEET_ID);
    const sh = ss.getSheetByName('TEASERS');
    const data = sh.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === idTeaser) {
        sh.getRange(i + 1, 7).setValue('SUPPRIME');
        return {ok: true, msg: "Teaser supprimé"};
      }
    }
    
    return {ok: false, msg: "Teaser introuvable"};
    
  } catch (error) {
    return {ok: false, msg: "Erreur : " + error.message};
  }
}

// ================================
// FONCTION POUR CRÉER LES FEUILLES
// ================================

function setupNewSheets() {
  // Créer les feuilles dans le spreadsheet Sondages
  try {
    const sondagesSS = SpreadsheetApp.openById(SONDAGES_SPREADSHEET_ID);
    const sondagesSheets = [
      { name: 'SONDAGES', headers: ['ID', 'TITRE', 'DESCRIPTION', 'TYPE', 'DATE_CREATION', 'DATE_FIN', 'STATUT'] },
      { name: 'SONDAGES_OPTIONS', headers: ['ID', 'ID_SONDAGE', 'TEXTE'] },
      { name: 'SONDAGES_VOTES', headers: ['ID_SONDAGE', 'ID_OPTION', 'USERNAME', 'DATE'] }
    ];
    sondagesSheets.forEach(function(sheetConfig) {
      let sheet = sondagesSS.getSheetByName(sheetConfig.name);
      if (!sheet) {
        sheet = sondagesSS.insertSheet(sheetConfig.name);
        sheet.getRange(1, 1, 1, sheetConfig.headers.length).setValues([sheetConfig.headers]);
        sheet.getRange(1, 1, 1, sheetConfig.headers.length).setFontWeight('bold');
      }
    });
  } catch (e) { Logger.log('Erreur Sondages: ' + e.message); }
  
  // Créer les feuilles dans le spreadsheet Événements
  try {
    const eventsSS = SpreadsheetApp.openById(EVENEMENTS_SPREADSHEET_ID);
    const eventsSheets = [
      { name: 'EVENEMENTS', headers: ['ID', 'TITRE', 'DESCRIPTION', 'DATE_EVENT', 'LIEU', 'INSCRIPTION_REQUISE', 'PRIX_NORMAL', 'PRIX_COTISANT', 'STATUT'] },
      { name: 'EVENEMENTS_INSCRIPTIONS', headers: ['ID', 'ID_EVENEMENT', 'USERNAME', 'DATE_INSCRIPTION', 'MONTANT'] }
    ];
    eventsSheets.forEach(function(sheetConfig) {
      let sheet = eventsSS.getSheetByName(sheetConfig.name);
      if (!sheet) {
        sheet = eventsSS.insertSheet(sheetConfig.name);
        sheet.getRange(1, 1, 1, sheetConfig.headers.length).setValues([sheetConfig.headers]);
        sheet.getRange(1, 1, 1, sheetConfig.headers.length).setFontWeight('bold');
      }
    });
  } catch (e) { Logger.log('Erreur Événements: ' + e.message); }
  
  // Créer les feuilles dans le spreadsheet Mascottes
  try {
    const mascottesSS = SpreadsheetApp.openById(MASCOTTES_SPREADSHEET_ID);
    const mascottesSheets = [
      { name: 'MASCOTTES', headers: ['ID', 'NOM', 'DESCRIPTION', 'DISPONIBLE'] },
      { name: 'MASCOTTES_RESERVATIONS', headers: ['ID', 'ID_MASCOTTE', 'USERNAME', 'DATE_DEBUT', 'DATE_FIN', 'STATUT'] }
    ];
    mascottesSheets.forEach(function(sheetConfig) {
      let sheet = mascottesSS.getSheetByName(sheetConfig.name);
      if (!sheet) {
        sheet = mascottesSS.insertSheet(sheetConfig.name);
        sheet.getRange(1, 1, 1, sheetConfig.headers.length).setValues([sheetConfig.headers]);
        sheet.getRange(1, 1, 1, sheetConfig.headers.length).setFontWeight('bold');
      }
    });
  } catch (e) { Logger.log('Erreur Mascottes: ' + e.message); }
  
  // Créer les feuilles Teasers dans le spreadsheet Goodies
  try {
    const goodiesSS = SpreadsheetApp.openById(GOODIES_SPREADSHEET_ID);
    const teasersSheets = [
      { name: 'TEASERS', headers: ['ID', 'NOM', 'DESCRIPTION', 'DATE_SORTIE', 'PRECOMMANDE_POSSIBLE', 'PRIX', 'STATUT'] },
      { name: 'TEASERS_PRECOMMANDES', headers: ['ID', 'ID_TEASER', 'USERNAME', 'DATE'] }
    ];
    teasersSheets.forEach(function(sheetConfig) {
      let sheet = goodiesSS.getSheetByName(sheetConfig.name);
      if (!sheet) {
        sheet = goodiesSS.insertSheet(sheetConfig.name);
        sheet.getRange(1, 1, 1, sheetConfig.headers.length).setValues([sheetConfig.headers]);
        sheet.getRange(1, 1, 1, sheetConfig.headers.length).setFontWeight('bold');
      }
    });
  } catch (e) { Logger.log('Erreur Teasers: ' + e.message); }
  
  // Ajouter la colonne COTISANT à UTILISATEUR si elle n'existe pas
  try {
    const ss = getSS();
    const usersSheet = ss.getSheetByName(SHEETS.USERS);
    if (usersSheet) {
      const headers = usersSheet.getRange(1, 1, 1, usersSheet.getLastColumn()).getValues()[0];
      if (!headers.includes('COTISANT')) {
        usersSheet.getRange(1, headers.length + 1).setValue('COTISANT');
      }
    }
  } catch (e) { Logger.log('Erreur COTISANT: ' + e.message); }
  
  return { ok: true, msg: "Feuilles créées avec succès !" };
}