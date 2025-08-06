document.addEventListener('DOMContentLoaded', async function() {
  const BASE_URL = 'https://koup-espwa-ccpap.onrender.com';

  const fixturesListContainer = document.getElementById('fixtures-list');
  const dropdownMenu = document.querySelector('#allTeamsDropdown + .dropdown-menu');
  const dropdownButton = document.getElementById('allTeamsDropdown');

  // 1. Récupérer tous les matchs à venir
  async function fetchUpcomingMatches() {
    try {
      const res = await fetch(`${BASE_URL}/api/matchs/a-venir`);
      if (!res.ok) throw new Error('Erreur chargement matchs');
      const data = await res.json();

      // Formatage simple des matchs avec champs pour affichage
      return data.map((m, i) => ({
        id: m.id,
        date: new Date(m.date_match).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        time: new Date(m.date_match).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        homeTeam: { name: m.equipe_dom, logo: 'https://via.placeholder.com/32x32/007bff/FFFFFF?text=🏠', stadium: m.stade },
        awayTeam: { name: m.equipe_ext, logo: 'https://via.placeholder.com/32x32/6c757d/FFFFFF?text=🚩' },
        status: 'Programmé',
        group: 'Groupe A', // tu peux modifier si tu as cette info en BDD
      }));
    } catch (e) {
      console.error(e);
      fixturesListContainer.innerHTML = '<p class="text-danger">Erreur de chargement des matchs.</p>';
      return [];
    }
  }

  // 2. Récupérer toutes les équipes
  async function fetchTeams() {
    try {
      const res = await fetch(`${BASE_URL}/api/equipes`);
      if (!res.ok) throw new Error('Erreur chargement équipes');
      return await res.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  // 3. Remplir le dropdown avec toutes les équipes
  async function populateTeamsDropdown() {
    const teams = await fetchTeams();
    if (!dropdownMenu) return;
    dropdownMenu.innerHTML = '';

    if (teams.length === 0) {
      dropdownMenu.innerHTML = '<li><span class="dropdown-item-text">Aucune équipe disponible</span></li>';
      return;
    }

    teams.forEach(team => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.classList.add('dropdown-item');
      a.href = '#';
      a.textContent = team.nom;
      a.dataset.teamName = team.nom;
      li.appendChild(a);
      dropdownMenu.appendChild(li);
    });
  }

  // 4. Fonction pour afficher les matchs (groupés par date)
  function displayFixtures(fixtures) {
    if (!fixturesListContainer) return;
    if (fixtures.length === 0) {
      fixturesListContainer.innerHTML = '<p class="text-center">Pas de matchs prévus pour cette équipe.</p>';
      return;
    }

    // Grouper par date
    const grouped = fixtures.reduce((acc, f) => {
      if (!acc[f.date]) acc[f.date] = [];
      acc[f.date].push(f);
      return acc;
    }, {});

    let html = '';
    for (const date in grouped) {
      html += `
        <div class="fixture-day mb-5">
          <h2 class="fixture-date mb-3 d-flex align-items-center">
            <i class="fas fa-calendar-alt me-2 custom-calendar-icon text-primary"></i> ${date}
          </h2>
          <div class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-4 fixture-row">
            ${grouped[date].map(createFixtureCardHTML).join('')}
          </div>
        </div>
      `;
    }
    fixturesListContainer.innerHTML = html;
    fixturesListContainer.classList.remove('loading-content');
  }

  // 5. Fonction de création HTML d’une carte match (adaptée de ton code)
  function createFixtureCardHTML(fixture) {
    return `
      <div class="col">
        <div class="card custom-fixture-card h-100">
          <div class="card-body">
            <span class="badge custom-group-badge bg-primary">${fixture.group}</span>
            <div class="d-flex align-items-center justify-content-between mt-2 fixture-matchup-mobile-stack">
              <div class="team-info text-start">
                <img src="${fixture.homeTeam.logo}" alt="Logo de ${fixture.homeTeam.name}" class="team-logo">
                <span class="team-name">${fixture.homeTeam.name}</span>
                <div class="stadium-info"><i class="fa-solid fa-location-dot me-1 text-primary"></i>${fixture.homeTeam.stadium}</div>
              </div>
              <div class="match-time">${fixture.time}</div>
              <div class="team-info text-end">
                <img src="${fixture.awayTeam.logo}" alt="Logo de ${fixture.awayTeam.name}" class="team-logo">
                <span class="team-name">${fixture.awayTeam.name}</span>
                <div class="stadium-info">À l'extérieur</div>
              </div>
            </div>
            <div class="d-flex justify-content-center justify-content-md-end mt-auto pt-3">
              <button class="btn custom-match-action-btn">Aperçu du match</button>
            </div>
            <span class="badge custom-status-badge bg-success">${fixture.status}</span>
          </div>
        </div>
      </div>
    `;
  }

  // 6. Au clic sur une équipe dans le dropdown : filtrer et afficher ses matchs
  dropdownMenu.addEventListener('click', (e) => {
    e.preventDefault();
    if (!e.target.classList.contains('dropdown-item')) return;

    const selectedTeam = e.target.dataset.teamName;
    dropdownButton.textContent = selectedTeam;

    // Affiche uniquement les matchs de cette équipe
    const filtered = allFixtures.filter(f =>
      f.homeTeam.name === selectedTeam || f.awayTeam.name === selectedTeam
    );

    displayFixtures(filtered);
  });

  // 7. Initialisation : fetch des données puis affichage de 4 matchs minimum
  const allFixtures = await fetchUpcomingMatches();
  await populateTeamsDropdown();

  // Afficher au moins 4 matchs au chargement (ou tous s'il y en a moins)
  displayFixtures(allFixtures.slice(0, 4));
});
