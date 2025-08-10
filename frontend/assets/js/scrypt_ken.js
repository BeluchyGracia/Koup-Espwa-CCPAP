/**
 * @file Script principal pour la page Champion League 2025
 * @description Gère la récupération des données depuis l'API, la génération dynamique
 * du contenu des carrousels et leur initialisation.
 * Inclut une solution pour éviter le "Flash of Unpopulated Content" (FOUC).
 */

document.addEventListener('DOMContentLoaded', function() {

    

    // =========================================================================
    // 1. DONNÉES SIMULÉES (FALLBACK)
    // =========================================================================

    const heroSlidesData = [
        {
            imageUrl: '/images/im5.JPG',
            title: 'Bienvenue au Koup Espwa CCPAP 2025',
            text: 'Suivez les scores, les statistiques et la progression des joueurs en temps réel.',
            buttonText: 'Voir les Matchs',
            buttonLink: '/views/fixtures.html'
        },
        {
            imageUrl: '/images/im12.JPG',
            title: 'Vivez le Frisson',
            text: 'Chaque match, chaque but, en direct.',
            buttonText: 'Voir les Scores',
            buttonLink: '/views/index_jim.html'
        },
        {
            imageUrl: '/images/im10.JPG',
            title: 'Rejoignez la Communauté',
            text: 'Inscrivez-vous pour suivre vos équipes préférées.',
            buttonText: 'Inscrivez-vous',
            buttonLink: '/views/signin.html'
        }
    ];

    const playerData = [
        { name: 'Joueur A', equipe: 'Équipe A', post: 'Attaquant', stat: 'Cartons Rouges: 2', colorindicator: 'text-danger', imageUrl: 'https://via.placeholder.com/100x100/FF5733/FFFFFF?text=A' },
        { name: 'Joueur B', equipe: 'Équipe B', post: 'Milieu', stat: 'Cartons Jaunes: 3', colorindicator: 'text-warning', imageUrl: 'https://via.placeholder.com/100x100/FFC300/FFFFFF?text=B' },
        { name: 'Joueur C', equipe: 'Équipe C', post: 'Buteur', stat: 'Buts: 8', colorindicator: 'text-success', imageUrl: 'https://via.placeholder.com/100x100/4CAF50/FFFFFF?text=C' },
        { name: 'Joueur D', equipe: 'Équipe D', post: 'Défenseur', stat: 'Cartons Rouges: 4', colorindicator: 'text-danger', imageUrl: 'https://via.placeholder.com/100x100/33AFFF/FFFFFF?text=D' },
        { name: 'Joueur E', equipe: 'Équipe E', post: 'Gardien', stat: 'Cartons Jaunes: 3', colorindicator: 'text-warning', imageUrl: 'https://via.placeholder.com/100x100/C70039/FFFFFF?text=E' },
        { name: 'Joueur F', equipe: 'Équipe F', post: 'Ailier', stat: 'Buts: 11', colorindicator: 'text-success', imageUrl: 'https://via.placeholder.com/100x100/900C3F/FFFFFF?text=F' }
    ];

    // =========================================================================
    // 2. FONCTIONS DE TEMPLATE HTML
    // =========================================================================

    const createHeroSlide = (slide) => `
        <div class="hero-slide" style="background-image: url('${slide.imageUrl}');">
            <div class="hero-content">
                <h1>${slide.title}</h1>
                <p>${slide.text}</p>
                <button class="btn" onclick="window.location.href='${slide.buttonLink}'">${slide.buttonText}</button>
            </div>
        </div>`;

    const createRecentMatchCard = (match) => {
        const statusIcon = match.status === 'Terminé' 
            ? '<i class="fa-solid fa-circle-check text-success fs-6"></i>'
            : '<i class="fa-solid fa-circle text-danger fs-6"></i>';
        
        return `
            <div class="card h-100">
                <h3>${match.equipe_dom} vs ${match.equipe_ext}</h3>
                <p>Score: ${match.score_dom || '0'} - ${match.score_ext || '0'}</p>
                <p>Date & Heure: ${new Date(match.date_match).toLocaleString()}</p>
                <p class="${match.status === 'Terminé' ? 'text-success' : 'text-danger'}">
                    Statut: ${match.status} ${statusIcon}
                </p>
            </div>`;
    };

    const createPlayedMatchCard = (match) => `
        <div class="card h-100">
            <h3>${match.equipe_dom} vs ${match.equipe_ext}</h3>
            <p>Score final: ${match.score_dom} - ${match.score_ext}</p>
            <p>Date: ${new Date(match.date_match).toLocaleString()}</p>
            <p class="text-success fw-bold">Match terminé</p>
        </div>`;

    const createUpcomingMatchCard = (match) => `
        <div class="card h-100 card-upcoming-match">
            <h3>${match.equipe_dom} vs ${match.equipe_ext}</h3>
            <p>Date & Heure: ${new Date(match.date_match).toLocaleString()}</p>
            <p><i class="fa-solid fa-location-dot fs-6 text-success"></i> ${match.stade}</p>
        </div>`;

        const createPlayerCard = (player) => {
    // Avatar généré via placeholder ou service externe
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(player.nom)}&background=0D8ABC&color=fff&size=100`;

    return `
        <div class="player-card h-100 text-center">
            <img src="${avatar}" alt="Photo de ${player.nom}" class="rounded-circle mb-2" width="100" height="100">
            <div class="info">
                <h3 class="fs-5 fw-bold">${player.nom}</h3>
                <p class="mb-0">${player.equipe}</p>
                <p class="text-muted">${player.poste}</p>
            </div>
        </div>
    `;
};


   

    // =========================================================================
    // 3. FONCTIONS DE RÉCUPÉRATION DES DONNÉES
    // =========================================================================

    async function fetchRecentMatches() {
        try {
            const response = await fetch('/api/matchs/recent');
            if (!response.ok) throw new Error('Erreur lors de la récupération des matchs récents');
            return await response.json();
        } catch (error) {
            console.error("Erreur fetchRecentMatches:", error);
            return [
                { equipe_dom: 'Équipe A', equipe_ext: 'Équipe B', score_dom: 3, score_ext: 2, date_match: '2025-10-15T18:00:00', stade: 'Stade Principal', status: 'Terminé' },
                { equipe_dom: 'Équipe C', equipe_ext: 'Équipe D', score_dom: 1, score_ext: 1, date_match: '2025-10-15T20:00:00', stade: 'Stade Secondaire', status: 'Terminé' }
            ];
        }
    }

    async function fetchPlayers() {
    try {
        const response = await fetch('/api/joueurs');
        if (!response.ok) throw new Error('Erreur lors de la récupération des joueurs');
        return await response.json();
    } catch (error) {
        console.error("Erreur fetchPlayers:", error);
        // Fallback simulé
        return [
            { nom: 'Joueur Simulé', poste: 'Défenseur', equipe: 'Équipe Fictive' }
        ];
    }
}




    async function fetchUpcomingMatches() {
        try {
            const response = await fetch('/api/matchs/upcoming');
            if (!response.ok) throw new Error('Erreur lors de la récupération des matchs à venir');
            return await response.json();
        } catch (error) {
            console.error("Erreur fetchUpcomingMatches:", error);
            return [
                { equipe_dom: 'Équipe G', equipe_ext: 'Équipe H', date_match: '2025-10-16T19:00:00', stade: 'Stade Un' },
                { equipe_dom: 'Équipe I', equipe_ext: 'Équipe J', date_match: '2025-10-17T20:00:00', stade: 'Arène de la Ville' }
            ];
        }
    }

    async function fetchPlayedMatches() {
        try {
            const response = await fetch('/api/matchs/resultats');
            if (!response.ok) throw new Error('Erreur lors de la récupération des matchs joués');
            return await response.json();
        } catch (error) {
            console.error("Erreur fetchPlayedMatches:", error);
            return [
                { equipe_dom: 'Équipe K', equipe_ext: 'Équipe L', score_dom: 2, score_ext: 1, date_match: '2025-07-10T17:00:00', status: 'Terminé' },
                { equipe_dom: 'Équipe M', equipe_ext: 'Équipe N', score_dom: 3, score_ext: 0, date_match: '2025-07-11T20:00:00', status: 'Terminé' }
            ];
        }
    }

    // =========================================================================
    // 4. RENDU DU CONTENU
    // =========================================================================



    function renderCarousel(carouselId, data, createCardFn, config) {
        const desktopInner = document.querySelector(`#${carouselId}Desktop .carousel-inner`);
        const mobileInner = document.querySelector(`#${carouselId}Mobile .carousel-inner`);

        if (desktopInner) {
            desktopInner.innerHTML = '';
            for (let i = 0; i < data.length; i += config.itemsPerSlideDesktop) {
                const slideData = data.slice(i, i + config.itemsPerSlideDesktop);
                const activeClass = i === 0 ? 'active' : '';
                desktopInner.innerHTML += `
                    <div class="carousel-item ${activeClass}">
                        <div class="row g-4 justify-content-center align-items-stretch">
                            ${slideData.map(item => `
                                <div class="${config.colClassDesktop || ''}">
                                    ${createCardFn(item)}
                                </div>
                            `).join('')}
                        </div>
                    </div>`;
            }
        }

        if (mobileInner) {
            mobileInner.innerHTML = '';
            for (let i = 0; i < data.length; i += config.itemsPerSlideMobile) {
                const slideData = data.slice(i, i + config.itemsPerSlideMobile);
                const activeClass = i === 0 ? 'active' : '';
                mobileInner.innerHTML += `
                    <div class="carousel-item ${activeClass}">
                        <div class="row g-4 justify-content-center align-items-stretch">
                            ${slideData.map(item => `
                                <div class="${config.colClassMobile || 'col-12'}">
                                    ${createCardFn(item)}
                                </div>
                            `).join('')}
                        </div>
                    </div>`;
            }
        }
    }

    // =========================================================================
    // 5. INITIALISATION
    // =========================================================================

   async function populateAllCarousels() {
    try {
        const [recentMatches, upcomingMatches, playedMatches, playerList] = await Promise.all([
            fetchRecentMatches(),
            fetchUpcomingMatches(),
            fetchPlayedMatches(),
            fetchPlayers()
        ]);

const heroCarouselInner = document.querySelector('#heroCarousel .carousel-inner');
if (heroCarouselInner) {
    heroCarouselInner.innerHTML = '';
    heroSlidesData.forEach((slide, index) => {
        const activeClass = index === 0 ? 'active' : '';
        const carouselItem = document.createElement('div');
        carouselItem.className = `carousel-item ${activeClass}`;

        // Solution optimale qui adapte la structure à l'image
        carouselItem.innerHTML = `
           <div class="hero-slide" style="
                background-image: url('${slide.imageUrl}');
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                aspect-ratio: 16/9;
                width: 100%;
                min-height: 70vh;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
            ">
                <div class="hero-content" style="
                    background: rgba(0, 0, 0, 0.4);
                    color: white;
                    padding: 1rem;
                    border-radius: 8px;
                    text-align: center;
                    max-width: 80%;
                ">
                    <h1>${slide.title}</h1>
                    <p>${slide.text}</p>
                    <a href="${slide.buttonLink}" class="btn">${slide.buttonText}</a>
                </div>
            </div>
        `;

        heroCarouselInner.appendChild(carouselItem);
    });
}



        renderCarousel('liveMatchesCarousel', recentMatches, createRecentMatchCard, {
            itemsPerSlideDesktop: 3,
            itemsPerSlideMobile: 1,
            colClassDesktop: 'col-lg-4 col-md-6',
        });

        renderCarousel('upcomingMatchesCarousel', upcomingMatches, createUpcomingMatchCard, {
            itemsPerSlideDesktop: 2,
            itemsPerSlideMobile: 1,
            colClassDesktop: 'col-md-6',
        });

        renderCarousel('playedMatchesCarousel', playedMatches, createPlayedMatchCard, {
            itemsPerSlideDesktop: 2,
            itemsPerSlideMobile: 1,
            colClassDesktop: 'col-lg-4 col-md-6',
        });

        renderCarousel('playerHighlightsCarousel', playerList, createPlayerCard, {
            itemsPerSlideDesktop: 3,
            itemsPerSlideMobile: 1,
            colClassDesktop: 'col-lg-4 col-md-6',
        });

    } catch (error) {
        console.error("Erreur populateAllCarousels:", error);
    }
}


    function initializeBootstrapCarousels() {
        const carousels = document.querySelectorAll('.carousel');
        carousels.forEach(carousel => {
            const interval = carousel.dataset.bsInterval ? parseInt(carousel.dataset.bsInterval, 10) : 5000;
            new bootstrap.Carousel(carousel, { interval: interval, wrap: true });
        });
    }

    function setupEventListeners() {
        const statsButtons = document.querySelectorAll('.stats-buttons .btn');
        statsButtons.forEach(button => {
            button.addEventListener('click', function() {
                statsButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
            });
        });
    }

    function activateLiveBlinking() {
        const liveIcons = document.querySelectorAll('p.text-danger i.fa-circle');
        liveIcons.forEach(icon => {
            icon.classList.add('is-blinking');
        });
    }

    // =========================================================================
    // 6. DÉMARRAGE
    // =========================================================================

    async function main() {
        try {
            await populateAllCarousels();
            initializeBootstrapCarousels();
            setupEventListeners();
            document.querySelectorAll('.loading-content').forEach(section => {
                section.classList.remove('loading-content');
            });
            activateLiveBlinking();
        } catch (error) {
            console.error("Erreur dans main:", error);
        }
    }

    main();
});