const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const http = require('http'); // Ajout de cette ligne
const WebSocket = require('ws');
const fs = require('fs');
const fileUpload = require('express-fileupload');
// const upload = multer({ dest: 'uploads/' });
const router = express.Router();
const cors = require('cors');

const app = express();

const calendrierPath = path.join(__dirname, '../frontend/data/calendrier.json');
const DATA_FILE = path.join(__dirname, 'tournamentData.json');
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Stockage des données en mémoire
let liveTournamentData = {
    groupes: {},
    arbre: {}
};

let tournamentData = {};
// try {
//     tournamentData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
// } catch (err) {
//     tournamentData = {
//         groupes: { A: [], B: [], C: [], D: [] },
//         arbre: {
//             quarts: [], 
//             demis: [], 
//             finale: {}, 
//             vainqueur: {}
//         }
//     };
// }

function initDataFile() {
    if (!fs.existsSync(DATA_FILE)) {
        const defaultData = {
            groupes: {
                A: Array(4).fill({ id: "", nom: "", points: 0 }),
                B: Array(4).fill({ id: "", nom: "", points: 0 }),
                C: Array(4).fill({ id: "", nom: "", points: 0 }),
                D: Array(4).fill({ id: "", nom: "", points: 0 })
            },
            quarts: Array(4).fill({ equipe1: '', nom1: '', equipe2: '', nom2: '' }),
            demis: Array(2).fill({ equipe1: '', nom1: '', equipe2: '', nom2: '' }),
            finale: { equipe1: '', nom1: '', equipe2: '', nom2: '' },
            vainqueur: { id: '', nom: '' },
            equipesDetails: [],
            lastUpdated: new Date().toISOString()
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
    }
}
initDataFile();



// Middleware
app.use(express.static(path.join(__dirname, '../frontend')));
// app.use('/images', express.static(path.join(__dirname, '../frontend/images')));
// app.use('/assets', express.static(path.join(__dirname, '../frontend/assets')));
// app.use('/views', express.static(path.join(__dirname, '../frontend/views')));
// app.use('/js', express.static(path.join(__dirname, 'frontend/assets/js')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(fileUpload());
app.use(express.json());

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Connexion à la base de données SQLite
const db = new sqlite3.Database(path.join(__dirname, 'database', 'championnat.db'), (err) => {
    if (err) {
        console.error('Erreur de connexion à la base de données:', err.message);
    } else {
        console.log('✅ Connecté à la base de données /database/championnat.db');
    }
});


function broadcastData(data) {
    const jsonData = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(jsonData);
        }
    });
}

// const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const currentData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            ws.send(JSON.stringify(currentData));
        }
    } catch (e) {
        console.error("Impossible d'envoyer les données initiales au client WebSocket", e);
    }
    ws.on('error', (error) => console.error('Erreur WebSocket:', error));
});

// Route principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/views/login.html'), {
        headers: {
            'Content-Type': 'text/html; charset=utf-8'
        }
    });
});

// Route de login (POST)
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get(
        'SELECT * FROM users WHERE username = ? AND password = ?',
        [username, password],
        (err, row) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Erreur serveur' });
            }

            if (!row) {
                return res.status(401).json({ error: 'Identifiants incorrects' });
            }

            return res.json({
                success: true,
                userId: row.id,
                nom_complet: row.nom_complet,
                role: row.role,
                redirect: row.role === 'admin' ? '/views/admin-dashboard.html' : '/views/index_ken.html'
            });
        }
    );
});

// Route de Signin (POST)
app.post('/register', (req, res) => {
    const { username, password, role, nom_complet } = req.body;

    db.run(
        `INSERT INTO users (username, password, role, nom_complet)
         VALUES (?, ?, ?, ?)`,
        [username, password, role, nom_complet],
        function (err) {
            if (err) {
                console.error(err.message);
                return res.status(400).json({ error: 'Ce nom d’utilisateur existe déjà.' });
            }

            return res.json({
                message: 'Inscription réussie',
                nom_complet,
                redirect: '/views/index_ken.html'
            });
        }
    );
});

// Route de matchs (POST)
app.get('/api/matchs', async (req, res) => {
    try {
        const rows = await new Promise((resolve, reject) => {
            db.all(`
                SELECT m.id, 
                       d.nom AS equipe_dom, 
                       e.nom AS equipe_ext,
                       m.date_match,
                       m.equipe_dom_id,
                       m.equipe_ext_id,
                       m.stade
                FROM matchs m
                JOIN equipes d ON m.equipe_dom_id = d.id
                JOIN equipes e ON m.equipe_ext_id = e.id
                ORDER BY m.date_match DESC
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Valider que des données existent
        if (!rows || rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Aucun match trouvé"
            });
        }

        res.json(rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: "Erreur de base de données",
            details: err.message
        });
    }
});

// Route pour ajouter un match
app.post('/api/matchs', async (req, res) => {
    const { equipe_dom_id, equipe_ext_id, date_match, stade } = req.body;

    // Validation des données
    if (!equipe_dom_id || !equipe_ext_id || !date_match || !stade) {
        return res.status(400).json({
            success: false,
            message: 'Tous les champs sont requis'
        });
    }

    if (equipe_dom_id === equipe_ext_id) {
        return res.status(400).json({
            success: false,
            message: 'Les équipes doivent être différentes'
        });
    }

    try {
        // Vérification que les équipes existent
        const equipesExist = await new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as count FROM equipes WHERE id IN (?, ?)`,
                [equipe_dom_id, equipe_ext_id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row.count === 2);
                }
            );
        });

        if (!equipesExist) {
            return res.status(400).json({
                success: false,
                message: 'Une ou plusieurs équipes n\'existent pas'
            });
        }

        // Insertion dans la base de données
        const result = await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO matchs (equipe_dom_id, equipe_ext_id, date_match, stade) 
                 VALUES (?, ?, ?, ?)`,
                [equipe_dom_id, equipe_ext_id, date_match, stade.trim()],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });

        res.json({
            success: true,
            message: 'Match ajouté avec succès',
            matchId: result
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Erreur de base de données',
            error: err.message
        });
    }
});

// Route de équipes (POST)

app.post('/api/equipes', (req, res) => {
  const { nom, manager } = req.body;

  const sql = `INSERT INTO equipes (nom, manager) VALUES (?, ?)`;

  db.run(sql, [nom, manager], function(err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Erreur lors de l’ajout de l’équipe' });
    }
    res.json({ success: true, equipeId: this.lastID });
  });
});

// Route GET /api/equipes améliorée
app.get('/api/equipes', (req, res) => {
    console.log("Requête pour obtenir les équipes reçue");
    
    const sql = "SELECT id, nom, manager FROM equipes ORDER BY nom";
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Erreur de base de données:", err);
            return res.status(500).json({
                success: false,
                message: "Erreur de base de données",
                error: err.message
            });
        }
        
        console.log(`Retour de ${rows.length} équipes`);
        res.json(rows);
    });
});

app.get('/api/matchs/sans-resultat', (req, res) => {
    const sql = `
        SELECT m.id, m.date_match, 
               d.nom AS equipe_dom, e.nom AS equipe_ext, 
               m.stade
        FROM matchs m
        JOIN equipes d ON m.equipe_dom_id = d.id
        JOIN equipes e ON m.equipe_ext_id = e.id
        WHERE NOT EXISTS (
            SELECT 1 FROM resultats r WHERE r.match_id = m.id
        )
        ORDER BY m.date_match DESC
    `;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Erreur de base de données' });
        }
        res.json(rows);
    });
});

// Route pour enregistrer un résultat simple
app.post('/api/resultats', (req, res) => {
    const { match_id, score_dom, score_ext } = req.body;
    
    // Validation simple
    if (!match_id || score_dom === undefined || score_ext === undefined) {
        return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    // Vérifier que le match n'a pas déjà un résultat
    const checkSql = `SELECT 1 FROM resultats WHERE match_id = ?`;
    db.get(checkSql, [match_id], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Erreur de vérification' });
        }
        
        if (row) {
            return res.status(409).json({ error: 'Ce match a déjà un résultat' });
        }

        // Insertion du résultat
        const insertSql = `
            INSERT INTO resultats (match_id, score_dom, score_ext)
            VALUES (?, ?, ?)
        `;
        
        db.run(insertSql, [match_id, score_dom, score_ext], function(err) {
            if (err) {
                console.error(err.message);
                return res.status(500).json({ error: 'Erreur lors de l\'enregistrement' });
            }
            
            // Mettre à jour aussi la table matchs pour cohérence
            db.run(
                `UPDATE matchs SET score_dom = ?, score_ext = ? WHERE id = ?`,
                [score_dom, score_ext, match_id],
                (updateErr) => {
                    if (updateErr) {
                        console.error(updateErr.message);
                    }
                    // Réussite même si l'update échoue (le résultat est quand même enregistré)
                    res.json({ 
                        success: true,
                        message: 'Résultat enregistré avec succès',
                        resultatId: this.lastID
                    });
                }
            );
        });
    });
});

// Route pour ajouter un joueur (version corrigée)
app.post('/api/joueurs', (req, res) => {
    const { nom, numero_maillot, poste, equipe_id } = req.body;

    // Validation améliorée
    if (!nom || numero_maillot === undefined || !poste || !equipe_id) {
        return res.status(400).json({ 
            success: false,
            error: 'Tous les champs sont requis',
            details: {
                nom: !nom ? 'Manquant' : 'Valide',
                numero_maillot: numero_maillot === undefined ? 'Manquant' : 'Valide',
                poste: !poste ? 'Manquant' : 'Valide',
                equipe_id: !equipe_id ? 'Manquant' : 'Valide'
            }
        });
    }

    // Vérifier que l'équipe existe
    db.get(`SELECT id FROM equipes WHERE id = ?`, [equipe_id], (err, team) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ 
                success: false,
                error: 'Erreur de vérification de l\'équipe'
            });
        }

        if (!team) {
            return res.status(404).json({
                success: false,
                error: 'Équipe non trouvée'
            });
        }

        // Vérifier l'unicité du numéro dans l'équipe
        db.get(`SELECT id FROM joueurs WHERE equipe_id = ? AND numero_maillot = ?`, 
        [equipe_id, numero_maillot], (err, existing) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    success: false,
                    error: 'Erreur de vérification du numéro'
                });
            }

            if (existing) {
                return res.status(409).json({
                    success: false,
                    error: 'Numéro déjà utilisé dans cette équipe'
                });
            }

            // Insertion du joueur
            db.run(`INSERT INTO joueurs (nom, numero_maillot, poste, equipe_id) VALUES (?, ?, ?, ?)`,
            [nom, numero_maillot, poste, equipe_id], function(err) {
                if (err) {
                    console.error(err);
                    return res.status(500).json({
                        success: false,
                        error: 'Erreur lors de l\'ajout du joueur'
                    });
                }

                // Succès
                res.status(201).json({
                    success: true,
                    message: 'Joueur ajouté avec succès',
                    joueurId: this.lastID,
                    data: {
                        nom,
                        numero_maillot,
                        poste,
                        equipe_id
                    }
                });
            });
        });
    });
});

// Route pour obtenir les matchs avec résultats (pour sélection)
app.get('/api/matchs/avec-resultats', (req, res) => {
    const sql = `
        SELECT m.id, m.date_match, m.stade,
               d.nom AS equipe_dom, d.id AS equipe_dom_id,
               e.nom AS equipe_ext, e.id AS equipe_ext_id
        FROM matchs m
        JOIN equipes d ON m.equipe_dom_id = d.id
        JOIN equipes e ON m.equipe_ext_id = e.id
        WHERE EXISTS (
            SELECT 1 FROM resultats r WHERE r.match_id = m.id
        )
        ORDER BY m.date_match DESC
    `;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Erreur de base de données' });
        }
        res.json(rows);
    });
});

// Route pour obtenir les joueurs d'une équipe
app.get('/api/equipes/:id/joueurs', (req, res) => {
    const sql = `
        SELECT id, nom, numero_maillot, poste
        FROM joueurs
        WHERE equipe_id = ?
        ORDER BY numero_maillot
    `;
    
    db.all(sql, [req.params.id], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Erreur de base de données' });
        }
        res.json(rows);
    });
});

// Route pour enregistrer les buts (version corrigée)
app.post('/api/buts', (req, res) => {
    const buts = req.body;
    
    // Validation (correction de la syntaxe ici)
    if (!Array.isArray(buts)) {
        return res.status(400).json({ error: 'Données invalides' });
    }
    
    // Vérification que le tableau n'est pas vide
    if (buts.length === 0) {
        return res.status(400).json({ error: 'Aucun but à enregistrer' });
    }

    // Démarrer une transaction
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        const stmt = db.prepare(`
            INSERT INTO buteurs (joueur_id, match_id, minute)
            VALUES (?, ?, ?)
        `);
        
        let hasError = false;
        
        buts.forEach(but => {
            // Validation de chaque but
            if (!but.joueur_id || !but.match_id || but.minute === undefined) {
                hasError = true;
                return;
            }
            
            stmt.run([but.joueur_id, but.match_id, but.minute], (err) => {
                if (err) {
                    console.error(err.message);
                    hasError = true;
                }
            });
        });
        
        stmt.finalize(err => {
            if (err || hasError) {
                db.run('ROLLBACK');
                return res.status(400).json({ 
                    error: 'Erreur lors de l\'enregistrement',
                    details: err ? err.message : 'Données de but invalides'
                });
            }
            
            db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                    console.error(commitErr.message);
                    return res.status(500).json({ 
                        error: 'Erreur de transaction',
                        details: commitErr.message
                    });
                }
                
                res.status(201).json({ 
                    success: true,
                    message: `${buts.length} but(s) enregistré(s) avec succès`,
                    butsEnregistres: buts.length
                });
            });
        });
    });
});

// Route pour enregistrer les cartons
app.post('/api/cartons', async (req, res) => {
    const cartons = req.body;

    // Validation
    if (!Array.isArray(cartons)) {
        return res.status(400).json({ error: 'Les données doivent être un tableau' });
    }

    try {
        await db.run('BEGIN TRANSACTION');
        
        for (const carton of cartons) {
            // Validation de chaque carton
            if (!carton.joueur_id || !carton.match_id || !carton.type || carton.minute === undefined) {
                await db.run('ROLLBACK');
                return res.status(400).json({ 
                    error: 'Données incomplètes',
                    details: `Carton invalide: ${JSON.stringify(carton)}`
                });
            }

            await db.run(
                `INSERT INTO cartons (joueur_id, match_id, type, minute) VALUES (?, ?, ?, ?)`,
                [carton.joueur_id, carton.match_id, carton.type, carton.minute]
            );
        }
        
        await db.run('COMMIT');
        res.status(201).json({ 
            success: true,
            message: `${cartons.length} carton(s) enregistré(s) avec succès`
        });
        
    } catch (err) {
        await db.run('ROLLBACK');
        console.error('Erreur SQL:', err);
        
        res.status(500).json({ 
            error: 'Erreur de base de données',
            details: err.message
        });
    }
});

// Route pour les matchs récents (joués)
app.get('/api/matchs/recent', async (req, res) => {
    try {
        const rows = await new Promise((resolve, reject) => {
            db.all(`
                SELECT m.id, 
                       d.nom AS equipe_dom, 
                       e.nom AS equipe_ext,
                       m.date_match,
                       m.stade,
                       r.score_dom,
                       r.score_ext,
                       CASE WHEN r.id IS NOT NULL THEN 'Terminé' ELSE 'En cours' END AS status
                FROM matchs m
                JOIN equipes d ON m.equipe_dom_id = d.id
                JOIN equipes e ON m.equipe_ext_id = e.id
                LEFT JOIN resultats r ON m.id = r.match_id
                WHERE m.date_match < datetime('now')
                ORDER BY m.date_match DESC
                LIMIT 6
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: "Erreur de base de données",
            details: err.message
        });
    }
});

// Route pour les matchs à venir
app.get('/api/matchs/upcoming', async (req, res) => {
    try {
        const rows = await new Promise((resolve, reject) => {
            db.all(`
                SELECT m.id, 
                       d.nom AS equipe_dom, 
                       e.nom AS equipe_ext,
                       m.date_match,
                       m.equipe_dom_id,
                       m.equipe_ext_id,
                       m.stade
                FROM matchs m
                JOIN equipes d ON m.equipe_dom_id = d.id
                JOIN equipes e ON m.equipe_ext_id = e.id
                WHERE m.id NOT IN (SELECT match_id FROM resultats)
                ORDER BY m.date_match ASC
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        if (!rows || rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Aucun match à venir trouvé"
            });
        }

        res.json(rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: "Erreur de base de données",
            details: err.message
        });
    }
});

// Route pour les matchs terminés avec résultats
app.get('/api/matchs/resultats', async (req, res) => {
    try {
        const rows = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    m.id,
                    d.nom AS equipe_dom,
                    e.nom AS equipe_ext,
                    m.date_match,
                    m.stade,
                    r.score_dom,
                    r.score_ext,
                    'Terminé' AS status
                FROM matchs m
                JOIN equipes d ON m.equipe_dom_id = d.id
                JOIN equipes e ON m.equipe_ext_id = e.id
                JOIN resultats r ON m.id = r.match_id
                ORDER BY m.date_match DESC
                LIMIT 4
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: "Erreur de base de données",
            details: err.message
        });
    }
});

// Route recuperer les joueurs
app.get('/api/joueurs', async (req, res) => {
    try {
        const rows = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    j.id, 
                    j.nom, 
                    j.poste, 
                    j.numero_maillot,
                    e.nom AS equipe
                FROM joueurs j
                JOIN equipes e ON j.equipe_id = e.id
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Erreur lors de la récupération des joueurs", error: err.message });
    }
});

// Route pour les matchs à venir
app.get('/api/matchs/a-venir', async (req, res) => {
    try {
        const rows = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    m.id,
                    d.nom AS equipe_dom,
                    e.nom AS equipe_ext,
                    m.date_match,
                    m.stade
                FROM matchs m
                JOIN equipes d ON m.equipe_dom_id = d.id
                JOIN equipes e ON m.equipe_ext_id = e.id
                WHERE m.id NOT IN (SELECT match_id FROM resultats)
                ORDER BY m.date_match ASC
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Erreur de base de données", details: err.message });
    }
});

// Route pour obtenir les équipes
app.get('/api/equipes', (req, res) => {
  db.all('SELECT id, nom FROM equipes ORDER BY nom ASC', [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erreur base de données' });
    }
    res.json(rows);
  });
});

// ✅ Route : Meilleurs buteurs
app.get('/topscorers', (req, res) => {
  const sql = `
    SELECT j.nom AS joueur, e.nom AS equipe, COUNT(b.id) AS total_buts
    FROM buteurs b
    JOIN joueurs j ON b.joueur_id = j.id
    JOIN equipes e ON j.equipe_id = e.id
    GROUP BY b.joueur_id
    ORDER BY total_buts DESC
    LIMIT 20
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Erreur dans /topscorers:', err.message);
      return res.status(500).json({ error: err.message });
    }
    console.log('Résultats topscorers:', rows); // Log pour débogage
    res.json(rows);
  });
});

// ✅ Route : Cartons jaunes
app.get('/yellowcards', (req, res) => {
  const sql = `
    SELECT j.nom AS joueur, e.nom AS equipe, COUNT(c.id) AS total_jaunes
    FROM cartons c
    JOIN joueurs j ON c.joueur_id = j.id
    JOIN equipes e ON j.equipe_id = e.id
    WHERE c.type = 'jaune'
    GROUP BY c.joueur_id
    ORDER BY total_jaunes DESC
    LIMIT 20
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Erreur dans /yellowcards:', err.message);
      return res.status(500).json({ error: err.message });
    }
    console.log('Résultats yellowcards:', rows); // Log pour débogage
    res.json(rows);
  });
});

// ✅ Route : Cartons rouges
app.get('/redcards', (req, res) => {
  const sql = `
    SELECT j.nom AS joueur, e.nom AS equipe, COUNT(c.id) AS total_rouges
    FROM cartons c
    JOIN joueurs j ON c.joueur_id = j.id
    JOIN equipes e ON j.equipe_id = e.id
    WHERE c.type = 'rouge'
    GROUP BY c.joueur_id
    ORDER BY total_rouges DESC
    LIMIT 20
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Erreur dans /redcards:', err.message);
      return res.status(500).json({ error: err.message });
    }
    console.log('Résultats redcards:', rows); // Log pour débogage
    res.json(rows);
  });
});



// app.get('/api/tournament-data', (req, res) => {
//   const filePath = path.join(__dirname, '../frontend/data/calendrier.json');

//   if (!fs.existsSync(filePath)) {
//     return res.status(404).json({ error: 'Fichier non trouvé.' });
//   }

//   const json = fs.readFileSync(filePath, 'utf-8');
//   try {
//     const data = JSON.parse(json);
//     res.json(data);
//   } catch (err) {
//     res.status(500).json({ error: 'Fichier JSON invalide.' });
//   }
// });

// Routes API
// app.post('/api/update-live-view', (req, res) => {
//     try {
//         liveTournamentData = req.body;
        
//         // Diffuser à tous les clients connectés
//         wss.clients.forEach(client => {
//             if (client.readyState === WebSocket.OPEN) {
//                 client.send(JSON.stringify(liveTournamentData));
//             }
//         });
        
//         res.json({ success: true });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });



// Route pour sauvegarder les modifications
// Routes
/**
 * @description Récupère les données actuelles du tournoi depuis le fichier JSON.
 */
app.get('/api/get-tournament', (req, res) => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const tournamentData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            res.json({ success: true, data: tournamentData });
        } else {
            initDataFile();
            const tournamentData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            res.json({ success: true, data: tournamentData });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: 'Erreur serveur.' });
    }
});


/**
 * @description Sauvegarde l'état du tournoi en fusionnant les nouvelles données avec les données existantes.
 *              Ceci préserve les informations des sessions précédentes.
 */
app.post('/api/save-tournament', async (req, res) => {
    try {
        const newDataFromClient = req.body;
        
        // Étape 1: Lire les données existantes du fichier pour ne pas repartir de zéro.
        let finalData = {};
        if (fs.existsSync(DATA_FILE)) {
            finalData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        } else {
            // Si le fichier n'existe pas, l'initialiser
            initDataFile();
            finalData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }

        // Récupérer les détails des équipes pour enrichir les données (nom de l'équipe)
        const equipesDetails = await new Promise((resolve, reject) => {
            db.all("SELECT id, nom FROM equipes", [], (err, rows) => {
                if (err) reject(err); else resolve(rows);
            });
        });

        const getTeamName = (id) => {
            if (!id) return '';
            const equipe = equipesDetails.find(e => e.id.toString() === id.toString());
            return equipe ? equipe.nom : '';
        };

        // Étape 2: Logique de fusion intelligente
        
        // --- Fusion pour les Groupes ---
        // On vérifie si les données des groupes envoyées par le client contiennent au moins une équipe.
        // `flat()` transforme le tableau de tableaux en un seul, `some()` vérifie si au moins un élément est vrai.
        const newGroupsHaveData = Object.values(newDataFromClient.groupes).flat().some(team => team.id);
        
        if (newGroupsHaveData) {
            // Si oui, on met à jour la section 'groupes' de nos données finales.
            finalData.groupes = {
                A: newDataFromClient.groupes.A.map(t => ({ id: t.id, nom: getTeamName(t.id), points: parseInt(t.points) || 0 })),
                B: newDataFromClient.groupes.B.map(t => ({ id: t.id, nom: getTeamName(t.id), points: parseInt(t.points) || 0 })),
                C: newDataFromClient.groupes.C.map(t => ({ id: t.id, nom: getTeamName(t.id), points: parseInt(t.points) || 0 })),
                D: newDataFromClient.groupes.D.map(t => ({ id: t.id, nom: getTeamName(t.id), points: parseInt(t.points) || 0 }))
            };
        }
        // Si `newGroupsHaveData` est faux, on ne fait rien, conservant ainsi les données des groupes existantes dans `finalData`.

        // --- Fusion pour l'arbre de tournoi (Quarts, Demis, Finale) ---
        // On vérifie si des données ont été saisies pour l'arbre.
        const newBracketHasData = newDataFromClient.quarts.some(q => q.equipe1 || q.equipe2);
        if (newBracketHasData) {
            finalData.quarts = newDataFromClient.quarts.map(q => ({
                equipe1: q.equipe1, nom1: getTeamName(q.equipe1),
                equipe2: q.equipe2, nom2: getTeamName(q.equipe2)
            }));
            finalData.demis = newDataFromClient.demis.map(d => ({
                equipe1: d.equipe1, nom1: getTeamName(d.equipe1),
                equipe2: d.equipe2, nom2: getTeamName(d.equipe2)
            }));
            finalData.finale = {
                equipe1: newDataFromClient.finale.equipe1, nom1: getTeamName(newDataFromClient.finale.equipe1),
                equipe2: newDataFromClient.finale.equipe2, nom2: getTeamName(newDataFromClient.finale.equipe2)
            };
        }

        // --- Fusion pour le Vainqueur ---
        // On vérifie si un vainqueur a été sélectionné.
        const newWinnerIsSet = newDataFromClient.vainqueur && newDataFromClient.vainqueur !== '';
        
        if (newWinnerIsSet) {
            // Si oui, on met à jour le vainqueur.
            finalData.vainqueur = {
                id: newDataFromClient.vainqueur,
                nom: getTeamName(newDataFromClient.vainqueur)
            };
        }
        // Si le champ vainqueur est envoyé vide, on conserve l'ancien vainqueur.
        // Si vous souhaitez permettre de "réinitialiser" le vainqueur en le laissant vide, il faudrait ajuster cette logique.
        // Mais pour l'instant, cela protège contre l'effacement accidentel.

        // Étape 3: Mettre à jour les métadonnées et sauvegarder
        finalData.equipesDetails = equipesDetails;
        finalData.lastUpdated = new Date().toISOString();

        fs.writeFileSync(DATA_FILE, JSON.stringify(finalData, null, 2));
        broadcastData(finalData); // Informer les clients connectés de la mise à jour

        res.json({ success: true, message: "Données fusionnées et mises à jour avec succès.", data: finalData });

    } catch (error) {
        console.error('Erreur lors de la sauvegarde du tournoi:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


/**
 * @description Met à jour la vue en direct sans sauvegarder dans le fichier.
 */
app.post('/api/update-live-view', (req, res) => {
    try {
        liveTournamentData = req.body;
        broadcastData(liveTournamentData);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});




module.exports = app; 






// Démarrer le serveur
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
    console.log(`Accès direct: http://localhost:${PORT}/views/login.html`);
});
