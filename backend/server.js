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
try {
    tournamentData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
} catch (err) {
    tournamentData = {
        groupes: { A: [], B: [], C: [], D: [] },
        arbre: {
            quarts: [], 
            demis: [], 
            finale: {}, 
            vainqueur: {}
        }
    };
}

function initDataFile() {
    if (!fs.existsSync(DATA_FILE)) {
        const defaultData = {
            groupes: { A: [], B: [], C: [], D: [] },
            quarts: Array(4).fill({ equipe1: '', equipe2: '' }),
            demis: Array(2).fill({ equipe1: '', equipe2: '' }),
            finale: { equipe1: '', equipe2: '' },
            vainqueur: ''
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
    }
}
initDataFile();



// Middleware
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/images', express.static(path.join(__dirname, '../frontend/images')));
app.use('/assets', express.static(path.join(__dirname, '../frontend/assets')));
app.use('/views', express.static(path.join(__dirname, '../frontend/views')));
app.use('/js', express.static(path.join(__dirname, 'frontend/assets/js')));
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

// const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    // Envoyer les données actuelles à la connexion
    ws.send(JSON.stringify(liveTournamentData));
    
    ws.on('error', (error) => {
        console.error('Erreur WebSocket:', error);
    });
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
                       m.stade
                FROM matchs m
                JOIN equipes d ON m.equipe_dom_id = d.id
                JOIN equipes e ON m.equipe_ext_id = e.id
                WHERE m.date_match > datetime('now')
                ORDER BY m.date_match ASC
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



app.get('/api/tournament-data', (req, res) => {
  const filePath = path.join(__dirname, '../frontend/data/calendrier.json');

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Fichier non trouvé.' });
  }

  const json = fs.readFileSync(filePath, 'utf-8');
  try {
    const data = JSON.parse(json);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Fichier JSON invalide.' });
  }
});

// Routes API
app.post('/api/update-live-view', (req, res) => {
    try {
        liveTournamentData = req.body;
        
        // Diffuser à tous les clients connectés
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(liveTournamentData));
            }
        });
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// Route pour sauvegarder les modifications
// Routes
app.post('/api/save-tournament', (req, res) => {
    try {
        const newData = req.body;
        fs.writeFileSync(DATA_FILE, JSON.stringify(newData, null, 2));
        
        // Diffuser à tous les clients WebSocket
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(newData));
            }
        });
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/get-tournament', async (req, res) => {
    try {
        // 1. Lire le fichier tournamentdata.json
        const rawData = fs.readFileSync('./tournamentdata.json', 'utf8');
        const tournamentData = JSON.parse(rawData);

        // 2. Récupérer toutes les équipes depuis la DB
        const equipes = await new Promise((resolve, reject) => {
            db.all("SELECT id, nom FROM equipes", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // 3. Fonction pour trouver le nom d'une équipe par son ID
        const getNomEquipe = (id) => {
            if (!id) return '';
            const equipe = equipes.find(e => e.id.toString() === id.toString());
            return equipe ? equipe.nom : `Équipe ${id}`;
        };

        // 4. Construire la réponse avec les noms d'équipes
        const responseData = {
            groupes: {},
            quarts: [],
            demis: [],
            finale: {},
            vainqueur: null
        };

        // Remplir les groupes
        if (tournamentData.groupes) {
            for (const [groupe, ids] of Object.entries(tournamentData.groupes)) {
                responseData.groupes[groupe] = ids.map(id => ({
                    id,
                    nom: getNomEquipe(id)
                }));
            }
        }

        // Remplir les quarts de finale
        if (tournamentData.quarts) {
            responseData.quarts = tournamentData.quarts.map(quart => ({
                equipe1: quart.equipe1,
                nom1: getNomEquipe(quart.equipe1),
                equipe2: quart.equipe2,
                nom2: getNomEquipe(quart.equipe2)
            }));
        }

        // Remplir les demi-finales
        if (tournamentData.demis) {
            responseData.demis = tournamentData.demis.map(demi => ({
                equipe1: demi.equipe1,
                nom1: getNomEquipe(demi.equipe1),
                equipe2: demi.equipe2,
                nom2: getNomEquipe(demi.equipe2)
            }));
        }

        // Remplir la finale
        if (tournamentData.finale) {
            responseData.finale = {
                equipe1: tournamentData.finale.equipe1,
                nom1: getNomEquipe(tournamentData.finale.equipe1),
                equipe2: tournamentData.finale.equipe2,
                nom2: getNomEquipe(tournamentData.finale.equipe2)
            };
        }

        // Remplir le vainqueur
        if (tournamentData.vainqueur) {
            responseData.vainqueur = {
                id: tournamentData.vainqueur,
                nom: getNomEquipe(tournamentData.vainqueur)
            };
        }

        res.json({ success: true, data: responseData });

    } catch (error) {
        console.error('Erreur get-tournament:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur serveur',
            details: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});


app.get('/api/get-tournament-live', (req, res) => {
    res.json(liveTournamentData);
});




module.exports = app; 






// Démarrer le serveur
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
    console.log(`Accès direct: http://localhost:${PORT}/views/login.html`);
});
