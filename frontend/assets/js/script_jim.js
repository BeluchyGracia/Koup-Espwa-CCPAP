document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab');
  const tableHeaders = document.getElementById('table-headers');
  const tableBody = document.getElementById('table-body');
  const paginationContainer = document.querySelector('.pagination');
  console.log("Script chargé avec succès!");

  // Variables de pagination
  let currentPage = 1;
  const itemsPerPage = 4;
  let currentType = 'topscorers';
  let totalItems = 0;

  const endpoints = {
    topscorers: {
      url: 'http://localhost:3000/topscorers',
      headers: ['#', 'Player', 'Team', 'Goals'],
      key: 'total_buts'
    },
    yellowcards: {
      url: 'http://localhost:3000/yellowcards',
      headers: ['#', 'Player', 'Team', 'Yellow Cards'],
      key: 'total_jaunes'
    },
    redcards: {
      url: 'http://localhost:3000/redcards',
      headers: ['#', 'Player', 'Team', 'Red Cards'],
      key: 'total_rouges'
    }
  };

  function setActiveTab(selectedTab) {
    tabs.forEach(tab => tab.classList.remove('active'));
    selectedTab.classList.add('active');
  }

  function renderTable(type, data) {
    const { headers, key } = endpoints[type];

    // En-têtes
    tableHeaders.innerHTML = '';
    headers.forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      tableHeaders.appendChild(th);
    });

    // Corps du tableau
    tableBody.innerHTML = '';
    const startIndex = (currentPage - 1) * itemsPerPage;
    
    data.forEach((item, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${startIndex + index + 1}</td>
        <td>${item.joueur}</td>
        <td>${item.equipe}</td>
        <td>${item[key]}</td>
      `;
      tableBody.appendChild(row);
    });

    // Mise à jour de la pagination
    totalItems = data.length;
    updatePagination();
  }

  function fetchAndRender(type, page = 1) {
    currentPage = page;
    currentType = type;
    
    fetch(`${endpoints[type].url}?page=${page}&limit=${itemsPerPage}`)
      .then(res => res.json())
      .then(data => renderTable(type, data))
      .catch(err => {
        console.error('Erreur chargement stats :', err);
        tableBody.innerHTML = '<tr><td colspan="4">Erreur lors du chargement des données</td></tr>';
      });
  }

  function updatePagination() {
    paginationContainer.innerHTML = '';
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Bouton Précédent
    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
      if (currentPage > 1) {
        fetchAndRender(currentType, currentPage - 1);
      }
    });
    paginationContainer.appendChild(prevButton);

    // Numéros de page
    for (let i = 1; i <= totalPages; i++) {
      const pageButton = document.createElement('button');
      pageButton.textContent = i;
      if (i === currentPage) {
        pageButton.classList.add('active');
      }
      pageButton.addEventListener('click', () => {
        fetchAndRender(currentType, i);
      });
      paginationContainer.appendChild(pageButton);
    }

    // Bouton Suivant
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => {
      if (currentPage < totalPages) {
        fetchAndRender(currentType, currentPage + 1);
      }
    });
    paginationContainer.appendChild(nextButton);
  }

  // Ajout des événements sur les onglets
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const type = tab.getAttribute('data-type');
      setActiveTab(tab);
      currentPage = 1; // Réinitialiser à la première page
      fetchAndRender(type);
    });
  });

  // Charger les Top Scorers au départ
  fetchAndRender('topscorers');
});